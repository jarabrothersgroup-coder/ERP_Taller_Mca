/**
 * CRM Routes — Twenty CRM integration endpoints.
 *
 * Endpoints:
 *   POST /crm/sync/:ordenId     — Sync finalized order to Twenty CRM
 *   GET  /crm/status            — CRM connection status
 *   GET  /crm/stats             — Sync statistics
 *   POST /crm/retry             — Retry failed syncs
 *
 * All routes require `X-Tenant-Slug` header.
 *
 * @module crm/routes/crm.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  syncOrderToCrm,
  retryFailedSyncs,
  getSyncStats,
} from "../services/crm-sync.worker.js";
import { testConnection } from "../services/twenty-crm.service.js";

// ─── Route registration ────────────────────────────────

export async function crmRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /crm/sync/:ordenId — Sync order to Twenty CRM ──
  app.post<{ Params: { ordenId: string } }>(
    "/crm/sync/:ordenId",
    {
      schema: {
        params: {
          type: "object",
          required: ["ordenId"],
          properties: {
            ordenId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { ordenId: string } }>,
      reply: FastifyReply,
    ) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const userEmail = (request as any).userEmail as string || "system";
      const { ordenId } = request.params;

      try {
        const result = await syncOrderToCrm(ordenId, tenantSlug, userEmail);

        if (!result.success) {
          return reply.status(500).send({
            error: "CrmSyncError",
            message: result.error,
            details: {
              ordenId,
              durationMs: result.durationMs,
            },
          });
        }

        return reply.status(201).send({
          success: true,
          operation: result.operation,
          contactId: result.contactId,
          durationMs: result.durationMs,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error sincronizando";
        return reply.status(500).send({
          error: "CrmSyncError",
          message: msg,
        });
      }
    },
  );

  // ── GET /crm/status — Test CRM connection ──
  app.get(
    "/crm/status",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const status = await testConnection();
        return reply.send(status);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error verificando conexión";
        return reply.status(500).send({
          connected: false,
          message: msg,
        });
      }
    },
  );

  // ── GET /crm/stats — Get sync statistics ──
  app.get(
    "/crm/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;

      try {
        const stats = await getSyncStats(tenantSlug);
        return reply.send(stats);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error obteniendo estadísticas";
        return reply.status(500).send({ error: "CrmStatsError", message: msg });
      }
    },
  );

  // ── POST /crm/retry — Retry failed syncs ──
  app.post(
    "/crm/retry",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;

      try {
        const result = await retryFailedSyncs(tenantSlug);
        return reply.send({
          success: true,
          retried: result.retried,
          succeeded: result.succeeded,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error reintentando";
        return reply.status(500).send({ error: "CrmRetryError", message: msg });
      }
    },
  );
}
