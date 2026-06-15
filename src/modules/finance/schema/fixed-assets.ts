/**
 * Fixed Assets — Drizzle ORM schema (Activo Fijo).
 *
 * Activos fijos del taller (vehículos de servicio, equipos de diagnóstico,
 * maquinaria, muebles e inmuebles) para depreciación contable mensual.
 *
 * La depreciación mensual genera un asiento contable:
 *   - Débito: Gasto Depreciación (6.3.x)
 *   - Crédito: Depreciación Acumulada (1.2.x)
 *
 * @module finance/schema/fixed-assets
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

export const tipoActivoFijoEnum = pgEnum("tipo_activo_fijo", [
  "EQUIPO_DIAGNOSTICO",    // Escáner automotriz, osciloscopio
  "HERRAMIENTA_ESPECIAL",  // Herramienta de alta precisión
  "VEHICULO_SERVICIO",     // Vehículo de la empresa
  "MAQUINARIA_TALLER",     // Elevador, compresor, etc.
  "MUEBLE_ENSAYRE",        // Mobiliario y equipo de oficina
  "INFORMATICA",           // Computadoras, servidores
  "INMUEBLE",              // Edificio, local
  "OTRO",
]);

export type TipoActivoFijo = typeof tipoActivoFijoEnum.enumValues[number];

export const metodoDepreciacionEnum = pgEnum("metodo_depreciacion_af", [
  "LINEA_RECTA",           // Línea Recta
  "DIGITO_CRECIENTE",      // Suma de Dígitos Creciente
  "DIGITO_DECRECIENTE",    // Suma de Dígitos Decreciente
]);

export type MetodoDepreciacionAF = typeof metodoDepreciacionEnum.enumValues[number];

export const estadoActivoEnum = pgEnum("estado_activo_fijo", [
  "ACTIVO",                // En uso
  "EN_REPARACION",         // En mantenimiento
  "RETIRADO",              // Retirado de servicio
  "VENDIDO",               // Vendido
  "DADO_DE_BAJA",          // Dado de baja
]);

export type EstadoActivoFijo = typeof estadoActivoEnum.enumValues[number];

// ─── Tables ────────────────────────────────────

/**
 * Activos Fijos del Taller.
 *
 * Cada activo se deprecia mensualmente según su método y vida útil.
 * La depreciación se registra en asientos_contables.
 */
export const activosFijos = pgTable(
  "activos_fijos",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    /** Código interno del activo (e.g. "AF-001") */
    codigo: text("codigo").notNull(),

    /** Nombre descriptivo */
    nombre: text("nombre").notNull(),

    /** Tipo de activo fijo */
    tipo: tipoActivoFijoEnum("tipo").notNull(),

    /** Marca / Fabricante */
    marca: text("marca"),

    /** Modelo */
    modelo: text("modelo"),

    /** Número de serie */
    numeroSerie: text("numero_serie"),

    // ─── Contables ────────────────────────────
    /** Fecha de adquisición */
    fechaAdquisicion: timestamp("fecha_adquisicion", { withTimezone: true }).notNull(),

    /** Costo de adquisición (precio de compra + flete + instalación) */
    costoAdquisicion: numeric("costo_adquisicion", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Valor residual estimado al final de la vida útil */
    valorResidual: numeric("valor_residual", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Vida útil en años */
    vidaUtilAnos: integer("vida_util_anos").notNull().default(5),

    /** Método de depreciación */
    metodoDepreciacion: metodoDepreciacionEnum("metodo_depreciacion").notNull().default("LINEA_RECTA"),

    /** Valor actual en libros (se actualiza mensualmente) */
    valorActualLibros: numeric("valor_actual_libros", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Depreciación acumulada hasta la fecha */
    depreciacionAcumulada: numeric("depreciacion_acumulada", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Última fecha de depreciación */
    ultimaDepreciacion: timestamp("ultima_depreciacion", { withTimezone: true }),

    /** Estado del activo */
    estado: estadoActivoEnum("estado").notNull().default("ACTIVO"),

    /**
     * Cuenta contable: Gasto Depreciación (e.g. 6.3.x).
     * Si es null, se resuelve automáticamente por tipo de activo.
     */
    cuentaGastoDepreciacionId: uuid("cuenta_gasto_depreciacion_id"),

    /**
     * Cuenta contable: Depreciación Acumulada (e.g. 1.2.x).
     * Si es null, se resuelve automáticamente por tipo de activo.
     */
    cuentaDepreciacionAcumuladaId: uuid("cuenta_depreciacion_acumulada_id"),

    /** Activo */
    activo: boolean("activo").notNull().default(true),

    /** Notas */
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
    codigoUnique: unique("activos_fijos_codigo_unique").on(table.codigo, table.tenantSlug),
    tenantIdx: index("activos_fijos_tenant_idx").on(table.tenantSlug),
    tipoIdx: index("activos_fijos_tipo_idx").on(table.tipo),
    estadoIdx: index("activos_fijos_estado_idx").on(table.estado),
  }),
);

/**
 * Historial de depreciación de activos fijos.
 *
 * Cada fila representa un mes de depreciación para un activo.
 */
export const depreciacionActivos = pgTable(
  "depreciacion_activos",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Activo fijo */
    activoFijoId: uuid("activo_fijo_id")
      .notNull()
      .references(() => activosFijos.id, { onDelete: "cascade" }),

    /** Asiento contable generado (nullable hasta que se contabilice) */
    asientoId: uuid("asiento_id"),

    /** Período: YYYY-MM */
    periodo: text("periodo").notNull(),

    /** Fecha de la depreciación */
    fecha: timestamp("fecha", { withTimezone: true }).notNull(),

    /** Valor en libros al inicio del período */
    valorInicial: numeric("valor_inicial", { precision: 14, scale: 2 }).notNull(),

    /** Monto de depreciación del período */
    montoDepreciacion: numeric("monto_depreciacion", { precision: 14, scale: 2 }).notNull(),

    /** Valor en libros al final del período */
    valorFinal: numeric("valor_final", { precision: 14, scale: 2 }).notNull(),

    /** Depreciación acumulada después de este período */
    depreciacionAcumulada: numeric("depreciacion_acumulada", { precision: 14, scale: 2 }).notNull(),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    activoPeriodo: unique("dep_activos_periodo_unique").on(table.activoFijoId, table.periodo),
    activoIdx: index("dep_activos_activo_idx").on(table.activoFijoId),
    tenantIdx: index("dep_activos_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

export type ActivoFijo = typeof activosFijos.$inferSelect;
export type NewActivoFijo = typeof activosFijos.$inferInsert;

export type DepreciacionActivo = typeof depreciacionActivos.$inferSelect;
export type NewDepreciacionActivo = typeof depreciacionActivos.$inferInsert;
