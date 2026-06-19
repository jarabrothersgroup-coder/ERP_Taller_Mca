/**
 * Sync Routes — Offline-first sync endpoint.
 *
 * Endpoints:
 *   POST /sync/push       — Push queued offline operations
 *   GET  /sync/config     — Get sync configuration
 *
 * @module shared/routes/sync.routes.ts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { processSyncQueue, getSyncConfig, type SyncOperation } from "../offline/sync-service.js";

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /sync/push — Push offline operations ──
  app.post<{ Body: { operations: SyncOperation[] } }>(
    "/sync/push",
    {
      schema: {
        body: {
          type: "object",
          required: ["operations"],
          properties: {
            operations: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "tenant", "entity", "action", "payload", "timestamp"],
                properties: {
                  id: { type: "string" },
                  tenant: { type: "string" },
                  entity: { type: "string" },
                  action: { type: "string", enum: ["create", "update", "delete"] },
                  payload: { type: "object" },
                  timestamp: { type: "number" },
                  retryCount: { type: "number", default: 0 },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { operations: SyncOperation[] } }>, reply: FastifyReply) => {
      const { operations } = request.body;

      if (!Array.isArray(operations) || operations.length === 0) {
        return reply.status(400).send({ error: "Se requiere un array de operaciones" });
      }

      // Enforce max batch size
      const config = getSyncConfig();
      const batch = operations.slice(0, config.maxBatchSize);

      const results = await processSyncQueue(batch);

      const applied = results.filter(r => r.status === "applied").length;
      const failed = results.filter(r => r.status === "failed").length;
      const conflicts = results.filter(r => r.status === "conflict").length;

      return reply.send({
        summary: { applied, failed, conflicts, total: results.length },
        results,
      });
    },
  );

  // ── GET /sync/config — Get sync configuration ──
  app.get(
    "/sync/config",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(getSyncConfig());
    },
  );
}
