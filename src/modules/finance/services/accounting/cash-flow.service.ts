/**
 * Cash Flow Statement — Estado de Flujo de Efectivo (Indirect Method).
 *
 * Genera el Estado de Flujo de Efectivo para un período, usando el
 * método indirecto:
 *   Utilidad Neta
 *   + Ajustes por partidas que no afectan efectivo (depreciación, provisiones)
 *   +/- Cambios en capital de trabajo (CxC, CxP, Inventario)
 *   = Flujo Neto de Actividades Operativas
 *   +/- Actividades de Inversión (compra/venta de activos fijos)
 *   +/- Actividades de Financiamiento (préstamos, aportes, dividendos)
 *   = Variación Neta de Efectivo
 *
 * @module finance/services/accounting/cash-flow.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { planCuentas, asientosContables, asientosDetalle } from "../../schema/index.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

export interface CashFlowLine {
  concepto: string;
  monto: number;
  cuentaCodigo?: string;
  cuentaNombre?: string;
}

export interface CashFlowSection {
  titulo: string;
  lineas: CashFlowLine[];
  total: number;
}

export interface CashFlowStatement {
  periodo: { anho: number; mes: number };
  tipo: "MENSUAL" | "ACUMULADO";
  /** Actividades Operativas */
  operativas: CashFlowSection;
  /** Actividades de Inversión */
  inversion: CashFlowSection;
  /** Actividades de Financiamiento */
  financiamiento: CashFlowSection;
  /** Variación neta del período */
  variacionNeta: number;
  /** Saldo inicial de efectivo */
  saldoInicial: number;
  /** Saldo final de efectivo */
  saldoFinal: number;
  /** Equivalencia contable (debe coincidir con variación en caja/bancos) */
  verificado: boolean;
}

// ─── Service ────────────────────────────────────

/**
 * Genera el Estado de Flujo de Efectivo (método indirecto).
 *
 * @param anho - Año fiscal
 * @param mes - Mes (1-12)
 * @param acumulado - Si true, calcula desde inicio del año
 * @returns Estado de Flujo de Efectivo
 */
export async function getCashFlowStatement(
  anho: number,
  mes: number,
  acumulado = false,
): Promise<CashFlowStatement> {
  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const desde = acumulado
    ? new Date(anho, 0, 1)
    : new Date(anho, mes - 1, 1);

  const hasta = new Date(anho, mes, 0, 23, 59, 59);

  // ── 1. Utilidad Neta del período ──
  const utilidadNeta = await calcularUtilidadNeta(desde, hasta);

  // ── 2. Ajustes por partidas que no afectan efectivo ──
  const ajustesNoEfectivo = await calcularAjustesNoEfectivo(desde, hasta);

  // ── 3. Cambios en capital de trabajo ──
  const cambiosCapitalTrabajo = await calcularCambiosCapitalTrabajo(desde, hasta);

  // ── 4. Actividades de Inversión ──
  const lineasInversion = await calcularActividadesInversion(desde, hasta);

  // ── 5. Actividades de Financiamiento ──
  const lineasFinanciamiento = await calcularActividadesFinanciamiento(desde, hasta);

  // ── 6. Calcular saldos de efectivo ──
  const saldoInicial = await calcularSaldoEfectivo(undefined, desde);
  const saldoFinal = await calcularSaldoEfectivo(undefined, hasta);

  // ── 7. Construir secciones ──
  const lineasOperativas: CashFlowLine[] = [
    { concepto: "Utilidad Neta del Período", monto: utilidadNeta },
    ...ajustesNoEfectivo,
    ...cambiosCapitalTrabajo,
  ];

  const totalOperativo = lineasOperativas.reduce((s, l) => s + l.monto, 0);
  const totalInversion = lineasInversion.reduce((s, l) => s + l.monto, 0);
  const totalFinanciamiento = lineasFinanciamiento.reduce((s, l) => s + l.monto, 0);

  const variacionNeta = totalOperativo + totalInversion + totalFinanciamiento;

  return {
    periodo: { anho, mes },
    tipo: acumulado ? "ACUMULADO" : "MENSUAL",
    operativas: {
      titulo: "Actividades Operativas",
      lineas: lineasOperativas,
      total: Math.round(totalOperativo * 100) / 100,
    },
    inversion: {
      titulo: "Actividades de Inversión",
      lineas: lineasInversion,
      total: Math.round(totalInversion * 100) / 100,
    },
    financiamiento: {
      titulo: "Actividades de Financiamiento",
      lineas: lineasFinanciamiento,
      total: Math.round(totalFinanciamiento * 100) / 100,
    },
    variacionNeta: Math.round(variacionNeta * 100) / 100,
    saldoInicial: Math.round(saldoInicial * 100) / 100,
    saldoFinal: Math.round(saldoFinal * 100) / 100,
    verificado: Math.abs(variacionNeta - (saldoFinal - saldoInicial)) < 0.01,
  };
}

/**
 * Calcula la utilidad neta del período desde los asientos contables.
 */
async function calcularUtilidadNeta(desde: Date, hasta: Date): Promise<number> {
  const result = await db()
    .select({
      debe: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.debe} AS NUMERIC)), 0)`,
      haber: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.haber} AS NUMERIC)), 0)`,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .innerJoin(planCuentas, eq(asientosDetalle.cuentaId, planCuentas.id))
    .where(
      and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        sql`${planCuentas.tipo} IN ('INGRESO', 'GASTO', 'COSTO')`,
      ),
    );

  const totalDebe = Number(result[0]?.debe ?? 0);
  const totalHaber = Number(result[0]?.haber ?? 0);

  // Utilidad = Ingresos (Haber) - Gastos/Costos (Debe)
  return totalHaber - totalDebe;
}

/**
 * Calcula ajustes por partidas que no afectan efectivo (depreciación, provisiones).
 */
async function calcularAjustesNoEfectivo(desde: Date, hasta: Date): Promise<CashFlowLine[]> {
  const lineas: CashFlowLine[] = [];

  // Depreciación — buscar en cuentas con código 6.2.x (Gastos de Depreciación)
  const depreciacionMovs = await db()
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.debe} AS NUMERIC) - CAST(${asientosDetalle.haber} AS NUMERIC)), 0)`,
      cuentaCodigo: planCuentas.codigo,
      cuentaNombre: planCuentas.nombre,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .innerJoin(planCuentas, eq(asientosDetalle.cuentaId, planCuentas.id))
    .where(
      and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        sql`${planCuentas.codigo} LIKE '6.2.%'`,
      ),
    );

  for (const m of depreciacionMovs) {
    const montoNeto = Number(m.total);
    if (Math.abs(montoNeto) > 0.01) {
      lineas.push({
        concepto: `Depreciación (${m.cuentaNombre})`,
        monto: Math.abs(montoNeto),
        cuentaCodigo: m.cuentaCodigo ?? undefined,
      });
    }
  }

  // Provisiones — buscar cuentas 6.3.x
  const provisionMovs = await db()
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.debe} AS NUMERIC) - CAST(${asientosDetalle.haber} AS NUMERIC)), 0)`,
      cuentaCodigo: planCuentas.codigo,
      cuentaNombre: planCuentas.nombre,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .innerJoin(planCuentas, eq(asientosDetalle.cuentaId, planCuentas.id))
    .where(
      and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        sql`${planCuentas.codigo} LIKE '6.3.%'`,
      ),
    );

  for (const m of provisionMovs) {
    const montoNeto = Number(m.total);
    if (Math.abs(montoNeto) > 0.01) {
      lineas.push({
        concepto: `Provisiones (${m.cuentaNombre})`,
        monto: Math.abs(montoNeto),
        cuentaCodigo: m.cuentaCodigo ?? undefined,
      });
    }
  }

  return lineas;
}

/**
 * Calcula cambios en capital de trabajo (CxC, CxP, Inventario).
 */
async function calcularCambiosCapitalTrabajo(desde: Date, hasta: Date): Promise<CashFlowLine[]> {
  const lineas: CashFlowLine[] = [];

  // Cambio en CxC — cuentas 1.1.02.x
  const cxcMov = await getSaldoCuentaTipo(desde, hasta, "1.1.02.%");
  if (Math.abs(cxcMov) > 0.01) {
    lineas.push({
      concepto: "Cambio en Cuentas por Cobrar",
      monto: -cxcMov, // Aumento en CxC = salida de efectivo
      cuentaCodigo: "1.1.02",
    });
  }

  // Cambio en Inventario — cuentas 1.1.03.x
  const invMov = await getSaldoCuentaTipo(desde, hasta, "1.1.03.%");
  if (Math.abs(invMov) > 0.01) {
    lineas.push({
      concepto: "Cambio en Inventarios",
      monto: -invMov,
      cuentaCodigo: "1.1.03",
    });
  }

  // Cambio en CxP — cuentas 2.1.01.x
  const cxpMov = await getSaldoCuentaTipo(desde, hasta, "2.1.01.%");
  if (Math.abs(cxpMov) > 0.01) {
    lineas.push({
      concepto: "Cambio en Cuentas por Pagar",
      monto: cxpMov, // Aumento en CxP = entrada de efectivo
      cuentaCodigo: "2.1.01",
    });
  }

  return lineas;
}

/**
 * Calcula actividades de inversión (compra/venta de activos fijos).
 */
async function calcularActividadesInversion(desde: Date, hasta: Date): Promise<CashFlowLine[]> {
  const lineas: CashFlowLine[] = [];

  // Activos Fijos — cuentas 1.2.x
  const activoFijoMov = await db()
    .select({
      debe: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.debe} AS NUMERIC)), 0)`,
      haber: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.haber} AS NUMERIC)), 0)`,
      cuentaCodigo: planCuentas.codigo,
      cuentaNombre: planCuentas.nombre,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .innerJoin(planCuentas, eq(asientosDetalle.cuentaId, planCuentas.id))
    .where(
      and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        sql`${planCuentas.codigo} LIKE '1.2.%'`,
        sql`${planCuentas.codigo} NOT LIKE '1.2.9%'`, // Excluir depreciación acumulada
      ),
    )
    .groupBy(planCuentas.codigo, planCuentas.nombre);

  for (const m of activoFijoMov) {
    const neto = Number(m.haber) - Number(m.debe); // Venta - Compra
    if (Math.abs(neto) > 0.01) {
      lineas.push({
        concepto: neto > 0
          ? `Venta de ${m.cuentaNombre}`
          : `Adquisición de ${m.cuentaNombre}`,
        monto: neto,
        cuentaCodigo: m.cuentaCodigo ?? undefined,
      });
    }
  }

  return lineas;
}

/**
 * Calcula actividades de financiamiento (préstamos, aportes, dividendos).
 */
async function calcularActividadesFinanciamiento(desde: Date, hasta: Date): Promise<CashFlowLine[]> {
  const lineas: CashFlowLine[] = [];

  // Préstamos Bancarios — cuentas 2.2.x
  const prestamosMov = await getSaldoCuentaTipo(desde, hasta, "2.2.%");
  if (Math.abs(prestamosMov) > 0.01) {
    lineas.push({
      concepto: prestamosMov > 0 ? "Obtención de Préstamos" : "Pago de Préstamos",
      monto: prestamosMov,
      cuentaCodigo: "2.2",
    });
  }

  // Aportes de Capital — cuentas 3.1.x
  const aportesMov = await getSaldoCuentaTipo(desde, hasta, "3.1.%");
  if (Math.abs(aportesMov) > 0.01) {
    lineas.push({
      concepto: "Aportes de Capital",
      monto: aportesMov,
      cuentaCodigo: "3.1",
    });
  }

  // Dividendos / Retiros — cuentas 3.5.x
  const dividendosMov = await getSaldoCuentaTipo(desde, hasta, "3.5.%");
  if (Math.abs(dividendosMov) > 0.01) {
    lineas.push({
      concepto: "Dividendos / Retiros",
      monto: -(Math.abs(dividendosMov)), // Salida de efectivo
      cuentaCodigo: "3.5",
    });
  }

  return lineas;
}

/**
 * Obtiene la variación neta (Haber - Debe) de cuentas que coinciden
 * con un patrón de código en un período.
 */
async function getSaldoCuentaTipo(
  desde: Date,
  hasta: Date,
  codigoPattern: string,
): Promise<number> {
  const result = await db()
    .select({
      debe: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.debe} AS NUMERIC)), 0)`,
      haber: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.haber} AS NUMERIC)), 0)`,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .innerJoin(planCuentas, eq(asientosDetalle.cuentaId, planCuentas.id))
    .where(
      and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        sql`${planCuentas.codigo} LIKE ${codigoPattern}`,
      ),
    );

  return Number(result[0]?.haber ?? 0) - Number(result[0]?.debe ?? 0);
}

/**
 * Calcula el saldo de efectivo (cuentas 1.1.01.x) a una fecha dada.
 */
async function calcularSaldoEfectivo(
  _tenantSlug?: string,
  fecha?: Date,
): Promise<number> {
  const conditions: any[] = [
    sql`${planCuentas.codigo} LIKE '1.1.01.%'`,
  ];

  const cuentasEfectivo = await db()
    .select({ id: planCuentas.id, codigo: planCuentas.codigo, saldoInicial: planCuentas.saldoInicial })
    .from(planCuentas)
    .where(and(...conditions));

  let totalSaldo = 0;

  for (const cta of cuentasEfectivo) {
    const saldoInicial = Number(cta.saldoInicial ?? 0);

    if (fecha) {
      const movs = await db()
        .select({
          debe: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.debe} AS NUMERIC)), 0)`,
          haber: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.haber} AS NUMERIC)), 0)`,
        })
        .from(asientosDetalle)
        .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
        .where(
          and(
            eq(asientosDetalle.cuentaId, cta.id),
            eq(asientosContables.estado, "CONTABILIZADO"),
            lte(asientosContables.fecha, fecha),
          ),
        );

      const debe = Number(movs[0]?.debe ?? 0);
      const haber = Number(movs[0]?.haber ?? 0);
      totalSaldo += saldoInicial + debe - haber;
    } else {
      totalSaldo += saldoInicial;
    }
  }

  return totalSaldo;
}
