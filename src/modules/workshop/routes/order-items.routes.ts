/**
 * Order Items Routes — CRUD endpoints for orden_servicios and orden_repuestos.
 *
 * Services:
 *   POST   /workshop/ordenes/:id/servicios   — Assign catalog service to order
 *   GET    /workshop/ordenes/:id/servicios   — List service items on order
 *   PATCH  /workshop/ordenes/:id/servicios/:itemId — Update service item
 *   DELETE /workshop/ordenes/:id/servicios/:itemId — Remove service item
 *
 * Parts:
 *   POST   /workshop/ordenes/:id/repuestos   — Add spare part to order
 *   GET    /workshop/ordenes/:id/repuestos   — List part items on order
 *   PATCH  /workshop/ordenes/:id/repuestos/:itemId — Update part item
 *   DELETE /workshop/ordenes/:id/repuestos/:itemId — Remove part item
 *
 * All routes require X-Tenant-Slug header (resolved by tenant-resolver).
 *
 * @module workshop/routes/order-items
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createOrdenServicio,
  updateOrdenServicio,
  deleteOrdenServicio,
  listOrdenServicios,
  createOrdenRepuesto,
  updateOrdenRepuesto,
  deleteOrdenRepuesto,
  listOrdenRepuestos,
} from "../services/order-items.service.js";

// ─── Types ──────────────────────────────────────

interface OrdenParams {
  id: string;
}

interface ItemParams {
  id: string; // orden id
  itemId: string;
}

interface CreateServicioBody {
  servicioId: string;
  cantidad?: number;
}

interface UpdateServicioBody {
  cantidad?: number;
}

interface CreateRepuestoBody {
  repuestoId?: string;
  repuestoNombre: string;
  codigo?: string;
  cantidad?: number;
  precioUnitario: number;
}

interface UpdateRepuestoBody {
  cantidad?: number;
  precioUnitario?: number;
}

// ─── Response schema props ──────────────────────

const SERVICIO_ITEM_RESPONSE_PROPS = {
  id: { type: "string" },
  ordenTrabajoId: { type: "string" },
  servicioId: { type: "string" },
  servicioNombre: { type: "string" },
  cantidad: { type: "integer" },
  precioUnitario: { type: "string" },
  subtotal: { type: "string" },
  tenantSlug: { type: "string" },
  createdAt: { type: "string" },
};

const REPUESTO_ITEM_RESPONSE_PROPS = {
  id: { type: "string" },
  ordenTrabajoId: { type: "string" },
  repuestoId: { type: "string", nullable: true },
  repuestoNombre: { type: "string" },
  codigo: { type: "string", nullable: true },
  cantidad: { type: "integer" },
  precioUnitario: { type: "string" },
  subtotal: { type: "string" },
  tenantSlug: { type: "string" },
  createdAt: { type: "string" },
};

// ─── Routes ─────────────────────────────────────

export async function orderItemsRoutes(app: FastifyInstance): Promise<void> {
  // ══════════════════════════════════════════════
  //  SERVICIOS
  // ══════════════════════════════════════════════

  // ── POST /workshop/ordenes/:id/servicios ──
  app.post<{ Params: OrdenParams; Body: CreateServicioBody }>(
    "/workshop/ordenes/:id/servicios",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["servicioId"],
          properties: {
            servicioId: { type: "string", format: "uuid" },
            cantidad: { type: "integer", minimum: 1 },
          },
        },
        response: { 201: { type: "object", properties: SERVICIO_ITEM_RESPONSE_PROPS } },
      },
    },
    async (request: FastifyRequest<{ Params: OrdenParams; Body: CreateServicioBody }>, reply: FastifyReply) => {
      const item = await createOrdenServicio({
        ordenTrabajoId: request.params.id,
        servicioId: request.body.servicioId,
        cantidad: request.body.cantidad,
        tenantSlug: request.tenantSlug,
      });
      return reply.status(201).send(item);
    },
  );

  // ── GET /workshop/ordenes/:id/servicios ──
  app.get<{ Params: OrdenParams }>(
    "/workshop/ordenes/:id/servicios",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: {
            type: "array",
            items: { type: "object", properties: SERVICIO_ITEM_RESPONSE_PROPS },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: OrdenParams }>, reply: FastifyReply) => {
      const items = await listOrdenServicios(request.params.id);
      return reply.send(items);
    },
  );

  // ── PATCH /workshop/ordenes/:id/servicios/:itemId ──
  app.patch<{ Params: ItemParams; Body: UpdateServicioBody }>(
    "/workshop/ordenes/:id/servicios/:itemId",
    {
      schema: {
        params: {
          type: "object",
          required: ["id", "itemId"],
          properties: {
            id: { type: "string", format: "uuid" },
            itemId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            cantidad: { type: "integer", minimum: 1 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ItemParams; Body: UpdateServicioBody }>, reply: FastifyReply) => {
      const item = await updateOrdenServicio(
        request.params.itemId,
        { cantidad: request.body.cantidad },
        request.tenantSlug,
      );
      return reply.send(item);
    },
  );

  // ── DELETE /workshop/ordenes/:id/servicios/:itemId ──
  app.delete<{ Params: ItemParams }>(
    "/workshop/ordenes/:id/servicios/:itemId",
    {
      schema: {
        params: {
          type: "object",
          required: ["id", "itemId"],
          properties: {
            id: { type: "string", format: "uuid" },
            itemId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ItemParams }>, reply: FastifyReply) => {
      const result = await deleteOrdenServicio(request.params.itemId, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ══════════════════════════════════════════════
  //  REPUESTOS
  // ══════════════════════════════════════════════

  // ── POST /workshop/ordenes/:id/repuestos ──
  app.post<{ Params: OrdenParams; Body: CreateRepuestoBody }>(
    "/workshop/ordenes/:id/repuestos",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["repuestoNombre", "precioUnitario"],
          properties: {
            repuestoId: { type: "string", format: "uuid" },
            repuestoNombre: { type: "string", minLength: 1 },
            codigo: { type: "string" },
            cantidad: { type: "integer", minimum: 1 },
            precioUnitario: { type: "number", minimum: 0 },
          },
        },
        response: { 201: { type: "object", properties: REPUESTO_ITEM_RESPONSE_PROPS } },
      },
    },
    async (request: FastifyRequest<{ Params: OrdenParams; Body: CreateRepuestoBody }>, reply: FastifyReply) => {
      const item = await createOrdenRepuesto({
        ordenTrabajoId: request.params.id,
        repuestoId: request.body.repuestoId,
        repuestoNombre: request.body.repuestoNombre,
        codigo: request.body.codigo,
        cantidad: request.body.cantidad,
        precioUnitario: request.body.precioUnitario,
        tenantSlug: request.tenantSlug,
      });
      return reply.status(201).send(item);
    },
  );

  // ── GET /workshop/ordenes/:id/repuestos ──
  app.get<{ Params: OrdenParams }>(
    "/workshop/ordenes/:id/repuestos",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: {
            type: "array",
            items: { type: "object", properties: REPUESTO_ITEM_RESPONSE_PROPS },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: OrdenParams }>, reply: FastifyReply) => {
      const items = await listOrdenRepuestos(request.params.id);
      return reply.send(items);
    },
  );

  // ── PATCH /workshop/ordenes/:id/repuestos/:itemId ──
  app.patch<{ Params: ItemParams; Body: UpdateRepuestoBody }>(
    "/workshop/ordenes/:id/repuestos/:itemId",
    {
      schema: {
        params: {
          type: "object",
          required: ["id", "itemId"],
          properties: {
            id: { type: "string", format: "uuid" },
            itemId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            cantidad: { type: "integer", minimum: 1 },
            precioUnitario: { type: "number", minimum: 0 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ItemParams; Body: UpdateRepuestoBody }>, reply: FastifyReply) => {
      const item = await updateOrdenRepuesto(
        request.params.itemId,
        { cantidad: request.body.cantidad, precioUnitario: request.body.precioUnitario },
        request.tenantSlug,
      );
      return reply.send(item);
    },
  );

  // ── DELETE /workshop/ordenes/:id/repuestos/:itemId ──
  app.delete<{ Params: ItemParams }>(
    "/workshop/ordenes/:id/repuestos/:itemId",
    {
      schema: {
        params: {
          type: "object",
          required: ["id", "itemId"],
          properties: {
            id: { type: "string", format: "uuid" },
            itemId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ItemParams }>, reply: FastifyReply) => {
      const result = await deleteOrdenRepuesto(request.params.itemId, request.tenantSlug);
      return reply.send(result);
    },
  );
}
