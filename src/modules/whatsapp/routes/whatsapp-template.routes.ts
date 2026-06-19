/**
 * WhatsApp Template Routes — CRUD, preview, and variable reference.
 *
 * Routes:
 *   GET    /whatsapp/templates              — List all templates
 *   GET    /whatsapp/templates/:key         — Get template by key
 *   POST   /whatsapp/templates              — Create/update template
 *   DELETE /whatsapp/templates/:key         — Delete template
 *   POST   /whatsapp/templates/preview      — Preview with sample data
 *   POST   /whatsapp/templates/seed         — Seed default templates
 *   GET    /whatsapp/templates/variables    — List available variables
 *
 * @module whatsapp/routes/whatsapp-template
 */

import type { FastifyInstance } from "fastify";
import {
  listTemplates,
  getTemplate,
  upsertTemplate,
  deleteTemplate,
  previewTemplate,
  extractVariables,
  seedDefaultTemplates,
  TEMPLATE_VARIABLES,
} from "../services/whatsapp-template.service.js";
import {
  scheduleFollowup,
  scheduleAutoFollowup,
  listFollowups,
  cancelFollowup,
  getFollowupStats,
  processDueFollowups,
} from "../services/whatsapp-followup.service.js";

export async function whatsappTemplateRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /whatsapp/templates — List templates ──
  app.get("/whatsapp/templates", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const templates = await listTemplates(tenantSlug);
    reply.send(templates);
  });

  // ── GET /whatsapp/templates/variables — List variables ──
  app.get("/whatsapp/templates/variables", async (_request, reply) => {
    reply.send(TEMPLATE_VARIABLES);
  });

  // ── GET /whatsapp/templates/:key — Get template ──
  app.get("/whatsapp/templates/:key", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { key } = request.params as { key: string };
    const template = await getTemplate(tenantSlug, key);
    if (!template) return reply.status(404).send({ error: "Template not found" });
    reply.send(template);
  });

  // ── POST /whatsapp/templates — Create/update ──
  app.post("/whatsapp/templates", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const body = request.body as {
      key: string;
      name: string;
      body: string;
      category?: string;
      active?: boolean;
      triggerEvent?: string | null;
      triggerDelayHours?: string;
    };

    if (!body.key || !body.name || !body.body) {
      return reply.status(400).send({ error: "key, name, body are required" });
    }

    const template = await upsertTemplate(tenantSlug, body);
    reply.status(201).send(template);
  });

  // ── DELETE /whatsapp/templates/:key — Delete ──
  app.delete("/whatsapp/templates/:key", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { key } = request.params as { key: string };
    await deleteTemplate(tenantSlug, key);
    reply.send({ success: true });
  });

  // ── POST /whatsapp/templates/preview — Preview ──
  app.post("/whatsapp/templates/preview", async (request, reply) => {
    const { body, sampleData } = request.body as {
      body: string;
      sampleData?: Record<string, string>;
    };

    if (!body) return reply.status(400).send({ error: "body is required" });

    const preview = previewTemplate(body, sampleData);
    const variables = extractVariables(body);

    reply.send({ preview, variables });
  });

  // ── POST /whatsapp/templates/seed — Seed defaults ──
  app.post("/whatsapp/templates/seed", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const seeded = await seedDefaultTemplates(tenantSlug);
    reply.send({ seeded, message: `${seeded} templates created` });
  });

  // ── POST /whatsapp/followups — Schedule follow-up ──
  app.post("/whatsapp/followups", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const body = request.body as {
      templateKey: string;
      ordenId?: string;
      phone: string;
      variables: Record<string, string>;
      scheduledAt: string;
    };

    if (!body.templateKey || !body.phone || !body.scheduledAt) {
      return reply
        .status(400)
        .send({ error: "templateKey, phone, scheduledAt are required" });
    }

    const followup = await scheduleFollowup({
      tenantSlug,
      ...body,
      scheduledAt: new Date(body.scheduledAt),
    });

    reply.status(201).send(followup);
  });

  // ── POST /whatsapp/followups/auto — Schedule auto-follow-up ──
  app.post("/whatsapp/followups/auto", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const body = request.body as {
      triggerEvent: string;
      ordenId: string;
      phone: string;
      variables: Record<string, string>;
    };

    const followups = await scheduleAutoFollowup({
      tenantSlug,
      ...body,
    });

    reply.status(201).send({ scheduled: followups.length, followups });
  });

  // ── GET /whatsapp/followups — List follow-ups ──
  app.get("/whatsapp/followups", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { status, ordenId, limit } = request.query as {
      status?: string;
      ordenId?: string;
      limit?: string;
    };

    const followups = await listFollowups(tenantSlug, {
      status,
      ordenId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    reply.send(followups);
  });

  // ── GET /whatsapp/followups/stats — Stats ──
  app.get("/whatsapp/followups/stats", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const stats = await getFollowupStats(tenantSlug);
    reply.send(stats);
  });

  // ── POST /whatsapp/followups/:id/cancel — Cancel ──
  app.post("/whatsapp/followups/:id/cancel", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { id } = request.params as { id: string };
    await cancelFollowup(id, tenantSlug);
    reply.send({ success: true });
  });

  // ── POST /whatsapp/followups/process — Process due ──
  app.post("/whatsapp/followups/process", async (_request, reply) => {
    const processed = await processDueFollowups();
    reply.send({ processed });
  });
}
