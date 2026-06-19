/**
 * TecDoc Routes — External parts catalog integration.
 *
 * Endpoints:
 *   GET /inventory/tecdoc/search/vin        — Search parts by VIN
 *   GET /inventory/tecdoc/search/brand      — Search parts by brand/model
 *   GET /inventory/tecdoc/status            — Check integration status
 *
 * @module inventory/routes/tecdoc.routes.ts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  searchByVIN,
  searchByBrandModel,
  isTecDocConfigured,
} from "../services/tecdoc.service.js";

export async function tecdocRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /inventory/tecdoc/search/vin — Search by VIN ──
  app.get<{ Querystring: { vin: string; q: string } }>(
    "/inventory/tecdoc/search/vin",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["vin", "q"],
          properties: {
            vin: { type: "string", minLength: 17, maxLength: 17 },
            q: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { vin: string; q: string } }>, reply: FastifyReply) => {
      const result = await searchByVIN(request.query.vin, request.query.q);
      return reply.send(result);
    },
  );

  // ── GET /inventory/tecdoc/search/brand — Search by brand/model ──
  app.get<{ Querystring: { brand: string; model: string; year: string; q: string } }>(
    "/inventory/tecdoc/search/brand",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["brand", "model", "year", "q"],
          properties: {
            brand: { type: "string", minLength: 1 },
            model: { type: "string", minLength: 1 },
            year: { type: "string" },
            q: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { brand: string; model: string; year: string; q: string } }>, reply: FastifyReply) => {
      const { brand, model, year, q } = request.query;
      const result = await searchByBrandModel(brand, model, Number(year), q);
      return reply.send(result);
    },
  );

  // ── GET /inventory/tecdoc/status — Check integration status ──
  app.get(
    "/inventory/tecdoc/status",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        configured: isTecDocConfigured(),
        provider: "TecDoc",
      });
    },
  );
}
