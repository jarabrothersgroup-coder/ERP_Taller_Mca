/**
 * Formulario 120 (IVA Mensual) — Service.
 *
 * Extrae del módulo contable y de documentos fiscales los datos
 * necesarios para liquidar el IVA mensual conforme a la DNIT.
 *
 * Flujo:
 *   1. Obtener Débito Fiscal desde facturas emitidas (fiscal_documentos)
 *   2. Obtener Crédito Fiscal desde compras registradas (asientos contables)
 *   3. Calcular liquidación: Débito - Crédito = Resultado
 *   4. Persistir en liquidaciones_iva
 *   5. Generar alertas de pre-auditoría
 *
 * @module finance/services/fiscal/form120.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import {
  fiscalDocumentos,
  asientosContables,
  asientosDetalle,
  planCuentas,
  periodosFiscales,
  liquidacionesIva,
} from "../../schema/index.js";
import { ValidationError } from "../../../../shared/errors/app-error.js";
import type { CalcularForm120Request, Form120Result } from "../../types.js";

// ─── Core ──────────────────────────────────────

/**
 * Calcula la liquidación de IVA (Formulario 120) para un período.
 *
 * 1. Agrega facturas emitidas (APROBADAS) del mes → Débito Fiscal
 * 2. Agrega compras del mes desde asientos contables → Crédito Fiscal
 * 3. Calcula resultado y genera alertas
 *
 * @param req - Período a liquidar
 * @param tenantSlug - Tenant slug del taller
 * @throws {ValidationError} Si el período es inválido
 */
export async function calcularForm120(
  req: CalcularForm120Request,
  tenantSlug: string,
): Promise<Form120Result> {
  const { anho, mes } = req;

  // ── 1. Validar período ──
  if (anho < 2020 || anho > 2100) {
    throw new ValidationError("Año inválido. Debe ser entre 2020 y 2100");
  }
  if (mes < 1 || mes > 12) {
    throw new ValidationError("Mes inválido. Debe ser entre 1 y 12");
  }

  const desde = new Date(anho, mes - 1, 1);
  const hasta = new Date(anho, mes, 0, 23, 59, 59);

  // ── 2. Registrar/recuperar período fiscal ──
  const [periodo] = await db()
    .insert(periodosFiscales)
    .values({
      formulario: "FORM_120_IVA",
      anho,
      mes,
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

  // ── 3. Extraer Débito Fiscal (Rubro 1) ──
  // De fiscal_documentos: facturas electrónicas emitidas y aprobadas
  const [ventas] = await db()
    .select({
      gravada10: sql<string>`COALESCE(SUM(total_iva_10), 0)`,
      iva10: sql<string>`COALESCE(SUM(total_iva * CASE WHEN total_iva_10 > 0 THEN 1 ELSE 0 END), 0)`,
      gravada5: sql<string>`COALESCE(SUM(total_iva_5), 0)`,
      iva5: sql<string>`COALESCE(SUM(total_iva * CASE WHEN total_iva_5 > 0 THEN 1 ELSE 0 END), 0)`,
      exenta: sql<string>`COALESCE(SUM(total_exento), 0)`,
      total: sql<string>`COALESCE(SUM(total_documento), 0)`,
    })
    .from(fiscalDocumentos)
    .where(
      and(
        eq(fiscalDocumentos.dteTipo, "FACTURA"),
        eq(fiscalDocumentos.estado, "APROBADO"),
        gte(fiscalDocumentos.fechaEmision, desde),
        lte(fiscalDocumentos.fechaEmision, hasta),
        eq(fiscalDocumentos.activo, true),
      ),
    );

  // ── 4. Extraer Crédito Fiscal (Rubro 2) ──
  // Desde asientos contables de compras/proveedores:
  // Busca asientos donde modulo_origen indique compra y las cuentas sean de COSTO (5.x)
  // Nota: el Crédito Fiscal real requiere registrar compras con IVA desglosado.
  // Por ahora se toma el debe de cuentas de COSTO como base imponible estimada.
  const [comprasDb] = await db()
    .select({
      gravada10: sql<string>`COALESCE(SUM(CASE WHEN ${planCuentas.codigo} LIKE '1.1.3%' THEN ${asientosDetalle.debe} ELSE 0::numeric END), 0)`,
      iva10: sql<string>`0`,
      gravada5: sql<string>`0`,
      iva5: sql<string>`0`,
      otras: sql<string>`COALESCE(SUM(CASE WHEN ${planCuentas.codigo} NOT LIKE '1.1.3%' THEN ${asientosDetalle.debe} ELSE 0::numeric END), 0)`,
    })
    .from(asientosDetalle)
    .innerJoin(
      asientosContables,
      eq(asientosDetalle.asientoId, asientosContables.id),
    )
    .innerJoin(
      planCuentas,
      eq(asientosDetalle.cuentaId, planCuentas.id),
    )
    .where(
      and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        sql`${asientosContables.moduloOrigen} = 'INVENTARIO'`,
        sql`${asientosDetalle.debe} IS NOT NULL`,
      ),
    );

  // ── 5. Calcular valores ──
  const vGravada10 = parseFloat(ventas?.gravada10 ?? "0");
  const vIva10 = parseFloat(ventas?.iva10 ?? "0");
  const vGravada5 = parseFloat(ventas?.gravada5 ?? "0");
  const vIva5 = parseFloat(ventas?.iva5 ?? "0");
  const vExenta = parseFloat(ventas?.exenta ?? "0");
  const vTotal = parseFloat(ventas?.total ?? "0");

  const cGravada10 = parseFloat(comprasDb?.gravada10 ?? "0");
  const cIva10 = parseFloat(comprasDb?.iva10 ?? "0");
  const cGravada5 = parseFloat(comprasDb?.gravada5 ?? "0");
  const cIva5 = parseFloat(comprasDb?.iva5 ?? "0");
  const cOtras = parseFloat(comprasDb?.otras ?? "0");
  const cTotal = cGravada10 + cGravada5 + cOtras;

  const ivaDebito = vIva10 + vIva5;
  const ivaCredito = cIva10 + cIva5;
  const resultado = ivaDebito - ivaCredito;
  const ivaAPagar = resultado > 0 ? resultado : 0;
  const saldoFavor = resultado < 0 ? Math.abs(resultado) : 0;

  // ── 6. Obtener saldo arrastre del período anterior ──
  let saldoArrastre = 0;
  if (mes > 1) {
    const [periodoAnterior] = await db()
      .select({ sl: liquidacionesIva.saldoFavor })
      .from(liquidacionesIva)
      .innerJoin(
        periodosFiscales,
        eq(liquidacionesIva.periodoFiscalId, periodosFiscales.id),
      )
      .where(
        and(
          eq(periodosFiscales.formulario, "FORM_120_IVA"),
          eq(periodosFiscales.anho, anho),
          eq(periodosFiscales.mes, mes - 1),
          eq(periodosFiscales.tenantSlug, tenantSlug),
        ),
      )
      .orderBy(sql`${liquidacionesIva.createdAt} DESC`)
      .limit(1);

    if (periodoAnterior) {
      saldoArrastre = parseFloat(periodoAnterior.sl ?? "0");
    }
  }

  // ── 7. Generar alertas ──
  const alertas: string[] = [];

  // Alerta 1: IVA Débito fiscal vs contable
  const [debitoContable] = await db()
    .select({
      total: sql<string>`COALESCE(SUM(${asientosDetalle.haber}), 0)`,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .innerJoin(planCuentas, eq(asientosDetalle.cuentaId, planCuentas.id))
    .where(
      and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        sql`${planCuentas.codigo} LIKE '4.1.%'`,
        sql`${asientosDetalle.haber} IS NOT NULL`,
      ),
    );

  const ingresosContables = parseFloat(debitoContable?.total ?? "0");
  const ingresosFiscales = vGravada10 + vGravada5 + vExenta;
  if (Math.abs(ingresosContables - ingresosFiscales) > 1000) {
    alertas.push(
      `Diferencia entre ingresos contables (Gs. ${ingresosContables.toFixed(0)}) ` +
      `e ingresos fiscales (Gs. ${ingresosFiscales.toFixed(0)}). ` +
      `Revise que todas las facturas estén contabilizadas.`,
    );
  }

  // Alerta 2: Prorrateo si hay ventas exentas
  let prorrateoIndice: number | null = null;
  if (vExenta > 0 && vTotal > 0) {
    const indice = (vGravada10 + vGravada5) / vTotal;
    prorrateoIndice = Math.round(indice * 10000) / 10000;
    alertas.push(
      `Ventas exentas detectadas (Gs. ${vExenta.toFixed(0)}). ` +
      `Índice de prorrateo: ${(prorrateoIndice * 100).toFixed(2)}%. ` +
      `El IVA Crédito debe aplicarse sobre este porcentaje.`,
    );
  }

  // ── 8. Persistir liquidación ──
  const [liquidacion] = await db()
    .insert(liquidacionesIva)
    .values({
      periodoFiscalId: periodo.id,
      ventasGravada10: vGravada10.toFixed(2),
      ventasIva10: vIva10.toFixed(2),
      ventasGravada5: vGravada5.toFixed(2),
      ventasIva5: vIva5.toFixed(2),
      ventasExenta: vExenta.toFixed(2),
      ventasTotal: vTotal.toFixed(2),
      comprasGravada10: cGravada10.toFixed(2),
      comprasIva10: cIva10.toFixed(2),
      comprasGravada5: cGravada5.toFixed(2),
      comprasIva5: cIva5.toFixed(2),
      comprasOtras: cOtras.toFixed(2),
      comprasTotal: cTotal.toFixed(2),
      ivaDebito: ivaDebito.toFixed(2),
      ivaCredito: ivaCredito.toFixed(2),
      ivaAPagar: ivaAPagar.toFixed(2),
      saldoFavor: saldoFavor.toFixed(2),
      prorrateoIndice: prorrateoIndice?.toFixed(4) ?? null,
      saldoArrastre: saldoArrastre.toFixed(2),
      alertas: alertas.length > 0 ? JSON.stringify(alertas) : null,
      tenantSlug,
    })
    .returning();

  // ── 9. Return result ──
  return {
    periodo: { anho, mes },
    periodoFiscalId: periodo.id,
    liquidacionId: liquidacion.id,
    ventas: {
      gravada10: vGravada10.toFixed(2),
      iva10: vIva10.toFixed(2),
      gravada5: vGravada5.toFixed(2),
      iva5: vIva5.toFixed(2),
      exenta: vExenta.toFixed(2),
      total: vTotal.toFixed(2),
    },
    compras: {
      gravada10: cGravada10.toFixed(2),
      iva10: cIva10.toFixed(2),
      gravada5: cGravada5.toFixed(2),
      iva5: cIva5.toFixed(2),
      otras: cOtras.toFixed(2),
      total: cTotal.toFixed(2),
    },
    ivaDebito: ivaDebito.toFixed(2),
    ivaCredito: ivaCredito.toFixed(2),
    ivaAPagar: ivaAPagar.toFixed(2),
    saldoFavor: saldoFavor.toFixed(2),
    prorrateoIndice: prorrateoIndice?.toFixed(4) ?? null,
    saldoArrastre: saldoArrastre.toFixed(2),
    alertas,
  };
}

/**
 * Obtiene el histórico de liquidaciones de IVA para un tenant.
 *
 * @param tenantSlug - Tenant slug
 * @param limit - Máximo de registros (default 12)
 */
export async function listarLiquidacionesIva(
  tenantSlug: string,
  limit = 12,
) {
  return db()
    .select({
      id: liquidacionesIva.id,
      periodoFiscalId: liquidacionesIva.periodoFiscalId,
      anho: periodosFiscales.anho,
      mes: periodosFiscales.mes,
      estado: periodosFiscales.estado,
      ivaDebito: liquidacionesIva.ivaDebito,
      ivaCredito: liquidacionesIva.ivaCredito,
      ivaAPagar: liquidacionesIva.ivaAPagar,
      saldoFavor: liquidacionesIva.saldoFavor,
      tenantSlug: liquidacionesIva.tenantSlug,
      createdAt: liquidacionesIva.createdAt,
    })
    .from(liquidacionesIva)
    .innerJoin(
      periodosFiscales,
      eq(liquidacionesIva.periodoFiscalId, periodosFiscales.id),
    )
    .where(eq(liquidacionesIva.tenantSlug, tenantSlug))
    .orderBy(sql`${periodosFiscales.anho} DESC, ${periodosFiscales.mes} DESC`)
    .limit(limit);
}

/**
 * Calcula el prorrateo de IVA para un período.
 *
 * Fórmula: Índice = Ventas Gravadas / Ventas Totales
 *
 * Este índice se aplica al IVA Crédito de compras de uso mixto
 * (bienes/servicios afectados tanto a operaciones gravadas como exentas).
 *
 * @param anho - Año fiscal
 * @param mes - Mes fiscal
 * @param tenantSlug - Tenant slug
 * @returns Índice de prorrateo (0.0000 a 1.0000)
 */
export async function calcularProrrateoIva(
  anho: number,
  mes: number,
  _tenantSlug: string,
): Promise<number | null> {
  const desde = new Date(anho, mes - 1, 1);
  const hasta = new Date(anho, mes, 0, 23, 59, 59);

  const [ventas] = await db()
    .select({
      gravadas: sql<string>`COALESCE(SUM(total_iva_10 + total_iva_5), 0)`,
      exentas: sql<string>`COALESCE(SUM(total_exento), 0)`,
      total: sql<string>`COALESCE(SUM(total_documento), 0)`,
    })
    .from(fiscalDocumentos)
    .where(
      and(
        eq(fiscalDocumentos.dteTipo, "FACTURA"),
        eq(fiscalDocumentos.estado, "APROBADO"),
        gte(fiscalDocumentos.fechaEmision, desde),
        lte(fiscalDocumentos.fechaEmision, hasta),
        eq(fiscalDocumentos.activo, true),
      ),
    );

  const gravadas = parseFloat(ventas?.gravadas ?? "0");
  const total = parseFloat(ventas?.total ?? "0");

  if (total === 0) return null;
  const indice = gravadas / total;
  return Math.round(indice * 10000) / 10000;
}
