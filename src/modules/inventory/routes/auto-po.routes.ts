/**
 * Auto PO Routes — Automatic purchase order generation endpoints.
 *
 * Endpoints:
 *   POST /inventory/auto-po/generate — Generate POs from reorder alerts
 *   GET  /inventory/auto-po/pending  — List pending reorder alerts
 *
 * @module inventory/routes/auto-po.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { generateAutoPOs } from "../services/auto-po.service.js";
import { db } from "../../../shared/database/drizzle.js";
import { reorderAlerts, repuestos } from "../schema/index.js";
import { eq, and } from "drizzle-orm";

export async function autoPORoutes(app: FastifyInstance): Promise<void> {
  // ── POST /inventory/auto-po/generate — Generate POs ──
  app.post(
    "/inventory/auto-po/generate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const results = await generateAutoPOs(tenantSlug);
      return reply.send({
        generated: results.length,
        orders: results,
      });
    },
  );

  // ── GET /inventory/auto-po/pending — List pending alerts ──
  app.get(
    "/inventory/auto-po/pending",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;

      const pending = await db()
        .select({
          id: reorderAlerts.id,
          repuestoId: reorderAlerts.repuestoId,
          stockActual: reorderAlerts.stockActual,
          puntoReorden: reorderAlerts.puntoReorden,
          codigo: repuestos.codigo,
          descripcion: repuestos.descripcion,
          proveedor: repuestos.proveedor,
          costoPromedio: repuestos.costoPromedio,
          createdAt: reorderAlerts.createdAt,
        })
        .from(reorderAlerts)
        .innerJoin(repuestos, eq(reorderAlerts.repuestoId, repuestos.id))
        .where(
          and(
            eq(reorderAlerts.estado, "PENDIENTE"),
            eq(reorderAlerts.tenantSlug, tenantSlug),
          ),
        );

      return reply.send({
        total: pending.length,
        items: pending,
      });
    },
  );
}
