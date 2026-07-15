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
  getStripeClient,
} from "../services/stripe.service.js";

// ─── Swagger Schemas ─────────────────────────────────────────────────────────

const billingPlanSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid", description: "Plan unique identifier" },
    code: { type: "string", description: "Plan code (e.g. 'starter', 'pro', 'enterprise')" },
    name: { type: "string", description: "Plan display name" },
    description: { type: "string", nullable: true, description: "Plan description" },
    priceMonthlyPyg: { type: "integer", description: "Monthly price in Paraguayan Guaraníes (PYG)" },
    priceAnnualPyg: { type: "integer", nullable: true, description: "Annual price in PYG (discounted)" },
    maxUsers: { type: "integer", description: "Maximum number of users allowed" },
    maxBranches: { type: "integer", description: "Maximum number of branches allowed" },
    features: { type: "array", items: { type: "string" }, description: "List of included features" },
    isActive: { type: "boolean", description: "Whether the plan is currently available" },
    sortOrder: { type: "integer", description: "Display order (ascending)" },
  },
};

const billingSubscriptionSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid", description: "Subscription unique identifier" },
    tenantId: { type: "string", format: "uuid", description: "Tenant UUID" },
    stripeSubscriptionId: { type: "string", nullable: true, description: "Stripe Subscription ID (e.g. 'sub_xxx')" },
    stripeCustomerId: { type: "string", nullable: true, description: "Stripe Customer ID (e.g. 'cus_xxx')" },
    planId: { type: "string", format: "uuid", description: "Reference to billing_plans" },
    status: { type: "string", enum: ["active", "trialing", "past_due", "cancelled", "unpaid"], description: "Subscription status" },
    interval: { type: "string", enum: ["monthly", "annual"], description: "Billing interval" },
    currentPeriodStart: { type: "string", format: "date-time", nullable: true, description: "Current billing period start" },
    currentPeriodEnd: { type: "string", format: "date-time", nullable: true, description: "Current billing period end" },
    cancelledAt: { type: "string", format: "date-time", nullable: true, description: "When subscription was cancelled" },
    trialEnd: { type: "string", format: "date-time", nullable: true, description: "Trial end date" },
    activeUsers: { type: "integer", description: "Number of active users" },
    createdAt: { type: "string", format: "date-time", description: "Subscription creation timestamp" },
    updatedAt: { type: "string", format: "date-time", description: "Last update timestamp" },
    plan: billingPlanSchema,
  },
};

const billingInvoiceSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid", description: "Invoice unique identifier" },
    tenantId: { type: "string", format: "uuid", description: "Tenant UUID" },
    stripeInvoiceId: { type: "string", nullable: true, description: "Stripe Invoice ID" },
    stripeSubscriptionId: { type: "string", nullable: true, description: "Stripe Subscription ID" },
    amountPyg: { type: "integer", description: "Amount in Paraguayan Guaraníes (PYG)" },
    currency: { type: "string", description: "Currency code (e.g. 'PYG')" },
    status: { type: "string", enum: ["paid", "failed", "pending", "void"], description: "Invoice status" },
    periodLabel: { type: "string", nullable: true, description: "Billing period label" },
    pdfUrl: { type: "string", nullable: true, description: "PDF download URL" },
    paidAt: { type: "string", format: "date-time", nullable: true, description: "When the invoice was paid" },
    dueDate: { type: "string", format: "date-time", nullable: true, description: "Payment due date" },
    createdAt: { type: "string", format: "date-time", description: "Invoice creation timestamp" },
  },
};

const errorResponseSchema = {
  type: "object",
  properties: {
    error: { type: "string", description: "Error message" },
  },
};

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /billing/plans
   * Returns all active billing plans.
   * Public — no auth required (plan comparison page).
   */
  app.get("/billing/plans", {
    schema: {
      tags: ["Billing"],
      summary: "Listar planes de suscripción",
      description: "Returns all available billing plans with pricing and features. Public endpoint — no authentication required. Use this to display the pricing page to potential customers.",
      response: {
        200: {
          type: "object",
          properties: {
            plans: {
              type: "array",
              items: billingPlanSchema,
              description: "List of available billing plans",
            },
          },
        },
        500: errorResponseSchema,
      },
    },
  }, async (_req, reply) => {
    const allPlans = await getPlans();
    return reply.send({ plans: allPlans });
  });

  /**
   * GET /billing/subscription
   * Returns the current tenant's subscription with plan details.
   */
  app.get("/billing/subscription", {
    schema: {
      tags: ["Billing"],
      summary: "Obtener suscripción actual del tenant",
      description: "Returns the current tenant's active subscription including plan details, billing period, and status. Requires X-Tenant-Slug header for tenant identification.",
      headers: {
        type: "object",
        required: ["X-Tenant-Slug"],
        properties: {
          "X-Tenant-Slug": { type: "string", description: "Tenant slug for multi-tenant isolation" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            subscription: {
              ...billingSubscriptionSchema,
              nullable: true,
              description: "Current subscription (null if no active subscription)",
            },
          },
        },
        401: errorResponseSchema,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = req.tenantSlug;
    if (!tenantSlug) return reply.code(401).send({ error: "Tenant not identified" });

    const sub = await getSubscription(tenantSlug);
    return reply.send({ subscription: sub });
  });

  /**
   * GET /billing/invoices
   * Returns billing history for the current tenant.
   */
  app.get("/billing/invoices", {
    schema: {
      tags: ["Billing"],
      summary: "Obtener historial de facturación",
      description: "Returns billing history for the current tenant including paid invoices, failed payments, and pending invoices. Results are ordered by creation date (newest first).",
      headers: {
        type: "object",
        required: ["X-Tenant-Slug"],
        properties: {
          "X-Tenant-Slug": { type: "string", description: "Tenant slug for multi-tenant isolation" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            invoices: {
              type: "array",
              items: billingInvoiceSchema,
              description: "List of invoices (max 20 most recent)",
            },
          },
        },
        401: errorResponseSchema,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = req.tenantSlug;
    if (!tenantSlug) return reply.code(401).send({ error: "Tenant not identified" });

    const invoices = await getInvoices(tenantSlug);
    return reply.send({ invoices });
  });

  /**
   * POST /billing/checkout
   * Creates a Stripe Checkout session for upgrading/changing plans.
   */
  app.post("/billing/checkout", {
    schema: {
      tags: ["Billing"],
      summary: "Crear sesión de checkout Stripe",
      description: "Creates a Stripe Checkout session for upgrading or changing the current tenant's subscription plan. Returns a URL that the client should redirect to for payment. In development mode (no Stripe key), returns a mock URL.",
      headers: {
        type: "object",
        required: ["X-Tenant-Slug"],
        properties: {
          "X-Tenant-Slug": { type: "string", description: "Tenant slug for multi-tenant isolation" },
        },
      },
      body: {
        type: "object",
        required: ["planId"],
        properties: {
          planId: { type: "string", format: "uuid", description: "ID of the plan to subscribe to" },
          interval: { type: "string", enum: ["monthly", "annual"], default: "monthly", description: "Billing interval" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Stripe Checkout Session ID" },
            sessionUrl: { type: "string", format: "uri", description: "URL to redirect the user to for payment" },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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
  app.post("/billing/portal", {
    schema: {
      tags: ["Billing"],
      summary: "Crear portal de gestión de suscripción",
      description: "Creates a Stripe Customer Portal session that allows the tenant to manage their subscription, update payment methods, view invoices, and cancel. Returns a URL to redirect the user to.",
      headers: {
        type: "object",
        required: ["X-Tenant-Slug"],
        properties: {
          "X-Tenant-Slug": { type: "string", description: "Tenant slug for multi-tenant isolation" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            url: { type: "string", format: "uri", description: "Stripe Customer Portal URL" },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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
   *
   * Registered as a separate sub-plugin so the raw body parser
   * only applies to this route, not all /billing/* routes.
   */
  await app.register(webhookSubPlugin);
}

/**
 * Sub-plugin for the Stripe webhook route.
 * Registers its own raw body parser scoped to /webhook only,
 * avoiding overhead on all other billing routes.
 */
async function webhookSubPlugin(app: FastifyInstance): Promise<void> {
  // Register raw body parser — only affects routes in this sub-plugin (just /webhook)
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req: FastifyRequest, body: Buffer, done: (err: Error | null, body?: unknown) => void) => {
      (req as any)._rawBody = body;
      try {
        done(null, JSON.parse(body.toString()));
      } catch (err) {
        done(err as Error);
      }
    },
  );

  app.post("/webhook", {
    schema: {
      tags: ["Billing"],
      summary: "Recibir webhook de Stripe",
      description: "Receives webhook events from Stripe for subscription lifecycle management. This endpoint is called directly by Stripe and does not require authentication. Signature verification is performed when STRIPE_WEBHOOK_SECRET is configured.",
      consumes: ["application/json"],
      produces: ["application/json"],
      security: [], // No auth required — Stripe calls this directly
      response: {
        200: {
          type: "object",
          properties: {
            received: { type: "boolean", description: "Whether the webhook was processed successfully" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string", description: "Error message (missing signature, invalid signature, invalid payload)" },
          },
        },
        500: {
          type: "object",
          properties: {
            error: { type: "string", description: "Webhook processing failed" },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const signature = req.headers["stripe-signature"] as string | undefined;
    const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];

    // Production: require signature verification
    if (webhookSecret) {
      if (!signature) {
        app.log.warn("Stripe webhook received without signature header");
        return reply.code(400).send({ error: "Missing stripe-signature header" });
      }
      try {
        const stripe = await getStripeClient();
        const rawBody = req._rawBody;
        if (!rawBody) {
          app.log.error("Raw body not available for webhook verification");
          return reply.code(500).send({ error: "Raw body not captured" });
        }
        const event = stripe.webhooks.constructEvent(
          rawBody,
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
