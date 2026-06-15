/**
 * Payment Routes — Cobros de facturas de cliente.
 *
 * POST /finance/payments/register — Registra un cobro
 *
 * All routes require X-Tenant-Slug header (resolved by tenant-resolver).
 *
 * @module finance/routes/payment.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { registerPayment } from "../services/treasury/payment.service.js";

// ─── Types ──────────────────────────────────────

interface RegisterPaymentBody {
  facturaId: string;
  monto: number;
  medioPago: string;
  cuentaId: string;
  concepto?: string;
}

// ─── Routes ─────────────────────────────────────

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /finance/payments/register
   *
   * Registra un pago de factura de cliente. Crea movimiento de tesorería
   * (INGRESO), actualiza saldo de factura y emite asiento contable.
   *
   * Body:
   *   facturaId  (string) — ID de la factura a cobrar
   *   monto      (number) — Monto del pago (puede ser parcial)
   *   medioPago  (string) — EFECTIVO | TRANSFERENCIA | CHEQUE | TARJETA_DEBITO | TARJETA_CREDITO
   *   cuentaId   (string) — Cuenta bancaria destino
   *   concepto   (string) — Opcional
   */
  app.post(
    "/finance/payments/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["facturaId", "monto", "medioPago", "cuentaId"],
          properties: {
            facturaId: { type: "string", format: "uuid" },
            monto: { type: "number", minimum: 0.01 },
            medioPago: {
              type: "string",
              enum: ["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "TARJETA_DEBITO", "TARJETA_CREDITO"],
            },
            cuentaId: { type: "string", format: "uuid" },
            concepto: { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              movimientoId: { type: "string" },
              facturaId: { type: "string" },
              nuevoEstado: { type: "string" },
              saldoRestante: { type: "string" },
              asientoId: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: RegisterPaymentBody }>,
      reply: FastifyReply,
    ) => {
      const tenant = request.tenantSlug;
      if (!tenant) {
        return reply.status(400).send({ error: "X-Tenant-Slug header required" });
      }

      const { facturaId, monto, medioPago, cuentaId, concepto } = request.body;

      try {
        const result = await registerPayment({
          facturaId,
          monto,
          medioPago,
          cuentaId,
          concepto,
          tenantSlug: tenant,
        });
        return reply.status(201).send(result);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Error desconocido";
        return reply.status(400).send({ success: false, error: message });
      }
    },
  );
}
