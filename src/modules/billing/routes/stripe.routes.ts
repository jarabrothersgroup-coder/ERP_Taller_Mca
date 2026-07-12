/**
 * Billing module — Fastify routes.
 *
 * Endpoints:
 *   GET  /billing/plans             — List all available plans
 *   GET  /billing/subscription      — Get current tenant subscription
 *   GET  /billing/invoices          — Get billing history
 *   POST /billing/checkout          — Create Stripe Checkout session
 *   POST /billing/webhook           — Stripe webhook receiver
 *
 * @module billing/routes
 */

import type { FastifyInstance } from "fastify";
import {
  getPlans,
  getSubscription,
  getInvoices,
  createCheckoutSession,
  processWebhookEvent,
} from "../services/stripe.service.js";

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /billing/plans
   * Returns all active billing plans.
   */
  app.get("/billing/plans", async (_req, reply) => {
    const allPlans = await getPlans();
    return reply.send({ plans: allPlans });
  });

  /**
   * GET /billing/subscription
   * Returns the current tenant's subscription.
   */
  app.get("/billing/subscription", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return reply.code(401).send({ error: "Unauthorized" });

    const sub = await getSubscription(tenantId);
    return reply.send({ subscription: sub });
  });

  /**
   * GET /billing/invoices
   * Returns billing history for the current tenant.
   */
  app.get("/billing/invoices", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return reply.code(401).send({ error: "Unauthorized" });

    const invoices = await getInvoices(tenantId);
    return reply.send({ invoices });
  });

  /**
   * POST /billing/checkout
   * Creates a Stripe Checkout session for upgrading/changing plans.
   */
  app.post("/billing/checkout", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return reply.code(401).send({ error: "Unauthorized" });

    const body = req.body as {
      planId: string;
      interval?: "monthly" | "annual";
    };

    const baseUrl = process.env.APP_URL || "http://localhost:3000";
    const result = await createCheckoutSession(
      {
        planId: body.planId,
        interval: body.interval || "monthly",
        successUrl: `${baseUrl}/dashboard/billing?checkout=success`,
        cancelUrl: `${baseUrl}/dashboard/billing?checkout=cancelled`,
      },
      tenantId,
    );

    return reply.send(result);
  });

  /**
   * POST /billing/webhook
   * Stripe webhook receiver. Verifies signature when STRIPE_WEBHOOK_SECRET is set.
   */
  app.post("/billing/webhook", async (req, reply) => {
    const body = req.body as any;
    const eventType = body.type;
    const data = body.data?.object;

    if (!eventType || !data) {
      return reply.code(400).send({ error: "Invalid webhook payload" });
    }

    app.log.info({ eventType }, "Received Stripe webhook event");

    try {
      await processWebhookEvent(eventType, data);
      return reply.send({ received: true });
    } catch (err: any) {
      app.log.error({ err, eventType }, "Webhook processing failed");
      return reply.code(500).send({ error: "Webhook processing failed" });
    }
  });
}
