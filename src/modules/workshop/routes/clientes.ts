/**
 * Clientes routes — CRUD endpoints for workshop clients (vehicle owners).
 *
 * POST   /workshop/clientes       — Create a new client
 * GET    /workshop/clientes       — List all clients
 * GET    /workshop/clientes/:id   — Get a single client by ID
 * PATCH  /workshop/clientes/:id   — Update a client
 * DELETE /workshop/clientes/:id   — Delete a client
 *
 * All routes require X-Tenant-Slug header (resolved by tenant-resolver).
 *
 * @module workshop/routes/clientes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createClient, updateClient, deleteClient, listClients, getClient } from "../services/client.service.js";
import { getClientHistory } from "../services/history.service.js";

interface ParamsWithId {
  id: string;
}

interface ClientBody {
  name?: string;
  email?: string;
  phone?: string;
  ruc?: string;
  address?: string;
  notes?: string;
}

/**
 * Registers client routes on the Fastify instance.
 */
export async function clientesRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /workshop/clientes — Create client ──
  app.post<{ Body: ClientBody }>(
    "/workshop/clientes",
    {
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1 },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            ruc: { type: "string" },
            address: { type: "string" },
            notes: { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string", nullable: true },
              phone: { type: "string", nullable: true },
              ruc: { type: "string", nullable: true },
              address: { type: "string", nullable: true },
              notes: { type: "string", nullable: true },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: ClientBody }>, reply: FastifyReply) => {
      const client = await createClient(request.body as Record<string, unknown>, request.tenantSlug);
      return reply.status(201).send(client);
    },
  );

  // ── GET /workshop/clientes — List all clients ──
  app.get(
    "/workshop/clientes",
    {
      schema: {
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                email: { type: "string", nullable: true },
                phone: { type: "string", nullable: true },
                ruc: { type: "string", nullable: true },
                address: { type: "string", nullable: true },
                notes: { type: "string", nullable: true },
                createdAt: { type: "string" },
                updatedAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const clients = await listClients(request.tenantSlug);
      return reply.send(clients);
    },
  );

  // ── GET /workshop/clientes/:id — Get single client ──
  app.get<{ Params: ParamsWithId }>(
    "/workshop/clientes/:id",
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
      const client = await getClient(request.params.id, request.tenantSlug);
      return reply.send(client);
    },
  );

  // ── PATCH /workshop/clientes/:id — Update client ──
  app.patch<{ Params: ParamsWithId; Body: ClientBody }>(
    "/workshop/clientes/:id",
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
            name: { type: "string", minLength: 1 },
            email: { type: "string" },
            phone: { type: "string" },
            ruc: { type: "string" },
            address: { type: "string" },
            notes: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ParamsWithId; Body: ClientBody }>, reply: FastifyReply) => {
      const client = await updateClient(request.params.id, request.body as Record<string, unknown>, request.tenantSlug);
      return reply.send(client);
    },
  );

  // ── DELETE /workshop/clientes/:id — Delete client ──
  app.delete<{ Params: ParamsWithId }>(
    "/workshop/clientes/:id",
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
      const result = await deleteClient(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /workshop/clientes/:id/history — Client history ──
  app.get<{ Params: ParamsWithId }>(
    "/workshop/clientes/:id/history",
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
      const history = await getClientHistory(request.params.id, request.tenantSlug);
      return reply.send(history);
    },
  );
}
