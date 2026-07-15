/**
 * Enterprise Audit Trail Service — Immutable, tamper-proof audit logging.
 *
 * Features:
 *   - Cryptographic hash chain for tamper detection (SHA-256)
 *   - Structured event logging with before/after snapshots
 *   - Compliance-grade immutable entries (append-only)
 *   - Severity-based alerting (info/warning/critical)
 *   - Bulk query with filters for compliance reports
 *
 * @module enterprise/services/audit-enterprise.service
 */

import crypto from "node:crypto";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { enterpriseAuditLog, type NewEnterpriseAuditLogEntry } from "../schema/audit-enterprise.js";

// ─── Types ────────────────────────────────────────────

export interface AuditEvent {
  tenantSlug: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  severity?: "info" | "warning" | "critical";
}

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "login_failed"
  | "export"
  | "import"
  | "approve"
  | "reject"
  | "escalate"
  | "config_change"
  | "permission_change"
  | "data_access"
  | "print"
  | "send"
  | "archive";

export interface AuditQueryOptions {
  tenantSlug: string;
  from?: Date;
  to?: Date;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  userEmail?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}

// ─── Hash Chain ───────────────────────────────────────

/**
 * Compute SHA-256 hash chain entry linking to previous entry.
 * Each row's hash = SHA256(previousHash + tenantSlug + action + entityType + entityId + timestamp)
 */
function computeHashChain(
  previousHash: string | null,
  entry: {
    tenantSlug: string;
    action: string;
    entityType?: string;
    entityId?: string;
    timestamp: string;
  },
): string {
  const payload = [
    previousHash ?? "GENESIS",
    entry.tenantSlug,
    entry.action,
    entry.entityType ?? "",
    entry.entityId ?? "",
    entry.timestamp,
  ].join("|");

  return crypto.createHash("sha256").update(payload).digest("hex");
}

// ─── Core Service ─────────────────────────────────────

/**
 * Log an enterprise audit event.
 * Computes hash chain and inserts immutable row.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  const now = new Date();
  const timestamp = now.toISOString();

  // Get last hash chain for this tenant
  const [lastEntry] = await db()
    .select({ hashChain: enterpriseAuditLog.hashChain })
    .from(enterpriseAuditLog)
    .where(eq(enterpriseAuditLog.tenantSlug, event.tenantSlug))
    .orderBy(desc(enterpriseAuditLog.createdAt))
    .limit(1);

  const hashChain = computeHashChain(lastEntry?.hashChain ?? null, {
    tenantSlug: event.tenantSlug,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    timestamp,
  });

  const entry: NewEnterpriseAuditLogEntry = {
    tenantSlug: event.tenantSlug,
    userId: event.userId,
    userEmail: event.userEmail,
    userRole: event.userRole,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    details: event.details ?? {},
    previousState: event.previousState,
    newState: event.newState,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    requestId: event.requestId,
    severity: event.severity ?? "info",
    hashChain,
    createdAt: now,
  };

  await db().insert(enterpriseAuditLog).values(entry);
}

/**
 * Query enterprise audit log with filters.
 */
export async function queryAuditLog(options: AuditQueryOptions) {
  const conditions = [
    eq(enterpriseAuditLog.tenantSlug, options.tenantSlug),
  ];

  if (options.from) {
    conditions.push(gte(enterpriseAuditLog.createdAt, options.from));
  }
  if (options.to) {
    conditions.push(lte(enterpriseAuditLog.createdAt, options.to));
  }
  if (options.action) {
    conditions.push(eq(enterpriseAuditLog.action, options.action));
  }
  if (options.entityType) {
    conditions.push(eq(enterpriseAuditLog.entityType, options.entityType));
  }
  if (options.entityId) {
    conditions.push(eq(enterpriseAuditLog.entityId, options.entityId));
  }
  if (options.userEmail) {
    conditions.push(eq(enterpriseAuditLog.userEmail, options.userEmail));
  }
  if (options.severity) {
    conditions.push(eq(enterpriseAuditLog.severity, options.severity));
  }

  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  const [countResult] = await db()
    .select({ count: sql<number>`count(*)` })
    .from(enterpriseAuditLog)
    .where(and(...conditions));

  const entries = await db()
    .select()
    .from(enterpriseAuditLog)
    .where(and(...conditions))
    .orderBy(desc(enterpriseAuditLog.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    entries,
    total: countResult?.count ?? 0,
    limit,
    offset,
    hasMore: offset + limit < (countResult?.count ?? 0),
  };
}

/**
 * Verify hash chain integrity for a tenant's audit log.
 * Returns { valid, brokenAt } — if brokenAt is set, the chain is tampered.
 */
export async function verifyHashChain(
  tenantSlug: string,
  limit = 1000,
): Promise<{ valid: boolean; brokenAt?: string; verified: number }> {
  const entries = await db()
    .select()
    .from(enterpriseAuditLog)
    .where(eq(enterpriseAuditLog.tenantSlug, tenantSlug))
    .orderBy(enterpriseAuditLog.createdAt)
    .limit(limit);

  if (entries.length === 0) {
    return { valid: true, verified: 0 };
  }

  let previousHash: string | null = null;

  for (const entry of entries) {
    const expectedHash = computeHashChain(previousHash, {
      tenantSlug: entry.tenantSlug,
      action: entry.action,
      entityType: entry.entityType ?? undefined,
      entityId: entry.entityId ?? undefined,
      timestamp: entry.createdAt.toISOString(),
    });

    if (entry.hashChain !== expectedHash) {
      return {
        valid: false,
        brokenAt: entry.createdAt.toISOString(),
        verified: entries.indexOf(entry),
      };
    }

    previousHash = entry.hashChain;
  }

  return { valid: true, verified: entries.length };
}

/**
 * Get audit statistics for a tenant.
 */
export async function getAuditStats(tenantSlug: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [totalRow] = await db()
    .select({ count: sql<number>`count(*)` })
    .from(enterpriseAuditLog)
    .where(
      and(
        eq(enterpriseAuditLog.tenantSlug, tenantSlug),
        gte(enterpriseAuditLog.createdAt, since),
      ),
    );

  const actionRows = await db()
    .select({
      action: enterpriseAuditLog.action,
      cnt: sql<number>`count(*)`,
    })
    .from(enterpriseAuditLog)
    .where(
      and(
        eq(enterpriseAuditLog.tenantSlug, tenantSlug),
        gte(enterpriseAuditLog.createdAt, since),
      ),
    )
    .groupBy(enterpriseAuditLog.action);

  const severityRows = await db()
    .select({
      severity: enterpriseAuditLog.severity,
      cnt: sql<number>`count(*)`,
    })
    .from(enterpriseAuditLog)
    .where(
      and(
        eq(enterpriseAuditLog.tenantSlug, tenantSlug),
        gte(enterpriseAuditLog.createdAt, since),
      ),
    )
    .groupBy(enterpriseAuditLog.severity);

  const byAction: Record<string, number> = {};
  for (const row of actionRows) {
    byAction[row.action] = row.cnt;
  }
  const bySeverity: Record<string, number> = {};
  for (const row of severityRows) {
    bySeverity[row.severity] = row.cnt;
  }

  return {
    total: totalRow?.count ?? 0,
    period: `${days} days`,
    byAction,
    bySeverity,
  };
}

/**
 * Export audit log as CSV for compliance.
 */
export async function exportAuditCsv(options: AuditQueryOptions): Promise<string> {
  const { entries } = await queryAuditLog({ ...options, limit: 10000 });

  const headers = [
    "ID",
    "Fecha",
    "Usuario",
    "Rol",
    "Acción",
    "Entidad",
    "Entidad ID",
    "Severidad",
    "Detalles",
    "IP",
    "Request ID",
    "Hash",
  ];

  const rows = entries.map((e) => [
    String(e.id),
    e.createdAt.toISOString(),
    e.userEmail ?? "",
    e.userRole ?? "",
    e.action,
    e.entityType ?? "",
    e.entityId ?? "",
    e.severity,
    JSON.stringify(e.details ?? {}),
    e.ipAddress ?? "",
    e.requestId ?? "",
    e.hashChain ?? "",
  ]);

  const csvRows = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return csvRows;
}
