/**
 * Estado de Resultados — P&L (Sprint 6).
 *
 * Genera el Estado de Resultados (Pérdidas y Ganancias) para un período,
 * calculando Ingresos, Costos y Gastos desde los asientos contables.
 *
 * Estructura:
 *   Ingresos (cuentas tipo INGRESO)
 *   - Costos (cuentas tipo COSTO)
 *   = Utilidad Bruta
 *   - Gastos (cuentas tipo GASTO)
 *   = Utilidad Neta
 *
 * @module finance/services/accounting/pnl.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { planCuentas, asientosContables, asientosDetalle } from "../../schema/index.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

export interface PnLCuenta {
  cuentaId: string;
  codigo: string;
  nombre: string;
  tipo: string;
  nivel: number;
  totalDebe: number;
  totalHaber: number;
  saldo: number; // para INGRESO: Haber - Debe. Para COSTO/GASTO: Debe - Haber
}

export interface PnLGrupo {
  codigo: string;
  nombre: string;
  saldo: number;
  cuentas: PnLCuenta[];
}

export interface PnLResultado {
  periodo: { anho: number; mes: number };
  tipo: "MENSUAL" | "ACUMULADO";
  ingresos: {
    total: number;
    grupos: PnLGrupo[];
    cuentas: PnLCuenta[];
  };
  costos: {
    total: number;
    grupos: PnLGrupo[];
    cuentas: PnLCuenta[];
  };
  gastos: {
    total: number;
    grupos: PnLGrupo[];
    cuentas: PnLCuenta[];
  };
  utilidadBruta: number;
  utilidadNeta: number;
}

// ─── Service ────────────────────────────────────

/**
 * Genera el Estado de Resultados para un período.
 *
 * @param anho - Año fiscal
 * @param mes - Mes (1-12)
 * @param acumulado - Si true, calcula desde inicio del año hasta el mes
 */
export async function getEstadoResultados(
  anho: number,
  mes: number,
  acumulado = false,
): Promise<PnLResultado> {
  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const desde = acumulado
    ? new Date(anho, 0, 1) // 1 de enero
    : new Date(anho, mes - 1, 1);

  const hasta = new Date(anho, mes, 0, 23, 59, 59);

  // 1. Get all result accounts (INGRESO, COSTO, GASTO)
  const cuentas = await db()
    .select()
    .from(planCuentas)
    .where(
      and(
        eq(planCuentas.activo, true),
        sql`${planCuentas.tipo} IN ('INGRESO', 'COSTO', 'GASTO')`,
      ),
    )
    .orderBy(sql`${planCuentas.codigo} ASC`);

  // 2. Get aggregated movements in the period
  const movimientos = await db()
    .select({
      cuentaId: asientosDetalle.cuentaId,
      totalDebe: sql<number>`COALESCE(SUM(COALESCE(${asientosDetalle.debe}::numeric, 0)), 0)`,
      totalHaber: sql<number>`COALESCE(SUM(COALESCE(${asientosDetalle.haber}::numeric, 0)), 0)`,
    })
    .from(asientosDetalle)
    .innerJoin(
      asientosContables,
      eq(asientosDetalle.asientoId, asientosContables.id),
    )
    .where(
      and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
      ),
    )
    .groupBy(asientosDetalle.cuentaId);

  const movMap = new Map(
    movimientos.map((m) => [
      m.cuentaId,
      { debe: Number(m.totalDebe), haber: Number(m.totalHaber) },
    ]),
  );

  // 3. Calculate saldo per account
  const ingresos: PnLCuenta[] = [];
  const costos: PnLCuenta[] = [];
  const gastos: PnLCuenta[] = [];

  for (const c of cuentas) {
    const mov = movMap.get(c.id) ?? { debe: 0, haber: 0 };
    const saldo =
      c.tipo === "INGRESO"
        ? mov.haber - mov.debe // Ingreso: saldo acreedor
        : mov.debe - mov.haber; // Costo/Gasto: saldo deudor

    const cuenta: PnLCuenta = {
      cuentaId: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      tipo: c.tipo,
      nivel: c.nivel,
      totalDebe: Math.round(mov.debe * 100) / 100,
      totalHaber: Math.round(mov.haber * 100) / 100,
      saldo: Math.round(saldo * 100) / 100,
    };

    if (c.tipo === "INGRESO") ingresos.push(cuenta);
    else if (c.tipo === "COSTO") costos.push(cuenta);
    else if (c.tipo === "GASTO") gastos.push(cuenta);
  }

  // 4. Build groups by level (similar to balance)
  const ingresosGrouped = groupByLevel(ingresos);
  const costosGrouped = groupByLevel(costos);
  const gastosGrouped = groupByLevel(gastos);

  const totalIngresos = Math.round(ingresos.reduce((s, c) => s + c.saldo, 0) * 100) / 100;
  const totalCostos = Math.round(costos.reduce((s, c) => s + c.saldo, 0) * 100) / 100;
  const totalGastos = Math.round(gastos.reduce((s, c) => s + c.saldo, 0) * 100) / 100;

  const utilidadBruta = Math.round((totalIngresos - totalCostos) * 100) / 100;
  const utilidadNeta = Math.round((utilidadBruta - totalGastos) * 100) / 100;

  return {
    periodo: { anho, mes },
    tipo: acumulado ? "ACUMULADO" : "MENSUAL",
    ingresos: {
      total: totalIngresos,
      grupos: ingresosGrouped.grupos,
      cuentas: ingresosGrouped.directas,
    },
    costos: {
      total: totalCostos,
      grupos: costosGrouped.grupos,
      cuentas: costosGrouped.directas,
    },
    gastos: {
      total: totalGastos,
      grupos: gastosGrouped.grupos,
      cuentas: gastosGrouped.directas,
    },
    utilidadBruta,
    utilidadNeta,
  };
}

interface GroupedResult {
  grupos: PnLGrupo[];
  directas: PnLCuenta[];
}

function groupByLevel(cuentas: PnLCuenta[]): GroupedResult {
  const grupos: PnLGrupo[] = [];
  const directas: PnLCuenta[] = [];

  for (const c of cuentas) {
    if (c.nivel <= 2) {
      // Grupo o subgrupo
      const hijas = cuentas.filter(
        (h) => h.nivel > c.nivel && h.codigo.startsWith(c.codigo),
      );
      const saldo = hijas.reduce((s, h) => s + h.saldo, 0);
      grupos.push({
        codigo: c.codigo,
        nombre: c.nombre,
        saldo: Math.round(saldo * 100) / 100,
        cuentas: hijas,
      });
    } else {
      directas.push(c);
    }
  }

  return { grupos, directas };
}
