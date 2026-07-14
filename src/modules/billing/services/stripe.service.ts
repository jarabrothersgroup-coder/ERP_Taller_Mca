/**
 * Billing module — Stripe integration service.
 *
 * Handles Stripe API interactions for subscription management:
 * - Customer creation/lookup
 * - Checkout session creation
 * - Subscription lifecycle (create, update, cancel)
 * - Webhook event processing
 *
 * Falls back to mock data when STRIPE_SECRET_KEY is not configured
 * (development/offline mode).
 *
 * RAM impact: ~50KB (Stripe SDK lazy-loaded).
 *
 * @module billing/services/stripe.service
 */

import { eq, or } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { tenants } from "../../../shared/database/schema/tenants.js";
import { plans } from "../schema/plans.js";
import { subscriptions } from "../schema/subscriptions.js";
import { subscriptionInvoices } from "../schema/invoices.js";
import type {
  BillingPlan,
  BillingSubscription,
  BillingInvoice,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
} from "../types.js";

/** Whether Stripe is configured */
function isStripeConfigured(): boolean {
  return !!process.env["STRIPE_SECRET_KEY"];
}

/**
 * Resolve a tenant slug to its UUID.
 */
async function resolveTenantId(tenantSlug: string): Promise<string | null> {
  const [tenant] = await db()
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);
  return tenant?.id ?? null;
}

/**
 * Get all available billing plans.
 */
export async function getPlans(): Promise<BillingPlan[]> {
  const rows = await db().select().from(plans).orderBy(plans.sortOrder);
  return rows.map(mapPlanRow);
}

/**
 * Get a plan by ID.
 */
export async function getPlanById(planId: string): Promise<BillingPlan | null> {
  const [row] = await db().select().from(plans).where(eq(plans.id, planId));
  return row ? mapPlanRow(row) : null;
}

/**
 * Get the current subscription for a tenant.
 * Accepts tenantSlug (resolves to UUID internally).
 */
export async function getSubscription(tenantSlug: string): Promise<BillingSubscription | null> {
  const tenantId = await resolveTenantId(tenantSlug);
  if (!tenantId) return null;

  const [row] = await db()
    .select({
      sub: subscriptions,
      plan: plans,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.tenantId, tenantId));

  if (!row) return null;

  return {
    ...mapSubscriptionRow(row.sub),
    plan: mapPlanRow(row.plan),
  };
}

/**
 * Get billing history for a tenant.
 * Accepts tenantSlug (resolves to UUID internally).
 */
export async function getInvoices(tenantSlug: string, limit = 20): Promise<BillingInvoice[]> {
  const tenantId = await resolveTenantId(tenantSlug);
  if (!tenantId) return [];

  const rows = await db()
    .select()
    .from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.tenantId, tenantId))
    .orderBy(subscriptionInvoices.createdAt);

  return rows.slice(0, limit).map(mapInvoiceRow);
}

/**
 * Create a Stripe Checkout session for a new subscription.
 * Accepts tenantSlug (resolves to UUID internally).
 *
 * In dev mode (no Stripe key), returns a mock URL.
 */
export async function createCheckoutSession(
  input: CreateCheckoutRequest,
  tenantSlug: string,
): Promise<CreateCheckoutResponse> {
  const plan = await getPlanById(input.planId);
  if (!plan) throw new Error("Plan not found");

  if (!isStripeConfigured()) {
    // Dev mode: return mock checkout URL
    return {
      sessionId: `cs_mock_${Date.now()}`,
      sessionUrl: `/dashboard/billing?mock_checkout=true&plan=${plan.code}`,
    };
  }

  // Production: create real Stripe checkout session
  // Lazy-load Stripe SDK to keep RAM low
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);

  const priceId = input.interval === "annual" ? plan.stripePriceIdAnnual : plan.stripePriceIdMonthly;
  if (!priceId) throw new Error("Plan does not support this billing interval");

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { tenantSlug, planId: input.planId, interval: input.interval },
  });

  return {
    sessionId: session.id,
    sessionUrl: session.url!,
  };
}

/**
 * Process a Stripe webhook event.
 *
 * Handles: checkout.session.completed, invoice.paid, invoice.payment_failed,
 * customer.subscription.updated, customer.subscription.deleted.
 */
export async function processWebhookEvent(eventType: string, data: Record<string, unknown>): Promise<void> {
  const obj = data as Record<string, any>;

  switch (eventType) {
    case "checkout.session.completed": {
      const tenantSlug = obj.metadata?.tenantSlug;
      const planId = obj.metadata?.planId;
      const interval = obj.metadata?.interval || "monthly";
      if (!tenantSlug || !planId) break;

      // Resolve tenantSlug to UUID
      const tenantId = await resolveTenantId(tenantSlug);
      if (!tenantId) {
        console.error(`[billing] Webhook: tenant not found for slug "${tenantSlug}"`);
        break;
      }

      // Create or update subscription
      const existing = await getSubscription(tenantSlug);
      if (existing?.id) {
        await db()
          .update(subscriptions)
          .set({
            stripeSubscriptionId: obj.subscription,
            stripeCustomerId: obj.customer,
            status: "active",
            interval,
            currentPeriodStart: new Date(obj.current_period_start * 1000),
            currentPeriodEnd: new Date(obj.current_period_end * 1000),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, existing.id));
      } else {
        await db().insert(subscriptions).values({
          tenantId,
          stripeSubscriptionId: obj.subscription,
          stripeCustomerId: obj.customer,
          planId,
          status: "active",
          interval,
          currentPeriodStart: new Date(obj.current_period_start * 1000),
          currentPeriodEnd: new Date(obj.current_period_end * 1000),
        });
      }
      break;
    }

    case "invoice.paid": {
      const subscriptionId = obj.subscription;
      if (!subscriptionId) break;
      const [sub] = await db().select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
      if (sub) {
        await db().insert(subscriptionInvoices).values({
          tenantId: sub.tenantId,
          stripeInvoiceId: obj.id,
          stripeSubscriptionId: subscriptionId,
          amountPyg: obj.amount_paid || obj.amount_due || 0,
          currency: (obj.currency || "pyg").toUpperCase(),
          status: "paid",
          paidAt: new Date(),
          dueDate: obj.due_date ? new Date(obj.due_date * 1000) : null,
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const subscriptionId = obj.subscription;
      if (!subscriptionId) break;
      const [sub] = await db().select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
      if (sub) {
        await db().insert(subscriptionInvoices).values({
          tenantId: sub.tenantId,
          stripeInvoiceId: obj.id,
          stripeSubscriptionId: subscriptionId,
          amountPyg: obj.amount_due || 0,
          currency: (obj.currency || "pyg").toUpperCase(),
          status: "failed",
          dueDate: obj.due_date ? new Date(obj.due_date * 1000) : null,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscriptionId = obj.id;
      if (!subscriptionId) break;

      const [sub] = await db()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
      if (!sub) break;

      // Resolve plan from the new price (handles plan changes/upgrades)
      const priceId = obj.items?.data?.[0]?.price?.id as string | undefined;
      let planId = sub.planId;
      let interval = sub.interval;
      if (priceId) {
        const [matched] = await db()
          .select()
          .from(plans)
          .where(
            or(eq(plans.stripePriceIdMonthly, priceId), eq(plans.stripePriceIdAnnual, priceId)),
          );
        if (matched) {
          planId = matched.id;
          interval = matched.stripePriceIdAnnual === priceId ? "annual" : "monthly";
        }
      }

      const isCancelled = obj.status === "canceled" || obj.status === "cancelled";
      await db()
        .update(subscriptions)
        .set({
          status: (obj.status as string) ?? sub.status,
          planId,
          interval,
          currentPeriodStart: obj.current_period_start
            ? new Date(obj.current_period_start * 1000)
            : sub.currentPeriodStart,
          currentPeriodEnd: obj.current_period_end
            ? new Date(obj.current_period_end * 1000)
            : sub.currentPeriodEnd,
          cancelledAt: isCancelled ? new Date() : sub.cancelledAt,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
      break;
    }

    case "customer.subscription.deleted": {
      const subscriptionId = obj.id;
      if (!subscriptionId) break;
      await db()
        .update(subscriptions)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
      break;
    }
  }
}

/**
 * Create a Stripe Customer Portal session for managing subscription.
 *
 * Allows tenants to update payment methods, view invoices, cancel subscription.
 * In dev mode (no Stripe key), returns a mock URL.
 */
export async function createPortalSession(
  tenantSlug: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const sub = await getSubscription(tenantSlug);
  if (!sub?.stripeCustomerId) {
    throw new Error("No active subscription found for this tenant");
  }

  if (!isStripeConfigured()) {
    return { url: `/dashboard/billing?mock_portal=true` };
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

/* ── Row mappers ─────────────────────────────── */

function mapPlanRow(row: any): BillingPlan {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    priceMonthlyPyg: row.priceMonthlyPyg,
    priceAnnualPyg: row.priceAnnualPyg,
    stripePriceIdMonthly: row.stripePriceIdMonthly,
    stripePriceIdAnnual: row.stripePriceIdAnnual,
    maxUsers: row.maxUsers,
    maxBranches: row.maxBranches,
    features: row.features,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

function mapSubscriptionRow(row: any): BillingSubscription {
  return {
    id: row.id,
    tenantId: row.tenantId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    stripeCustomerId: row.stripeCustomerId,
    planId: row.planId,
    status: row.status,
    interval: row.interval,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelledAt: row.cancelledAt,
    trialEnd: row.trialEnd,
    activeUsers: row.activeUsers,
  };
}

function mapInvoiceRow(row: any): BillingInvoice {
  return {
    id: row.id,
    tenantId: row.tenantId,
    stripeInvoiceId: row.stripeInvoiceId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    amountPyg: row.amountPyg,
    currency: row.currency,
    status: row.status,
    periodLabel: row.periodLabel,
    pdfUrl: row.pdfUrl,
    paidAt: row.paidAt,
    dueDate: row.dueDate,
    createdAt: row.createdAt,
  };
}
