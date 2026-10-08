/**
 * Fleet Contracts Routes — recurring billing endpoints.
 *
 * Endpoints:
 *   GET  /fleet/:fleetId/contracts     — List contracts for fleet
 *   POST /fleet/billing/run            — Manual billing trigger
 *   GET  /fleet/billing/stats          — Billing statistics
 *
 * @module fleet/routes/fleet-contracts.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listContractsByFleet,
  generateMonthlyInvoices,
  getBillingStats,
} from "../services/recurring-billing.service.js";

interface FleetParams {
  fleetId: string;
}

export async function fleetContractsRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /fleet/:fleetId/contracts — List contracts ──
  app.get<{ Params: FleetParams }>(
    "/fleet/:fleetId/contracts",
    {
      schema: {
        params: {
          type: "object",
          required: ["fleetId"],
          properties: { fleetId: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: FleetParams }>, reply: FastifyReply) => {
      const result = await listContractsByFleet(request.params.fleetId, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── POST /fleet/billing/run — Manual billing trigger ──
  app.post(
    "/fleet/billing/run",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const results = await generateMonthlyInvoices(request.tenantSlug);
      return reply.send({ generated: results.length, invoices: results });
    },
  );

  // ── GET /fleet/billing/stats — Billing statistics ──
  app.get(
    "/fleet/billing/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const stats = await getBillingStats(request.tenantSlug);
      return reply.send(stats);
    },
  );
}
