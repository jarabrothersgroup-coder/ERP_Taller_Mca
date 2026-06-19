/**
 * DVI (Digital Vehicle Inspection) — Drizzle ORM schema.
 *
 * Manages vehicle inspections with photo documentation,
 * markup annotations, and health score tracking.
 *
 * Each DVI is linked to a work order and captures:
 *   - Exterior/interior condition photos
 *   - Canvas markup annotations (circles, arrows, text)
 *   - Health score (0-100) based on inspection items
 *   - WhatsApp delivery status
 *
 * @module dvi/schema/dvi
 */

import {
  boolean,
  index,
  integer,
  json,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { ordenesTrabajo } from "../../workshop/schema/ordenes-trabajo.js";

// ─── Table ────────────────────────────────────

/**
 * DVI — Digital Vehicle Inspection records.
 */
export const dviInspections = pgTable(
  "dvi_inspections",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Linked work order (FK → ordenes_trabajo) */
    ordenTrabajoId: uuid("orden_trabajo_id")
      .notNull()
      .references(() => ordenesTrabajo.id, { onDelete: "cascade" }),

    /** Health score (0-100) — calculated from inspection items */
    healthScore: integer("health_score").notNull().default(0),

    /** Overall condition rating: EXCELENTE, BUENO, REGULAR, MALO, CRITICO */
    condicionGeneral: text("condicion_general").notNull().default("REGULAR"),

    /** Inspection notes / observations */
    observaciones: text("observaciones"),

    /** Inspector name / mechanic */
    inspector: text("inspector"),

    /** Whether the DVI has been shared via WhatsApp */
    compartidoWhatsApp: boolean("compartido_whatsapp").notNull().default(false),

    /** Timestamp when shared via WhatsApp */
    compartidoAt: timestamp("compartido_at", { withTimezone: true }),

    /** Health score URL for client sharing */
    healthScoreUrl: text("health_score_url"),

    /** Multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    ordenIdx: index("dvi_orden_idx").on(table.ordenTrabajoId),
    tenantIdx: index("dvi_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── DVI Photos Table ─────────────────────────

/**
 * DVI Photos — photos captured during inspection.
 */
export const dviPhotos = pgTable(
  "dvi_photos",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Parent DVI inspection (FK → dvi_inspections) */
    dviId: uuid("dvi_id")
      .notNull()
      .references(() => dviInspections.id, { onDelete: "cascade" }),

    /** Photo category: EXTERIOR, INTERIOR, MOTOR, CHASIS, DOCUMENTACION, OTRO */
    categoria: text("categoria").notNull(),

    /** Photo URL (Supabase Storage) */
    url: text("url").notNull(),

    /** Original filename */
    nombreArchivo: text("nombre_archivo"),

    /** Markup annotations (JSON array of Canvas operations) */
    markup: json("markup"),

    /** Optional caption / description */
    caption: text("caption"),

    /** Display order */
    orden: integer("orden").notNull().default(0),

    /** Multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    dviIdx: index("dvi_photo_dvi_idx").on(table.dviId),
    tenantIdx: index("dvi_photo_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── DVI Items Table ──────────────────────────

/**
 * DVI Items — individual inspection checklist items.
 */
export const dviItems = pgTable(
  "dvi_items",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Parent DVI inspection (FK → dvi_inspections) */
    dviId: uuid("dvi_id")
      .notNull()
      .references(() => dviInspections.id, { onDelete: "cascade" }),

    /** Item category: FRENOS, MOTOR, SUSPENSION, ELECTRICO, NEUMATICOS, etc. */
    categoria: text("categoria").notNull(),

    /** Item description */
    descripcion: text("descripcion").notNull(),

    /** Status: OK, REQUIERE_ATENCION, CRITICO */
    estado: text("estado").notNull().default("OK"),

    /** Severity weight for health score calculation (1-10) */
    peso: integer("peso").notNull().default(5),

    /** Optional notes for this item */
    notas: text("notas"),

    /** Multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    dviIdx: index("dvi_item_dvi_idx").on(table.dviId),
    tenantIdx: index("dvi_item_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

export type DviInspection = typeof dviInspections.$inferSelect;
export type NewDviInspection = typeof dviInspections.$inferInsert;

export type DviPhoto = typeof dviPhotos.$inferSelect;
export type NewDviPhoto = typeof dviPhotos.$inferInsert;

export type DviItem = typeof dviItems.$inferSelect;
export type NewDviItem = typeof dviItems.$inferInsert;
