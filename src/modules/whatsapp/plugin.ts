/**
 * WhatsApp Module — Fastify Plugin.
 *
 * Registers WhatsApp integration routes for:
 *   - QR code pairing with Evolution API
 *   - Message sending with templates
 *   - Connection status monitoring
 *   - Message audit log
 *
 * Tenant isolation via X-Tenant-Slug middleware.
 *
 * Usage (in app.ts):
 * ```ts
 * import { whatsappPlugin } from "./modules/whatsapp/plugin.js";
 * await app.register(whatsappPlugin);
 * ```
 *
 * @module whatsapp/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { resolveProfile } from "../../shared/middleware/rbac.js";
import { whatsappRoutes } from "./routes/whatsapp.routes.js";
import { whatsappTemplateRoutes } from "./routes/whatsapp-template.routes.js";
import { startQueueRetryCron } from "./jobs/queue-retry.cron.js";

/**
 * Fastify plugin that bootstraps the WhatsApp Integration module.
 *
 * Features:
 *   - Evolution API gateway integration (QR pairing, messaging)
 *   - Message templates for each workshop order state
 *   - PDF attachment support for presupuesto delivery
 *   - Phone number auto-sanitization (Paraguay +595 format)
 *   - Full message audit log per tenant
 *   - Persistent message queue with automatic retry
 *
 * @param app - Fastify instance
 */
async function whatsappPlugin(app: FastifyInstance): Promise<void> {
  // ── Tenant isolation hook ──
  app.addHook("onRequest", resolveTenant);
  // ── RBAC hook ──
  app.addHook("onRequest", resolveProfile);

  // ── Register WhatsApp routes ──
  await app.register(whatsappRoutes);

  // ── Register Template & Follow-up routes ──
  await app.register(whatsappTemplateRoutes);

  // ── Start queue retry cron ──
  startQueueRetryCron();

  app.log.info("WhatsApp Integration module registered");
}

export default whatsappPlugin;
