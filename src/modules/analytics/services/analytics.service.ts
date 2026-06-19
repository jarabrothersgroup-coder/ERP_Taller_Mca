/**
 * Analytics Service — KPIs, trends, comparisons, and custom reports.
 *
 * @module analytics/services/analytics.service
 */

import { eq, and, desc, sql, count, sum, avg } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { ordenesTrabajo } from "../../../shared/database/schema/index.js";

/** KPI types */
export interface KPI {
  label: string;
  value: number;
  unit: string;
  change?: number; // % change vs previous period
  trend?: "up" | "down" | "flat";
}

/** Date range */
export interface DateRange {
  from: string; // ISO date
  to: string;
}

/** Trend data point */
export interface TrendPoint {
  date: string;
  value: number;
  label?: string;
}

// ─── KPI Queries ────────────────────────────

/**
 * Get revenue KPI for a date range.
 */
export async function getRevenueKPI(tenantSlug: string, range: DateRange): Promise<KPI> {
  const [current] = await db()
    .select({
      total: sum(ordenesTrabajo.montoTotal),
      count: count(),
    })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.fechaIngreso} >= ${range.from}`,
        sql`${ordenesTrabajo.fechaIngreso} <= ${range.to}`,
      ),
    );

  // Previous period for comparison
  const daysDiff = Math.round(
    (new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000,
  );
  const prevFrom = new Date(new Date(range.from).getTime() - daysDiff * 86400000).toISOString().split("T")[0];
  const prevTo = range.from;

  const [previous] = await db()
    .select({ total: sum(ordenesTrabajo.montoTotal) })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.fechaIngreso} >= ${prevFrom}`,
        sql`${ordenesTrabajo.fechaIngreso} <= ${prevTo}`,
      ),
    );

  const currentTotal = Number(current?.total || 0);
  const prevTotal = Number(previous?.total || 0);
  const change = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

  return {
    label: "Ingresos",
    value: currentTotal,
    unit: "Gs.",
    change: Math.round(change * 10) / 10,
    trend: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

/**
 * Get OT count KPI.
 */
export async function getOTCountKPI(tenantSlug: string, range: DateRange): Promise<KPI> {
  const [current] = await db()
    .select({ count: count() })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.fechaIngreso} >= ${range.from}`,
        sql`${ordenesTrabajo.fechaIngreso} <= ${range.to}`,
      ),
    );

  const daysDiff = Math.round(
    (new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000,
  );
  const prevFrom = new Date(new Date(range.from).getTime() - daysDiff * 86400000).toISOString().split("T")[0];

  const [previous] = await db()
    .select({ count: count() })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.fechaIngreso} >= ${prevFrom}`,
        sql`${ordenesTrabajo.fechaIngreso} <= ${range.from}`,
      ),
    );

  const currentCount = current?.count || 0;
  const prevCount = previous?.count || 0;
  const change = prevCount > 0 ? ((currentCount - prevCount) / prevCount) * 100 : 0;

  return {
    label: "Órdenes de Trabajo",
    value: currentCount,
    unit: "OTs",
    change: Math.round(change * 10) / 10,
    trend: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

/**
 * Get average order value KPI.
 */
export async function getAvgOrderValueKPI(tenantSlug: string, range: DateRange): Promise<KPI> {
  const [current] = await db()
    .select({ avg: avg(ordenesTrabajo.montoTotal) })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.fechaIngreso} >= ${range.from}`,
        sql`${ordenesTrabajo.fechaIngreso} <= ${range.to}`,
      ),
    );

  const daysDiff = Math.round(
    (new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000,
  );
  const prevFrom = new Date(new Date(range.from).getTime() - daysDiff * 86400000).toISOString().split("T")[0];

  const [previous] = await db()
    .select({ avg: avg(ordenesTrabajo.montoTotal) })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.fechaIngreso} >= ${prevFrom}`,
        sql`${ordenesTrabajo.fechaIngreso} <= ${range.from}`,
      ),
    );

  const currentAvg = Number(current?.avg || 0);
  const prevAvg = Number(previous?.avg || 0);
  const change = prevAvg > 0 ? ((currentAvg - prevAvg) / prevAvg) * 100 : 0;

  return {
    label: "Ticket Promedio",
    value: Math.round(currentAvg),
    unit: "Gs.",
    change: Math.round(change * 10) / 10,
    trend: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

/**
 * Get completion rate KPI.
 */
export async function getCompletionRateKPI(tenantSlug: string, range: DateRange): Promise<KPI> {
  const [total] = await db()
    .select({ count: count() })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.fechaIngreso} >= ${range.from}`,
        sql`${ordenesTrabajo.fechaIngreso} <= ${range.to}`,
      ),
    );

  const [completed] = await db()
    .select({ count: count() })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        eq(ordenesTrabajo.estado, "FINALIZADO_RETIRADO"),
        sql`${ordenesTrabajo.fechaIngreso} >= ${range.from}`,
        sql`${ordenesTrabajo.fechaIngreso} <= ${range.to}`,
      ),
    );

  const totalOTs = total?.count || 0;
  const completedOTs = completed?.count || 0;
  const rate = totalOTs > 0 ? (completedOTs / totalOTs) * 100 : 0;

  return {
    label: "Tasa de Finalización",
    value: Math.round(rate * 10) / 10,
    unit: "%",
    trend: rate >= 80 ? "up" : rate >= 50 ? "flat" : "down",
  };
}

// ─── Trend Queries ──────────────────────────

/**
 * Get daily revenue trend.
 */
export async function getDailyRevenueTrend(
  tenantSlug: string,
  range: DateRange,
): Promise<TrendPoint[]> {
  const rows = await db()
    .select({
      date: sql<string>`DATE(${ordenesTrabajo.fechaIngreso})::text`,
      value: sum(ordenesTrabajo.montoTotal),
    })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.fechaIngreso} >= ${range.from}`,
        sql`${ordenesTrabajo.fechaIngreso} <= ${range.to}`,
      ),
    )
    .groupBy(sql`DATE(${ordenesTrabajo.fechaIngreso})`)
    .orderBy(sql`DATE(${ordenesTrabajo.fechaIngreso})`);

  return rows.map((r) => ({
    date: r.date,
    value: Number(r.value || 0),
  }));
}

/**
 * Get daily OT count trend.
 */
export async function getDailyOTTrend(
  tenantSlug: string,
  range: DateRange,
): Promise<TrendPoint[]> {
  const rows = await db()
    .select({
      date: sql<string>`DATE(${ordenesTrabajo.fechaIngreso})::text`,
      value: count(),
    })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.fechaIngreso} >= ${range.from}`,
        sql`${ordenesTrabajo.fechaIngreso} <= ${range.to}`,
      ),
    )
    .groupBy(sql`DATE(${ordenesTrabajo.fechaIngreso})`)
    .orderBy(sql`DATE(${ordenesTrabajo.fechaIngreso})`);

  return rows.map((r) => ({
    date: r.date,
    value: r.value,
  }));
}

/**
 * Get OT status distribution.
 */
export async function getOTStatusDistribution(
  tenantSlug: string,
  range: DateRange,
): Promise<Array<{ status: string; count: number; percentage: number }>> {
  const rows = await db()
    .select({
      status: ordenesTrabajo.estado,
      count: count(),
    })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.fechaIngreso} >= ${range.from}`,
        sql`${ordenesTrabajo.fechaIngreso} <= ${range.to}`,
      ),
    )
    .groupBy(ordenesTrabajo.estado);

  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return rows.map((r) => ({
    status: r.status || "UNKNOWN",
    count: r.count,
    percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
  }));
}

/**
 * Get top mechanics by OT count.
 */
export async function getTopMechanics(
  tenantSlug: string,
  range: DateRange,
  limit = 5,
): Promise<Array<{ name: string; otCount: number; revenue: number }>> {
  const rows = await db()
    .select({
      name: ordenesTrabajo.mecanicoAsignado,
      otCount: count(),
      revenue: sum(ordenesTrabajo.montoTotal),
    })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.fechaIngreso} >= ${range.from}`,
        sql`${ordenesTrabajo.fechaIngreso} <= ${range.to}`,
      ),
    )
    .groupBy(ordenesTrabajo.mecanicoAsignado)
    .orderBy(desc(count()))
    .limit(limit);

  return rows.map((r) => ({
    name: r.name || "Sin asignar",
    otCount: r.otCount,
    revenue: Number(r.revenue || 0),
  }));
}

// ─── Report Builder ─────────────────────────

export interface ReportConfig {
  type: "revenue" | "ots" | "mechanics" | "status" | "summary";
  dateRange: DateRange;
  groupBy?: "day" | "week" | "month";
  format?: "json" | "csv";
}

/**
 * Generate a custom report.
 */
export async function generateReport(tenantSlug: string, config: ReportConfig) {
  switch (config.type) {
    case "summary": {
      const [kpi1, kpi2, kpi3, kpi4] = await Promise.all([
        getRevenueKPI(tenantSlug, config.dateRange),
        getOTCountKPI(tenantSlug, config.dateRange),
        getAvgOrderValueKPI(tenantSlug, config.dateRange),
        getCompletionRateKPI(tenantSlug, config.dateRange),
      ]);
      return { kpis: [kpi1, kpi2, kpi3, kpi4] };
    }
    case "revenue":
      return { trend: await getDailyRevenueTrend(tenantSlug, config.dateRange) };
    case "ots":
      return { trend: await getDailyOTTrend(tenantSlug, config.dateRange) };
    case "mechanics":
      return { mechanics: await getTopMechanics(tenantSlug, config.dateRange) };
    case "status":
      return { distribution: await getOTStatusDistribution(tenantSlug, config.dateRange) };
    default:
      return { error: "Unknown report type" };
  }
}

/**
 * Convert report data to CSV string.
 */
export function toCSV(data: any[], columns: string[]): string {
  const header = columns.join(",");
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col];
      return typeof val === "string" && val.includes(",") ? `"${val}"` : val;
    }).join(","),
  );
  return [header, ...rows].join("\n");
}
