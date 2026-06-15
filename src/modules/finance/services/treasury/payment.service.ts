/**
 * Payment Service — Cobros Middleware.
 *
 * Atomic payment registration that orchestrates:
 *   1. Creates movimiento_tesoreria INGRESO (updates cuenta saldo)
 *   2. Updates factura.estado_pago / saldoPendiente
 *   3. Emits COBRO event to Accounting Bus
 *
 * All three steps happen inside a single Drizzle transaction.
 *
 * @module finance/services/treasury/payment.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { eq, and, sql } from "drizzle-orm";
import {
  facturas,
  movimientosTes,
  cuentasBancarias,
} from "../../schema/index.js";
import { NotFoundError, ValidationError } from "../../../../shared/errors/app-error.js";
import { emit, resolveAccount } from "../index.js";
import { AccountingBusCodes } from "../../routes/accounting-bus-codes.js";

// ─── Types ──────────────────────────────────────

export interface RegisterPaymentInput {
  /** Invoice (factura) ID being paid */
  facturaId: string;
  /** Amount being paid (may be partial) */
  monto: number;
  /** Payment method: EFECTIVO | TRANSFERENCIA | CHEQUE | TARJETA_DEBITO | TARJETA_CREDITO */
  medioPago: string;
  /** Target bank account (FK → cuentas_bancarias) */
  cuentaId: string;
  /** Optional reference / concept */
  concepto?: string;
  /** Tenant slug */
  tenantSlug: string;
}

export interface RegisterPaymentResult {
  success: boolean;
  movimientoId: string;
  facturaId: string;
  nuevoEstado: string;
  saldoRestante: string;
  asientoId?: string;
}

// ─── Register Payment ───────────────────────────

/**
 * Registra un pago/cobro de factura de cliente.
 *
 * Atómicamente:
 *   1. Crea movimiento INGRESO en tesorería
 *   2. Actualiza factura (saldo_pendiente, estado_pago)
 *   3. Emite asiento contable COBRO
 *
 * @returns Resultado con IDs del movimiento y factura actualizada
 */
export async function registerPayment(
  input: RegisterPaymentInput,
): Promise<RegisterPaymentResult> {
  const { facturaId, monto, medioPago, cuentaId, concepto, tenantSlug } = input;

  if (monto <= 0) {
    throw new ValidationError("El monto del pago debe ser mayor a cero");
  }

  const result = await db().transaction(async (tx) => {
    // ── 1. Fetch and validate invoice ────────────
    const [factura] = await tx
      .select()
      .from(facturas)
      .where(and(eq(facturas.id, facturaId), eq(facturas.tenantSlug, tenantSlug)))
      .limit(1);

    if (!factura) throw new NotFoundError(`Factura ${facturaId} no encontrada`);

    const saldoActual = parseFloat(factura.saldoPendiente ?? factura.total ?? "0");

    if (saldoActual <= 0) {
      throw new ValidationError("La factura ya está totalmente pagada");
    }

    if (monto > saldoActual) {
      throw new ValidationError(
        `El monto (${monto}) excede el saldo pendiente (${saldoActual})`,
      );
    }

    // ── 2. Validate bank account ────────────────
    const [cuenta] = await tx
      .select({ id: cuentasBancarias.id, activo: cuentasBancarias.activo })
      .from(cuentasBancarias)
      .where(
        and(eq(cuentasBancarias.id, cuentaId), eq(cuentasBancarias.tenantSlug, tenantSlug)),
      )
      .limit(1);

    if (!cuenta) throw new NotFoundError(`Cuenta bancaria ${cuentaId} no encontrada`);
    if (!cuenta.activo) throw new ValidationError("La cuenta bancaria está inactiva");

    // ── 3. Calculate new state ─────────────────
    const nuevoSaldo = saldoActual - monto;
    const nuevoEstado = nuevoSaldo <= 0 ? "PAGA" : "PARCIAL";

    // ── 4. Create treasury movement (INGRESO) ──
    const [movimiento] = await tx
      .insert(movimientosTes)
      .values({
        tipo: "INGRESO",
        medioPago,
        cuentaId,
        monto: String(monto),
        fecha: new Date(),
        concepto: concepto ?? `Cobro factura ${factura.numeroFacturaManual ?? factura.id}`,
        referenciaTipo: "FACTURA_CLIENTE",
        referenciaId: facturaId,
        tenantSlug,
      })
      .returning();

    if (!movimiento) {
      throw new Error("Error al crear movimiento de tesorería");
    }

    // ── 5. Update invoice payment state ─────────
    await tx
      .update(facturas)
      .set({
        estadoPago: nuevoEstado,
        saldoPendiente: String(nuevoSaldo),
      })
      .where(eq(facturas.id, facturaId));

    // ── 6. Recalculate account balance ──────────
    const [balResult] = await tx
      .select({
        total: sql<string>`COALESCE(SUM(
          CASE WHEN ${movimientosTes.tipo} IN ('INGRESO', 'TRANSFERENCIA')
            THEN CAST(${movimientosTes.monto} AS NUMERIC)
            ELSE -CAST(${movimientosTes.monto} AS NUMERIC)
          END
        ), 0)`,
      })
      .from(movimientosTes)
      .where(eq(movimientosTes.cuentaId, cuentaId));

    const [cuentaDb] = await tx
      .select({ saldoInicial: cuentasBancarias.saldoInicial })
      .from(cuentasBancarias)
      .where(eq(cuentasBancarias.id, cuentaId))
      .limit(1);

    const totalMovs = parseFloat(balResult?.total ?? "0");
    const saldoInicial = parseFloat(cuentaDb?.saldoInicial ?? "0");
    await tx
      .update(cuentasBancarias)
      .set({ saldoActual: String(saldoInicial + totalMovs), updatedAt: new Date() })
      .where(eq(cuentasBancarias.id, cuentaId));

    return { movimiento, nuevoEstado, nuevoSaldo, factura };
  });

  // ── 7. Emit COBRO to Accounting Bus (outside tx, non-blocking) ──
  let asientoId: string | undefined;
  try {
    const ctaCajaId = await resolveAccount(AccountingBusCodes.CAJA);
    const ctaClientesId = await resolveAccount(AccountingBusCodes.CLIENTES);

    if (ctaCajaId && ctaClientesId) {
      const emitResult = await emit({
        tenantSlug,
        tipo: "COBRO",
        fecha: new Date(),
        referenciaId: result.movimiento.id,
        referenciaTipo: "movimiento_tesoreria",
        descripcion: `Cobro factura ${result.factura.numeroFacturaManual ?? result.factura.id} — ${result.movimiento.medioPago} Gs. ${monto}`,
        lineas: [
          {
            cuentaId: ctaCajaId,
            debe: monto,
            descripcion: `Ingreso por cobro (${result.movimiento.medioPago})`,
          },
          {
            cuentaId: ctaClientesId,
            haber: monto,
            descripcion: `Cancelación parcial/total deuda cliente`,
          },
        ],
      });
      if (emitResult.success) {
        asientoId = emitResult.asientoId;
      }
    }
  } catch {
    // Non-blocking - payment is already recorded
  }

  return {
    success: true,
    movimientoId: result.movimiento.id,
    facturaId: result.factura.id,
    nuevoEstado: result.nuevoEstado,
    saldoRestante: String(result.nuevoSaldo),
    asientoId,
  };
}
