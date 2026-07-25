/**
 * Inventory Report Routes — PDF reports for stock, movements, valuation.
 *
 * Endpoints:
 *   GET /inventory/reports/stock      — Stock summary PDF
 *   GET /inventory/reports/movements  — Stock movements PDF
 *   GET /inventory/reports/valuation  — Inventory valuation PDF
 *
 * @module inventory/routes/inventory-reports
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  generateStockReport,
  generateMovementsReport,
  generateValuationReport,
} from "../services/inventory-report.service.js";

export async function inventoryReportRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /inventory/reports/stock — Stock summary PDF ──
  app.get(
    "/inventory/reports/stock",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = request.tenantSlug;
      const pdf = await generateStockReport(tenantSlug);
      const date = new Date().toISOString().slice(0, 10);

      return reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="reporte-stock-${date}.pdf"`,
        )
        .send(pdf);
    },
  );

  // ── GET /inventory/reports/movements — Movements PDF ──
  app.get<{ Querystring: { from?: string; to?: string } }>(
    "/inventory/reports/movements",
    async (
      request: FastifyRequest<{ Querystring: { from?: string; to?: string } }>,
      reply: FastifyReply,
    ) => {
      const tenantSlug = request.tenantSlug;
      const { from, to } = request.query;
      const pdf = await generateMovementsReport(tenantSlug, { from, to });
      const date = new Date().toISOString().slice(0, 10);

      return reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="reporte-movimientos-${date}.pdf"`,
        )
        .send(pdf);
    },
  );

  // ── GET /inventory/reports/valuation — Valuation PDF ──
  app.get(
    "/inventory/reports/valuation",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = request.tenantSlug;
      const pdf = await generateValuationReport(tenantSlug);
      const date = new Date().toISOString().slice(0, 10);

      return reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="reporte-valorizacion-${date}.pdf"`,
        )
        .send(pdf);
    },
  );
}
