/**
 * Exchange Rates — Drizzle ORM schema (Tipos de Cambio).
 *
 * Almacena los tipos de cambio históricos para conversiones
 * de moneda extranjera (USD, EUR, BRL, ARS → PYG).
 *
 * Se usa para:
 *   - Valuación de activos/pasivos en moneda extranjera
 *   - Cálculo de diferencias de cambio al cierre de período
 *   - Facturación electrónica SIFEN con moneda extranjera
 *
 * @module finance/schema/exchange-rates
 */

import {
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ─── ENUMs ─────────────────────────────────────

export const monedaExtranjeraEnum = pgEnum("moneda_extranjera", [
  "USD",   // Dólar Americano
  "EUR",   // Euro
  "BRL",   // Real Brasileño
  "ARS",   // Peso Argentino
  "CLP",   // Peso Chileno
  "GBP",   // Libra Esterlina
]);

export type MonedaExtranjera = typeof monedaExtranjeraEnum.enumValues[number];

export const fuenteCambioEnum = pgEnum("fuente_tipo_cambio", [
  "BCP",        // Banco Central del Paraguay (oficial)
  "REFERENCIA", // Tipo de cambio de referencia
  "COMPRA",     // Cotización compra (bancos/casas de cambio)
  "VENTA",      // Cotización venta (bancos/casas de cambio)
  "MANUAL",     // Ingresado manualmente
]);

export type FuenteCambio = typeof fuenteCambioEnum.enumValues[number];

// ─── Tables ────────────────────────────────────

/**
 * Tipos de Cambio históricos.
 *
 * Cada fila representa la cotización de una moneda en una fecha
 * específica, con valores de compra y venta.
 */
export const tiposCambio = pgTable(
  "tipos_cambio",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Moneda extranjera */
    moneda: monedaExtranjeraEnum("moneda").notNull(),

    /** Fecha de la cotización */
    fecha: timestamp("fecha", { withTimezone: true }).notNull(),

    /** Tipo de cambio de compra (la institución compra la moneda) */
    compra: numeric("compra", { precision: 14, scale: 2 }).notNull(),

    /** Tipo de cambio de venta (la institución vende la moneda) */
    venta: numeric("venta", { precision: 14, scale: 2 }).notNull(),

    /** Tipo de cambio de referencia (promedio compra/venta o BCP) */
    referencia: numeric("referencia", { precision: 14, scale: 2 }),

    /** Fuente de la cotización */
    fuente: fuenteCambioEnum("fuente").notNull().default("BCP"),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    /** Notas opcionales */
    notas: text("notas"),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Una cotización por moneda/fecha/fuente/tenant */
    cotizacionUnique: unique("tipos_cambio_unique").on(
      table.moneda, table.fecha, table.fuente, table.tenantSlug,
    ),
    monedaFechaIdx: index("tipos_cambio_moneda_fecha_idx").on(table.moneda, table.fecha),
    tenantIdx: index("tipos_cambio_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

export type TipoCambio = typeof tiposCambio.$inferSelect;
export type NewTipoCambio = typeof tiposCambio.$inferInsert;
