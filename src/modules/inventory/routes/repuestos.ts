/**
 * Repuestos routes — spare parts inventory endpoints.
 *
 * Endpoints:
 *   POST   /inventory/repuestos          — Create a spare part
 *   GET    /inventory/repuestos          — List spare parts (search/filter/paginate)
 *   GET    /inventory/repuestos/:id      — Get spare part by ID
 *   PATCH  /inventory/repuestos/:id      — Update spare part
 *   POST   /inventory/repuestos/salida   — Stock output (decrement)
 *   POST   /inventory/repuestos/:id/ingreso — Stock input (increment)
 *
 * All routes require `X-Tenant-Slug` header (resolved by tenant-resolver).
 *
 * Barcode/QR search leverages the `repuestos_codigo_barras_idx` index
 * for sub-100ms scanner lookups. @qa-optimizer validates index coverage.
 *
 * @module inventory/routes/repuestos
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createRepuesto,
  getRepuestoById,
  listRepuestos,
  updateRepuesto,
  salidaStock,
  ingresoStock,
} from "../services/stock.service.js";

// ─── Types ────────────────────────────────────

interface CreateBody {
  codigo: string;
  codigoBarras?: string;
  descripcion: string;
  marca?: string;
  modelo?: string;
  categoria?: string;
  precioCosto?: number;
  precioVenta?: number;
  stockActual?: number;
  stockMinimo?: number;
  stockMaximo?: number;
  ubicacion?: string;
  unidadMedida?: string;
  proveedor?: string;
  compatibleCon?: string;
  activo?: boolean;
  imagenUrl?: string;
}

interface UpdateBody {
  codigo?: string;
  codigoBarras?: string | null;
  descripcion?: string;
  marca?: string | null;
  modelo?: string | null;
  categoria?: string | null;
  precioCosto?: number | null;
  precioVenta?: number | null;
  stockActual?: number;
  stockMinimo?: number;
  stockMaximo?: number | null;
  ubicacion?: string | null;
  unidadMedida?: string;
  proveedor?: string | null;
  compatibleCon?: string | null;
  activo?: boolean;
  imagenUrl?: string | null;
}

interface SalidaBody {
  repuestoId: string;
  cantidad: number;
  motivo: string;
  ordenTrabajoId?: string;
  observaciones?: string;
}

interface IngresoBody {
  cantidad: number;
  motivo: string;
  costoUnitario?: number;
  observaciones?: string;
}

interface ListQuery {
  search?: string;
  categoria?: string;
  activo?: string;
  page?: string;
  limit?: string;
}

interface IdParams {
  id: string;
}

// ─── Routes ───────────────────────────────────

/**
 * Registers the repuestos routes on the Fastify instance.
 *
 * @param app - Fastify instance
 */
export async function repuestosRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /inventory/repuestos — Create spare part ──
  app.post<{ Body: CreateBody }>(
    "/inventory/repuestos",
    {
      schema: {
        body: {
          type: "object",
          required: ["codigo", "descripcion"],
          properties: {
            codigo: { type: "string", maxLength: 50 },
            codigoBarras: { type: "string", maxLength: 100 },
            descripcion: { type: "string", maxLength: 500 },
            marca: { type: "string", maxLength: 100 },
            modelo: { type: "string", maxLength: 100 },
            categoria: { type: "string", maxLength: 50 },
            precioCosto: { type: "number", minimum: 0 },
            precioVenta: { type: "number", minimum: 0 },
            stockActual: { type: "integer", minimum: 0 },
            stockMinimo: { type: "integer", minimum: 0 },
            stockMaximo: { type: "integer", minimum: 0 },
            ubicacion: { type: "string", maxLength: 100 },
            unidadMedida: { type: "string", maxLength: 20 },
            proveedor: { type: "string", maxLength: 200 },
            compatibleCon: { type: "string", maxLength: 500 },
            activo: { type: "boolean" },
            imagenUrl: { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              codigo: { type: "string" },
              descripcion: { type: "string" },
              stockActual: { type: "integer" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateBody }>,
      reply: FastifyReply,
    ) => {
      const result = await createRepuesto(request.body);
      return reply.status(201).send(result);
    },
  );

  // ── GET /inventory/repuestos — List spare parts ──
  app.get<{ Querystring: ListQuery }>(
    "/inventory/repuestos",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            search: { type: "string", maxLength: 100 },
            categoria: { type: "string", maxLength: 50 },
            activo: { type: "string", enum: ["true", "false"] },
            page: { type: "string", pattern: "^[1-9]\\d*$" },
            limit: { type: "string", pattern: "^([1-9]|[1-9]\\d|100)$" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              items: { type: "array" },
              total: { type: "integer" },
              page: { type: "integer" },
              limit: { type: "integer" },
              totalPages: { type: "integer" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: ListQuery }>,
      reply: FastifyReply,
    ) => {
      const { search, categoria, activo, page, limit } = request.query;
      const result = await listRepuestos({
        search,
        categoria,
        activo: activo !== undefined ? activo === "true" : undefined,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return reply.send(result);
    },
  );

  // ── GET /inventory/repuestos/:id — Get spare part by ID ──
  app.get<{ Params: IdParams }>(
    "/inventory/repuestos/:id",
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
            type: "object",
            properties: {
              id: { type: "string" },
              codigo: { type: "string" },
              codigoBarras: { type: "string", nullable: true },
              descripcion: { type: "string" },
              marca: { type: "string", nullable: true },
              modelo: { type: "string", nullable: true },
              categoria: { type: "string", nullable: true },
              precioCosto: { type: "string", nullable: true },
              precioVenta: { type: "string", nullable: true },
              stockActual: { type: "integer" },
              stockMinimo: { type: "integer" },
              stockMaximo: { type: "integer", nullable: true },
              ubicacion: { type: "string", nullable: true },
              unidadMedida: { type: "string" },
              proveedor: { type: "string", nullable: true },
              compatibleCon: { type: "string", nullable: true },
              activo: { type: "boolean" },
              imagenUrl: { type: "string", nullable: true },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: IdParams }>,
      reply: FastifyReply,
    ) => {
      const result = await getRepuestoById(request.params.id);
      return reply.send(result);
    },
  );

  // ── PATCH /inventory/repuestos/:id — Update spare part ──
  app.patch<{ Params: IdParams; Body: UpdateBody }>(
    "/inventory/repuestos/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            codigo: { type: "string", maxLength: 50 },
            codigoBarras: { type: "string", maxLength: 100 },
            descripcion: { type: "string", maxLength: 500 },
            marca: { type: "string", maxLength: 100 },
            modelo: { type: "string", maxLength: 100 },
            categoria: { type: "string", maxLength: 50 },
            precioCosto: { type: "number", minimum: 0 },
            precioVenta: { type: "number", minimum: 0 },
            stockActual: { type: "integer", minimum: 0 },
            stockMinimo: { type: "integer", minimum: 0 },
            stockMaximo: { type: "integer", minimum: 0 },
            ubicacion: { type: "string", maxLength: 100 },
            unidadMedida: { type: "string", maxLength: 20 },
            proveedor: { type: "string", maxLength: 200 },
            compatibleCon: { type: "string", maxLength: 500 },
            activo: { type: "boolean" },
            imagenUrl: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: IdParams; Body: UpdateBody }>,
      reply: FastifyReply,
    ) => {
      const result = await updateRepuesto(request.params.id, request.body);
      return reply.send(result);
    },
  );

  // ── POST /inventory/repuestos/salida — Stock output ──
  app.post<{ Body: SalidaBody }>(
    "/inventory/repuestos/salida",
    {
      schema: {
        body: {
          type: "object",
          required: ["repuestoId", "cantidad", "motivo"],
          properties: {
            repuestoId: { type: "string", format: "uuid" },
            cantidad: { type: "integer", minimum: 1 },
            motivo: {
              type: "string",
              enum: ["Venta", "Uso en OT", "Ajuste", "Vencimiento", "Robo", "Otro"],
            },
            ordenTrabajoId: { type: "string", format: "uuid", nullable: true },
            centroCostoId: { type: "string", format: "uuid", nullable: true },
            observaciones: { type: "string", maxLength: 500 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              repuesto: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  codigo: { type: "string" },
                  descripcion: { type: "string" },
                  stockActual: { type: "integer" },
                  stockAnterior: { type: "integer" },
                },
              },
              movimiento: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  tipo: { type: "string" },
                  cantidad: { type: "integer" },
                  motivo: { type: "string" },
                  ordenTrabajoId: { type: "string", nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: SalidaBody }>,
      reply: FastifyReply,
    ) => {
      const result = await salidaStock(request.body, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── POST /inventory/repuestos/:id/ingreso — Stock input ──
  app.post<{ Params: IdParams; Body: IngresoBody }>(
    "/inventory/repuestos/:id/ingreso",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["cantidad", "motivo"],
          properties: {
            cantidad: { type: "integer", minimum: 1 },
            motivo: {
              type: "string",
              enum: ["Compra", "Devolución", "Ajuste", "Transferencia", "Otro"],
            },
            costoUnitario: { type: "number", minimum: 0 },
            observaciones: { type: "string", maxLength: 500 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              repuesto: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  codigo: { type: "string" },
                  descripcion: { type: "string" },
                  stockActual: { type: "integer" },
                  stockAnterior: { type: "integer" },
                },
              },
              movimiento: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  tipo: { type: "string" },
                  cantidad: { type: "integer" },
                  motivo: { type: "string" },
                  ordenTrabajoId: { type: "string", nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: IdParams; Body: IngresoBody }>,
      reply: FastifyReply,
    ) => {
      const result = await ingresoStock(request.params.id, request.body, request.tenantSlug);
      return reply.send(result);
    },
  );
}
