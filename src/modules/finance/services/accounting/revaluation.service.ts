/**
 * Revaluation Service — Revalúo de Activos.
 *
 * Permite revaluar activos fijos (terrenos, edificios, equipos)
 * cuando su valor de mercado excede significativamente su valor
 * en libros, conforme a NIC 16 y NIC 36.
 *
 * Incremento:
 *   Débito: Activo Fijo (1.2.x) — aumento del valor
 *   Crédito: Reserva de Revalúo (3.3.x) — patrimonio
 *
 * Decremento (deterioro):
 *   Débito: Pérdida por Deterioro (6.3.x) — gasto del período
 *   Crédito: Activo Fijo (1.2.x) — disminución del valor
 *
 * @module finance/services/accounting/revaluation.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { activosFijos, planCuentas, asientosContables, asientosDetalle, revaluaciones } from "../../schema/index.js";
import { eq, and, sql, gte, lte } from "drizzle-orm";

// ─── Interfaces ────────────────────────────────

export interface RevaluationRequest {
  activoFijoId: string;
  nuevoValor: number;
  fecha: string;
  motivo?: string;
}

export interface RevaluationResult {
  success: boolean;
  activoFijoId: string;
  valorAnterior: number;
  valorNuevo: number;
  incremento: number;
  tipo: "INCREMENTO" | "DETERIORO";
  asientoId: string | null;
  asientoNumero: number | null;
}

// ─── Core ──────────────────────────────────────

/**
 * Ejecuta la revaluación de un activo fijo.
 *
 * Calcula la diferencia entre el valor actual en libros y el nuevo
 * valor de tasación, y genera el asiento contable correspondiente.
 */
export async function revaluarActivo(
  tenantSlug: string,
  data: RevaluationRequest,
): Promise<RevaluationResult> {
  const { activoFijoId, nuevoValor, fecha, motivo } = data;

  // 1. Obtener activo
  const [activo] = await db()
    .select()
    .from(activosFijos)
    .where(and(eq(activosFijos.id, activoFijoId), eq(activosFijos.tenantSlug, tenantSlug)))
    .limit(1);

  if (!activo) throw new Error(`Activo fijo ${activoFijoId} no encontrado`);

  const valorActual = Number(activo.valorActualLibros);
  if (nuevoValor <= 0) throw new Error("El nuevo valor debe ser positivo");

  const incremento = nuevoValor - valorActual;
  const tipo = incremento >= 0 ? "INCREMENTO" : "DETERIORO";
  const monto = Math.abs(incremento);

  if (monto < 1) {
    return {
      success: true, activoFijoId, valorAnterior: valorActual, valorNuevo: nuevoValor,
      incremento: 0, tipo, asientoId: null, asientoNumero: null,
    };
  }

  // 2. Determinar cuentas contables
  const cuentaActivoId = activo.cuentaDepreciacionAcumuladaId
    ?? await resolveCuenta("1.2.99");

  const [cuentaReserva] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(and(sql`${planCuentas.codigo} LIKE '3.3.%'`, eq(planCuentas.activo, true)))
    .limit(1);

  const [cuentaDeterioro] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(and(sql`${planCuentas.codigo} LIKE '6.3.06%'`, eq(planCuentas.activo, true)))
    .limit(1);

  // 3. Generar asiento
  const fechaDate = new Date(fecha);
  const num = await nextNumero(fechaDate);
  const concepto = `${tipo === "INCREMENTO" ? "Revalúo" : "Deterioro"} - ${activo.nombre} (${activo.codigo}): ₲${valorActual.toFixed(2)} → ₲${nuevoValor.toFixed(2)}${motivo ? `. ${motivo}` : ""}`;

  const [asiento] = await db()
    .insert(asientosContables)
    .values({
      numero: num,
      fecha: fechaDate,
      concepto,
      estado: "CONTABILIZADO",
      totalDebe: monto.toFixed(2),
      totalHaber: monto.toFixed(2),
      diferencia: "0",
      moduloOrigen: "REVALUO",
    })
    .returning();

  if (tipo === "INCREMENTO" && cuentaReserva) {
    // Débito: Activo Fijo (aumenta)
    // Crédito: Reserva de Revalúo (patrimonio)
    await db().insert(asientosDetalle).values([
      { asientoId: asiento.id, cuentaId: cuentaActivoId, numeroLinea: 1, debe: monto.toFixed(2), descripcion: concepto },
      { asientoId: asiento.id, cuentaId: cuentaReserva.id, numeroLinea: 2, haber: monto.toFixed(2), descripcion: concepto },
    ]);
  } else if (tipo === "DETERIORO" && cuentaDeterioro) {
    // Débito: Pérdida por Deterioro (gasto)
    // Crédito: Activo Fijo (disminuye)
    await db().insert(asientosDetalle).values([
      { asientoId: asiento.id, cuentaId: cuentaDeterioro.id, numeroLinea: 1, debe: monto.toFixed(2), descripcion: concepto },
      { asientoId: asiento.id, cuentaId: cuentaActivoId, numeroLinea: 2, haber: monto.toFixed(2), descripcion: concepto },
    ]);
  }

  // 4. Registrar revaluación en el histórico
  await db().insert(revaluaciones).values({
    activoFijoId,
    tenantSlug,
    fecha: fechaDate,
    valorAnterior: valorActual.toFixed(2),
    valorNuevo: nuevoValor.toFixed(2),
    diferencia: incremento.toFixed(2),
    depreciacionAcumuladaAnterior: activo.depreciacionAcumulada ?? "0",
    asientoId: asiento.id,
    motivo: motivo ?? null,
  });

  // 5. Actualizar valor del activo
  const nuevoValorActual = tipo === "INCREMENTO"
    ? (Number(activo.valorActualLibros) + monto)
    : (Number(activo.valorActualLibros) - monto);

  await db()
    .update(activosFijos)
    .set({
      valorActualLibros: nuevoValorActual.toFixed(2),
      updatedAt: sql`NOW()`,
    })
    .where(eq(activosFijos.id, activoFijoId));

  return {
    success: true,
    activoFijoId,
    valorAnterior: valorActual,
    valorNuevo: nuevoValor,
    incremento,
    tipo,
    asientoId: asiento.id,
    asientoNumero: asiento.numero,
  };
}

async function resolveCuenta(codigo: string): Promise<string> {
  const [c] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(and(eq(planCuentas.codigo, codigo), eq(planCuentas.activo, true)))
    .limit(1);
  if (!c) throw new Error(`Cuenta ${codigo} no encontrada`);
  return c.id;
}

async function nextNumero(fecha: Date): Promise<number> {
  const start = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  const end = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59);
  const [max] = await db()
    .select({ max: sql<number>`COALESCE(MAX(numero), 0)` })
    .from(asientosContables)
    .where(and(gte(asientosContables.fecha, start), lte(asientosContables.fecha, end)));
  return (max?.max ?? 0) + 1;
}
