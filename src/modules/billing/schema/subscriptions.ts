/**
 * Billing module — Drizzle ORM schema for tenant subscriptions.
 *
 * Tracks each tenant's active plan, Stripe subscription status,
 * and billing period. One active subscription per tenant.
 *
 * @module billing/schema/subscriptions
 */

import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { plans } from "./plans.js";

export const subscriptions = pgTable("billing_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Tenant UUID */
  tenantId: uuid("tenant_id").notNull(),
  /** Stripe Subscription ID (e.g. "sub_xxx") */
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  /** Stripe Customer ID (e.g. "cus_xxx") */
  stripeCustomerId: text("stripe_customer_id"),
  /** Reference to billing_plans */
  planId: uuid("plan_id").notNull(),
  /** Subscription status */
  status: text("status").notNull().default("active"),
  /** Billing interval: "monthly" or "annual" */
  interval: text("interval").notNull().default("monthly"),
  /** Current billing period start */
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  /** Current billing period end */
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  /** When the subscription was cancelled (null if active) */
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  /** Trial end date (null if not in trial) */
  trialEnd: timestamp("trial_end", { withTimezone: true }),
  /** Number of users currently active */
  activeUsers: integer("active_users").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
}));
