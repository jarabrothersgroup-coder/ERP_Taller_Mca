/**
 * Libro de Ventas IVA Service — Sales VAT Ledger.
 *
 * Generates the Libro de Ventas (Sales VAT Book) required by
 * RG 90 Marangatu and Ley 1034/83. Shows each sales transaction
 * with IVA breakdown.
 *
 * Note: IVA calculation uses total * 0.1 as approximation since
 * the facturas table stores only total. For precise per-line IVA,
 * factura_detalles should be used in production.
 *
 * Structure per entry:
 *   - Fecha de emisión
 *   - Tipo de comprobante
 *   - Número de factura / CDC
 *   - Monto total
 *   - Base imponible (total / 1.1)
 *   - IVA 10% (total - base)
 *   - CDC (44 dígitos SIFEN)
 *
 * Output formats: JSON, CSV
 *
 * @module finance/services/accounting/libro-ventas-iva.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { facturas } from "../../schema/index.js";
import { and, gte, lte, asc } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";
import {
  csvEscape,
} from "./capa3-formatters.js";

// ─── Types ──────────────────────────────────────

export interface LibroVentasIVAEntry {
  fechaEmision: string;
  tipoComprobante: string;
  numeroComprobante: string;
  montoTotal: string;
  baseImponible: string;
  iva: string;
  cdc: string | null;
}

export interface LibroVentasIVAReport {
  periodo: { anho: number; mes: number };
  totalEntradas: number;
  totalVentas: string;
  totalIVA: string;
  formato: "JSON" | "CSV";
  entries: LibroVentasIVAEntry[];
  contenido?: string;
}

// ─── Service ────────────────────────────────────

/**
 * Genera el Libro de Ventas IVA para un período mensual.
 *
 * IVA se calcula como 10% sobre el total.
 * Para precisión por línea de detalle, usar factura_detalles en producción.
 */
export async function generarLibroVentasIVA(
  anho: number,
  mes: number,
  formato: "JSON" | "CSV" = "JSON",
): Promise<LibroVentasIVAReport> {
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
        gte(facturas.createdAt, desde),
        lte(facturas.createdAt, hasta),
      ),
    )
    .orderBy(asc(facturas.createdAt));

  const entries: LibroVentasIVAEntry[] = [];
  let totalVentas = 0;
  let totalIVA = 0;

  for (const r of registros) {
    const total = Number(r.total ?? 0);
    // IVA 10% Paraguay: IVA = total * 0.1 / 1.1  =>  base = total / 1.1
    const base = total / 1.1;
    const iva = total - base;

    totalVentas += total;
    totalIVA += iva;

    const tipoComp = r.tipo === "ELECTRONICA" ? "FACTURA_ELECTRONICA" : "FACTURA_MANUAL";
    const numero = r.numeroFacturaManual
      ?? r.sifenCdc?.slice(0, 10)
      ?? `F-${String(entries.length + 1).padStart(6, "0")}`;

    entries.push({
      fechaEmision: r.createdAt.toISOString().slice(0, 10),
      tipoComprobante: tipoComp,
      numeroComprobante: numero,
      montoTotal: total.toFixed(2),
      baseImponible: base.toFixed(2),
      iva: iva.toFixed(2),
      cdc: r.sifenCdc ?? null,
    });
  }

  if (formato === "CSV") {
    return formatCsv(anho, mes, entries, totalVentas, totalIVA);
  }

  return {
    periodo: { anho, mes },
    totalEntradas: entries.length,
    totalVentas: totalVentas.toFixed(2),
    totalIVA: totalIVA.toFixed(2),
    formato: "JSON",
    entries,
  };
}

// ─── Formatters ─────────────────────────────────

function emptyReport(anho: number, mes: number): LibroVentasIVAReport {
  return {
    periodo: { anho, mes },
    totalEntradas: 0,
    totalVentas: "0.00",
    totalIVA: "0.00",
    formato: "JSON",
    entries: [],
  };
}

function formatCsv(
  anho: number, mes: number,
  entries: LibroVentasIVAEntry[],
  totalVentas: number, totalIVA: number,
): LibroVentasIVAReport {
  if (entries.length === 0) return emptyReport(anho, mes);

  const rows: string[] = [
    ["Fecha", "TipoComp", "NroComp", "Total", "BaseImp", "IVA", "CDC"].join(","),
  ];

  for (const e of entries) {
    rows.push([
      e.fechaEmision,
      e.tipoComprobante,
      csvEscape(e.numeroComprobante),
      e.montoTotal,
      e.baseImponible,
      e.iva,
      csvEscape(e.cdc ?? ""),
    ].join(","));
  }

  rows.push(`TOTAL,,,,${totalVentas.toFixed(2)},${totalIVA.toFixed(2)},`);

  return {
    periodo: { anho, mes },
    totalEntradas: entries.length,
    totalVentas: totalVentas.toFixed(2),
    totalIVA: totalIVA.toFixed(2),
    formato: "CSV",
    entries,
    contenido: rows.join("\n"),
  };
}
