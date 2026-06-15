/**
 * Notifications Routes — in-app alerts.
 *
 * GET    /api/notifications         — list notifications (paginated)
 * GET    /api/notifications/count   — unread count (badge)
 * PATCH  /api/notifications/:id/read — mark as read
 * POST   /api/notifications/read-all — mark all as read
 *
 * @module workshop/routes/notifications
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listarNotificaciones,
  contarNoLeidas,
  marcarLeido,
  marcarTodoLeido,
  verificarStockBajo,
  verificarCxCVencidas,
} from "../services/notifications.service.js";

export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  const prefix = "/api/notifications";

  // ── GET /api/notifications ──────────────────────
  app.get(
    `${prefix}`,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenant = request.tenantSlug;
      const { leido, tipo, limit, offset } = request.query as {
        leido?: string;
        tipo?: string;
        limit?: string;
        offset?: string;
      };

      const result = await listarNotificaciones(tenant, {
        leido: leido !== undefined ? leido === "true" : undefined,
        tipo,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });

      return reply.send(result);
    },
  );

  // ── GET /api/notifications/count ────────────────
  app.get(
    `${prefix}/count`,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenant = request.tenantSlug;
      const count = await contarNoLeidas(tenant);
      return reply.send({ count });
    },
  );

  // ── PATCH /api/notifications/:id/read ──────────
  app.patch(
    `${prefix}/:id/read`,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const updated = await marcarLeido(id);
      if (!updated) {
        return reply.code(404).send({ error: "Notificación no encontrada" });
      }
      return reply.send(updated);
    },
  );

  // ── POST /api/notifications/read-all ───────────
  app.post(
    `${prefix}/read-all`,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenant = request.tenantSlug;
      await marcarTodoLeido(tenant);
      return reply.send({ ok: true });
    },
  );

  // ── POST /api/notifications/check ──────────────
  // Triggers background checks (stock bajo, CxC vencidas)
  app.post(
    `${prefix}/check`,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenant = request.tenantSlug;
      const [stockAlerts, cxcAlerts] = await Promise.all([
        verificarStockBajo(tenant),
        verificarCxCVencidas(tenant),
      ]);
      return reply.send({
        ok: true,
        stockAlerts,
        cxcAlerts,
      });
    },
  );

  app.log.info("Notifications routes registered");
}
