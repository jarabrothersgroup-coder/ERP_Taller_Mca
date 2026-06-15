/**
 * Libro Diario Service — Daily Journal Report (CAPA 3).
 *
 * Generates the Libro Diario (Daily Journal Book) in DNIT-compliant
 * formats (JSON, TXT fixed-width, CSV) with CDC (44-digit) integration
 * from SIFEN fiscal documents.
 *
 * Structure per entry:
 *   - N° de Asiento (correlativo por ejercicio)
 *   - Fecha de la transacción
 *   - Código de Cuenta (Nivel 5)
 *   - Nombre de la Cuenta
 *   - Debe (₲)
 *   - Haber (₲)
 *   - Glosa / Descripción de la transacción
 *   - CDC (44 dígitos SIFEN) o N° de Comprobante físico
 *
 * @module finance/services/accounting/libro-diario.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import {
  asientosContables,
  asientosDetalle,
  planCuentas,
  facturas,
} from "../../schema/index.js";
import { eq, and, gte, lte, asc, inArray, sql } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";
import {
  stripAccents,
  montoFixed,
  fechaDDMMAAAA,
  csvEscape,
} from "./capa3-formatters.js";

// ─── Types ──────────────────────────────────────

export interface LibroDiarioEntry {
  numeroAsiento: number;
  fecha: string;
  codigoCuenta: string;
  nombreCuenta: string;
  debe: string;
  haber: string;
  glosa: string;
  documentoRef: string | null;  // CDC (44 dígitos) o comprobante físico
  moduloOrigen: string | null;
}

export interface LibroDiarioReport {
  periodo: { anho: number; mes: number };
  totalEntradas: number;
  totalDebe: string;
  totalHaber: string;
  formato: "JSON" | "TXT" | "CSV";
  entries: LibroDiarioEntry[];
  /** TXT/CSV raw content (only when formato !== JSON) */
  contenido?: string;
}

// ─── Service ────────────────────────────────────

/**
 * Genera el Libro Diario con formato filing-ready (CAPA 3).
 *
 * @param anho   - Año fiscal (2020-2100)
 * @param mes    - Mes (1-12)
 * @param formato - "JSON" | "TXT" | "CSV" (default JSON)
 */
export async function generarLibroDiario(
  anho: number,
  mes: number,
  formato: "JSON" | "TXT" | "CSV" = "JSON",
): Promise<LibroDiarioReport> {
  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const desde = new Date(anho, mes - 1, 1);
  const hasta = new Date(anho, mes, 0, 23, 59, 59);

  // ── 1. Asientos del período ──
  const asientos = await db()
    .select({
      id: asientosContables.id,
      numero: asientosContables.numero,
      fecha: asientosContables.fecha,
      concepto: asientosContables.concepto,
      documentoRef: asientosContables.documentoRef,
      documentoFiscalId: asientosContables.documentoFiscalId,
      moduloOrigen: asientosContables.moduloOrigen,
      totalDebe: asientosContables.totalDebe,
      totalHaber: asientosContables.totalHaber,
    })
    .from(asientosContables)
    .where(
      and(
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        eq(asientosContables.estado, "CONTABILIZADO"),
      ),
    )
    .orderBy(asc(asientosContables.fecha), asc(asientosContables.numero));

  if (asientos.length === 0) {
    return emptyReport(anho, mes, formato);
  }

  // ── 2. Líneas de detalle (batch) ──
  const asientoIds = asientos.map((a) => a.id);
  const lineas = asientoIds.length > 0
    ? await db()
        .select({
          id: asientosDetalle.id,
          asientoId: asientosDetalle.asientoId,
          cuentaId: asientosDetalle.cuentaId,
          debe: asientosDetalle.debe,
          haber: asientosDetalle.haber,
          descripcion: asientosDetalle.descripcion,
        })
        .from(asientosDetalle)
        .where(inArray(asientosDetalle.asientoId, asientoIds))
        .orderBy(asc(asientosDetalle.numeroLinea))
    : [];

  // ── 3. Cuentas contables (batch) ──
  const cuentaIds = [...new Set(lineas.map((l) => l.cuentaId))];
  const cuentas = cuentaIds.length > 0
    ? await db()
        .select({ id: planCuentas.id, codigo: planCuentas.codigo, nombre: planCuentas.nombre })
        .from(planCuentas)
        .where(inArray(planCuentas.id, cuentaIds))
    : [];
  const cuentaMap = new Map(cuentas.map((c) => [c.id, c]));

  // ── 4. CDC desde facturas (batch) ──
  const docFiscalIds = asientos
    .map((a) => a.documentoFiscalId)
    .filter(Boolean) as string[];
  const cdcMap = new Map<string, string>();
  if (docFiscalIds.length > 0) {
    const fiscalDocs = await db()
      .select({ id: facturas.id, cdc: facturas.sifenCdc })
      .from(facturas)
      .where(and(
        inArray(facturas.id, docFiscalIds),
        sql`${facturas.sifenCdc} IS NOT NULL`,
      ));
    for (const d of fiscalDocs) {
      if (d.cdc) cdcMap.set(d.id, d.cdc);
    }
  }

  // ── 5. Build entries ──
  const lineasPorAsiento = new Map<string, typeof lineas>();
  for (const linea of lineas) {
    const arr = lineasPorAsiento.get(linea.asientoId) ?? [];
    arr.push(linea);
    lineasPorAsiento.set(linea.asientoId, arr);
  }

  const entries: LibroDiarioEntry[] = [];
  let totalDebe = 0;
  let totalHaber = 0;

  for (const asiento of asientos) {
    const cdc = cdcMap.get(asiento.documentoFiscalId ?? "") ?? asiento.documentoRef;
    const lineasAsiento = lineasPorAsiento.get(asiento.id) ?? [];

    if (lineasAsiento.length === 0) {
      const d = Number(asiento.totalDebe ?? 0);
      const h = Number(asiento.totalHaber ?? 0);
      entries.push({
        numeroAsiento: asiento.numero,
        fecha: asiento.fecha.toISOString(),
        codigoCuenta: "",
        nombreCuenta: "(sin detalle)",
        debe: d.toFixed(2),
        haber: h.toFixed(2),
        glosa: asiento.concepto,
        documentoRef: cdc,
        moduloOrigen: asiento.moduloOrigen,
      });
      totalDebe += d;
      totalHaber += h;
    } else {
      for (const linea of lineasAsiento) {
        const cta = cuentaMap.get(linea.cuentaId);
        const d = Number(linea.debe ?? 0);
        const h = Number(linea.haber ?? 0);
        entries.push({
          numeroAsiento: asiento.numero,
          fecha: asiento.fecha.toISOString(),
          codigoCuenta: cta?.codigo ?? "",
          nombreCuenta: cta?.nombre ?? "",
          debe: d.toFixed(2),
          haber: h.toFixed(2),
          glosa: linea.descripcion ?? asiento.concepto,
          documentoRef: cdc,
          moduloOrigen: asiento.moduloOrigen,
        });
        totalDebe += d;
        totalHaber += h;
      }
    }
  }

  if (formato === "TXT") {
    return formatLibroDiarioTxt(anho, mes, entries, totalDebe, totalHaber);
  }
  if (formato === "CSV") {
    return formatLibroDiarioCsv(anho, mes, entries, totalDebe, totalHaber);
  }
  return {
    periodo: { anho, mes },
    totalEntradas: entries.length,
    totalDebe: totalDebe.toFixed(2),
    totalHaber: totalHaber.toFixed(2),
    formato: "JSON",
    entries,
  };
}

// ─── Empty report ──────────────────────────────

function emptyReport(anho: number, mes: number, formato: string): LibroDiarioReport {
  return {
    periodo: { anho, mes },
    totalEntradas: 0, totalDebe: "0.00", totalHaber: "0.00",
    formato: formato as any,
    entries: [],
    contenido: formato === "JSON" ? undefined : "",
  };
}

// ─── TXT formatter (DNIT Marangatú fixed-width) ─

function formatLibroDiarioTxt(
  anho: number, mes: number,
  entries: LibroDiarioEntry[],
  totalDebe: number, totalHaber: number,
): LibroDiarioReport {
  const lines: string[] = [];

  for (const e of entries) {
    const f = new Date(e.fecha);
    const fields: { v: string; width: number; right: boolean }[] = [
      { v: String(e.numeroAsiento), width: 10, right: true },
      { v: fechaDDMMAAAA(f), width: 8, right: false },
      { v: e.codigoCuenta, width: 20, right: false },
      { v: stripAccents(e.nombreCuenta), width: 100, right: false },
      { v: montoFixed(e.debe, 16), width: 16, right: true },
      { v: montoFixed(e.haber, 16), width: 16, right: true },
      { v: stripAccents(e.glosa).slice(0, 200), width: 200, right: false },
      { v: (e.documentoRef ?? "").slice(0, 44), width: 44, right: false },
    ];
    const row = fields.map((fld) =>
      fld.right
        ? fld.v.padStart(fld.width, "0").slice(0, fld.width)
        : fld.v.padEnd(fld.width, " ").slice(0, fld.width),
    ).join("");
    lines.push(row);
  }

  // Header
  lines.unshift(`H${String(anho)}${String(mes).padStart(2, "0")}`.padEnd(430, " "));
  // Trailer
  const trailer = [
    "T",
    String(entries.length).padStart(10, "0"),
    montoFixed(totalDebe, 20),
    montoFixed(totalHaber, 20),
  ].join("").padEnd(430, " ");
  lines.push(trailer);

  return {
    periodo: { anho, mes },
    totalEntradas: entries.length,
    totalDebe: totalDebe.toFixed(2),
    totalHaber: totalHaber.toFixed(2),
    formato: "TXT",
    entries,
    contenido: lines.join("\n"),
  };
}

// ─── CSV formatter ─────────────────────────────

function formatLibroDiarioCsv(
  anho: number, mes: number,
  entries: LibroDiarioEntry[],
  totalDebe: number, totalHaber: number,
): LibroDiarioReport {
  const rows: string[] = [
    ["NroAsiento", "Fecha", "CodigoCuenta", "NombreCuenta", "Debe", "Haber", "Glosa", "DocumentoRef"].join(","),
  ];
  for (const e of entries) {
    rows.push([
      e.numeroAsiento,
      e.fecha.slice(0, 10),
      e.codigoCuenta,
      csvEscape(e.nombreCuenta),
      e.debe,
      e.haber,
      csvEscape(e.glosa),
      csvEscape(e.documentoRef ?? ""),
    ].join(","));
  }
  rows.push(`TOTAL,,,,${totalDebe.toFixed(2)},${totalHaber.toFixed(2)},,`);

  return {
    periodo: { anho, mes },
    totalEntradas: entries.length,
    totalDebe: totalDebe.toFixed(2),
    totalHaber: totalHaber.toFixed(2),
    formato: "CSV",
    entries,
    contenido: rows.join("\n"),
  };
}
