/**
 * Batch Inventory Service — Bulk operations for repuestos.
 *
 * Features:
 *   - Bulk CSV import (repuestos)
 *   - Bulk price update
 *   - Bulk stock adjustment
 *   - Inventory turnover calculation
 *   - Dead stock detection
 *   - Reorder prediction
 *
 * @module inventory/services/batch-inventory.service
 */

import { eq, and, desc, sql, count, sum } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { repuestos } from "../schema/repuestos.js";

/** CSV import row */
export interface BulkImportRow {
  codigo?: string;
  descripcion: string;
  marca?: string;
  categoria?: string;
  precioVenta?: number;
  precioCompra?: number;
  stockActual?: number;
  puntoReorden?: number;
  ubicacion?: string;
}

/** Bulk price update */
export interface BulkPriceUpdate {
  ids: string[];
  percentageChange?: number;
 固定Price?: number;
  field: "precioVenta" | "precioCompra";
}

/** Bulk stock adjustment */
export interface BulkStockAdjustment {
  adjustments: Array<{
    repuestoId: string;
    cantidad: number;
    motivo: string;
  }>;
}

/** Inventory turnover result */
export interface TurnoverResult {
  repuestoId: string;
  codigo: string;
  descripcion: string;
  stockActual: number;
  ventas30d: number;
  turnoverRate: number; // sales / avg stock
  daysOfStock: number; // stock / (sales/30)
}

/** Dead stock result */
export interface DeadStockResult {
  repuestoId: string;
  codigo: string;
  descripcion: string;
  stockActual: number;
  valorTotal: number;
  diasSinMovimiento: number;
}

/** Reorder prediction */
export interface ReorderPrediction {
  repuestoId: string;
  codigo: string;
  descripcion: string;
  stockActual: number;
  puntoReorden: number;
  promedioDiario: number;
  diasParaReorden: number;
  fechaEstimada: string;
  urgencia: "CRITICO" | "ALTO" | "MEDIO" | "BAJO";
}

// ─── Bulk Import ────────────────────────────

/**
 * Bulk import repuestos from CSV data.
 * Returns { imported, updated, errors }.
 */
export async function bulkImportRepuestos(
  tenantSlug: string,
  rows: BulkImportRow[],
): Promise<{ imported: number; updated: number; errors: string[] }> {
  let imported = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      // Check if exists by codigo
      const existing = row.codigo
        ? await db()
            .select({ id: repuestos.id })
            .from(repuestos)
            .where(
              and(
                eq(repuestos.tenantSlug, tenantSlug),
                eq(repuestos.codigo, row.codigo),
              ),
            )
            .limit(1)
        : [];

      if (existing.length > 0 && row.codigo) {
        // Update existing
        await db()
          .update(repuestos)
          .set({
            descripcion: row.descripcion,
            marca: row.marca || undefined,
            categoria: row.categoria || undefined,
            precioVenta: row.precioVenta || undefined,
            precioCompra: row.precioCompra || undefined,
            stockActual: row.stockActual ?? undefined,
            puntoReorden: row.puntoReorden ?? undefined,
            ubicacion: row.ubicacion || undefined,
          })
          .where(eq(repuestos.id, existing[0].id));
        updated++;
      } else {
        // Insert new
        await db()
          .insert(repuestos)
          .values({
            tenantSlug,
            codigo: row.codigo || `AUTO-${Date.now()}`,
            descripcion: row.descripcion,
            marca: row.marca || null,
            categoria: row.categoria || null,
            precioVenta: row.precioVenta || 0,
            precioCompra: row.precioCompra || 0,
            stockActual: row.stockActual || 0,
            puntoReorden: row.puntoReorden || 5,
            ubicacion: row.ubicacion || null,
            activo: true,
          });
        imported++;
      }
    } catch (err: any) {
      errors.push(`Row "${row.descripcion}": ${err.message}`);
    }
  }

  return { imported, updated, errors };
}

// ─── Bulk Price Update ──────────────────────

/**
 * Bulk update prices for multiple repuestos.
 */
export async function bulkUpdatePrices(
  tenantSlug: string,
  ids: string[],
  field: "precioVenta" | "precioCompra",
  percentageChange: number,
): Promise<{ updated: number }> {
  if (!ids.length) return { updated: 0 };

  // Get current prices
  const items = await db()
    .select({ id: repuestos.id, precioVenta: repuestos.precioVenta, precioCompra: repuestos.precioCompra })
    .from(repuestos)
    .where(
      and(
        eq(repuestos.tenantSlug, tenantSlug),
        sql`${repuestos.id} IN ${ids}`,
      ),
    );

  let updated = 0;
  for (const item of items) {
    const currentPrice = field === "precioVenta" ? Number(item.precioVenta) : Number(item.precioCompra);
    const newPrice = Math.round(currentPrice * (1 + percentageChange / 100));

    await db()
      .update(repuestos)
      .set({ [field]: newPrice })
      .where(eq(repuestos.id, item.id));
    updated++;
  }

  return { updated };
}

// ─── Bulk Stock Adjustment ──────────────────

/**
 * Bulk adjust stock levels.
 */
export async function bulkAdjustStock(
  tenantSlug: string,
  adjustments: Array<{ repuestoId: string; cantidad: number; motivo: string }>,
): Promise<{ adjusted: number; errors: string[] }> {
  let adjusted = 0;
  const errors: string[] = [];

  for (const adj of adjustments) {
    try {
      const [item] = await db()
        .select({ stockActual: repuestos.stockActual })
        .from(repuestos)
        .where(
          and(
            eq(repuestos.tenantSlug, tenantSlug),
            eq(repuestos.id, adj.repuestoId),
          ),
        )
        .limit(1);

      if (!item) {
        errors.push(`Repuesto ${adj.repuestoId} not found`);
        continue;
      }

      const newStock = Number(item.stockActual) + adj.cantidad;
      if (newStock < 0) {
        errors.push(`Repuesto ${adj.repuestoId}: stock would go negative (${newStock})`);
        continue;
      }

      await db()
        .update(repuestos)
        .set({ stockActual: newStock })
        .where(eq(repuestos.id, adj.repuestoId));
      adjusted++;
    } catch (err: any) {
      errors.push(`Repuesto ${adj.repuestoId}: ${err.message}`);
    }
  }

  return { adjusted, errors };
}

// ─── Inventory Analytics ────────────────────

/**
 * Calculate inventory turnover for all active repuestos.
 */
export async function getInventoryTurnover(tenantSlug: string): Promise<TurnoverResult[]> {
  // Get all active repuestos
  const items = await db()
    .select({
      id: repuestos.id,
      codigo: repuestos.codigo,
      descripcion: repuestos.descripcion,
      stockActual: repuestos.stockActual,
      precioVenta: repuestos.precioVenta,
    })
    .from(repuestos)
    .where(
      and(
        eq(repuestos.tenantSlug, tenantSlug),
        eq(repuestos.activo, true),
      ),
    );

  // Get sales data from OT items (last 30 days)
  const salesData = await db()
    .execute(sql`
      SELECT
        oi.repuesto_id,
        COALESCE(SUM(oi.cantidad), 0) as total_sold
      FROM orden_items oi
      JOIN ordenes_trabajo ot ON oi.orden_id = ot.id
      WHERE ot.tenant_slug = ${tenantSlug}
        AND oi.tipo = 'repuesto'
        AND ot.fecha_ingreso >= NOW() - INTERVAL '30 days'
      GROUP BY oi.repuesto_id
    `);

  const salesMap = new Map<string, number>();
  for (const row of (salesData as any).rows || []) {
    salesMap.set(row.repuesto_id, Number(row.total_sold));
  }

  return items.map((item) => {
    const ventas30d = salesMap.get(item.id) || 0;
    const avgStock = Number(item.stockActual);
    const turnoverRate = avgStock > 0 ? ventas30d / avgStock : 0;
    const daysOfStock = ventas30d > 0 ? (avgStock / ventas30d) * 30 : 999;

    return {
      repuestoId: item.id,
      codigo: item.codigo,
      descripcion: item.descripcion,
      stockActual: avgStock,
      ventas30d,
      turnoverRate: Math.round(turnoverRate * 100) / 100,
      daysOfStock: Math.round(daysOfStock),
    };
  });
}

/**
 * Detect dead stock (no sales in 90 days, stock > 0).
 */
export async function getDeadStock(tenantSlug: string): Promise<DeadStockResult[]> {
  const items = await db()
    .select({
      id: repuestos.id,
      codigo: repuestos.codigo,
      descripcion: repuestos.descripcion,
      stockActual: repuestos.stockActual,
      precioVenta: repuestos.precioVenta,
    })
    .from(repuestos)
    .where(
      and(
        eq(repuestos.tenantSlug, tenantSlug),
        eq(repuestos.activo, true),
        sql`${repuestos.stockActual} > 0`,
      ),
    );

  // Get last sale date for each repuesto
  const results: DeadStockResult[] = [];

  for (const item of items) {
    const [lastSale] = await db()
      .execute(sql`
        SELECT MAX(ot.fecha_ingreso) as last_sale
        FROM orden_items oi
        JOIN ordenes_trabajo ot ON oi.orden_id = ot.id
        WHERE ot.tenant_slug = ${tenantSlug}
          AND oi.tipo = 'repuesto'
          AND oi.repuesto_id = ${item.id}
      `);

    const lastSaleDate = (lastSale as any)?.rows?.[0]?.last_sale;
    const daysSinceLastSale = lastSaleDate
      ? Math.floor((Date.now() - new Date(lastSaleDate).getTime()) / 86400000)
      : 999;

    if (daysSinceLastSale >= 90) {
      results.push({
        repuestoId: item.id,
        codigo: item.codigo,
        descripcion: item.descripcion,
        stockActual: Number(item.stockActual),
        valorTotal: Number(item.stockActual) * Number(item.precioVenta),
        diasSinMovimiento: daysSinceLastSale,
      });
    }
  }

  return results.sort((a, b) => b.valorTotal - a.valorTotal);
}

/**
 * Predict reorder dates for all repuestos.
 */
export async function getReorderPredictions(tenantSlug: string): Promise<ReorderPrediction[]> {
  const items = await db()
    .select({
      id: repuestos.id,
      codigo: repuestos.codigo,
      descripcion: repuestos.descripcion,
      stockActual: repuestos.stockActual,
      puntoReorden: repuestos.puntoReorden,
    })
    .from(repuestos)
    .where(
      and(
        eq(repuestos.tenantSlug, tenantSlug),
        eq(repuestos.activo, true),
      ),
    );

  // Get average daily sales (last 90 days)
  const salesData = await db()
    .execute(sql`
      SELECT
        oi.repuesto_id,
        COALESCE(SUM(oi.cantidad), 0) / 90.0 as avg_daily
      FROM orden_items oi
      JOIN ordenes_trabajo ot ON oi.orden_id = ot.id
      WHERE ot.tenant_slug = ${tenantSlug}
        AND oi.tipo = 'repuesto'
        AND ot.fecha_ingreso >= NOW() - INTERVAL '90 days'
      GROUP BY oi.repuesto_id
    `);

  const salesMap = new Map<string, number>();
  for (const row of (salesData as any).rows || []) {
    salesMap.set(row.repuesto_id, Number(row.avg_daily));
  }

  return items
    .map((item) => {
      const stock = Number(item.stockActual);
      const reorder = Number(item.puntoReorden);
      const avgDaily = salesMap.get(item.id) || 0;
      const diasParaReorden = avgDaily > 0 ? Math.max(0, (stock - reorder) / avgDaily) : 999;

      const fechaEstimada = new Date();
      fechaEstimada.setDate(fechaEstimada.getDate() + Math.round(diasParaReorden));

      let urgencia: ReorderPrediction["urgencia"] = "BAJO";
      if (stock <= reorder) urgencia = "CRITICO";
      else if (diasParaReorden <= 7) urgencia = "ALTO";
      else if (diasParaReorden <= 30) urgencia = "MEDIO";

      return {
        repuestoId: item.id,
        codigo: item.codigo,
        descripcion: item.descripcion,
        stockActual: stock,
        puntoReorden: reorder,
        promedioDiario: Math.round(avgDaily * 100) / 100,
        diasParaReorden: Math.round(diasParaReorden),
        fechaEstimada: fechaEstimada.toISOString().split("T")[0],
        urgencia,
      };
    })
    .sort((a, b) => a.diasParaReorden - b.diasParaReorden);
}
