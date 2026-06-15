/**
 * Fiscal Forms — Drizzle ORM schema (Formularios DNIT).
 *
 * Almacena las liquidaciones de impuestos generadas por el Motor Fiscal:
 *   - Formulario 120 (IVA Mensual) — débito/crédito fiscal
 *   - Formulario 500/501/502 (IRE Anual) — renta neta
 *   - Formulario 520 (IDU) — dividendos
 *
 * Cada liquidación queda persistida para auditoría y reconciliación.
 *
 * @module finance/schema/fiscal-forms
 */

import {
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
 * Tipo de formulario fiscal DNIT.
 */
export const formularioTipoEnum = pgEnum("formulario_tipo", [
  "FORM_120_IVA",       // IVA Mensual
  "FORM_500_IRE",       // IRE General (anual)
  "FORM_501_IRE_SIMPLE",// IRE Simple (anual)
  "FORM_502_IRE_RESIMPLE", // IRE Resimple
  "FORM_520_IDU",       // IDU (Dividendos)
  "FORM_130_ISC",       // ISC (Consumo Selectivo)
  "FORM_515_INR",       // INR (No Residentes)
]);

export type FormularioTipo = typeof formularioTipoEnum.enumValues[number];

/**
 * Estado de la liquidación.
 */
export const liquidacionEstadoEnum = pgEnum("liquidacion_estado", [
  "BORRADOR",      // Calculado pero no presentado
  "PRESENTADO",    // Presentado en Marangatú
  "PAGADO",        // Pagado
  "RECTIFICADO",   // Rectificado
]);

export type LiquidacionEstado = typeof liquidacionEstadoEnum.enumValues[number];

// ─── Tables ────────────────────────────────────

/**
 * Períodos Fiscales Cerrados.
 *
 * Registra qué períodos (mes/año) han sido declarados para cada formulario,
 * evitando doble declaración y permitiendo rectificaciones.
 */
export const periodosFiscales = pgTable(
  "periodos_fiscales",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Formulario */
    formulario: formularioTipoEnum("formulario").notNull(),

    /** Año fiscal */
    anho: integer("anho").notNull(),

    /** Mes fiscal (1-12; 0 para anuales) */
    mes: integer("mes").notNull().default(0),

    /** Estado de la liquidación */
    estado: liquidacionEstadoEnum("estado").notNull().default("BORRADOR"),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    /** Fecha de presentación en Marangatú */
    fechaPresentacion: timestamp("fecha_presentacion", { withTimezone: true }),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Unique: un periodo por formulario por tenant */
    periodoUnique: unique("periodo_fiscal_unique").on(
      table.formulario, table.anho, table.mes, table.tenantSlug,
    ),
    tenantIdx: index("periodos_fiscales_tenant_idx").on(table.tenantSlug),
    formularioIdx: index("periodos_fiscales_form_idx").on(table.formulario),
  }),
);

/**
 * Liquidaciones de IVA (Formulario 120).
 *
 * Resultado del cálculo mensual de IVA: Débito Fiscal, Crédito Fiscal,
 * y saldo resultante. Persistido para auditoría y exportación Marangatú.
 */
export const liquidacionesIva = pgTable(
  "liquidaciones_iva",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Referencia al período fiscal */
    periodoFiscalId: uuid("periodo_fiscal_id")
      .notNull()
      .references(() => periodosFiscales.id, { onDelete: "cascade" }),

    // ─── Débito Fiscal (Rubro 1) ───────────────
    /** Ventas gravadas tasa 10% — base imponible */
    ventasGravada10: numeric("ventas_gravada_10", { precision: 14, scale: 2 }).notNull().default("0"),
    /** IVA 10% de ventas */
    ventasIva10: numeric("ventas_iva_10", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Ventas gravadas tasa 5% — base imponible */
    ventasGravada5: numeric("ventas_gravada_5", { precision: 14, scale: 2 }).notNull().default("0"),
    /** IVA 5% de ventas */
    ventasIva5: numeric("ventas_iva_5", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Ventas exoneradas */
    ventasExenta: numeric("ventas_exenta", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Total de ventas del período */
    ventasTotal: numeric("ventas_total", { precision: 14, scale: 2 }).notNull().default("0"),

    // ─── Crédito Fiscal (Rubro 2) ─────────────
    /** Compras gravadas tasa 10% — base imponible */
    comprasGravada10: numeric("compras_gravada_10", { precision: 14, scale: 2 }).notNull().default("0"),
    /** IVA 10% de compras */
    comprasIva10: numeric("compras_iva_10", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Compras gravadas tasa 5% — base imponible */
    comprasGravada5: numeric("compras_gravada_5", { precision: 14, scale: 2 }).notNull().default("0"),
    /** IVA 5% de compras */
    comprasIva5: numeric("compras_iva_5", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Otras compras / no gravadas */
    comprasOtras: numeric("compras_otras", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Total de compras del período */
    comprasTotal: numeric("compras_total", { precision: 14, scale: 2 }).notNull().default("0"),

    // ─── Liquidación (Rubro 3) ─────────────────
    /** IVA Débito total */
    ivaDebito: numeric("iva_debito", { precision: 14, scale: 2 }).notNull().default("0"),
    /** IVA Crédito total */
    ivaCredito: numeric("iva_credito", { precision: 14, scale: 2 }).notNull().default("0"),
    /** IVA a Pagar (si resultado > 0) */
    ivaAPagar: numeric("iva_a_pagar", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Saldo a Favor (si resultado < 0) */
    saldoFavor: numeric("saldo_favor", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Índice de prorrateo (si aplica) */
    prorrateoIndice: numeric("prorrateo_indice", { precision: 5, scale: 4 }),

    /** Saldo arrastre del período anterior */
    saldoArrastre: numeric("saldo_arrastre", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Flags de alerta (JSON array) */
    alertas: text("alertas"),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    periodoIdx: index("liq_iva_periodo_idx").on(table.periodoFiscalId),
    tenantIdx: index("liq_iva_tenant_idx").on(table.tenantSlug),
  }),
);

/**
 * Liquidaciones de IRE (Formularios 500/501/502).
 *
 * Resultado del cálculo anual del Impuesto a la Renta Empresarial:
 *   - Renta Neta = Ingresos Brutos − Costos − Gastos Deducibles
 *   - IRE = Renta Neta × 10%
 *   - Reserva Legal = Renta Neta × 5% (Ley 1034/83)
 *
 * Persistido para auditoría y exportación Marangatú.
 */
export const liquidacionesIre = pgTable(
  "liquidaciones_ire",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Referencia al período fiscal (anual, mes=0) */
    periodoFiscalId: uuid("periodo_fiscal_id")
      .notNull()
      .references(() => periodosFiscales.id, { onDelete: "cascade" }),

    // ─── Ingresos Brutos ──────────────────────
    /** Ingresos por Venta de Servicios (4.1.1.x) */
    ingresosServicios: numeric("ingresos_servicios", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Ingresos por Venta de Bienes (4.1.2.x) */
    ingresosBienes: numeric("ingresos_bienes", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Ingresos No Operacionales (4.2.x) */
    ingresosNoOperacionales: numeric("ingresos_no_operacionales", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Total Ingresos Brutos */
    ingresosBrutos: numeric("ingresos_brutos", { precision: 14, scale: 2 }).notNull().default("0"),

    // ─── Costos ───────────────────────────────
    /** Costo de Repuestos e Insumos (5.1.1.x) */
    costoRepuestos: numeric("costo_repuestos", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Costo de Mano de Obra Directa (5.1.2.x) */
    costoManoObra: numeric("costo_mano_obra", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Costos Indirectos de Taller (5.1.3.x) */
    costosIndirectos: numeric("costos_indirectos", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Total Costos */
    totalCostos: numeric("total_costos", { precision: 14, scale: 2 }).notNull().default("0"),

    // ─── Gastos Deducibles ────────────────────
    /** Gastos Administrativos (6.1.x) */
    gastosAdministrativos: numeric("gastos_administrativos", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Gastos de Ventas y Marketing (6.2.x) */
    gastosVentas: numeric("gastos_ventas", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Total Gastos Deducibles */
    totalGastos: numeric("total_gastos", { precision: 14, scale: 2 }).notNull().default("0"),

    // ─── Deducciones Adicionales ──────────────
    /** Donaciones deducibles (hasta 10% Renta Neta) */
    donaciones: numeric("donaciones", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Otras deducciones permitidas */
    otrasDeducciones: numeric("otras_deducciones", { precision: 14, scale: 2 }).notNull().default("0"),

    // ─── Cálculo ──────────────────────────────
    /** Renta Neta = Ingresos Brutos − Costos − Gastos − Deducciones */
    rentaNeta: numeric("renta_neta", { precision: 14, scale: 2 }).notNull().default("0"),
    /** IRE (10% de Renta Neta, > 0) */
    impuestoIre: numeric("impuesto_ire", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Reserva Legal (5% de Renta Neta, Ley 1034/83) */
    reservaLegal: numeric("reserva_legal", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Renta Neta después de IRE (retenciones, anticipos) */
    retenciones: numeric("retenciones", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Anticipos de IRE pagados */
    anticipos: numeric("anticipos", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Saldo a Pagar = IRE − Retenciones − Anticipos */
    saldoPagar: numeric("saldo_pagar", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Saldo a Favor (si pagó de más) */
    saldoFavorIre: numeric("saldo_favor_ire", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Flags de alerta (JSON array) */
    alertas: text("alertas"),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    periodoIdx: index("liq_ire_periodo_idx").on(table.periodoFiscalId),
    tenantIdx: index("liq_ire_tenant_idx").on(table.tenantSlug),
  }),
);

/**
 * Liquidaciones de IDU (Formulario 520 — Impuesto a los Dividendos).
 *
 * Calcula el impuesto sobre las utilidades distribuidas a socios/accionistas.
 *
 *   Utilidad Distribuible = Renta Neta (IRE) − IRE − Reserva Legal
 *   IDU = Utilidad Efectiva × 8% (residente) / 15% (no residente)
 *
 * Persistido para auditoría y exportación Marangatú.
 */
export const liquidacionesIdu = pgTable(
  "liquidaciones_idu",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Referencia al período fiscal (anual, mes=0) */
    periodoFiscalId: uuid("periodo_fiscal_id")
      .notNull()
      .references(() => periodosFiscales.id, { onDelete: "cascade" }),

    /** Referencia a la liquidación de IRE que sirve como base */
    liquidacionIreId: uuid("liquidacion_ire_id")
      .references(() => liquidacionesIre.id, { onDelete: "set null" }),

    /** Tipo de beneficiario: RESIDENTE (8%) o NO_RESIDENTE (15%) */
    tipoBeneficiario: text("tipo_beneficiario").notNull().default("RESIDENTE"),

    /** Tasa aplicada (0.08 o 0.15) */
    tasaAplicada: numeric("tasa_aplicada", { precision: 5, scale: 4 }).notNull().default("0.0800"),

    // ─── Base desde IRE ───────────────────────
    /** Renta Neta del ejercicio (desde Form 500) */
    rentaNetaBase: numeric("renta_neta_base", { precision: 14, scale: 2 }).notNull().default("0"),
    /** IRE pagado (desde Form 500) */
    impuestoIrePagado: numeric("impuesto_ire_pagado", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Reserva Legal constituida */
    reservaLegalBase: numeric("reserva_legal_base", { precision: 14, scale: 2 }).notNull().default("0"),

    // ─── Utilidad Distribuible ────────────────
    /** Utilidad Distribuible = Renta Neta − IRE − Reserva Legal */
    utilidadDistribuible: numeric("utilidad_distribuible", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Porcentaje distribuido (ej: 0.50 = 50%) */
    porcentajeDistribuido: numeric("porcentaje_distribuido", { precision: 5, scale: 4 }).notNull().default("1.0000"),
    /** Utilidad efectivamente distribuida */
    utilidadEfectiva: numeric("utilidad_efectiva", { precision: 14, scale: 2 }).notNull().default("0"),

    // ─── Cálculo IDU ──────────────────────────
    /** IDU (8% o 15% de Utilidad Efectiva) */
    impuestoIdu: numeric("impuesto_idu", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Retenciones de IDU sufridas */
    retencionesIdu: numeric("retenciones_idu", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Saldo a Pagar = IDU − Retenciones */
    saldoPagarIdu: numeric("saldo_pagar_idu", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Saldo a Favor */
    saldoFavorIdu: numeric("saldo_favor_idu", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Flags de alerta (JSON array) */
    alertas: text("alertas"),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    periodoIdx: index("liq_idu_periodo_idx").on(table.periodoFiscalId),
    tenantIdx: index("liq_idu_tenant_idx").on(table.tenantSlug),
  }),
);

/**
 * Liquidaciones de ISC (Formulario 130 — Impuesto Selectivo al Consumo).
 *
 * Grava productos específicos: combustibles, tabaco, bebidas alcohólicas,
 * y bienes suntuarios. Se declara mensualmente por cada rubro.
 *
 * Persistido para auditoría y exportación.
 */
export const liquidacionesIsc = pgTable(
  "liquidaciones_isc",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Referencia al período fiscal (mensual) */
    periodoFiscalId: uuid("periodo_fiscal_id")
      .notNull()
      .references(() => periodosFiscales.id, { onDelete: "cascade" }),

    /** Rubro ISC: COMBUSTIBLE, TABACO, BEBIDAS_ALCOHOLICAS, BIENES_SUNTUARIOS, OTROS */
    rubro: text("rubro").notNull(),

    /** Cantidad comercializada (litros, unidades, kg) */
    cantidad: numeric("cantidad", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Unidad de medida */
    unidadMedida: text("unidad_medida").notNull().default("UNIDAD"),

    /** Base imponible (valor de venta/importación) */
    baseImponible: numeric("base_imponible", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Tasa aplicada (específica o porcentual) */
    tasaAplicada: numeric("tasa_aplicada", { precision: 5, scale: 2 }).notNull().default("0"),
    /** Tipo de tasa: PORCENTUAL (ad-valorem) o ESPECIFICA (por unidad) */
    tipoTasa: text("tipo_tasa").notNull().default("PORCENTUAL"),

    /** ISC determinado */
    impuestoIsc: numeric("impuesto_isc", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Créditos/compensaciones */
    creditosIsc: numeric("creditos_isc", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Saldo a Pagar */
    saldoPagarIsc: numeric("saldo_pagar_isc", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Flags de alerta (JSON array) */
    alertas: text("alertas"),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    periodoIdx: index("liq_isc_periodo_idx").on(table.periodoFiscalId),
    tenantIdx: index("liq_isc_tenant_idx").on(table.tenantSlug),
    rubroIdx: index("liq_isc_rubro_idx").on(table.rubro),
  }),
);

/**
 * Liquidaciones de INR (Formulario 515 — Impuesto a la Renta de No Residentes).
 *
 * Grava las rentas obtenidas por entidades del exterior pagadas por
 * contribuyentes locales. Se declara mensualmente por cada tipo de renta.
 *
 * Persistido para auditoría y exportación.
 */
export const liquidacionesInr = pgTable(
  "liquidaciones_inr",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Referencia al período fiscal (mensual) */
    periodoFiscalId: uuid("periodo_fiscal_id")
      .notNull()
      .references(() => periodosFiscales.id, { onDelete: "cascade" }),

    /** Tipo de renta: SERVICIOS_TECNICOS, REGALIAS, INTERESES, DIVIDENDOS, OTROS */
    tipoRenta: text("tipo_renta").notNull(),
    /** Nombre/RUC del beneficiario del exterior */
    beneficiarioNombre: text("beneficiario_nombre").notNull().default(""),
    /** País de residencia del beneficiario */
    beneficiarioPais: text("beneficiario_pais").notNull().default(""),

    /** Monto bruto pagado */
    montoBruto: numeric("monto_bruto", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Tasa de retención aplicada */
    tasaRetencion: numeric("tasa_retencion", { precision: 5, scale: 2 }).notNull().default("0"),
    /** INR retenido */
    impuestoInr: numeric("impuesto_inr", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Saldo a Pagar (ingresar) */
    saldoPagarInr: numeric("saldo_pagar_inr", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Flags de alerta (JSON array) */
    alertas: text("alertas"),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    periodoIdx: index("liq_inr_periodo_idx").on(table.periodoFiscalId),
    tenantIdx: index("liq_inr_tenant_idx").on(table.tenantSlug),
    rentaIdx: index("liq_inr_renta_idx").on(table.tipoRenta),
  }),
);

// ─── Types ────────────────────────────────────

export type PeriodoFiscal = typeof periodosFiscales.$inferSelect;
export type NewPeriodoFiscal = typeof periodosFiscales.$inferInsert;

export type LiquidacionIva = typeof liquidacionesIva.$inferSelect;
export type NewLiquidacionIva = typeof liquidacionesIva.$inferInsert;

export type LiquidacionIre = typeof liquidacionesIre.$inferSelect;
export type NewLiquidacionIre = typeof liquidacionesIre.$inferInsert;

export type LiquidacionIdu = typeof liquidacionesIdu.$inferSelect;
export type NewLiquidacionIdu = typeof liquidacionesIdu.$inferInsert;

export type LiquidacionIsc = typeof liquidacionesIsc.$inferSelect;
export type NewLiquidacionIsc = typeof liquidacionesIsc.$inferInsert;

export type LiquidacionInr = typeof liquidacionesInr.$inferSelect;
export type NewLiquidacionInr = typeof liquidacionesInr.$inferInsert;
