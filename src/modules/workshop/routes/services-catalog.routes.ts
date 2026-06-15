/**
 * Services Catalog Routes — CRUD endpoints for servicios_catalogo.
 *
 * POST   /workshop/servicios          — Create a new service
 * GET    /workshop/servicios          — List services (with optional filters)
 * GET    /workshop/servicios/:id      — Get a single service by ID
 * PATCH  /workshop/servicios/:id      — Update a service
 * DELETE /workshop/servicios/:id      — Soft-delete a service (set inactive)
 *
 * All routes require X-Tenant-Slug header (resolved by tenant-resolver).
 *
 * @module workshop/routes/services-catalog
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listServicios,
  getServicio,
  createServicio,
  updateServicio,
  deleteServicio,
} from "../services/services-catalog.service.js";

// ─── Types ──────────────────────────────────────

interface ParamsWithId {
  id: string;
}

interface CatalogQuery {
  categoria?: string;
  activo?: string;
  limit?: string;
  offset?: string;
}

interface CatalogBody {
  nombre?: string;
  descripcion?: string;
  categoria?: string;
  precioEstimado?: number;
  duracionEstimada?: number;
  activo?: boolean;
}

// ─── Response schema properties ──────────────────

const CATALOG_RESPONSE_PROPS = {
  id: { type: "string" },
  nombre: { type: "string" },
  descripcion: { type: "string", nullable: true },
  categoria: { type: "string", nullable: true },
  precioEstimado: { type: "string", nullable: true },
  duracionEstimada: { type: "integer", nullable: true },
  activo: { type: "boolean" },
  tenantSlug: { type: "string" },
  createdAt: { type: "string" },
  updatedAt: { type: "string" },
};

const CATALOG_BODY_SCHEMA = {
  type: "object",
  properties: {
    nombre: { type: "string", minLength: 1 },
    descripcion: { type: "string" },
    categoria: { type: "string" },
    precioEstimado: { type: "number", minimum: 0 },
    duracionEstimada: { type: "integer", minimum: 0 },
    activo: { type: "boolean" },
  },
};

// ─── Routes ─────────────────────────────────────

export async function servicesCatalogRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /workshop/servicios — Create service ──
  app.post<{ Body: CatalogBody }>(
    "/workshop/servicios",
    {
      schema: {
        body: { ...CATALOG_BODY_SCHEMA, required: ["nombre"] },
        response: { 201: { type: "object", properties: CATALOG_RESPONSE_PROPS } },
      },
    },
    async (request: FastifyRequest<{ Body: CatalogBody }>, reply: FastifyReply) => {
      const service = await createServicio({
        nombre: request.body.nombre!,
        descripcion: request.body.descripcion,
        categoria: request.body.categoria,
        precioEstimado: request.body.precioEstimado,
        duracionEstimada: request.body.duracionEstimada,
        tenantSlug: request.tenantSlug,
      });
      return reply.status(201).send(service);
    },
  );

  // ── GET /workshop/servicios — List services ──
  app.get<{ Querystring: CatalogQuery }>(
    "/workshop/servicios",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            categoria: { type: "string" },
            activo: { type: "string", enum: ["true", "false"] },
            limit: { type: "string" },
            offset: { type: "string" },
          },
        },
        response: {
          200: {
            type: "array",
            items: { type: "object", properties: CATALOG_RESPONSE_PROPS },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: CatalogQuery }>, reply: FastifyReply) => {
      const q = request.query;
      const services = await listServicios({
        categoria: q.categoria,
        activo: q.activo !== undefined ? q.activo === "true" : undefined,
        limit: q.limit ? parseInt(q.limit, 10) : undefined,
        offset: q.offset ? parseInt(q.offset, 10) : undefined,
      }, request.tenantSlug);
      return reply.send(services);
    },
  );

  // ── GET /workshop/servicios/:id — Get single service ──
  app.get<{ Params: ParamsWithId }>(
    "/workshop/servicios/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ParamsWithId }>, reply: FastifyReply) => {
      const service = await getServicio(request.params.id, request.tenantSlug);
      return reply.send(service);
    },
  );

  // ── PATCH /workshop/servicios/:id — Update service ──
  app.patch<{ Params: ParamsWithId; Body: CatalogBody }>(
    "/workshop/servicios/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: CATALOG_BODY_SCHEMA,
      },
    },
    async (request: FastifyRequest<{ Params: ParamsWithId; Body: CatalogBody }>, reply: FastifyReply) => {
      const service = await updateServicio(
        request.params.id,
        request.body as Partial<CatalogBody>,
        request.tenantSlug,
      );
      return reply.send(service);
    },
  );

  // ── DELETE /workshop/servicios/:id — Soft-delete service ──
  app.delete<{ Params: ParamsWithId }>(
    "/workshop/servicios/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ParamsWithId }>, reply: FastifyReply) => {
      const result = await deleteServicio(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );
}
