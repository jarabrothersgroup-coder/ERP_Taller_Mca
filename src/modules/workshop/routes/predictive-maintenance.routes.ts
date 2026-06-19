/**
 * Predictive Maintenance Routes — vehicle maintenance prediction.
 *
 * Endpoints:
 *   GET /workshop/predictions/:vehiculoId — Predict maintenance for vehicle
 *   GET /workshop/predictions              — Get all urgent predictions
 *
 * @module workshop/routes/predictive-maintenance.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { predictMaintenance, getAllPredictions } from "../services/predictive-maintenance.service.js";

interface VehiculoParams {
  vehiculoId: string;
}

export async function predictiveMaintenanceRoutes(
  app: FastifyInstance,
): Promise<void> {
  // ── GET /workshop/predictions/:vehiculoId — Vehicle prediction ──
  app.get<{ Params: VehiculoParams }>(
    "/workshop/predictions/:vehiculoId",
    {
      schema: {
        params: {
          type: "object",
          required: ["vehiculoId"],
          properties: { vehiculoId: { type: "string", format: "uuid" } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: VehiculoParams }>,
      reply: FastifyReply,
    ) => {
      const result = await predictMaintenance(
        request.params.vehiculoId,
        request.tenantSlug,
      );
      return reply.send(result);
    },
  );

  // ── GET /workshop/predictions — All urgent predictions ──
  app.get(
    "/workshop/predictions",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await getAllPredictions(request.tenantSlug);
      return reply.send({ total: result.length, items: result });
    },
  );
}
