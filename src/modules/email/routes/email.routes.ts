/**
 * Email Routes — Send transactional emails via API.
 *
 * Endpoints:
 *   POST /email/send          — Send a transactional email
 *   POST /email/send-invoice  — Send invoice notification
 *   POST /email/send-estimate — Send estimate/budget notification
 *   GET  /email/status        — Check email service status
 *
 * All endpoints are tenant-isolated via X-Tenant-Slug header.
 *
 * @module email/routes/email.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { smartSend } from "../services/email.service.js";
import { isResendConfigured } from "../services/resend.service.js";
import {
  invoiceReadyTemplate,
  estimateTemplate,
  serviceReminderTemplate,
  type InvoiceTemplateData,
  type EstimateTemplateData,
} from "../templates/index.js";

export async function emailRoutes(app: FastifyInstance): Promise<void> {
  // ── Global email send endpoint ─────────────────
  app.post(
    "/email/send",
    {
      schema: {
        body: {
          type: "object",
          required: ["to", "subject", "html"],
          properties: {
            to: { anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
            subject: { type: "string" },
            html: { type: "string" },
            text: { type: "string" },
            entityType: { type: "string" },
            entityId: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { to, subject, html, text, entityType, entityId } = request.body as any;
      const tenantSlug = request.tenantSlug;

      const result = await smartSend({ to, subject, html, text, entityType, entityId, tenantSlug });

      if (!result.success) {
        return reply.status(500).send({ error: result.error });
      }

      return reply.send({ messageId: result.messageId });
    },
  );

  // ── Send invoice email ────────────────────────
  app.post(
    "/email/send-invoice",
    {
      schema: {
        body: {
          type: "object",
          required: ["to", "data"],
          properties: {
            to: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { to, data } = request.body as { to: string; data: InvoiceTemplateData };
      const tenantSlug = request.tenantSlug;
      const html = invoiceReadyTemplate(data);
      const subject = `Factura Electrónica #${data.numeroFactura} — AutomotiveOS`;

      const result = await smartSend({ to, subject, html, entityType: "factura", entityId: data.numeroFactura, tenantSlug });

      if (!result.success) {
        return reply.status(500).send({ error: result.error });
      }

      return reply.send({ messageId: result.messageId, message: `Factura #${data.numeroFactura} enviada a ${to}` });
    },
  );

  // ── Send estimate email ───────────────────────
  app.post(
    "/email/send-estimate",
    {
      schema: {
        body: {
          type: "object",
          required: ["to", "data"],
          properties: {
            to: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { to, data } = request.body as { to: string; data: EstimateTemplateData };
      const tenantSlug = request.tenantSlug;
      const html = estimateTemplate(data);
      const subject = `Presupuesto #${data.numeroEstimacion} — AutomotiveOS`;

      const result = await smartSend({ to, subject, html, entityType: "presupuesto", entityId: data.numeroEstimacion, tenantSlug });

      if (!result.success) {
        return reply.status(500).send({ error: result.error });
      }

      return reply.send({ messageId: result.messageId, message: `Presupuesto #${data.numeroEstimacion} enviado a ${to}` });
    },
  );

  // ── Send reminder email ───────────────────────
  app.post(
    "/email/send-reminder",
    {
      schema: {
        body: {
          type: "object",
          required: ["to", "data"],
          properties: {
            to: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { to, data } = request.body as any;
      const tenantSlug = request.tenantSlug;
      const html = serviceReminderTemplate(data);
      const subject = "Recordatorio de Servicio — AutomotiveOS";

      const result = await smartSend({ to, subject, html, entityType: "recordatorio", tenantSlug });

      if (!result.success) {
        return reply.status(500).send({ error: result.error });
      }

      return reply.send({ messageId: result.messageId });
    },
  );

  // ── Email service status ──────────────────────
  app.get(
    "/email/status",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const providers: string[] = [];
      if (isResendConfigured()) providers.push("resend");
      if (process.env["SMTP_USER"] && process.env["SMTP_PASS"]) providers.push("smtp");

      return reply.send({
        configured: providers.length > 0,
        providers,
        resendConfigured: isResendConfigured(),
        smtpConfigured: Boolean(process.env["SMTP_USER"] && process.env["SMTP_PASS"]),
      });
    },
  );
}
