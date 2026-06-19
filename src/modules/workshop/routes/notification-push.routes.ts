/**
 * Enhanced Notification Routes — CRUD + WebSocket status + real-time push.
 *
 * Routes:
 *   GET    /api/notifications              — List notifications
 *   GET    /api/notifications/count        — Unread count
 *   PATCH  /api/notifications/:id/read     — Mark as read
 *   POST   /api/notifications/read-all     — Mark all as read
 *   GET    /api/notifications/ws/status    — WebSocket connection status
 *
 * @module workshop/routes/notification-push.routes
 */

import type { FastifyInstance } from "fastify";
import {
  crearNotificacionPush,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "../services/notification-push.service.js";
import { getConnectionCount } from "../ws/notification-gateway.js";

export async function notificationPushRoutes(app: FastifyInstance): Promise<void> {
  const prefix = "/api/notifications";

  // ── GET /api/notifications — List ──
  app.get(prefix, async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { leido, tipo, limit, offset } = request.query as {
      leido?: string;
      tipo?: string;
      limit?: string;
      offset?: string;
    };

    const notifications = await listNotifications(tenantSlug, {
      leido: leido !== undefined ? leido === "true" : undefined,
      tipo,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    reply.send(notifications);
  });

  // ── GET /api/notifications/count — Unread count ──
  app.get(`${prefix}/count`, async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const count = await getUnreadCount(tenantSlug);
    reply.send({ count });
  });

  // ── PATCH /api/notifications/:id/read — Mark read ──
  app.patch(`${prefix}/:id/read`, async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { id } = request.params as { id: string };
    const updated = await markAsRead(id, tenantSlug);
    if (!updated) return reply.status(404).send({ error: "Not found" });
    reply.send(updated);
  });

  // ── POST /api/notifications/read-all — Mark all read ──
  app.post(`${prefix}/read-all`, async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    await markAllAsRead(tenantSlug);
    reply.send({ ok: true });
  });

  // ── GET /api/notifications/ws/status — WS status ──
  app.get(`${prefix}/ws/status`, async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const connected = getConnectionCount(tenantSlug);
    reply.send({ connected, timestamp: new Date().toISOString() });
  });

  // ── POST /api/notifications — Create + push ──
  app.post(prefix, async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const body = request.body as {
      tipo: string;
      titulo: string;
      mensaje: string;
      priority?: string;
      entityType?: string;
      entityId?: string;
      targetUser?: string;
      actionUrl?: string;
    };

    if (!body.tipo || !body.titulo || !body.mensaje) {
      return reply.status(400).send({ error: "tipo, titulo, mensaje are required" });
    }

    const notif = await crearNotificacionPush({
      tenantSlug,
      ...body,
      priority: body.priority as any,
    });

    reply.status(201).send(notif);
  });
}
