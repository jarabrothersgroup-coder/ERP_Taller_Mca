/**
 * Review Routes — Google Reviews monitoring endpoints.
 *
 * Endpoints:
 *   GET  /marketing/reviews       — List reviews
 *   GET  /marketing/reviews/stats — Review statistics
 *
 * @module marketing/routes/review.routes.ts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getReviews, getReviewStats } from "../services/google-reviews.service.js";

export async function reviewRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /marketing/reviews — List reviews ──
  app.get<{ Querystring: { limit?: string } }>(
    "/marketing/reviews",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const result = await getReviews(request.tenantSlug, limit);
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
}
