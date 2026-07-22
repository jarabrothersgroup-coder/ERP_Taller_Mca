/**
 * Almacenes — Multi-warehouse schema.
 *
 * Sprint 83/84 — Multi-almacén support.
 * Permite gestionar múltiples ubicaciones físicas de inventario.
 *
 * @module inventory/schema/almacenes
 */

import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";

export const almacenes = pgTable(
  "almacenes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    direccion: text("direccion"),
    responsable: text("responsable"),
    telefono: text("telefono"),
    activo: boolean("activo").notNull().default(true),
    tenantSlug: text("tenant_slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantCodigoIdx: index("almacenes_tenant_codigo_idx").on(table.tenantSlug, table.codigo),
  }),
);

export type Almacen = typeof almacenes.$inferSelect;
export type NewAlmacen = typeof almacenes.$inferInsert;
