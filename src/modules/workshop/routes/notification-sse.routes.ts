/**
 * Notification SSE Routes — Server-Sent Events for real-time notifications.
 *
 * SSE is a simpler, HTTP-native alternative to WebSocket for clients
 * that don't support WS (e.g., some mobile browsers, corporate proxies).
 *
 * Routes:
 *   GET  /api/notifications/stream   — SSE stream (EventSource client)
 *   GET  /api/notifications/poll     — Long-poll fallback (30s timeout)
 *
 * @module workshop/routes/notification-sse.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
// pushNotification from gateway is used indirectly via registerNotificationWS

/** SSE client connections per tenant */
const sseClients: Map<string, Set<FastifyReply>> = new Map();

/** Register SSE notification routes */
export async function notificationSseRoutes(app: FastifyInstance): Promise<void> {
  const prefix = "/api/notifications";

  /**
   * GET /api/notifications/stream — SSE stream
   *
   * The client opens an EventSource to this endpoint and receives
   * real-time notifications as they arrive.
   *
   * Query params:
   *   tenant — tenant slug (required)
   *   user   — user email (optional, for targeted notifications)
   */
  app.get(`${prefix}/stream`, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = (request.query as any).tenant ||
      (request as any).tenantSlug || "";

    if (!tenantSlug) {
      return reply.status(400).send({ error: "Missing 'tenant' query parameter" });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    });

    // Send initial connected event
    reply.raw.write(
      `data: ${JSON.stringify({ type: "connected", tenant: tenantSlug, timestamp: new Date().toISOString() })}\n\n`
    );

    // Register client
    if (!sseClients.has(tenantSlug)) {
      sseClients.set(tenantSlug, new Set());
    }
    sseClients.get(tenantSlug)!.add(reply);

    // Heartbeat every 30s to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        reply.raw.write(`:heartbeat ${Date.now()}\n\n`);
      } catch {
        // Client disconnected
        clearInterval(heartbeatInterval);
        sseClients.get(tenantSlug)?.delete(reply);
      }
    }, 30_000);

    // Cleanup on client disconnect
    request.raw.on("close", () => {
      clearInterval(heartbeatInterval);
      sseClients.get(tenantSlug)?.delete(reply);
      if (sseClients.get(tenantSlug)!.size === 0) {
        sseClients.delete(tenantSlug);
      }
      app.log.debug({ tenant: tenantSlug }, "SSE client disconnected");
    });
  });

  /**
   * GET /api/notifications/poll — Long-poll fallback
   *
   * Waits up to 30 seconds for new notifications.
   * Returns immediately if there are pending notifications.
   */
  app.get(`${prefix}/poll`, async (request: FastifyRequest, _reply: FastifyReply) => {
    const tenantSlug = (request as any).tenantSlug || "";

    // Return current count as a quick check
    const { getUnreadCount } = await import("../services/notification-push.service.js");
    const count = await getUnreadCount(tenantSlug);

    return {
      unreadCount: count,
      timestamp: new Date().toISOString(),
      message: count > 0 ? "New notifications available" : "No new notifications",
    };
  });

  // Register WebSocket gateway for WS-capable clients
  const { registerNotificationWS } = await import("../ws/notification-gateway.js");
  await registerNotificationWS(app);

  app.log.info("Notification SSE routes registered (/api/notifications/stream, /poll, /ws)");
}

/**
 * Push notification via SSE to all connected clients of a tenant.
 * Called by the notification-push service after DB insert.
 */
export function pushSseNotification(
  tenantSlug: string,
  notification: Record<string, any>,
): number {
  const clients = sseClients.get(tenantSlug);
  if (!clients || clients.size === 0) return 0;

  const payload = JSON.stringify({
    type: "notification",
    data: notification,
    timestamp: new Date().toISOString(),
  });

  let sent = 0;
  for (const client of clients) {
    try {
      client.raw.write(`data: ${payload}\n\n`);
      sent++;
    } catch {
      // Client disconnected
      clients.delete(client);
    }
  }

  return sent;
}

/**
 * Get SSE client count for a tenant.
 */
export function getSseClientCount(tenantSlug: string): number {
  return sseClients.get(tenantSlug)?.size || 0;
}

/**
 * Get total SSE clients across all tenants.
 */
export function getTotalSseClients(): number {
  let total = 0;
  for (const clients of sseClients.values()) {
    total += clients.size;
  }
  return total;
}
