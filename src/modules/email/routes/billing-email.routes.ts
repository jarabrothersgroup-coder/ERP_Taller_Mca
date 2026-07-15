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
 * Recipient email is auto-resolved from tenant's admin profile (no `to` parameter).
 *
 * @module email/routes/billing-email.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { smartSend } from "../services/email.service.js";
import { resolveTenantAdminEmail } from "../../../shared/utils/tenant-email.js";
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
        description: "Sends a subscription activation confirmation email to the tenant's admin. Email is auto-resolved from tenant context.",
        headers: {
          type: "object",
          required: ["X-Tenant-Slug"],
          properties: {
            "X-Tenant-Slug": { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["data"],
          properties: {
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
          200: { type: "object", properties: { messageId: { type: "string" }, sentTo: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = request.tenantSlug;
      if (!tenantSlug) return reply.status(401).send({ error: "Tenant not identified" });

      const email = await resolveTenantAdminEmail(tenantSlug);
      if (!email) return reply.status(404).send({ error: "No admin email found for this tenant" });

      const { data } = request.body as { data: SubscriptionActivatedTemplateData };
      const html = subscriptionActivatedTemplate(data);
      const subject = `✅ Suscripción ${data.planName} Activada — AutomotiveOS`;

      const result = await smartSend({ to: email, subject, html, entityType: "billing", entityId: "subscription-activated", tenantSlug });

      if (!result.success) {
        return reply.status(500).send({ error: result.error });
      }

      return reply.send({ messageId: result.messageId, sentTo: email });
    },
  );

  // ── Send payment failed email ────────────────────────
  app.post(
    "/email/billing/payment-failed",
    {
      schema: {
        tags: ["Email", "Billing"],
        summary: "Enviar email de pago fallido",
        description: "Sends a payment failure notification email to the tenant's admin. Email is auto-resolved from tenant context.",
        headers: {
          type: "object",
          required: ["X-Tenant-Slug"],
          properties: {
            "X-Tenant-Slug": { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["data"],
          properties: {
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
          200: { type: "object", properties: { messageId: { type: "string" }, sentTo: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = request.tenantSlug;
      if (!tenantSlug) return reply.status(401).send({ error: "Tenant not identified" });

      const email = await resolveTenantAdminEmail(tenantSlug);
      if (!email) return reply.status(404).send({ error: "No admin email found for this tenant" });

      const { data } = request.body as { data: PaymentFailedTemplateData };
      const html = paymentFailedTemplate(data);
      const subject = `⚠️ Pago Fallido — ${data.planName} — AutomotiveOS`;

      const result = await smartSend({ to: email, subject, html, entityType: "billing", entityId: "payment-failed", tenantSlug });

      if (!result.success) {
        return reply.status(500).send({ error: result.error });
      }

      return reply.send({ messageId: result.messageId, sentTo: email });
    },
  );

  // ── Send subscription cancelled email ─────────────────
  app.post(
    "/email/billing/subscription-cancelled",
    {
      schema: {
        tags: ["Email", "Billing"],
        summary: "Enviar email de suscripción cancelada",
        description: "Sends a subscription cancellation confirmation email to the tenant's admin. Email is auto-resolved from tenant context.",
        headers: {
          type: "object",
          required: ["X-Tenant-Slug"],
          properties: {
            "X-Tenant-Slug": { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["data"],
          properties: {
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
          200: { type: "object", properties: { messageId: { type: "string" }, sentTo: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = request.tenantSlug;
      if (!tenantSlug) return reply.status(401).send({ error: "Tenant not identified" });

      const email = await resolveTenantAdminEmail(tenantSlug);
      if (!email) return reply.status(404).send({ error: "No admin email found for this tenant" });

      const { data } = request.body as { data: SubscriptionCancelledTemplateData };
      const html = subscriptionCancelledTemplate(data);
      const subject = `❌ Suscripción Cancelada — ${data.planName} — AutomotiveOS`;

      const result = await smartSend({ to: email, subject, html, entityType: "billing", entityId: "subscription-cancelled", tenantSlug });

      if (!result.success) {
        return reply.status(500).send({ error: result.error });
      }

      return reply.send({ messageId: result.messageId, sentTo: email });
    },
  );

  // ── Send trial ending email ──────────────────────────
  app.post(
    "/email/billing/trial-ending",
    {
      schema: {
        tags: ["Email", "Billing"],
        summary: "Enviar email de período de prueba por vencer",
        description: "Sends a trial ending soon notification email to the tenant's admin. Email is auto-resolved from tenant context.",
        headers: {
          type: "object",
          required: ["X-Tenant-Slug"],
          properties: {
            "X-Tenant-Slug": { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["data"],
          properties: {
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
          200: { type: "object", properties: { messageId: { type: "string" }, sentTo: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = request.tenantSlug;
      if (!tenantSlug) return reply.status(401).send({ error: "Tenant not identified" });

      const email = await resolveTenantAdminEmail(tenantSlug);
      if (!email) return reply.status(404).send({ error: "No admin email found for this tenant" });

      const { data } = request.body as { data: TrialEndingTemplateData };
      const html = trialEndingTemplate(data);
      const subject = `⏰ Período de Prueba por Vencer — ${data.planName} — AutomotiveOS`;

      const result = await smartSend({ to: email, subject, html, entityType: "billing", entityId: "trial-ending", tenantSlug });

      if (!result.success) {
        return reply.status(500).send({ error: result.error });
      }

      return reply.send({ messageId: result.messageId, sentTo: email });
    },
  );
}
