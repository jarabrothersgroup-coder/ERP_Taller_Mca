/**
 * Costing Service — PPP (Precio Promedio Ponderado) calculation engine.
 *
 * Implements weighted-average cost calculation for inventory valuation.
 * Every stock input with a purchase cost triggers a PPP recalculation
 * and records the event in cost_history for full auditability.
 *
 * PPP formula:
 *   PPP_new = (stockActual × ppActual + cantidad × costoSegunCompra)
 *           / (stockActual + cantidad)
 *
 * @module inventory/services/costing.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { repuestos, costHistory } from "../schema/index.js";
import { eq, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";

/**
 * Recalculates the PPP (weighted average cost) after a stock input.
 *
 * @param repuestoId - UUID of the repuesto
 * @param cantidadEntrante - Quantity added to stock
 * @param costoSegunCompra - Unit cost of the incoming lot (purchase price)
 * @param tenantSlug - Tenant identifier
 * @param movimientoId - The stock_movements row that triggered this
 * @returns The new PPP value
 * @throws {NotFoundError} If repuesto not found
 * @throws {ValidationError} If cantidad is <= 0
 */
export async function recalcularPPP(
  repuestoId: string,
  cantidadEntrante: number,
  costoSegunCompra: number | null | undefined,
  tenantSlug: string,
  movimientoId?: string,
): Promise<number> {
  // ── Validate ──
  if (!cantidadEntrante || cantidadEntrante <= 0) {
    throw new ValidationError("La cantidad entrante debe ser mayor a cero");
  }

  // ── Fetch current repuesto ──
  const [repuesto] = await db()
    .select({
      stockActual: repuestos.stockActual,
      costoPromedio: repuestos.costoPromedio,
    })
    .from(repuestos)
    .where(eq(repuestos.id, repuestoId))
    .limit(1);

  if (!repuesto) {
    throw new NotFoundError(`Repuesto ${repuestoId} no encontrado`);
  }

  const stockActual = repuesto.stockActual;
  const ppActual = repuesto.costoPromedio
    ? Number(repuesto.costoPromedio)
    : 0;

  // ── Calculate new PPP ──
  // If there's no purchase cost, don't change the PPP (e.g. return from customer)
  if (!costoSegunCompra || costoSegunCompra <= 0) {
    // Still increase stock, but PPP stays the same
    const ppNuevo = ppActual;

    await db()
      .update(repuestos)
      .set({
        stockActual: sql`${repuestos.stockActual} + ${cantidadEntrante}`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(repuestos.id, repuestoId));

    return ppNuevo;
  }

  // ── PPP formula ──
  const stockFinal = stockActual + cantidadEntrante;
  const numerador = stockActual * ppActual + cantidadEntrante * costoSegunCompra;
  const denominador = stockFinal;
  const ppNuevo = denominador > 0
    ? Math.round((numerador / denominador) * 100) / 100  // Round to 2 decimals
    : costoSegunCompra;

  // ── Update repuesto with new PPP and increased stock ──
  await db()
    .update(repuestos)
    .set({
      stockActual: sql`${repuestos.stockActual} + ${cantidadEntrante}`,
      costoPromedio: String(ppNuevo),
      updatedAt: sql`NOW()`,
    })
    .where(eq(repuestos.id, repuestoId));

  // ── Record cost history entry ──
  await db().insert(costHistory).values({
    repuestoId,
    fecha: new Date(),
    tipo: costoSegunCompra ? "COMPRA" : "AJUSTE",
    cantidadAnterior: stockActual,
    cantidadNueva: cantidadEntrante,
    cantidadFinal: stockFinal,
    ppAnterior: String(ppActual),
    costoUnitarioNuevo: String(costoSegunCompra),
    ppFinal: String(ppNuevo),
    movimientoId: movimientoId ?? null,
    tenantSlug,
  });

  return ppNuevo;
}

/**
 * Gets the current PPP for a repuesto.
 * Returns 0 if no cost has been recorded yet.
 *
 * @param repuestoId - UUID of the repuesto
 * @returns The current PPP value
 */
export async function obtenerPPP(repuestoId: string): Promise<number> {
  const [repuesto] = await db()
    .select({ costoPromedio: repuestos.costoPromedio })
    .from(repuestos)
    .where(eq(repuestos.id, repuestoId))
    .limit(1);

  if (!repuesto) {
    throw new NotFoundError(`Repuesto ${repuestoId} no encontrado`);
  }

  return repuesto.costoPromedio ? Number(repuesto.costoPromedio) : 0;
}

/**
 * Gets the complete PPP history for a repuesto.
 *
 * @param repuestoId - UUID of the repuesto
 * @returns Array of cost history entries
 */
export async function obtenerHistorialPPP(repuestoId: string) {
  const history = await db()
    .select()
    .from(costHistory)
    .where(eq(costHistory.repuestoId, repuestoId))
    .orderBy(costHistory.createdAt);

  return history;
}
