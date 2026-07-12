/**
 * Billing module — types and DTOs.
 *
 * @module billing/types
 */

/** Plan record from DB */
export interface BillingPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthlyPyg: number;
  priceAnnualPyg: number | null;
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
  maxUsers: number;
  maxBranches: number;
  features: Record<string, boolean> | null;
  isActive: boolean;
  sortOrder: number;
}

/** Subscription record from DB */
export interface BillingSubscription {
  id: string;
  tenantId: string;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  planId: string;
  status: string;
  interval: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelledAt: Date | null;
  trialEnd: Date | null;
  activeUsers: number;
  plan?: BillingPlan;
}

/** Invoice record from DB */
export interface BillingInvoice {
  id: string;
  tenantId: string;
  stripeInvoiceId: string | null;
  stripeSubscriptionId: string | null;
  amountPyg: number;
  currency: string;
  status: string;
  periodLabel: string | null;
  pdfUrl: string | null;
  paidAt: Date | null;
  dueDate: Date | null;
  createdAt: Date;
}

/** Stripe checkout session request */
export interface CreateCheckoutRequest {
  planId: string;
  interval: "monthly" | "annual";
  successUrl: string;
  cancelUrl: string;
}

/** Stripe checkout session response */
export interface CreateCheckoutResponse {
  sessionId: string;
  sessionUrl: string;
}

/** Stripe webhook event payload */
export interface StripeWebhookEvent {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}
