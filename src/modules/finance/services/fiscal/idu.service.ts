/**
 * Formulario 520 (IDU — Impuesto a los Dividendos y Utilidades) — Service.
 *
 * Calcula el impuesto sobre las utilidades distribuidas a socios/accionistas,
 * tomando como base la Renta Neta del IRE (Formulario 500).
 *
 *   Utilidad Distribuible = Renta Neta (IRE) − IRE − Reserva Legal
 *   IDU = Utilidad Efectiva × Tasa (8% residentes / 15% no residentes)
 *
 * @module finance/services/fiscal/idu.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { sql, eq, and, desc } from "drizzle-orm";
import {
  liquidacionesIre,
  liquidacionesIdu,
  periodosFiscales,
} from "../../schema/index.js";
import { ValidationError, NotFoundError } from "../../../../shared/errors/app-error.js";
import type { CalcularIduRequest, IduResult } from "../../types.js";

// ─── Constants ──────────────────────────────────

const TASA_IDU_RESIDENTE = 0.08;     // 8% — Ley 6380/19 arts. 6-7
const TASA_IDU_NO_RESIDENTE = 0.15;   // 15% — Ley 6380/19 art. 8

// ─── Core ──────────────────────────────────────

/**
 * Calcula la liquidación de IDU (Formulario 520).
 *
 * @param req - Año + tipo beneficiario + opcional % distribución + referencia IRE
 * @param tenantSlug - Tenant slug del taller
 * @throws {ValidationError} Si el año es inválido
 * @throws {NotFoundError} Si no hay liquidación IRE para el año
 */
export async function calcularIdu(
  req: CalcularIduRequest,
  tenantSlug: string,
): Promise<IduResult> {
  const { anho, tipoBeneficiario = "RESIDENTE", porcentajeDistribuido = 1, liquidacionIreId } = req;

  // ── 1. Validar ──
  if (anho < 2020 || anho > 2100) {
    throw new ValidationError("Año inválido. Debe ser entre 2020 y 2100");
  }

  const tasaAplicada = tipoBeneficiario === "NO_RESIDENTE"
    ? TASA_IDU_NO_RESIDENTE
    : TASA_IDU_RESIDENTE;

  const pct = Math.min(1, Math.max(0.01, porcentajeDistribuido));

  // ── 2. Obtener liquidación IRE base ──
  let liquidacionIre;

  if (liquidacionIreId) {
    // Usar liquidación específica
    [liquidacionIre] = await db()
      .select({
        id: liquidacionesIre.id,
        rentaNeta: liquidacionesIre.rentaNeta,
        impuestoIre: liquidacionesIre.impuestoIre,
        reservaLegal: liquidacionesIre.reservaLegal,
        periodoId: liquidacionesIre.periodoFiscalId,
      })
      .from(liquidacionesIre)
      .where(
        and(
          eq(liquidacionesIre.id, liquidacionIreId),
          eq(liquidacionesIre.tenantSlug, tenantSlug),
        ),
      );
  } else {
    // Buscar última liquidación Form 500 del año
    [liquidacionIre] = await db()
      .select({
        id: liquidacionesIre.id,
        rentaNeta: liquidacionesIre.rentaNeta,
        impuestoIre: liquidacionesIre.impuestoIre,
        reservaLegal: liquidacionesIre.reservaLegal,
        periodoId: liquidacionesIre.periodoFiscalId,
      })
      .from(liquidacionesIre)
      .innerJoin(
        periodosFiscales,
        eq(liquidacionesIre.periodoFiscalId, periodosFiscales.id),
      )
      .where(
        and(
          eq(periodosFiscales.formulario, "FORM_500_IRE"),
          eq(periodosFiscales.anho, anho),
          eq(periodosFiscales.mes, 0),
          eq(liquidacionesIre.tenantSlug, tenantSlug),
        ),
      )
      .orderBy(desc(liquidacionesIre.createdAt))
      .limit(1);
  }

  if (!liquidacionIre) {
    throw new NotFoundError(
      `No se encontró liquidación de IRE (Form 500) para el año ${anho}. ` +
      `Calcule el Form 500 primero con POST /finance/fiscal/ire/calcular`,
    );
  }

  const rentaNetaBase = parseFloat(liquidacionIre.rentaNeta ?? "0");
  const impuestoIrePagado = parseFloat(liquidacionIre.impuestoIre ?? "0");
  const reservaLegalBase = parseFloat(liquidacionIre.reservaLegal ?? "0");

  // ── 3. Calcular ──
  const utilidadDistribuible = Math.max(0, rentaNetaBase - impuestoIrePagado - reservaLegalBase);
  const utilidadEfectiva = utilidadDistribuible * pct;
  const impuestoIdu = utilidadEfectiva * tasaAplicada;
  const retencionesIdu = 0; // Placeholder
  const saldoPagarIdu = Math.max(0, impuestoIdu - retencionesIdu);
  const saldoFavorIdu = Math.max(0, retencionesIdu - impuestoIdu);

  // ── 4. Registrar período fiscal ──
  const [periodo] = await db()
    .insert(periodosFiscales)
    .values({
      formulario: "FORM_520_IDU",
      anho,
      mes: 0,
      estado: "BORRADOR",
      tenantSlug,
    })
    .onConflictDoUpdate({
      target: [
        periodosFiscales.formulario,
        periodosFiscales.anho,
        periodosFiscales.mes,
        periodosFiscales.tenantSlug,
      ],
      set: { updatedAt: sql`NOW()` },
    })
    .returning();

  // ── 5. Generar alertas ──
  const alertas: string[] = [];
  if (rentaNetaBase === 0) {
    alertas.push("La Renta Neta base es cero. Verifique la liquidación de IRE (Form 500).");
  }
  if (utilidadDistribuible <= 0) {
    alertas.push(
      "No hay utilidad distribuible (Renta Neta − IRE − Reserva Legal ≤ 0). " +
      "No procede el IDU.",
    );
  }
  if (pct < 1) {
    alertas.push(`Se distribuye solo el ${(pct * 100).toFixed(2)}% de las utilidades.`);
  }

  // ── 6. Persistir ──
  const [liquidacion] = await db()
    .insert(liquidacionesIdu)
    .values({
      periodoFiscalId: periodo.id,
      liquidacionIreId: liquidacionIre.id,
      tipoBeneficiario,
      tasaAplicada: tasaAplicada.toFixed(4),
      rentaNetaBase: rentaNetaBase.toFixed(2),
      impuestoIrePagado: impuestoIrePagado.toFixed(2),
      reservaLegalBase: reservaLegalBase.toFixed(2),
      utilidadDistribuible: utilidadDistribuible.toFixed(2),
      porcentajeDistribuido: pct.toFixed(4),
      utilidadEfectiva: utilidadEfectiva.toFixed(2),
      impuestoIdu: impuestoIdu.toFixed(2),
      retencionesIdu: retencionesIdu.toFixed(2),
      saldoPagarIdu: saldoPagarIdu.toFixed(2),
      saldoFavorIdu: saldoFavorIdu.toFixed(2),
      alertas: alertas.length > 0 ? JSON.stringify(alertas) : null,
      tenantSlug,
    })
    .returning();

  // ── 7. Return ──
  return {
    periodo: { anho },
    tipoBeneficiario,
    tasaAplicada: tasaAplicada.toFixed(2),
    periodoFiscalId: periodo.id,
    liquidacionId: liquidacion.id,
    liquidacionIreId: liquidacionIre.id,
    rentaNetaBase: rentaNetaBase.toFixed(2),
    impuestoIrePagado: impuestoIrePagado.toFixed(2),
    reservaLegalBase: reservaLegalBase.toFixed(2),
    utilidadDistribuible: utilidadDistribuible.toFixed(2),
    porcentajeDistribuido: pct.toFixed(4),
    utilidadEfectiva: utilidadEfectiva.toFixed(2),
    impuestoIdu: impuestoIdu.toFixed(2),
    retencionesIdu: retencionesIdu.toFixed(2),
    saldoPagar: saldoPagarIdu.toFixed(2),
    saldoFavor: saldoFavorIdu.toFixed(2),
    alertas,
  };
}

/**
 * Lista el histórico de liquidaciones de IDU para un tenant.
 *
 * @param tenantSlug - Tenant slug
 * @param limit - Máximo de registros (default 5)
 */
export async function listarLiquidacionesIdu(
  tenantSlug: string,
  limit = 5,
) {
  return db()
    .select({
      id: liquidacionesIdu.id,
      periodoFiscalId: liquidacionesIdu.periodoFiscalId,
      liquidacionIreId: liquidacionesIdu.liquidacionIreId,
      anho: periodosFiscales.anho,
      estado: periodosFiscales.estado,
      rentaNetaBase: liquidacionesIdu.rentaNetaBase,
      utilidadDistribuible: liquidacionesIdu.utilidadDistribuible,
      impuestoIdu: liquidacionesIdu.impuestoIdu,
      saldoPagar: liquidacionesIdu.saldoPagarIdu,
      tenantSlug: liquidacionesIdu.tenantSlug,
      createdAt: liquidacionesIdu.createdAt,
    })
    .from(liquidacionesIdu)
    .innerJoin(
      periodosFiscales,
      eq(liquidacionesIdu.periodoFiscalId, periodosFiscales.id),
    )
    .where(eq(liquidacionesIdu.tenantSlug, tenantSlug))
    .orderBy(sql`${periodosFiscales.anho} DESC`)
    .limit(limit);
}
