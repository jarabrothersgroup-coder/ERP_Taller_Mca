import { createHash } from "node:crypto";
import type { DtcEntry, ParsedReport } from "../types.js";

const KNOWN_STATUS = /^(Almacenado|Pendiente|Corriente|HISTORIA|PASD|N\/A|Pasado|Activo|Inactivo)$/i;
const DTC_CODE = /\b((?:[PBCU][0-9][0-9A-F]{2,4})|(?:[0-9]{4}[A-Z]?))\b/;
const DTC_LINE = /(?:^|\s)([PBCU][0-9][0-9A-F]{2,4}|[0-9]{4}[A-Z]?)\s*/;
const LIST_DTC = /(\d+)\.\s*([A-Z0-9]{3,6})\s+(.+)/;

export function computeFileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function parseFromFilename(filename: string): Partial<ParsedReport> {
  const result: Partial<ParsedReport> = {};

  const name = filename.replace(/\.pdf$/i, "");

  const pattern1 =
    /^(?<brand>[A-Za-z0-9]+)_Pre-reparación_(?<vin>[^_]+)_Informe de diagnóstico.+_(?<ts>\d{14})$/;
  const m1 = name.match(pattern1);
  if (m1?.groups) {
    result.brand = m1.groups.brand ?? null;
    const vin = m1.groups.vin;
    result.vin = vin && vin !== "_" ? vin : null;
    result.reportType = "Pre-reparación";
    const ts = m1.groups.ts;
    if (ts) {
      const y = parseInt(ts.slice(0, 4), 10);
      const mo = parseInt(ts.slice(4, 6), 10) - 1;
      const d = parseInt(ts.slice(6, 8), 10);
      const h = parseInt(ts.slice(8, 10), 10);
      const mi = parseInt(ts.slice(10, 12), 10);
      const s = parseInt(ts.slice(12, 14), 10);
      result.scanDate = new Date(y, mo, d, h, mi, s);
    }
    return result;
  }

  const pattern2 = /_(?<id>\d+)_(?<vin>[A-HJ-NPR-Z0-9]{17})_(?<epoch>\d+)_.+_(?<brand>[A-Z]+)_prerepair_report$/;
  const m2 = name.match(pattern2);
  if (m2?.groups) {
    result.brand = m2.groups.brand ?? null;
    result.vin = m2.groups.vin ?? null;
    result.reportType = "Pre-reparación";
    const epoch = parseInt(m2.groups.epoch, 10);
    if (!isNaN(epoch)) {
      result.scanDate = new Date(epoch);
    }
    return result;
  }

  return result;
}

function extractHeader(text: string): Partial<ParsedReport> {
  const r: Partial<ParsedReport> = {};

  const brandMatch = text.match(/(?:Hacer|Marca|MARCAS?)\s*[:]\s*(.+?)(?:\n|$)/i);
  if (brandMatch) r.brand = brandMatch[1]!.trim();

  const modelMatch = text.match(/Modelo\s*[:]\s*(.+?)(?:\n|$)/i);
  if (modelMatch) r.model = modelMatch[1]!.trim();

  const yearMatch = text.match(/Año\s*[:]\s*(\d{4})/i);
  if (yearMatch) r.year = parseInt(yearMatch[1]!, 10);

  const vinMatch = text.match(/(?:Número de bastidor|VIN|Número de chasis|Vehículo Nº|Bastidor)\s*[:]\s*(.+?)(?:\n|$)/i);
  if (vinMatch) {
    const vin = vinMatch[1]!.trim();
    r.vin = vin && vin !== "N/A" ? vin : null;
  }

  const plateMatch = text.match(/(?:Número de licencia|Placa|Patente|Chapa)\s*[:]\s*(.+?)(?:\n|$)/i);
  if (plateMatch) {
    const plate = plateMatch[1]!.trim();
    r.plate = plate && plate !== "N/A" ? plate : null;
  }

  const odoMatch = text.match(/(?:Cuentakilómetros|Kilometraje|KM|Odometer)\s*[:]\s*([\d,.]+)/i);
  if (odoMatch) {
    r.odometer = parseInt(odoMatch[1]!.replace(/[,.]/g, ""), 10) || null;
  }

  const dateMatch = text.match(/(?:Tiempo|Hora de prueba|Fecha|Scan Time|Date)\s*[:]\s*(.+?)(?:\n|$)/i);
  if (dateMatch) {
    const dateStr = dateMatch[1]!.trim();
    const parsed = parseThinkcarDate(dateStr);
    if (parsed) r.scanDate = parsed;
  }

  const typeMatch = text.match(/(Pre-reparación|Post-reparación|Pre-Reparación|Post-Reparación|Diagnóstico|prerepair|postrepair)/i);
  if (typeMatch) r.reportType = typeMatch[1]!;

  return r;
}

function parseThinkcarDate(dateStr: string): Date | null {
  const mdy = dateStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (mdy) {
    return new Date(
      parseInt(mdy[3]!, 10),
      parseInt(mdy[1]!, 10) - 1,
      parseInt(mdy[2]!, 10),
      parseInt(mdy[4]!, 10),
      parseInt(mdy[5]!, 10),
      parseInt(mdy[6] ?? "0", 10),
    );
  }
  const ymd = dateStr.match(
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (ymd) {
    return new Date(
      parseInt(ymd[1]!, 10),
      parseInt(ymd[2]!, 10) - 1,
      parseInt(ymd[3]!, 10),
      parseInt(ymd[4]!, 10),
      parseInt(ymd[5]!, 10),
      parseInt(ymd[6] ?? "0", 10),
    );
  }
  return null;
}

function extractDtcsFormat1(text: string): DtcEntry[] {
  const dtcs: DtcEntry[] = [];
  const tableStart = text.search(/DTC\s*\n\s*Sistema\s*\n\s*Código/i);
  if (tableStart === -1) return dtcs;

  const tableText = text.slice(tableStart + 3);
  const lines = tableText.split("\n").map((l) => l.trim()).filter(Boolean);

  let i = 0;
  while (i < lines.length && !/^(Sistema|Código)/i.test(lines[i]!)) i++;
  while (i < lines.length && /^(Sistema|Código|Descripción|Estado)/i.test(lines[i]!)) i++;

  const groups: string[][] = [];
  let current: string[] = [];

  while (i < lines.length) {
    const line = lines[i]!;
    if (KNOWN_STATUS.test(line) && current.length > 0) {
      current.push(line);
      groups.push(current);
      current = [];
    } else if (DTC_LINE.test(line) && current.length > 0) {
      groups.push(current);
      current = [line];
    } else {
      current.push(line);
    }
    i++;
  }
  if (current.length > 0) groups.push(current);

  for (const g of groups) {
    if (g.length < 2) continue;
    const statusLine = g[g.length - 1]!;
    if (!KNOWN_STATUS.test(statusLine)) continue;

    const codeLine = g.find((l) => DTC_CODE.test(l));
    if (!codeLine) continue;
    const codeMatch = codeLine.match(DTC_CODE);
    if (!codeMatch) continue;

    const code = codeMatch[1]!.toUpperCase();
    const codeIdx = g.indexOf(codeLine);
    const systemLines = g.slice(0, codeIdx).filter((l) => l !== codeLine);
    const system = systemLines.join(" ").replace(/\s+/g, " ").trim();
    const descLines = g.slice(codeIdx + 1, g.length - 1);
    const description = descLines.join(" ").replace(/\s+/g, " ").trim();

    dtcs.push({
      code,
      description: description || code,
      status: statusLine,
      system: system || "Sistema General",
    });
  }

  return dtcs;
}

function extractDtcsFormat2(text: string): DtcEntry[] {
  const dtcs: DtcEntry[] = [];
  const lines = text.split("\n");

  let inDtcSection = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/Resultado de la inspección|DTC|Código de falla|Códigos de problemas/i.test(line)) {
      inDtcSection = true;
      continue;
    }

    if (inDtcSection) {
      const listMatch = line.match(LIST_DTC);
      if (listMatch) {
        dtcs.push({
          code: listMatch[2]!.toUpperCase(),
          description: listMatch[3]!.trim(),
          status: "Almacenado",
          system: "Sistema General",
        });
        continue;
      }

      const codeMatch = line.match(DTC_CODE);
      if (codeMatch) {
        const code = codeMatch[1]!.toUpperCase();
        const rest = line.replace(codeMatch[0]!, "").trim();
        dtcs.push({
          code,
          description: rest || code,
          status: "Almacenado",
          system: "Sistema General",
        });
      }
    }
  }

  return dtcs;
}

function extractDtcs(text: string): DtcEntry[] {
  const f1 = extractDtcsFormat1(text);
  if (f1.length > 0) return f1;
  const f2 = extractDtcsFormat2(text);
  if (f2.length > 0) return f2;

  const fallback: DtcEntry[] = [];
  const codeMatches = text.matchAll(/\b([PBCU][0-9][0-9A-F]{2,4}|[0-9]{4}[A-Z]?)\b/g);
  const seen = new Set<string>();
  for (const m of codeMatches) {
    const code = m[1]!.toUpperCase();
    if (!seen.has(code)) {
      seen.add(code);
      fallback.push({
        code,
        description: code,
        status: "Almacenado",
        system: "Sistema General",
      });
    }
  }
  return fallback;
}

export async function parseFromPdf(
  buffer: Buffer,
  filename?: string,
): Promise<ParsedReport> {
  const pdfParse = (await import("pdf-parse")).default;
  const parsed = await pdfParse(buffer);
  const rawText = parsed.text ?? "";
  const filenameHint = filename ? parseFromFilename(filename) : {};

  const header = extractHeader(rawText);
  const dtcs = extractDtcs(rawText);

  return {
    brand: header.brand ?? filenameHint.brand ?? null,
    model: header.model ?? filenameHint.model ?? null,
    year: header.year ?? filenameHint.year ?? null,
    vin: header.vin ?? filenameHint.vin ?? null,
    plate: header.plate ?? filenameHint.plate ?? null,
    odometer: header.odometer ?? filenameHint.odometer ?? null,
    scanDate: header.scanDate ?? filenameHint.scanDate ?? null,
    dtcs,
    reportType: header.reportType ?? filenameHint.reportType ?? null,
    scannerBrand: "Thinkcar ThinkTool Mini",
    rawText,
  };
}
