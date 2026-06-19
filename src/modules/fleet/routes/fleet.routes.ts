/**
 * Fleet Routes — B2B fleet management endpoints.
 *
 * Endpoints:
 *   POST /fleet         — Create fleet client
 *   GET  /fleet         — List fleet clients
 *   GET  /fleet/:id     — Get fleet by ID
 *
 * @module fleet/routes/fleet.routes.ts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createFleet, listFleets, getFleetById } from "../services/fleet.service.js";

interface CreateBody {
  nombre: string;
  empresa: string;
  contacto: string;
  telefono: string;
  email?: string;
  ruc: string;
  contratoTipo: string;
  descuentoPorcentaje?: number;
}

interface IdParams {
  id: string;
}

export async function fleetRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /fleet — Create fleet ──
  app.post<{ Body: CreateBody }>(
    "/fleet",
    {
      schema: {
        body: {
          type: "object",
          required: ["nombre", "empresa", "contacto", "telefono", "ruc", "contratoTipo"],
          properties: {
            nombre: { type: "string" },
            empresa: { type: "string" },
            contacto: { type: "string" },
            telefono: { type: "string" },
            email: { type: "string" },
            ruc: { type: "string" },
            contratoTipo: { type: "string" },
            descuentoPorcentaje: { type: "number", minimum: 0, maximum: 100 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) => {
      const result = await createFleet(request.body, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── GET /fleet — List fleets ──
  app.get(
    "/fleet",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await listFleets(request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /fleet/:id — Get fleet ──
  app.get<{ Params: IdParams }>(
    "/fleet/:id",
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
      const result = await getFleetById(request.params.id, request.tenantSlug);
      if (!result) return reply.status(404).send({ error: "Flota no encontrada" });
      return reply.send(result);
    },
  );
}
