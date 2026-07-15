/**
 * Billing Notifications Service — Sends email notifications for billing events.
 *
 * Integrates with the email module to send transactional emails when:
 *   - Subscription is activated (checkout.session.completed)
 *   - Payment fails (invoice.payment_failed)
 *   - Subscription is cancelled (customer.subscription.deleted)
 *   - Trial is ending (via scheduled check)
 *
 * Falls back gracefully when email service is not configured.
 *
 * @module billing/services/billing-notifications
 */

import { eq } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { tenants } from "../../../shared/database/schema/tenants.js";
import { profiles } from "../../../shared/database/schema/profiles.js";
import { plans } from "../schema/plans.js";
import { subscriptions } from "../schema/subscriptions.js";

// ─── Lazy email sender ──────────────────────────────────

async function sendBillingEmail(params: {
  tenantSlug: string;
  to: string;
  subject: string;
  html: string;
  entityType: string;
  entityId: string;
}): Promise<void> {
  try {
    const { smartSend } = await import("../../../modules/email/services/email.service.js");
    await smartSend({
      to: params.to,
      subject: params.subject,
      html: params.html,
      entityType: params.entityType,
      entityId: params.entityId,
      tenantSlug: params.tenantSlug,
    });
  } catch (err) {
    // Don't fail webhook processing if email fails
    console.error("[Billing Notifications] Failed to send email:", err);
  }
}

// ─── Get tenant admin email ──────────────────────────────

async function getTenantAdminEmail(tenantSlug: string): Promise<string | null> {
  // First get tenant ID from slug
  const [tenant] = await db()
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);
  if (!tenant) return null;

  // Then get admin email from profiles (prefer admin role, fallback to any profile)
  const [adminProfile] = await db()
    .select({ email: profiles.email })
    .from(profiles)
    .where(eq(profiles.tenantId, tenant.id))
    .limit(1);
  if (adminProfile?.email) return adminProfile.email;

  // Fallback: any profile email
  const [anyProfile] = await db()
    .select({ email: profiles.email })
    .from(profiles)
    .where(eq(profiles.tenantId, tenant.id))
    .limit(1);
  return anyProfile?.email ?? null;
}

// ─── Format price in PYG ─────────────────────────────────

function formatPrice(amountPyg: number): string {
  return new Intl.NumberFormat("es-PY", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountPyg);
}

// ─── Notification handlers ────────────────────────────────

/**
 * Send subscription activated email.
 * Called when checkout.session.completed webhook is processed.
 */
export async function notifySubscriptionActivated(
  tenantSlug: string,
  planId: string,
  interval: string,
): Promise<void> {
  const email = await getTenantAdminEmail(tenantSlug);
  if (!email) {
    console.warn(`[Billing Notifications] No email found for tenant "${tenantSlug}"`);
    return;
  }

  // Get plan details
  const [plan] = await db().select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!plan) return;

  const price = interval === "annual" ? plan.priceAnnualPyg : plan.priceMonthlyPyg;
  const nextBillingDate = new Date();
  if (interval === "annual") {
    nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
  } else {
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
  }

  const { subscriptionActivatedTemplate } = await import("../../../modules/email/templates/index.js");
  const html = subscriptionActivatedTemplate({
    tenantName: tenantSlug,
    planName: plan.name,
    interval,
    price: formatPrice(price ?? 0),
    nextBillingDate: nextBillingDate.toLocaleDateString("es-PY"),
  });

  await sendBillingEmail({
    tenantSlug,
    to: email,
    subject: `✅ Suscripción ${plan.name} Activada — AutomotiveOS`,
    html,
    entityType: "billing",
    entityId: `subscription-activated-${tenantSlug}`,
  });
}

/**
 * Send payment failed email.
 * Called when invoice.payment_failed webhook is processed.
 */
export async function notifyPaymentFailed(
  tenantSlug: string,
  invoiceId: string,
  amountPyg: number,
  dueDate: Date | null,
): Promise<void> {
  const email = await getTenantAdminEmail(tenantSlug);
  if (!email) return;

  // Get subscription and plan details
  const [sub] = await db()
    .select({ planId: subscriptions.planId })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantSlug))
    .limit(1);
  
  let planName = "Plan Desconocido";
  if (sub?.planId) {
    const [plan] = await db().select().from(plans).where(eq(plans.id, sub.planId)).limit(1);
    planName = plan?.name ?? planName;
  }

  const { paymentFailedTemplate } = await import("../../../modules/email/templates/index.js");
  const html = paymentFailedTemplate({
    tenantName: tenantSlug,
    planName,
    amount: formatPrice(amountPyg),
    dueDate: dueDate?.toLocaleDateString("es-PY") ?? "No especificada",
    invoiceId,
  });

  await sendBillingEmail({
    tenantSlug,
    to: email,
    subject: `⚠️ Pago Fallido — ${planName} — AutomotiveOS`,
    html,
    entityType: "billing",
    entityId: `payment-failed-${invoiceId}`,
  });
}

/**
 * Send subscription cancelled email.
 * Called when customer.subscription.deleted webhook is processed.
 */
export async function notifySubscriptionCancelled(
  tenantSlug: string,
  cancelledAt: Date,
): Promise<void> {
  const email = await getTenantAdminEmail(tenantSlug);
  if (!email) return;

  // Get subscription and plan details
  const [sub] = await db()
    .select({ planId: subscriptions.planId, currentPeriodEnd: subscriptions.currentPeriodEnd })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantSlug))
    .limit(1);
  
  let planName = "Plan Desconocido";
  if (sub?.planId) {
    const [plan] = await db().select().from(plans).where(eq(plans.id, sub.planId)).limit(1);
    planName = plan?.name ?? planName;
  }

  const { subscriptionCancelledTemplate } = await import("../../../modules/email/templates/index.js");
  const html = subscriptionCancelledTemplate({
    tenantName: tenantSlug,
    planName,
    cancelDate: cancelledAt.toLocaleDateString("es-PY"),
    accessUntil: sub?.currentPeriodEnd?.toLocaleDateString("es-PY") ?? "Fin del período actual",
  });

  await sendBillingEmail({
    tenantSlug,
    to: email,
    subject: `❌ Suscripción Cancelada — ${planName} — AutomotiveOS`,
    html,
    entityType: "billing",
    entityId: `subscription-cancelled-${tenantSlug}`,
  });
}

/**
 * Send trial ending soon email.
 * Called by scheduled job or manually.
 */
export async function notifyTrialEnding(
  tenantSlug: string,
  trialEndDate: Date,
  daysRemaining: number,
): Promise<void> {
  const email = await getTenantAdminEmail(tenantSlug);
  if (!email) return;

  // Get subscription and plan details
  const [sub] = await db()
    .select({ planId: subscriptions.planId })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantSlug))
    .limit(1);
  
  let planName = "Plan Desconocido";
  if (sub?.planId) {
    const [plan] = await db().select().from(plans).where(eq(plans.id, sub.planId)).limit(1);
    planName = plan?.name ?? planName;
  }

  const { trialEndingTemplate } = await import("../../../modules/email/templates/index.js");
  const html = trialEndingTemplate({
    tenantName: tenantSlug,
    planName,
    trialEndDate: trialEndDate.toLocaleDateString("es-PY"),
    daysRemaining,
  });

  await sendBillingEmail({
    tenantSlug,
    to: email,
    subject: `⏰ Período de Prueba por Vencer — ${planName} — AutomotiveOS`,
    html,
    entityType: "billing",
    entityId: `trial-ending-${tenantSlug}`,
  });
}
