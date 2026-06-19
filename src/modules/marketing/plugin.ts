/**
 * Marketing Module — Fastify Plugin.
 *
 * Registers marketing-related routes for:
 *   - Campaign management (WhatsApp/email/SMS)
 *   - Google Reviews monitoring
 *   - Loyalty program
 *   - Digital Ads tracking
 *
 * @module marketing/plugin.ts
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { campaignRoutes } from "./routes/campaign.routes.js";

async function marketingPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);
  await app.register(campaignRoutes);
  app.log.info("Marketing module registered");
}

export default marketingPlugin;
