/**
 * CAPA 3 — Formatters for DNIT Legal Book Filing.
 *
 * Shared utilities for generating the exact fixed-width TXT, CSV,
 * and JSON formats required by the DNIT (Marangatú / Hechauka)
 * for mandatory legal book submission.
 *
 * @module finance/services/accounting/capa3-formatters
 */

// ─── Fixed-width TXT ───────────────────────────

// ─── Safe Money Arithmetic (CRITICAL: prevents float rounding errors) ─────

/**
 * Safe money parser — converts string/number to centavos (BigInt) for exact arithmetic.
 * Paraguayan Guarani amounts stored as strings must not use parseFloat for sums.
 *
 * @param value - String or number representing a monetary amount
 * @returns Amount in centavos as BigInt (e.g., "150000" → 15000000n)
 */
export function parseMoneyToCentavos(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined || value === "") return 0n;
  const str = typeof value === "number" ? String(value) : String(value).trim();
  if (!str || str === "0") return 0n;

  // Handle Paraguayan format: "1.500.000" (dots as thousands) or "1500000"
  const cleaned = str.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0n;

  // Convert to centavos (multiply by 100, round to avoid float issues)
  return BigInt(Math.round(num * 100));
}

/**
 * Converts centavos (BigInt) back to a decimal string for storage.
 * @param centavos - Amount in centavos
 * @returns Decimal string (e.g., 15000000n → "150000.00")
 */
export function centavosToString(centavos: bigint): string {
  const sign = centavos < 0n ? "-" : "";
  const abs = centavos < 0n ? -centavos : centavos;
  const guaranies = abs / 100n;
  const cent = abs % 100n;
  return `${sign}${guaranies.toString()}.${cent.toString().padStart(2, "0")}`;
}

/** Field definition for fixed-width TXT records */
export interface TxtField {
  value: string;
  width: number;
  align?: "left" | "right";
  padChar?: string;
  /** Remove leading zeros for right-align? */
  stripZero?: boolean;
}

/** Build a fixed-width TXT record from field definitions */
export function buildTxtRecord(fields: TxtField[]): string {
  return fields.map((f) => {
    let v = f.value ?? "";
    if (f.stripZero) v = v.replace(/^0+/, "") || "0";
    const pad = f.padChar ?? (f.align === "right" ? "0" : " ");
    if (f.align === "right") {
      return v.padStart(f.width, pad as string).slice(0, f.width);
    }
    return v.padEnd(f.width, pad as string).slice(0, f.width);
  }).join("");
}

/** Strip accents for DNIT ASCII-only TXT */
export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Format numeric value as fixed-width without decimal point */
export function montoFixed(value: string | number, width = 16): string {
  const n = typeof value === "number" ? value : parseFloat(value);
  return Math.abs(n).toFixed(2).replace(".", "").padStart(width, "0");
}

/** Date → DDMMAAAA for fixed-width */
export function fechaDDMMAAAA(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}${mm}${yyyy}`;
}

/** Build a Marangatú header record */
export function marangatuHeader(anho: number, mes: number, recordLen = 492): string {
  return `H${String(anho)}${String(mes).padStart(2, "0")}`.padEnd(recordLen, " ");
}

/** Build a Marangatú trailer record */
export function marangatuTrailer(
  totalRecords: number,
  totalDebe: number,
  totalHaber: number,
  recordLen = 492,
): string {
  return [
    "T",
    String(totalRecords).padStart(10, "0"),
    montoFixed(totalDebe, 20),
    montoFixed(totalHaber, 20),
  ].join("").padEnd(recordLen, " ");
}

// ─── ZIP compression for Marangatú delivery ─────

/**
 * Compresses TXT content into a Base64-encoded ZIP for Marangatú.
 *
 * Uses a minimal DEFLATE-based approach. For production, use archiver.
 * Returns a data-URI string suitable for download.
 */
export function zipContent(
  filename: string,
  content: string,
): string {
  // Simple ZIP local file header + DEFLATE (Gzip-compatible)
  // This is a lightweight inline ZIP using raw deflate
  const encoded = new TextEncoder().encode(content);
  const deflated = deflateRaw(encoded);

  // Build minimal ZIP with local file header
  const name = new TextEncoder().encode(filename);
  const crc = crc32(encoded);
  const header = new Uint8Array(30 + name.length + deflated.length + 22);
  const dv = new DataView(header.buffer);

  // Local file header
  let off = 0;
  header[off++] = 0x50; header[off++] = 0x4B; // PK
  header[off++] = 0x03; header[off++] = 0x04; // v3.0
  dv.setUint16(off, 20, true); off += 2;      // version needed
  dv.setUint16(off, 0, true); off += 2;        // flags
  dv.setUint16(off, 8, true); off += 2;        // compression: deflate
  dv.setUint16(off, 0, true); off += 2;        // mod time
  dv.setUint16(off, 0, true); off += 2;        // mod date
  dv.setUint32(off, crc, true); off += 4;      // CRC-32
  dv.setUint32(off, deflated.length, true); off += 4; // compressed size
  dv.setUint32(off, encoded.length, true); off += 4;  // uncompressed size
  dv.setUint16(off, name.length, true); off += 2; // filename length
  dv.setUint16(off, 0, true); off += 2;        // extra field length

  // Filename + compressed data
  header.set(name, off); off += name.length;
  header.set(deflated, off); off += deflated.length;

  // Central directory header
  const cdOff = off;
  header[off++] = 0x50; header[off++] = 0x4B;
  header[off++] = 0x01; header[off++] = 0x02; // central dir
  dv.setUint16(off, 20, true); off += 2;
  dv.setUint16(off, 20, true); off += 2;
  dv.setUint16(off, 0, true); off += 2;
  dv.setUint16(off, 8, true); off += 2;
  dv.setUint16(off, 0, true); off += 2;
  dv.setUint16(off, 0, true); off += 2;
  dv.setUint32(off, crc, true); off += 4;
  dv.setUint32(off, deflated.length, true); off += 4;
  dv.setUint32(off, encoded.length, true); off += 4;
  dv.setUint16(off, name.length, true); off += 2;
  dv.setUint16(off, 0, true); off += 2;
  dv.setUint16(off, 0, true); off += 2;
  dv.setUint16(off, 0, true); off += 2;
  dv.setUint16(off, 0, true); off += 2;
  dv.setUint32(off, 0, true); off += 4;
  dv.setUint32(off, 0, true); off += 4;

  // End of central directory
  header[off++] = 0x50; header[off++] = 0x4B;
  header[off++] = 0x05; header[off++] = 0x06;
  dv.setUint16(off, 0, true); off += 2;
  dv.setUint16(off, 0, true); off += 2;
  dv.setUint16(off, 1, true); off += 2;       // entries on this disk
  dv.setUint16(off, 1, true); off += 2;       // total entries
  dv.setUint32(off, deflated.length + 30 + name.length, true); off += 4; // central dir size
  dv.setUint32(off, cdOff, true); off += 4;    // central dir offset
  dv.setUint16(off, 0, true); off += 2;        // comment length

  // Return as base64 data URI
  const bytes = new Uint8Array(header.buffer, 0, off);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `data:application/zip;base64,${base64}`;
}

function deflateRaw(data: Uint8Array): Uint8Array {
  // Simple compression stub — returns data as-is for now.
  // In production, use pako or zlib via Node.js built-in.
  return data;
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── CSV ────────────────────────────────────────

/** Escape a value for CSV */
export function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV row from values */
export function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(csvEscape).join(",");
}

// ─── Response helpers ──────────────────────────

export interface Capa3ExportResponse {
  periodo: { anho: number; mes: number };
  totalRegistros: number;
  formato: "TXT" | "CSV" | "JSON";
  /** Pre-signed URL or file path */
  archivoUrl: string;
  /** Convenience — inline content for small payloads */
  contenido?: string;
}

/** Wraps the response adding archivoUrl path */
export function buildExportResponse(
  anho: number,
  mes: number,
  totalRegistros: number,
  formato: "TXT" | "CSV" | "JSON",
  tipo: string,  // e.g. "libro-diario", "rg90-ventas"
  contenido?: string,
): Capa3ExportResponse {
  const ext = formato.toLowerCase();
  return {
    periodo: { anho, mes },
    totalRegistros,
    formato,
    archivoUrl: `/finance/${tipo}/download/${anho}/${mes}.${ext}`,
    ...(contenido ? { contenido } : {}),
  };
}
