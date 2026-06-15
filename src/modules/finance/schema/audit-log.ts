/**
 * Audit Log — Drizzle ORM schema (CAPA 4 Compliance).
 *
 * Registro inalterable de todas las operaciones críticas:
 * creación, modificación, anulación de asientos y cuentas.
 *
 * Almacena:
 *   - Usuario que realizó la operación
 *   - Timestamp (servidor)
 *   - Dirección IP
 *   - Tipo de operación (CREATE | UPDATE | DELETE | ANULAR | CERRAR)
 *   - Entidad afectada (asientos_contables | plan_cuentas | etc.)
 *   - ID de la entidad
 *   - Valor anterior (JSONB)
 *   - Valor nuevo (JSONB)
 *
 * @module finance/schema/audit-log
 */

import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Auditoría de operaciones contables.
 *
 * Cada fila es un evento inmutable: una vez insertado,
 * nunca se modifica ni elimina (APPEND-ONLY).
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    /** Email o ID del usuario que realizó la operación */
    usuarioId: text("usuario_id").notNull(),

    /** Dirección IP desde donde se realizó la operación */
    ip: text("ip"),

    /**
     * Tipo de operación:
     *   CREATE, UPDATE, DELETE, ANULAR, CERRAR, APERTURA
     */
    accion: text("accion").notNull(),

    /**
     * Entidad afectada:
     *   asientos_contables, asientos_detalle, plan_cuentas,
     *   tenant_config, activos_fijos, etc.
     */
    entidad: text("entidad").notNull(),

    /** UUID de la fila afectada */
    entidadId: text("entidad_id").notNull(),

    /** Valor anterior completo (JSON), NULL en CREATE */
    valorAnterior: jsonb("valor_anterior"),

    /** Valor nuevo completo (JSON), NULL en DELETE */
    valorNuevo: jsonb("valor_nuevo"),

    /** Descripción legible del cambio */
    descripcion: text("descripcion"),

    // ─── Timestamp (servidor) ───────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("audit_log_tenant_idx").on(table.tenantSlug),
    entidadIdx: index("audit_log_entidad_idx").on(table.entidad, table.entidadId),
    accionIdx: index("audit_log_accion_idx").on(table.accion),
    createdIdx: index("audit_log_created_idx").on(table.createdAt),
    usuarioIdx: index("audit_log_usuario_idx").on(table.usuarioId),
  }),
);

// ─── Types ────────────────────────────────────

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;

/** Acciones permitidas */
export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "ANULAR" | "CERRAR" | "APERTURA" | "REVALUO";
