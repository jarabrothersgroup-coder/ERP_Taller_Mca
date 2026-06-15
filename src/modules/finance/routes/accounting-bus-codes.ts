/**
 * Accounting Bus — Códigos de Cuentas Contables Estándar.
 *
 * Mapa de códigos PGC (Plan General Contable) para uso en
 * asientos automáticos. Cada módulo del sistema referencia estos
 * códigos y el Accounting Bus resuelve el UUID real vía resolveAccount().
 *
 * Cuentas según PGC Paraguay (DNIT):
 *   1.x.x.x  — Activo
 *   2.x.x.x  — Pasivo
 *   3.x.x.x  — Patrimonio
 *   4.x.x.x  — Ingresos
 *   5.x.x.x  — Costos
 *   6.x.x.x  — Gastos
 *
 * Los códigos corresponden al seed en seed.ts (planCuentasData).
 * Si agregas una cuenta nueva, actualiza ambos archivos.
 *
 * @module finance/routes/accounting-bus-codes
 */

export const AccountingBusCodes = {
  // ── Activo (1) ──────────────────────────
  CAJA: "1.1.1.01",
  BANCOS: "1.1.1.03",
  CLIENTES: "1.1.2.01",
  DEUDORES_VARIOS: "1.1.2.50",
  EXISTENCIAS: "1.1.3.01",
  IVA_CREDITO_FISCAL: "1.1.2.51",
  ACTIVOS_FIJOS: "1.2.1.02",
  DEPRECIACION_ACUMULADA: "1.2.2.01",

  // ── Pasivo (2) ──────────────────────────
  PROVEEDORES: "2.1.1.01",
  IVA_DEBITO_FISCAL: "2.1.2.01",
  SALARIOS_X_PAGAR: "2.1.3.01",
  CARGAS_SOCIALES_X_PAGAR: "2.1.3.03",
  IMPUESTOS_X_PAGAR: "2.1.2.02",
  PRESTAMOS: "2.2.1.01",

  // ── Patrimonio (3) ──────────────────────
  CAPITAL: "3.1.1.01",
  RESULTADOS_ACUMULADOS: "3.1.1.03",
  RESERVA_LEGAL: "3.1.1.02",

  // ── Ingresos (4) ────────────────────────
  INGRESO_SERVICIOS: "4.1.1.01",
  INGRESO_VENTA_REPUESTOS: "4.1.2.01",
  INGRESO_FINANCIERO: "4.2.1.01",

  // ── Costos (5) ──────────────────────────
  COSTO_MANO_OBRA: "5.1.2.01",
  COSTO_REPUESTOS: "5.1.1.01",
  COSTO_SERVICIOS_TERC: "5.1.3.01",

  // ── Gastos (6) ──────────────────────────
  GASTO_SUELDOS: "6.1.1.01",
  GASTO_CARGAS_SOCIALES: "6.1.1.07",
  GASTO_DEPRECIACION: "6.1.1.04",
  GASTO_ALQUILER: "6.1.1.02",
  GASTO_SERVICIOS: "6.1.1.03",
  GASTO_IMPUESTOS: "6.1.1.08",
} as const;
