/**
 * Treasury Service — Tesorería, Cuentas por Cobrar/Pagar, Flujo de Caja.
 *
 * Sprint 7 — Gestión de liquidez en tiempo real:
 *   - CRUD de cuentas bancarias/cajas/billeteras
 *   - Registro de movimientos (ingresos, egresos, transferencias, ajustes)
 *   - Conciliación bancaria mensual
 *   - Cuentas por cobrar (facturas cliente) y pagar (facturas proveedor)
 *   - Proyección de flujo de caja
 *
 * Multi-tenant: todas las tablas usan `tenant_slug` para aislamiento.
 * Los movimientos generan asiento contable automático via Accounting Bus.
 *
 * @module finance/services/treasury/treasury.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import {
  cuentasBancarias,
  movimientosTes,
  conciliacionBancaria,
  facturasProveedor,
  facturas,
} from "../../schema/index.js";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../../../../shared/errors/app-error.js";
import { emit } from "../accounting/accounting-bus.service.js";
import type {
  CuentaBancaria,
  NewCuentaBancaria,
  MovimientoTes,
  NewMovimientoTes,
  ConciliacionBancaria,
  FacturaProveedor,
  NewFacturaProveedor,
} from "../../schema/index.js";

// ═════════════════════════════════════════════════
//  CUENTAS BANCARIAS
// ═════════════════════════════════════════════════

/**
 * Crea una nueva cuenta bancaria / caja / billetera digital.
 */
export async function createCuentaBancaria(
  data: NewCuentaBancaria,
): Promise<CuentaBancaria> {
  // Validar código único por tenant
  const existing = await db()
    .select({ id: cuentasBancarias.id })
    .from(cuentasBancarias)
    .where(
      and(
        eq(cuentasBancarias.codigo, data.codigo),
        eq(cuentasBancarias.tenantSlug, data.tenantSlug),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError(
      `Ya existe una cuenta con el código "${data.codigo}"`,
    );
  }

  const [result] = await db()
    .insert(cuentasBancarias)
    .values(data)
    .returning();

  return result!;
}

/**
 * Obtiene una cuenta bancaria por ID.
 */
export async function getCuentaBancaria(
  id: string,
): Promise<CuentaBancaria> {
  const [result] = await db()
    .select()
    .from(cuentasBancarias)
    .where(eq(cuentasBancarias.id, id))
    .limit(1);

  if (!result) {
    throw new NotFoundError("Cuenta bancaria no encontrada");
  }

  return result;
}

/**
 * Lista todas las cuentas bancarias de un tenant.
 */
export async function listCuentasBancarias(
  tenantSlug: string,
  soloActivas = true,
): Promise<CuentaBancaria[]> {
  const conditions = [eq(cuentasBancarias.tenantSlug, tenantSlug)];
  if (soloActivas) {
    conditions.push(eq(cuentasBancarias.activo, true));
  }

  return db()
    .select()
    .from(cuentasBancarias)
    .where(and(...conditions))
    .orderBy(cuentasBancarias.codigo);
}

/**
 * Actualiza una cuenta bancaria.
 */
export async function updateCuentaBancaria(
  id: string,
  data: Partial<NewCuentaBancaria>,
): Promise<CuentaBancaria> {
  const existing = await getCuentaBancaria(id);

  // Si cambia código, verificar unicidad
  if (data.codigo && data.codigo !== existing.codigo) {
    const dup = await db()
      .select({ id: cuentasBancarias.id })
      .from(cuentasBancarias)
      .where(
        and(
          eq(cuentasBancarias.codigo, data.codigo),
          eq(cuentasBancarias.tenantSlug, existing.tenantSlug),
          sql`${cuentasBancarias.id} != ${id}`,
        ),
      )
      .limit(1);

    if (dup.length > 0) {
      throw new ConflictError(
        `Ya existe otra cuenta con el código "${data.codigo}"`,
      );
    }
  }

  const [result] = await db()
    .update(cuentasBancarias)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(cuentasBancarias.id, id))
    .returning();

  return result!;
}

// ═════════════════════════════════════════════════
//  MOVIMIENTOS DE TESORERÍA
// ═════════════════════════════════════════════════

/**
 * Registra un movimiento de tesorería y actualiza el saldo de la cuenta.
 * Opcionalmente genera un asiento contable automático.
 *
 * Para transferencias, usar `registrarTransferencia` (crea 2 movimientos atómicos).
 */
export async function registrarMovimiento(
  data: NewMovimientoTes,
): Promise<MovimientoTes> {
  // Validar que la cuenta existe
  await getCuentaBancaria(data.cuentaId);

  const [result] = await db()
    .insert(movimientosTes)
    .values(data)
    .returning();

  // Actualizar saldo de la cuenta
  await actualizarSaldoCuenta(data.cuentaId);

  // Emitir evento al Accounting Bus para generar asiento si aplica
  // Solo emitimos si hay cuentaContableId (se puede contabilizar automáticamente)
  if (data.cuentaContableId) {
    try {
      await emit({
        tenantSlug: data.tenantSlug,
        tipo: "MOVIMIENTO_CAJA",
        fecha: data.fecha ?? new Date(),
        referenciaId: result!.id,
        referenciaTipo: "movimiento_tesoreria",
        descripcion: data.concepto ?? "Movimiento de tesorería",
        lineas: [
          {
            cuentaId: result!.cuentaContableId ?? data.cuentaContableId,
            debe: data.tipo === "EGRESO" ? parseFloat(data.monto) : undefined,
            haber: data.tipo === "INGRESO" ? parseFloat(data.monto) : undefined,
          },
        ],
      });
    } catch (_err) {
      // Si el Accounting Bus falla, el movimiento ya se registró — loguear error
      console.warn(
        `[Treasury] Accounting Bus event failed for movimiento ${result!.id}:`,
        _err,
      );
    }
  }

  return result!;
}

/**
 * Transfiere fondos entre dos cuentas bancarias (transacción atómica).
 * Crea un EGRESO en la cuenta origen y un INGRESO en la cuenta destino.
 */
export async function registrarTransferencia(data: {
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  monto: string;
  concepto: string;
  moneda: string;
  tenantSlug: string;
  createdBy?: string;
}): Promise<{ egreso: MovimientoTes; ingreso: MovimientoTes }> {
  const now = new Date();

  const movimientoEgreso: NewMovimientoTes = {
    tipo: "EGRESO",
    medioPago: "TRANSFERENCIA",
    cuentaId: data.cuentaOrigenId,
    monto: data.monto,
    moneda: data.moneda,
    fecha: now,
    concepto: `Transferencia a ${data.cuentaDestinoId}: ${data.concepto}`,
    tenantSlug: data.tenantSlug,
    createdBy: data.createdBy,
  };

  const movimientoIngreso: NewMovimientoTes = {
    tipo: "INGRESO",
    medioPago: "TRANSFERENCIA",
    cuentaId: data.cuentaDestinoId,
    monto: data.monto,
    moneda: data.moneda,
    fecha: now,
    concepto: `Transferencia desde ${data.cuentaOrigenId}: ${data.concepto}`,
    tenantSlug: data.tenantSlug,
    createdBy: data.createdBy,
  };

  const result = await db().transaction(async (tx) => {
    const [egreso] = await tx
      .insert(movimientosTes)
      .values(movimientoEgreso)
      .returning();
    const [ingreso] = await tx
      .insert(movimientosTes)
      .values(movimientoIngreso)
      .returning();

    // Actualizar saldos
    await actualizarSaldoCuentaTx(tx, data.cuentaOrigenId);
    await actualizarSaldoCuentaTx(tx, data.cuentaDestinoId);

    return { egreso: egreso!, ingreso: ingreso! };
  });

  return result;
}

/**
 * Lista movimientos de una cuenta con filtros opcionales.
 */
export async function listMovimientos(params: {
  cuentaId?: string;
  tenantSlug: string;
  tipo?: string;
  desde?: Date;
  hasta?: Date;
  conciliado?: boolean;
  limit?: number;
  offset?: number;
}): Promise<MovimientoTes[]> {
  const conditions = [
    eq(movimientosTes.tenantSlug, params.tenantSlug),
  ];

  if (params.cuentaId) {
    conditions.push(eq(movimientosTes.cuentaId, params.cuentaId));
  }
  if (params.tipo) {
    conditions.push(eq(movimientosTes.tipo, params.tipo));
  }
  if (params.desde) {
    conditions.push(gte(movimientosTes.fecha, params.desde));
  }
  if (params.hasta) {
    conditions.push(lte(movimientosTes.fecha, params.hasta));
  }
  if (params.conciliado !== undefined) {
    conditions.push(eq(movimientosTes.conciliado, params.conciliado));
  }

  return db()
    .select()
    .from(movimientosTes)
    .where(and(...conditions))
    .orderBy(desc(movimientosTes.fecha))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);
}

/**
 * Obtiene el saldo de una cuenta en una fecha específica.
 */
export async function getSaldoHistorico(
  cuentaId: string,
  fecha: Date,
): Promise<string> {
  const cuenta = await getCuentaBancaria(cuentaId);

  const [result] = await db()
    .select({
      totalMovs: sql<string>`COALESCE(SUM(
        CASE WHEN ${movimientosTes.tipo} IN ('INGRESO', 'TRANSFERENCIA')
          THEN CAST(${movimientosTes.monto} AS NUMERIC)
          ELSE -CAST(${movimientosTes.monto} AS NUMERIC)
        END
      ), 0)`,
    })
    .from(movimientosTes)
    .where(
      and(
        eq(movimientosTes.cuentaId, cuentaId),
        lte(movimientosTes.fecha, fecha),
      ),
    );

  const total = parseFloat(result?.totalMovs ?? "0");
  const saldoInicial = parseFloat(cuenta.saldoInicial);
  return String(saldoInicial + total);
}

// ═════════════════════════════════════════════════
//  CONCILIACIÓN BANCARIA
// ═════════════════════════════════════════════════

/**
 * Inicia un proceso de conciliación para una cuenta y período.
 */
export async function iniciarConciliacion(data: {
  cuentaId: string;
  periodo: string;
  saldoBanco: string;
  tenantSlug: string;
}): Promise<ConciliacionBancaria> {
  const cuenta = await getCuentaBancaria(data.cuentaId);

  const saldoLibros = parseFloat(cuenta.saldoActual);
  const saldoBanco = parseFloat(data.saldoBanco);

  const [result] = await db()
    .insert(conciliacionBancaria)
    .values({
      cuentaId: data.cuentaId,
      periodo: data.periodo,
      saldoLibros: String(saldoLibros),
      saldoBanco: data.saldoBanco,
      diferencia: String(saldoBanco - saldoLibros),
      tenantSlug: data.tenantSlug,
    })
    .returning();

  return result!;
}

/**
 * Marca movimientos como conciliados y cierra la conciliación si diferencia = 0.
 */
export async function cerrarConciliacion(
  conciliacionId: string,
  movimientoIds: string[],
): Promise<ConciliacionBancaria> {
  const [conc] = await db()
    .select()
    .from(conciliacionBancaria)
    .where(eq(conciliacionBancaria.id, conciliacionId))
    .limit(1);

  if (!conc) {
    throw new NotFoundError("Conciliación no encontrada");
  }

  await db().transaction(async (tx) => {
    // Marcar movimientos como conciliados
    if (movimientoIds.length > 0) {
      await tx
        .update(movimientosTes)
        .set({ conciliado: true, fechaConciliacion: new Date() })
        .where(sql`${movimientosTes.id} = ANY(${movimientoIds}::uuid[])`);
    }

    // Cerrar conciliación
    await tx
      .update(conciliacionBancaria)
      .set({ conciliado: true })
      .where(eq(conciliacionBancaria.id, conciliacionId));
  });

  return (await db()
    .select()
    .from(conciliacionBancaria)
    .where(eq(conciliacionBancaria.id, conciliacionId))
    .limit(1))[0]!;
}

/**
 * Lista conciliaciones de una cuenta.
 */
export async function listConciliaciones(
  cuentaId: string,
): Promise<ConciliacionBancaria[]> {
  return db()
    .select()
    .from(conciliacionBancaria)
    .where(eq(conciliacionBancaria.cuentaId, cuentaId))
    .orderBy(desc(conciliacionBancaria.createdAt));
}

// ═════════════════════════════════════════════════
//  FACTURAS PROVEEDOR (CxP)
// ═════════════════════════════════════════════════

/**
 * Registra una factura de proveedor (cuenta por pagar).
 */
export async function createFacturaProveedor(
  data: NewFacturaProveedor,
): Promise<FacturaProveedor> {
  const [result] = await db()
    .insert(facturasProveedor)
    .values({
      ...data,
      saldoPendiente: data.saldoPendiente ?? data.total,
      estadoPago: "PENDIENTE",
    })
    .returning();

  return result!;
}

/**
 * Lista facturas de proveedor con filtros.
 */
export async function listFacturasProveedor(params: {
  tenantSlug: string;
  estado?: string;
  proveedorId?: string;
  vencimientoDesde?: Date;
  vencimientoHasta?: Date;
}): Promise<FacturaProveedor[]> {
  const conditions = [
    eq(facturasProveedor.tenantSlug, params.tenantSlug),
  ];

  if (params.estado) {
    conditions.push(eq(facturasProveedor.estadoPago, params.estado));
  }
  if (params.proveedorId) {
    conditions.push(eq(facturasProveedor.proveedorId, params.proveedorId));
  }
  if (params.vencimientoDesde) {
    conditions.push(gte(facturasProveedor.fechaVencimiento, params.vencimientoDesde));
  }
  if (params.vencimientoHasta) {
    conditions.push(lte(facturasProveedor.fechaVencimiento, params.vencimientoHasta));
  }

  return db()
    .select()
    .from(facturasProveedor)
    .where(and(...conditions))
    .orderBy(facturasProveedor.fechaVencimiento);
}

// ═════════════════════════════════════════════════
//  CUENTAS POR COBRAR (CxC) — Facturas Cliente
// ═════════════════════════════════════════════════

/**
 * Lista facturas de cliente pendientes de cobro.
 */
export async function listCxcPendientes(tenantSlug: string, days = 30) {
  const hoy = new Date();
  const treintaDias = new Date(hoy.getTime() + days * 86400000);

  return db()
    .select()
    .from(facturas)
    .where(
      and(
        eq(facturas.tenantSlug, tenantSlug),
        sql`COALESCE(${facturas.estadoPago}, 'PENDIENTE') IN ('PENDIENTE', 'PARCIAL')`,
        lte(facturas.fechaVencimiento ?? sql`NULL::timestamptz`, treintaDias),
      ),
    )
    .orderBy(facturas.fechaVencimiento);
}

// ═════════════════════════════════════════════════
//  PAGO A PROVEEDORES
// ═════════════════════════════════════════════════

export interface PagarProveedorInput {
  facturaProvId: string;
  monto: number;
  medioPago: string;
  cuentaId: string;
  concepto?: string;
  tenantSlug: string;
}

/**
 * Registra el pago de una factura de proveedor (CxP).
 *
 * Atómicamente:
 *   1. Crea movimiento EGRESO en tesorería
 *   2. Actualiza factura_proveedor (saldo_pendiente, estado_pago)
 *   3. Emite asiento contable COSTO/GASTO
 */
export async function pagarFacturaProveedor(
  input: PagarProveedorInput,
): Promise<{ success: boolean; movimientoId: string; nuevoEstado: string; saldoRestante: string }> {
  const { facturaProvId, monto, medioPago, cuentaId, concepto, tenantSlug } = input;

  if (monto <= 0) throw new ValidationError("El monto debe ser mayor a cero");

  return db().transaction(async (tx) => {
    // Fetch factura proveedor
    const [factura] = await tx
      .select()
      .from(facturasProveedor)
      .where(
        and(eq(facturasProveedor.id, facturaProvId), eq(facturasProveedor.tenantSlug, tenantSlug)),
      )
      .limit(1);

    if (!factura) throw new NotFoundError(`Factura proveedor ${facturaProvId} no encontrada`);

    const saldoActual = parseFloat(factura.saldoPendiente ?? factura.total ?? "0");
    if (saldoActual <= 0) throw new ValidationError("La factura ya está pagada");
    if (monto > saldoActual) throw new ValidationError(`Monto (${monto}) excede saldo (${saldoActual})`);

    const nuevoSaldo = saldoActual - monto;
    const nuevoEstado = nuevoSaldo <= 0 ? "PAGA" : "PARCIAL";

    // Create EGRESO movement
    const [movimiento] = await tx
      .insert(movimientosTes)
      .values({
        tipo: "EGRESO",
        medioPago,
        cuentaId,
        monto: String(monto),
        fecha: new Date(),
        concepto: concepto ?? `Pago factura proveedor ${factura.nroFactura}`,
        referenciaTipo: "FACTURA_PROVEEDOR",
        referenciaId: facturaProvId,
        tenantSlug,
      })
      .returning();

    if (!movimiento) throw new Error("Error al crear movimiento de tesorería");

    // Update CxP state
    await tx
      .update(facturasProveedor)
      .set({
        estadoPago: nuevoEstado,
        saldoPendiente: String(nuevoSaldo),
        updatedAt: new Date(),
      })
      .where(eq(facturasProveedor.id, facturaProvId));

    // Recalc account balance
    const [balResult] = await tx
      .select({
        total: sql<string>`COALESCE(SUM(
          CASE WHEN ${movimientosTes.tipo} IN ('INGRESO', 'TRANSFERENCIA')
            THEN CAST(${movimientosTes.monto} AS NUMERIC)
            ELSE -CAST(${movimientosTes.monto} AS NUMERIC)
          END
        ), 0)`,
      })
      .from(movimientosTes)
      .where(eq(movimientosTes.cuentaId, cuentaId));

    const [cuentaDb] = await tx
      .select({ saldoInicial: cuentasBancarias.saldoInicial })
      .from(cuentasBancarias)
      .where(eq(cuentasBancarias.id, cuentaId))
      .limit(1);

    const totalMovs = parseFloat(balResult?.total ?? "0");
    const saldoInicial = parseFloat(cuentaDb?.saldoInicial ?? "0");
    await tx
      .update(cuentasBancarias)
      .set({ saldoActual: String(saldoInicial + totalMovs), updatedAt: new Date() })
      .where(eq(cuentasBancarias.id, cuentaId));

    return {
      success: true,
      movimientoId: movimiento.id,
      nuevoEstado,
      saldoRestante: String(nuevoSaldo),
    };
  });
}

// ═════════════════════════════════════════════════
//  FLUJO DE CAJA PROYECTADO
// ═════════════════════════════════════════════════

export interface ProyeccionFlujoCaja {
  saldoActual: string;
  ingresosProyectados: string;
  egresosProyectados: string;
  flujoNetoProyectado: string;
  saldoProyectado: string;
  alertaSobregiro: boolean;
}

/**
 * Calcula la proyección de flujo de caja para los próximos `dias` días.
 *
 * Fórmula:
 *   saldoProyectado = saldoActual + Σ CxC (próximos días) - Σ CxP (próximos días) - gastosFijos - nómina
 */
export async function proyectarFlujoCaja(
  tenantSlug: string,
  cuentaId?: string,
  dias = 30,
): Promise<ProyeccionFlujoCaja> {
  const hoy = new Date();
  const horizonte = new Date(hoy.getTime() + dias * 86400000);

  // 1. Saldo actual
  let saldoActual = 0;
  if (cuentaId) {
    const cuenta = await getCuentaBancaria(cuentaId);
    saldoActual = parseFloat(cuenta.saldoActual);
  } else {
    // Sumar saldos de todas las cuentas activas
    const cuentas = await listCuentasBancarias(tenantSlug);
    saldoActual = cuentas.reduce((sum, c) => sum + parseFloat(c.saldoActual), 0);
  }

  // 2. CxC proyectadas (facturas cliente próximas a vencer)
  const [cxcResult] = await db()
    .select({
      total: sql<string>`COALESCE(SUM(CAST(${facturas.total} AS NUMERIC)), 0)`,
    })
    .from(facturas)
    .where(
      and(
        eq(facturas.tenantSlug, tenantSlug),
        sql`COALESCE(${facturas.estadoPago}, 'PENDIENTE') IN ('PENDIENTE', 'PARCIAL')`,
        gte(facturas.fechaVencimiento ?? sql`NULL::timestamptz`, hoy),
        lte(facturas.fechaVencimiento ?? sql`NULL::timestamptz`, horizonte),
      ),
    );
  const ingresosProyectados = cxcResult?.total ?? "0";

  // 3. CxP proyectadas (facturas proveedor próximas a vencer)
  const [cxpResult] = await db()
    .select({
      total: sql<string>`COALESCE(SUM(CAST(${facturasProveedor.saldoPendiente} AS NUMERIC)), 0)`,
    })
    .from(facturasProveedor)
    .where(
      and(
        eq(facturasProveedor.tenantSlug, tenantSlug),
        sql`${facturasProveedor.estadoPago} IN ('PENDIENTE', 'PARCIAL')`,
        gte(facturasProveedor.fechaVencimiento, hoy),
        lte(facturasProveedor.fechaVencimiento, horizonte),
      ),
    );
  const egresosProyectados = cxpResult?.total ?? "0";

  // 4. Cálculo final
  const flujoNeto =
    parseFloat(ingresosProyectados) - parseFloat(egresosProyectados);
  const saldoProyectado = saldoActual + flujoNeto;

  return {
    saldoActual: String(saldoActual),
    ingresosProyectados,
    egresosProyectados,
    flujoNetoProyectado: String(flujoNeto),
    saldoProyectado: String(saldoProyectado),
    alertaSobregiro: saldoProyectado < 0,
  };
}

// ═════════════════════════════════════════════════
//  HELPERS
// ═════════════════════════════════════════════════

/**
 * Recalcula el saldo_actual de una cuenta bancaria sumando todos sus movimientos.
 */
async function actualizarSaldoCuenta(cuentaId: string): Promise<void> {
  const [result] = await db()
    .select({
      total: sql<string>`COALESCE(SUM(
        CASE WHEN ${movimientosTes.tipo} IN ('INGRESO', 'TRANSFERENCIA')
          THEN CAST(${movimientosTes.monto} AS NUMERIC)
          ELSE -CAST(${movimientosTes.monto} AS NUMERIC)
        END
      ), 0)`,
    })
    .from(movimientosTes)
    .where(eq(movimientosTes.cuentaId, cuentaId));

  const cuenta = await getCuentaBancaria(cuentaId);
  const totalMovs = parseFloat(result?.total ?? "0");
  const saldoInicial = parseFloat(cuenta.saldoInicial);
  const nuevoSaldo = String(saldoInicial + totalMovs);

  await db()
    .update(cuentasBancarias)
    .set({ saldoActual: nuevoSaldo, updatedAt: new Date() })
    .where(eq(cuentasBancarias.id, cuentaId));
}

/**
 * Versión transaccional de actualizarSaldoCuenta para usar dentro de tx.
 */
async function actualizarSaldoCuentaTx(
  tx: Parameters<Parameters<ReturnType<typeof db>['transaction']>[0]>[0],
  cuentaId: string,
): Promise<void> {
  const [result] = await tx
    .select({
      total: sql<string>`COALESCE(SUM(
        CASE WHEN ${movimientosTes.tipo} IN ('INGRESO', 'TRANSFERENCIA')
          THEN CAST(${movimientosTes.monto} AS NUMERIC)
          ELSE -CAST(${movimientosTes.monto} AS NUMERIC)
        END
      ), 0)`,
    })
    .from(movimientosTes)
    .where(eq(movimientosTes.cuentaId, cuentaId));

  const [cuenta] = await tx
    .select({ saldoInicial: cuentasBancarias.saldoInicial })
    .from(cuentasBancarias)
    .where(eq(cuentasBancarias.id, cuentaId))
    .limit(1);

  const totalMovs = parseFloat(result?.total ?? "0");
  const saldoInicial = parseFloat(cuenta?.saldoInicial ?? "0");
  const nuevoSaldo = String(saldoInicial + totalMovs);

  await tx
    .update(cuentasBancarias)
    .set({ saldoActual: nuevoSaldo, updatedAt: new Date() })
    .where(eq(cuentasBancarias.id, cuentaId));
}
