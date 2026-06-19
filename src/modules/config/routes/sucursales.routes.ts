/**
 * Sucursales routes — multi-branch management endpoints.
 *
 * Endpoints:
 *   POST   /config/sucursales      — Create branch
 *   GET    /config/sucursales      — List branches
 *   GET    /config/sucursales/:id  — Get branch by ID
 *   PATCH  /config/sucursales/:id  — Update branch
 *   DELETE /config/sucursales/:id  — Soft-delete branch
 *
 * @module config/routes/sucursales.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createSucursal,
  listSucursales,
  getSucursalById,
  updateSucursal,
  deleteSucursal,
} from "../services/sucursal.service.js";
import { requireAdmin } from "../../../shared/middleware/rbac.js";
import { getConsolidatedKPIs, getRoleDashboard } from "../services/multi-branch-dashboard.service.js";

interface CreateBody {
  nombre: string;
  codigo: string;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  telefono?: string;
  email?: string;
  gerente?: string;
  esPrincipal?: boolean;
}

interface UpdateBody {
  nombre?: string;
  direccion?: string | null;
  ciudad?: string | null;
  departamento?: string | null;
  telefono?: string | null;
  email?: string | null;
  gerente?: string | null;
  esPrincipal?: boolean;
  activa?: boolean;
}

interface IdParams {
  id: string;
}

export async function sucursalesRoutes(app: FastifyInstance): Promise<void> {
  // ── RBAC: Only admin users can manage branches ──
  app.addHook("preHandler", requireAdmin);

  // ── POST /config/sucursales — Create branch ──
  app.post<{ Body: CreateBody }>(
    "/config/sucursales",
    {
      schema: {
        body: {
          type: "object",
          required: ["nombre", "codigo"],
          properties: {
            nombre: { type: "string", maxLength: 100 },
            codigo: { type: "string", maxLength: 20 },
            direccion: { type: "string", maxLength: 200 },
            ciudad: { type: "string", maxLength: 100 },
            departamento: { type: "string", maxLength: 100 },
            telefono: { type: "string", maxLength: 30 },
            email: { type: "string", maxLength: 100 },
            gerente: { type: "string", maxLength: 100 },
            esPrincipal: { type: "boolean" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) => {
      const result = await createSucursal(request.body, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── GET /config/sucursales — List branches ──
  app.get(
    "/config/sucursales",
    {
      schema: {
        response: {
          200: {
            type: "array",
            items: { type: "object" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await listSucursales(request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /config/sucursales/:id — Get branch ──
  app.get<{ Params: IdParams }>(
    "/config/sucursales/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const result = await getSucursalById(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── PATCH /config/sucursales/:id — Update branch ──
  app.patch<{ Params: IdParams; Body: UpdateBody }>(
    "/config/sucursales/:id",
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
            nombre: { type: "string", maxLength: 100 },
            direccion: { type: "string", maxLength: 200, nullable: true },
            ciudad: { type: "string", maxLength: 100, nullable: true },
            departamento: { type: "string", maxLength: 100, nullable: true },
            telefono: { type: "string", maxLength: 30, nullable: true },
            email: { type: "string", maxLength: 100, nullable: true },
            gerente: { type: "string", maxLength: 100, nullable: true },
            esPrincipal: { type: "boolean" },
            activa: { type: "boolean" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: IdParams; Body: UpdateBody }>, reply: FastifyReply) => {
      const result = await updateSucursal(request.params.id, request.body, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── DELETE /config/sucursales/:id — Soft-delete branch ──
  app.delete<{ Params: IdParams }>(
    "/config/sucursales/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      await deleteSucursal(request.params.id, request.tenantSlug);
      return reply.status(204).send();
    },
  );

  // ── GET /config/dashboard/consolidated — Cross-branch KPIs (admin/manager) ──
  app.get(
    "/config/dashboard/consolidated",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              totalSucursales: { type: "number" },
              totalOTActivas: { type: "number" },
              totalOTCompletadasMes: { type: "number" },
              totalIngresoMes: { type: "number" },
              sucursales: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await getConsolidatedKPIs(request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /config/dashboard/role — Role-based dashboard data ──
  app.get(
    "/config/dashboard/role",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            sucursalId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: { type: "object" },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { sucursalId?: string } }>, reply: FastifyReply) => {
      const role = request.profile?.role || "user";
      const email = request.profile?.email;
      const result = await getRoleDashboard(
        role,
        request.tenantSlug,
        request.query.sucursalId,
        email,
      );
      return reply.send(result);
    },
  );
}
