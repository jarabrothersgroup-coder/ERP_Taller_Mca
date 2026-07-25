/**
 * Cycle Count Service — physical inventory counting business logic.
 *
 * Manages cycle count sessions: create, start counting, complete,
 * review differences, and apply automatic stock adjustments with
 * journal entries for material differences.
 *
 * @module inventory/services/cycle-count.service
 */

import { db } from "../../../shared/database/drizzle.js";
import {
  cycleCounts,
  cycleCountItems,
} from "../schema/index.js";
import { repuestos } from "../schema/index.js";
import { almacenes } from "../schema/index.js";
import { stockMovements } from "../schema/index.js";
import { eq, and, asc, desc, isNull, count } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";
import { recalcularPPP } from "./costing.service.js";

// ─── Cycle Count CRUD ─────────────────────────

/**
 * List cycle counts for a tenant, newest first.
 */
export async function listCycleCounts(tenantSlug: string) {
  return db()
    .select()
    .from(cycleCounts)
    .where(eq(cycleCounts.tenantSlug, tenantSlug))
    .orderBy(desc(cycleCounts.createdAt));
}

/**
 * Get a single cycle count by ID.
 */
export async function getCycleCountById(id: string, tenantSlug: string) {
  const [row] = await db()
    .select()
    .from(cycleCounts)
    .where(and(eq(cycleCounts.id, id), eq(cycleCounts.tenantSlug, tenantSlug)))
    .limit(1);
  if (!row) throw new NotFoundError(`Conteo cíclico ${id} no encontrado`);
  return row;
}

/**
 * Create a new cycle count session.
 */
export async function createCycleCount(
  data: { almacenId: string; observaciones?: string },
  tenantSlug: string,
) {
  const [almacen] = await db()
    .select({ id: almacenes.id })
    .from(almacenes)
    .where(eq(almacenes.id, data.almacenId))
    .limit(1);
  if (!almacen) throw new NotFoundError("Almacén no encontrado");

  const [row] = await db()
    .insert(cycleCounts)
    .values({
      almacenId: data.almacenId,
      observaciones: data.observaciones ?? null,
      tenantSlug,
    })
    .returning();
  return row;
}

/**
 * Start a cycle count (change status to EN_PROGRESO).
 * Optionally populate items from all repuestos in the warehouse.
 */
export async function startCycleCount(
  id: string,
  tenantSlug: string,
  options?: { autoPopulate?: boolean },
) {
  const count = await getCycleCountById(id, tenantSlug);
  if (count.estado !== "ABIERTO") {
    throw new ValidationError("Solo se puede iniciar un conteo en estado ABIERTO");
  }

  // Change status to EN_PROGRESO
  const [updated] = await db()
    .update(cycleCounts)
    .set({ estado: "EN_PROGRESO", updatedAt: new Date() })
    .where(eq(cycleCounts.id, id))
    .returning();

  // Auto-populate items with current stock levels
  if (options?.autoPopulate) {
    const existingItems = await db()
      .select({ id: cycleCountItems.id })
      .from(cycleCountItems)
      .where(eq(cycleCountItems.cycleCountId, id))
      .limit(1);

    if (existingItems.length === 0) {
      const allRepuestos = await db()
        .select({ id: repuestos.id, stockActual: repuestos.stockActual })
        .from(repuestos)
        .where(eq(repuestos.activo, true));

      if (allRepuestos.length > 0) {
        await db().insert(cycleCountItems).values(
          allRepuestos.map((r) => ({
            cycleCountId: id,
            repuestoId: r.id,
            stockSistema: r.stockActual,
            stockReal: r.stockActual, // Presume same initially
            diferencia: 0,
            tenantSlug,
          })),
        );
      }
    }
  }

  return updated;
}

/**
 * Record a counted item's real stock.
 */
export async function recordCountItem(
  cycleCountId: string,
  itemId: string,
  stockReal: number,
  tenantSlug: string,
  observaciones?: string,
) {
  if (stockReal < 0) throw new ValidationError("El stock real no puede ser negativo");

  const count = await getCycleCountById(cycleCountId, tenantSlug);
  if (count.estado !== "EN_PROGRESO") {
    throw new ValidationError("El conteo debe estar EN_PROGRESO para registrar items");
  }

  // Get the item with system stock
  const [item] = await db()
    .select({
      id: cycleCountItems.id,
      stockSistema: cycleCountItems.stockSistema,
    })
    .from(cycleCountItems)
    .where(
      and(
        eq(cycleCountItems.id, itemId),
        eq(cycleCountItems.cycleCountId, cycleCountId),
      ),
    )
    .limit(1);

  if (!item) throw new NotFoundError("Item de conteo no encontrado");

  const diferencia = stockReal - item.stockSistema;

  const [updated] = await db()
    .update(cycleCountItems)
    .set({
      stockReal,
      diferencia,
      observaciones: observaciones ?? null,
    })
    .where(eq(cycleCountItems.id, itemId))
    .returning();

  return updated;
}

/**
 * Complete a cycle count (change status to COMPLETADO).
 */
export async function completeCycleCount(id: string, tenantSlug: string) {
  const count = await getCycleCountById(id, tenantSlug);
  if (count.estado !== "EN_PROGRESO") {
    throw new ValidationError("Solo se puede completar un conteo EN_PROGRESO");
  }

  const [updated] = await db()
    .update(cycleCounts)
    .set({ estado: "COMPLETADO", fechaFin: new Date(), updatedAt: new Date() })
    .where(eq(cycleCounts.id, id))
    .returning();
  return updated;
}

/**
 * Apply adjustments for all items with non-zero differences.
 * Creates stock movements and optional journal entries.
 */
export async function applyAdjustments(
  id: string,
  tenantSlug: string,
  options?: { generateAsiento?: boolean },
) {
  const count = await getCycleCountById(id, tenantSlug);
  if (count.estado !== "COMPLETADO") {
    throw new ValidationError("Solo se pueden ajustar conteos COMPLETADOS");
  }

  const items = await db()
    .select()
    .from(cycleCountItems)
    .where(
      and(
        eq(cycleCountItems.cycleCountId, id),
        eq(cycleCountItems.ajustado, false),
        sql`${cycleCountItems.diferencia} != 0`,
      ),
    );

  if (items.length === 0) {
    throw new ValidationError("No hay diferencias que ajustar");
  }

  const adjusted: { itemId: string; diferencia: number }[] = [];

  for (const item of items) {
    const repuesto = await db()
      .select()
      .from(repuestos)
      .where(eq(repuestos.id, item.repuestoId))
      .limit(1)
      .then((r) => r[0]);

    if (!repuesto) continue;

    const diferencia = item.stockReal - item.stockSistema;
    const tipo = diferencia > 0 ? "ENTRADA" : "SALIDA";
    const absCantidad = Math.abs(diferencia);

    // Atomic stock update
    if (tipo === "ENTRADA") {
      await db()
        .update(repuestos)
        .set({
          stockActual: sql`${repuestos.stockActual} + ${absCantidad}`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(repuestos.id, item.repuestoId));
    } else {
      await db()
        .update(repuestos)
        .set({
          stockActual: sql`${repuestos.stockActual} - ${absCantidad}`,
          updatedAt: sql`NOW()`,
        })
        .where(
          and(
            eq(repuestos.id, item.repuestoId),
            sql`${repuestos.stockActual} >= ${absCantidad}`,
          ),
        );
    }

    // Get updated stock
    const [updatedRep] = await db()
      .select()
      .from(repuestos)
      .where(eq(repuestos.id, item.repuestoId))
      .limit(1);

    if (!updatedRep) continue;

    // Record stock movement
    const costoPromedio = updatedRep.costoPromedio
      ? Number(updatedRep.costoPromedio)
      : 0;
    const costoTotal = costoPromedio * absCantidad;

    const [movimiento] = await db()
      .insert(stockMovements)
      .values({
        repuestoId: item.repuestoId,
        tipo: "AJUSTE",
        cantidad: absCantidad,
        stockAnterior: item.stockSistema,
        stockPosterior: updatedRep.stockActual,
        costoUnitario: costoPromedio > 0 ? String(costoPromedio) : null,
        costoTotal: costoTotal > 0 ? String(costoTotal) : null,
        motivo: `Ajuste por conteo cíclico (ID: ${id.slice(0, 8)})`,
        observaciones: `Sistema: ${item.stockSistema} → Real: ${item.stockReal} (diferencia: ${diferencia >= 0 ? "+" : ""}${diferencia})`,
        tenantSlug,
      })
      .returning();

    // Mark item as adjusted
    await db()
      .update(cycleCountItems)
      .set({
        ajustado: true,
        movimientoAjusteId: movimiento.id,
      })
      .where(eq(cycleCountItems.id, item.id));

    adjusted.push({ itemId: item.id, diferencia });
  }

  // Close the cycle count
  const [closed] = await db()
    .update(cycleCounts)
    .set({ estado: "AJUSTADO", updatedAt: new Date() })
    .where(eq(cycleCounts.id, id))
    .returning();

  return {
    cycleCount: closed,
    adjustedItems: adjusted.length,
    details: adjusted,
  };
}

/**
 * Get all items for a cycle count.
 */
export async function getCycleCountItems(
  cycleCountId: string,
  tenantSlug: string,
) {
  await getCycleCountById(cycleCountId, tenantSlug);
  return db()
    .select()
    .from(cycleCountItems)
    .where(eq(cycleCountItems.cycleCountId, cycleCountId))
    .orderBy(asc(cycleCountItems.createdAt));
}

/**
 * Delete a cycle count (only if ABIERTO).
 */
export async function deleteCycleCount(id: string, tenantSlug: string) {
  const count = await getCycleCountById(id, tenantSlug);
  if (count.estado !== "ABIERTO") {
    throw new ValidationError("Solo se pueden eliminar conteos en estado ABIERTO");
  }
  await db().delete(cycleCounts).where(eq(cycleCounts.id, id));
}

/**
 * Get summary stats for cycle counts.
 */
export async function getCycleCountStats(tenantSlug: string) {
  const all = await db()
    .select({ estado: cycleCounts.estado })
    .from(cycleCounts)
    .where(eq(cycleCounts.tenantSlug, tenantSlug));

  const totalItems = await db()
    .select({ total: count() })
    .from(cycleCountItems)
    .where(eq(cycleCountItems.tenantSlug, tenantSlug));

  const pendingAdjustments = await db()
    .select({ total: count() })
    .from(cycleCountItems)
    .where(
      and(
        eq(cycleCountItems.tenantSlug, tenantSlug),
        eq(cycleCountItems.ajustado, false),
        sql`${cycleCountItems.diferencia} != 0`,
      ),
    );

  return {
    total: all.length,
    abiertos: all.filter((c) => c.estado === "ABIERTO").length,
    enProgreso: all.filter((c) => c.estado === "EN_PROGRESO").length,
    completados: all.filter((c) => c.estado === "COMPLETADO").length,
    ajustados: all.filter((c) => c.estado === "AJUSTADO").length,
    totalItems: Number(totalItems[0]?.total ?? 0),
    pendingAdjustments: Number(pendingAdjustments[0]?.total ?? 0),
  };
}
