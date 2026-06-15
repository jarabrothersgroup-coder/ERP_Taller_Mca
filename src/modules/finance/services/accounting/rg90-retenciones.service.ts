/**
 * RG 90 Módulo Retenciones — Withholding Tax Export (CAPA 3).
 *
 * Exporta las retenciones aplicadas en el período (IRP, IVA, IRE)
 * en el formato exacto TXT/CSV/JSON exigido por el Sistema Marangatú
 * (Hechauka) de la DNIT.
 *
 * Las retenciones se detectan desde asientos contables cuyo módulo
 * de origen contiene "RETENCION", o desde cuentas 2.2.02.x.
 *
 * @module finance/services/accounting/rg90-retenciones.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import {
  asientosContables,
  asientosDetalle,
  planCuentas,
} from "../../schema/index.js";
import { eq, and, gte, lte, asc, sql } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";
import {
  stripAccents,
  montoFixed,
  fechaDDMMAAAA,
  csvEscape,
} from "./capa3-formatters.js";

// ─── Types ──────────────────────────────────────

export interface RG90RetencionEntry {
  tipoRegistro: string;     // 'R'
  fecha: string;            // DDMMAAAA
  tipoRetencion: string;    // IRP | IVA | IRE
  numeroComprobante: string;
  retenidoRuc: string;
  retenidoNombre: string;
  montoSujetoRetencion: string;
  porcentaje: string;
  montoRetenido: string;
}

export interface RG90RetencionesReport {
  periodo: { anho: number; mes: number };
  totalRegistros: number;
  totalRetenido: string;
  formato: "JSON" | "TXT" | "CSV";
  entries: RG90RetencionEntry[];
  contenido?: string;
}

// ─── Service ────────────────────────────────────

export async function exportarRG90Retenciones(
  _tenantSlug: string,
  anho: number,
  mes: number,
  formato: "JSON" | "TXT" | "CSV" = "JSON",
): Promise<RG90RetencionesReport> {
  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const desde = new Date(anho, mes - 1, 1);
  const hasta = new Date(anho, mes, 0, 23, 59, 59);

  // Buscar asientos de retención (moduloOrigen contiene RETENCION
  // o cuentas de retención 2.2.02.x)
  const retenciones = await db()
    .select({
      asientoId: asientosContables.id,
      numero: asientosContables.numero,
      fecha: asientosContables.fecha,
      concepto: asientosContables.concepto,
      cuentaCodigo: planCuentas.codigo,
      debe: asientosDetalle.debe,
      haber: asientosDetalle.haber,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .innerJoin(planCuentas, eq(asientosDetalle.cuentaId, planCuentas.id))
    .where(
      and(
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        eq(asientosContables.estado, "CONTABILIZADO"),
        sql`(${asientosContables.moduloOrigen} ILIKE '%RETENCION%' OR ${planCuentas.codigo} LIKE '2.2.02%')`,
      ),
    )
    .orderBy(asc(asientosContables.fecha));

  const entries: RG90RetencionEntry[] = [];
  let totalRetenido = 0;

  for (const r of retenciones) {
    const monto = Number(r.haber ?? r.debe ?? 0);
    if (monto === 0) continue;
    totalRetenido += monto;

    // Determinar tipo de retención según código de cuenta
    let tipoRetencion = "IVA";
    if (r.cuentaCodigo?.includes("IRP") || r.concepto?.includes("IRP")) tipoRetencion = "IRP";
    else if (r.cuentaCodigo?.includes("IRE") || r.concepto?.includes("IRE")) tipoRetencion = "IRE";

    entries.push({
      tipoRegistro: "R",
      fecha: fechaDDMMAAAA(r.fecha),
      tipoRetencion,
      numeroComprobante: String(r.numero),
      retenidoRuc: "",
      retenidoNombre: "",
      montoSujetoRetencion: (monto * 10).toFixed(2), // Aprox: monto retenido / tasa
      porcentaje: tipoRetencion === "IRP" ? "10.00" : "10.00",
      montoRetenido: monto.toFixed(2),
    });
  }

  if (formato === "TXT") return formatTxt(anho, mes, entries, totalRetenido);
  if (formato === "CSV") return formatCsv(anho, mes, entries, totalRetenido);

  return {
    periodo: { anho, mes },
    totalRegistros: entries.length,
    totalRetenido: totalRetenido.toFixed(2),
    formato: "JSON",
    entries,
  };
}

// ─── Formatters ────────────────────────────────

function formatTxt(
  anho: number, mes: number,
  entries: RG90RetencionEntry[], totalRetenido: number,
): RG90RetencionesReport {
  const lines = entries.map((e) => {
    return [
      e.tipoRegistro,
      e.fecha,
      e.tipoRetencion.padEnd(10, " ").slice(0, 10),
      e.numeroComprobante.padEnd(20, " ").slice(0, 20),
      e.retenidoRuc.padEnd(15, " ").slice(0, 15),
      stripAccents(e.retenidoNombre).padEnd(100, " ").slice(0, 100),
      montoFixed(e.montoSujetoRetencion, 16),
      e.porcentaje.padStart(6, "0").slice(0, 6),
      montoFixed(e.montoRetenido, 14),
    ].join("");
  });

  lines.unshift(`H${String(anho)}${String(mes).padStart(2, "0")}`.padEnd(430, " "));
  lines.push([
    "T", String(entries.length).padStart(10, "0"),
    montoFixed(totalRetenido, 20),
  ].join("").padEnd(430, " "));

  return {
    periodo: { anho, mes }, totalRegistros: entries.length,
    totalRetenido: totalRetenido.toFixed(2), formato: "TXT", entries,
    contenido: lines.join("\n"),
  };
}

function formatCsv(
  anho: number, mes: number,
  entries: RG90RetencionEntry[], totalRetenido: number,
): RG90RetencionesReport {
  const rows = [["TipoReg","Fecha","TipoRet","NroComp","RUC","Nombre","MontoSujeto","Porc","MontoRet"].join(",")];
  for (const e of entries) {
    rows.push([
      e.tipoRegistro, e.fecha, e.tipoRetencion, e.numeroComprobante,
      e.retenidoRuc, csvEscape(e.retenidoNombre),
      e.montoSujetoRetencion, e.porcentaje, e.montoRetenido,
    ].join(","));
  }
  rows.push(`TOTAL,,,,,,${entries.length},,${totalRetenido.toFixed(2)}`);
  return {
    periodo: { anho, mes }, totalRegistros: entries.length,
    totalRetenido: totalRetenido.toFixed(2), formato: "CSV", entries,
    contenido: rows.join("\n"),
  };
}
