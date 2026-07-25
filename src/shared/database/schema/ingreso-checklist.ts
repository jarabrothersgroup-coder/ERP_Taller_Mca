/**
 * Ingreso Checklist table — Drizzle ORM schema.
 *
 * Structured vehicle check-in checklist with panel-by-panel exterior
 * inspection, tire condition, fuel level, accessories, and digital signatures.
 * Created in Migration 0012 for P1.1.
 *
 * @module shared/database/schema/ingreso-checklist
 */

import {
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { ingresos } from "../../../modules/workshop/schema/index.js";
import { sql } from "drizzle-orm";

/**
 * Ingreso Checklist — detalle estructurado de recepción.
 *
 * Cada ingreso puede tener un checklist con el estado detallado
 * del vehículo al momento de la recepción, incluyendo firmas digitales.
 */
export const ingresoChecklist = pgTable(
  "ingreso_checklist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ingresoId: uuid("ingreso_id")
      .notNull()
      .references(() => ingresos.id, { onDelete: "cascade" })
      .unique(),

    // Estado exterior por panel (JSONB)
    panels: jsonb("panels").notNull().default(sql`'{}'::jsonb`),

    // Estado de neumáticos (JSONB)
    neumaticos: jsonb("neumaticos").notNull().default(sql`'{}'::jsonb`),

    // Nivel de combustible exacto (0.0 - 1.0)
    nivelCombustibleExacto: numeric("nivel_combustible_exacto", { precision: 3, scale: 2 }),

    // Kilometraje con foto
    kilometrajeFoto: boolean("kilometraje_foto").notNull().default(false),

    // Accesorios (JSONB)
    accesorios: jsonb("accesorios").notNull().default(sql`'{}'::jsonb`),

    // Observaciones del cliente
    observacionesCliente: text("observaciones_cliente"),

    // Firma digital del cliente (Base64)
    firmaCliente: text("firma_cliente"),
    firmaClienteNombre: text("firma_cliente_nombre"),
    firmaClienteTimestamp: timestamp("firma_cliente_timestamp", { withTimezone: true }),
    clienteConforme: boolean("cliente_conforme").notNull().default(false),

    // Firma de retiro (Base64)
    firmaRetiro: text("firma_retiro"),
    firmaRetiroNombre: text("firma_retiro_nombre"),
    firmaRetiroTimestamp: timestamp("firma_retiro_timestamp", { withTimezone: true }),

    // Metadata
    tenantSlug: text("tenant_slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ingresoIdx: index("ingreso_checklist_ingreso_idx").on(table.ingresoId),
    tenantIdx: index("ingreso_checklist_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

export type IngresoChecklist = typeof ingresoChecklist.$inferSelect;
export type NewIngresoChecklist = typeof ingresoChecklist.$inferInsert;
