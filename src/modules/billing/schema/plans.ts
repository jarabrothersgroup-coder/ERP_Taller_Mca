/**
 * Billing module — Drizzle ORM schema for SaaS subscription plans.
 *
 * Defines tenant plans (pricing tiers) with Stripe Price ID mapping.
 * Plans are global (shared across all tenants) and seeded at deploy time.
 *
 * @module billing/schema/plans
 */

import { pgTable, text, timestamp, uuid, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const plans = pgTable("billing_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Internal plan code (e.g. "STARTER", "PRO", "ENTERPRISE") */
  code: text("code").notNull().unique(),
  /** Human-readable name */
  name: text("name").notNull(),
  /** Description */
  description: text("description"),
  /** Monthly price in PYG (Guaraníes) */
  priceMonthlyPyg: integer("price_monthly_pyg").notNull(),
  /** Annual price in PYG (if applicable) */
  priceAnnualPyg: integer("price_annual_pyg"),
  /** Stripe Price ID for monthly billing */
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  /** Stripe Price ID for annual billing */
  stripePriceIdAnnual: text("stripe_price_id_annual"),
  /** Maximum users allowed */
  maxUsers: integer("max_users").notNull().default(5),
  /** Maximum branches/sucursales */
  maxBranches: integer("max_branches").notNull().default(1),
  /** Feature flags */
  features: jsonb("features").$type<{
    sifen?: boolean;
    accounting?: boolean;
    whatsapp?: boolean;
    analytics?: boolean;
    fleet?: boolean;
    clientPortal?: boolean;
    apiAccess?: boolean;
    prioritySupport?: boolean;
  }>(),
  /** Whether this plan is currently available for purchase */
  isActive: boolean("is_active").notNull().default(true),
  /** Display order */
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
