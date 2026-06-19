/**
 * Analytics Routes — KPIs, trends, and custom reports.
 *
 * Routes:
 *   GET  /analytics/kpis              — All KPIs for date range
 *   GET  /analytics/kpis/revenue      — Revenue KPI
 *   GET  /analytics/kpis/ots          — OT count KPI
 *   GET  /analytics/kpis/avg-value    — Average order value
 *   GET  /analytics/kpis/completion   — Completion rate
 *   GET  /analytics/trends/revenue    — Daily revenue trend
 *   GET  /analytics/trends/ots        — Daily OT count trend
 *   GET  /analytics/distribution      — OT status distribution
 *   GET  /analytics/mechanics         — Top mechanics
 *   POST /analytics/report            — Custom report
 *   POST /analytics/report/csv        — Export as CSV
 *
 * @module analytics/routes/analytics.routes
 */

import type { FastifyInstance } from "fastify";
import {
  getRevenueKPI,
  getOTCountKPI,
  getAvgOrderValueKPI,
  getCompletionRateKPI,
  getDailyRevenueTrend,
  getDailyOTTrend,
  getOTStatusDistribution,
  getTopMechanics,
  generateReport,
  toCSV,
} from "../services/analytics.service.js";

function getDefaultRange() {
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  return { from, to };
}

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /analytics/kpis — All KPIs ──
  app.get("/analytics/kpis", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { from, to } = (request.query as any) || {};
    const range = from && to ? { from, to } : getDefaultRange();

    const [revenue, ots, avgValue, completion] = await Promise.all([
      getRevenueKPI(tenantSlug, range),
      getOTCountKPI(tenantSlug, range),
      getAvgOrderValueKPI(tenantSlug, range),
      getCompletionRateKPI(tenantSlug, range),
    ]);

    reply.send({ kpis: [revenue, ots, avgValue, completion], range });
  });

  // ── GET /analytics/kpis/revenue ──
  app.get("/analytics/kpis/revenue", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { from, to } = (request.query as any) || {};
    const range = from && to ? { from, to } : getDefaultRange();
    const kpi = await getRevenueKPI(tenantSlug, range);
    reply.send(kpi);
  });

  // ── GET /analytics/kpis/ots ──
  app.get("/analytics/kpis/ots", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { from, to } = (request.query as any) || {};
    const range = from && to ? { from, to } : getDefaultRange();
    const kpi = await getOTCountKPI(tenantSlug, range);
    reply.send(kpi);
  });

  // ── GET /analytics/kpis/avg-value ──
  app.get("/analytics/kpis/avg-value", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { from, to } = (request.query as any) || {};
    const range = from && to ? { from, to } : getDefaultRange();
    const kpi = await getAvgOrderValueKPI(tenantSlug, range);
    reply.send(kpi);
  });

  // ── GET /analytics/kpis/completion ──
  app.get("/analytics/kpis/completion", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { from, to } = (request.query as any) || {};
    const range = from && to ? { from, to } : getDefaultRange();
    const kpi = await getCompletionRateKPI(tenantSlug, range);
    reply.send(kpi);
  });

  // ── GET /analytics/trends/revenue ──
  app.get("/analytics/trends/revenue", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { from, to } = (request.query as any) || {};
    const range = from && to ? { from, to } : getDefaultRange();
    const trend = await getDailyRevenueTrend(tenantSlug, range);
    reply.send({ trend, range });
  });

  // ── GET /analytics/trends/ots ──
  app.get("/analytics/trends/ots", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { from, to } = (request.query as any) || {};
    const range = from && to ? { from, to } : getDefaultRange();
    const trend = await getDailyOTTrend(tenantSlug, range);
    reply.send({ trend, range });
  });

  // ── GET /analytics/distribution — Status distribution ──
  app.get("/analytics/distribution", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { from, to } = (request.query as any) || {};
    const range = from && to ? { from, to } : getDefaultRange();
    const distribution = await getOTStatusDistribution(tenantSlug, range);
    reply.send({ distribution, range });
  });

  // ── GET /analytics/mechanics — Top mechanics ──
  app.get("/analytics/mechanics", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { from, to, limit } = (request.query as any) || {};
    const range = from && to ? { from, to } : getDefaultRange();
    const mechanics = await getTopMechanics(tenantSlug, range, limit ? parseInt(limit) : 5);
    reply.send({ mechanics, range });
  });

  // ── POST /analytics/report — Custom report ──
  app.post("/analytics/report", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const config = request.body as {
      type: string;
      from: string;
      to: string;
      groupBy?: string;
      format?: string;
    };

    if (!config.type || !config.from || !config.to) {
      return reply.status(400).send({ error: "type, from, to are required" });
    }

    const report = await generateReport(tenantSlug, {
      type: config.type as any,
      dateRange: { from: config.from, to: config.to },
      groupBy: config.groupBy as any,
      format: config.format as any,
    });

    reply.send(report);
  });

  // ── POST /analytics/report/csv — Export CSV ──
  app.post("/analytics/report/csv", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const config = request.body as {
      type: string;
      from: string;
      to: string;
    };

    if (!config.type || !config.from || !config.to) {
      return reply.status(400).send({ error: "type, from, to are required" });
    }

    const report = await generateReport(tenantSlug, {
      type: config.type as any,
      dateRange: { from: config.from, to: config.to },
    });

    let csv = "";
    if (config.type === "revenue" && report.trend) {
      csv = toCSV(report.trend, ["date", "value"]);
    } else if (config.type === "ots" && report.trend) {
      csv = toCSV(report.trend, ["date", "value"]);
    } else if (config.type === "mechanics" && report.mechanics) {
      csv = toCSV(report.mechanics, ["name", "otCount", "revenue"]);
    } else if (config.type === "status" && report.distribution) {
      csv = toCSV(report.distribution, ["status", "count", "percentage"]);
    } else {
      return reply.status(400).send({ error: "Unsupported report type for CSV" });
    }

    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", `attachment; filename="report-${config.type}.csv"`);
    reply.send(csv);
  });
}
