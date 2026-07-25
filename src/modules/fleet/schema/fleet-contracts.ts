/**
 * Fleet Contracts — Recurring billing contracts for fleet clients.
 *
 * Tracks monthly/quarterly/annual service contracts with auto-invoicing.
 *
 * @module fleet/schema/fleet-contracts
 */

import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Fleet service contracts with recurring billing.
 */
export const fleetContracts = pgTable(
  "fleet_contracts",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    /** Associated fleet client */
    fleetId: uuid("fleet_id").notNull(),

    /** Contract name */
    nombre: text("nombre").notNull(),

    /** Monthly billing amount (Gs.) */
    montoMensual: numeric("monto_mensual", { precision: 14, scale: 2 }).notNull(),

    /** Billing cycle: MENSUAL | TRIMESTRAL | ANUAL */
    cicloFacturacion: text("ciclo_facturacion").notNull().default("MENSUAL"),

    /** Day of month to bill (1-28) */
    diaCobro: integer("dia_cobro").notNull().default(1),

    /** Next invoice generation date */
    proximaFactura: timestamp("proxima_factura", { withTimezone: true }),

    /** Contract status: ACTIVO | SUSPENDIDO | CANCELADO */
    estado: text("estado").notNull().default("ACTIVO"),

    /** Contract description */
    descripcion: text("descripcion"),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("fleet_contracts_tenant_idx").on(table.tenantSlug),
    fleetIdx: index("fleet_contracts_fleet_idx").on(table.fleetId),
    estadoIdx: index("fleet_contracts_estado_idx").on(table.estado),
    proximaIdx: index("fleet_contracts_proxima_idx").on(table.proximaFactura),
  }),
);

export type FleetContract = typeof fleetContracts.$inferSelect;
export type NewFleetContract = typeof fleetContracts.$inferInsert;
