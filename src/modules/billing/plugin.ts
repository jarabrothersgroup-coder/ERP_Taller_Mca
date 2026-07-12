/**
 * Billing Module — Fastify Plugin.
 *
 * Registers billing/subscription routes for SaaS subscription management.
 * Uses Stripe for payment processing with fallback to mock data in dev mode.
 *
 * @module billing/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { billingRoutes } from "./routes/stripe.routes.js";

async function billingPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);
  await app.register(billingRoutes);
  app.log.info("Billing module registered (Stripe subscriptions)");
}

export default billingPlugin;
