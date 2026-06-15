/**
 * Balance General — Estado de Situación Financiera (Sprint 6).
 *
 * Genera el Balance General a una fecha dada, calculando saldos
 * de todas las cuentas contables a partir de:
 *   saldoActual = saldoInicial + Σ Debe - Σ Haber
 *
 * Para cuentas de ACTIVO y GASTO/COSTO: saldo = saldoInicial + Debe - Haber
 * Para cuentas de PASIVO, PATRIMONIO e INGRESO: saldo = saldoInicial + Haber - Debe
 *
 * @module finance/services/accounting/balance.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { planCuentas, asientosContables, asientosDetalle } from "../../schema/index.js";
import { eq, and, lte, sql } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

export interface BalanceCuenta {
  cuentaId: string;
  codigo: string;
  nombre: string;
  tipo: string;
  nivel: number;
  saldoInicial: number;
  totalDebe: number;
  totalHaber: number;
  saldoActual: number;
  cuentaPadreId: string | null;
}

export interface BalanceGrupo {
  codigo: string;
  nombre: string;
  nivel: number;
  saldo: number;
  subcuentas: BalanceCuenta[];
}

export interface BalanceSeccion {
  tipo: string;
  label: string;
  total: number;
  grupos: BalanceGrupo[];
  cuentasDirectas: BalanceCuenta[];
}

export interface BalanceGeneral {
  fecha: string;
  activo: BalanceSeccion;
  pasivo: BalanceSeccion;
  patrimonio: BalanceSeccion;
  totalActivo: number;
  totalPasivoPatrimonio: number;
  diferencia: number;
  balanceado: boolean;
}

// ─── Service ────────────────────────────────────

/**
 * Genera el Balance General a una fecha específica.
 *
 * @param fecha - Fecha del balance (YYYY-MM-DD o Date)
 * @returns BalanceGeneral con activo, pasivo, patrimonio y verificación
 */
export async function getBalanceGeneral(
  fechaInput: string | Date,
): Promise<BalanceGeneral> {
  const fecha = typeof fechaInput === "string" ? new Date(fechaInput) : fechaInput;

  if (isNaN(fecha.getTime())) {
    throw new ValidationError("Fecha inválida");
  }

  // Set to end of day
  const hasta = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59);

  // 1. Get all active accounts (non-ORDEN)
  const cuentas = await db()
    .select()
    .from(planCuentas)
    .where(
      and(
        eq(planCuentas.activo, true),
        sql`${planCuentas.tipo} != 'ORDEN'`,
      ),
    )
    .orderBy(sql`${planCuentas.codigo} ASC`);

  // 2. Get aggregated debe/haber per account from CONTABILIZADO asientos
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

  // 3. Calculate saldo for each account
  const cuentasConSaldo: BalanceCuenta[] = cuentas.map((c) => {
    const mov = movMap.get(c.id) ?? { debe: 0, haber: 0 };
    const saldoInicial = Number(c.saldoInicial ?? 0);

    const isDebitBalance =
      c.tipo === "ACTIVO" || c.tipo === "GASTO" || c.tipo === "COSTO";

    let saldoActual: number;
    if (isDebitBalance) {
      saldoActual = saldoInicial + mov.debe - mov.haber;
    } else {
      // PASIVO, PATRIMONIO, INGRESO — credit balance
      saldoActual = saldoInicial + mov.haber - mov.debe;
    }

    return {
      cuentaId: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      tipo: c.tipo,
      nivel: c.nivel,
      saldoInicial,
      totalDebe: mov.debe,
      totalHaber: mov.haber,
      saldoActual: Math.round(saldoActual * 100) / 100,
      cuentaPadreId: c.cuentaPadreId,
    };
  });

  // 4. Build hierarchy by section
  const activo = buildSeccion(cuentasConSaldo, "ACTIVO", "Activo");
  const pasivo = buildSeccion(cuentasConSaldo, "PASIVO", "Pasivo");
  const patrimonio = buildSeccion(cuentasConSaldo, "PATRIMONIO", "Patrimonio");

  const totalActivo = Math.round(activo.total * 100) / 100;
  const totalPasivoPatrimonio = Math.round((pasivo.total + patrimonio.total) * 100) / 100;
  const diferencia = Math.round((totalActivo - totalPasivoPatrimonio) * 100) / 100;

  return {
    fecha: hasta.toISOString(),
    activo,
    pasivo,
    patrimonio,
    totalActivo,
    totalPasivoPatrimonio,
    diferencia,
    balanceado: Math.abs(diferencia) < 0.01,
  };
}

// ─── Helpers ────────────────────────────────────

function buildSeccion(
  cuentas: BalanceCuenta[],
  tipo: string,
  label: string,
): BalanceSeccion {
  const filtradas = cuentas.filter((c) => c.tipo === tipo);

  // Level 1 = grupos (Activo Corriente, No Corriente)
  // Level 4+ = cuentas contables con saldo
  const grupos: BalanceGrupo[] = [];
  const cuentasDirectas: BalanceCuenta[] = [];

  for (const c of filtradas) {
    if (c.nivel <= 3) {
      // Es grupo o subgrupo — sumar saldo de sus hijas
      const hijas = filtradas.filter(
        (h) => h.cuentaPadreId === c.cuentaId,
      );
      const saldoGrupo = hijas.reduce((s, h) => s + h.saldoActual, 0);
      grupos.push({
        codigo: c.codigo,
        nombre: c.nombre,
        nivel: c.nivel,
        saldo: Math.round(saldoGrupo * 100) / 100,
        subcuentas: hijas,
      });
    } else {
      cuentasDirectas.push(c);
    }
  }

  // Total = sum of all accounts in section (incl. header accounts with saldoInicial)
  const totalSuma = filtradas.reduce((s, c) => s + c.saldoActual, 0);
  const total = Math.round(totalSuma * 100) / 100;

  return { tipo, label, total, grupos, cuentasDirectas };
}
