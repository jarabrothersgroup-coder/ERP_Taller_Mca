/**
 * Sync plugin — offline-first batch sync endpoint.
 *
 * Provides REST endpoints for client-side offline queues to flush
 * their pending operations when connectivity is restored.
 *
 * @module plugins/sync
 */

import type { FastifyInstance } from "fastify";
import { processSyncQueue, getSyncConfig, type SyncOperation } from "../shared/offline/sync-service.js";
import { resolveTenant } from "../shared/middleware/tenant-resolver.js";

/**
 * Registers sync-related routes on the Fastify instance.
 *
 * @param app - Fastify instance
 */
export async function syncPlugin(app: FastifyInstance): Promise<void> {
  // All sync routes require tenant context
  app.addHook("onRequest", resolveTenant);

  /**
   * POST /sync — Submit a batch of offline operations.
   * Body: { operations: SyncOperation[] }
   */
  app.post("/sync", async (request, reply) => {
    const { operations } = request.body as { operations: SyncOperation[] };

    if (!Array.isArray(operations) || operations.length === 0) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "operations must be a non-empty array",
      });
    }

    if (operations.length > 50) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Max 50 operations per batch",
      });
    }

    const results = await processSyncQueue(operations);
    reply.status(200).send({ results });
  });

  /**
   * GET /sync/config — Returns the sync configuration for client tuning.
   */
  app.get("/sync/config", async (_request, reply) => {
    reply.status(200).send(getSyncConfig());
  });
}
