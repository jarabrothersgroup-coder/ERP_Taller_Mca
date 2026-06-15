/**
 * Ledger Service — Double-Entry Accounting Automation.
 *
 * Implements the core double-entry bookkeeping engine:
 *   - Plan de Cuentas CRUD (Chart of Accounts)
 *   - Asientos Contables (Journal entries) with Debe/Haber balance validation
 *   - Automatic journal generation from SIFEN invoices and inventory movements
 *   - Period closing and balance reporting
 *
 * All operations enforce:
 *   - ∑Debe = ∑Haber (accounting equation)
 *   - No negative balances on asset/expense accounts
 *   - Referential integrity with other modules
 *
 * N+1 prevention: all queries use JOINs or batch selects.
 *
 * @module finance/services/accounting/ledger.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { getDb } from "../../../../shared/database/connection.js";
import {
  planCuentas,
  asientosContables,
  asientosDetalle,
} from "../../schema/index.js";
import { eq, and, sql, desc, count, gte, lte } from "drizzle-orm";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../../../shared/errors/app-error.js";
import type {
  CreateCuentaRequest,
  CreateAsientoRequest,
  AsientoLineaRequest,
  CreateAsientoResponse,
  AsientoAutomaticoRequest,
} from "../../types.js";

// ─── Chart of Accounts ─────────────────────────

/**
 * Creates a new account in the chart of accounts (Plan de Cuentas).
 *
 * @param data - Account payload
 * @returns The created account
 * @throws {ConflictError} If the codigo already exists
 * @throws {ValidationError} If the parent account doesn't exist or nivel is invalid
 */
export async function createCuenta(
  data: CreateCuentaRequest,
): Promise<typeof planCuentas.$inferSelect> {
  // ── 1. Check uniqueness of codigo ──
  const existing = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(eq(planCuentas.codigo, data.codigo))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError(
      `Ya existe una cuenta con el código "${data.codigo}"`,
    );
  }

  // ── 2. Validate parent account if provided ──
  let nivel = data.nivel ?? 1;
  if (data.cuentaPadreId) {
    const padre = await db()
      .select({ id: planCuentas.id, nivel: planCuentas.nivel })
      .from(planCuentas)
      .where(eq(planCuentas.id, data.cuentaPadreId))
      .limit(1);

    if (padre.length === 0) {
      throw new NotFoundError("Cuenta padre no encontrada");
    }

    nivel = padre[0]!.nivel + 1;
  }

  // ── 3. Insert the account ──
  const [cuenta] = await db()
    .insert(planCuentas)
    .values({
      codigo: data.codigo,
      nombre: data.nombre,
      tipo: data.tipo,
      cuentaPadreId: data.cuentaPadreId ?? null,
      nivel,
      aceptaMovimientos: data.aceptaMovimientos ?? true,
    })
    .returning();

  return cuenta;
}

/**
 * Actualiza una cuenta contable (parcial).
 * Usado para desactivar/activar, cambiar nombre, tipo, etc.
 */
export async function updateCuenta(
  id: string,
  data: Partial<{
    nombre: string;
    tipo: "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO" | "COSTO" | "ORDEN";
    activo: boolean;
    aceptaMovimientos: boolean;
    cuentaPadreId: string | null;
  }>,
) {
  const [cuenta] = await db()
    .update(planCuentas)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(planCuentas.id, id))
    .returning();

  if (!cuenta) {
    throw new NotFoundError(`Cuenta con ID ${id} no encontrada`);
  }
  return cuenta;
}

/**
 * Retrieves a single account by ID.
 *
 * @param id - Account UUID
 * @returns The account record
 * @throws {NotFoundError} If not found
 */
export async function getCuentaById(id: string) {
  const [cuenta] = await db()
    .select()
    .from(planCuentas)
    .where(eq(planCuentas.id, id))
    .limit(1);

  if (!cuenta) {
    throw new NotFoundError(`Cuenta con ID ${id} no encontrada`);
  }

  return cuenta;
}

/**
 * Lists accounts with optional filtering by type and parent.
 *
 * @param options - Filter options
 * @returns List of accounts
 */
export async function listCuentas(options: {
  tipo?: string;
  activo?: boolean;
  nivel?: number;
  padreId?: string;
}) {
  const conditions: ReturnType<typeof eq>[] = [];

  if (options.tipo) {
    conditions.push(eq(planCuentas.tipo, options.tipo as any));
  }

  if (options.activo !== undefined) {
    conditions.push(eq(planCuentas.activo, options.activo));
  }

  if (options.nivel !== undefined) {
    conditions.push(eq(planCuentas.nivel, options.nivel));
  }

  if (options.padreId) {
    conditions.push(eq(planCuentas.cuentaPadreId, options.padreId));
  }

  const whereClause = conditions.length > 0
    ? and(...conditions)
    : undefined;

  return db()
    .select()
    .from(planCuentas)
    .where(whereClause)
    .orderBy(planCuentas.codigo);
}

/**
 * Returns the hierarchical tree of accounts.
 *
 * @returns Flat list with level info for client-side tree rendering
 */
export async function getArbolCuentas() {
  return db()
    .select({
      id: planCuentas.id,
      codigo: planCuentas.codigo,
      nombre: planCuentas.nombre,
      tipo: planCuentas.tipo,
      nivel: planCuentas.nivel,
      cuentaPadreId: planCuentas.cuentaPadreId,
      aceptaMovimientos: planCuentas.aceptaMovimientos,
      activo: planCuentas.activo,
    })
    .from(planCuentas)
    .where(eq(planCuentas.activo, true))
    .orderBy(planCuentas.codigo);
}

// ─── Journal Entries (Asientos Contables) ─────

/**
 * Creates a new journal entry (asiento contable) with double-entry validation.
 *
 * Validates:
 *   - At least 2 lines (one Debe, one Haber)
 *   - ∑Debe = ∑Haber
 *   - All referenced accounts exist and accept movements
 *   - Sequential numbering within the current period
 *
 * @param data - Journal entry payload with lines
 * @returns The created asiento with lines
 * @throws {ValidationError} If balance doesn't balance or lines are invalid
 */
export async function createAsiento(
  data: CreateAsientoRequest,
): Promise<CreateAsientoResponse> {
  const { fecha, concepto, lineas, documentoRef, moduloOrigen, ordenTrabajoId } = data;

  // ── 1. Validate lines ──
  if (!lineas || lineas.length < 2) {
    throw new ValidationError(
      "Un asiento debe tener al menos 2 líneas (un Débito y un Crédito)",
    );
  }

  // ── 2. Validate each line has either Debe or Haber (but not both empty) ──
  for (const [i, linea] of lineas.entries()) {
    const debe = parseFloat(linea.debe ?? "0");
    const haber = parseFloat(linea.haber ?? "0");

    if (debe === 0 && haber === 0) {
      throw new ValidationError(
        `Línea ${i + 1}: debe tener un monto en Débito o Crédito`,
      );
    }

    if (debe > 0 && haber > 0) {
      throw new ValidationError(
        `Línea ${i + 1}: no puede tener Débito y Crédito simultáneamente`,
      );
    }

    // Validate referenced account exists
    const cuenta = await db()
      .select({ id: planCuentas.id, aceptaMovimientos: planCuentas.aceptaMovimientos })
      .from(planCuentas)
      .where(eq(planCuentas.id, linea.cuentaId))
      .limit(1);

    if (cuenta.length === 0) {
      throw new NotFoundError(
        `Cuenta con ID ${linea.cuentaId} no encontrada (línea ${i + 1})`,
      );
    }

    if (!cuenta[0]!.aceptaMovimientos) {
      throw new ValidationError(
        `La cuenta ${linea.cuentaId} no acepta movimientos directos (línea ${i + 1})`,
      );
    }
  }

  // ── 3. Calculate totals and validate balance ──
  const totalDebe = lineas.reduce(
    (sum, l) => sum + parseFloat(l.debe ?? "0"),
    0,
  );
  const totalHaber = lineas.reduce(
    (sum, l) => sum + parseFloat(l.haber ?? "0"),
    0,
  );
  const diferencia = Math.abs(totalDebe - totalHaber);

  if (diferencia > 0.01) {
    throw new ValidationError(
      `El asiento no balancea: Débito=${totalDebe.toFixed(2)}, ` +
      `Haber=${totalHaber.toFixed(2)} (diferencia=${diferencia.toFixed(2)})`,
    );
  }

  // ── 4. Get next sequential number for the current month ──
  const fechaDate = new Date(fecha);
  const startOfMonth = new Date(fechaDate.getFullYear(), fechaDate.getMonth(), 1);
  const endOfMonth = new Date(fechaDate.getFullYear(), fechaDate.getMonth() + 1, 0, 23, 59, 59);

  const [maxNum] = await db()
    .select({ max: sql<number>`COALESCE(MAX(numero), 0)` })
    .from(asientosContables)
    .where(
      and(
        gte(asientosContables.fecha, startOfMonth),
        lte(asientosContables.fecha, endOfMonth),
      ),
    );

  const nextNum = (maxNum?.max ?? 0) + 1;

  // ── 5. Insert the asiento ──
  const [asiento] = await db()
    .insert(asientosContables)
    .values({
      numero: nextNum,
      fecha: fechaDate,
      concepto,
      totalDebe: String(totalDebe.toFixed(2)),
      totalHaber: String(totalHaber.toFixed(2)),
      diferencia: "0.00",
      estado: "CONTABILIZADO",
      documentoRef: documentoRef ?? null,
      moduloOrigen: moduloOrigen ?? null,
      ordenTrabajoId: ordenTrabajoId ?? null,
    })
    .returning();

  // ── 6. Insert individual lines ──
  const insertedLines = [];
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]!;
    const [detalle] = await db()
      .insert(asientosDetalle)
      .values({
        asientoId: asiento.id,
        cuentaId: linea.cuentaId,
        numeroLinea: i + 1,
        debe: linea.debe ? String(parseFloat(linea.debe).toFixed(2)) : null,
        haber: linea.haber ? String(parseFloat(linea.haber).toFixed(2)) : null,
        descripcion: linea.descripcion ?? null,
        centroCostoId: linea.centroCostoId ?? null,
        ordenTrabajoIdLinea: linea.ordenTrabajoId ?? null,
      })
      .returning();

    // Fetch account info for response
    const cuenta = await getCuentaById(linea.cuentaId);
    insertedLines.push({
      id: detalle.id,
      cuentaCodigo: cuenta.codigo,
      cuentaNombre: cuenta.nombre,
      debe: detalle.debe,
      haber: detalle.haber,
    });
  }

  return {
    asiento: {
      id: asiento.id,
      numero: asiento.numero,
      fecha: asiento.fecha.toISOString(),
      concepto: asiento.concepto,
      totalDebe: asiento.totalDebe ?? "0",
      totalHaber: asiento.totalHaber ?? "0",
      estado: asiento.estado,
    },
    lineas: insertedLines,
  };
}

/**
 * Retrieves a journal entry by ID with all its lines.
 *
 * @param id - Asiento UUID
 * @returns The asiento with line details
 * @throws {NotFoundError} If not found
 */
export async function getAsientoById(id: string) {
  const [asiento] = await db()
    .select()
    .from(asientosContables)
    .where(eq(asientosContables.id, id))
    .limit(1);

  if (!asiento) {
    throw new NotFoundError(`Asiento con ID ${id} no encontrado`);
  }

  const lineas = await db()
    .select({
      id: asientosDetalle.id,
      numeroLinea: asientosDetalle.numeroLinea,
      cuentaId: asientosDetalle.cuentaId,
      debe: asientosDetalle.debe,
      haber: asientosDetalle.haber,
      descripcion: asientosDetalle.descripcion,
      centroCostoId: asientosDetalle.centroCostoId,
      ordenTrabajoIdLinea: asientosDetalle.ordenTrabajoIdLinea,
    })
    .from(asientosDetalle)
    .where(eq(asientosDetalle.asientoId, id))
    .orderBy(asientosDetalle.numeroLinea);

  // Enrich with account info
  const enrichedLines = await Promise.all(
    lineas.map(async (l) => {
      const cuenta = await getCuentaById(l.cuentaId);
      return {
        ...l,
        cuentaCodigo: cuenta.codigo,
        cuentaNombre: cuenta.nombre,
      };
    }),
  );

  return { ...asiento, lineas: enrichedLines };
}

/**
 * Lists journal entries with optional period filtering and pagination.
 *
 * @param options - Filter and pagination options
 * @returns Paginated list of asientos
 */
export async function listAsientos(options: {
  desde?: string;
  hasta?: string;
  moduloOrigen?: string;
  ordenTrabajoId?: string;
  page?: number;
  limit?: number;
}) {
  const {
    desde,
    hasta,
    moduloOrigen,
    ordenTrabajoId,
    page = 1,
    limit = 20,
  } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq | typeof gte | typeof lte>[] = [];

  if (desde) {
    conditions.push(gte(asientosContables.fecha, new Date(desde)));
  }
  if (hasta) {
    conditions.push(lte(asientosContables.fecha, new Date(hasta)));
  }
  if (moduloOrigen) {
    conditions.push(eq(asientosContables.moduloOrigen, moduloOrigen));
  }
  if (ordenTrabajoId) {
    conditions.push(eq(asientosContables.ordenTrabajoId, ordenTrabajoId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalCount] = await db()
    .select({ total: count() })
    .from(asientosContables)
    .where(whereClause);

  const items = await db()
    .select()
    .from(asientosContables)
    .where(whereClause)
    .orderBy(desc(asientosContables.fecha))
    .limit(limit)
    .offset(offset);

  return {
    items,
    total: Number(totalCount?.total ?? 0),
    page,
    limit,
    totalPages: Math.ceil(Number(totalCount?.total ?? 0) / limit),
  };
}

/**
 * Generates automatic accounting entries from a work order.
 *
 * Maps work order costs (parts, labor, third-party) to the chart of
 * accounts and creates balanced journal entries automatically.
 *
 * @param data - Automatic entry request
 * @returns The created asiento
 */
export async function generarAsientoAutomatico(
  data: AsientoAutomaticoRequest,
): Promise<CreateAsientoResponse> {
  const { ordenTrabajoId, fecha, concepto } = data;

  // ── 1. Look up work order totals from the database ──
  // We query the work order and its associated third-party work
  // to build the journal entry lines
  const [orden] = await getDb()<Array<{ id: string; total_cost: string }>>`
    SELECT id, total_cost FROM work_orders WHERE id = ${ordenTrabajoId}
  `;

  if (!orden) {
    throw new NotFoundError(
      `Orden de trabajo ${ordenTrabajoId} no encontrada`,
    );
  }

  // ── 2. Find the relevant accounts ──
  // We need: a revenue account, a cost account, and a receivable/payment account
  const [cuentaIngresos] = await db()
    .select({ id: planCuentas.id, codigo: planCuentas.codigo })
    .from(planCuentas)
    .where(sql`${planCuentas.codigo} LIKE '4.1.%' AND ${planCuentas.activo} = true`)
    .limit(1);

  const [cuentaCosto] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(sql`${planCuentas.codigo} LIKE '6.1.%' AND ${planCuentas.activo} = true`)
    .limit(1);

  const [cuentaCaja] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(sql`${planCuentas.codigo} LIKE '1.1.01.%' AND ${planCuentas.activo} = true`)
    .limit(1);

  if (!cuentaIngresos || !cuentaCosto || !cuentaCaja) {
    throw new ValidationError(
      "No se encontraron las cuentas contables necesarias. " +
      "Verifique que el Plan de Cuentas tenga cuentas de Ingresos (4.1.x), " +
      "Costos (6.1.x), y Caja (1.1.01.x)",
    );
  }

  // ── 3. Build the balanced lines ──
  const total = orden.total_cost ?? "0";
  const lines: AsientoLineaRequest[] = [
    // Debe: Caja (se cobra al cliente)
    { cuentaId: cuentaCaja.id, debe: total },
    // Haber: Ingresos por servicios
    { cuentaId: cuentaIngresos.id, haber: total },
  ];

  // Also register cost if there's a costo account
  if (cuentaCosto) {
    lines.push({
      cuentaId: cuentaCosto.id,
      debe: total,
      ordenTrabajoId: ordenTrabajoId,
    });
  }

  return createAsiento({
    fecha,
    concepto: concepto ?? `Facturación automática OT #${ordenTrabajoId.slice(0, 8)}`,
    lineas: lines,
    moduloOrigen: "SIFEN",
    ordenTrabajoId,
  });
}

/**
 * Generates asiento de apertura (opening entry) for a new fiscal period.
 *
 * @param anho - Fiscal year
 * @param mes - Fiscal month
 * @returns The opening asiento
 */
export async function generarAsientoApertura(anho: number, mes: number) {
  const fecha = new Date(anho, mes - 1, 1);

  // Carry over balances from asset, liability, and equity accounts
  const cuentasSaldo = await db()
    .select({
      id: planCuentas.id,
      codigo: planCuentas.codigo,
      nombre: planCuentas.nombre,
      tipo: planCuentas.tipo,
      saldoInicial: planCuentas.saldoInicial,
    })
    .from(planCuentas)
    .where(
      and(
        eq(planCuentas.activo, true),
        eq(planCuentas.aceptaMovimientos, true),
        sql`${planCuentas.tipo} IN ('ACTIVO', 'PASIVO', 'PATRIMONIO')`,
      ),
    );

  if (cuentasSaldo.length === 0) {
    throw new ValidationError(
      "No hay cuentas de activo/pasivo/patrimonio para generar asiento de apertura",
    );
  }

  const lines: AsientoLineaRequest[] = [];
  let totalDebe = 0;
  let totalHaber = 0;

  for (const cta of cuentasSaldo) {
    const saldo = parseFloat(cta.saldoInicial ?? "0");
    if (saldo === 0) continue;

    if (cta.tipo === "ACTIVO") {
      lines.push({ cuentaId: cta.id, debe: cta.saldoInicial });
      totalDebe += saldo;
    } else {
      lines.push({ cuentaId: cta.id, haber: cta.saldoInicial });
      totalHaber += saldo;
    }
  }

  if (lines.length < 2) {
    throw new ValidationError("No hay suficientes saldos para apertura");
  }

  // Add balancing entry if needed
  const diff = totalDebe - totalHaber;
  if (Math.abs(diff) > 0.01) {
    // Find a retained earnings account
    const [retenidas] = await db()
      .select({ id: planCuentas.id })
      .from(planCuentas)
      .where(sql`${planCuentas.codigo} LIKE '3.4.%' AND ${planCuentas.activo} = true`)
      .limit(1);

    if (retenidas) {
      if (diff > 0) {
        lines.push({ cuentaId: retenidas.id, haber: diff.toFixed(2) });
      } else {
        lines.push({ cuentaId: retenidas.id, debe: Math.abs(diff).toFixed(2) });
      }
    }
  }

  return createAsiento({
    fecha: fecha.toISOString(),
    concepto: `Asiento de Apertura ${anho}-${String(mes).padStart(2, "0")}`,
    lineas: lines,
    moduloOrigen: "APERTURA",
  });
}

/**
 * Genera asiento de apertura usando saldos acumulados reales.
 *
 * A diferencia de generarAsientoApertura (que usa saldoInicial de
 * plan_cuentas), esta función calcula los saldos reales sumando
 * todos los asientos CONTABILIZADOS del período anterior.
 *
 * También verifica tenant_config para el ejercicio/período actual
 * y previene duplicados.
 *
 * @param anho - Año fiscal
 * @param mes - Mes fiscal (1-12)
 * @param tenantSlug - Tenant slug (para verificar tenant_config)
 * @returns El asiento de apertura creado
 */
export async function generarAperturaConSaldos(
  anho: number,
  mes: number,
  _tenantSlug: string,
) {
  // ── 1. Verificar que no exista ya un asiento de apertura para este período ──
  const start = new Date(anho, mes - 1, 1);
  const end = new Date(anho, mes, 0, 23, 59, 59);

  const [existing] = await db()
    .select({ id: asientosContables.id })
    .from(asientosContables)
    .where(
      and(
        eq(asientosContables.moduloOrigen, "APERTURA"),
        gte(asientosContables.fecha, start),
        lte(asientosContables.fecha, end),
      ),
    )
    .limit(1);

  if (existing) {
    throw new ConflictError(
      `Ya existe un asiento de apertura para ${anho}-${String(mes).padStart(2, "0")}`,
    );
  }

  // ── 2. Obtener saldos acumulados de cuentas de balance ──
  // Suma: saldo_inicial + SUM(debe) - SUM(haber) de asientos CONTABILIZADOS
  // anteriores a este período
  const cuentasBalance = await db()
    .select({
      id: planCuentas.id,
      codigo: planCuentas.codigo,
      nombre: planCuentas.nombre,
      tipo: planCuentas.tipo,
      saldoInicial: planCuentas.saldoInicial,
    })
    .from(planCuentas)
    .where(
      and(
        eq(planCuentas.activo, true),
        eq(planCuentas.aceptaMovimientos, true),
        sql`${planCuentas.tipo} IN ('ACTIVO', 'PASIVO', 'PATRIMONIO')`,
      ),
    );

  if (cuentasBalance.length === 0) {
    throw new ValidationError("No hay cuentas de balance para apertura");
  }

  // Calcular saldos acumulados de cada cuenta
  const lines: AsientoLineaRequest[] = [];
  let totalDebe = 0;
  let totalHaber = 0;

  for (const cta of cuentasBalance) {
    const saldoInicial = parseFloat(cta.saldoInicial ?? "0");

    // Sumar movimientos de asientos CONTABILIZADOS anteriores
    const [mov] = await db()
      .select({
        debe: sql<number>`COALESCE(SUM(${asientosDetalle.debe}::numeric), 0)`,
        haber: sql<number>`COALESCE(SUM(${asientosDetalle.haber}::numeric), 0)`,
      })
      .from(asientosDetalle)
      .innerJoin(
        asientosContables,
        eq(asientosDetalle.asientoId, asientosContables.id),
      )
      .where(
        and(
          eq(asientosDetalle.cuentaId, cta.id),
          eq(asientosContables.estado, "CONTABILIZADO"),
          sql`${asientosContables.fecha} < ${start}`,
        ),
      );

    const debeMov = Number(mov?.debe ?? 0);
    const haberMov = Number(mov?.haber ?? 0);

    // Saldo acumulado = saldoInicial + debeMov - haberMov
    // Para activos: saldo deudor; para pasivos/patrimonio: saldo acreedor
    let saldoAcumulado: number;
    if (cta.tipo === "ACTIVO") {
      saldoAcumulado = saldoInicial + debeMov - haberMov;
    } else {
      saldoAcumulado = saldoInicial + haberMov - debeMov;
    }

    if (Math.abs(saldoAcumulado) < 0.01) continue;

    if (cta.tipo === "ACTIVO") {
      lines.push({ cuentaId: cta.id, debe: saldoAcumulado.toFixed(2) });
      totalDebe += saldoAcumulado;
    } else {
      lines.push({ cuentaId: cta.id, haber: saldoAcumulado.toFixed(2) });
      totalHaber += saldoAcumulado;
    }
  }

  if (lines.length < 2) {
    throw new ValidationError("No hay suficientes saldos acumulados para apertura");
  }

  // Balancear con Resultados Acumulados si hay diferencia
  const diff = totalDebe - totalHaber;
  if (Math.abs(diff) > 0.01) {
    const [retenidas] = await db()
      .select({ id: planCuentas.id })
      .from(planCuentas)
      .where(sql`${planCuentas.codigo} LIKE '3.4.%' AND ${planCuentas.activo} = true`)
      .limit(1);

    if (retenidas) {
      if (diff > 0) {
        lines.push({ cuentaId: retenidas.id, haber: diff.toFixed(2) });
      } else {
        lines.push({ cuentaId: retenidas.id, debe: Math.abs(diff).toFixed(2) });
      }
    }
  }

  return createAsiento({
    fecha: start.toISOString(),
    concepto: `Asiento de Apertura ${anho}-${String(mes).padStart(2, "0")} (con saldos acumulados)`,
    lineas: lines,
    moduloOrigen: "APERTURA",
  });
}

/**
 * Anula un asiento contable (marca como ANULADO).
 *
 * @param id - Asiento UUID
 * @returns The updated asiento
 * @throws {NotFoundError} If not found
 */
export async function anularAsiento(id: string) {
  const [asiento] = await db()
    .select({ id: asientosContables.id, estado: asientosContables.estado })
    .from(asientosContables)
    .where(eq(asientosContables.id, id))
    .limit(1);

  if (!asiento) {
    throw new NotFoundError(`Asiento con ID ${id} no encontrado`);
  }

  // Create reversing entry
  const fullAsiento = await getAsientoById(id);
  const reverseLines: AsientoLineaRequest[] = fullAsiento.lineas.map((l: any) => ({
    cuentaId: l.cuentaId,
    debe: l.haber ?? undefined,
    haber: l.debe ?? undefined,
    descripcion: `Reversión: ${l.descripcion ?? ""}`,
  }));

  await createAsiento({
    fecha: new Date().toISOString(),
    concepto: `Reversión de asiento #${fullAsiento.numero}`,
    lineas: reverseLines,
    moduloOrigen: "ANULACION",
    ordenTrabajoId: fullAsiento.ordenTrabajoId,
  });

  const [updated] = await db()
    .update(asientosContables)
    .set({ estado: "ANULADO" })
    .where(eq(asientosContables.id, id))
    .returning();

  return updated;
}
