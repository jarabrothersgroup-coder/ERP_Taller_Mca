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

/**
 * Capture raw body buffer before JSON parsing for Stripe webhook signature verification.
 * Stripe's constructEvent() requires the original raw bytes, not re-serialized JSON.
 */
function registerRawBodyParser(app: FastifyInstance): void {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req: FastifyRequest, body: Buffer, done: (err: Error | null, body?: unknown) => void) => {
      // Attach raw body to request for webhook verification
      (req as any)._rawBody = body;
      try {
        done(null, JSON.parse(body.toString()));
      } catch (err) {
        done(err as Error);
      }
    },
  );
}

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // Register raw body parser for Stripe webhook signature verification
  registerRawBodyParser(app);
  /**
   * GET /billing/plans
   * Returns all active billing plans.
   * Public — no auth required (plan comparison page).
   */
  app.get("/billing/plans", { schema: { tags: ["Billing"], summary: "Listar planes de suscripción" } }, async (_req, reply) => {
    const allPlans = await getPlans();
    return reply.send({ plans: allPlans });
  });

  /**
   * GET /billing/subscription
   * Returns the current tenant's subscription with plan details.
   */
  app.get("/billing/subscription", { schema: { tags: ["Billing"], summary: "Obtener suscripción actual del tenant" } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = req.tenantSlug;
    if (!tenantSlug) return reply.code(401).send({ error: "Tenant not identified" });

    const sub = await getSubscription(tenantSlug);
    return reply.send({ subscription: sub });
  });

  /**
   * GET /billing/invoices
   * Returns billing history for the current tenant.
   */
  app.get("/billing/invoices", { schema: { tags: ["Billing"], summary: "Obtener historial de facturación" } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = req.tenantSlug;
    if (!tenantSlug) return reply.code(401).send({ error: "Tenant not identified" });

    const invoices = await getInvoices(tenantSlug);
    return reply.send({ invoices });
  });

  /**
   * POST /billing/checkout
   * Creates a Stripe Checkout session for upgrading/changing plans.
   */
  app.post("/billing/checkout", { schema: { tags: ["Billing"], summary: "Crear sesión de checkout Stripe" } }, async (req: FastifyRequest, reply: FastifyReply) => {
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
  app.post("/billing/portal", { schema: { tags: ["Billing"], summary: "Crear portal de gestión de suscripción" } }, async (req: FastifyRequest, reply: FastifyReply) => {
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
  app.post("/billing/webhook", { schema: { tags: ["Billing"], summary: "Recibir webhook de Stripe" } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const signature = req.headers["stripe-signature"] as string | undefined;
    const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];

    // Production: require signature verification
    if (webhookSecret) {
      if (!signature) {
        app.log.warn("Stripe webhook received without signature header");
        return reply.code(400).send({ error: "Missing stripe-signature header" });
      }
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);
        const rawBody = (req as any)._rawBody as Buffer;
        if (!rawBody) {
          app.log.error("Raw body not available for webhook verification");
          return reply.code(500).send({ error: "Raw body not captured" });
        }
        const event = stripe.webhooks.constructEvent(
          rawBody.toString(),
          signature,
          webhookSecret,
        );
        const eventType = event.type;
        const data = event.data.object as Record<string, unknown>;

        app.log.info({ eventType, id: event.id }, "Received verified Stripe webhook event");

        await processWebhookEvent(eventType, data);
        return reply.send({ received: true });
      } catch (err: unknown) {
        app.log.error({ err }, "Stripe webhook signature verification failed");
        return reply.code(400).send({ error: "Invalid signature" });
      }
    }

    // Dev-only: process without signature verification (STRIPE_WEBHOOK_SECRET not set)
    if (process.env.NODE_ENV === "production") {
      return reply.code(400).send({ error: "Webhook signature required in production" });
    }

    const body = req.body as Record<string, unknown>;
    const eventType = body["type"] as string | undefined;
    const data = (body["data"] as Record<string, unknown>)?.["object"] as Record<string, unknown> | undefined;

    if (!eventType || !data) {
      return reply.code(400).send({ error: "Invalid webhook payload" });
    }

    app.log.info({ eventType }, "Received Stripe webhook event (unverified — dev mode)");

    try {
      await processWebhookEvent(eventType, data);
      return reply.send({ received: true });
    } catch (err: unknown) {
      app.log.error({ err, eventType }, "Webhook processing failed");
      return reply.code(500).send({ error: "Webhook processing failed" });
    }
  });
}
