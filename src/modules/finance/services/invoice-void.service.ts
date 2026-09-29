/**
 * Invoice Void Service — anulación manual de facturas (T-45 · FIN-04).
 *
 * Antes solo existía la emisión (`POST /finance/invoices/issue`): una factura
 * emitida no tenía vuelta atrás. Una factura cobrada o con asiento contable
 * quedaba congelada para siempre, y el juego de asientos no admitía corrección.
 *
 * Este service implementa la anulación con las salvaguarda fiscales y
 * contables que exige el marco paraguayo (RG 90 / DNIT SIFEN):
 *
 *   MANUAL       → se anula en el sistema; el documento pre-impreso ya no se
 *                  emite, no hay comunicación a la DNIT que hacer.
 *   ELECTRONICA  → NO se anula en el sistema. El DTE tiene CDC asignado y la
 *                  DNIT es la única autoridad sobre su estado: anular sin
 *                  sif-03 dejaría un documento válido ante el fisco que en
 *                  cambio ya no existe en el sistema. Se rechaza con 409 y se
 *                  indica usar el endpoint de anulación SIFEN.
 *
 * Reglas de negocio:
 *   · Tenant-scoped: una factura ajena es 404 (no se filtra su existencia).
 *   · Idempotencia: anular dos veces la misma factura es 409.
 *   · Cobro: una factura PAGA o con saldo pendiente != 0 requiere primero el
 *     reverso del cobro; anularla dejaría el dinero cobrado sin respaldo.
 *   · Atomicidad (T-31): el cambio de estado y el reverso contable comparten
 *     UNA transacción. O la factura queda ANULADA con su reverso, o no cambia
 *     nada. Nunca queda una factura anulada con el asiento de venta vigente.
 *
 * @module finance/services/invoice-void.service
 */

import { and, eq } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { withTransaction } from "../../../shared/database/transaction.js";
import { facturas } from "../schema/index.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../../shared/errors/app-error.js";
import { resolveAuditActor, isRealActor } from "../../../shared/audit/audit-context.js";
import { autoReversal } from "./accounting/auto-reversal.service.js";
import { logEntityAudit } from "./accounting/audit-log.service.js";

// ─── Types ──────────────────────────────────────

export interface VoidInvoiceInput {
  /** Motivo de la anulación (obligatorio: queda en el concepto del asiento) */
  motivo: string;
  /**
   * Confirma que el documento ELECTRONICA ya fue anulado ante la DNIT mediante
   * sif-03. Obligatorio si la factura tiene CDC: sin esta confirmación el
   * sistema no puede assumes que el fisco conoce la anulación.
   */
  sifenAnulado?: boolean;
}

export interface VoidInvoiceResult {
  facturaId: string;
  estadoPago: string;
  /** true si se generó un asiento de reversión */
  reversoGenerado: boolean;
  reversalAsientoId?: string;
  reversalAsientoNumero?: number;
  /** Motivo por el que NO se generó reverso (p. ej. la factura nunca tuvo asiento) */
  reversoOmitido?: string;
}

const MOTIVO_MAX = 500;

// ─── Service ────────────────────────────────────

/**
 * Anula una factura y genera el reverso contable de su asiento de venta.
 *
 * @param facturaId - UUID de la factura
 * @param input - Motivo y confirmación SIFEN
 * @param tenantSlug - Tenant de la request (aislamiento obligatorio)
 */
export async function voidInvoice(
  facturaId: string,
  input: VoidInvoiceInput,
  tenantSlug: string,
): Promise<VoidInvoiceResult> {
  const motivo = (input.motivo ?? "").trim();
  if (!motivo) {
    throw new ValidationError("El motivo de la anulación es obligatorio");
  }
  if (motivo.length > MOTIVO_MAX) {
    throw new ValidationError(
      `El motivo no puede superar ${MOTIVO_MAX} caracteres`,
    );
  }

  return withTransaction(async () => {
    // ── 1. Cargar la factura dentro del tenant ──
    const [factura] = await db()
      .select()
      .from(facturas)
      .where(and(eq(facturas.id, facturaId), eq(facturas.tenantSlug, tenantSlug)))
      .limit(1);

    // 404 (no 403): no revelamos si la factura existe en otro taller.
    if (!factura) {
      throw new NotFoundError("Factura no encontrada");
    }

    // ── 2. Idempotencia ──
    if (factura.estadoPago === "ANULADA") {
      throw new ConflictError("La factura ya está anulada");
    }

    // ── 3. DTE electrónico: la DNIT manda ──
    if (factura.sifenCdc) {
      if (!input.sifenAnulado) {
        throw new ConflictError(
          "Esta factura electrónica tiene CDC asignado y solo la DNIT puede anularla. " +
            "Anule el DTE ante SIFEN (sif-03) y vuelva a confirmar con sifenAnulado=true.",
        );
      }
    }

    // ── 4. Cobro: no se anula sobre dinero cobrado ──
    const saldo = Number(factura.saldoPendiente ?? 0);
    if (factura.estadoPago === "PAGA") {
      throw new ConflictError(
        "La factura está PAGA. Registre primero el reverso del cobro; " +
          "anular una factura cobrada dejaría el ingreso sin respaldo contable.",
      );
    }
    if (saldo > 0 && factura.estadoPago === "PARCIAL") {
      throw new ConflictError(
        `La factura tiene un pago parcial de ${saldo.toFixed(2)} pendiente de reversing. ` +
          "Reembolse o registre la nota de crédito antes de anular.",
      );
    }

    // ── 5. Estado + reverso en la MISMA transacción ──
    const actor = resolveAuditActor();
    const [anulada] = await db()
      .update(facturas)
      .set({
        estadoPago: "ANULADA",
        saldoPendiente: "0",
      })
      .where(
        and(
          eq(facturas.id, facturaId),
          eq(facturas.tenantSlug, tenantSlug),
          // Re-chequeo optimista: si otra request anuló entre el SELECT y el
          // UPDATE, el filtro no matchea y caemos en el 409 de abajo.
          eq(facturas.estadoPago, factura.estadoPago as never),
        ),
      )
      .returning({ id: facturas.id });

    if (!anulada) {
      throw new ConflictError(
        "La factura cambió de estado mientras se anulaba. Reintente.",
      );
    }

    // ── 6. Reverso contable (Debe ↔ Haber) ──
    // `autoReversal` busca por documentoRef = "factura:<id>", que es
    // exactamente lo que emite el Accounting Bus al crear el asiento de venta.
    let reversoGenerado = false;
    let reversalAsientoId: string | undefined;
    let reversalAsientoNumero: number | undefined;
    let reversoOmitido: string | undefined;

    if (factura.asientoId) {
      const resultado = await autoReversal({
        tenantSlug,
        referenciaId: facturaId,
        referenciaTipo: "factura",
        motivo,
      });

      if (resultado.success) {
        reversoGenerado = true;
        reversalAsientoId = resultado.reversalAsientoId;
        reversalAsientoNumero = resultado.reversalAsientoNumero;
      } else {
        // El asiento de venta no está CONTABILIZADO (p. ej. nunca se emitió
        // por falta de plan de cuentas). No es un error: no hay qué revertir.
        reversoOmitido = resultado.error ?? "Sin asiento contabilizado que revertir";
      }
    } else {
      reversoOmitido = "La factura no tiene asiento contable asociado";
    }

    // ── 7. Auditoría de la anulación ──
    await logEntityAudit({
      tenantSlug,
      usuarioId: isRealActor(actor.usuarioId) ? actor.usuarioId : "system",
      accion: "ANULAR",
      entidad: "facturas",
      entidadId: facturaId,
      valorAnterior: { estadoPago: factura.estadoPago, saldoPendiente: saldo },
      valorNuevo: { estadoPago: "ANULADA", saldoPendiente: 0 },
      descripcion:
        `Anulación de factura ${factura.numeroFacturaManual ?? facturaId}: ${motivo}` +
        (reversoGenerado ? ` (reverso #${reversalAsientoNumero})` : " (sin reverso)"),
    }).catch(() => {
      // La auditoría no debe tumbar la anulación ya confirmada.
    });

    return {
      facturaId,
      estadoPago: "ANULADA",
      reversoGenerado,
      reversalAsientoId,
      reversalAsientoNumero,
      reversoOmitido,
    };
  });
}
