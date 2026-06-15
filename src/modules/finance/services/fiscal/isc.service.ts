/**
 * Formulario 130 (ISC — Impuesto Selectivo al Consumo) — Service.
 *
 * Grava productos específicos: combustibles, tabaco, bebidas alcohólicas,
 * y bienes suntuarios. Se declara mensualmente por cada rubro.
 *
 *   ISC = Base Imponible × Tasa (PORCENTUAL)
 *   ISC = Cantidad × Tasa (ESPECIFICA)
 *
 * @module finance/services/fiscal/isc.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { sql, eq } from "drizzle-orm";
import { liquidacionesIsc, periodosFiscales } from "../../schema/index.js";
import { ValidationError } from "../../../../shared/errors/app-error.js";
import type { CalcularIscRequest, IscResult } from "../../types.js";

/**
 * Calcula la liquidación de ISC (Formulario 130) para un rubro.
 *
 * @param req - Período, rubro, base imponible, tasa
 * @param tenantSlug - Tenant slug
 */
export async function calcularIsc(
  req: CalcularIscRequest,
  tenantSlug: string,
): Promise<IscResult> {
  const {
    anho, mes, rubro,
    cantidad = 0, unidadMedida = "UNIDAD",
    baseImponible, tasa,
    tipoTasa = "PORCENTUAL",
    creditos = 0,
  } = req;

  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  // Calcular ISC según tipo de tasa
  const impuestoIsc = tipoTasa === "ESPECIFICA"
    ? cantidad * tasa       // Gs. por unidad
    : baseImponible * tasa; // Porcentaje ad-valorem

  const saldoPagarIsc = Math.max(0, impuestoIsc - creditos);

  // Registrar período fiscal
  const [periodo] = await db()
    .insert(periodosFiscales)
    .values({ formulario: "FORM_130_ISC", anho, mes, estado: "BORRADOR", tenantSlug })
    .onConflictDoUpdate({
      target: [periodosFiscales.formulario, periodosFiscales.anho, periodosFiscales.mes, periodosFiscales.tenantSlug],
      set: { updatedAt: sql`NOW()` },
    })
    .returning();

  const alertas: string[] = [];
  if (creditos > impuestoIsc) {
    alertas.push(`Créditos (Gs. ${creditos.toFixed(0)}) exceden el impuesto calculado (Gs. ${impuestoIsc.toFixed(0)}). Saldo a favor generado.`);
  }

  const [liquidacion] = await db()
    .insert(liquidacionesIsc)
    .values({
      periodoFiscalId: periodo.id,
      rubro,
      cantidad: cantidad.toFixed(2),
      unidadMedida,
      baseImponible: baseImponible.toFixed(2),
      tasaAplicada: tasa.toFixed(2),
      tipoTasa,
      impuestoIsc: impuestoIsc.toFixed(2),
      creditosIsc: creditos.toFixed(2),
      saldoPagarIsc: saldoPagarIsc.toFixed(2),
      alertas: alertas.length > 0 ? JSON.stringify(alertas) : null,
      tenantSlug,
    })
    .returning();

  return {
    periodo: { anho, mes },
    rubro,
    periodoFiscalId: periodo.id,
    liquidacionId: liquidacion.id,
    cantidad: cantidad.toFixed(2),
    unidadMedida,
    baseImponible: baseImponible.toFixed(2),
    tasaAplicada: tasa.toFixed(2),
    tipoTasa,
    impuestoIsc: impuestoIsc.toFixed(2),
    creditosIsc: creditos.toFixed(2),
    saldoPagar: saldoPagarIsc.toFixed(2),
    alertas,
  };
}

/**
 * Lista histórico de liquidaciones ISC.
 */
export async function listarLiquidacionesIsc(
  tenantSlug: string,
  limit = 12,
) {
  return db()
    .select({
      id: liquidacionesIsc.id,
      periodoFiscalId: liquidacionesIsc.periodoFiscalId,
      anho: periodosFiscales.anho,
      mes: periodosFiscales.mes,
      rubro: liquidacionesIsc.rubro,
      baseImponible: liquidacionesIsc.baseImponible,
      impuestoIsc: liquidacionesIsc.impuestoIsc,
      saldoPagar: liquidacionesIsc.saldoPagarIsc,
      tenantSlug: liquidacionesIsc.tenantSlug,
      createdAt: liquidacionesIsc.createdAt,
    })
    .from(liquidacionesIsc)
    .innerJoin(periodosFiscales, eq(liquidacionesIsc.periodoFiscalId, periodosFiscales.id))
    .where(eq(liquidacionesIsc.tenantSlug, tenantSlug))
    .orderBy(sql`${periodosFiscales.anho} DESC, ${periodosFiscales.mes} DESC`)
    .limit(limit);
}
