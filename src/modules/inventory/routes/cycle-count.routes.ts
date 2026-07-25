/**
 * Cycle Count Routes — REST endpoints for physical inventory counting.
 *
 * Endpoints:
 *   GET    /inventory/cycle-counts           — List cycle counts
 *   POST   /inventory/cycle-counts           — Create cycle count
 *   GET    /inventory/cycle-counts/:id       — Get cycle count detail
 *   POST   /inventory/cycle-counts/:id/start — Start counting (auto-populate)
 *   POST   /inventory/cycle-counts/:id/items — Record an item count
 *   POST   /inventory/cycle-counts/:id/complete — Complete counting
 *   POST   /inventory/cycle-counts/:id/adjust — Apply adjustments
 *   DELETE /inventory/cycle-counts/:id       — Delete (only if ABIERTO)
 *   GET    /inventory/cycle-counts/stats     — Summary stats
 *
 * @module inventory/routes/cycle-count.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listCycleCounts,
  getCycleCountById,
  createCycleCount,
  startCycleCount,
  recordCountItem,
  completeCycleCount,
  applyAdjustments,
  getCycleCountItems,
  deleteCycleCount,
  getCycleCountStats,
} from "../services/cycle-count.service.js";

export async function cycleCountRoutes(app: FastifyInstance): Promise<void> {
  // ── Stats ──
  app.get("/inventory/cycle-counts/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await getCycleCountStats(request.tenantSlug);
    return reply.send(stats);
  });

  // ── List ──
  app.get("/inventory/cycle-counts", async (request: FastifyRequest, reply: FastifyReply) => {
    const counts = await listCycleCounts(request.tenantSlug);
    return reply.send(counts);
  });

  // ── Create ──
  app.post(
    "/inventory/cycle-counts",
    {
      schema: {
        body: {
          type: "object",
          required: ["almacenId"],
          properties: {
            almacenId: { type: "string", format: "uuid" },
            observaciones: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await createCycleCount(request.body as any, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── Get Detail ──
  app.get<{ Params: { id: string } }>(
    "/inventory/cycle-counts/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const [count, items] = await Promise.all([
        getCycleCountById(request.params.id, request.tenantSlug),
        getCycleCountItems(request.params.id, request.tenantSlug),
      ]);
      return reply.send({ ...count, items });
    },
  );

  // ── Start ──
  app.post<{ Params: { id: string }; Body: { autoPopulate?: boolean } }>(
    "/inventory/cycle-counts/:id/start",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            autoPopulate: { type: "boolean" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { autoPopulate?: boolean } }>, reply: FastifyReply) => {
      const result = await startCycleCount(request.params.id, request.tenantSlug, {
        autoPopulate: request.body?.autoPopulate ?? true,
      });
      return reply.send(result);
    },
  );

  // ── Record Item ──
  app.post<{ Params: { id: string }; Body: { itemId: string; stockReal: number; observaciones?: string } }>(
    "/inventory/cycle-counts/:id/items",
    {
      schema: {
        body: {
          type: "object",
          required: ["itemId", "stockReal"],
          properties: {
            itemId: { type: "string", format: "uuid" },
            stockReal: { type: "integer", minimum: 0 },
            observaciones: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { itemId: string; stockReal: number; observaciones?: string } }>, reply: FastifyReply) => {
      const result = await recordCountItem(
        request.params.id,
        request.body.itemId,
        request.body.stockReal,
        request.tenantSlug,
        request.body.observaciones,
      );
      return reply.send(result);
    },
  );

  // ── Complete ──
  app.post<{ Params: { id: string } }>(
    "/inventory/cycle-counts/:id/complete",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const result = await completeCycleCount(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── Adjust ──
  app.post<{ Params: { id: string }; Body: { generateAsiento?: boolean } }>(
    "/inventory/cycle-counts/:id/adjust",
    async (request: FastifyRequest<{ Params: { id: string }; Body: { generateAsiento?: boolean } }>, reply: FastifyReply) => {
      const result = await applyAdjustments(request.params.id, request.tenantSlug, {
        generateAsiento: request.body?.generateAsiento ?? true,
      });
      return reply.send(result);
    },
  );

  // ── Delete ──
  app.delete<{ Params: { id: string } }>(
    "/inventory/cycle-counts/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await deleteCycleCount(request.params.id, request.tenantSlug);
      return reply.status(204).send();
    },
  );
}
