/**
 * Loyalty Routes — customer rewards and points endpoints.
 *
 * Endpoints:
 *   GET  /marketing/loyalty/:clienteId            — Get loyalty account
 *   GET  /marketing/loyalty/:clienteId/movements  — Points ledger
 *   POST /marketing/loyalty/:clienteId/points     — Credit points (acreditar)
 *   POST /marketing/loyalty/:clienteId/redeem     — Debit points (canjear)
 *   POST /marketing/loyalty/:clienteId/redeem/:rewardId — Redeem catalog reward
 *   GET  /marketing/rewards                       — List available rewards
 *
 * Las escrituras exigen `requireManager`: acreditar o canjear puntos altera un
 * saldo que el cliente ve, así que no puede hacerlo un usuario de lectura.
 *
 * @module marketing/routes/loyalty.routes.ts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireManager } from "../../../shared/middleware/rbac.js";
import {
  addPoints,
  getLoyaltyAccount,
  getLoyaltyTransactions,
  getRewards,
  redeemPoints,
  redeemReward,
} from "../services/loyalty.service.js";

interface ClienteParams {
  clienteId: string;
}

interface PointsBody {
  puntos: number;
  descripcion?: string;
}

interface RedeemParams {
  clienteId: string;
  rewardId: string;
}

const CLIENTE_UUID = { type: "string", format: "uuid" } as const;

export async function loyaltyRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /marketing/loyalty/:clienteId — Get loyalty account ──
  app.get<{ Params: ClienteParams }>(
    "/marketing/loyalty/:clienteId",
    { schema: { params: { type: "object", required: ["clienteId"], properties: { clienteId: CLIENTE_UUID } } } },
    async (request: FastifyRequest<{ Params: ClienteParams }>, reply: FastifyReply) => {
      const result = await getLoyaltyAccount(request.params.clienteId, request.tenantSlug);
      if (!result) {
        return reply.status(404).send({ error: "Cuenta de fidelización no encontrada" });
      }
      return reply.send(result);
    },
  );

  // ── GET /marketing/loyalty/:clienteId/movements — Points ledger ──
  app.get<{ Params: ClienteParams; Querystring: { limit?: number } }>(
    "/marketing/loyalty/:clienteId/movements",
    {
      schema: {
        params: { type: "object", required: ["clienteId"], properties: { clienteId: CLIENTE_UUID } },
        querystring: {
          type: "object",
          properties: { limit: { type: "integer", minimum: 1, maximum: 200 } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ClienteParams; Querystring: { limit?: number } }>, reply: FastifyReply) => {
      const result = await getLoyaltyTransactions(
        request.params.clienteId,
        request.tenantSlug,
        request.query.limit ?? 50,
      );
      return reply.send(result);
    },
  );

  // ── POST /marketing/loyalty/:clienteId/points — Credit points ──
  app.post<{ Params: ClienteParams; Body: PointsBody }>(
    "/marketing/loyalty/:clienteId/points",
    {
      preHandler: requireManager,
      schema: {
        params: { type: "object", required: ["clienteId"], properties: { clienteId: CLIENTE_UUID } },
        body: {
          type: "object",
          required: ["puntos"],
          properties: {
            puntos: { type: "integer", minimum: 1 },
            descripcion: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ClienteParams; Body: PointsBody }>, reply: FastifyReply) => {
      const result = await addPoints(
        request.params.clienteId,
        request.body.puntos,
        request.body.descripcion ?? "Crédito manual de puntos",
        request.tenantSlug,
      );
      return reply.status(201).send(result);
    },
  );

  // ── POST /marketing/loyalty/:clienteId/redeem — Debit points ──
  app.post<{ Params: ClienteParams; Body: PointsBody }>(
    "/marketing/loyalty/:clienteId/redeem",
    {
      preHandler: requireManager,
      schema: {
        params: { type: "object", required: ["clienteId"], properties: { clienteId: CLIENTE_UUID } },
        body: {
          type: "object",
          required: ["puntos"],
          properties: {
            puntos: { type: "integer", minimum: 1 },
            descripcion: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ClienteParams; Body: PointsBody }>, reply: FastifyReply) => {
      const result = await redeemPoints(
        request.params.clienteId,
        request.body.puntos,
        request.body.descripcion ?? "Canje manual de puntos",
        request.tenantSlug,
      );
      return reply.send(result);
    },
  );

  // ── POST /marketing/loyalty/:clienteId/redeem/:rewardId — Redeem catalog reward ──
  app.post<{ Params: RedeemParams }>(
    "/marketing/loyalty/:clienteId/redeem/:rewardId",
    {
      preHandler: requireManager,
      schema: {
        params: {
          type: "object",
          required: ["clienteId", "rewardId"],
          properties: { clienteId: CLIENTE_UUID, rewardId: CLIENTE_UUID },
        },
      },
    },
    async (request: FastifyRequest<{ Params: RedeemParams }>, reply: FastifyReply) => {
      const result = await redeemReward(
        request.params.clienteId,
        request.params.rewardId,
        request.tenantSlug,
      );
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
