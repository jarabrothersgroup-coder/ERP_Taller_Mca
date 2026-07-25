/**
 * CRM Deals — Drizzle ORM schema.
 *
 * Local deal/opportunity tracking for the workshop CRM pipeline.
 * Each deal represents a potential sale or service opportunity.
 *
 * @module crm/schema/deals
 */

import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";

export const crmPipelineStages = pgTable("crm_pipeline_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  orden: integer("orden").notNull().default(0),
  color: varchar("color", { length: 20 }).default("#6366f1"),
  activo: boolean("activo").notNull().default(true),
  tenantSlug: text("tenant_slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("crm_stages_tenant_idx").on(table.tenantSlug),
}));

export const crmDeals = pgTable("crm_deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  clienteNombre: varchar("cliente_nombre", { length: 255 }),
  clienteEmail: varchar("cliente_email", { length: 255 }),
  clientePhone: varchar("cliente_phone", { length: 30 }),
  vehiculoChapa: varchar("vehiculo_chapa", { length: 20 }),
  vehiculoMarca: varchar("vehiculo_marca", { length: 100 }),
  vehiculoModelo: varchar("vehiculo_modelo", { length: 100 }),
  stageId: uuid("stage_id").notNull(),
  valorEstimado: numeric("valor_estimado", { precision: 15, scale: 2 }).default("0"),
  probabilidad: integer("probabilidad").default(50),
  fuente: varchar("fuente", { length: 50 }).default("directo"),
  responsable: varchar("responsable", { length: 255 }),
  fechaCierre: timestamp("fecha_cierre", { withTimezone: true }),
  ganado: boolean("ganado"),
  ordenTrabajoId: uuid("orden_trabajo_id"),
  tenantSlug: text("tenant_slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("crm_deals_tenant_idx").on(table.tenantSlug),
  stageIdx: index("crm_deals_stage_idx").on(table.stageId),
}));

export type CrmPipelineStage = typeof crmPipelineStages.$inferSelect;
export type NewCrmPipelineStage = typeof crmPipelineStages.$inferInsert;
export type CrmDeal = typeof crmDeals.$inferSelect;
export type NewCrmDeal = typeof crmDeals.$inferInsert;
