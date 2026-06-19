/**
 * Flat Rate routes — mechanic time tracking endpoints.
 *
 * Endpoints:
 *   POST /workshop/servicios/:id/clock-in   — Start time tracking
 *   POST /workshop/servicios/:id/clock-out  — End time tracking
 *   GET  /workshop/flat-rate/technician/:id — Technician efficiency
 *   GET  /workshop/flat-rate/bay/:number    — Bay profitability
 *
 * @module workshop/routes/flat-rate.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  clockIn,
  clockOut,
  getTechnicianEfficiency,
  getBayProfitability,
} from "../services/flat-rate.service.js";

interface ServicioParams {
  id: string;
}

interface ClockInBody {
  tecnicoId: string;
}

interface TechnicianParams {
  id: string;
}

interface BayParams {
  number: string;
}

export async function flatRateRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /workshop/servicios/:id/clock-in ──
  app.post<{ Params: ServicioParams; Body: ClockInBody }>(
    "/workshop/servicios/:id/clock-in",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["tecnicoId"],
          properties: {
            tecnicoId: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ServicioParams; Body: ClockInBody }>,
      reply: FastifyReply,
    ) => {
      const result = await clockIn(request.params.id, request.body.tecnicoId);
      return reply.status(201).send(result);
    },
  );

  // ── POST /workshop/servicios/:id/clock-out ──
  app.post<{ Params: ServicioParams }>(
    "/workshop/servicios/:id/clock-out",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ServicioParams }>,
      reply: FastifyReply,
    ) => {
      const result = await clockOut(request.params.id);
      return reply.send(result);
    },
  );

  // ── GET /workshop/flat-rate/technician/:id ──
  app.get<{ Params: TechnicianParams }>(
    "/workshop/flat-rate/technician/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: TechnicianParams }>,
      reply: FastifyReply,
    ) => {
      const result = await getTechnicianEfficiency(
        request.params.id,
        request.tenantSlug,
      );
      return reply.send(result);
    },
  );

  // ── GET /workshop/flat-rate/bay/:number ──
  app.get<{ Params: BayParams }>(
    "/workshop/flat-rate/bay/:number",
    {
      schema: {
        params: {
          type: "object",
          required: ["number"],
          properties: { number: { type: "string", pattern: "^[1-9]\\d*$" } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: BayParams }>,
      reply: FastifyReply,
    ) => {
      const bayNumber = parseInt(request.params.number, 10);
      const result = await getBayProfitability(bayNumber, request.tenantSlug);
      return reply.send(result);
    },
  );
}
