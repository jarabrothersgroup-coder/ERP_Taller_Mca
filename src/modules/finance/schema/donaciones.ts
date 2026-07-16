/**
 * Donaciones — Registros de donaciones (deducibles de IRE).
 *
 * Módulo de donaciones: aportes a beneficiarios/ONGs que constituyen
 * deducciones del Impuesto a la Renta Empresarial (IRE, Ley 1034/83).
 * El servicio expone `getDonacionesTotalByPeriod` consumido por el
 * cálculo de IRE para restarlas de la renta neta.
 *
 * Multi-tenant: toda fila lleva `tenant_slug`.
 *
 * @module finance/schema/donaciones
 */

import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";

// ─── Table ────────────────────────────────────

export const donaciones = pgTable(
  "donaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Beneficiario / entidad receptora de la donación */
    beneficiario: text("beneficiario").notNull(),

    /** Descripción del aporte */
    descripcion: text("descripcion"),

    /** Monto de la donación */
    monto: numeric("monto", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Número de comprobante / recibo que respalda la deducción */
    comprobante: text("comprobante"),

    /** Si cuenta como deducción del IRE (Ley 1034/83) */
    deducible: boolean("deducible").notNull().default(true),

    /** Fecha de la donación */
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),

    // ─── Tenant ──────────────────────────────
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("donaciones_tenant_idx").on(table.tenantSlug),
    fechaIdx: index("donaciones_fecha_idx").on(table.fecha),
    deducibleIdx: index("donaciones_deducible_idx").on(table.deducible),
  }),
);

// ─── Types ────────────────────────────────────

export type Donacion = typeof donaciones.$inferSelect;
export type NewDonacion = typeof donaciones.$inferInsert;
