/**
 * CRM Deals Routes — pipeline management endpoints.
 *
 * Endpoints:
 *   GET    /crm/stages              — List pipeline stages
 *   POST   /crm/stages              — Create stage
 *   PATCH  /crm/stages/:id          — Update stage
 *   DELETE /crm/stages/:id          — Delete stage
 *   POST   /crm/stages/seed         — Seed default stages
 *   GET    /crm/deals               — List deals
 *   POST   /crm/deals               — Create deal
 *   GET    /crm/deals/:id           — Get deal
 *   PATCH  /crm/deals/:id           — Update deal
 *   POST   /crm/deals/:id/move      — Move deal to stage
 *   POST   /crm/deals/:id/close     — Close deal (won/lost)
 *   DELETE /crm/deals/:id           — Delete deal
 *
 * @module crm/routes/deals.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listStages,
  createStage,
  updateStage,
  deleteStage,
  ensureDefaultStages,
  listDeals,
  getDealById,
  createDeal,
  updateDeal,
  moveDeal,
  closeDeal,
  deleteDeal,
} from "../services/deals.service.js";

export async function dealsRoutes(app: FastifyInstance): Promise<void> {
  // ── Stages ──
  app.get("/crm/stages", async (request: FastifyRequest, reply: FastifyReply) => {
    const stages = await listStages(request.tenantSlug);
    return reply.send(stages);
  });

  app.post(
    "/crm/stages",
    {
      schema: {
        body: {
          type: "object",
          required: ["nombre"],
          properties: {
            nombre: { type: "string" },
            color: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await createStage(request.body as any, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/crm/stages/:id",
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
      const result = await updateStage(request.params.id, request.body as any, request.tenantSlug);
      return reply.send(result);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/crm/stages/:id",
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
      await deleteStage(request.params.id, request.tenantSlug);
      return reply.status(204).send();
    },
  );

  app.post("/crm/stages/seed", async (request: FastifyRequest, reply: FastifyReply) => {
    const stages = await ensureDefaultStages(request.tenantSlug);
    return reply.send(stages);
  });

  // ── Deals ──
  app.get("/crm/deals", async (request: FastifyRequest, reply: FastifyReply) => {
    const deals = await listDeals(request.tenantSlug);
    return reply.send(deals);
  });

  app.post(
    "/crm/deals",
    {
      schema: {
        body: {
          type: "object",
          required: ["titulo", "stageId"],
          properties: {
            titulo: { type: "string" },
            descripcion: { type: "string" },
            clienteNombre: { type: "string" },
            clienteEmail: { type: "string" },
            clientePhone: { type: "string" },
            vehiculoChapa: { type: "string" },
            vehiculoMarca: { type: "string" },
            vehiculoModelo: { type: "string" },
            stageId: { type: "string", format: "uuid" },
            valorEstimado: { type: "number" },
            probabilidad: { type: "integer" },
            fuente: { type: "string" },
            responsable: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await createDeal(request.body as any, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/crm/deals/:id",
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
      const result = await getDealById(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/crm/deals/:id",
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
      const result = await updateDeal(request.params.id, request.body as any, request.tenantSlug);
      return reply.send(result);
    },
  );

  app.post<{ Params: { id: string }; Body: { stageId: string } }>(
    "/crm/deals/:id/move",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["stageId"],
          properties: { stageId: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { stageId: string } }>, reply: FastifyReply) => {
      const result = await moveDeal(request.params.id, request.body.stageId, request.tenantSlug);
      return reply.send(result);
    },
  );

  app.post<{ Params: { id: string }; Body: { ganado: boolean } }>(
    "/crm/deals/:id/close",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["ganado"],
          properties: { ganado: { type: "boolean" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { ganado: boolean } }>, reply: FastifyReply) => {
      const result = await closeDeal(request.params.id, request.body.ganado, request.tenantSlug);
      return reply.send(result);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/crm/deals/:id",
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
      await deleteDeal(request.params.id, request.tenantSlug);
      return reply.status(204).send();
    },
  );
}
