/**
 * WhatsApp Template schema — Customizable templates with variable placeholders.
 *
 * @module whatsapp/schema/whatsapp-template
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * WhatsApp message templates — per-tenant customizable.
 *
 * Variables use {{variable_name}} syntax:
 *   {{nombre_cliente}}, {{vehiculo}}, {{chapa}}, {{orden_id}},
 *   {{monto_total}}, {{fecha_estimada}}, {{tecnico}}, {{taller}},
 *   {{numero_factura}}, {{url_encuesta}}, {{kilometraje}}
 */
export const whatsappTemplates = pgTable("whatsapp_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantSlug: varchar("tenant_slug", { length: 100 }).notNull(),

  /** Template key — unique per tenant (e.g., "recepcion", "presupuesto", "garantia") */
  key: varchar("key", { length: 100 }).notNull(),

  /** Display name */
  name: varchar("name", { length: 200 }).notNull(),

  /** Message body with {{variables}} */
  body: text("body").notNull(),

  /** Category for grouping */
  category: varchar("category", { length: 50 }).notNull().default("general"),

  /** Whether this template is active */
  active: boolean("active").notNull().default(true),

  /** Available variables for this template */
  variables: jsonb("variables").$type<string[]>().notNull().default([]),

  /** Trigger event: null = manual only, "ot_created", "ot_completed", "warranty_expiring", "service_reminder", "survey" */
  triggerEvent: varchar("trigger_event", { length: 50 }),

  /** Delay after trigger in hours (0 = immediate) */
  triggerDelayHours: varchar("trigger_delay_hours", { length: 10 }).notNull().default("0"),

  /** Number of times to retry if delivery fails */
  maxRetries: varchar("max_retries", { length: 5 }).notNull().default("2"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
