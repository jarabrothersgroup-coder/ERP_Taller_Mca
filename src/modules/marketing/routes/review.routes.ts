/**
 * Review Routes — Google Reviews monitoring endpoints.
 *
 * Endpoints:
 *   GET    /marketing/reviews          — List reviews
 *   GET    /marketing/reviews/stats    — Review statistics
 *   POST   /marketing/reviews/:id/respond — Answer a review publicly
 *   DELETE /marketing/reviews/:id/respond — Delete the published response
 *
 * @module marketing/routes/review.routes.ts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireManager } from "../../../shared/middleware/rbac.js";
import { resolveAuditActor, isRealActor } from "../../../shared/audit/audit-context.js";
import {
  getReviews,
  getReviewStats,
  removeResponse,
  respondToReview,
} from "../services/google-reviews.service.js";

interface IdParams {
  id: string;
}

interface RespondBody {
  respuesta: string;
}

export async function reviewRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /marketing/reviews — List reviews ──
  app.get<{ Querystring: { limit?: string; pendientes?: string } }>(
    "/marketing/reviews",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 200 },
            pendientes: { type: "string", enum: ["true", "false"] },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { limit?: number; pendientes?: string };
      const result = await getReviews(
        request.tenantSlug,
        query.limit ?? 20,
        query.pendientes === "true",
      );
      return reply.send(result);
    },
  );

  // ── GET /marketing/reviews/stats — Review statistics ──
  app.get(
    "/marketing/reviews/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await getReviewStats(request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── POST /marketing/reviews/:id/respond — Answer a review ──
  app.post<{ Params: IdParams; Body: RespondBody }>(
    "/marketing/reviews/:id/respond",
    {
      preHandler: requireManager,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["respuesta"],
          properties: { respuesta: { type: "string", minLength: 1, maxLength: 3000 } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: IdParams; Body: RespondBody }>, reply: FastifyReply) => {
      const actor = resolveAuditActor();
      const result = await respondToReview(
        request.params.id,
        request.body.respuesta,
        request.tenantSlug,
        isRealActor(actor.usuarioId) ? actor.usuarioId : null,
      );
      return reply.status(result.primeraRespuesta ? 201 : 200).send(result);
    },
  );

  // ── DELETE /marketing/reviews/:id/respond — Delete the response ──
  app.delete<{ Params: IdParams }>(
    "/marketing/reviews/:id/respond",
    {
      preHandler: requireManager,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const result = await removeResponse(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );
}
