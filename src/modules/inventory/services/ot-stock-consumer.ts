/**
 * OT Stock Consumer — automatic stock deduction on work order completion.
 *
 * When an OT transitions to "Listo", this service:
 *   1. Fetches all orden_repuestos with a repuestoId (inventory-linked parts)
 *   2. Deducts stock via salidaStock() for each part
 *   3. Creates reorder alerts when stock drops below punto_reorden
 *
 * Non-blocking: if a single part fails (e.g. insufficient stock), it logs
 * the error and continues with the remaining parts. The OT status change
 * is never blocked by inventory issues.
 *
 * @module inventory/services/ot-stock-consumer
 */

import { db } from "../../../shared/database/drizzle.js";
import { ordenRepuestos } from "../../workshop/schema/orden-repuestos.js";
import { eq, and } from "drizzle-orm";
import { salidaStock } from "./stock.service.js";

// ─── Types ────────────────────────────────────

export interface StockConsumptionResult {
  /** Total parts attempted */
  attempted: number;
  /** Parts successfully consumed */
  consumed: number;
  /** Parts that failed (insufficient stock, missing repuestoId, etc.) */
  failed: number;
  /** Detailed results per part */
  details: Array<{
    repuestoId: string;
    cantidad: number;
    success: boolean;
    error?: string;
  }>;
}

// ─── Main Function ─────────────────────────────

/**
 * Consumes inventory stock for all parts linked to a work order.
 *
 * Called when an OT transitions to "Listo" (completed). Each part
 * with a valid repuestoId triggers a stock output (salida) that:
 *   - Reduces stock_actual atomically
 *   - Records the movement in stock_movements
 *   - Generates a reorder alert if stock drops below punto_reorden
 *
 * @param ordenId - The work order UUID
 * @param tenantSlug - Tenant identifier for multi-tenant isolation
 * @returns Summary of stock consumption results
 */
export async function consumeStockOnOTClose(
  ordenId: string,
  tenantSlug: string,
): Promise<StockConsumptionResult> {
  // ── 1. Fetch all parts linked to this OT ──
  const parts = await db()
    .select({
      id: ordenRepuestos.id,
      repuestoId: ordenRepuestos.repuestoId,
      cantidad: ordenRepuestos.cantidad,
      repuestoNombre: ordenRepuestos.repuestoNombre,
    })
    .from(ordenRepuestos)
    .where(
      and(
        eq(ordenRepuestos.ordenTrabajoId, ordenId),
        // Only inventory-linked parts (repuestoId is not null)
      ),
    );

  // Filter to parts with a valid repuestoId (skip manual/off-catalog entries)
  const inventoryParts = parts.filter(
    (p): p is typeof p & { repuestoId: string } => p.repuestoId !== null,
  );

  const result: StockConsumptionResult = {
    attempted: inventoryParts.length,
    consumed: 0,
    failed: 0,
    details: [],
  };

  // ── 2. Consume stock for each part ──
  for (const part of inventoryParts) {
    try {
      await salidaStock(
        {
          repuestoId: part.repuestoId,
          cantidad: part.cantidad,
          motivo: "Uso en OT",
          ordenTrabajoId: ordenId,
          observaciones: `Consumo automático al cerrar OT — ${part.repuestoNombre}`,
        },
        tenantSlug,
      );

      result.consumed++;
      result.details.push({
        repuestoId: part.repuestoId,
        cantidad: part.cantidad,
        success: true,
      });
    } catch (err) {
      result.failed++;
      result.details.push({
        repuestoId: part.repuestoId,
        cantidad: part.cantidad,
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      });

      // Log but don't block — continue with remaining parts
      console.warn(
        `[ot-stock-consumer] Error consumiendo repuesto ${part.repuestoId} en OT ${ordenId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return result;
}

/**
 * Previews which parts would be consumed when closing an OT.
 *
 * Useful for the frontend to show a confirmation dialog before
 * finalizing the work order.
 *
 * @param ordenId - The work order UUID
 * @param tenantSlug - Tenant identifier
 * @returns List of parts that would be consumed (no actual deduction)
 */
export async function previewStockConsumption(
  ordenId: string,
  tenantSlug: string,
): Promise<Array<{
  repuestoId: string;
  repuestoNombre: string;
  codigo: string | null;
  cantidad: number;
  stockActual: number;
  puntoReorden: number | null;
  stockAfter: number;
}>> {
  const parts = await db()
    .select({
      id: ordenRepuestos.id,
      repuestoId: ordenRepuestos.repuestoId,
      cantidad: ordenRepuestos.cantidad,
      repuestoNombre: ordenRepuestos.repuestoNombre,
      codigo: ordenRepuestos.codigo,
    })
    .from(ordenRepuestos)
    .where(
      and(
        eq(ordenRepuestos.ordenTrabajoId, ordenId),
        eq(ordenRepuestos.tenantSlug, tenantSlug),
      ),
    );

  const inventoryParts = parts.filter(
    (p): p is typeof p & { repuestoId: string } => p.repuestoId !== null,
  );

  // Fetch current stock for each part
  const { repuestos } = await import("../schema/repuestos.js");

  const preview = [];
  for (const part of inventoryParts) {
    const [repuesto] = await db()
      .select({
        stockActual: repuestos.stockActual,
        puntoReorden: repuestos.puntoReorden,
      })
      .from(repuestos)
      .where(eq(repuestos.id, part.repuestoId))
      .limit(1);

    if (repuesto) {
      preview.push({
        repuestoId: part.repuestoId,
        repuestoNombre: part.repuestoNombre,
        codigo: part.codigo,
        cantidad: part.cantidad,
        stockActual: repuesto.stockActual,
        puntoReorden: repuesto.puntoReorden,
        stockAfter: repuesto.stockActual - part.cantidad,
      });
    }
  }

  return preview;
}
