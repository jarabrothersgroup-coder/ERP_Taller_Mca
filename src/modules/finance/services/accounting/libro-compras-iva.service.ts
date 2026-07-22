/**
 * Libro de Compras IVA Service — Purchase VAT Ledger.
 *
 * Generates the Libro de Compras (Purchase VAT Book) required by
 * RG 90 Marangatu and Ley 1034/83. Shows each purchase transaction
 * with IVA breakdown.
 *
 * Structure per entry:
 *   - Fecha de la transacción
 *   - Tipo de documento (FACTURA, NC, ND)
 *   - Número de factura del proveedor
 *   - RUC del proveedor (desde clients si es posible)
 *   - Monto total
 *   - Base imponible
 *   - IVA
 *   - Concepto
 *
 * Output formats: JSON, CSV
 *
 * @module finance/services/accounting/libro-compras-iva.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { facturasProveedor } from "../../schema/treasury.js";
import { and, gte, lte, asc } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";
import {
  csvEscape,
} from "./capa3-formatters.js";

// ─── Types ──────────────────────────────────────

export interface LibroComprasIVAEntry {
  fecha: string;
  tipoDocumento: string;
  numeroFactura: string;
  montoTotal: string;
  baseImponible: string;
  iva: string;
  concepto: string;
}

export interface LibroComprasIVAReport {
  periodo: { anho: number; mes: number };
  totalEntradas: number;
  totalCompras: string;
  totalIVA: string;
  formato: "JSON" | "CSV";
  entries: LibroComprasIVAEntry[];
  contenido?: string;
}

// ─── Service ────────────────────────────────────

/**
 * Genera el Libro de Compras IVA para un período mensual.
 */
export async function generarLibroComprasIVA(
  anho: number,
  mes: number,
  formato: "JSON" | "CSV" = "JSON",
): Promise<LibroComprasIVAReport> {
  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const desde = new Date(anho, mes - 1, 1);
  const hasta = new Date(anho, mes, 0, 23, 59, 59);

  const registros = await db()
    .select({
      id: facturasProveedor.id,
      nroFactura: facturasProveedor.nroFactura,
      tipoDoc: facturasProveedor.tipoDoc,
      total: facturasProveedor.total,
      baseImponible: facturasProveedor.baseImponible,
      ivaMonto: facturasProveedor.ivaMonto,
      concepto: facturasProveedor.concepto,
      fechaEmision: facturasProveedor.fechaEmision,
    })
    .from(facturasProveedor)
    .where(
      and(
        gte(facturasProveedor.fechaEmision, desde),
        lte(facturasProveedor.fechaEmision, hasta),
      ),
    )
    .orderBy(asc(facturasProveedor.fechaEmision));

  const entries: LibroComprasIVAEntry[] = [];
  let totalCompras = 0;
  let totalIVA = 0;

  for (const r of registros) {
    const total = Number(r.total ?? 0);
    const iva = Number(r.ivaMonto ?? (r.baseImponible ? Number(r.baseImponible) * 0.1 : total * 0.1));
    const base = Number(r.baseImponible ?? (total - iva));

    totalCompras += total;
    totalIVA += iva;

    entries.push({
      fecha: r.fechaEmision.toISOString().slice(0, 10),
      tipoDocumento: r.tipoDoc ?? "FACTURA",
      numeroFactura: r.nroFactura ?? "",
      montoTotal: total.toFixed(2),
      baseImponible: base.toFixed(2),
      iva: iva.toFixed(2),
      concepto: r.concepto ?? "",
    });
  }

  if (formato === "CSV") {
    return formatCsv(anho, mes, entries, totalCompras, totalIVA);
  }

  return {
    periodo: { anho, mes },
    totalEntradas: entries.length,
    totalCompras: totalCompras.toFixed(2),
    totalIVA: totalIVA.toFixed(2),
    formato: "JSON",
    entries,
  };
}

// ─── Formatters ─────────────────────────────────

function emptyReport(anho: number, mes: number): LibroComprasIVAReport {
  return {
    periodo: { anho, mes },
    totalEntradas: 0,
    totalCompras: "0.00",
    totalIVA: "0.00",
    formato: "JSON",
    entries: [],
  };
}

function formatCsv(
  anho: number, mes: number,
  entries: LibroComprasIVAEntry[],
  totalCompras: number, totalIVA: number,
): LibroComprasIVAReport {
  if (entries.length === 0) return emptyReport(anho, mes);

  const rows: string[] = [
    ["Fecha", "TipoDoc", "NroFactura", "Total", "BaseImp", "IVA", "Concepto"].join(","),
  ];

  for (const e of entries) {
    rows.push([
      e.fecha,
      e.tipoDocumento,
      csvEscape(e.numeroFactura),
      e.montoTotal,
      e.baseImponible,
      e.iva,
      csvEscape(e.concepto),
    ].join(","));
  }

  rows.push(`TOTAL,,,,${totalCompras.toFixed(2)},${totalIVA.toFixed(2)},`);

  return {
    periodo: { anho, mes },
    totalEntradas: entries.length,
    totalCompras: totalCompras.toFixed(2),
    totalIVA: totalIVA.toFixed(2),
    formato: "CSV",
    entries,
    contenido: rows.join("\n"),
  };
}
