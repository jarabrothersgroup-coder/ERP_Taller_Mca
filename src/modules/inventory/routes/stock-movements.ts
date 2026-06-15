/**
 * Stock Movements routes — inventory transaction audit trail.
 *
 * Endpoints:
 *   GET /inventory/stock-movements — List movements with optional filters
 *
 * All routes require `X-Tenant-Slug` header (resolved by tenant-resolver).
 *
 * @module inventory/routes/stock-movements
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { listStockMovements } from "../services/stock.service.js";

// ─── Query Types ──────────────────────────────

interface StockMovementsQuery {
  repuestoId?: string;
  tipo?: string;
  ordenTrabajoId?: string;
  page?: string;
  limit?: string;
}

// ─── Routes ───────────────────────────────────

/**
 * Registers the stock movements routes on the Fastify instance.
 *
 * @param app - Fastify instance
 */
export async function stockMovementsRoutes(
  app: FastifyInstance,
): Promise<void> {
  // ── GET /inventory/stock-movements — List movements ──
  app.get<{ Querystring: StockMovementsQuery }>(
    "/inventory/stock-movements",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            repuestoId: { type: "string", format: "uuid" },
            tipo: {
              type: "string",
              enum: ["ENTRADA", "SALIDA", "AJUSTE", "TRANSFERENCIA"],
            },
            ordenTrabajoId: { type: "string", format: "uuid" },
            page: { type: "string", pattern: "^[1-9]\\d*$" },
            limit: { type: "string", pattern: "^([1-9]|[1-9]\\d|100)$" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              items: { type: "array" },
              total: { type: "integer" },
              page: { type: "integer" },
              limit: { type: "integer" },
              totalPages: { type: "integer" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: StockMovementsQuery }>,
      reply: FastifyReply,
    ) => {
      const { repuestoId, tipo, ordenTrabajoId, page, limit } =
        request.query;
      const result = await listStockMovements({
        repuestoId,
        tipo,
        ordenTrabajoId,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
      });
      return reply.send(result);
    },
  );
}
