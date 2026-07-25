/**
 * Orden Estado Historial routes — audit trail for work-order status changes.
 *
 * GET /workshop/ordenes/:id/historial — List status transitions for an OT
 *
 * @module workshop/routes/orden-estado-historial
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../../../shared/database/drizzle.js";
import { ordenEstadoHistorial } from "../schema/index.js";
import { eq, desc } from "drizzle-orm";

interface OrdenParams {
  id: string;
}

export async function ordenEstadoHistorialRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /workshop/ordenes/:id/historial ──
  app.get<{ Params: OrdenParams }>(
    "/workshop/ordenes/:id/historial",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                ordenTrabajoId: { type: "string" },
                estadoAnterior: { type: "string", nullable: true },
                estadoNuevo: { type: "string" },
                usuarioId: { type: "string", nullable: true },
                observaciones: { type: "string", nullable: true },
                createdAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: OrdenParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;

      const rows = await db()
        .select()
        .from(ordenEstadoHistorial)
        .where(eq(ordenEstadoHistorial.ordenTrabajoId, id))
        .orderBy(desc(ordenEstadoHistorial.createdAt));

      return reply.send(
        rows.map((r) => ({
          id: r.id,
          ordenTrabajoId: r.ordenTrabajoId,
          estadoAnterior: r.estadoAnterior,
          estadoNuevo: r.estadoNuevo,
          usuarioId: r.usuarioId,
          observaciones: r.observaciones,
          createdAt: r.createdAt.toISOString(),
        })),
      );
    },
  );
}
