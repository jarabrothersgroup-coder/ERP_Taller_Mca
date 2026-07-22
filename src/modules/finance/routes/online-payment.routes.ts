/**
 * Online Payment Routes — Stripe & PagosPy payment links.
 *
 * Sprint 85 — P1-5.
 *
 * Endpoints:
 *   POST /finance/payments/link        — Generate payment link for invoice
 *   POST /finance/payments/webhook     — Unified webhook for Stripe & PagosPy
 *
 * @module finance/routes/online-payment.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { generatePaymentLink, processPaymentWebhook } from "../services/index.js";

export async function onlinePaymentRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /finance/payments/link — Generate payment link ──
  app.post<{
    Body: {
      facturaId: string;
      provider: "STRIPE" | "PAGOS_PY";
      successUrl?: string;
      cancelUrl?: string;
    };
  }>(
    "/finance/payments/link",
    {
      schema: {
        body: {
          type: "object",
          required: ["facturaId", "provider"],
          properties: {
            facturaId: { type: "string", format: "uuid" },
            provider: { type: "string", enum: ["STRIPE", "PAGOS_PY"] },
            successUrl: { type: "string", nullable: true },
            cancelUrl: { type: "string", nullable: true },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { facturaId: string; provider: "STRIPE" | "PAGOS_PY"; successUrl?: string; cancelUrl?: string } }>, reply: FastifyReply) => {
      const result = await generatePaymentLink(
        request.body,
        request.tenantSlug,
      );
      return reply.send(result);
    },
  );

  // ── POST /finance/payments/webhook — Process payment webhook ──
  app.post<{
    Headers: { "x-payment-provider"?: string };
  }>(
    "/finance/payments/webhook",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const provider = (
        request.headers["x-payment-provider"] as string
      ) ?? "STRIPE";

      const result = await processPaymentWebhook(provider, request.body as Record<string, any>);

      if (!result.ok) {
        return reply.status(400).send(result);
      }

      return reply.send(result);
    },
  );
}
