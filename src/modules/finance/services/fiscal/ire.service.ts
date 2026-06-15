/**
 * Formulario 500/501/502 (IRE — Impuesto a la Renta Empresarial) — Service.
 *
 * Calcula el Impuesto a la Renta Empresarial anual conforme a la
 * Ley 1034/83 y modificaciones del Régimen de Factura Electrónica:
 *
 *   Form 500 (IRE General):
 *     Renta Neta = Ingresos Brutos − Costos − Gastos Deducibles
 *     IRE = Renta Neta × 10%
 *     Reserva Legal = Renta Neta × 5%
 *
 *   Form 501 (IRE Simple):
 *     Renta neta simplificada (presunción sobre ingresos brutos)
 *
 *   Form 502 (IRE Resimple):
 *     Régimen simplificado para microempresas
 *
 * @module finance/services/fiscal/ire.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import {
  asientosContables,
  asientosDetalle,
  planCuentas,
  periodosFiscales,
  liquidacionesIre,
} from "../../schema/index.js";
import { ValidationError } from "../../../../shared/errors/app-error.js";
import type { CalcularIreRequest, IreResult } from "../../types.js";

// ─── Constants ──────────────────────────────────

const TASA_IRE_GENERAL = 0.10;         // 10% Form 500
const TASA_RESERVA_LEGAL = 0.05;       // 5% Ley 1034/83
const TASA_IRE_SIMPLE = 0.10;          // 10% sobre renta presunta (Form 501)
const TASA_IRE_RESIMPLE = 0.05;        // 5% sobre ingresos brutos (Form 502)

/** Helper: próximo número de asiento para IRE */
async function getNextIreNumero(anho: number): Promise<number> {
  const [max] = await db()
    .select({ max: sql<number>`COALESCE(MAX(numero), 0)` })
    .from(asientosContables)
    .where(sql`EXTRACT(YEAR FROM ${asientosContables.fecha}) = ${anho}`);
  return (max?.max ?? 0) + 1;
}

// ─── Core ──────────────────────────────────────

/**
 * Calcula la liquidación de IRE (Formulario 500/501/502).
 *
 * @param req - Período y formulario
 * @param tenantSlug - Tenant slug del taller
 * @throws {ValidationError} Si el año es inválido
 */
export async function calcularIre(
  req: CalcularIreRequest,
  tenantSlug: string,
): Promise<IreResult> {
  const { anho, formulario } = req;

  // ── 1. Validar ──
  if (anho < 2020 || anho > 2100) {
    throw new ValidationError("Año inválido. Debe ser entre 2020 y 2100");
  }

  const desde = new Date(anho, 0, 1);                      // 01-ene
  const hasta = new Date(anho, 11, 31, 23, 59, 59);        // 31-dic

  // ── 2. Registrar período fiscal (anual, mes=0) ──
  const [periodo] = await db()
    .insert(periodosFiscales)
    .values({
      formulario,
      anho,
      mes: 0, // anual
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

  // ── 3. Extraer Ingresos Brutos ──
  // Haber de cuentas de tipo INGRESO (4.x), asientos CONTABILIZADOS
  const [ingresos] = await db()
    .select({
      servicios: sql<string>`COALESCE(SUM(CASE WHEN ${planCuentas.codigo} LIKE '4.1.1%' THEN ${asientosDetalle.haber} ELSE 0::numeric END), 0)`,
      bienes: sql<string>`COALESCE(SUM(CASE WHEN ${planCuentas.codigo} LIKE '4.1.2%' THEN ${asientosDetalle.haber} ELSE 0::numeric END), 0)`,
      noOperacionales: sql<string>`COALESCE(SUM(CASE WHEN ${planCuentas.codigo} LIKE '4.2%' THEN ${asientosDetalle.haber} ELSE 0::numeric END), 0)`,
      brutos: sql<string>`COALESCE(SUM(${asientosDetalle.haber}), 0)`,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .innerJoin(planCuentas, eq(asientosDetalle.cuentaId, planCuentas.id))
    .where(
      and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        sql`${planCuentas.tipo} = 'INGRESO'`,
        sql`${asientosDetalle.haber} IS NOT NULL`,
        sql`${asientosDetalle.haber} > 0::numeric`,
      ),
    );

  // ── 4. Extraer Costos ──
  const [costos] = await db()
    .select({
      repuestos: sql<string>`COALESCE(SUM(CASE WHEN ${planCuentas.codigo} LIKE '5.1.1%' THEN ${asientosDetalle.debe} ELSE 0::numeric END), 0)`,
      manoObra: sql<string>`COALESCE(SUM(CASE WHEN ${planCuentas.codigo} LIKE '5.1.2%' THEN ${asientosDetalle.debe} ELSE 0::numeric END), 0)`,
      indirectos: sql<string>`COALESCE(SUM(CASE WHEN ${planCuentas.codigo} LIKE '5.1.3%' THEN ${asientosDetalle.debe} ELSE 0::numeric END), 0)`,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .innerJoin(planCuentas, eq(asientosDetalle.cuentaId, planCuentas.id))
    .where(
      and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        sql`${planCuentas.tipo} = 'COSTO'`,
        sql`${asientosDetalle.debe} IS NOT NULL`,
        sql`${asientosDetalle.debe} > 0::numeric`,
      ),
    );

  // ── 5. Extraer Gastos Deducibles ──
  const [gastos] = await db()
    .select({
      administrativos: sql<string>`COALESCE(SUM(CASE WHEN ${planCuentas.codigo} LIKE '6.1%' THEN ${asientosDetalle.debe} ELSE 0::numeric END), 0)`,
      ventas: sql<string>`COALESCE(SUM(CASE WHEN ${planCuentas.codigo} LIKE '6.2%' THEN ${asientosDetalle.debe} ELSE 0::numeric END), 0)`,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .innerJoin(planCuentas, eq(asientosDetalle.cuentaId, planCuentas.id))
    .where(
      and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        sql`${planCuentas.tipo} = 'GASTO'`,
        sql`${asientosDetalle.debe} IS NOT NULL`,
        sql`${asientosDetalle.debe} > 0::numeric`,
      ),
    );

  // ── 6. Parsear valores ──
  const vIngresos = {
    servicios: parseFloat(ingresos?.servicios ?? "0"),
    bienes: parseFloat(ingresos?.bienes ?? "0"),
    noOperacionales: parseFloat(ingresos?.noOperacionales ?? "0"),
    brutos: parseFloat(ingresos?.brutos ?? "0"),
  };

  const vCostos = {
    repuestos: parseFloat(costos?.repuestos ?? "0"),
    manoObra: parseFloat(costos?.manoObra ?? "0"),
    indirectos: parseFloat(costos?.indirectos ?? "0"),
    total: parseFloat(costos?.repuestos ?? "0") + parseFloat(costos?.manoObra ?? "0") + parseFloat(costos?.indirectos ?? "0"),
  };

  const vGastos = {
    administrativos: parseFloat(gastos?.administrativos ?? "0"),
    ventas: parseFloat(gastos?.ventas ?? "0"),
    total: parseFloat(gastos?.administrativos ?? "0") + parseFloat(gastos?.ventas ?? "0"),
  };

  // Deducciones adicionales (placeholder — se poblarán con el módulo de donaciones)
  const donacionesVal = 0;
  const otrasDeduccionesVal = 0;

  // ── 7. Calcular según formulario ──
  let rentaNeta: number;
  let impuestoIre: number;

  switch (formulario) {
    case "FORM_500_IRE": {
      // IRE General: Renta Neta = Ingresos − Costos − Gastos − Deducciones
      rentaNeta = vIngresos.brutos - vCostos.total - vGastos.total - donacionesVal - otrasDeduccionesVal;
      if (rentaNeta < 0) rentaNeta = 0;
      impuestoIre = rentaNeta * TASA_IRE_GENERAL;
      break;
    }
    case "FORM_501_IRE_SIMPLE": {
      // IRE Simple: renta presunta = 30% de ingresos brutos
      const rentaPresunta = vIngresos.brutos * 0.30;
      rentaNeta = rentaPresunta;
      impuestoIre = rentaPresunta * TASA_IRE_SIMPLE;
      break;
    }
    case "FORM_502_IRE_RESIMPLE": {
      // IRE Resimple: tasa directa sobre ingresos brutos
      rentaNeta = vIngresos.brutos;
      impuestoIre = vIngresos.brutos * TASA_IRE_RESIMPLE;
      break;
    }
    default:
      throw new ValidationError(`Formulario IRE no soportado: ${formulario}`);
  }

  const reservaLegal = rentaNeta * TASA_RESERVA_LEGAL;
  const retenciones = 0;   // Placeholder: cargar de retenciones sufridas
  const anticipos = 0;     // Placeholder: cargar anticipos pagados
  const saldoPagar = Math.max(0, impuestoIre - retenciones - anticipos);
  const saldoFavor = Math.max(0, (retenciones + anticipos) - impuestoIre);

  // ── 8. Generar alertas ──
  const alertas: string[] = [];
  if (vCostos.total === 0 && formulario === "FORM_500_IRE") {
    alertas.push("No se registraron costos en el ejercicio. Revise la imputación contable de cuentas COSTO (5.x).");
  }
  if (vGastos.total === 0 && formulario === "FORM_500_IRE") {
    alertas.push("No se registraron gastos en el ejercicio. Revise la imputación contable de cuentas GASTO (6.x).");
  }
  if (vIngresos.brutos === 0) {
    alertas.push("El ejercicio presenta ingresos brutos en cero. Verifique que las cuentas de INGRESO (4.x) estén contabilizadas.");
  }

  // ── 9. Persistir ──
  const [liquidacion] = await db()
    .insert(liquidacionesIre)
    .values({
      periodoFiscalId: periodo.id,
      ingresosServicios: vIngresos.servicios.toFixed(2),
      ingresosBienes: vIngresos.bienes.toFixed(2),
      ingresosNoOperacionales: vIngresos.noOperacionales.toFixed(2),
      ingresosBrutos: vIngresos.brutos.toFixed(2),
      costoRepuestos: vCostos.repuestos.toFixed(2),
      costoManoObra: vCostos.manoObra.toFixed(2),
      costosIndirectos: vCostos.indirectos.toFixed(2),
      totalCostos: vCostos.total.toFixed(2),
      gastosAdministrativos: vGastos.administrativos.toFixed(2),
      gastosVentas: vGastos.ventas.toFixed(2),
      totalGastos: vGastos.total.toFixed(2),
      donaciones: donacionesVal.toFixed(2),
      otrasDeducciones: otrasDeduccionesVal.toFixed(2),
      rentaNeta: rentaNeta.toFixed(2),
      impuestoIre: impuestoIre.toFixed(2),
      reservaLegal: reservaLegal.toFixed(2),
      retenciones: retenciones.toFixed(2),
      anticipos: anticipos.toFixed(2),
      saldoPagar: saldoPagar.toFixed(2),
      saldoFavorIre: saldoFavor.toFixed(2),
      alertas: alertas.length > 0 ? JSON.stringify(alertas) : null,
      tenantSlug,
    })
    .returning();

  // ── 10. Generar asiento contable de IRE ──
  if (saldoPagar > 0 || saldoFavor > 0) {
    const monto = Math.max(saldoPagar, saldoFavor);
    const num = await getNextIreNumero(anho);
    const [ctaGasto] = await db()
      .select({ id: planCuentas.id })
      .from(planCuentas)
      .where(and(sql`${planCuentas.codigo} LIKE '6.5.01%'`, eq(planCuentas.activo, true)))
      .limit(1);
    const [ctaPagar] = await db()
      .select({ id: planCuentas.id })
      .from(planCuentas)
      .where(and(sql`${planCuentas.codigo} LIKE '2.2.01%'`, eq(planCuentas.activo, true)))
      .limit(1);

    if (ctaGasto && ctaPagar) {
      const fechaAsiento = new Date(anho, 11, 31);
      await db().insert(asientosContables).values({
        numero: num,
        fecha: fechaAsiento,
        concepto: `IRE ${formulario.replace(/_/g, " ")} - Ejercicio ${anho} (Calculado: ₲${impuestoIre.toFixed(2)})`,
        estado: "CONTABILIZADO",
        totalDebe: monto.toFixed(2),
        totalHaber: monto.toFixed(2),
        diferencia: "0",
        moduloOrigen: "LIQUIDACION_IRE",
      }).returning();

      const [asientoIre] = await db()
        .insert(asientosContables)
        .values({
          numero: num,
          fecha: fechaAsiento,
          concepto: `IRE ${formulario.replace(/_/g, " ")} - Ejercicio ${anho}`,
          estado: "CONTABILIZADO",
          totalDebe: monto.toFixed(2),
          totalHaber: monto.toFixed(2),
          diferencia: "0",
          moduloOrigen: "LIQUIDACION_IRE",
        })
        .returning();

      await db().insert(asientosDetalle).values([
        { asientoId: asientoIre.id, cuentaId: ctaGasto.id, numeroLinea: 1, debe: monto.toFixed(2), descripcion: `IRE ${anho}` },
        { asientoId: asientoIre.id, cuentaId: ctaPagar.id, numeroLinea: 2, haber: monto.toFixed(2), descripcion: `IRE a Pagar ${anho}` },
      ]);
    }
  }

  // ── 11. Return ──
  return {
    periodo: { anho },
    formulario,
    periodoFiscalId: periodo.id,
    liquidacionId: liquidacion.id,
    ingresos: {
      servicios: vIngresos.servicios.toFixed(2),
      bienes: vIngresos.bienes.toFixed(2),
      noOperacionales: vIngresos.noOperacionales.toFixed(2),
      brutos: vIngresos.brutos.toFixed(2),
    },
    costos: {
      repuestos: vCostos.repuestos.toFixed(2),
      manoObra: vCostos.manoObra.toFixed(2),
      indirectos: vCostos.indirectos.toFixed(2),
      total: vCostos.total.toFixed(2),
    },
    gastos: {
      administrativos: vGastos.administrativos.toFixed(2),
      ventas: vGastos.ventas.toFixed(2),
      total: vGastos.total.toFixed(2),
    },
    donaciones: donacionesVal.toFixed(2),
    otrasDeducciones: otrasDeduccionesVal.toFixed(2),
    totalDeducciones: (donacionesVal + otrasDeduccionesVal).toFixed(2),
    rentaNeta: rentaNeta.toFixed(2),
    impuestoIre: impuestoIre.toFixed(2),
    reservaLegal: reservaLegal.toFixed(2),
    retenciones: retenciones.toFixed(2),
    anticipos: anticipos.toFixed(2),
    saldoPagar: saldoPagar.toFixed(2),
    saldoFavor: saldoFavor.toFixed(2),
    alertas,
  };
}

/**
 * Lista el histórico de liquidaciones de IRE para un tenant.
 *
 * @param tenantSlug - Tenant slug
 * @param limit - Máximo de registros (default 5)
 */
export async function listarLiquidacionesIre(
  tenantSlug: string,
  limit = 5,
) {
  return db()
    .select({
      id: liquidacionesIre.id,
      periodoFiscalId: liquidacionesIre.periodoFiscalId,
      anho: periodosFiscales.anho,
      formulario: periodosFiscales.formulario,
      estado: periodosFiscales.estado,
      ingresosBrutos: liquidacionesIre.ingresosBrutos,
      rentaNeta: liquidacionesIre.rentaNeta,
      impuestoIre: liquidacionesIre.impuestoIre,
      reservaLegal: liquidacionesIre.reservaLegal,
      saldoPagar: liquidacionesIre.saldoPagar,
      tenantSlug: liquidacionesIre.tenantSlug,
      createdAt: liquidacionesIre.createdAt,
    })
    .from(liquidacionesIre)
    .innerJoin(
      periodosFiscales,
      eq(liquidacionesIre.periodoFiscalId, periodosFiscales.id),
    )
    .where(eq(liquidacionesIre.tenantSlug, tenantSlug))
    .orderBy(sql`${periodosFiscales.anho} DESC`)
    .limit(limit);
}
