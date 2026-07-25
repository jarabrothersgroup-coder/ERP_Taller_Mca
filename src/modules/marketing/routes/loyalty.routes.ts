/**
 * Loyalty Routes — customer rewards and points endpoints.
 *
 * Endpoints:
 *   GET  /marketing/loyalty/:clienteId — Get loyalty account
 *   GET  /marketing/rewards            — List available rewards
 *
 * @module marketing/routes/loyalty.routes.ts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getLoyaltyAccount, getRewards } from "../services/loyalty.service.js";

interface ClienteParams {
  clienteId: string;
}

export async function loyaltyRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /marketing/loyalty/:clienteId — Get loyalty account ──
  app.get<{ Params: ClienteParams }>(
    "/marketing/loyalty/:clienteId",
    async (
      request: FastifyRequest<{ Params: ClienteParams }>,
      reply: FastifyReply,
    ) => {
      const result = await getLoyaltyAccount(request.params.clienteId, request.tenantSlug);
      if (!result) {
        return reply.status(404).send({ error: "Cuenta de fidelización no encontrada" });
      }
      return reply.send(result);
    },
  );

  // ── GET /marketing/rewards — List available rewards ──
  app.get(
    "/marketing/rewards",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await getRewards(request.tenantSlug);
      return reply.send(result);
    },
  );
}
