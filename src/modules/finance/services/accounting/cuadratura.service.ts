/**
 * Daily Cuadratura Service — CAPA 4 Compliance.
 *
 * Validación automática de la ecuación contable:
 *   Σ Debe = Σ Haber
 *
 * Verifica que todos los asientos CONTABILIZADOS en un período
 * tengan sus débitos y créditos balanceados, y reporta cualquier
 * discrepancia.
 *
 * @module finance/services/accounting/cuadratura.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import {
  asientosContables,
  asientosDetalle,
} from "../../schema/index.js";
import { eq, and, gte, lte, sql, asc } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

export interface AsientoBalance {
  asientoId: string;
  numero: number;
  fecha: string;
  concepto: string;
  totalDebe: number;
  totalHaber: number;
  diferencia: number; // debe - haber
  balanceado: boolean;
}

export interface CuadraturaReport {
  periodo: { anho: number; mes: number };
  totalAsientos: number;
  asientosBalanceados: number;
  asientosDesbalanceados: number;
  sumaDebe: string;
  sumaHaber: string;
  diferenciaGlobal: string;
  balanceado: boolean;
  detalles: AsientoBalance[];
}

// ─── Service ────────────────────────────────────

/**
 * Ejecuta la cuadratura diaria para un período.
 *
 * Verifica que Σ Debe = Σ Haber para todos los asientos
 * CONTABILIZADOS en el rango de fechas.
 *
 * @param anho - Año fiscal
 * @param mes  - Mes (1-12)
 * @param soloDesbalanceados - Si true, solo retorna asientos con diferencias
 */
export async function ejecutarCuadratura(
  anho: number,
  mes: number,
  soloDesbalanceados = false,
): Promise<CuadraturaReport> {
  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const desde = new Date(anho, mes - 1, 1);
  const hasta = new Date(anho, mes, 0, 23, 59, 59);

  // Obtener todos los asientos del período
  const asientos = await db()
    .select({
      id: asientosContables.id,
      numero: asientosContables.numero,
      fecha: asientosContables.fecha,
      concepto: asientosContables.concepto,
      totalDebe: asientosContables.totalDebe,
      totalHaber: asientosContables.totalHaber,
      diferencia: asientosContables.diferencia,
    })
    .from(asientosContables)
    .where(
      and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
      ),
    )
    .orderBy(asc(asientosContables.numero));

  if (asientos.length === 0) {
    return {
      periodo: { anho, mes },
      totalAsientos: 0,
      asientosBalanceados: 0,
      asientosDesbalanceados: 0,
      sumaDebe: "0.00",
      sumaHaber: "0.00",
      diferenciaGlobal: "0.00",
      balanceado: true,
      detalles: [],
    };
  }

  // Para cada asiento, calcular debe/haber real desde el detalle
  const asientoIds = asientos.map((a) => a.id);
  const sums = await db()
    .select({
      asientoId: asientosDetalle.asientoId,
      debe: sql<number>`COALESCE(SUM(COALESCE(${asientosDetalle.debe}::numeric, 0)), 0)`,
      haber: sql<number>`COALESCE(SUM(COALESCE(${asientosDetalle.haber}::numeric, 0)), 0)`,
    })
    .from(asientosDetalle)
    .where(
      asientoIds.length > 0
        ? and(...asientoIds.map((id) => eq(asientosDetalle.asientoId, id)))
        : undefined,
    )
    .groupBy(asientosDetalle.asientoId);

  const sumMap = new Map(sums.map((s) => [s.asientoId, { debe: Number(s.debe), haber: Number(s.haber) }]));

  let sumaGlobalDebe = 0;
  let sumaGlobalHaber = 0;
  let balanceados = 0;
  let desbalanceados = 0;

  const detalles: AsientoBalance[] = [];

  for (const asiento of asientos) {
    const sumDetalle = sumMap.get(asiento.id);
    const debe = sumDetalle?.debe ?? Number(asiento.totalDebe ?? 0);
    const haber = sumDetalle?.haber ?? Number(asiento.totalHaber ?? 0);
    const diff = Math.round((debe - haber) * 100) / 100;
    const balanceado = Math.abs(diff) < 0.01;

    sumaGlobalDebe += debe;
    sumaGlobalHaber += haber;

    if (balanceado) balanceados++;
    else desbalanceados++;

    if (!soloDesbalanceados || !balanceado) {
      detalles.push({
        asientoId: asiento.id,
        numero: asiento.numero,
        fecha: asiento.fecha.toISOString(),
        concepto: asiento.concepto,
        totalDebe: debe,
        totalHaber: haber,
        diferencia: diff,
        balanceado,
      });
    }
  }

  const diferenciaGlobal = Math.round((sumaGlobalDebe - sumaGlobalHaber) * 100) / 100;

  return {
    periodo: { anho, mes },
    totalAsientos: asientos.length,
    asientosBalanceados: balanceados,
    asientosDesbalanceados: desbalanceados,
    sumaDebe: sumaGlobalDebe.toFixed(2),
    sumaHaber: sumaGlobalHaber.toFixed(2),
    diferenciaGlobal: diferenciaGlobal.toFixed(2),
    balanceado: Math.abs(diferenciaGlobal) < 0.01,
    detalles,
  };
}

/**
 * Versión simplificada que solo dice si el período está balanceado.
 * Útil para checks rápidos antes de cerrar un período.
 */
export async function isPeriodoBalanceado(
  anho: number,
  mes: number,
): Promise<boolean> {
  const report = await ejecutarCuadratura(anho, mes, true);
  return report.balanceado && report.asientosDesbalanceados === 0;
}
