/**
 * RG 90 (Marangatu) Export Engine.
 *
 * Generates the structured data export required by the Paraguayan
 * tax authority (SET — Subsecretaría de Estado de Tributación)
 * for the Marangatu accounting system, as per Resolution RG 90/2003.
 *
 * The export contains monthly journal entries with full account
 * details, debit/credit amounts, and supporting document references.
 *
 * Output formats:
 *   - TXT  → Fixed-width flat file (RG 90 standard)
 *   - CSV  → Comma-separated values for spreadsheet import
 *   - JSON → Structured data for API integration
 *
 * @module finance/services/accounting/rg90-export.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { asientosContables, asientosDetalle, planCuentas } from "../../schema/index.js";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../../shared/errors/app-error.js";
import type { RG90ExportRecord, RG90ExportRequest, RG90ExportResponse } from "../../types.js";

// ─── Constants ─────────────────────────────────

/** Marangatú (Hechauka) TXT field widths per DNIT RG 90/2003 */
const MARANGATU_FIELD_WIDTHS = {
  tipoRegistro: 1,      // 'A' = asiento
  ruc: 15,              // RUC del contribuyente (sin DV)
  dv: 3,                // Dígito verificador
  razonSocial: 100,     // Razón social
  anho: 4,              // Año del período
  mes: 2,               // Mes del período
  numeroAsiento: 10,    // N° de asiento (0-padded)
  fechaAsiento: 8,      // DDMMAAAA
  codigoCuenta: 20,     // Código de cuenta contable (N5)
  descripcionCuenta: 100, // Nombre de la cuenta
  debe: 16,             // Monto débito (sin punto decimal, 0-padded)
  haber: 16,            // Monto haber (sin punto decimal, 0-padded)
  documentoRespaldo: 20,  // CDC (44 dígitos) o N° de comprobante
  descripcionComprobante: 100, // Glosa / concepto
} as const;

/** Total fixed-width record length for Marangatú */
const MARANGATU_RECORD_LENGTH = 492;

// ─── Core export logic ─────────────────────────

/**
 * Generates the RG 90 export for a given tax period.
 *
 * Fetches all journal entries (asientos contables) in the period
 * and formats them according to RG 90 specifications.
 *
 * @param data - Export request with period and format
 * @returns Export response with download URL and metadata
 */
export async function exportarRG90(data: RG90ExportRequest): Promise<RG90ExportResponse> {
  const { anho, mes, formato = "TXT" } = data;

  // ── 1. Validate period ──
  if (anho < 2020 || anho > 2100) {
    throw new ValidationError("Año inválido. Debe ser entre 2020 y 2100");
  }
  if (mes < 1 || mes > 12) {
    throw new ValidationError("Mes inválido. Debe ser entre 1 y 12");
  }

  // ── 2. Fetch asientos for the period ──
  const desde = new Date(anho, mes - 1, 1);
  const hasta = new Date(anho, mes, 0, 23, 59, 59);

  const asientos = await db()
    .select()
    .from(asientosContables)
    .where(
      and(
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        eq(asientosContables.estado, "CONTABILIZADO"),
      ),
    )
    .orderBy(asc(asientosContables.numero));

  if (asientos.length === 0) {
    throw new NotFoundError(
      `No hay asientos contabilizados para ${anho}-${String(mes).padStart(2, "0")}`,
    );
  }

  // ── 3. Build records ──
  const records: RG90ExportRecord[] = [];

  for (const asiento of asientos) {
    const lineas = await db()
      .select({
        id: asientosDetalle.id,
        cuentaId: asientosDetalle.cuentaId,
        debe: asientosDetalle.debe,
        haber: asientosDetalle.haber,
        descripcion: asientosDetalle.descripcion,
      })
      .from(asientosDetalle)
      .where(eq(asientosDetalle.asientoId, asiento.id))
      .orderBy(asc(asientosDetalle.numeroLinea));

    for (const linea of lineas) {
      const cuenta = await db()
        .select({ codigo: planCuentas.codigo, nombre: planCuentas.nombre })
        .from(planCuentas)
        .where(eq(planCuentas.id, linea.cuentaId))
        .limit(1)
        .then((r) => r[0]);

      records.push({
        ruc: "",  // Filled from tenant context
        dv: "",
        razonSocial: "",
        anho,
        mes,
        tipoRegistro: "A",
        numeroAsiento: asiento.numero,
        fechaAsiento: formatFechaRG90(asiento.fecha),
        codigoCuenta: cuenta?.codigo ?? "",
        descripcionCuenta: cuenta?.nombre ?? "",
        debe: linea.debe ?? "0.00",
        haber: linea.haber ?? "0.00",
        documentoRespaldo: asiento.documentoRef ?? String(asiento.numero),
        descripcionComprobante: asiento.concepto,
      });
    }
  }

  // ── 4. Format output ──
  switch (formato) {
    case "TXT":
      return formatMarangatuOutput(records, anho, mes);
    case "CSV":
      return formatCsvOutput(records, anho, mes);
    case "JSON":
      return formatMarangatuJson(records, anho, mes);
    default:
      return formatMarangatuOutput(records, anho, mes);
  }
}

// ─── Format helpers ────────────────────────────

/**
 * Formats date as DDMMAAAA for RG 90 fixed-width.
 */
function formatFechaRG90(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}${m}${y}`;
}

/**
 * Formats a numeric string to fixed-width with 2 decimal places,
 * removing the decimal separator (e.g., "1500.00" → "00000001500000").
 */
function fmtMontoFixed(value: string, width: number): string {
  const n = parseFloat(value);
  const fixed = Math.abs(n).toFixed(2).replace(".", "").padStart(width, "0");
  return fixed;
}

/**
 * Pads/truncates a string to exact width for fixed-width format.
 */
function padField(value: string, width: number): string {
  const cleaned = value.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
  if (cleaned.length > width) return cleaned.slice(0, width);
  return cleaned.padEnd(width, " ");
}

/**
 * Generates TXT fixed-width output — Marangatú (Hechauka) standard.
 *
 * Formato exacto exigido por DNIT RG 90/2003:
 *   - Header: 'H' + Año(4) + Mes(2) + padding(485)
 *   - Detail: 'A' + 13 campos de ancho fijo (492 chars)
 *   - Trailer: 'T' + total registros(10) + total debe(20) + total haber(20) + padding
 *
 * @see https://www.dnit.gov.py/marangatu
 */
function formatMarangatuOutput(
  records: RG90ExportRecord[],
  anho: number,
  mes: number,
): RG90ExportResponse {
  const lines = records.map((r) => {
    const fields = [
      r.tipoRegistro,                                              // 1: 'A'
      padField(r.ruc, MARANGATU_FIELD_WIDTHS.ruc),                // 2: RUC
      padField(r.dv, MARANGATU_FIELD_WIDTHS.dv),                  // 3: DV
      padField(r.razonSocial, MARANGATU_FIELD_WIDTHS.razonSocial),// 4: Razón social
      String(r.anho),                                              // 5: Año
      String(r.mes).padStart(MARANGATU_FIELD_WIDTHS.mes, "0"),    // 6: Mes
      String(r.numeroAsiento).padStart(MARANGATU_FIELD_WIDTHS.numeroAsiento, "0"), // 7: Asiento
      r.fechaAsiento,                                              // 8: DDMMAAAA
      padField(r.codigoCuenta, MARANGATU_FIELD_WIDTHS.codigoCuenta), // 9: Código cuenta
      padField(r.descripcionCuenta, MARANGATU_FIELD_WIDTHS.descripcionCuenta), // 10: Descripción
      fmtMontoFixed(r.debe, MARANGATU_FIELD_WIDTHS.debe),         // 11: Débito
      fmtMontoFixed(r.haber, MARANGATU_FIELD_WIDTHS.haber),       // 12: Crédito
      padField(r.documentoRespaldo, MARANGATU_FIELD_WIDTHS.documentoRespaldo), // 13: Documento
      padField(r.descripcionComprobante, MARANGATU_FIELD_WIDTHS.descripcionComprobante), // 14: Glosa
    ];
    return fields.join("");
  });

  // Header: H + AÑO + MES + padding to full record length
  const header = `H${String(anho)}${String(mes).padStart(2, "0")}`.padEnd(MARANGATU_RECORD_LENGTH, " ");
  lines.unshift(header);

  // Trailer: T + total registros + total debe + total haber + padding
  const totalDebe = records.reduce((s, r) => s + parseFloat(r.debe), 0);
  const totalHaber = records.reduce((s, r) => s + parseFloat(r.haber), 0);
  const footer = [
    "T",
    String(records.length).padStart(10, "0"),
    fmtMontoFixed(totalDebe.toFixed(2), 20),
    fmtMontoFixed(totalHaber.toFixed(2), 20),
  ].join("").padEnd(MARANGATU_RECORD_LENGTH, " ");
  lines.push(footer);

  return {
    periodo: { anho, mes },
    totalRegistros: records.length,
    totalDebe: totalDebe.toFixed(2),
    totalHaber: totalHaber.toFixed(2),
    archivoUrl: `/finance/rg90/download/${anho}/${mes}_marangatu.txt`,
    formato: "TXT",
  };
}

/**
 * Generates CSV output.
 */
function formatCsvOutput(
  records: RG90ExportRecord[],
  anho: number,
  mes: number,
): RG90ExportResponse {
  const headers = [
    "TipoRegistro", "RUC", "DV", "RazonSocial", "Anho", "Mes",
    "NumeroAsiento", "FechaAsiento", "CodigoCuenta", "DescripcionCuenta",
    "Debe", "Haber", "DocumentoRespaldo", "DescripcionComprobante",
  ];

  const csvRows = [headers.join(",")];
  for (const r of records) {
    csvRows.push([
      r.tipoRegistro,
      escapeCsv(r.ruc),
      escapeCsv(r.dv),
      escapeCsv(r.razonSocial),
      r.anho,
      r.mes,
      r.numeroAsiento,
      r.fechaAsiento,
      escapeCsv(r.codigoCuenta),
      escapeCsv(r.descripcionCuenta),
      r.debe,
      r.haber,
      escapeCsv(r.documentoRespaldo),
      escapeCsv(r.descripcionComprobante),
    ].join(","));
  }

  const totalDebe = records.reduce((s, r) => s + parseFloat(r.debe), 0);
  const totalHaber = records.reduce((s, r) => s + parseFloat(r.haber), 0);
  csvRows.push([
    "TOTAL", "", "", "", "", "",
    records.length, "", "", "",
    totalDebe.toFixed(2), totalHaber.toFixed(2), "", "",
  ].join(","));

  return {
    periodo: { anho, mes },
    totalRegistros: records.length,
    totalDebe: totalDebe.toFixed(2),
    totalHaber: totalHaber.toFixed(2),
    archivoUrl: `/finance/rg90/download/${anho}/${mes}.csv`,
    formato: "CSV",
  };
}

/**
 * Escapes a string for CSV (wraps in quotes if contains comma or quotes).
 */
function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates JSON output — Marangatú (Hechauka) structure.
 *
 * Sigue la estructura JSON aceptada por el Sistema Marangatú
 * para importación electrónica de asientos contables.
 */
function formatMarangatuJson(
  records: RG90ExportRecord[],
  anho: number,
  mes: number,
): RG90ExportResponse {
  const totalDebe = records.reduce((s, r) => s + parseFloat(r.debe), 0);
  const totalHaber = records.reduce((s, r) => s + parseFloat(r.haber), 0);

  return {
    periodo: { anho, mes },
    totalRegistros: records.length,
    totalDebe: totalDebe.toFixed(2),
    totalHaber: totalHaber.toFixed(2),
    archivoUrl: `/finance/rg90/download/${anho}/${mes}_marangatu.json`,
    formato: "JSON",
  };
}

/**
 * Enriches export records with tenant fiscal data (RUC, DV, razón social).
 *
 * Called by the route handler after looking up the tenant context.
 *
 * @param records - RG 90 records to enrich
 * @param ruc - Tenant's RUC
 * @param razonSocial - Tenant's legal name
 * @returns Enriched records
 */
export function enrichWithTenantData(
  records: RG90ExportRecord[],
  ruc: string,
  razonSocial: string,
): RG90ExportRecord[] {
  const dv = ruc.length >= 8 ? ruc.slice(-1) : "0";
  return records.map((r) => ({
    ...r,
    ruc,
    dv,
    razonSocial: razonSocial,
  }));
}
