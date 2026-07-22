/**
 * AutoReversal Service — Reversión automática de asientos contables.
 *
 * Cuando una transacción de negocio se anula (factura, compra, movimiento
 * de tesorería, consumo de stock, etc.), este servicio busca el asiento
 * original y genera un asiento inverso automático.
 *
 * Flujo:
 *   1. Busca el/los asiento(s) CONTABILIZADO(s) asociados a la transacción
 *   2. Intercambia Debe ↔ Haber de todas las líneas
 *   3. Crea el asiento de reversión
 *   4. Marca el asiento original como ANULADO
 *   5. Registra auditoría de la reversión
 *
 * @module finance/services/accounting/auto-reversal.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import {
  asientosContables,
  asientosDetalle,
} from "../../schema/index.js";
import { eq, and, desc, asc } from "drizzle-orm";
import { createAsiento } from "./ledger.service.js";
import { logAudit } from "./audit-log.service.js";
import type { AsientoLineaRequest } from "../../types.js";

// ─── Types ──────────────────────────────────────

export interface ReversalInput {
  /** Tenant slug for multi-tenant isolation */
  tenantSlug: string;
  /** Reference to the original transaction (e.g. compra ID, factura ID) */
  referenciaId: string;
  /** Type of reference (compra, factura, movimiento_stock, etc.) */
  referenciaTipo: string;
  /** Reason for the reversal */
  motivo: string;
  /** Optional: only reverse if state matches (e.g. "CONTABILIZADO") */
  estadoOriginal?: string;
}

export interface ReversalResult {
  success: boolean;
  /** ID of the newly created reversal journal entry */
  reversalAsientoId?: string;
  /** Number of the reversal entry */
  reversalAsientoNumero?: number;
  /** ID of the original entry that was marked ANULADO */
  originalAsientoId?: string;
  /** Error message if failed */
  error?: string;
}

// ─── Service ────────────────────────────────────

/**
 * Revierte automáticamente un asiento contable asociado a una transacción.
 *
 * Busca asientos CONTABILIZADOS que tengan documentoRef = `${referenciaTipo}:${referenciaId}`
 * y genera un asiento inverso (Debe ↔ Haber intercambiados).
 *
 * @param input - Datos de la transacción a revertir
 * @returns Resultado de la reversión
 */
export async function autoReversal(
  input: ReversalInput,
): Promise<ReversalResult> {
  try {
    const { tenantSlug, referenciaId, referenciaTipo, motivo, estadoOriginal } = input;

    // 1. Find the original accounting entry/entries for this transaction
    const documentoRef = `${referenciaTipo}:${referenciaId}`;

    const asientosOriginales = await db()
      .select({
        id: asientosContables.id,
        numero: asientosContables.numero,
        estado: asientosContables.estado,
        concepto: asientosContables.concepto,
        fecha: asientosContables.fecha,
        moduloOrigen: asientosContables.moduloOrigen,
        ordenTrabajoId: asientosContables.ordenTrabajoId,
      })
      .from(asientosContables)
      .where(
        and(
          eq(asientosContables.documentoRef, documentoRef),
          estadoOriginal
            ? eq(asientosContables.estado, estadoOriginal as any)
            : eq(asientosContables.estado, "CONTABILIZADO"),
        ),
      )
      .orderBy(desc(asientosContables.createdAt));

    if (asientosOriginales.length === 0) {
      return {
        success: false,
        error: `No se encontraron asientos CONTABILIZADOS para ${documentoRef}`,
      };
    }

    // 2. Reverse each entry found
    let lastReversalId: string | undefined;
    let lastReversalNumero: number | undefined;
    let lastOriginalId: string | undefined;

    for (const asiento of asientosOriginales) {
      // Get lines of the original entry
      const lineasOriginales = await db()
        .select({
          cuentaId: asientosDetalle.cuentaId,
          debe: asientosDetalle.debe,
          haber: asientosDetalle.haber,
          descripcion: asientosDetalle.descripcion,
          centroCostoId: asientosDetalle.centroCostoId,
          ordenTrabajoIdLinea: asientosDetalle.ordenTrabajoIdLinea,
        })
        .from(asientosDetalle)
        .where(eq(asientosDetalle.asientoId, asiento.id))
        .orderBy(asc(asientosDetalle.numeroLinea));

      if (lineasOriginales.length < 2) {
        continue; // Skip malformed entries
      }

      // 3. Build reversal lines (swap Debe ↔ Haber)
      const lineasReversa: AsientoLineaRequest[] = lineasOriginales.map((l) => ({
        cuentaId: l.cuentaId,
        debe: l.haber ? String(Number(l.haber).toFixed(2)) : undefined,
        haber: l.debe ? String(Number(l.debe).toFixed(2)) : undefined,
        descripcion: `[REVERSIÓN] ${l.descripcion ?? ""}`,
        centroCostoId: l.centroCostoId ?? null,
        ordenTrabajoId: l.ordenTrabajoIdLinea ?? null,
      }));

      // 4. Create the reversal journal entry
      const result = await createAsiento({
        fecha: new Date().toISOString(),
        concepto: `Reversión: ${motivo} (Asiento #${asiento.numero})`,
        documentoRef: `reversal:${asiento.id}`,
        moduloOrigen: "ANULACION",
        ordenTrabajoId: asiento.ordenTrabajoId,
        lineas: lineasReversa,
      });

      lastReversalId = result.asiento.id;
      lastReversalNumero = result.asiento.numero;
      lastOriginalId = asiento.id;

      // 5. Mark original as ANULADO
      await db()
        .update(asientosContables)
        .set({ estado: "ANULADO", updatedAt: new Date() })
        .where(eq(asientosContables.id, asiento.id));

      // 6. Audit log for the reversal
      await logAudit({
        tenantSlug,
        usuarioId: "system",
        accion: "CREATE",
        entidad: "asientos_contables",
        entidadId: result.asiento.id,
        descripcion: `[AUTO REVERSAL] Reversión de asiento #${asiento.numero}: ${motivo}`,
      }).catch(() => {
        /* silent */
      });
    }

    return {
      success: true,
      reversalAsientoId: lastReversalId,
      reversalAsientoNumero: lastReversalNumero,
      originalAsientoId: lastOriginalId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.warn(
      `[auto-reversal] Error al revertir ${input.referenciaTipo}:${input.referenciaId}: ${message}`,
    );
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Verifica si una transacción ya tiene un asiento de reversión.
 * Útil para prevenir reversiones duplicadas.
 */
export async function hasReversal(
  referenciaTipo: string,
  referenciaId: string,
): Promise<boolean> {
  const documentoRef = `${referenciaTipo}:${referenciaId}`;

  const [original] = await db()
    .select({ id: asientosContables.id })
    .from(asientosContables)
    .where(
      and(
        eq(asientosContables.documentoRef, documentoRef),
        eq(asientosContables.estado, "CONTABILIZADO"),
      ),
    )
    .limit(1);

  if (!original) return false;

  // Check if a reversal already exists for this original
  const [reversal] = await db()
    .select({ id: asientosContables.id })
    .from(asientosContables)
    .where(
      and(
        eq(asientosContables.documentoRef, `reversal:${original.id}`),
        eq(asientosContables.estado, "CONTABILIZADO"),
      ),
    )
    .limit(1);

  return !!reversal;
}

/**
 * Obtiene los asientos CONTABILIZADOS asociados a una transacción.
 */
export async function getAsientosByReferencia(
  referenciaTipo: string,
  referenciaId: string,
) {
  const documentoRef = `${referenciaTipo}:${referenciaId}`;

  return db()
    .select({
      id: asientosContables.id,
      numero: asientosContables.numero,
      fecha: asientosContables.fecha,
      concepto: asientosContables.concepto,
      estado: asientosContables.estado,
      totalDebe: asientosContables.totalDebe,
      totalHaber: asientosContables.totalHaber,
      moduloOrigen: asientosContables.moduloOrigen,
    })
    .from(asientosContables)
    .where(eq(asientosContables.documentoRef, documentoRef))
    .orderBy(desc(asientosContables.createdAt));
}
