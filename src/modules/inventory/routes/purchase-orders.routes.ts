/**
 * Purchase Order Routes — CRUD manual de Órdenes de Compra (T-44 · INV-03).
 *
 * Endpoints:
 *   GET    /inventory/purchase-orders                  — Listar OC del tenant
 *   POST   /inventory/purchase-orders                  — Crear OC manual (BORRADOR)
 *   GET    /inventory/purchase-orders/:id              — Ver OC con items
 *   PATCH  /inventory/purchase-orders/:id              — Editar OC (no recibida)
 *   POST   /inventory/purchase-orders/:id/receive      — Recepcionar → stock + asiento
 *   POST   /inventory/purchase-orders/:id/cancel       — Cancelar (soft)
 *   DELETE /inventory/purchase-orders/:id              — Borrar (solo BORRADOR)
 *
 * Antes de T-44 sólo existía la generación automática (`auto-po.service`):
 * sin CRUD manual, sin edición y sin recepción. Este router cierra el flujo
 * completo de la UC de compras.
 *
 * Guards de rol (matriz rol×endpoint · T-21c/T-42):
 *   - lectura                      → cualquier autenticado
 *   - crear / editar / recibir     → requireManager
 *   - cancelar / borrar (destructivo) → requireManager
 *
 * Aislamiento multi-tenant: el service filtra por `request.tenantSlug` en
 * TODOS los lookups, incluidos los items y el repuesto; un id de otro tenant
 * responde 404, nunca 403 (no se filtra su existencia).
 *
 * @module inventory/routes/purchase-orders.routes
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireManager } from "../../../shared/middleware/rbac.js";
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrder,
  updatePurchaseOrder,
  type CreatePurchaseOrderManualInput,
  type UpdatePurchaseOrderInput,
} from "../services/purchase-order.service.js";

// ─── Body / Query types ────────────────────────

interface ItemBody {
  repuestoId: string;
  cantidad: number;
  costoUnitario: number;
}

interface CreateBody {
  proveedor: string;
  fechaEsperada?: string | null;
  notas?: string | null;
  estado?: string;
  items: ItemBody[];
}

interface UpdateBody {
  proveedor?: string;
  fechaEsperada?: string | null;
  notas?: string | null;
  estado?: string;
  items?: ItemBody[];
}

interface ReceiveBody {
  items: Array<{ itemId: string; cantidadRecibida: number }>;
}

interface IdParams {
  id: string;
}

interface ListQuery {
  estado?: string;
  proveedor?: string;
  search?: string;
}

/**
 * Schema de item de OC.
 *
 * Deliberadamente NO fija `minimum`/`minItems`: esas son reglas de negocio y
 * las valida `createPurchaseOrder`/`updatePurchaseOrder` con `ValidationError`
 * (422 + mensaje descriptivo). Un `minimum` aquí convertiría el rechazo en un
 * 400 genérico de Fastify y perdería el detalle para el cliente.
 */
const ITEM_SCHEMA = {
  type: "object",
  required: ["repuestoId", "cantidad", "costoUnitario"],
  properties: {
    repuestoId: { type: "string", format: "uuid" },
    cantidad: { type: "integer" },
    costoUnitario: { type: "number" },
  },
} as const;

export async function purchaseOrderRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /inventory/purchase-orders — List ──
  app.get<{ Querystring: ListQuery }>(
    "/inventory/purchase-orders",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            estado: { type: "string" },
            proveedor: { type: "string" },
            search: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
      const result = await listPurchaseOrders(request.tenantSlug, request.query);
      return reply.send({ total: result.length, items: result });
    },
  );

  // ── POST /inventory/purchase-orders — Create ──
  app.post<{ Body: CreateBody }>(
    "/inventory/purchase-orders",
    {
      preHandler: requireManager,
      schema: {
        body: {
          type: "object",
          required: ["proveedor", "items"],
          properties: {
            proveedor: { type: "string", minLength: 1, maxLength: 200 },
            fechaEsperada: { type: "string" },
            notas: { type: "string", maxLength: 2000 },
            estado: { type: "string" },
            items: { type: "array", items: ITEM_SCHEMA },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) => {
      const data: CreatePurchaseOrderManualInput = {
        proveedor: request.body.proveedor,
        fechaEsperada: request.body.fechaEsperada ?? null,
        notas: request.body.notas ?? null,
        estado: request.body.estado,
        items: request.body.items,
      };
      const result = await createPurchaseOrder(data, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── GET /inventory/purchase-orders/:id ──
  app.get<{ Params: IdParams }>(
    "/inventory/purchase-orders/:id",
    { schema: { params: { type: "object", properties: { id: { type: "string", format: "uuid" } } } } },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const result = await getPurchaseOrder(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── PATCH /inventory/purchase-orders/:id ──
  app.patch<{ Params: IdParams; Body: UpdateBody }>(
    "/inventory/purchase-orders/:id",
    {
      preHandler: requireManager,
      schema: {
        params: { type: "object", properties: { id: { type: "string", format: "uuid" } } },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            proveedor: { type: "string", minLength: 1, maxLength: 200 },
            fechaEsperada: { type: "string" },
            notas: { type: "string", maxLength: 2000 },
            estado: { type: "string" },
            items: { type: "array", items: ITEM_SCHEMA },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: IdParams; Body: UpdateBody }>,
      reply: FastifyReply,
    ) => {
      const data: UpdatePurchaseOrderInput = {
        proveedor: request.body.proveedor,
        fechaEsperada: request.body.fechaEsperada,
        notas: request.body.notas,
        estado: request.body.estado,
        items: request.body.items,
      };
      const result = await updatePurchaseOrder(
        request.params.id,
        data,
        request.tenantSlug,
      );
      return reply.send(result);
    },
  );

  // ── POST /inventory/purchase-orders/:id/receive ──
  app.post<{ Params: IdParams; Body: ReceiveBody }>(
    "/inventory/purchase-orders/:id/receive",
    {
      preHandler: requireManager,
      schema: {
        params: { type: "object", properties: { id: { type: "string", format: "uuid" } } },
        body: {
          type: "object",
          required: ["items"],
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["itemId", "cantidadRecibida"],
                properties: {
                  itemId: { type: "string", format: "uuid" },
                  cantidadRecibida: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: IdParams; Body: ReceiveBody }>,
      reply: FastifyReply,
    ) => {
      const result = await receivePurchaseOrder(
        request.params.id,
        { items: request.body.items },
        request.tenantSlug,
      );
      return reply.send(result);
    },
  );

  // ── POST /inventory/purchase-orders/:id/cancel ──
  app.post<{ Params: IdParams }>(
    "/inventory/purchase-orders/:id/cancel",
    {
      preHandler: requireManager,
      schema: { params: { type: "object", properties: { id: { type: "string", format: "uuid" } } } },
    },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const result = await cancelPurchaseOrder(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── DELETE /inventory/purchase-orders/:id — solo BORRADOR ──
  app.delete<{ Params: IdParams }>(
    "/inventory/purchase-orders/:id",
    {
      preHandler: requireManager,
      schema: { params: { type: "object", properties: { id: { type: "string", format: "uuid" } } } },
    },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      await deletePurchaseOrder(request.params.id, request.tenantSlug);
      return reply.status(204).send();
    },
  );
}
