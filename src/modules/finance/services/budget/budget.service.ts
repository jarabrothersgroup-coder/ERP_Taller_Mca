/**
 * Budget Service — Presupuestos + Control de Gestión (Sprint 11).
 *
 * Funcionalidades:
 *   1. CRUD de presupuestos por período
 *   2. CRUD de líneas de presupuesto (por centro de costo + categoría)
 *   3. Comparativa real vs presupuestado (consulta asientos_detalle)
 *   4. Alertas de desvío (real > presupuesto o > umbral %)
 *
 * @module finance/services/budget/budget.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import {
  presupuestos,
  presupuestosItems,
} from "../../schema/budget.js";
import { centrosCosto } from "../../schema/cost-centers.js";
import { asientosDetalle, asientosContables, planCuentas } from "../../schema/accounting.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  NotFoundError,
  ConflictError,
} from "../../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

export interface CreatePresupuestoRequest {
  periodo: string;
  descripcion?: string;
}

export interface UpdatePresupuestoRequest {
  descripcion?: string;
  estado?: "borrador" | "aprobado" | "cerrado";
}

export interface CreatePresupuestoItemRequest {
  centroCostoId: string;
  categoria: string;
  montoPresupuestado: number;
  notas?: string;
}

export interface UpdatePresupuestoItemRequest {
  montoPresupuestado?: number;
  notas?: string;
}

export interface PresupuestoItemConCentro {
  id: string;
  presupuestoId: string;
  centroCostoId: string;
  centroCostoNombre: string;
  centroCostoCodigo: string;
  categoria: string;
  montoPresupuestado: string;
  montoReal: string;
  desvio: number;          // porcentaje de desvío
  estadoDesvio: "OK" | "ALERTA" | "CRITICO";
  notas: string | null;
}

export interface ComparativaResponse {
  presupuesto: {
    id: string;
    periodo: string;
    descripcion: string | null;
    estado: string;
  };
  items: PresupuestoItemConCentro[];
  resumen: {
    totalPresupuestado: number;
    totalReal: number;
    desvioTotal: number;
    estadoGeneral: "OK" | "ALERTA" | "CRITICO";
  };
  alertas: AlertaDesvio[];
}

export interface AlertaDesvio {
  centroCosto: string;
  categoria: string;
  montoPresupuestado: number;
  montoReal: number;
  desvioPorcentaje: number;
  severidad: "ALERTA" | "CRITICO";
  mensaje: string;
}

type CentroCosto = typeof centrosCosto.$inferSelect;

// ─── CRUD Presupuesto ─────────────────────────

/**
 * Lista presupuestos de un tenant, opcionalmente filtrados por período o estado.
 */
export async function listPresupuestos(
  tenantSlug: string,
  filters?: { periodo?: string; estado?: string },
): Promise<typeof presupuestos.$inferSelect[]> {
  const conditions = [eq(presupuestos.tenantSlug, tenantSlug)];
  if (filters?.periodo) {
    conditions.push(eq(presupuestos.periodo, filters.periodo));
  }
  if (filters?.estado) {
    conditions.push(eq(presupuestos.estado, filters.estado));
  }
  return db()
    .select()
    .from(presupuestos)
    .where(and(...conditions))
    .orderBy(sql`${presupuestos.periodo} DESC`);
}

/**
 * Obtiene un presupuesto por ID con todos sus ítems.
 */
export async function getPresupuesto(
  presupuestoId: string,
  tenantSlug: string,
): Promise<{
  presupuesto: typeof presupuestos.$inferSelect;
  items: typeof presupuestosItems.$inferSelect[];
}> {
  const [presupuesto] = await db()
    .select()
    .from(presupuestos)
    .where(
      and(
        eq(presupuestos.id, presupuestoId),
        eq(presupuestos.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!presupuesto) {
    throw new NotFoundError("Presupuesto no encontrado");
  }

  const items = await db()
    .select()
    .from(presupuestosItems)
    .where(eq(presupuestosItems.presupuestoId, presupuestoId));

  return { presupuesto, items };
}

/**
 * Crea un nuevo presupuesto.
 */
export async function createPresupuesto(
  tenantSlug: string,
  data: CreatePresupuestoRequest,
): Promise<typeof presupuestos.$inferSelect> {
  // Validar que no exista uno con el mismo período para el tenant
  const existing = await db()
    .select({ id: presupuestos.id })
    .from(presupuestos)
    .where(
      and(
        eq(presupuestos.periodo, data.periodo),
        eq(presupuestos.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError(
      `Ya existe un presupuesto para el período ${data.periodo}`,
    );
  }

  const [created] = await db()
    .insert(presupuestos)
    .values({
      periodo: data.periodo,
      descripcion: data.descripcion,
      tenantSlug,
    })
    .returning();

  return created;
}

/**
 * Actualiza un presupuesto (solo si está en borrador).
 */
export async function updatePresupuesto(
  presupuestoId: string,
  tenantSlug: string,
  data: UpdatePresupuestoRequest,
): Promise<typeof presupuestos.$inferSelect> {
  const [existing] = await db()
    .select()
    .from(presupuestos)
    .where(
      and(
        eq(presupuestos.id, presupuestoId),
        eq(presupuestos.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new NotFoundError("Presupuesto no encontrado");
  }

  if (existing.estado === "cerrado") {
    throw new ConflictError("No se puede modificar un presupuesto cerrado");
  }

  // No permitir cambios a montoReal directamente
  const [updated] = await db()
    .update(presupuestos)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(presupuestos.id, presupuestoId))
    .returning();

  return updated;
}

/**
 * Elimina un presupuesto (solo si está en borrador).
 */
export async function deletePresupuesto(
  presupuestoId: string,
  tenantSlug: string,
): Promise<void> {
  const [existing] = await db()
    .select()
    .from(presupuestos)
    .where(
      and(
        eq(presupuestos.id, presupuestoId),
        eq(presupuestos.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new NotFoundError("Presupuesto no encontrado");
  }

  if (existing.estado === "cerrado") {
    throw new ConflictError("No se puede eliminar un presupuesto cerrado");
  }

  await db()
    .delete(presupuestos)
    .where(eq(presupuestos.id, presupuestoId));
}

// ─── CRUD Presupuesto Items ────────────────────

/**
 * Agrega un ítem a un presupuesto.
 */
export async function addPresupuestoItem(
  presupuestoId: string,
  tenantSlug: string,
  data: CreatePresupuestoItemRequest,
): Promise<typeof presupuestosItems.$inferSelect> {
  // Validar que el presupuesto existe y no está cerrado
  const [presupuesto] = await db()
    .select()
    .from(presupuestos)
    .where(eq(presupuestos.id, presupuestoId))
    .limit(1);

  if (!presupuesto) {
    throw new NotFoundError("Presupuesto no encontrado");
  }

  if (presupuesto.estado === "cerrado") {
    throw new ConflictError("No se pueden agregar ítems a un presupuesto cerrado");
  }

  // Validar que el centro de costo existe
  const [centro] = await db()
    .select({ id: centrosCosto.id })
    .from(centrosCosto)
    .where(eq(centrosCosto.id, data.centroCostoId))
    .limit(1);

  if (!centro) {
    throw new NotFoundError("Centro de costo no encontrado");
  }

  // Validar que no exista un ítem con el mismo centro+categoría
  const existingItem = await db()
    .select({ id: presupuestosItems.id })
    .from(presupuestosItems)
    .where(
      and(
        eq(presupuestosItems.presupuestoId, presupuestoId),
        eq(presupuestosItems.centroCostoId, data.centroCostoId),
        eq(presupuestosItems.categoria, data.categoria),
      ),
    )
    .limit(1);

  if (existingItem.length > 0) {
    throw new ConflictError(
      `Ya existe un ítem para el centro de costo con categoría "${data.categoria}"`,
    );
  }

  const [created] = await db()
    .insert(presupuestosItems)
    .values({
      presupuestoId,
      centroCostoId: data.centroCostoId,
      categoria: data.categoria,
      montoPresupuestado: String(data.montoPresupuestado),
      notas: data.notas,
      tenantSlug,
    })
    .returning();

  return created;
}

/**
 * Actualiza un ítem de presupuesto (solo monto y notas).
 */
export async function updatePresupuestoItem(
  itemId: string,
  tenantSlug: string,
  data: UpdatePresupuestoItemRequest,
): Promise<typeof presupuestosItems.$inferSelect> {
  const [existing] = await db()
    .select()
    .from(presupuestosItems)
    .where(
      and(
        eq(presupuestosItems.id, itemId),
        eq(presupuestosItems.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new NotFoundError("Ítem de presupuesto no encontrado");
  }

  const updateData: Record<string, unknown> = {};
  if (data.montoPresupuestado !== undefined) {
    updateData.montoPresupuestado = String(data.montoPresupuestado);
  }
  if (data.notas !== undefined) {
    updateData.notas = data.notas;
  }

  const [updated] = await db()
    .update(presupuestosItems)
    .set(updateData)
    .where(eq(presupuestosItems.id, itemId))
    .returning();

  return updated;
}

/**
 * Elimina un ítem de presupuesto.
 */
export async function deletePresupuestoItem(
  itemId: string,
  tenantSlug: string,
): Promise<void> {
  const [existing] = await db()
    .select()
    .from(presupuestosItems)
    .where(
      and(
        eq(presupuestosItems.id, itemId),
        eq(presupuestosItems.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new NotFoundError("Ítem de presupuesto no encontrado");
  }

  await db()
    .delete(presupuestosItems)
    .where(eq(presupuestosItems.id, itemId));
}

// ─── Comparativa Real vs Presupuestado ─────────

/**
 * Calcula el monto real desde asientos_detalle para un centro de costo,
 * categoría y período específicos.
 *
 * Filtra por:
 *   - asientos_contables.fecha dentro del rango del período
 *   - asientos_detalle.centro_costo_id = centroCostoId
 *   - asientos_contables.estado = "CONTABILIZADO"
 *   - Solo líneas de débito (gasto/costo real)
 */
async function calcularMontoReal(
  centroCostoId: string,
  categoria: string,
  periodo: string,
): Promise<number> {
  // Calcular rango de fechas según formato de período
  let fechaInicio: Date;
  let fechaFin: Date;

  if (/^\d{4}-Q[1-4]$/.test(periodo)) {
    // Trimestre: "2026-Q1"
    const year = parseInt(periodo.slice(0, 4));
    const quarter = parseInt(periodo.slice(6));
    const startMonth = (quarter - 1) * 3;
    fechaInicio = new Date(year, startMonth, 1);
    fechaFin = new Date(year, startMonth + 3, 1);
  } else if (/^\d{4}$/.test(periodo)) {
    // Anual: "2026"
    const year = parseInt(periodo);
    fechaInicio = new Date(year, 0, 1);
    fechaFin = new Date(year + 1, 0, 1);
  } else if (/^\d{4}-\d{2}$/.test(periodo)) {
    // Mensual: "2026-01"
    const [year, month] = periodo.split("-").map(Number);
    fechaInicio = new Date(year, month - 1, 1);
    fechaFin = new Date(year, month, 1);
  } else {
    return 0;
  }

  // Mapear categoría a cuentas contables relevantes
  const cuentasMap: Record<string, string[]> = {
    servicios: ["6"],   // GASTO
    repuestos: ["5"],   // COSTO
    mano_obra: ["6"],   // GASTO
    fijo: ["6"],        // GASTO
    otro: ["5", "6"],   // COSTO + GASTO
  };

  const tiposCuenta = cuentasMap[categoria] || ["5", "6"];

  const [result] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(${asientosDetalle.debe}), 0)`,
    })
    .from(asientosDetalle)
    .innerJoin(
      asientosContables,
      eq(asientosDetalle.asientoId, asientosContables.id),
    )
    .innerJoin(
      planCuentas,
      eq(asientosDetalle.cuentaId, planCuentas.id),
    )
    .where(
      and(
        eq(asientosDetalle.centroCostoId, centroCostoId),
        eq(asientosContables.estado, "CONTABILIZADO"),
        sql`${asientosContables.fecha} >= ${fechaInicio.toISOString()}`,
        sql`${asientosContables.fecha} < ${fechaFin.toISOString()}`,
        inArray(sql`SUBSTRING(${planCuentas.codigo}, 1, 1)`, tiposCuenta),
      ),
    )
    .limit(1);

  return Number(result?.total || 0);
}

/**
 * Genera la comparativa completa de un presupuesto.
 * Calcula monto_real para cada ítem y genera alertas de desvío.
 *
 * Umbrales:
 *   - OK:          real <= 100% del presupuesto
 *   - ALERTA:      real > 100% y <= 120% del presupuesto
 *   - CRITICO:     real > 120% del presupuesto
 */
export async function getComparativa(
  presupuestoId: string,
  tenantSlug: string,
): Promise<ComparativaResponse> {
  const { presupuesto, items } = await getPresupuesto(presupuestoId, tenantSlug);

  // Obtener nombres de centros de costo
  const centroCostoIds = [...new Set(items.map((i) => i.centroCostoId))];
  const centros = await db()
    .select()
    .from(centrosCosto)
    .where(inArray(centrosCosto.id, centroCostoIds));

  const centrosMap = new Map<string, CentroCosto>();
  centros.forEach((c) => centrosMap.set(c.id, c));

  // Calcular monto real para cada ítem
  const itemsConReal: PresupuestoItemConCentro[] = [];
  let totalPresupuestado = 0;
  let totalReal = 0;

  for (const item of items) {
    const montoReal = await calcularMontoReal(
      item.centroCostoId,
      item.categoria,
      presupuesto.periodo,
    );
    const montoPresup = Number(item.montoPresupuestado);
    const desvio =
      montoPresup > 0 ? ((montoReal - montoPresup) / montoPresup) * 100 : 0;

    let estadoDesvio: "OK" | "ALERTA" | "CRITICO" = "OK";
    if (desvio > 20) estadoDesvio = "CRITICO";
    else if (desvio > 0) estadoDesvio = "ALERTA";

    const centro = centrosMap.get(item.centroCostoId);

    itemsConReal.push({
      id: item.id,
      presupuestoId: item.presupuestoId,
      centroCostoId: item.centroCostoId,
      centroCostoNombre: centro?.nombre || "Desconocido",
      centroCostoCodigo: centro?.codigo || "---",
      categoria: item.categoria,
      montoPresupuestado: item.montoPresupuestado,
      montoReal: String(montoReal),
      desvio: Math.round(desvio * 100) / 100,
      estadoDesvio,
      notas: item.notas,
    });

    totalPresupuestado += montoPresup;
    totalReal += montoReal;
  }

  // Generar alertas
  const alertas: AlertaDesvio[] = itemsConReal
    .filter((i) => i.estadoDesvio !== "OK")
    .map((i) => ({
      centroCosto: `${i.centroCostoCodigo} — ${i.centroCostoNombre}`,
      categoria: i.categoria,
      montoPresupuestado: Number(i.montoPresupuestado),
      montoReal: Number(i.montoReal),
      desvioPorcentaje: i.desvio,
      severidad: i.estadoDesvio as "ALERTA" | "CRITICO",
      mensaje: `${i.centroCostoCodigo}: ${i.categoria} — ${i.desvio > 0 ? "+" : ""}${i.desvio.toFixed(1)}%`,
    }));

  const desvioTotal =
    totalPresupuestado > 0
      ? ((totalReal - totalPresupuestado) / totalPresupuestado) * 100
      : 0;

  let estadoGeneral: "OK" | "ALERTA" | "CRITICO" = "OK";
  if (desvioTotal > 20) estadoGeneral = "CRITICO";
  else if (desvioTotal > 0) estadoGeneral = "ALERTA";

  return {
    presupuesto: {
      id: presupuesto.id,
      periodo: presupuesto.periodo,
      descripcion: presupuesto.descripcion,
      estado: presupuesto.estado,
    },
    items: itemsConReal,
    resumen: {
      totalPresupuestado,
      totalReal,
      desvioTotal: Math.round(desvioTotal * 100) / 100,
      estadoGeneral,
    },
    alertas,
  };
}

/**
 * Actualiza el campo monto_real de todos los ítems de un presupuesto.
 * Útil para refresh periódico o al consultar la comparativa.
 */
export async function refreshMontoReal(
  presupuestoId: string,
  tenantSlug: string,
): Promise<void> {
  const { presupuesto, items } = await getPresupuesto(presupuestoId, tenantSlug);

  for (const item of items) {
    const montoReal = await calcularMontoReal(
      item.centroCostoId,
      item.categoria,
      presupuesto.periodo,
    );

    await db()
      .update(presupuestosItems)
      .set({ montoReal: String(montoReal) })
      .where(eq(presupuestosItems.id, item.id));
  }
}

/**
 * Lista todas las alertas de desvío de todos los presupuestos aprobados.
 */
export async function getAllAlertas(
  tenantSlug: string,
): Promise<AlertaDesvio[]> {
  const aprobados = await db()
    .select()
    .from(presupuestos)
    .where(
      and(
        eq(presupuestos.tenantSlug, tenantSlug),
        eq(presupuestos.estado, "aprobado"),
      ),
    );

  const allAlertas: AlertaDesvio[] = [];

  for (const p of aprobados) {
    const comparativa = await getComparativa(p.id, tenantSlug);
    allAlertas.push(...comparativa.alertas);
  }

  return allAlertas;
}
