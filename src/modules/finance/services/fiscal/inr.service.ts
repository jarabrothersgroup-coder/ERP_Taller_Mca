/**
 * Formulario 515 (INR — Impuesto a la Renta de No Residentes) — Service.
 *
 * Grava las rentas obtenidas por entidades del exterior pagadas por
 * contribuyentes locales. Se declara mensualmente por cada tipo de renta.
 *
 *   INR = Monto Bruto × Tasa de Retención
 *
 * @module finance/services/fiscal/inr.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { sql, eq } from "drizzle-orm";
import { liquidacionesInr, periodosFiscales } from "../../schema/index.js";
import { ValidationError } from "../../../../shared/errors/app-error.js";
import type { CalcularInrRequest, InrResult } from "../../types.js";

/** Tasas de retención INR por defecto según tipo de renta */
const TASAS_INR: Record<string, number> = {
  SERVICIOS_TECNICOS: 0.15,  // 15% — asistencia técnica
  REGALIAS: 0.30,            // 30% — regalías y derechos
  INTERESES: 0.15,           // 15% — intereses
  DIVIDENDOS: 0.15,          // 15% — dividendos al exterior
  OTROS: 0.15,               // 15% — otras rentas
};

/**
 * Calcula la retención de INR (Formulario 515).
 *
 * @param req - Período, tipo de renta, monto bruto
 * @param tenantSlug - Tenant slug
 */
export async function calcularInr(
  req: CalcularInrRequest,
  tenantSlug: string,
): Promise<InrResult> {
  const {
    anho, mes, tipoRenta,
    beneficiarioNombre = "", beneficiarioPais = "",
    montoBruto, tasaRetencion,
  } = req;

  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const tasa = TASAS_INR[tipoRenta] ?? tasaRetencion;
  const impuestoInr = montoBruto * tasa;
  const saldoPagarInr = impuestoInr;

  const [periodo] = await db()
    .insert(periodosFiscales)
    .values({ formulario: "FORM_515_INR", anho, mes, estado: "BORRADOR", tenantSlug })
    .onConflictDoUpdate({
      target: [periodosFiscales.formulario, periodosFiscales.anho, periodosFiscales.mes, periodosFiscales.tenantSlug],
      set: { updatedAt: sql`NOW()` },
    })
    .returning();

  const [liquidacion] = await db()
    .insert(liquidacionesInr)
    .values({
      periodoFiscalId: periodo.id,
      tipoRenta,
      beneficiarioNombre,
      beneficiarioPais,
      montoBruto: montoBruto.toFixed(2),
      tasaRetencion: tasa.toFixed(2),
      impuestoInr: impuestoInr.toFixed(2),
      saldoPagarInr: saldoPagarInr.toFixed(2),
      alertas: null,
      tenantSlug,
    })
    .returning();

  return {
    periodo: { anho, mes },
    tipoRenta,
    beneficiarioNombre,
    beneficiarioPais,
    periodoFiscalId: periodo.id,
    liquidacionId: liquidacion.id,
    montoBruto: montoBruto.toFixed(2),
    tasaRetencion: tasa.toFixed(2),
    impuestoInr: impuestoInr.toFixed(2),
    saldoPagar: saldoPagarInr.toFixed(2),
    alertas: [],
  };
}

/**
 * Lista histórico de liquidaciones INR.
 */
export async function listarLiquidacionesInr(
  tenantSlug: string,
  limit = 12,
) {
  return db()
    .select({
      id: liquidacionesInr.id,
      periodoFiscalId: liquidacionesInr.periodoFiscalId,
      anho: periodosFiscales.anho,
      mes: periodosFiscales.mes,
      tipoRenta: liquidacionesInr.tipoRenta,
      beneficiarioNombre: liquidacionesInr.beneficiarioNombre,
      montoBruto: liquidacionesInr.montoBruto,
      impuestoInr: liquidacionesInr.impuestoInr,
      tenantSlug: liquidacionesInr.tenantSlug,
      createdAt: liquidacionesInr.createdAt,
    })
    .from(liquidacionesInr)
    .innerJoin(periodosFiscales, eq(liquidacionesInr.periodoFiscalId, periodosFiscales.id))
    .where(eq(liquidacionesInr.tenantSlug, tenantSlug))
    .orderBy(sql`${periodosFiscales.anho} DESC, ${periodosFiscales.mes} DESC`)
    .limit(limit);
}
