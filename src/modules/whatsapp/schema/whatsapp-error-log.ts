/**
 * WhatsApp Error Log — Drizzle ORM schema.
 *
 * Dedicated table for integration errors (WhatsApp + CRM) that
 * NEVER blocks the commercial transaction. Errors are logged
 * asynchronously and displayed in the admin dashboard.
 *
 * This is the safety net: if WhatsApp/CRM fails, the ERP
 * continues working normally. Errors are visible in the
 * Config → Integrations → Error Log section.
 *
 * @module whatsapp/schema/whatsapp-error-log
 */

import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────

/** Error source system */
export const errorSourceEnum = pgEnum("error_source", [
  "whatsapp",
  "twenty_crm",
  "evolution_api",
]);

/** Error operation type */
export const errorOperationEnum = pgEnum("error_operation", [
  "send_message",
  "send_document",
  "create_instance",
  "get_qr",
  "get_status",
  "disconnect",
  "crm_sync",
  "crm_upsert",
  "crm_create_contact",
  "crm_add_note",
]);

// ─── Table ────────────────────────────────────────────

/**
 * WhatsApp/CRM error log — non-blocking error tracking.
 *
 * Each row represents one failed integration attempt.
 * These errors do NOT affect the main ERP transaction.
 */
export const whatsappErrorsLog = pgTable(
  "whatsapp_errors_log",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Error source system */
    source: errorSourceEnum("source").notNull(),

    /** Operation that failed */
    operation: errorOperationEnum("operation").notNull(),

    /** Work order UUID (if related to an order) */
    ordenId: uuid("orden_id"),

    /** Client name (denormalized for quick display) */
    clientName: varchar("client_name", { length: 255 }),

    /** Phone number involved */
    phoneNumber: varchar("phone_number", { length: 20 }),

    /** HTTP status code or internal error code */
    errorCode: varchar("error_code", { length: 50 }),

    /** Human-readable error message */
    errorMessage: text("error_message").notNull(),

    /** Stack trace (development only) */
    errorStack: text("error_stack"),

    /** Request URL that failed */
    requestUrl: varchar("request_url", { length: 500 }),

    /** HTTP method used */
    requestMethod: varchar("request_method", { length: 10 }),

    /** Response status code from external API */
    responseStatus: integer("response_status"),

    /** Full response body from external API */
    responseBody: text("response_body"),

    /** Tenant slug */
    tenantSlug: varchar("tenant_slug", { length: 100 }).notNull(),

    /** User who triggered the operation */
    triggeredBy: varchar("triggered_by", { length: 255 }),

    /** Number of retry attempts */
    retryCount: integer("retry_count").notNull().default(0),

    /** Next scheduled retry time */
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),

    /** Whether the error has been resolved */
    resolved: boolean("resolved").notNull().default(false),

    /** When the error was resolved */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    /** Who resolved the error */
    resolvedBy: varchar("resolved_by", { length: 255 }),

    /** Resolution notes */
    resolutionNotes: text("resolution_notes"),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Index on source: filter by system */
    sourceIdx: index("whatsapp_errors_source_idx").on(table.source),
    /** Index on operation: filter by operation type */
    operationIdx: index("whatsapp_errors_operation_idx").on(table.operation),
    /** Index on tenant: multi-tenant isolation */
    tenantIdx: index("whatsapp_errors_tenant_idx").on(table.tenantSlug),
    /** Index on unresolved: quick lookup of active errors */
    unresolvedIdx: index("whatsapp_errors_unresolved_idx").on(table.resolved),
    /** Index on created_at: chronological error listing */
    createdIdx: index("whatsapp_errors_created_idx").on(table.createdAt),
  }),
);

// ─── Types ────────────────────────────────────────────

/** Row type returned by SELECT */
export type WhatsAppErrorLog = typeof whatsappErrorsLog.$inferSelect;

/** Row type accepted by INSERT */
export type NewWhatsAppErrorLog = typeof whatsappErrorsLog.$inferInsert;
