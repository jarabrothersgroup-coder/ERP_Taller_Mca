/**
 * Export Routes — CSV download endpoints.
 *
 * GET /export/:table — Download CSV for a given table
 * GET /export        — List available export tables
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
    return reply.send({ tables });
  });

  // ── GET /export/:table — Download CSV ──
  app.get<{ Params: { table: string } }>(
    "/export/:table",
    async (request: FastifyRequest<{ Params: { table: string } }>, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { table } = request.params;

      try {
        const { csv, filename, contentType } = await exportTableCsv(table, tenantSlug);
        return reply
          .header("Content-Type", contentType)
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .send(csv);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );
}
