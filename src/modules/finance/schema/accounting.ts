/**
 * Accounting — Drizzle ORM schema (Plan de Cuentas, Asientos Contables).
 *
 * Implements the double-entry accounting system required for
 * Paraguayan RG 90 / Marangatu compliance:
 *   - Plan de Cuentas (Chart of Accounts) — hierarchical, multi-level
 *   - Asientos Contables (Journal Entries) — double-entry with Debe/Haber
 *   - Asientos Detalle (Journal Entry Lines) — individual debit/credit lines
 *
 * Multi-tenant: these tables live in each tenant's schema.
 *
 * @module finance/schema/accounting
 */

import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ─── ENUMs ─────────────────────────────────────

/**
 * Tipo de cuenta contable según el PUC (Plan Único de Cuentas).
 */
export const tipoCuentaEnum = pgEnum("tipo_cuenta_contable", [
  "ACTIVO",
  "PASIVO",
  "PATRIMONIO",
  "INGRESO",
  "GASTO",
  "COSTO",
  "ORDEN",
]);

export type TipoCuenta = typeof tipoCuentaEnum.enumValues[number];

/**
 * Estado de un asiento contable.
 */
export const estadoAsientoEnum = pgEnum("estado_asiento", [
  "BORRADOR",     // En edición
  "CONTABILIZADO",// Contabilizado (definitivo)
  "ANULADO",      // Anulado
]);

export type EstadoAsiento = typeof estadoAsientoEnum.enumValues[number];

// ─── Tables ────────────────────────────────────

/**
 * Plan de Cuentas Contable.
 *
 * Estructura jerárquica de cuentas siguiendo el PUC paraguayo.
 * Cada cuenta tiene un código único, nombre, tipo y puede tener
 * una cuenta padre para la jerarquía.
 *
 * Niveles típicos:
 *   1 → Activo / Pasivo / Patrimonio / Ingresos / Gastos
 *   1.1 → Activo Corriente / No Corriente
 *   1.1.01 → Caja y Bancos
 *   1.1.01.001 → Caja Chica
 */
export const planCuentas = pgTable(
  "plan_cuentas",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Código de cuenta (e.g. "1.1.01.001").
     * Debe ser único dentro del tenant.
     */
    codigo: text("codigo").notNull(),

    /** Nombre de la cuenta */
    nombre: text("nombre").notNull(),

    /** Tipo de cuenta */
    tipo: tipoCuentaEnum("tipo").notNull(),

    /**
     * Cuenta padre (para jerarquía).
     * NULL para cuentas de nivel 1 (raíz).
     */
    cuentaPadreId: uuid("cuenta_padre_id"),

    /**
     * Nivel jerárquico:
     *   1 → Raíz (Activo, Pasivo, etc.)
     *   2 → Grupo (Activo Corriente)
     *   3 → Subgrupo (Caja y Bancos)
     *   4 → Cuenta contable (Caja Chica)
     *   5 → Subcuenta (opcional)
     */
    nivel: integer("nivel").notNull().default(1),

    /** Indica si la cuenta acepta movimientos (asientos) */
    aceptaMovimientos: boolean("acepta_movimientos").notNull().default(true),

    /** Saldo inicial / de apertura */
    saldoInicial: numeric("saldo_inicial", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Moneda de la cuenta */
    moneda: text("moneda").notNull().default("PYG"),

    /** Cuenta activa (no dada de baja) */
    activo: boolean("activo").notNull().default(true),

    /** Descripción opcional */
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
    /** Unique constraint on codigo */
    codigoUnique: unique("plan_cuentas_codigo_unique").on(table.codigo),

    /** Index on tipo — filter by account type */
    tipoIdx: index("plan_cuentas_tipo_idx").on(table.tipo),
    /** Index on cuenta_padre_id — hierarchical queries */
    padreIdx: index("plan_cuentas_padre_idx").on(table.cuentaPadreId),
    /** Index on nivel — list by depth */
    nivelIdx: index("plan_cuentas_nivel_idx").on(table.nivel),
    /** Index on activo */
    activoIdx: index("plan_cuentas_activo_idx").on(table.activo),
  }),
);

/**
 * Asientos Contables (Journal Entries).
 *
 * Cada asiento representa una transacción contable con partida doble.
 * Un asiento debe tener al menos dos líneas (un Debe y un Haber)
 * y el total del Debe debe ser igual al total del Haber.
 */
export const asientosContables = pgTable(
  "asientos_contables",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Número de asiento secuencial por período.
     * Se autoincrementa por mes/año dentro del tenant.
     */
    numero: integer("numero").notNull(),

    /** Fecha del asiento */
    fecha: timestamp("fecha", { withTimezone: true }).notNull(),

    /** Concepto / glosa del asiento */
    concepto: text("concepto").notNull(),

    /** Estado del asiento */
    estado: estadoAsientoEnum("estado").notNull().default("BORRADOR"),

    /** Total Débito del asiento */
    totalDebe: numeric("total_debe", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Total Crédito del asiento */
    totalHaber: numeric("total_haber", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Diferencia (debe - haber), debe ser 0.00 */
    diferencia: numeric("diferencia", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Referencia a documento externo (factura, recibo, etc.) */
    documentoRef: text("documento_ref"),

    /** Módulo de origen (e.g. "SIFEN", "INVENTARIO", "NOMINA") */
    moduloOrigen: text("modulo_origen"),

    /** Work order UUID if related */
    ordenTrabajoId: uuid("orden_trabajo_id"),

    /** DTE UUID if related */
    documentoFiscalId: uuid("documento_fiscal_id"),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Index on fecha — period queries */
    fechaIdx: index("asientos_fecha_idx").on(table.fecha),
    /** Index on modulo_origen — trace by module */
    moduloIdx: index("asientos_modulo_idx").on(table.moduloOrigen),
    /** Index on orden_trabajo_id */
    otIdx: index("asientos_ot_idx").on(table.ordenTrabajoId),
    /** Index on estado */
    estadoIdx: index("asientos_estado_idx").on(table.estado),
  }),
);

/**
 * Detalle de Asientos Contables.
 *
 * Cada línea de un asiento: una cuenta, un monto de Débito o Crédito.
 * El principio de partida doble exige que ∑Debe = ∑Haber por asiento.
 */
export const asientosDetalle = pgTable(
  "asientos_detalle",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Parent asiento */
    asientoId: uuid("asiento_id")
      .notNull()
      .references(() => asientosContables.id, { onDelete: "cascade" }),

    /** Chart of account UUID */
    cuentaId: uuid("cuenta_id")
      .notNull()
      .references(() => planCuentas.id, { onDelete: "restrict" }),

    /** Número de línea dentro del asiento */
    numeroLinea: integer("numero_linea").notNull().default(1),

    /** Monto Débito (debe ser NULL si es crédito) */
    debe: numeric("debe", { precision: 14, scale: 2 }),

    /** Monto Crédito (debe ser NULL si es débito) */
    haber: numeric("haber", { precision: 14, scale: 2 }),

    /** Descripción adicional de la línea */
    descripcion: text("descripcion"),

    /**
     * Centro de Costo (dimensión analítica).
     * Obligatorio para cuentas de COSTO (5) y GASTO (6).
     */
    centroCostoId: uuid("centro_costo_id"),

    /**
     * Orden de Trabajo (dimensión analítica).
     * Obligatorio para cuentas de COSTO (5) y GASTO (6).
     */
    ordenTrabajoIdLinea: uuid("orden_trabajo_id_linea"),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    asientoIdx: index("asientos_detalle_asiento_idx").on(table.asientoId),
    cuentaIdx: index("asientos_detalle_cuenta_idx").on(table.cuentaId),
  }),
);

// ─── Types ────────────────────────────────────

export type PlanCuenta = typeof planCuentas.$inferSelect;
export type NewPlanCuenta = typeof planCuentas.$inferInsert;

export type AsientoContable = typeof asientosContables.$inferSelect;
export type NewAsientoContable = typeof asientosContables.$inferInsert;

export type AsientoDetalle = typeof asientosDetalle.$inferSelect;
export type NewAsientoDetalle = typeof asientosDetalle.$inferInsert;
