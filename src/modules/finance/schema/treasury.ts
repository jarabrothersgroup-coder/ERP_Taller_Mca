/**
 * Treasury — Drizzle ORM schema (Tesorería, Cuentas por Cobrar/Pagar, Flujo de Caja).
 *
 * Sprint 7: Gestión de liquidez en tiempo real para el taller:
 *   - cuentas_bancarias: cuentas de efectivo/bancos/billeteras digitales
 *   - movimientos_tesoreria: ingresos/egresos/transferencias
 *   - conciliacion_bancaria: conciliación mensual por cuenta
 *   - facturas_proveedor: facturas recibidas pendientes de pago
 *
 * Multi-tenant: estas tablas viven en el schema compartido (public) con tenant_slug.
 *
 * @module finance/schema/treasury
 */

import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { asientosContables, planCuentas } from "./accounting.js";

// ─── Enums ─────────────────────────────────────

/**
 * Tipo de cuenta bancaria/billetera.
 */
export const tipoCuentaBancariaEnum = pgEnum("tipo_cuenta_bancaria", [
  "CAJA_FISICA",
  "CTA_CTE",
  "CAJA_AHORRO",
  "BILLETERA_DIGITAL",
]);

export type TipoCuentaBancaria = (typeof tipoCuentaBancariaEnum.enumValues)[number];

/**
 * Tipo de movimiento de tesorería.
 */
export const tipoMovimientoTesEnum = pgEnum("tipo_movimiento_tes", [
  "INGRESO",
  "EGRESO",
  "TRANSFERENCIA",
  "AJUSTE",
]);

export type TipoMovimientoTes = (typeof tipoMovimientoTesEnum.enumValues)[number];

/**
 * Medio de pago.
 */
export const medioPagoEnum = pgEnum("medio_pago", [
  "EFECTIVO",
  "TRANSFERENCIA",
  "CHEQUE",
  "TARJETA_DEBITO",
  "TARJETA_CREDITO",
]);

export type MedioPago = (typeof medioPagoEnum.enumValues)[number];

/**
 * Estado de pago de facturas (proveedor y cliente).
 */
export const estadoPagoEnum = pgEnum("estado_pago", [
  "PENDIENTE",
  "PARCIAL",
  "PAGA",
  "ANULADA",
]);

export type EstadoPago = (typeof estadoPagoEnum.enumValues)[number];

// ─── Tables ────────────────────────────────────

/**
 * Cuentas bancarias / cajas / billeteras del taller.
 *
 * Cada cuenta tiene un saldo actual que se actualiza automáticamente
 * con cada movimiento (INGRESO incrementa, EGRESO decrementa).
 */
export const cuentasBancarias = pgTable(
  "cuentas_bancarias",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Código interno (ej: "BCO-001") */
    codigo: text("codigo").notNull(),

    /** Nombre descriptivo (ej: "Banco Continental — Cta. Cte.") */
    nombre: text("nombre").notNull(),

    /** Tipo: CAJA_FISICA | CTA_CTE | CAJA_AHORRO | BILLETERA_DIGITAL */
    tipo: text("tipo").notNull(),

    /** Moneda funcional de la cuenta */
    moneda: text("moneda").default("PYG").notNull(),

    /** Saldo contable al inicio del ejercicio */
    saldoInicial: numeric("saldo_inicial").default("0").notNull(),

    /** Saldo actual (se actualiza con cada movimiento) */
    saldoActual: numeric("saldo_actual").default("0").notNull(),

    /** Número de cuenta bancaria (opcional) */
    numeroCuenta: text("numero_cuenta"),

    /** Nombre del banco (opcional para billeteras) */
    banco: text("banco"),

    /** Si está activa (se puede desactivar, no eliminar) */
    activo: boolean("activo").default(true).notNull(),

    // ─── Tenant ──────────────────────────────
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("cuentas_bancarias_tenant_idx").on(table.tenantSlug),
    activoIdx: index("cuentas_bancarias_activo_idx").on(table.activo),
    codigoTenantIdx: index("cuentas_bancarias_codigo_tenant_idx").on(table.codigo, table.tenantSlug),
  }),
);

/**
 * Movimientos de tesorería.
 *
 * Cada fila representa un ingreso, egreso, transferencia o ajuste.
 * Actualiza automáticamente el saldo de la cuenta bancaria.
 * Opcionalmente genera un asiento contable via Accounting Bus.
 */
export const movimientosTes = pgTable(
  "movimientos_tesoreria",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** INGRESO | EGRESO | TRANSFERENCIA | AJUSTE */
    tipo: text("tipo").notNull(),

    /** EFECTIVO | TRANSFERENCIA | CHEQUE | TARJETA_DEBITO | TARJETA_CREDITO */
    medioPago: text("medio_pago").notNull(),

    /** Cuenta bancaria origen/destino */
    cuentaId: uuid("cuenta_id")
      .references(() => cuentasBancarias.id)
      .notNull(),

    /** Cuenta contable asociada (plan_cuentas) */
    cuentaContableId: uuid("cuenta_contable_id").references(() => planCuentas.id),

    /** Monto del movimiento */
    monto: numeric("monto").notNull(),

    /** Moneda (default PYG) */
    moneda: text("moneda").default("PYG").notNull(),

    /** Tipo de cambio si es moneda extranjera */
    tipoCambio: numeric("tipo_cambio").default("1").notNull(),

    /** Fecha contable del movimiento */
    fecha: timestamp("fecha", { withTimezone: true }).notNull(),

    /** Fecha de liquidación real (para cheques diferidos, etc.) */
    fechaValor: timestamp("fecha_valor", { withTimezone: true }),

    /** Concepto / descripción */
    concepto: text("concepto").notNull(),

    /** Tipo de referencia (FACTURA_CLIENTE, FACTURA_PROVEEDOR, NOMINA, OTRO) */
    referenciaTipo: text("referencia_tipo"),

    /** ID de la referencia */
    referenciaId: text("referencia_id"),

    /** Si está conciliado con extracto bancario */
    conciliado: boolean("conciliado").default(false).notNull(),

    /** Fecha de conciliación */
    fechaConciliacion: timestamp("fecha_conciliacion", { withTimezone: true }),

    /** Asiento contable generado automáticamente */
    asientoId: uuid("asiento_id").references(() => asientosContables.id),

    // ─── Tenant + Auditoría ────────────────
    tenantSlug: text("tenant_slug").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("mov_tes_tenant_idx").on(table.tenantSlug),
    cuentaIdx: index("mov_tes_cuenta_idx").on(table.cuentaId),
    fechaIdx: index("mov_tes_fecha_idx").on(table.fecha),
    tipoIdx: index("mov_tes_tipo_idx").on(table.tipo),
    conciliadoIdx: index("mov_tes_conciliado_idx").on(table.conciliado),
    referenciaIdx: index("mov_tes_referencia_idx").on(table.referenciaTipo, table.referenciaId),
  }),
);

/**
 * Conciliación bancaria mensual.
 *
 * Resumen del proceso de conciliación para una cuenta en un período.
 * Al cerrar, saldoLibros debe coincidir con saldoBanco (diferencia = 0).
 */
export const conciliacionBancaria = pgTable(
  "conciliacion_bancaria",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Cuenta bancaria conciliada */
    cuentaId: uuid("cuenta_id")
      .references(() => cuentasBancarias.id)
      .notNull(),

    /** Período (formato "YYYY-MM") */
    periodo: text("periodo").notNull(),

    /** Saldo según nuestros libros */
    saldoLibros: numeric("saldo_libros").notNull(),

    /** Saldo según extracto bancario */
    saldoBanco: numeric("saldo_banco").notNull(),

    /** Diferencia (saldoBanco - saldoLibros) */
    diferencia: numeric("diferencia").notNull(),

    /** Si la conciliación está cerrada */
    conciliado: boolean("conciliado").default(false).notNull(),

    // ─── Tenant ──────────────────────────────
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("conc_banc_tenant_idx").on(table.tenantSlug),
    cuentaPeriodoIdx: index("conc_banc_cuenta_periodo_idx").on(table.cuentaId, table.periodo),
    conciliadoIdx: index("conc_banc_conciliado_idx").on(table.conciliado),
  }),
);

/**
 * Facturas de proveedor (Cuentas por Pagar).
 *
 * Registro de facturas recibidas de proveedores, pendientes de pago.
 * Incluye control de vencimiento, saldo pendiente y estado de pago.
 */
export const facturasProveedor = pgTable(
  "facturas_proveedor",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** FK al cliente/proveedor (reusa tabla clients del tenant) */
    proveedorId: uuid("proveedor_id"),

    /** Número de factura del proveedor */
    nroFactura: text("nro_factura").notNull(),

    /** Tipo de documento: FACTURA | NOTA_CREDITO | OTRO */
    tipoDoc: text("tipo_doc").default("FACTURA").notNull(),

    /** Monto total de la factura */
    total: numeric("total").notNull(),

    /** Saldo pendiente de pago */
    saldoPendiente: numeric("saldo_pendiente"),

    /** Monto de IVA */
    ivaMonto: numeric("iva_monto"),

    /** Base imponible (total - IVA) */
    baseImponible: numeric("base_imponible"),

    /** Fecha de emisión de la factura */
    fechaEmision: timestamp("fecha_emision", { withTimezone: true }).notNull(),

    /** Fecha de vencimiento */
    fechaVencimiento: timestamp("fecha_vencimiento", { withTimezone: true }).notNull(),

    /** Estado de pago: PENDIENTE | PARCIAL | PAGA | ANULADA */
    estadoPago: text("estado_pago").default("PENDIENTE").notNull(),

    /** Concepto / descripción de la compra */
    concepto: text("concepto"),

    /** Cuenta contable de gasto asociada */
    cuentaContableId: uuid("cuenta_contable_id").references(() => planCuentas.id),

    /** OT asociada (opcional) */
    ordenTrabajoId: text("orden_trabajo_id"),

    // ─── Tenant ──────────────────────────────
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("fact_prov_tenant_idx").on(table.tenantSlug),
    estadoIdx: index("fact_prov_estado_idx").on(table.estadoPago),
    vencimientoIdx: index("fact_prov_vencimiento_idx").on(table.fechaVencimiento),
    proveedorIdx: index("fact_prov_proveedor_idx").on(table.proveedorId),
  }),
);

// ─── Types ────────────────────────────────────

export type CuentaBancaria = typeof cuentasBancarias.$inferSelect;
export type NewCuentaBancaria = typeof cuentasBancarias.$inferInsert;

export type MovimientoTes = typeof movimientosTes.$inferSelect;
export type NewMovimientoTes = typeof movimientosTes.$inferInsert;

export type ConciliacionBancaria = typeof conciliacionBancaria.$inferSelect;
export type NewConciliacionBancaria = typeof conciliacionBancaria.$inferInsert;

export type FacturaProveedor = typeof facturasProveedor.$inferSelect;
export type NewFacturaProveedor = typeof facturasProveedor.$inferInsert;
