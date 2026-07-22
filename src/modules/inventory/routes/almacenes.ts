/**
 * Almacenes Routes — Multi-warehouse API endpoints.
 *
 * Sprint 84 — P0-3.
 *
 * @module inventory/routes/almacenes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { listAlmacenes, getAlmacen, createAlmacen, updateAlmacen, deleteAlmacen, realizarTransferencia } from "../services/almacen.service.js";

export async function almacenRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /inventory/almacenes — List warehouses ──
  app.get("/inventory/almacenes", async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await listAlmacenes(request.tenantSlug);
    return reply.send(result);
  });

  // ── GET /inventory/almacenes/:id — Get warehouse ──
  app.get<{ Params: { id: string } }>(
    "/inventory/almacenes/:id",
    async (request, reply) => {
      const result = await getAlmacen(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── POST /inventory/almacenes — Create warehouse ──
  app.post<{ Body: { codigo: string; nombre: string; direccion?: string; responsable?: string; telefono?: string } }>(
    "/inventory/almacenes",
    async (request, reply) => {
      const result = await createAlmacen(request.body, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── PATCH /inventory/almacenes/:id — Update warehouse ──
  app.patch<{ Params: { id: string }; Body: Record<string, any> }>(
    "/inventory/almacenes/:id",
    async (request, reply) => {
      const result = await updateAlmacen(request.params.id, request.body, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── DELETE /inventory/almacenes/:id — Deactivate warehouse ──
  app.delete<{ Params: { id: string } }>(
    "/inventory/almacenes/:id",
    async (request, reply) => {
      const result = await deleteAlmacen(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── POST /inventory/almacenes/transferir — Transfer stock between warehouses ──
  app.post<{ Body: { repuestoId: string; cantidad: number; almacenDestinoId: string; almacenOrigenId?: string; ordenTrabajoId?: string; motivo?: string } }>(
    "/inventory/almacenes/transferir",
    async (request, reply) => {
      const result = await realizarTransferencia(request.body, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );
}
