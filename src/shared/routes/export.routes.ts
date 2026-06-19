/**
 * Export Routes — CSV download endpoints.
 *
 * GET /export/:table            — Download CSV for a given table
 * GET /export/:table?from=...&to=...  — Download CSV with date range filter
 * GET /export                   — List available export tables
 *
 * @module shared/routes/export.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { exportTableCsv, getExportableTables } from "../services/csv-export.service.js";

/**
 * Register export routes.
 */
export async function exportRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /export — List available tables ──
  app.get("/export", async (_request: FastifyRequest, reply: FastifyReply) => {
    const tables = getExportableTables();
    return reply.send({ tables, dateFilter: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" } });
  });

  // ── GET /export/:table — Download CSV (with optional date range) ──
  app.get<{ Params: { table: string }; Querystring: { from?: string; to?: string } }>(
    "/export/:table",
    async (request: FastifyRequest<{ Params: { table: string }; Querystring: { from?: string; to?: string } }>, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { table } = request.params;
      const { from, to } = request.query;

      try {
        const dateRange = from || to ? { from, to } : undefined;
        const { csv, filename, contentType, rowCount } = await exportTableCsv(table, tenantSlug, dateRange);
        return reply
          .header("Content-Type", contentType)
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .header("X-Export-Row-Count", String(rowCount))
          .send(csv);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );
}
