/**
 * Stock Adjustment Approval Routes — multi-level approval for stock adjustments.
 *
 * Endpoints:
 *   POST /inventory/adjustments              — Create adjustment request
 *   GET  /inventory/adjustments/pending      — List pending adjustments
 *   POST /inventory/adjustments/:id/approve  — Approve adjustment
 *   POST /inventory/adjustments/:id/reject   — Reject adjustment
 *
 * @module inventory/routes/stock-adjustment-approval
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createAdjustmentRequest,
  listPendingAdjustments,
  approveAdjustment,
  rejectAdjustment,
} from "../services/stock-adjustment-approval.service.js";

export async function stockAdjustmentApprovalRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /inventory/adjustments — Create adjustment request ──
  app.post(
    "/inventory/adjustments",
    {
      schema: {
        body: {
          type: "object",
          required: ["repuestoId", "cantidad", "motivo"],
          properties: {
            repuestoId: { type: "string", format: "uuid" },
            cantidad: { type: "integer" },
            motivo: { type: "string" },
            observaciones: { type: "string" },
            costoUnitario: { type: "number" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as any;
      const result = await createAdjustmentRequest({
        ...body,
        solicitadoPor: (request as any).userId || "system",
        tenantSlug: request.tenantSlug,
      });
      return reply.status(201).send(result);
    },
  );

  // ── GET /inventory/adjustments/pending — List pending ──
  app.get(
    "/inventory/adjustments/pending",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const pending = await listPendingAdjustments(request.tenantSlug);
      return reply.send(pending);
    },
  );

  // ── POST /inventory/adjustments/:id/approve — Approve ──
  app.post<{ Params: { id: string } }>(
    "/inventory/adjustments/:id/approve",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const result = await approveAdjustment(
        request.params.id,
        (request as any).userId || "system",
        request.tenantSlug,
      );
      return reply.send(result);
    },
  );

  // ── POST /inventory/adjustments/:id/reject — Reject ──
  app.post<{ Params: { id: string }; Body: { motivoRechazo: string } }>(
    "/inventory/adjustments/:id/reject",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["motivoRechazo"],
          properties: { motivoRechazo: { type: "string" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { motivoRechazo: string } }>, reply: FastifyReply) => {
      const result = await rejectAdjustment(
        request.params.id,
        (request as any).userId || "system",
        request.body.motivoRechazo,
      );
      return reply.send(result);
    },
  );
}
