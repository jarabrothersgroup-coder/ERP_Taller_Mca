/**
 * Email Module — Fastify Plugin.
 *
 * Registers transactional email endpoints and provides
 * email sending services (Resend + SMTP fallback).
 *
 * @module email/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { emailRoutes } from "./routes/email.routes.js";
import { billingEmailRoutes } from "./routes/billing-email.routes.js";

/**
 * Registers email-related routes on the Fastify instance.
 *
 * @param app - Fastify instance
 */
async function emailPlugin(app: FastifyInstance): Promise<void> {
  // Resolve tenant from X-Tenant-Slug header for tenant-isolated email logging
  app.addHook("onRequest", resolveTenant);

  await app.register(emailRoutes);
  await app.register(billingEmailRoutes);
  app.log.info("Email module registered (general + billing email routes)");
}

export default emailPlugin;
