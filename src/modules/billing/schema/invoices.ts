/**
 * Billing module — Drizzle ORM schema for subscription invoices.
 *
 * Stores billing history for each tenant. Invoices are created
 * when Stripe payments succeed or fail.
 *
 * @module billing/schema/invoices
 */

import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const subscriptionInvoices = pgTable("billing_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Tenant UUID */
  tenantId: uuid("tenant_id").notNull(),
  /** Stripe Invoice ID (e.g. "in_xxx") */
  stripeInvoiceId: text("stripe_invoice_id").unique(),
  /** Stripe Subscription ID */
  stripeSubscriptionId: text("stripe_subscription_id"),
  /** Amount in PYG */
  amountPyg: integer("amount_pyg").notNull(),
  /** Currency */
  currency: text("currency").notNull().default("PYG"),
  /** Invoice status */
  status: text("status").notNull().default("pending"),
  /** Billing period description (e.g. "Julio 2026") */
  periodLabel: text("period_label"),
  /** PDF download URL */
  pdfUrl: text("pdf_url"),
  /** When payment was received */
  paidAt: timestamp("paid_at", { withTimezone: true }),
  /** When the invoice was due */
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
