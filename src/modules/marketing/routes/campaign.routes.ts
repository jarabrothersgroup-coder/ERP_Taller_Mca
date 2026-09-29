/**
 * Marketing Campaign Routes — campaign management endpoints.
 *
 * Endpoints:
 *   POST   /marketing/campaigns      — Create campaign
 *   GET    /marketing/campaigns      — List campaigns
 *   GET    /marketing/campaigns/stats — Campaign statistics
 *   DELETE /marketing/campaigns/:id  — Delete campaign (destructivo → manager+)
 *
 * @module marketing/routes/campaign.routes.ts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireManager } from "../../../shared/middleware/rbac.js";
import {
  createCampaign,
  listCampaigns,
  getCampaignStats,
  deleteCampaign,
} from "../services/campaign.service.js";

interface CreateBody {
  nombre: string;
  tipo: "whatsapp" | "email" | "sms";
  mensaje: string;
  programadaAt?: string;
  segmento?: string;
}

interface IdParams {
  id: string;
}

export async function campaignRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /marketing/campaigns — Create campaign ──
  app.post<{ Body: CreateBody }>(
    "/marketing/campaigns",
    {
      schema: {
        body: {
          type: "object",
          required: ["nombre", "tipo", "mensaje"],
          properties: {
            nombre: { type: "string", maxLength: 100 },
            tipo: { type: "string", enum: ["whatsapp", "email", "sms"] },
            mensaje: { type: "string", maxLength: 2000 },
            programadaAt: { type: "string", format: "date-time" },
            segmento: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) => {
      const result = await createCampaign(request.body, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── GET /marketing/campaigns — List campaigns ──
  app.get(
    "/marketing/campaigns",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await listCampaigns(request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /marketing/campaigns/stats — Statistics ──
  app.get(
    "/marketing/campaigns/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await getCampaignStats(request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── DELETE /marketing/campaigns/:id — Delete campaign (destructivo → manager+) ──
  app.delete<{ Params: IdParams }>(
    "/marketing/campaigns/:id",
    {
      preHandler: requireManager,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      await deleteCampaign(request.params.id, request.tenantSlug);
      return reply.send({ deleted: true });
    },
  );
}
