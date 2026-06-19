/**
 * CRM Sync Log — Drizzle ORM schema.
 *
 * Tracks all synchronizations between ERP and Twenty CRM
 * for auditing and debugging.
 *
 * @module crm/schema/crm-sync-log
 */

import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────

/** Sync operation type */
export const crmSyncOperationEnum = pgEnum("crm_sync_operation", [
  "upsert_contact",
  "add_note",
  "update_vehicle",
  "create_contact",
  "update_contact",
]);

/** Sync status */
export const crmSyncStatusEnum = pgEnum("crm_sync_status", [
  "pending",
  "success",
  "failed",
  "retrying",
]);

// ─── Table ────────────────────────────────────────────

/**
 * CRM sync log — audit trail for Twenty CRM synchronizations.
 *
 * Each row represents one sync attempt from ERP to Twenty CRM.
 */
export const crmSyncLog = pgTable(
  "crm_sync_log",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Sync operation type */
    operation: crmSyncOperationEnum("operation").notNull(),

    /** Direction (always erp_to_crm for now) */
    direction: text("direction").notNull().default("erp_to_crm"),

    /** Work order UUID (if linked to an order) */
    ordenId: uuid("orden_id"),

    /** ERP client UUID */
    clientId: uuid("client_id"),

    /** Client name (denormalized) */
    clientName: text("client_name"),

    /** Twenty CRM contact/person ID */
    twentyContactId: text("twenty_contact_id"),

    /** Twenty object name (person, company, etc.) */
    twentyObjectName: text("twenty_object_name"),

    /** Twenty record ID */
    twentyRecordId: text("twenty_record_id"),

    /** Sync status */
    status: crmSyncStatusEnum("status").notNull().default("pending"),

    /** Error message if failed */
    errorMessage: text("error_message"),

    /** Request payload sent to Twenty (JSON) */
    requestPayload: jsonb("request_payload"),

    /** Response payload from Twenty (JSON) */
    responsePayload: jsonb("response_payload"),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    /** Index on status: filter pending/failed syncs */
    statusIdx: index("crm_sync_status_idx").on(table.status),
    /** Index on tenant: multi-tenant isolation */
    tenantIdx: index("crm_sync_tenant_idx").on(table.tenantSlug),
    /** Index on orden_id: link to work orders */
    ordenIdx: index("crm_sync_orden_idx").on(table.ordenId),
    /** Index on twenty_contact_id: lookup by CRM ID */
    contactIdx: index("crm_sync_contact_idx").on(table.twentyContactId),
  }),
);

// ─── Types ────────────────────────────────────────────

/** Row type returned by SELECT */
export type CrmSyncLogEntry = typeof crmSyncLog.$inferSelect;

/** Row type accepted by INSERT */
export type NewCrmSyncLogEntry = typeof crmSyncLog.$inferInsert;
