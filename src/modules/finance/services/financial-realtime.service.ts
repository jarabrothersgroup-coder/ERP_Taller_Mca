/**
 * Financial Realtime Service — queries KPIs, cashflow, and invoice summaries.
 *
 * Used by the WebSocket endpoint to push live financial data.
 *
 * @module finance/services/financial-realtime
 */

import { db } from "../../../shared/database/drizzle.js";
import { sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────

export interface FinancialKPIs {
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  completionRate: number;
  pendingInvoices: number;
  overdueAmount: number;
  updatedAt: string;
}

export interface CashflowData {
  inflows: number;
  outflows: number;
  net: number;
  pendingReceivable: number;
  pendingPayable: number;
  updatedAt: string;
}

export interface InvoiceSummary {
  totalPending: number;
  totalOverdue: number;
  recentInvoices: Array<{
    id: string;
    total: string;
    estadoPago: string;
    createdAt: string;
  }>;
  updatedAt: string;
}

// ─── Data Fetchers ────────────────────────────

/**
 * Returns current workshop KPIs for the tenant.
 */
export async function getFinancialKPIs(tenantSlug: string): Promise<FinancialKPIs> {
  const rows = await db().execute(sql`
    SELECT
      COUNT(*) as order_count,
      COALESCE(SUM(CASE WHEN estado = 'Completado' THEN 1 ELSE 0 END), 0) as completed,
      COALESCE(SUM(CASE WHEN estado != 'Cancelado' THEN 1 ELSE 0 END), 0) as active
    FROM ordenes_trabajo
    WHERE tenant_slug = ${tenantSlug}
  `);
  const row = rows[0] as any;
  const orderCount = Number(row.order_count) || 0;
  const completed = Number(row.completed) || 0;

  const invRows = await db().execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN estado_pago = 'PENDIENTE' THEN total ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN estado_pago = 'PENDIENTE' AND fecha_vencimiento < now() THEN total ELSE 0 END), 0) as overdue
    FROM facturas
    WHERE tenant_slug = ${tenantSlug}
  `);
  const inv = invRows[0] as any;

  // Estimate revenue from completed orders
  const revRows = await db().execute(sql`
    SELECT COALESCE(SUM(total), 0) as revenue
    FROM facturas
    WHERE tenant_slug = ${tenantSlug} AND estado_pago IN ('PAGA', 'PARCIAL')
  `);
  const revenue = Number((revRows[0] as any).revenue) || 0;

  return {
    revenue,
    orderCount,
    avgOrderValue: orderCount > 0 ? Math.round(revenue / orderCount) : 0,
    completionRate: orderCount > 0 ? Math.round((completed / orderCount) * 100) : 0,
    pendingInvoices: Number(inv?.pending) || 0,
    overdueAmount: Number(inv?.overdue) || 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Returns cashflow summary for the tenant.
 */
export async function getCashflowData(tenantSlug: string): Promise<CashflowData> {
  const rows = await db().execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN estado_pago IN ('PAGA', 'PARCIAL') THEN total ELSE 0 END), 0) as inflows,
      COALESCE(SUM(CASE WHEN estado_pago = 'PENDIENTE' THEN total ELSE 0 END), 0) as pending_rec
    FROM facturas
    WHERE tenant_slug = ${tenantSlug}
  `);
  const row = rows[0] as any;

  return {
    inflows: Number(row.inflows) || 0,
    outflows: 0,
    net: Number(row.inflows) || 0,
    pendingReceivable: Number(row.pending_rec) || 0,
    pendingPayable: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Returns invoice summary for the tenant.
 */
export async function getInvoiceSummary(tenantSlug: string): Promise<InvoiceSummary> {
  const statsRows = await db().execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN estado_pago = 'PENDIENTE' THEN 1 ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN estado_pago = 'PENDIENTE' AND fecha_vencimiento < now() THEN 1 ELSE 0 END), 0) as overdue
    FROM facturas
    WHERE tenant_slug = ${tenantSlug}
  `);
  const stats = statsRows[0] as any;

  const recentRows = await db().execute(sql`
    SELECT id, total, estado_pago, created_at
    FROM facturas
    WHERE tenant_slug = ${tenantSlug}
    ORDER BY created_at DESC
    LIMIT 5
  `);

  return {
    totalPending: Number(stats?.pending) || 0,
    totalOverdue: Number(stats?.overdue) || 0,
    recentInvoices: (recentRows as any[]).map((r) => ({
      id: r.id,
      total: r.total,
      estadoPago: r.estado_pago,
      createdAt: r.created_at,
    })),
    updatedAt: new Date().toISOString(),
  };
}
