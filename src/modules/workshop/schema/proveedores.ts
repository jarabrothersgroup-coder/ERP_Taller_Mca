/**
 * Proveedores (Suppliers) — Drizzle ORM schema.
 *
 * Catalog of third-party suppliers used by the workshop:
 *   - Repuestos suppliers (auto parts)
 *   - Service subcontractors (paint, AC, machining, etc.)
 *   - General suppliers
 *
 * @module workshop/schema/proveedores
 */

import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const proveedores = pgTable(
  "proveedores",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Business name */
    nombre: varchar("nombre", { length: 255 }).notNull(),

    /** Paraguayan RUC (tax ID) */
    ruc: varchar("ruc", { length: 20 }),

    /** Contact phone */
    telefono: varchar("telefono", { length: 30 }),

    /** Contact email */
    email: varchar("email", { length: 255 }),

    /** Physical address */
    direccion: text("direccion"),

    /** Supplier type: REPUESTOS | SERVICIOS | AMBOS */
    tipo: varchar("tipo", { length: 20 }).notNull().default("AMBOS"),

    /** Specialties (JSON array, e.g. ["Pintura", "Electrica"]) */
    especialidades: text("especialidades").default("[]"),

    /** Rating 1-5 */
    calificacion: integer("calificacion"),

    /** Free-form notes */
    notas: text("notas"),

    /** Active flag */
    activo: boolean("activo").notNull().default(true),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("proveedores_tenant_idx").on(table.tenantSlug),
    nombreIdx: index("proveedores_nombre_idx").on(table.nombre),
    rucIdx: index("proveedores_ruc_idx").on(table.ruc),
  }),
);

export type Proveedor = typeof proveedores.$inferSelect;
export type NewProveedor = typeof proveedores.$inferInsert;
