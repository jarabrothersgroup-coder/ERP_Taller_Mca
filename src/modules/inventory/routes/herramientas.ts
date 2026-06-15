/**
 * Herramientas routes — tool management and checkout endpoints.
 *
 * Endpoints:
 *   POST   /inventory/herramientas                    — Create a tool
 *   GET    /inventory/herramientas                    — List tools (search/filter/paginate)
 *   GET    /inventory/herramientas/disponibles        — List available tools
 *   GET    /inventory/herramientas/:id                — Get tool by ID
 *   PATCH  /inventory/herramientas/:id                — Update tool
 *   POST   /inventory/herramientas/prestar            — Lend tool to mechanic for OT
 *   POST   /inventory/herramientas/control/:id/devolver — Return tool
 *   GET    /inventory/herramientas/control            — List checkout records (filtered)
 *
 * All routes require `X-Tenant-Slug` header (resolved by tenant-resolver).
 *
 * @module inventory/routes/herramientas
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createHerramienta,
  getHerramientaById,
  listHerramientas,
  updateHerramienta,
  prestarHerramienta,
  devolverHerramienta,
  listControlHerramientas,
} from "../services/herramientas.service.js";

// ─── Types ────────────────────────────────────

interface CreateBody {
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  ubicacion?: string;
  stockTotal?: number;
  stockDisponible?: number;
  requiereCalibracion?: boolean;
  ultimaCalibracion?: string;
  proximaCalibracion?: string;
  activo?: boolean;
  imagenUrl?: string;
}

interface UpdateBody {
  codigo?: string;
  nombre?: string;
  descripcion?: string | null;
  categoria?: string | null;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  ubicacion?: string | null;
  stockTotal?: number;
  stockDisponible?: number;
  requiereCalibracion?: boolean;
  ultimaCalibracion?: string | null;
  proximaCalibracion?: string | null;
  activo?: boolean;
  imagenUrl?: string | null;
}

interface PrestarBody {
  herramientaId: string;
  ordenTrabajoId: string;
  mecanicoId: string;
  observaciones?: string;
}

interface DevolverBody {
  observaciones?: string;
  estado?: "Devuelto" | "Perdido" | "Dañado";
}

interface ListQuery {
  search?: string;
  categoria?: string;
  activo?: string;
  page?: string;
  limit?: string;
}

interface ControlQuery {
  ordenTrabajoId?: string;
  mecanicoId?: string;
  herramientaId?: string;
  estado?: string;
  page?: string;
  limit?: string;
}

interface IdParams {
  id: string;
}

interface ControlIdParams {
  id: string;
}

// ─── Routes ───────────────────────────────────

/**
 * Registers the herramientas routes on the Fastify instance.
 *
 * @param app - Fastify instance
 */
export async function herramientasRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /inventory/herramientas — Create tool ──
  app.post<{ Body: CreateBody }>(
    "/inventory/herramientas",
    {
      schema: {
        body: {
          type: "object",
          required: ["codigo", "nombre"],
          properties: {
            codigo: { type: "string", maxLength: 50 },
            nombre: { type: "string", maxLength: 200 },
            descripcion: { type: "string", maxLength: 500 },
            categoria: { type: "string", maxLength: 50 },
            marca: { type: "string", maxLength: 100 },
            modelo: { type: "string", maxLength: 100 },
            numeroSerie: { type: "string", maxLength: 100 },
            ubicacion: { type: "string", maxLength: 100 },
            stockTotal: { type: "integer", minimum: 1 },
            stockDisponible: { type: "integer", minimum: 0 },
            requiereCalibracion: { type: "boolean" },
            ultimaCalibracion: { type: "string", format: "date-time" },
            proximaCalibracion: { type: "string", format: "date-time" },
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
              nombre: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateBody }>,
      reply: FastifyReply,
    ) => {
      const result = await createHerramienta(request.body);
      return reply.status(201).send(result);
    },
  );

  // ── GET /inventory/herramientas — List tools ──
  app.get<{ Querystring: ListQuery }>(
    "/inventory/herramientas",
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
      const result = await listHerramientas({
        search,
        categoria,
        activo: activo !== undefined ? activo === "true" : undefined,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return reply.send(result);
    },
  );

  // ── GET /inventory/herramientas/:id — Get tool by ID ──
  app.get<{ Params: IdParams }>(
    "/inventory/herramientas/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              codigo: { type: "string" },
              nombre: { type: "string" },
              descripcion: { type: "string", nullable: true },
              categoria: { type: "string", nullable: true },
              marca: { type: "string", nullable: true },
              modelo: { type: "string", nullable: true },
              numeroSerie: { type: "string", nullable: true },
              ubicacion: { type: "string", nullable: true },
              stockTotal: { type: "integer" },
              stockDisponible: { type: "integer" },
              requiereCalibracion: { type: "boolean" },
              ultimaCalibracion: { type: "string", nullable: true },
              proximaCalibracion: { type: "string", nullable: true },
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
      const result = await getHerramientaById(request.params.id);
      return reply.send(result);
    },
  );

  // ── PATCH /inventory/herramientas/:id — Update tool ──
  app.patch<{ Params: IdParams; Body: UpdateBody }>(
    "/inventory/herramientas/:id",
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
            nombre: { type: "string", maxLength: 200 },
            descripcion: { type: "string", maxLength: 500 },
            categoria: { type: "string", maxLength: 50 },
            marca: { type: "string", maxLength: 100 },
            modelo: { type: "string", maxLength: 100 },
            numeroSerie: { type: "string", maxLength: 100 },
            ubicacion: { type: "string", maxLength: 100 },
            stockTotal: { type: "integer", minimum: 1 },
            stockDisponible: { type: "integer", minimum: 0 },
            requiereCalibracion: { type: "boolean" },
            ultimaCalibracion: { type: "string", format: "date-time" },
            proximaCalibracion: { type: "string", format: "date-time" },
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
      const result = await updateHerramienta(request.params.id, request.body);
      return reply.send(result);
    },
  );

  // ── POST /inventory/herramientas/prestar — Lend tool ──
  app.post<{ Body: PrestarBody }>(
    "/inventory/herramientas/prestar",
    {
      schema: {
        body: {
          type: "object",
          required: ["herramientaId", "ordenTrabajoId", "mecanicoId"],
          properties: {
            herramientaId: { type: "string", format: "uuid" },
            ordenTrabajoId: { type: "string", format: "uuid" },
            mecanicoId: { type: "string", format: "uuid" },
            observaciones: { type: "string", maxLength: 500 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              control: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  herramientaId: { type: "string" },
                  herramientaNombre: { type: "string" },
                  ordenTrabajoId: { type: "string" },
                  mecanicoId: { type: "string" },
                  mecanicoNombre: { type: "string" },
                  fechaAsignacion: { type: "string" },
                  estado: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: PrestarBody }>,
      reply: FastifyReply,
    ) => {
      const result = await prestarHerramienta(request.body);
      return reply.status(201).send(result);
    },
  );

  // ── POST /inventory/herramientas/control/:id/devolver — Return tool ──
  app.post<{ Params: ControlIdParams; Body: DevolverBody }>(
    "/inventory/herramientas/control/:id/devolver",
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
            observaciones: { type: "string", maxLength: 500 },
            estado: {
              type: "string",
              enum: ["Devuelto", "Perdido", "Dañado"],
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              control: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  herramientaId: { type: "string" },
                  herramientaNombre: { type: "string" },
                  ordenTrabajoId: { type: "string" },
                  mecanicoId: { type: "string" },
                  mecanicoNombre: { type: "string" },
                  fechaAsignacion: { type: "string" },
                  fechaDevolucion: { type: "string" },
                  estado: { type: "string" },
                  observaciones: { type: "string", nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: ControlIdParams;
        Body: DevolverBody;
      }>,
      reply: FastifyReply,
    ) => {
      const result = await devolverHerramienta(
        request.params.id,
        request.body,
      );
      return reply.send(result);
    },
  );

  // ── GET /inventory/herramientas/control — List checkout records ──
  app.get<{ Querystring: ControlQuery }>(
    "/inventory/herramientas/control",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            ordenTrabajoId: { type: "string", format: "uuid" },
            mecanicoId: { type: "string", format: "uuid" },
            herramientaId: { type: "string", format: "uuid" },
            estado: {
              type: "string",
              enum: ["Asignado", "Devuelto", "Perdido", "Dañado"],
            },
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
      request: FastifyRequest<{ Querystring: ControlQuery }>,
      reply: FastifyReply,
    ) => {
      const {
        ordenTrabajoId,
        mecanicoId,
        herramientaId,
        estado,
        page,
        limit,
      } = request.query;
      const result = await listControlHerramientas({
        ordenTrabajoId,
        mecanicoId,
        herramientaId,
        estado,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return reply.send(result);
    },
  );
}
