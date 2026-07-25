/**
 * Marketing Module — Fastify Plugin.
 *
 * Registers marketing-related routes for:
 *   - Campaign management (WhatsApp/email/SMS)
 *   - Sequence automation (drip campaigns)
 *   - Google Reviews monitoring
 *   - Loyalty program
 *
 * @module marketing/plugin.ts
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { campaignRoutes } from "./routes/campaign.routes.js";
import { reviewRoutes } from "./routes/review.routes.js";
import { loyaltyRoutes } from "./routes/loyalty.routes.js";
import { sequenceRoutes } from "./routes/sequence.routes.js";
import { startSequenceCheckCron } from "./jobs/sequence-check.cron.js";

async function marketingPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);
  await app.register(campaignRoutes);
  await app.register(sequenceRoutes);
  await app.register(reviewRoutes);
  await app.register(loyaltyRoutes);

  // ── G-19: Start sequence automation cron ──
  startSequenceCheckCron();

  app.log.info("Marketing module registered (with sequences)");
}

export default marketingPlugin;
