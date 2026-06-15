/**
 * Libro Mayor Service — General Ledger Report.
 *
 * Generates the Libro Mayor (General Ledger Book), a mandatory
 * accounting book per Ley 1034/83 and RG 90/2003 (Marangatú).
 *
 * For each account, shows:
 *   - Saldo anterior (al inicio del período)
 *   - Movimientos del período (Debe + Haber detallados)
 *   - Saldo de cierre
 *
 * Output formats: JSON, CSV, TXT
 *
 * @module finance/services/accounting/libro-mayor.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import {
  asientosContables,
  asientosDetalle,
  planCuentas,
} from "../../schema/index.js";
import { eq, and, gte, lte, asc, sql } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

export interface MayorEntry {
  fecha: string;
  numeroAsiento: number;
  concepto: string;
  debe: string;
  haber: string;
  saldo: string; // running balance
}

export interface MayorCuenta {
  codigo: string;
  nombre: string;
  tipo: string;
  saldoAnterior: string;
  totalDebe: string;
  totalHaber: string;
  saldoCierre: string;
  entries: MayorEntry[];
}

export interface LibroMayorReport {
  periodo: { anho: number; mes: number };
  totalCuentas: number;
  totalDebePeriodo: string;
  totalHaberPeriodo: string;
  cuentas: MayorCuenta[];
}

// ─── Service ────────────────────────────────────

/**
 * Genera el Libro Mayor para un período mensual.
 *
 * Para cada cuenta con movimientos en el período, calcula el saldo
 * anterior acumulado, lista los movimientos del mes y el saldo de cierre.
 *
 * @param anho - Año fiscal (2020-2100)
 * @param mes  - Mes (1-12)
 * @param opts.codigoDesde - Filtro inicio rango de códigos (opcional)
 * @param opts.codigoHasta - Filtro fin rango de códigos (opcional)
 * @throws {ValidationError} Si el período es inválido
 */
export async function generarLibroMayor(
  anho: number,
  mes: number,
  opts?: { codigoDesde?: string; codigoHasta?: string },
): Promise<LibroMayorReport> {
  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const inicioPeriodo = new Date(anho, mes - 1, 1);
  const finPeriodo = new Date(anho, mes, 0, 23, 59, 59);
  const inicioEjercicio = new Date(anho, 0, 1);

  // Construir filtro de cuentas
  const cuentaFilters: ReturnType<typeof eq>[] = [eq(planCuentas.activo, true)];
  if (opts?.codigoDesde) {
    cuentaFilters.push(sql`${planCuentas.codigo} >= ${opts.codigoDesde}`);
  }
  if (opts?.codigoHasta) {
    cuentaFilters.push(sql`${planCuentas.codigo} <= ${opts.codigoHasta}`);
  }

  // Obtener cuentas que aceptan movimientos (nivel detalle)
  const cuentas = await db()
    .select({ id: planCuentas.id, codigo: planCuentas.codigo, nombre: planCuentas.nombre, tipo: planCuentas.tipo })
    .from(planCuentas)
    .where(and(...cuentaFilters, eq(planCuentas.aceptaMovimientos, true)))
    .orderBy(asc(planCuentas.codigo));

  if (cuentas.length === 0) {
    return {
      periodo: { anho, mes },
      totalCuentas: 0,
      totalDebePeriodo: "0.00",
      totalHaberPeriodo: "0.00",
      cuentas: [],
    };
  }

  let globalDebe = 0;
  let globalHaber = 0;
  const cuentasResult: MayorCuenta[] = [];

  // Procesar cada cuenta
  for (const cta of cuentas) {
    // 1. Saldo anterior: acumulado desde inicio del ejercicio hasta el día antes del período
    const [anteriorRes] = await db()
      .select({
        debe: sql<number>`COALESCE(SUM(COALESCE(${asientosDetalle.debe}::numeric, 0)), 0)`,
        haber: sql<number>`COALESCE(SUM(COALESCE(${asientosDetalle.haber}::numeric, 0)), 0)`,
      })
      .from(asientosDetalle)
      .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
      .where(
        and(
          eq(asientosDetalle.cuentaId, cta.id),
          eq(asientosContables.estado, "CONTABILIZADO"),
          gte(asientosContables.fecha, inicioEjercicio),
          lte(asientosContables.fecha, new Date(anho, mes - 1, 0, 23, 59, 59)), // último día del mes anterior
        ),
      );

    const saldoAntDebe = Number(anteriorRes?.debe ?? 0);
    const saldoAntHaber = Number(anteriorRes?.haber ?? 0);
    const saldoAnterior = calcularSaldo(cta.tipo, saldoAntDebe, saldoAntHaber);

    // 2. Movimientos del período
    const movimientos = await db()
      .select({
        fecha: asientosContables.fecha,
        numero: asientosContables.numero,
        concepto: asientosContables.concepto,
        debe: asientosDetalle.debe,
        haber: asientosDetalle.haber,
        descripcion: asientosDetalle.descripcion,
      })
      .from(asientosDetalle)
      .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
      .where(
        and(
          eq(asientosDetalle.cuentaId, cta.id),
          eq(asientosContables.estado, "CONTABILIZADO"),
          gte(asientosContables.fecha, inicioPeriodo),
          lte(asientosContables.fecha, finPeriodo),
        ),
      )
      .orderBy(asc(asientosContables.fecha), asc(asientosContables.numero));

    let totalDebeCta = 0;
    let totalHaberCta = 0;
    let saldoCorriente = saldoAnterior;
    const mayorEntries: MayorEntry[] = [];

    for (const mov of movimientos) {
      const d = Number(mov.debe ?? 0);
      const h = Number(mov.haber ?? 0);
      totalDebeCta += d;
      totalHaberCta += h;

      // Calcular saldo corriente según naturaleza de la cuenta
      if (cta.tipo === "ACTIVO" || cta.tipo === "COSTO" || cta.tipo === "GASTO") {
        saldoCorriente += d - h; // Débito aumenta saldo
      } else {
        saldoCorriente += h - d; // Crédito aumenta saldo
      }

      mayorEntries.push({
        fecha: mov.fecha.toISOString(),
        numeroAsiento: mov.numero,
        concepto: mov.descripcion ?? mov.concepto,
        debe: d.toFixed(2),
        haber: h.toFixed(2),
        saldo: saldoCorriente.toFixed(2),
      });
    }

    // Si no hay movimientos, la cuenta no se incluye en el reporte
    if (movimientos.length === 0) continue;

    globalDebe += totalDebeCta;
    globalHaber += totalHaberCta;

    cuentasResult.push({
      codigo: cta.codigo,
      nombre: cta.nombre,
      tipo: cta.tipo,
      saldoAnterior: saldoAnterior.toFixed(2),
      totalDebe: totalDebeCta.toFixed(2),
      totalHaber: totalHaberCta.toFixed(2),
      saldoCierre: saldoCorriente.toFixed(2),
      entries: mayorEntries,
    });
  }

  return {
    periodo: { anho, mes },
    totalCuentas: cuentasResult.length,
    totalDebePeriodo: globalDebe.toFixed(2),
    totalHaberPeriodo: globalHaber.toFixed(2),
    cuentas: cuentasResult,
  };
}

/** Calcula el saldo de una cuenta según su tipo (naturaleza). */
function calcularSaldo(
  tipo: string,
  totalDebe: number,
  totalHaber: number,
): number {
  // ACTIVO, COSTO, GASTO → saldo deudor (Debe - Haber)
  // PASIVO, PATRIMONIO, INGRESO → saldo acreedor (Haber - Debe)
  if (tipo === "ACTIVO" || tipo === "COSTO" || tipo === "GASTO") {
    return totalDebe - totalHaber;
  }
  return totalHaber - totalDebe;
}
