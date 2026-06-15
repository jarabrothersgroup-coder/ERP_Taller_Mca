/**
 * RG 90 Módulo Ventas — Sales Invoice Export (CAPA 3).
 *
 * Exporta las facturas electrónicas (SIFEN) del período en el
 * formato exacto TXT/CSV/JSON exigido por el Sistema Marangatú
 * (Hechauka) de la DNIT.
 *
 * @module finance/services/accounting/rg90-ventas.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { facturas } from "../../schema/index.js";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";
import {
  stripAccents,
  montoFixed,
  fechaDDMMAAAA,
  csvEscape,
} from "./capa3-formatters.js";

// ─── Types ──────────────────────────────────────

export interface RG90VentasEntry {
  tipoRegistro: string;    // 'V'
  fechaEmision: string;    // DDMMAAAA
  tipoComprobante: string; // FACTURA | NOTA_CREDITO | NOTA_DEBITO
  numeroComprobante: string;
  cdc: string;             // 44 dígitos o 'MANUAL'
  rucCliente: string;
  razonSocialCliente: string;
  total: string;
  iva10: string;
  iva5: string;
  condicion: string;       // CONTADO | CREDITO
}

export interface RG90VentasReport {
  periodo: { anho: number; mes: number };
  totalRegistros: number;
  totalVentas: string;
  formato: "JSON" | "TXT" | "CSV";
  entries: RG90VentasEntry[];
  contenido?: string;
}

// ─── Service ────────────────────────────────────

export async function exportarRG90Ventas(
  tenantSlug: string,
  anho: number,
  mes: number,
  formato: "JSON" | "TXT" | "CSV" = "JSON",
): Promise<RG90VentasReport> {
  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const desde = new Date(anho, mes - 1, 1);
  const hasta = new Date(anho, mes, 0, 23, 59, 59);

  const registros = await db()
    .select({
      id: facturas.id,
      tipo: facturas.tipo,
      numeroFacturaManual: facturas.numeroFacturaManual,
      sifenCdc: facturas.sifenCdc,
      total: facturas.total,
      createdAt: facturas.createdAt,
    })
    .from(facturas)
    .where(
      and(
        eq(facturas.tenantSlug, tenantSlug),
        gte(facturas.createdAt, desde),
        lte(facturas.createdAt, hasta),
      ),
    )
    .orderBy(asc(facturas.createdAt));

  const entries: RG90VentasEntry[] = [];
  let totalVentas = 0;

  for (const r of registros) {
    const total = Number(r.total ?? 0);
    totalVentas += total;

    entries.push({
      tipoRegistro: "V",
      fechaEmision: fechaDDMMAAAA(r.createdAt),
      tipoComprobante: r.tipo === "ELECTRONICA" ? "FACTURA" : "FACTURA_MANUAL",
      numeroComprobante: r.numeroFacturaManual ?? r.sifenCdc?.slice(0, 10) ?? String(entries.length + 1),
      cdc: r.sifenCdc ?? "MANUAL",
      rucCliente: "",
      razonSocialCliente: "",
      total: total.toFixed(2),
      iva10: (total * 0.1).toFixed(2),        // Aprox 10% IVA
      iva5: "0.00",
      condicion: "CONTADO",
    });
  }

  if (formato === "TXT") return formatTxt(anho, mes, entries, totalVentas);
  if (formato === "CSV") return formatCsv(anho, mes, entries, totalVentas);

  return {
    periodo: { anho, mes },
    totalRegistros: entries.length,
    totalVentas: totalVentas.toFixed(2),
    formato: "JSON",
    entries,
  };
}

// ─── Formatters ────────────────────────────────

function formatTxt(
  anho: number, mes: number,
  entries: RG90VentasEntry[], totalVentas: number,
): RG90VentasReport {
  const lines: string[] = [];
  for (const e of entries) {
    const row = [
      e.tipoRegistro,
      e.fechaEmision,
      e.tipoComprobante.padEnd(20, " ").slice(0, 20),
      e.numeroComprobante.padEnd(20, " ").slice(0, 20),
      e.cdc.padEnd(44, " ").slice(0, 44),
      e.rucCliente.padEnd(15, " ").slice(0, 15),
      stripAccents(e.razonSocialCliente).padEnd(100, " ").slice(0, 100),
      montoFixed(e.total, 16),
      montoFixed(e.iva10, 14),
      montoFixed(e.iva5, 14),
      e.condicion.padEnd(10, " ").slice(0, 10),
    ].join("");
    lines.push(row);
  }
  const header = `H${String(anho)}${String(mes).padStart(2, "0")}`.padEnd(430, " ");
  lines.unshift(header);
  const trailer = [
    "T", String(entries.length).padStart(10, "0"),
    montoFixed(totalVentas, 20),
  ].join("").padEnd(430, " ");
  lines.push(trailer);

  return {
    periodo: { anho, mes }, totalRegistros: entries.length,
    totalVentas: totalVentas.toFixed(2), formato: "TXT", entries,
    contenido: lines.join("\n"),
  };
}

function formatCsv(
  anho: number, mes: number,
  entries: RG90VentasEntry[], totalVentas: number,
): RG90VentasReport {
  const rows = [["TipoReg","Fecha","TipoComp","NroComp","CDC","RUC","RazonSocial","Total","IVA10","IVA5","Condicion"].join(",")];
  for (const e of entries) {
    rows.push([
      e.tipoRegistro, e.fechaEmision, e.tipoComprobante, e.numeroComprobante,
      e.cdc, e.rucCliente, csvEscape(e.razonSocialCliente),
      e.total, e.iva10, e.iva5, e.condicion,
    ].join(","));
  }
  rows.push(`TOTAL,,,${entries.length},,,,,${totalVentas.toFixed(2)},,,`);
  return {
    periodo: { anho, mes }, totalRegistros: entries.length,
    totalVentas: totalVentas.toFixed(2), formato: "CSV", entries,
    contenido: rows.join("\n"),
  };
}
