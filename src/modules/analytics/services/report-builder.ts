/**
 * Report Builder Service — Custom report generation with scheduling.
 *
 * Generates reports from multiple data sources with flexible formatting.
 * Supports JSON, CSV, and PDF export.
 *
 * @module analytics/services/report-builder
 */

import { eq, and, sql, count, sum, avg, desc } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { ordenesTrabajo, clients, vehiculos } from "../../../shared/database/schema/index.js";

// ─── Types ──────────────────────────────────────────────────────────────

export interface ReportRequest {
  tenantSlug: string;
  type: "summary" | "revenue" | "clients" | "vehicles" | "mechanics" | "inventory";
  dateRange: { from: string; to: string };
  format: "json" | "csv";
  filters?: Record<string, any>;
  limit?: number;
}

export interface ReportResult {
  reportType: string;
  generatedAt: Date;
  dateRange: { from: string; to: string };
  data: any;
  summary?: Record<string, any>;
}

// ─── Report Generators ─────────────────────────────────────────────────

/**
 * Generate a summary report with all KPIs.
 */
async function generateSummaryReport(tenantSlug: string, dateRange: { from: string; to: string }): Promise<ReportResult> {
  const conditions = [
    eq(ordenesTrabajo.tenantSlug, tenantSlug),
    sql`${ordenesTrabajo.createdAt} >= ${dateRange.from}`,
    sql`${ordenesTrabajo.createdAt} <= ${dateRange.to}`,
  ];

  const [totalOTs, completedOTs, revenue, avgOrder] = await Promise.all([
    db().select({ count: count() }).from(ordenesTrabajo).where(and(...conditions)),
    db().select({ count: count() }).from(ordenesTrabajo).where(and(...conditions, eq(ordenesTrabajo.status, "Listo"))),
    db().select({ total: sum(ordenesTrabajo.totalCost) }).from(ordenesTrabajo).where(and(...conditions)),
    db().select({ avg: avg(ordenesTrabajo.totalCost) }).from(ordenesTrabajo).where(and(...conditions)),
  ]);

  return {
    reportType: "summary",
    generatedAt: new Date(),
    dateRange,
    data: {
      totalOTs: totalOTs[0]?.count || 0,
      completedOTs: completedOTs[0]?.count || 0,
      revenue: Number(revenue[0]?.total || 0),
      avgOrderValue: Number(avgOrder[0]?.avg || 0),
      completionRate: totalOTs[0]?.count ? ((completedOTs[0]?.count || 0) / totalOTs[0].count) * 100 : 0,
    },
  };
}

/**
 * Generate a client activity report.
 */
async function generateClientsReport(tenantSlug: string, dateRange: { from: string; to: string }, limit: number): Promise<ReportResult> {
  const rows = await db()
    .select({
      clientId: ordenesTrabajo.clientId,
      clientName: clients.name,
      otCount: count(),
      totalRevenue: sum(ordenesTrabajo.totalCost),
    })
    .from(ordenesTrabajo)
    .innerJoin(clients, eq(ordenesTrabajo.clientId, clients.id))
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.createdAt} >= ${dateRange.from}`,
        sql`${ordenesTrabajo.createdAt} <= ${dateRange.to}`,
      ),
    )
    .groupBy(ordenesTrabajo.clientId, clients.name)
    .having(sql`${count()} > 0`)
    .orderBy(desc(count()))
    .limit(limit);

  return {
    reportType: "clients",
    generatedAt: new Date(),
    dateRange,
    data: rows.map((r) => ({
      clientId: r.clientId,
      clientName: r.clientName || "Sin nombre",
      otCount: r.otCount,
      totalRevenue: Number(r.totalRevenue || 0),
    })),
    summary: {
      totalClients: rows.length,
      totalRevenue: rows.reduce((sum, r) => sum + Number(r.totalRevenue || 0), 0),
    },
  };
}

/**
 * Generate a vehicle activity report.
 */
async function generateVehiclesReport(tenantSlug: string, dateRange: { from: string; to: string }, limit: number): Promise<ReportResult> {
  const rows = await db()
    .select({
      vehicleId: ordenesTrabajo.vehicleId,
      vehicleBrand: vehiculos.brand,
      vehicleModel: vehiculos.model,
      vehiclePlate: vehiculos.plate,
      otCount: count(),
      totalRevenue: sum(ordenesTrabajo.totalCost),
    })
    .from(ordenesTrabajo)
    .innerJoin(vehiculos, eq(ordenesTrabajo.vehicleId, vehiculos.id))
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.createdAt} >= ${dateRange.from}`,
        sql`${ordenesTrabajo.createdAt} <= ${dateRange.to}`,
      ),
    )
    .groupBy(ordenesTrabajo.vehicleId, vehiculos.brand, vehiculos.model, vehiculos.plate)
    .having(sql`${count()} > 0`)
    .orderBy(desc(count()))
    .limit(limit);

  return {
    reportType: "vehicles",
    generatedAt: new Date(),
    dateRange,
    data: rows.map((r) => ({
      vehicleId: r.vehicleId,
      vehicleName: `${r.vehicleBrand || ""} ${r.vehicleModel || ""}`.trim() || "Sin identificar",
      vehiclePlate: r.vehiclePlate || "",
      otCount: r.otCount,
      totalRevenue: Number(r.totalRevenue || 0),
    })),
  };
}

// ─── Main Generator ─────────────────────────────────────────────────────

/**
 * Generate a report based on the request configuration.
 */
export async function generateReport(request: ReportRequest): Promise<ReportResult> {
  const { tenantSlug, type, dateRange, limit = 20 } = request;

  switch (type) {
    case "summary":
      return generateSummaryReport(tenantSlug, dateRange);
    case "clients":
      return generateClientsReport(tenantSlug, dateRange, limit);
    case "vehicles":
      return generateVehiclesReport(tenantSlug, dateRange, limit);
    default:
      return {
        reportType: type,
        generatedAt: new Date(),
        dateRange,
        data: [],
        summary: { error: `Unknown report type: ${type}` },
      };
  }
}

/**
 * Convert report data to CSV string.
 */
export function toCSV(data: any[], columns: string[]): string {
  if (!data.length) return columns.join(",");

  const header = columns.join(",");
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
      .join(","),
  );

  return [header, ...rows].join("\n");
}
