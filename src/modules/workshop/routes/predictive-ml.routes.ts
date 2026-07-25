/**
 * Predictive ML Routes — ML-based vehicle maintenance prediction.
 *
 * Endpoints:
 *   GET  /workshop/predictions/ml/:vehiculoId  — ML prediction for a vehicle
 *   GET  /workshop/predictions/ml               — All high-risk predictions
 *   GET  /workshop/predictions/ml/training-data — ML training statistics
 *
 * @module workshop/routes/predictive-ml.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  predictMlMaintenance,
  getAllMlPredictions,
  getTrainingData,
} from "../services/predictive-ml.service.js";

interface VehiculoParams {
  vehiculoId: string;
}

interface PredictionQuery {
  umbral?: string;
}

export async function predictiveMlRoutes(
  app: FastifyInstance,
): Promise<void> {
  // ── GET /workshop/predictions/ml/:vehiculoId — ML vehicle prediction ──
  app.get<{ Params: VehiculoParams }>(
    "/workshop/predictions/ml/:vehiculoId",
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
      try {
        const result = await predictMlMaintenance(
          request.params.vehiculoId,
          request.tenantSlug,
        );
        return reply.send(result);
      } catch (err: any) {
        return reply.status(404).send({
          error: "NotFoundError",
          message: err.message ?? "Vehículo no encontrado",
        });
      }
    },
  );

  // ── GET /workshop/predictions/ml — All high-risk predictions ──
  app.get<{ Querystring: PredictionQuery }>(
    "/workshop/predictions/ml",
    async (
      request: FastifyRequest<{ Querystring: PredictionQuery }>,
      reply: FastifyReply,
    ) => {
      const umbral = request.query.umbral
        ? parseInt(request.query.umbral, 10)
        : 40;
      const result = await getAllMlPredictions(request.tenantSlug, umbral);
      return reply.send({ total: result.length, items: result });
    },
  );

  // ── GET /workshop/predictions/ml/training-data — ML stats ──
  app.get(
    "/workshop/predictions/ml/training-data",
    async (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const data = await getTrainingData(request.tenantSlug);
      return reply.send(data);
    },
  );
}
