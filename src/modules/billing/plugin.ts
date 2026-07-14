/**
 * Billing Module — Fastify Plugin.
 *
 * Registers billing/subscription routes for SaaS subscription management.
 * Uses Stripe for payment processing with fallback to mock data in dev mode.
 *
 * Routes:
 *   GET  /billing/plans        — List plans (public)
 *   GET  /billing/subscription  — Current tenant subscription
 *   GET  /billing/invoices     — Billing history
 *   POST /billing/checkout     — Stripe Checkout session
 *   POST /billing/portal       — Stripe Customer Portal
 *   POST /billing/webhook      — Stripe webhook (no auth)
 *
 * @module billing/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { resolveProfile } from "../../shared/middleware/rbac.js";
import { billingRoutes } from "./routes/stripe.routes.js";

async function billingPlugin(app: FastifyInstance): Promise<void> {
  // Apply tenant resolution to all billing routes except webhook
  app.addHook("onRequest", resolveTenant);
  app.addHook("onRequest", resolveProfile);

  await app.register(billingRoutes, { prefix: "/billing" });
  app.log.info("Billing module registered (/billing/*)");
}

export default billingPlugin;
