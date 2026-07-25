import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { signHvLockout, updateOrdenStatus, listOrdenes, getOrden, createOrden } from "../services/orden.service.js";
import { previewStockConsumption } from "../../inventory/services/ot-stock-consumer.js";
import { BadRequestError } from "../../../shared/errors/app-error.js";
import { generateOtPdf, isPdfAvailable } from "../../../shared/services/pdf-report.service.js";
import { db } from "../../../shared/database/drizzle.js";
import { ordenesTrabajo, vehiculos, ordenServicios, ordenRepuestos } from "../schema/index.js";
import { clients } from "../../../shared/database/schema/clients.js";
import { eq, and } from "drizzle-orm";

interface OrdenParams {
  id: string;
}

interface CreateOrdenBody {
  vehicleId: string;
  clientId: string;
  description?: string;
  hvAlert?: boolean;
  dtcCodes?: string[];
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
  // ── POST /workshop/ordenes — Create work order ──
  app.post<{ Body: CreateOrdenBody }>(
    "/workshop/ordenes",
    {
      schema: {
        body: {
          type: "object",
          required: ["vehicleId", "clientId"],
          properties: {
            vehicleId: { type: "string", format: "uuid" },
            clientId: { type: "string", format: "uuid" },
            description: { type: "string", maxLength: 2000 },
            hvAlert: { type: "boolean" },
            dtcCodes: { type: "array", items: { type: "string" } },
          },
        },
        response: {
          201: { type: "object", properties: ORDEN_RESPONSE_PROPS },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateOrdenBody }>, reply: FastifyReply) => {
      const orden = await createOrden(request.body, request.tenantSlug);
      return reply.status(201).send(orden);
    },
  );

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

  // ── GET /workshop/ordenes/:id/pdf — OT PDF ──
  app.get<{ Params: OrdenParams }>(
    "/workshop/ordenes/:id/pdf",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: OrdenParams }>, reply: FastifyReply) => {
      if (!isPdfAvailable()) {
        return reply.status(503).send({ error: "PDF generation unavailable — Chromium not installed" });
      }

      const { id } = request.params;
      const tenantSlug = request.tenantSlug;

      // Fetch OT
      const [ot] = await db()
        .select()
        .from(ordenesTrabajo)
        .where(and(eq(ordenesTrabajo.id, id), eq(ordenesTrabajo.tenantSlug, tenantSlug)))
        .limit(1);
      if (!ot) return reply.status(404).send({ error: "OT no encontrada" });

      // Fetch client
      const [cliente] = await db()
        .select()
        .from(clients)
        .where(eq(clients.id, ot.clientId))
        .limit(1);

      // Fetch vehicle
      const [vehiculo] = await db()
        .select()
        .from(vehiculos)
        .where(eq(vehiculos.id, ot.vehicleId))
        .limit(1);

      // Fetch services + parts
      const [servicios, repuestos] = await Promise.all([
        db().select().from(ordenServicios).where(eq(ordenServicios.ordenTrabajoId, id)),
        db().select().from(ordenRepuestos).where(eq(ordenRepuestos.ordenTrabajoId, id)),
      ]);

      const items = [
        ...servicios.map((s) => ({
          tipo: "servicio",
          nombre: s.servicioNombre,
          cantidad: s.cantidad,
          precioUnitario: Number(s.precioUnitario),
          subtotal: Number(s.subtotal),
        })),
        ...repuestos.map((r) => ({
          tipo: "repuesto",
          nombre: r.repuestoNombre,
          codigo: r.codigo,
          cantidad: r.cantidad,
          precioUnitario: Number(r.precioUnitario),
          subtotal: Number(r.subtotal),
        })),
      ];

      const pdf = await generateOtPdf(ot, items, cliente, vehiculo);
      const date = new Date().toISOString().slice(0, 10);

      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="OT-${id.slice(0, 8)}-${date}.pdf"`)
        .send(pdf);
    },
  );
}
