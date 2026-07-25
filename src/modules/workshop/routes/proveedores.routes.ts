/**
 * Proveedores Routes — supplier catalog CRUD endpoints.
 *
 * Endpoints:
 *   GET    /workshop/proveedores         — List suppliers
 *   POST   /workshop/proveedores         — Create supplier
 *   GET    /workshop/proveedores/:id     — Get supplier
 *   PATCH  /workshop/proveedores/:id     — Update supplier
 *   DELETE /workshop/proveedores/:id     — Delete supplier
 *
 * @module workshop/routes/proveedores
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
} from "../services/proveedor.service.js";

export async function proveedoresRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /workshop/proveedores — List ──
  app.get("/workshop/proveedores", async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await listProveedores(request.tenantSlug);
    return reply.send(result);
  });

  // ── POST /workshop/proveedores — Create ──
  app.post(
    "/workshop/proveedores",
    {
      schema: {
        body: {
          type: "object",
          required: ["nombre"],
          properties: {
            nombre: { type: "string", minLength: 1, maxLength: 255 },
            ruc: { type: "string" },
            telefono: { type: "string" },
            email: { type: "string" },
            direccion: { type: "string" },
            tipo: { type: "string", enum: ["REPUESTOS", "SERVICIOS", "AMBOS"] },
            especialidades: { type: "string" },
            calificacion: { type: "integer", minimum: 1, maximum: 5 },
            notas: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await createProveedor(request.body as any, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── GET /workshop/proveedores/:id — Get ──
  app.get<{ Params: { id: string } }>(
    "/workshop/proveedores/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const result = await getProveedorById(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── PATCH /workshop/proveedores/:id — Update ──
  app.patch<{ Params: { id: string }; Body: Record<string, any> }>(
    "/workshop/proveedores/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: Record<string, any> }>, reply: FastifyReply) => {
      const result = await updateProveedor(request.params.id, request.body, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── DELETE /workshop/proveedores/:id — Delete ──
  app.delete<{ Params: { id: string } }>(
    "/workshop/proveedores/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await deleteProveedor(request.params.id, request.tenantSlug);
      return reply.status(204).send();
    },
  );
}
