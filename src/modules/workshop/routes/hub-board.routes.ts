/**
 * Hub Board Routes — aggregated Operations Hub payload + SSE stream.
 *
 * Routes:
 *   GET /workshop/hub/board        — open OTs + technicians (single request)
 *   GET /workshop/hub/board/stream — SSE pings when the board changes
 *
 * The SSE stream intentionally carries no payloads: it emits lightweight
 * `board_changed` events and clients refetch the board (keeps tenant
 * isolation in the request path, works with JWT headers via fetch-based
 * reconnect).
 *
 * @module workshop/routes/hub-board.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  getHubBoard,
  registerBoardSseClient,
} from "../services/hub-board.service.js";

/** How long the stream stays open before the client must reconnect (ms). */
const STREAM_MAX_AGE_MS = 5 * 60_000;

export async function hubBoardRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /workshop/hub/board — aggregated board payload ──
  app.get<{ Querystring: { limit?: string } }>(
    "/workshop/hub/board",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply,
    ) => {
      const limit = request.query.limit
        ? Math.min(Math.max(parseInt(request.query.limit, 10) || 100, 1), 200)
        : undefined;
      const payload = await getHubBoard(request.tenantSlug, limit);
      return reply.send(payload);
    },
  );

  // ── GET /workshop/hub/board/stream — SSE board-change pings ──
  app.get("/workshop/hub/board/stream", { config: { reserveDb: false } }, async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const tenantSlug = request.tenantSlug;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "Tenant requerido" });
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    });
    reply.raw.write(
      `data: ${JSON.stringify({ type: "connected", tenant: tenantSlug })}\n\n`,
    );

    const cleanup = registerBoardSseClient(tenantSlug, reply, () => {
      app.log.debug({ tenant: tenantSlug }, "Hub board SSE client disconnected");
    });

    // Hard stream age cap: clients auto-reconnect (EventSource default or
    // manual retry), which rotates connections and frees server resources.
    const maxAge = setTimeout(() => {
      cleanup();
      try {
        reply.raw.end();
      } catch {
        // already closed
      }
    }, STREAM_MAX_AGE_MS);

    request.raw.on("close", () => {
      clearTimeout(maxAge);
      cleanup();
    });
  });

  app.log.info("Hub board routes registered (/workshop/hub/board, /stream)");
}
