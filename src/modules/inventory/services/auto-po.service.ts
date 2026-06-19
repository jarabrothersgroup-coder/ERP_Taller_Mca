/**
 * Auto PO Service — Automatic purchase order generation.
 *
 * When stock drops below reorder point, automatically generates
 * a purchase order to the preferred supplier.
 *
 * @module inventory/services/auto-po.service
 */

import { db } from "../../../shared/database/drizzle.js";
import {
  repuestos,
  reorderAlerts,
  purchaseOrders,
  purchaseOrderItems,
} from "../schema/index.js";
import { eq, and, sql, desc } from "drizzle-orm";

// ─── Types ────────────────────────────────────

export interface AutoPOResult {
  created: boolean;
  poId?: string;
  poNumero?: string;
  items: number;
  totalEstimado: number;
}

// ─── Auto PO Generation ───────────────────────

/**
 * Checks for pending reorder alerts and generates POs.
 *
 * Called by a cron job (every hour) or manually.
 * Groups items by supplier and creates one PO per supplier.
 *
 * @param tenantSlug - Tenant identifier
 * @returns Results of PO generation
 */
export async function generateAutoPOs(
  tenantSlug: string,
): Promise<AutoPOResult[]> {
  // Get all pending reorder alerts
  const pendingAlerts = await db()
    .select({
      id: reorderAlerts.id,
      repuestoId: reorderAlerts.repuestoId,
      stockActual: reorderAlerts.stockActual,
      puntoReorden: reorderAlerts.puntoReorden,
      // Get repuesto details
      codigo: repuestos.codigo,
      descripcion: repuestos.descripcion,
      proveedor: repuestos.proveedor,
      proveedorPreferidoId: reorderAlerts.repuestoId,
      loteEconomico: repuestos.loteEconomico,
      costoPromedio: repuestos.costoPromedio,
    })
    .from(reorderAlerts)
    .innerJoin(repuestos, eq(reorderAlerts.repuestoId, repuestos.id))
    .where(
      and(
        eq(reorderAlerts.estado, "PENDIENTE"),
        eq(reorderAlerts.tenantSlug, tenantSlug),
      ),
    );

  if (pendingAlerts.length === 0) return [];

  // Group by supplier
  const bySupplier = new Map<string, typeof pendingAlerts>();
  for (const alert of pendingAlerts) {
    const supplier = alert.proveedor || "SIN_PROVEEDOR";
    if (!bySupplier.has(supplier)) {
      bySupplier.set(supplier, []);
    }
    bySupplier.get(supplier)!.push(alert);
  }

  const results: AutoPOResult[] = [];

  for (const [supplier, alerts] of bySupplier) {
    // Generate PO number
    const poNumero = await generatePONumber(tenantSlug);

    // Create PO
    const [po] = await db()
      .insert(purchaseOrders)
      .values({
        numero: poNumero,
        proveedor: supplier,
        estado: "PENDIENTE_APROB",
        notas: `Generado automáticamente desde reorder alerts (${alerts.length} items)`,
        tenantSlug,
      })
      .returning();

    // Create PO items
    let totalEstimado = 0;
    for (const alert of alerts) {
      const cantidad = alert.loteEconomico || 10; // Default to 10 if no economic order qty
      const costoUnitario = Number(alert.costoPromedio || 0);
      const subtotal = costoUnitario * cantidad;
      totalEstimado += subtotal;

      await db().insert(purchaseOrderItems).values({
        ordenCompraId: po.id,
        repuestoId: alert.repuestoId,
        cantidad,
        costoUnitario: String(costoUnitario),
        subtotal: String(subtotal),
        tenantSlug,
      });

      // Update alert status
      await db()
        .update(reorderAlerts)
        .set({ estado: "EN_OC", ocGeneradaId: po.id })
        .where(eq(reorderAlerts.id, alert.id));
    }

    // Update PO total
    await db()
      .update(purchaseOrders)
      .set({ totalOc: String(totalEstimado) })
      .where(eq(purchaseOrders.id, po.id));

    results.push({
      created: true,
      poId: po.id,
      poNumero,
      items: alerts.length,
      totalEstimado,
    });
  }

  return results;
}

/**
 * Generates a sequential PO number.
 *
 * Format: OC-YYYY-NNNN (e.g., OC-2026-0001)
 */
async function generatePONumber(tenantSlug: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OC-${year}-`;

  const [lastPO] = await db()
    .select({ numero: purchaseOrders.numero })
    .from(purchaseOrders)
    .where(
      and(
        sql`${purchaseOrders.numero} LIKE ${prefix}%`,
        eq(purchaseOrders.tenantSlug, tenantSlug),
      ),
    )
    .orderBy(desc(purchaseOrders.numero))
    .limit(1);

  if (!lastPO) {
    return `${prefix}0001`;
  }

  const lastNum = parseInt(lastPO.numero.split("-")[2] || "0", 10);
  const nextNum = String(lastNum + 1).padStart(4, "0");
  return `${prefix}${nextNum}`;
}
