/**
 * Accrual Service — Devengamiento Contable.
 *
 * Implementa el principio de devengado (devengamiento) para el
 * reconocimiento de ingresos y gastos en el período que corresponden,
 * independientemente de su cobro o pago.
 *
 * Ley 1034/83 — Principio de Devengado:
 *   Los efectos de las transacciones y demás eventos se reconocen
 *   cuando ocurren (y no cuando se cobra o paga el efectivo).
 *
 * @module finance/services/accounting/accrual.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { getDb } from "../../../../shared/database/connection.js";
import {
  planCuentas,
  asientosContables,
  asientosDetalle,
} from "../../schema/index.js";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import type { CreateAsientoRequest, AsientoLineaRequest } from "../../types.js";

// ─── Interfaces ────────────────────────────────

export interface AccrualResult {
  success: boolean;
  asientoId: string | null;
  asientoNumero: number | null;
  totalDebe: string;
  totalHaber: string;
  conceptos: string[];
}

// ─── Helpers ───────────────────────────────────

/**
 * Resuelve el ID de una cuenta por código.
 * Lanza error si no existe.
 */
async function resolveCuenta(codigo: string): Promise<string> {
  const [c] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(and(eq(planCuentas.codigo, codigo), eq(planCuentas.activo, true)))
    .limit(1);
  if (!c) throw new Error(`Cuenta contable ${codigo} no encontrada. Verifique el Plan de Cuentas.`);
  return c.id;
}

/**
 * Obtiene el próximo número de asiento para el período.
 */
async function nextNumero(fecha: Date): Promise<number> {
  const start = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  const end = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59);
  const [max] = await db()
    .select({ max: sql<number>`COALESCE(MAX(numero), 0)` })
    .from(asientosContables)
    .where(and(gte(asientosContables.fecha, start), lte(asientosContables.fecha, end)));
  return (max?.max ?? 0) + 1;
}

// ─── Devengamiento de Ingresos ─────────────────

/**
 * Genera asiento de devengamiento de ingresos.
 *
 * Reconoce ingresos por órdenes de trabajo en estado "En_Proceso" o
 * "Control_Calidad" que aún no han sido facturadas.
 *
 * Débito: Cuentas por Cobrar (1.1.02.x)
 * Crédito: Ingresos Devengados (4.1.x o cuenta de pasivo diferido)
 */
export async function generarDevengamientoIngresos(
  _tenantSlug: string,
  anho: number,
  mes: number,
): Promise<AccrualResult> {
  const periodo = `${anho}-${String(mes).padStart(2, "0")}`;
  const conceptos: string[] = [];
  let totalMonto = 0;

  // Obtener OT en proceso no facturadas con costo estimado
  // Buscamos work_orders con estado = 'in_progress' que tengan total_cost > 0
  const ordenes = await getDb()<Array<{ id: string; description: string; total_cost: string }>>`
    SELECT id, description, total_cost
    FROM work_orders
    WHERE status = 'in_progress'
      AND total_cost > 0
      AND total_cost IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM asientos_contables ac
        WHERE ac.modulo_origen = 'DEVENGAMIENTO_INGRESOS'
          AND ac.orden_trabajo_id = work_orders.id
          AND EXTRACT(YEAR FROM ac.fecha) = ${anho}
          AND EXTRACT(MONTH FROM ac.fecha) = ${mes}
      )
  `;

  if (ordenes.length === 0) {
    return { success: true, asientoId: null, asientoNumero: null, totalDebe: "0", totalHaber: "0", conceptos: [] };
  }

  // Resolver IDs de cuentas
  const cuentaCobrar = await resolveCuenta("1.1.02");       // Cuentas por Cobrar
  const cuentaIngreso = await resolveCuenta("4.1.99");       // Ingresos Devengados (auxiliar)

  // Construir líneas
  const lineas: AsientoLineaRequest[] = [];
  for (const ot of ordenes) {
    const total = parseFloat(ot.total_cost ?? "0");
    if (total <= 0) continue;
    const desc = ot.description ?? `OT ${ot.id.slice(0, 8)}`;
    lineas.push({ cuentaId: cuentaCobrar, debe: total.toFixed(2), descripcion: `Dev. Ingreso: ${desc}`, ordenTrabajoId: ot.id });
    lineas.push({ cuentaId: cuentaIngreso, haber: total.toFixed(2), descripcion: `Dev. Ingreso: ${desc}`, ordenTrabajoId: ot.id });
    totalMonto += total;
    conceptos.push(`${desc}: ₲${total.toFixed(2)}`);
  }

  if (lineas.length === 0) {
    return { success: true, asientoId: null, asientoNumero: null, totalDebe: "0", totalHaber: "0", conceptos };
  }

  const fecha = new Date(anho, mes - 1, 1);
  const request: CreateAsientoRequest = {
    fecha: fecha.toISOString(),
    concepto: `Devengamiento de Ingresos - ${periodo} (${ordenes.length} OT en proceso)`,
    moduloOrigen: "DEVENGAMIENTO_INGRESOS",
    lineas,
  };

  return createAsiento(request, conceptos);
}

// ─── Devengamiento de Gastos ───────────────────

/**
 * Genera asiento de gastos devengados.
 *
 * Reconoce gastos incurridos en el período que aún no han sido
 * registrados (facturas pendientes, servicios no facturados).
 *
 * Débito: Gasto correspondiente (6.x.x)
 * Crédito: Cuentas por Pagar (2.1.x) / Gastos Acumulados (2.3.x)
 *
 * @param gastos Array de gastos devengados manuales
 */
export async function generarDevengamientoGastos(
  gastos: Array<{
    concepto: string;
    monto: number;
    cuentaGastoId: string;
    cuentaPagarId?: string;
    ordenTrabajoId?: string;
  }>,
): Promise<AccrualResult> {
  if (gastos.length === 0) {
    return { success: true, asientoId: null, asientoNumero: null, totalDebe: "0", totalHaber: "0", conceptos: [] };
  }

  const conceptos: string[] = [];
  let totalMonto = 0;
  const lineas: AsientoLineaRequest[] = [];

  for (const g of gastos) {
    if (g.monto <= 0) continue;
    const pagarId = g.cuentaPagarId ?? await resolveCuenta("2.3.01"); // Gastos Acumulados

    lineas.push({
      cuentaId: g.cuentaGastoId,
      debe: g.monto.toFixed(2),
      descripcion: `Gasto devengado: ${g.concepto}`,
      ordenTrabajoId: g.ordenTrabajoId,
    });
    lineas.push({
      cuentaId: pagarId,
      haber: g.monto.toFixed(2),
      descripcion: `Gasto devengado: ${g.concepto}`,
    });
    totalMonto += g.monto;
    conceptos.push(`${g.concepto}: ₲${g.monto.toFixed(2)}`);
  }

  const fecha = new Date();
  const request: CreateAsientoRequest = {
    fecha: fecha.toISOString(),
    concepto: `Devengamiento de Gastos - ${fecha.toISOString().slice(0, 7)} (${gastos.length} conceptos)`,
    moduloOrigen: "DEVENGAMIENTO_GASTOS",
    lineas,
  };

  return createAsiento(request, conceptos);
}

// ─── Ajustes de Período ────────────────────────

/**
 * Genera asientos de ajuste de fin de período.
 *
 * Incluye:
 *   - Prorrateo de gastos pagados por adelantado (seguros, alquileres)
 *   - Reconocimiento de ingresos diferidos
 *   - Ajuste por inflación / diferencia de cotización (si aplica)
 *
 * @param ajustes Lista de ajustes manuales.
 */
export async function generarAjustesPeriodo(
  ajustes: Array<{
    concepto: string;
    lineas: AsientoLineaRequest[];
  }>,
): Promise<AccrualResult> {
  if (ajustes.length === 0) {
    return { success: true, asientoId: null, asientoNumero: null, totalDebe: "0", totalHaber: "0", conceptos: [] };
  }

  const conceptos: string[] = [];
  let totalMonto = 0;
  const allLineas: AsientoLineaRequest[] = [];

  for (const a of ajustes) {
    conceptos.push(a.concepto);
    for (const l of a.lineas) {
      allLineas.push(l);
      totalMonto += parseFloat(l.debe ?? "0");
    }
  }

  const fecha = new Date();
  const request: CreateAsientoRequest = {
    fecha: fecha.toISOString(),
    concepto: `Ajustes de Período - ${fecha.toISOString().slice(0, 7)}`,
    moduloOrigen: "AJUSTES_PERIODO",
    lineas: allLineas,
  };

  return createAsiento(request, conceptos);
}

// ─── Reversión de Devengamientos ───────────────

/**
 * Revierte automáticamente los asientos de devengamiento del período anterior.
 *
 * Los asientos de devengamiento de ingresos y gastos con módulo
 * DEVENGAMIENTO_INGRESOS o DEVENGAMIENTO_GASTOS se revierten
 * invirtiendo Debe↔Haber para que la contabilidad refleje el
 * movimiento real cuando se facture/cobre.
 */
export async function revertirDevengamientos(
  anho: number,
  mes: number,
): Promise<AccrualResult> {
  const start = new Date(anho, mes - 1, 1);
  const end = new Date(anho, mes, 0, 23, 59, 59);

  // Buscar asientos de devengamiento en el período
  const asientos = await db()
    .select({ id: asientosContables.id, numero: asientosContables.numero, concepto: asientosContables.concepto })
    .from(asientosContables)
    .where(
      and(
        gte(asientosContables.fecha, start),
        lte(asientosContables.fecha, end),
        sql`${asientosContables.moduloOrigen} IN ('DEVENGAMIENTO_INGRESOS', 'DEVENGAMIENTO_GASTOS')`,
        eq(asientosContables.estado, "CONTABILIZADO"),
      ),
    );

  if (asientos.length === 0) {
    return { success: true, asientoId: null, asientoNumero: null, totalDebe: "0", totalHaber: "0", conceptos: ["No hay devengamientos para revertir"] };
  }

  const conceptos: string[] = [];
  let totalMonto = 0;
  const allLineas: AsientoLineaRequest[] = [];

  for (const asiento of asientos) {
    // Obtener líneas del asiento original
    const lineas = await db()
      .select({
        cuentaId: asientosDetalle.cuentaId,
        debe: asientosDetalle.debe,
        haber: asientosDetalle.haber,
        descripcion: asientosDetalle.descripcion,
        ordenTrabajoIdLinea: asientosDetalle.ordenTrabajoIdLinea,
      })
      .from(asientosDetalle)
      .where(eq(asientosDetalle.asientoId, asiento.id))
      .orderBy(asientosDetalle.numeroLinea);

    // Invertir Debe ↔ Haber
    for (const l of lineas) {
      allLineas.push({
        cuentaId: l.cuentaId,
        debe: l.haber ?? undefined,
        haber: l.debe ?? undefined,
        descripcion: `Reversión: ${l.descripcion ?? ""}`,
        ordenTrabajoId: l.ordenTrabajoIdLinea,
      });
    }
    conceptos.push(`Reversión asiento #${asiento.numero}: ${asiento.concepto}`);
    totalMonto += lineas.reduce((s, l) => s + parseFloat(l.debe ?? l.haber ?? "0"), 0);
  }

  const fecha = new Date(anho, mes, 1); // Primer día del mes siguiente
  const request: CreateAsientoRequest = {
    fecha: fecha.toISOString(),
    concepto: `Reversión Automática de Devengamientos - Período ${anho}-${String(mes).padStart(2, "0")}`,
    moduloOrigen: "REVERSION_DEVENGAMIENTO",
    lineas: allLineas,
  };

  return createAsiento(request, conceptos);
}

// ─── Internal: create asiento ──────────────────

async function createAsiento(
  request: CreateAsientoRequest,
  conceptos: string[],
): Promise<AccrualResult> {
  const fecha = new Date(request.fecha);
  const num = await nextNumero(fecha);

  // Validate balance
  let totalDebe = 0;
  let totalHaber = 0;
  for (const l of request.lineas) {
    totalDebe += parseFloat(l.debe ?? "0");
    totalHaber += parseFloat(l.haber ?? "0");
  }
  if (Math.abs(totalDebe - totalHaber) > 0.01) {
    throw new Error(
      `El asiento de devengamiento no balancea: Débito=${totalDebe.toFixed(2)}, Haber=${totalHaber.toFixed(2)}`,
    );
  }

  const [asiento] = await db()
    .insert(asientosContables)
    .values({
      numero: num,
      fecha,
      concepto: request.concepto,
      estado: "CONTABILIZADO",
      totalDebe: String(totalDebe.toFixed(2)),
      totalHaber: String(totalHaber.toFixed(2)),
      diferencia: "0",
      moduloOrigen: request.moduloOrigen,
    })
    .returning();

  // Insert lines
  for (let i = 0; i < request.lineas.length; i++) {
    const l = request.lineas[i]!;
    await db().insert(asientosDetalle).values({
      asientoId: asiento.id,
      cuentaId: l.cuentaId,
      numeroLinea: i + 1,
      debe: l.debe ? String(parseFloat(l.debe).toFixed(2)) : null,
      haber: l.haber ? String(parseFloat(l.haber).toFixed(2)) : null,
      descripcion: l.descripcion ?? null,
      ordenTrabajoIdLinea: l.ordenTrabajoId ?? null,
    });
  }

  return {
    success: true,
    asientoId: asiento.id,
    asientoNumero: asiento.numero,
    totalDebe: asiento.totalDebe ?? "0",
    totalHaber: asiento.totalHaber ?? "0",
    conceptos,
  };
}
