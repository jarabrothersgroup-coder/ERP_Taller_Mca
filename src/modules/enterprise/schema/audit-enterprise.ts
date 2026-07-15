/**
 * Enterprise Audit Trail Schema — Immutable, tamper-proof audit logging
 * for SOC2/GDPR compliance.
 *
 * Features:
 *   - Immutable rows (no UPDATE/DELETE at DB level via RLS)
 *   - Cryptographic hash chain (each row includes hash of previous)
 *   - IP address, user agent, request ID tracking
 *   - Entity lifecycle events (create/update/delete/login/logout/export)
 *
 * @module enterprise/schema/audit-enterprise
 */

import { pgTable, text, timestamp, varchar, jsonb, integer, index } from "drizzle-orm/pg-core";

/**
 * Enterprise audit log — immutable append-only table.
 * Each row includes a hash_chain linking to the previous row for tamper detection.
 */
export const enterpriseAuditLog = pgTable(
  "enterprise_audit_log",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    /** Tenant isolation */
    tenantSlug: varchar("tenant_slug", { length: 100 }).notNull(),
    /** Who performed the action */
    userId: varchar("user_id", { length: 100 }),
    userEmail: varchar("user_email", { length: 255 }),
    userRole: varchar("user_role", { length: 50 }),
    /** What happened */
    action: varchar("action", { length: 50 }).notNull(),
    /** Entity type affected (e.g. 'work_order', 'invoice', 'client') */
    entityType: varchar("entity_type", { length: 100 }),
    /** Entity ID affected */
    entityId: varchar("entity_id", { length: 100 }),
    /** Structured change payload */
    details: jsonb("details"),
    /** Before snapshot (for updates/deletes) */
    previousState: jsonb("previous_state"),
    /** After snapshot (for creates/updates) */
    newState: jsonb("new_state"),
    /** Request context */
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    requestId: varchar("request_id", { length: 100 }),
    /** Severity level for alerting */
    severity: varchar("severity", { length: 20 }).notNull().default("info"),
    /** Cryptographic hash chain for tamper detection */
    hashChain: varchar("hash_chain", { length: 128 }),
    /** When this event occurred */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_eal_tenant_created").on(table.tenantSlug, table.createdAt),
    index("idx_eal_user").on(table.userEmail),
    index("idx_eal_entity").on(table.entityType, table.entityId),
    index("idx_eal_action").on(table.action),
    index("idx_eal_severity").on(table.severity),
    index("idx_eal_hash_chain").on(table.hashChain),
  ],
);

export type EnterpriseAuditLogEntry = typeof enterpriseAuditLog.$inferSelect;
export type NewEnterpriseAuditLogEntry = typeof enterpriseAuditLog.$inferInsert;
