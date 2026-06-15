/**
 * Journal Consolidation Service — Refundición de Asientos.
 *
 * Consolida múltiples asientos contables en un único asiento resumen.
 *
 * Útil para:
 *   - Reducir el volumen del Libro Diario en períodos con muchos asientos
 *   - Simplificar la presentación de estados financieros
 *   - Agrupar asientos por módulo de origen
 *
 * La refundición suma todos los débitos y créditos de cada cuenta,
 * generando un asiento con los netos por cuenta contable.
 *
 * @module finance/services/accounting/journal-consolidation.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { asientosContables, asientosDetalle } from "../../schema/index.js";
import { and, sql, gte, lte } from "drizzle-orm";

// ─── Interfaces ────────────────────────────────

export interface ConsolidationRequest {
  /** IDs de asientos a refundir */
  asientoIds: string[];
  /** Fecha del asiento refundido */
  fecha?: string;
  /** Concepto personalizado */
  concepto?: string;
  /** Módulo de origen para el nuevo asiento */
  moduloOrigen?: string;
}

export interface ConsolidatedLine {
  cuentaId: string;
  totalDebe: number;
  totalHaber: number;
  neto: number;
}

export interface ConsolidationResult {
  success: boolean;
  asientosOriginales: number;
  lineasOriginales: number;
  lineasConsolidadas: number;
  asientoNuevoId: string | null;
  asientoNuevoNumero: number | null;
  totalDebe: string;
  totalHaber: string;
}

// ─── Core ──────────────────────────────────────

/**
 * Refunde múltiples asientos en un único asiento consolidado.
 *
 * Proceso:
 *   1. Validar que todos los asientos existen y están CONTABILIZADOS
 *   2. Sumar debe/haber por cuenta contable
 *   3. Generar nuevo asiento con saldos netos por cuenta
 *
 * @throws Si algún asiento no existe o no está contabilizado
 */
export async function refundirAsientos(
  data: ConsolidationRequest,
): Promise<ConsolidationResult> {
  const { asientoIds, fecha, concepto, moduloOrigen } = data;

  if (asientoIds.length < 2) {
    throw new Error("Se necesitan al menos 2 asientos para refundir");
  }

  // 1. Verificar asientos
  const asientos = await db()
    .select({ id: asientosContables.id, numero: asientosContables.numero, estado: asientosContables.estado })
    .from(asientosContables)
    .where(sql`${asientosContables.id} = ANY(${asientoIds}::uuid[])`);

  if (asientos.length !== asientoIds.length) {
    throw new Error(`Solo se encontraron ${asientos.length} de ${asientoIds.length} asientos`);
  }

  const noContabilizados = asientos.filter((a) => a.estado !== "CONTABILIZADO");
  if (noContabilizados.length > 0) {
    throw new Error(
      `Los asientos #${noContabilizados.map((a) => a.numero).join(", ")} no están CONTABILIZADOS`,
    );
  }

  // 2. Sumar líneas por cuenta
  const lineasAgrupadas = await db()
    .select({
      cuentaId: asientosDetalle.cuentaId,
      totalDebe: sql<number>`COALESCE(SUM(COALESCE(${asientosDetalle.debe}::numeric, 0)), 0)`,
      totalHaber: sql<number>`COALESCE(SUM(COALESCE(${asientosDetalle.haber}::numeric, 0)), 0)`,
    })
    .from(asientosDetalle)
    .where(sql`${asientosDetalle.asientoId} = ANY(${asientoIds}::uuid[])`)
    .groupBy(asientosDetalle.cuentaId);

  const consolidatedLines: ConsolidatedLine[] = lineasAgrupadas.map((l) => ({
    cuentaId: l.cuentaId,
    totalDebe: Number(l.totalDebe),
    totalHaber: Number(l.totalHaber),
    neto: Number(l.totalDebe) - Number(l.totalHaber),
  }));

  // 3. Calcular totales
  let totalDebe = 0;
  let totalHaber = 0;
  let lineasCount = 0;

  for (const l of consolidatedLines) {
    if (l.neto > 0) {
      totalDebe += l.neto;
      lineasCount++;
    } else if (l.neto < 0) {
      totalHaber += Math.abs(l.neto);
      lineasCount++;
    }
  }

  if (Math.abs(totalDebe - totalHaber) > 0.01) {
    // Balancear con diferencia
    const diff = (totalDebe - totalHaber).toFixed(2);
    throw new Error(
      `Refundición no balancea: Débito=${totalDebe.toFixed(2)}, Haber=${totalHaber.toFixed(2)} (dif=${diff})`,
    );
  }

  // 4. Crear asiento consolidado
  const fechaDate = fecha ? new Date(fecha) : new Date();
  const num = await nextNumero(fechaDate);

  const [asiento] = await db()
    .insert(asientosContables)
    .values({
      numero: num,
      fecha: fechaDate,
      concepto: concepto ?? `Refundición de ${asientoIds.length} asientos`,
      estado: "CONTABILIZADO",
      totalDebe: totalDebe.toFixed(2),
      totalHaber: totalHaber.toFixed(2),
      diferencia: "0",
      moduloOrigen: moduloOrigen ?? "REFUNDICION",
      documentoRef: `RF-${asientoIds[0]!.slice(0, 8)}`,
    })
    .returning();

  // 5. Insertar líneas consolidadas
  let idx = 0;
  for (const l of consolidatedLines) {
    if (Math.abs(l.neto) < 0.01) continue;
    idx++;

    if (l.neto > 0) {
      await db().insert(asientosDetalle).values({
        asientoId: asiento.id,
        cuentaId: l.cuentaId,
        numeroLinea: idx,
        debe: l.neto.toFixed(2),
        descripcion: `Refundición: saldo deudor`,
      });
    } else {
      await db().insert(asientosDetalle).values({
        asientoId: asiento.id,
        cuentaId: l.cuentaId,
        numeroLinea: idx,
        haber: Math.abs(l.neto).toFixed(2),
        descripcion: `Refundición: saldo acreedor`,
      });
    }
  }

  // 6. Marcar asientos originales como refundidos
  await db()
    .update(asientosContables)
    .set({ moduloOrigen: sql`CONCAT(${asientosContables.moduloOrigen}, '_REFUNDIDO')` })
    .where(sql`${asientosContables.id} = ANY(${asientoIds}::uuid[])`);

  return {
    success: true,
    asientosOriginales: asientoIds.length,
    lineasOriginales: consolidatedLines.length,
    lineasConsolidadas: idx,
    asientoNuevoId: asiento.id,
    asientoNuevoNumero: asiento.numero,
    totalDebe: totalDebe.toFixed(2),
    totalHaber: totalHaber.toFixed(2),
  };
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
