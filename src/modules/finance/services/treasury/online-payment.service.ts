/**
 * Online Payment Service — Payment links for invoices.
 *
 * Sprint 85 — P1-5.
 * Generates shareable payment links for invoices via:
 *   - Stripe (international cards, automatic)
 *   - PagosPy (Paraguay local payments — Efectivo, transferencias)
 *
 * @module finance/services/treasury/online-payment.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { env } from "../../../../config/env.js";
import { facturas } from "../../schema/facturas.js";
import { eq, and } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../../shared/errors/app-error.js";
import { registerPayment } from "./payment.service.js";
import { cuentasBancarias } from "../../schema/treasury.js";

export interface PaymentLinkInput {
  facturaId: string;
  provider: "STRIPE" | "PAGOS_PY";
  successUrl?: string;
  cancelUrl?: string;
}

export interface PaymentLinkResult {
  facturaId: string;
  provider: string;
  paymentUrl: string;
  expiresAt?: string;
}

/**
 * Genera un link de pago para una factura.
 *
 * Soporta:
 *   - STRIPE: Genera Stripe Payment Link (checkout session)
 *   - PAGOS_PY: Genera link de pago con QR (placeholder)
 */
export async function generatePaymentLink(
  input: PaymentLinkInput,
  tenantSlug: string,
): Promise<PaymentLinkResult> {
  const { facturaId, provider, successUrl, cancelUrl } = input;

  // ── 1. Validate invoice exists and is pending ──
  const [factura] = await db()
    .select()
    .from(facturas)
    .where(and(eq(facturas.id, facturaId), eq(facturas.tenantSlug, tenantSlug)))
    .limit(1);

  if (!factura) throw new NotFoundError(`Factura ${facturaId} no encontrada`);

  if (factura.estadoPago === "PAGA" || factura.estadoPago === "PAGADA") {
    throw new ValidationError("La factura ya está pagada");
  }

  const monto = Number(factura.total ?? 0);
  if (monto <= 0) throw new ValidationError("La factura debe tener un monto válido");

  // ── 2. Generate payment link based on provider ──
  if (provider === "STRIPE") {
    return await generateStripePaymentLink(facturaId, monto, tenantSlug, successUrl, cancelUrl);
  } else if (provider === "PAGOS_PY") {
    return await generatePagosPyLink(facturaId, monto, tenantSlug);
  } else {
    throw new ValidationError(`Proveedor de pago no soportado: ${provider}`);
  }
}

/**
 * Genera link de pago vía Stripe.
 * Usa Stripe Payment Links (simplificado) o Checkout Session.
 */
async function generateStripePaymentLink(
  facturaId: string,
  monto: number,
  _tenantSlug: string,
  successUrl?: string,
  _cancelUrl?: string,
): Promise<PaymentLinkResult> {
  const isStripeConfigured = !!process.env["STRIPE_SECRET_KEY"];

  if (!isStripeConfigured) {
    // Modo desarrollo: mock URL
    return {
      facturaId,
      provider: "STRIPE",
      paymentUrl: `/dashboard/facturas/${facturaId}/pago?mock=true&amount=${monto}`,
    };
  }

  // Producción: crear Payment Link en Stripe
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);

    // Crear precio único para esta factura
    const price = await stripe.prices.create({
      unit_amount: Math.round(monto * 100), // Stripe usa centavos
      currency: "pyg",
      product_data: {
        name: `Factura #${facturaId.slice(0, 8)}`,
        description: `Pago de factura - AutomotiveOS`,
      },
    });

    // Crear Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      after_completion: {
        type: "redirect",
        redirect: { url: successUrl ?? `${env.APP_URL || "http://localhost:3000"}/dashboard/facturas/${facturaId}` },
      },
    });

    return {
      facturaId,
      provider: "STRIPE",
      paymentUrl: paymentLink.url,
    };
  } catch (err: any) {
    throw new Error(`Error al crear link de pago Stripe: ${err.message}`);
  }
}

/**
 * Genera link de pago vía PagosPy.
 * Placeholder para integración con pasarelapy.com o similar.
 */
async function generatePagosPyLink(
  facturaId: string,
  monto: number,
  _tenantSlug: string,
): Promise<PaymentLinkResult> {
  const apiKey = env.PAGOSPY_API_KEY;
  const apiUrl = env.PAGOSPY_API_URL;

  if (!apiKey) {
    // Modo desarrollo: mock con warning
    if (process.env["NODE_ENV"] === "production") {
      throw new ValidationError(
        "PAGOSPY_API_KEY no configurado. Configure la variable de entorno para pagos online en producción."
      );
    }
    console.warn(
      "[online-payment] ⚠️  MODO DESARROLLO — Link de pago PAGOS_PY simulado. " +
      "Configure PAGOSPY_API_KEY para pagos reales."
    );
    return {
      facturaId,
      provider: "PAGOS_PY",
      paymentUrl: `/dashboard/facturas/${facturaId}/pago?provider=pagospy&mock=true`,
    };
  }

  // En producción: llamar a API de PagosPy
  try {
    const response = await fetch(`${apiUrl}/checkout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        monto: monto.toFixed(0),
        moneda: "PYG",
        descripcion: `Factura #${facturaId.slice(0, 8)} - AutomotiveOS`,
        referencia: facturaId,
        url_retorno: `${env.APP_URL || "http://localhost:3000"}/dashboard/facturas/${facturaId}`,
        url_notificacion: `${env.APP_URL || "http://localhost:3000"}/finance/payments/webhook/pagospy`,
      }),
    });

    const data = await response.json() as Record<string, any>;
    return {
      facturaId,
      provider: "PAGOS_PY",
      paymentUrl: data.checkout_url ?? data.url ?? data.redirect_url,
      expiresAt: data.expires_at,
    };
  } catch (err: any) {
    throw new Error(`Error al crear link de pago PagosPy: ${err.message}`);
  }
}

/**
 * Procesa webhook de pago online.
 * Soporta Stripe y PagosPy.
 * Marca la factura como pagada y registra el movimiento.
 */
export async function processPaymentWebhook(
  provider: string,
  payload: Record<string, any>,
): Promise<{ ok: boolean; facturaId?: string }> {
  try {
    let facturaId: string | undefined;
    let monto = 0;

    if (provider === "STRIPE") {
      // Stripe webhook: checkout.session.completed
      const session = payload.data?.object ?? payload;
      facturaId = session.client_reference_id ?? session.metadata?.facturaId;
      monto = (session.amount_total ?? session.amount_subtotal ?? 0) / 100;
    } else if (provider === "PAGOS_PY") {
      // PagosPy webhook
      const pPayload = payload as Record<string, any>;
      facturaId = pPayload.referencia;
      monto = Number(pPayload.monto ?? 0);
    }

    if (!facturaId || monto <= 0) {
      return { ok: false };
    }

    // Find the invoice by ID (we need tenantSlug)
    // Since the webhook doesn't carry tenantSlug, look it up from the invoice
    const [factura] = await db()
      .select({ tenantSlug: facturas.tenantSlug })
      .from(facturas)
      .where(eq(facturas.id, facturaId))
      .limit(1);

    if (!factura?.tenantSlug) return { ok: false };

    // Resolve default bank account for the tenant
    const [defaultAccount] = await db()
      .select({ id: cuentasBancarias.id })
      .from(cuentasBancarias)
      .where(and(
        eq(cuentasBancarias.tenantSlug, factura.tenantSlug),
        eq(cuentasBancarias.activo, true),
      ))
      .limit(1);

    if (!defaultAccount) {
      console.error(`[online-payment] No cuenta bancaria activa encontrada para tenant ${factura.tenantSlug}`);
      return { ok: false };
    }

    // Register payment via existing payment service
    await registerPayment({
      facturaId,
      monto,
      medioPago: provider === "STRIPE" ? "TARJETA_CREDITO" : "TRANSFERENCIA",
      cuentaId: defaultAccount.id,
      concepto: `Pago online vía ${provider}`,
      tenantSlug: factura.tenantSlug,
    });

    return { ok: true, facturaId };
  } catch (err) {
    console.error(`[online-payment] Webhook error (${provider}):`, err);
    return { ok: false };
  }
}
