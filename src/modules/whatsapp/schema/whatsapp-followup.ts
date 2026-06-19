/**
 * WhatsApp Follow-up schedule schema — Tracks automated follow-ups.
 *
 * @module whatsapp/schema/whatsapp-followup
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

/**
 * Scheduled follow-up messages.
 */
export const whatsappFollowups = pgTable("whatsapp_followups", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantSlug: varchar("tenant_slug", { length: 100 }).notNull(),

  /** Template key used */
  templateKey: varchar("template_key", { length: 100 }).notNull(),

  /** Related order ID (nullable for non-order follow-ups) */
  ordenId: varchar("orden_id", { length: 36 }),

  /** Client phone number */
  phone: varchar("phone", { length: 20 }).notNull(),

  /** Filled message body */
  filledBody: text("filled_body").notNull(),

  /** Variables used to fill the template */
  variables: jsonb("variables").$type<Record<string, string>>().notNull().default({}),

  /** Status: SCHEDULED, SENT, FAILED, CANCELLED */
  status: varchar("status", { length: 20 }).notNull().default("SCHEDULED"),

  /** Scheduled send time */
  scheduledAt: timestamp("scheduled_at").notNull(),

  /** Actual send time */
  sentAt: timestamp("sent_at"),

  /** Error message if failed */
  errorMessage: text("error_message"),

  /** Retry count */
  retryCount: integer("retry_count").notNull().default(0),

  /** Related WhatsApp message ID (after sending) */
  messageId: varchar("message_id", { length: 36 }),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
