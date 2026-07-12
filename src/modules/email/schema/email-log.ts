/**
 * Email log table — audit trail for outbound emails.
 *
 * @module email/schema
 */

import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug: text("tenant_slug"),
    from: text("from").notNull(),
    to: jsonb("to").$type<string[]>().notNull(),
    subject: text("subject").notNull(),
    status: text("status").notNull().default("sent"),
    messageId: text("message_id"),
    errorMessage: text("error_message"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("email_log_tenant_idx").on(table.tenantSlug),
    statusIdx: index("email_log_status_idx").on(table.status),
    createdIdx: index("email_log_created_idx").on(table.createdAt),
  }),
);

export type EmailLog = typeof emailLog.$inferSelect;
export type NewEmailLog = typeof emailLog.$inferInsert;
