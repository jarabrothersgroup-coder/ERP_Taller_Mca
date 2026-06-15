/**
 * Global Search Routes — Cross-entity search endpoint.
 *
 * Single endpoint that searches across vehicles, clients, and work orders.
 *
 * @module shared/routes/search.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { globalSearch, type SearchResponse } from "../services/search.service.js";

/**
 * Register global search routes.
 *
 * Routes:
 *   - GET /search?q=&limit=10
 */
export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/search",
    async (
      request: FastifyRequest<{ Querystring: { q?: string; limit?: string } }>,
      _reply: FastifyReply,
    ): Promise<SearchResponse> => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { q, limit: limitStr } = request.query;

      if (!q || q.trim().length === 0) {
        return { results: [], total: 0 };
      }

      const limit = Math.min(parseInt(limitStr || "5", 10) || 5, 20);

      const results = await globalSearch(tenantSlug, q.trim(), limit);
      return results;
    },
  );
}
