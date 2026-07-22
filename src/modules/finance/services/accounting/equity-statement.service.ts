/**
 * Equity Statement — Estado de Evolución del Patrimonio Neto.
 *
 * Muestra los cambios en cada cuenta patrimonial durante un período:
 *   Capital Social
 *   + Ajustes de Capital
 *   + Reservas (Legal, Facultativa)
 *   + Resultados Acumulados
 *   +/- Resultado del Ejercicio (Utilidad/Pérdida)
 *   - Dividendos / Retiros
 *   = Patrimonio Neto al Cierre
 *
 * @module finance/services/accounting/equity-statement.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { planCuentas, asientosContables, asientosDetalle } from "../../schema/index.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

export interface EquityLine {
  concepto: string;
  cuentaCodigo: string;
  saldoInicial: number;
  movimientos: {
    /** Movimientos que incrementan la cuenta */
    incrementos: number;
    /** Movimientos que decrementan la cuenta */
    decrementos: number;
  };
  /** Cambio neto del período */
  cambioNeto: number;
  saldoFinal: number;
}

export interface EquityAccountGroup {
  tipoLabel: string;
  lineas: EquityLine[];
  totalInicial: number;
  totalFinal: number;
}

export interface EquityStatement {
  periodo: { anho: number; mes: number };
  tipo: "MENSUAL" | "ACUMULADO";
  /** Grupos de cuentas patrimoniales */
  capital: EquityAccountGroup;
  reservas: EquityAccountGroup;
  resultados: EquityAccountGroup;
  /** Totales consolidados */
  totalPatrimonioInicial: number;
  totalPatrimonioFinal: number;
  variacionPeriodo: number;
  /** Utilidad/Pérdida del período (desde P&L) */
  resultadoEjercicio: number;
}

// ─── Service ────────────────────────────────────

/**
 * Genera el Estado de Evolución del Patrimonio Neto.
 *
 * @param anho - Año fiscal
 * @param mes - Mes (1-12)
 * @param acumulado - Si true, calcula desde inicio del año
 * @returns Estado de Evolución del Patrimonio
 */
export async function getEquityStatement(
  anho: number,
  mes: number,
  acumulado = false,
): Promise<EquityStatement> {
  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const desde = acumulado
    ? new Date(anho, 0, 1)
    : new Date(anho, mes - 1, 1);

  const hasta = new Date(anho, mes, 0, 23, 59, 59);
  const inicioPeriodo = new Date(anho, 0, 1); // Inicio del ejercicio

  // ── 1. Obtener todas las cuentas patrimoniales activas ──
  const cuentasPatrimonio = await db()
    .select({
      id: planCuentas.id,
      codigo: planCuentas.codigo,
      nombre: planCuentas.nombre,
      tipo: planCuentas.tipo,
      nivel: planCuentas.nivel,
      saldoInicial: planCuentas.saldoInicial,
      cuentaPadreId: planCuentas.cuentaPadreId,
    })
    .from(planCuentas)
    .where(
      and(
        eq(planCuentas.activo, true),
        eq(planCuentas.tipo, "PATRIMONIO"),
      ),
    )
    .orderBy(sql`${planCuentas.codigo} ASC`);

  if (cuentasPatrimonio.length === 0) {
    throw new ValidationError(
      "No hay cuentas patrimoniales configuradas en el Plan de Cuentas",
    );
  }

  // ── 2. Calcular saldos pre-período (para saldoInicial real) ──
  const cuentasConSaldo = await Promise.all(
    cuentasPatrimonio.map(async (cta) => {
      const saldoInicialPlan = Number(cta.saldoInicial ?? 0);

      // Movimientos antes del período actual
      const movsAntes = await db()
        .select({
          debe: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.debe} AS NUMERIC)), 0)`,
          haber: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.haber} AS NUMERIC)), 0)`,
        })
        .from(asientosDetalle)
        .innerJoin(
          asientosContables,
          eq(asientosDetalle.asientoId, asientosContables.id),
        )
        .where(
          and(
            eq(asientosDetalle.cuentaId, cta.id),
            eq(asientosContables.estado, "CONTABILIZADO"),
            lte(asientosContables.fecha, inicioPeriodo),
          ),
        );

      // Movimientos del período actual
      const movsPeriodo = await db()
        .select({
          debe: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.debe} AS NUMERIC)), 0)`,
          haber: sql<number>`COALESCE(SUM(CAST(${asientosDetalle.haber} AS NUMERIC)), 0)`,
        })
        .from(asientosDetalle)
        .innerJoin(
          asientosContables,
          eq(asientosDetalle.asientoId, asientosContables.id),
        )
        .where(
          and(
            eq(asientosDetalle.cuentaId, cta.id),
            eq(asientosContables.estado, "CONTABILIZADO"),
            gte(asientosContables.fecha, desde),
            lte(asientosContables.fecha, hasta),
          ),
        );

      const debeAntes = Number(movsAntes[0]?.debe ?? 0);
      const haberAntes = Number(movsAntes[0]?.haber ?? 0);
      const debePeriodo = Number(movsPeriodo[0]?.debe ?? 0);
      const haberPeriodo = Number(movsPeriodo[0]?.haber ?? 0);

      // Para cuentas de PATRIMONIO: saldo acreedor
      const saldoInicialReal = saldoInicialPlan + haberAntes - debeAntes;
      const incrementos = haberPeriodo;
      const decrementos = debePeriodo;
      const cambioNeto = incrementos - decrementos;
      const saldoFinal = saldoInicialReal + cambioNeto;

      return {
        id: cta.id,
        codigo: cta.codigo,
        nombre: cta.nombre,
        nivel: cta.nivel,
        saldoInicialReal,
        incrementos,
        decrementos,
        cambioNeto,
        saldoFinal,
        cuentaPadreId: cta.cuentaPadreId,
      };
    }),
  );

  // ── 3. Clasificar por subgrupo patrimonial ──
  // Capital: 3.1.x, Reservas: 3.2.x - 3.3.x, Resultados: 3.4.x - 3.5.x
  const capitalLines = cuentasConSaldo.filter(
    (c) => c.codigo.startsWith("3.1"),
  );
  const reservasLines = cuentasConSaldo.filter(
    (c) => c.codigo.startsWith("3.2") || c.codigo.startsWith("3.3"),
  );
  const resultadosLines = cuentasConSaldo.filter(
    (c) => c.codigo.startsWith("3.4") || c.codigo.startsWith("3.5"),
  );

  // ── 4. Calcular resultado del ejercicio ──
  const resultadoEjercicio = await calcularResultadoEjercicio(desde, hasta);

  // ── 5. Construir grupos ──
  const buildGroup = (lines: typeof capitalLines, label: string): EquityAccountGroup => {
    const equityLines: EquityLine[] = lines.map((l) => ({
      concepto: l.nombre,
      cuentaCodigo: l.codigo,
      saldoInicial: Math.round(l.saldoInicialReal * 100) / 100,
      movimientos: {
        incrementos: Math.round(l.incrementos * 100) / 100,
        decrementos: Math.round(l.decrementos * 100) / 100,
      },
      cambioNeto: Math.round(l.cambioNeto * 100) / 100,
      saldoFinal: Math.round(l.saldoFinal * 100) / 100,
    }));

    const totalInicial = Math.round(
      lines.reduce((s, l) => s + l.saldoInicialReal, 0) * 100,
    ) / 100;

    const totalFinal = Math.round(
      lines.reduce((s, l) => s + l.saldoFinal, 0) * 100,
    ) / 100;

    return { tipoLabel: label, lineas: equityLines, totalInicial, totalFinal };
  };

  const capital = buildGroup(capitalLines, "Capital Social");
  const reservas = buildGroup(reservasLines, "Reservas");
  const resultados = buildGroup(resultadosLines, "Resultados");

  // ── 6. Totales consolidados ──
  const totalPatrimonioInicial =
    capital.totalInicial + reservas.totalInicial + resultados.totalInicial;
  const totalPatrimonioFinal =
    capital.totalFinal + reservas.totalFinal + resultados.totalFinal + resultadoEjercicio;

  return {
    periodo: { anho, mes },
    tipo: acumulado ? "ACUMULADO" : "MENSUAL",
    capital,
    reservas,
    resultados,
    totalPatrimonioInicial: Math.round(totalPatrimonioInicial * 100) / 100,
    totalPatrimonioFinal: Math.round(totalPatrimonioFinal * 100) / 100,
    variacionPeriodo:
      Math.round((totalPatrimonioFinal - totalPatrimonioInicial) * 100) / 100,
    resultadoEjercicio: Math.round(resultadoEjercicio * 100) / 100,
  };
}

/**
 * Calcula el resultado del ejercicio (utilidad o pérdida neta).
 */
async function calcularResultadoEjercicio(
  desde: Date,
  hasta: Date,
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
        sql`${planCuentas.tipo} IN ('INGRESO', 'GASTO', 'COSTO')`,
      ),
    );

  const totalDebe = Number(result[0]?.debe ?? 0);
  const totalHaber = Number(result[0]?.haber ?? 0);

  return totalHaber - totalDebe; // Utilidad positiva si ingresos > gastos+costos
}
