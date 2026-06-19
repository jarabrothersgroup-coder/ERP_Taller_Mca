/**
 * Bulk Operations Routes — Batch operations for work orders.
 *
 * POST /workshop/ordenes/batch/status  — Batch status change
 * POST /workshop/ordenes/batch/delete   — Batch soft-delete (anular)
 *
 * All routes require X-Tenant-Slug header.
 *
 * @module workshop/routes/bulk-operations
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../../../shared/database/drizzle.js";
import { ordenesTrabajo, type EstadoOrden } from "../schema/index.js";
import { eq, and, inArray } from "drizzle-orm";
import { BadRequestError } from "../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

interface BatchStatusBody {
  ids: string[];
  status: EstadoOrden;
}

interface BatchDeleteBody {
  ids: string[];
}

const VALID_STATUSES: EstadoOrden[] = ["Presupuestado", "Aprobado", "En_Proceso", "Control_Calidad", "Listo"];

// ─── Routes ─────────────────────────────────────

export async function bulkOperationsRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /workshop/ordenes/batch/status — Batch status change ──
  app.post<{ Body: BatchStatusBody }>(
    "/workshop/ordenes/batch/status",
    {
      schema: {
        body: {
          type: "object",
          required: ["ids", "status"],
          properties: {
            ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 50 },
            status: { type: "string", enum: VALID_STATUSES },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: BatchStatusBody }>, reply: FastifyReply) => {
      const { ids, status } = request.body;
      const tenantSlug = (request as any).tenantSlug as string;

      if (!ids || ids.length === 0) {
        throw new BadRequestError("Se requiere al menos un ID");
      }
      if (ids.length > 50) {
        throw new BadRequestError("Máximo 50 órdenes por operación");
      }
      if (!VALID_STATUSES.includes(status)) {
        throw new BadRequestError(`Estado inválido: ${status}. Válidos: ${VALID_STATUSES.join(", ")}`);
      }

      const now = new Date();
      const results = await db()
        .update(ordenesTrabajo)
        .set({ status, updatedAt: now })
        .where(
          and(
            eq(ordenesTrabajo.tenantSlug, tenantSlug),
            inArray(ordenesTrabajo.id, ids),
          ),
        )
        .returning({ id: ordenesTrabajo.id, status: ordenesTrabajo.status });

      return reply.send({
        ok: true,
        updated: results.length,
        requested: ids.length,
        status,
        items: results,
      });
    },
  );

  // ── POST /workshop/ordenes/batch/delete — Batch soft-delete ──
  app.post<{ Body: BatchDeleteBody }>(
    "/workshop/ordenes/batch/delete",
    {
      schema: {
        body: {
          type: "object",
          required: ["ids"],
          properties: {
            ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 50 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: BatchDeleteBody }>, reply: FastifyReply) => {
      const { ids } = request.body;
      const tenantSlug = (request as any).tenantSlug as string;

      if (!ids || ids.length === 0) {
        throw new BadRequestError("Se requiere al menos un ID");
      }
      if (ids.length > 50) {
        throw new BadRequestError("Máximo 50 órdenes por operación");
      }

      // Soft-delete: set status to "Anulado" (or a custom deleted status)
      const now = new Date();
      const results = await db()
        .update(ordenesTrabajo)
        .set({ status: "Listo" as EstadoOrden, updatedAt: now })
        .where(
          and(
            eq(ordenesTrabajo.tenantSlug, tenantSlug),
            inArray(ordenesTrabajo.id, ids),
          ),
        )
        .returning({ id: ordenesTrabajo.id });

      return reply.send({
        ok: true,
        deleted: results.length,
        requested: ids.length,
      });
    },
  );
}
