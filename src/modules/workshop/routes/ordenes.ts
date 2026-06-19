import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { signHvLockout, updateOrdenStatus, listOrdenes, getOrden } from "../services/orden.service.js";
import { previewStockConsumption } from "../../inventory/services/ot-stock-consumer.js";
import { BadRequestError } from "../../../shared/errors/app-error.js";

interface OrdenParams {
  id: string;
}

interface SignLockoutBody {
  mechanicId: string;
}

interface StatusBody {
  status: string;
}

interface OrdenesQuery {
  status?: string;
  limit?: string;
  offset?: string;
}

const ORDEN_RESPONSE_PROPS = {
  id: { type: "string" },
  vehicleId: { type: "string" },
  clientId: { type: "string" },
  description: { type: "string", nullable: true },
  status: { type: "string" },
  hvAlert: { type: "boolean" },
  hvLockoutSigned: { type: "boolean" },
  dtcCodes: { type: "array", items: { type: "string" }, nullable: true },
  createdAt: { type: "string" },
  updatedAt: { type: "string" },
  vehiculo: { type: "string", nullable: true },
  plate: { type: "string", nullable: true },
  cliente: { type: "string", nullable: true },
};

export async function ordenesRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /workshop/ordenes — List work orders ──
  app.get<{ Querystring: OrdenesQuery }>(
    "/workshop/ordenes",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["Presupuestado", "Aprobado", "En_Proceso", "Control_Calidad", "Listo"],
            },
            limit: { type: "string" },
            offset: { type: "string" },
          },
        },
        response: {
          200: {
            type: "array",
            items: { type: "object", properties: ORDEN_RESPONSE_PROPS },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: OrdenesQuery }>, reply: FastifyReply) => {
      const q = request.query;
      const ordenes = await listOrdenes({
        status: q.status,
        limit: q.limit ? parseInt(q.limit, 10) : undefined,
        offset: q.offset ? parseInt(q.offset, 10) : undefined,
      }, request.tenantSlug);
      return reply.send(ordenes);
    },
  );

  // ── GET /workshop/ordenes/:id — Get single order ──
  app.get<{ Params: OrdenParams }>(
    "/workshop/ordenes/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: { type: "object", properties: ORDEN_RESPONSE_PROPS },
        },
      },
    },
    async (request: FastifyRequest<{ Params: OrdenParams }>, reply: FastifyReply) => {
      const orden = await getOrden(request.params.id, request.tenantSlug);
      return reply.send(orden);
    },
  );

  // ── PATCH /workshop/ordenes/:id — Update order status (frontend compat) ──
  app.patch<{ Params: OrdenParams; Body: StatusBody }>(
    "/workshop/ordenes/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["Presupuestado", "Aprobado", "En_Proceso", "Control_Calidad", "Listo"],
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: OrdenParams; Body: StatusBody }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const { status } = request.body;
      const result = await updateOrdenStatus(id, status, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── POST /workshop/ordenes/:id/sign-lockout ──
  app.post<{ Params: OrdenParams; Body: SignLockoutBody }>(
    "/workshop/ordenes/:id/sign-lockout",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["mechanicId"],
          properties: {
            mechanicId: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: OrdenParams; Body: SignLockoutBody }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const { mechanicId } = request.body;
      if (!mechanicId) throw new BadRequestError("mechanicId is required");
      const result = await signHvLockout(id, mechanicId, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /workshop/ordenes/:id/stock-preview — Preview stock consumption ──
  app.get<{ Params: OrdenParams }>(
    "/workshop/ordenes/:id/stock-preview",
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
            items: {
              type: "object",
              properties: {
                repuestoId: { type: "string" },
                repuestoNombre: { type: "string" },
                codigo: { type: "string", nullable: true },
                cantidad: { type: "integer" },
                stockActual: { type: "integer" },
                puntoReorden: { type: "integer", nullable: true },
                stockAfter: { type: "integer" },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: OrdenParams }>, reply: FastifyReply) => {
      const { id } = request.params;
      const preview = await previewStockConsumption(id, request.tenantSlug);
      return reply.send(preview);
    },
  );

  // ── PATCH /workshop/ordenes/:id/status ──
  app.patch<{ Params: OrdenParams; Body: StatusBody }>(
    "/workshop/ordenes/:id/status",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["Presupuestado", "Aprobado", "En_Proceso", "Control_Calidad", "Listo"],
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: OrdenParams; Body: StatusBody }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const { status } = request.body;
      const result = await updateOrdenStatus(id, status, request.tenantSlug);
      return reply.send(result);
    },
  );
}
