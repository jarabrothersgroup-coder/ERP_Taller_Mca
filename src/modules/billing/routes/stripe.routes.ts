/**
 * Billing module — Fastify routes.
 *
 * Endpoints:
 *   GET  /billing/plans             — List all available plans
 *   GET  /billing/subscription      — Get current tenant subscription
 *   GET  /billing/invoices          — Get billing history
 *   POST /billing/checkout          — Create Stripe Checkout session
 *   POST /billing/webhook           — Stripe webhook receiver (no auth)
 *   POST /billing/portal            — Create Stripe Customer Portal session
 *
 * @module billing/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  getPlans,
  getSubscription,
  getInvoices,
  createCheckoutSession,
  createPortalSession,
  processWebhookEvent,
} from "../services/stripe.service.js";

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /billing/plans
   * Returns all active billing plans.
   * Public — no auth required (plan comparison page).
   */
  app.get("/billing/plans", async (_req, reply) => {
    const allPlans = await getPlans();
    return reply.send({ plans: allPlans });
  });

  /**
   * GET /billing/subscription
   * Returns the current tenant's subscription with plan details.
   */
  app.get("/billing/subscription", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = req.tenantSlug;
    if (!tenantSlug) return reply.code(401).send({ error: "Tenant not identified" });

    const sub = await getSubscription(tenantSlug);
    return reply.send({ subscription: sub });
  });

  /**
   * GET /billing/invoices
   * Returns billing history for the current tenant.
   */
  app.get("/billing/invoices", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = req.tenantSlug;
    if (!tenantSlug) return reply.code(401).send({ error: "Tenant not identified" });

    const invoices = await getInvoices(tenantSlug);
    return reply.send({ invoices });
  });

  /**
   * POST /billing/checkout
   * Creates a Stripe Checkout session for upgrading/changing plans.
   */
  app.post("/billing/checkout", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = req.tenantSlug;
    if (!tenantSlug) return reply.code(401).send({ error: "Tenant not identified" });

    const body = req.body as {
      planId: string;
      interval?: "monthly" | "annual";
    };

    const baseUrl = process.env["APP_URL"] || "http://localhost:3000";
    const result = await createCheckoutSession(
      {
        planId: body.planId,
        interval: body.interval || "monthly",
        successUrl: `${baseUrl}/dashboard/billing?checkout=success`,
        cancelUrl: `${baseUrl}/dashboard/billing?checkout=cancelled`,
      },
      tenantSlug,
    );

    return reply.send(result);
  });

  /**
   * POST /billing/portal
   * Creates a Stripe Customer Portal session for managing subscription.
   */
  app.post("/billing/portal", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = req.tenantSlug;
    if (!tenantSlug) return reply.code(401).send({ error: "Tenant not identified" });

    const baseUrl = process.env["APP_URL"] || "http://localhost:3000";
    const result = await createPortalSession(tenantSlug, `${baseUrl}/dashboard/billing`);
    return reply.send(result);
  });

  /**
   * POST /billing/webhook
   * Stripe webhook receiver. Verifies signature when STRIPE_WEBHOOK_SECRET is set.
   * NO AUTH — Stripe calls this directly.
   */
  app.post("/billing/webhook", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as Record<string, unknown>;
    const eventType = body["type"] as string | undefined;
    const data = (body["data"] as Record<string, unknown>)?.["object"] as Record<string, unknown> | undefined;

    if (!eventType || !data) {
      return reply.code(400).send({ error: "Invalid webhook payload" });
    }

    app.log.info({ eventType }, "Received Stripe webhook event");

    try {
      await processWebhookEvent(eventType, data);
      return reply.send({ received: true });
    } catch (err: unknown) {
      app.log.error({ err, eventType }, "Webhook processing failed");
      return reply.code(500).send({ error: "Webhook processing failed" });
    }
  });
}
