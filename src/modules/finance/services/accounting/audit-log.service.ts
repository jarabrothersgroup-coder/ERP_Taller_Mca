/**
 * Audit Log Service — CAPA 4 Compliance.
 *
 * Servicio de auditoría inmutable (APPEND-ONLY) para registrar
 * todas las operaciones críticas sobre datos contables.
 *
 * @module finance/services/accounting/audit-log.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { auditLog } from "../../schema/audit-log.js";
import { eq, and, desc, gte, lte, count } from "drizzle-orm";
import type { AuditAction, NewAuditLogEntry } from "../../schema/audit-log.js";

// ─── Write ──────────────────────────────────────

export interface LogAuditParams {
  tenantSlug: string;
  usuarioId: string;
  ip?: string;
  accion: AuditAction;
  entidad: string;
  entidadId: string;
  valorAnterior?: Record<string, unknown> | null;
  valorNuevo?: Record<string, unknown> | null;
  descripcion?: string;
}

/**
 * Registra un evento de auditoría (APPEND-ONLY).
 *
 * @throws Error si la inserción falla (nunca debe silenciarse)
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  const entry: NewAuditLogEntry = {
    tenantSlug: params.tenantSlug,
    usuarioId: params.usuarioId,
    ip: params.ip ?? null,
    accion: params.accion,
    entidad: params.entidad,
    entidadId: params.entidadId,
    valorAnterior: params.valorAnterior ?? null,
    valorNuevo: params.valorNuevo ?? null,
    descripcion: params.descripcion ?? null,
  };

  await db().insert(auditLog).values(entry);
}

// ─── Query ──────────────────────────────────────

export interface AuditLogFilter {
  tenantSlug?: string;
  entidad?: string;
  entidadId?: string;
  accion?: AuditAction;
  desde?: Date;
  hasta?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogQueryResult {
  total: number;
  entries: (typeof auditLog.$inferSelect)[];
}

/**
 * Consulta el log de auditoría con filtros.
 */
export async function queryAuditLog(
  filter: AuditLogFilter,
): Promise<AuditLogQueryResult> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (filter.tenantSlug) conditions.push(eq(auditLog.tenantSlug, filter.tenantSlug));
  if (filter.entidad) conditions.push(eq(auditLog.entidad, filter.entidad));
  if (filter.entidadId) conditions.push(eq(auditLog.entidadId, filter.entidadId));
  if (filter.accion) conditions.push(eq(auditLog.accion, filter.accion));

  const dateConditions: ReturnType<typeof gte>[] = [];
  if (filter.desde) dateConditions.push(gte(auditLog.createdAt, filter.desde));
  if (filter.hasta) dateConditions.push(lte(auditLog.createdAt, filter.hasta));

  const where = conditions.length > 0
    ? and(...conditions, ...dateConditions)
    : dateConditions.length > 0
      ? and(...dateConditions)
      : undefined;

  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;

  const [totalResult] = await db()
    .select({ total: count() })
    .from(auditLog)
    .where(where);

  const entries = await db()
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    total: Number(totalResult?.total ?? 0),
    entries,
  };
}
