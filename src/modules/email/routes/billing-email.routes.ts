/**
 * Billing Email Routes — Send billing-related transactional emails.
 *
 * Endpoints:
 *   POST /email/billing/subscription-activated — Send subscription activation email
 *   POST /email/billing/payment-failed        — Send payment failure notification
 *   POST /email/billing/subscription-cancelled — Send subscription cancellation email
 *   POST /email/billing/trial-ending           — Send trial ending soon notification
 *
 * All endpoints are tenant-isolated via X-Tenant-Slug header.
 *
 * @module email/routes/billing-email.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { smartSend } from "../services/email.service.js";
import {
  subscriptionActivatedTemplate,
  paymentFailedTemplate,
  subscriptionCancelledTemplate,
  trialEndingTemplate,
  type SubscriptionActivatedTemplateData,
  type PaymentFailedTemplateData,
  type SubscriptionCancelledTemplateData,
  type TrialEndingTemplateData,
} from "../templates/index.js";

export async function billingEmailRoutes(app: FastifyInstance): Promise<void> {
  // ── Send subscription activated email ─────────────────
  app.post(
    "/email/billing/subscription-activated",
    {
      schema: {
        tags: ["Email", "Billing"],
        summary: "Enviar email de suscripción activada",
        description: "Sends a subscription activation confirmation email to the tenant admin.",
        headers: {
          type: "object",
          required: ["X-Tenant-Slug"],
          properties: {
            "X-Tenant-Slug": { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["to", "data"],
          properties: {
            to: { type: "string", description: "Recipient email address" },
            data: {
              type: "object",
              required: ["tenantName", "planName", "interval", "price", "nextBillingDate"],
              properties: {
                tenantName: { type: "string" },
                planName: { type: "string" },
                interval: { type: "string", enum: ["monthly", "annual"] },
                price: { type: "string" },
                nextBillingDate: { type: "string" },
              },
            },
          },
        },
        response: {
          200: { type: "object", properties: { messageId: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { to, data } = request.body as { to: string; data: SubscriptionActivatedTemplateData };
      const tenantSlug = request.tenantSlug;
      const html = subscriptionActivatedTemplate(data);
      const subject = `✅ Suscripción ${data.planName} Activada — AutomotiveOS`;

      const result = await smartSend({ to, subject, html, entityType: "billing", entityId: "subscription-activated", tenantSlug });

      if (!result.success) {
        return reply.status(500).send({ error: result.error });
      }

      return reply.send({ messageId: result.messageId });
    },
  );

  // ── Send payment failed email ────────────────────────
  app.post(
    "/email/billing/payment-failed",
    {
      schema: {
        tags: ["Email", "Billing"],
        summary: "Enviar email de pago fallido",
        description: "Sends a payment failure notification email to the tenant admin.",
        headers: {
          type: "object",
          required: ["X-Tenant-Slug"],
          properties: {
            "X-Tenant-Slug": { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["to", "data"],
          properties: {
            to: { type: "string" },
            data: {
              type: "object",
              required: ["tenantName", "planName", "amount", "dueDate", "invoiceId"],
              properties: {
                tenantName: { type: "string" },
                planName: { type: "string" },
                amount: { type: "string" },
                dueDate: { type: "string" },
                invoiceId: { type: "string" },
              },
            },
          },
        },
        response: {
          200: { type: "object", properties: { messageId: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { to, data } = request.body as { to: string; data: PaymentFailedTemplateData };
      const tenantSlug = request.tenantSlug;
      const html = paymentFailedTemplate(data);
      const subject = `⚠️ Pago Fallido — ${data.planName} — AutomotiveOS`;

      const result = await smartSend({ to, subject, html, entityType: "billing", entityId: "payment-failed", tenantSlug });

      if (!result.success) {
        return reply.status(500).send({ error: result.error });
      }

      return reply.send({ messageId: result.messageId });
    },
  );

  // ── Send subscription cancelled email ─────────────────
  app.post(
    "/email/billing/subscription-cancelled",
    {
      schema: {
        tags: ["Email", "Billing"],
        summary: "Enviar email de suscripción cancelada",
        description: "Sends a subscription cancellation confirmation email to the tenant admin.",
        headers: {
          type: "object",
          required: ["X-Tenant-Slug"],
          properties: {
            "X-Tenant-Slug": { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["to", "data"],
          properties: {
            to: { type: "string" },
            data: {
              type: "object",
              required: ["tenantName", "planName", "cancelDate", "accessUntil"],
              properties: {
                tenantName: { type: "string" },
                planName: { type: "string" },
                cancelDate: { type: "string" },
                accessUntil: { type: "string" },
              },
            },
          },
        },
        response: {
          200: { type: "object", properties: { messageId: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { to, data } = request.body as { to: string; data: SubscriptionCancelledTemplateData };
      const tenantSlug = request.tenantSlug;
      const html = subscriptionCancelledTemplate(data);
      const subject = `❌ Suscripción Cancelada — ${data.planName} — AutomotiveOS`;

      const result = await smartSend({ to, subject, html, entityType: "billing", entityId: "subscription-cancelled", tenantSlug });

      if (!result.success) {
        return reply.status(500).send({ error: result.error });
      }

      return reply.send({ messageId: result.messageId });
    },
  );

  // ── Send trial ending email ──────────────────────────
  app.post(
    "/email/billing/trial-ending",
    {
      schema: {
        tags: ["Email", "Billing"],
        summary: "Enviar email de período de prueba por vencer",
        description: "Sends a trial ending soon notification email to the tenant admin.",
        headers: {
          type: "object",
          required: ["X-Tenant-Slug"],
          properties: {
            "X-Tenant-Slug": { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["to", "data"],
          properties: {
            to: { type: "string" },
            data: {
              type: "object",
              required: ["tenantName", "planName", "trialEndDate", "daysRemaining"],
              properties: {
                tenantName: { type: "string" },
                planName: { type: "string" },
                trialEndDate: { type: "string" },
                daysRemaining: { type: "integer" },
              },
            },
          },
        },
        response: {
          200: { type: "object", properties: { messageId: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { to, data } = request.body as { to: string; data: TrialEndingTemplateData };
      const tenantSlug = request.tenantSlug;
      const html = trialEndingTemplate(data);
      const subject = `⏰ Período de Prueba por Vencer — ${data.planName} — AutomotiveOS`;

      const result = await smartSend({ to, subject, html, entityType: "billing", entityId: "trial-ending", tenantSlug });

      if (!result.success) {
        return reply.status(500).send({ error: result.error });
      }

      return reply.send({ messageId: result.messageId });
    },
  );
}
