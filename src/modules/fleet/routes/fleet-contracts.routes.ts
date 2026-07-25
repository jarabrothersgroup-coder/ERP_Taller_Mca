/**
 * Fleet Contracts Routes — recurring billing endpoints.
 *
 * Endpoints:
 *   POST /fleet/contracts              — Create contract
 *   GET  /fleet/:fleetId/contracts     — List contracts for fleet
 *   PATCH /fleet/contracts/:id         — Update contract
 *   POST /fleet/contracts/:id/cancel   — Cancel contract
 *   POST /fleet/billing/run            — Manual billing trigger
 *   GET  /fleet/billing/stats          — Billing statistics
 *
 * @module fleet/routes/fleet-contracts.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createContract,
  listContractsByFleet,
  updateContract,
  cancelContract,
  generateMonthlyInvoices,
  getBillingStats,
} from "../services/recurring-billing.service.js";

interface CreateBody {
  fleetId: string;
  nombre: string;
  montoMensual: number;
  cicloFacturacion?: string;
  diaCobro?: number;
  descripcion?: string;
}

interface UpdateBody {
  nombre?: string;
  montoMensual?: number;
  cicloFacturacion?: string;
  diaCobro?: number;
  descripcion?: string;
}

interface FleetParams {
  fleetId: string;
}

interface ContractParams {
  id: string;
}

export async function fleetContractsRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /fleet/contracts — Create contract ──
  app.post<{ Body: CreateBody }>(
    "/fleet/contracts",
    {
      schema: {
        body: {
          type: "object",
          required: ["fleetId", "nombre", "montoMensual"],
          properties: {
            fleetId: { type: "string", format: "uuid" },
            nombre: { type: "string", maxLength: 100 },
            montoMensual: { type: "number", minimum: 0 },
            cicloFacturacion: { type: "string", enum: ["MENSUAL", "TRIMESTRAL", "ANUAL"] },
            diaCobro: { type: "number", minimum: 1, maximum: 28 },
            descripcion: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) => {
      const result = await createContract(request.body, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

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

  // ── PATCH /fleet/contracts/:id — Update contract ──
  app.patch<{ Params: ContractParams; Body: UpdateBody }>(
    "/fleet/contracts/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ContractParams; Body: UpdateBody }>, reply: FastifyReply) => {
      const result = await updateContract(request.params.id, request.body, request.tenantSlug);
      if (!result) return reply.status(404).send({ error: "Contrato no encontrado" });
      return reply.send(result);
    },
  );

  // ── POST /fleet/contracts/:id/cancel — Cancel contract ──
  app.post<{ Params: ContractParams }>(
    "/fleet/contracts/:id/cancel",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ContractParams }>, reply: FastifyReply) => {
      const ok = await cancelContract(request.params.id, request.tenantSlug);
      if (!ok) return reply.status(404).send({ error: "Contrato no encontrado" });
      return reply.send({ ok: true });
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
