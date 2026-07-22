/**
 * Credit/Debit Note Service — Notas de Crédito y Débito Automáticas.
 *
 * Genera notas de crédito y débito automáticas cuando se revierte
 * una factura (venta o compra). Las NC/ND se registran como asientos
 * contables independientes y se vinculan al auto-reversal service.
 *
 * Flujo:
 *   1. Se anula una factura de venta (ej: cliente devuelve)
 *   2. autoReversal() genera el asiento inverso
 *   3. Este servicio genera la Nota de Crédito/Débito asociada
 *   4. La NC/ND queda vinculada a la factura original
 *
 * @module finance/services/accounting/credit-debit-note.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import {
  asientosContables,
  facturas,
  planCuentas,
  cuentaMapping,
} from "../../schema/index.js";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { createAsiento } from "./ledger.service.js";
import { logAudit } from "./audit-log.service.js";
import type { AsientoLineaRequest } from "../../types.js";

// ─── Types ──────────────────────────────────────

export interface CreditDebitNoteInput {
  /** Tenant slug */
  tenantSlug: string;
  /** ID de la factura original que se está revirtiendo */
  facturaOriginalId: string;
  /** Tipo de nota: CREDITO (devuelve dinero al cliente) o DEBITO (cobra más al cliente) */
  tipo: "CREDITO" | "DEBITO";
  /** Motivo de la nota */
  motivo: string;
  /** Monto a notar (opcional, por defecto el total de la factura) */
  monto?: number;
  /** ID del asiento de reversión creado por autoReversal() */
  reversalAsientoId?: string;
}

export interface CreditDebitNoteResult {
  success: boolean;
  notaAsientoId?: string;
  notaNumero?: number;
  tipo: "CREDITO" | "DEBITO";
  facturaOriginalId: string;
  monto: string;
  error?: string;
}

// ─── Service ────────────────────────────────────

/**
 * Genera una Nota de Crédito o Débito automática asociada a
 * la reversión de una factura.
 *
 * @param input - Datos de la nota
 * @returns Resultado de la generación
 */
export async function generarNotaCreditoDebito(
  input: CreditDebitNoteInput,
): Promise<CreditDebitNoteResult> {
  try {
    const {
      tenantSlug,
      facturaOriginalId,
      tipo,
      motivo,
      monto: montoOverride,
      reversalAsientoId,
    } = input;

    // ── 1. Obtener la factura original ──
    const [factura] = await db()
      .select({
        id: facturas.id,
        total: facturas.total,
        tipoFacturacion: facturas.tipo,
        sifenCdc: facturas.sifenCdc,
        createdAt: facturas.createdAt,
      })
      .from(facturas)
      .where(eq(facturas.id, facturaOriginalId))
      .limit(1);

    if (!factura) {
      return {
        success: false,
        tipo,
        facturaOriginalId,
        monto: "0.00",
        error: `Factura original ${facturaOriginalId} no encontrada`,
      };
    }

    const monto = montoOverride ?? Number(factura.total ?? 0);
    if (monto <= 0) {
      return {
        success: false,
        tipo,
        facturaOriginalId,
        monto: "0.00",
        error: "El monto de la nota debe ser positivo",
      };
    }

    // ── 2. Resolver cuentas contables para NC/ND ──
    const documentoRef = `nota_${tipo.toLowerCase()}:${facturaOriginalId}`;

    // Buscar mapping contable para NC/ND
    const tipoEvento = tipo === "CREDITO" ? "NOTA_CREDITO" : "NOTA_DEBITO";
    let cuentaDebeId: string | null = null;
    let cuentaHaberId: string | null = null;

    // Buscar en cuenta_mapping (primero específico del tenant, luego global)
    const mapping = await db()
      .select({
        cuentaDebeId: cuentaMapping.cuentaDebeId,
        cuentaHaberId: cuentaMapping.cuentaHaberId,
      })
      .from(cuentaMapping)
      .where(
        and(
          eq(cuentaMapping.modulo, "SIFEN"),
          eq(cuentaMapping.tipoEvento, tipoEvento),
          eq(cuentaMapping.activo, true),
          isNull(cuentaMapping.tenantSlug), // Global mapping
        ),
      )
      .orderBy(desc(cuentaMapping.prioridad))
      .limit(1);

    if (mapping.length > 0) {
      cuentaDebeId = mapping[0]!.cuentaDebeId;
      cuentaHaberId = mapping[0]!.cuentaHaberId;
    } else {
      // Fallback: cuentas por defecto
      const [ctaClientes] = await db()
        .select({ id: planCuentas.id })
        .from(planCuentas)
        .where(sql`${planCuentas.codigo} LIKE '1.1.02%' AND ${planCuentas.activo} = true`)
        .limit(1);

      const [ctaIngresos] = await db()
        .select({ id: planCuentas.id })
        .from(planCuentas)
        .where(sql`${planCuentas.codigo} LIKE '4.1.%' AND ${planCuentas.activo} = true`)
        .limit(1);

      if (!ctaClientes || !ctaIngresos) {
        return {
          success: false,
          tipo,
          facturaOriginalId,
          monto: monto.toFixed(2),
          error: "No se encontraron cuentas contables para NC/ND. Verifique el Plan de Cuentas.",
        };
      }

      // NC: Debe a Ingresos (disminuye ingreso), Haber a Clientes (disminuye deuda)
      // ND: Debe a Clientes (aumenta deuda), Haber a Ingresos (aumenta ingreso)
      if (tipo === "CREDITO") {
        cuentaDebeId = ctaIngresos.id;
        cuentaHaberId = ctaClientes.id;
      } else {
        cuentaDebeId = ctaClientes.id;
        cuentaHaberId = ctaIngresos.id;
      }
    }

    if (!cuentaDebeId || !cuentaHaberId) {
      return {
        success: false,
        tipo,
        facturaOriginalId,
        monto: monto.toFixed(2),
        error: "No se pudieron resolver las cuentas contables para la NC/ND",
      };
    }

    // ── 3. Crear las líneas del asiento ──
    const montoStr = monto.toFixed(2);
    const lineas: AsientoLineaRequest[] = [
      {
        cuentaId: cuentaDebeId,
        debe: tipo === "CREDITO" ? montoStr : undefined,
        haber: tipo === "DEBITO" ? montoStr : undefined,
        descripcion: `${tipo === "CREDITO" ? "Nota de Crédito" : "Nota de Débito"}: ${motivo}`,
      },
      {
        cuentaId: cuentaHaberId,
        debe: tipo === "DEBITO" ? montoStr : undefined,
        haber: tipo === "CREDITO" ? montoStr : undefined,
        descripcion: `${tipo === "CREDITO" ? "Nota de Crédito" : "Nota de Débito"}: ${motivo}`,
      },
    ];

    // Si hay IVA, agregar línea correspondiente
    if (factura.total && Number(factura.total) > 0) {
      const iva = Number(factura.total) * 0.1; // 10% IVA Paraguay
      if (iva > 0) {
        const [ctaIva] = await db()
          .select({ id: planCuentas.id })
          .from(planCuentas)
          .where(sql`${planCuentas.codigo} LIKE '2.1.2.%' AND ${planCuentas.activo} = true`)
          .limit(1);

        if (ctaIva) {
          const ivaStr = iva.toFixed(2);
          lineas.push({
            cuentaId: ctaIva.id,
            debe: tipo === "CREDITO" ? ivaStr : undefined,
            haber: tipo === "DEBITO" ? ivaStr : undefined,
            descripcion: `IVA ${tipo === "CREDITO" ? "NC" : "ND"} ${motivo}`,
          });
        }
      }
    }

    // ── 4. Crear asiento contable para la NC/ND ──
    const result = await createAsiento({
      fecha: new Date().toISOString(),
      concepto: `${tipo === "CREDITO" ? "Nota de Crédito" : "Nota de Débito"}: ${motivo} (Factura #${facturaOriginalId.slice(0, 8)})`,
      documentoRef,
      moduloOrigen: "SIFEN",
      lineas,
    });

    // ── 5. Si hay asiento de reversión, vincularlo ──
    if (reversalAsientoId) {
      await db()
        .update(asientosContables)
        .set({
          documentoRef: sql`CONCAT(${asientosContables.documentoRef}, ',', ${documentoRef})`,
        })
        .where(eq(asientosContables.id, reversalAsientoId));
    }

    // ── 6. Audit log ──
    await logAudit({
      tenantSlug,
      usuarioId: "system",
      accion: "CREATE",
      entidad: "asientos_contables",
      entidadId: result.asiento.id,
      descripcion: `[${tipo === "CREDITO" ? "NC" : "ND"}] ${motivo} — Factura original: ${facturaOriginalId}`,
    }).catch(() => {/* silent */});

    return {
      success: true,
      notaAsientoId: result.asiento.id,
      notaNumero: result.asiento.numero,
      tipo,
      facturaOriginalId,
      monto: montoStr,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.warn(`[credit-debit-note] Error: ${message}`);
    return {
      success: false,
      tipo: input.tipo,
      facturaOriginalId: input.facturaOriginalId,
      monto: "0.00",
      error: message,
    };
  }
}
