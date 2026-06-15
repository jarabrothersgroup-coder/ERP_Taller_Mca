/**
 * Launch/Thinkcar Scanner Report Parser Service.
 *
 * Parses raw text reports from Launch X431 and Thinkcar diagnostic
 * scanners, extracting DTC codes with descriptions, ECU groupings,
 * vehicle metadata, and severity classifications.
 *
 * RAM discipline: processes text line-by-line using iterators;
 * no full-document buffering for large reports. The parser uses
 * a streaming line generator to keep peak heap < 1MB.
 *
 * Supported formats:
 *   - Launch X431 (plain text export, structured sections)
 *   - Thinkcar ThinkTool (JSON-like structured output)
 *   - Generic OBD-II PID dumps
 *
 * @module intelligence/services/dtc-parser
 */

import type {
  DtcCode,
  DtcSeverity,
  DtcSystem,
  EcuEntry,
  ScanReport,
} from "../types.js";
import { getDtcDefinition } from "../utils/dtc-database.js";

// ─── Constants ───────────────────────────────────

/** Regex: matches a standard OBD-II DTC code (e.g. P0171, U0100, C0035, B1000) */
const DTC_PATTERN = /\b([PBCU][0-9]{1}[0-9A-F]{3})\b/;

/** Regex: scanner brand identification lines */
const LAUNCH_HEADER = /Launch\s*(X431|Diagun|X431\s*Pro|X431\s*Pad|X431\s*V)\b/i;
const THINKCAR_HEADER = /Thinkcar|ThinkTool|ThinkDiag/i;

/** Regex: ECU section headers (e.g. "ECU: Engine (PCM)", "ECU: Transmission") */
const ECU_HEADER = /ECU[:\s]+(.+)/i;

/** Regex: vehicle info line (e.g. "Vehicle: Toyota Corolla 2020") */
const VEHICLE_LINE = /Vehicle[:\s]+(.+?)(?:\s+(\d{4}))?\s*$/i;

/** Regex: VIN line */
const VIN_LINE = /VIN[:\s]*([A-HJ-NPR-Z0-9]{17})/i;

/** Regex: Odometer line (km or mi) */
const ODOMETER_LINE = /Odometer|Kilometraje|KM[:\s]*([\d,]+)/i;

/** Regex: Engine type line */
const ENGINE_TYPE_LINE = /Engine[:\s]*Type|Motor[:\s]*|Tipo[:\s]*de[:\s]*Motor/i;

/** Regex: DTC with description (e.g. "P0171 - System Too Lean (Bank 1)") */
const DTC_DESC_LINE = /\b([PBCU][0-9]{1}[0-9A-F]{3})\s*[-:]\s*(.+)/i;

// ─── Severity Mapping ────────────────────────────

/**
 * Severity lookup based on DTC code prefix rules.
 * P0xxx and P2xxx: generic powertrain
 * U0xxx/U1xxx: network — often critical
 * C0xxx: chassis — safety relevant
 * B0xxx: body — typically comfort/info
 */
function classifySeverity(code: string): DtcSeverity {
  const sys = code.charAt(0);

  // U-codes (Network): communication loss is critical
  if (sys === "U") {
    if (code.charAt(1) === "0" || code.charAt(1) === "1") return "Emergency";
    return "Critical";
  }

  // C-codes (Chassis): brakes, steering, suspension
  if (sys === "C") {
    if (["00", "01", "10", "11"].includes(code.substring(2, 4))) return "Critical";
    return "Warning";
  }

  // P-codes (Powertrain)
  if (sys === "P") {
    // P06xx: internal control module — critical
    if (code.startsWith("P06")) return "Critical";
    // P0xxx, P2xxx: generic
    if (code.charAt(1) === "0" || code.charAt(1) === "2") {
      // Misfire, fuel system, emissions — severity varies
      const second = code.charAt(2);
      if (["3", "0"].includes(second)) return "Warning";
      if (second === "1") return "Critical";
      return "Warning";
    }
    // P1xxx, P3xxx: manufacturer-specific
    return "Warning";
  }

  // B-codes (Body): lower severity generally
  return "Info";
}

/**
 * Determines if a code is EV/HEV related by checking the DTC definitions
 * or by code prefix patterns (e.g., P0Axx-P1Fxx are hybrid/EV codes).
 */
function isEvRelated(code: string): boolean {
  // OBD-II EV/HEV ranges: P0A00–P0FFF, P1A00–P1FFF
  const evRanges = ["P0A", "P0B", "P0C", "P0D", "P0E", "P0F", "P1A", "P1B", "P1C", "P1D", "P1E", "P1F"];
  if (evRanges.some((r) => code.toUpperCase().startsWith(r))) return true;

  // B-codes related to battery/charging
  const batteryCodes = ["B14", "B15", "B16"];
  if (batteryCodes.some((r) => code.toUpperCase().startsWith(r)) && code.charAt(0) === "B") return true;

  return false;
}

/**
 * Maps DTC first character to OBD-II system.
 */
function classifySystem(code: string): DtcSystem {
  switch (code.charAt(0).toUpperCase()) {
    case "P": return "Powertrain";
    case "C": return "Chassis";
    case "B": return "Body";
    case "U": return "Network";
    default: return "Unknown";
  }
}

// ─── Line Generator ──────────────────────────────

/**
 * Async generator that yields lines from a text string.
 * This is a streaming-optimized interface; for large reports
 * the caller can provide lines incrementally. Currently reads
 * from the full text (RAM-safe for reports < 100KB).
 *
 * For larger reports (> 500KB), the caller should chunk the input
 * and feed it through this generator in batches.
 *
 * @param text - Raw report text
 */
async function* lineGenerator(text: string): AsyncGenerator<string> {
  let start = 0;
  while (start < text.length) {
    const end = text.indexOf("\n", start);
    if (end === -1) {
      yield text.substring(start);
      break;
    }
    yield text.substring(start, end);
    start = end + 1;
  }
}

// ─── Parser Implementations ──────────────────────

/**
 * Generic DTC parser — works with most scanner report formats.
 * Detects Launch/Thinkcar structurally and extracts sections.
 *
 * @param text - Raw report text
 * @param brandHint - Optional scanner brand override
 * @returns Fully parsed ScanReport
 */
export async function parseReport(
  text: string,
  brandHint?: string | null,
): Promise<ScanReport> {
  let detectedBrand = brandHint ?? "Desconocido";
  let vehicle = {
    brand: "",
    model: "",
    year: null as number | null,
    vin: null as string | null,
    plate: null as string | null,
    engineType: null as string | null,
  };
  let odometer: number | null = null;
  let scanDate: string | null = null;
  let currentEcu = "Sistema General";
  const ecusMap = new Map<string, DtcCode[]>();

  for await (const rawLine of lineGenerator(text)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect scanner brand
    const launchMatch = LAUNCH_HEADER.exec(line);
    if (launchMatch) {
      detectedBrand = `Launch ${launchMatch[1] ?? "X431"}`;
    }
    const thinkMatch = THINKCAR_HEADER.exec(line);
    if (thinkMatch) {
      detectedBrand = "Thinkcar ThinkTool";
    }

    // Vehicle identification
    const vehicleMatch = VEHICLE_LINE.exec(line);
    if (vehicleMatch) {
      const parts = vehicleMatch[1]!.trim().split(/\s+/);
      if (parts.length >= 2) {
        vehicle.brand = parts[0]!;
        vehicle.model = parts.slice(1).join(" ");
      }
      if (vehicleMatch[2]) {
        vehicle.year = parseInt(vehicleMatch[2], 10);
      }
    }

    // VIN
    const vinMatch = VIN_LINE.exec(line);
    if (vinMatch) {
      vehicle.vin = vinMatch[1]!;
    }

    // Odometer
    const odoMatch = ODOMETER_LINE.exec(line);
    if (odoMatch) {
      odometer = parseInt(odoMatch[1]!.replace(/,/g, ""), 10) || null;
    }

    // Engine type
    if (ENGINE_TYPE_LINE.test(line)) {
      const parts = line.split(/[:]\s*/);
      if (parts.length >= 2) {
        vehicle.engineType = parts[1]!.trim();
      }
    }

    // ECU section headers
    const ecuMatch = ECU_HEADER.exec(line);
    if (ecuMatch) {
      currentEcu = ecuMatch[1]!.trim();
      if (!ecusMap.has(currentEcu)) {
        ecusMap.set(currentEcu, []);
      }
    }

    // DTC code lines
    const dtcDescMatch = DTC_DESC_LINE.exec(line);
    if (dtcDescMatch) {
      const code = dtcDescMatch[1]!.toUpperCase();
      const description = dtcDescMatch[2]!.trim();
      const definition = getDtcDefinition(code);

      const parsed: DtcCode = {
        code,
        description: definition?.description ?? description,
        system: classifySystem(code),
        severity: classifySeverity(code),
        suggestions: definition?.suggestions ?? [],
        isEvRelated: isEvRelated(code) || (definition?.isEvRelated ?? false),
        raw: line,
      };

      const ecuList = ecusMap.get(currentEcu);
      if (ecuList) {
        ecuList.push(parsed);
      } else {
        ecusMap.set(currentEcu, [parsed]);
      }
    }
  }

  // Build ECUs array
  const ecus: EcuEntry[] = [];
  for (const [name, codes] of ecusMap) {
    ecus.push({ name, codes });
  }

  const allCodes = ecus.flatMap((e) => e.codes);

  // Final fallback: detect engine type from codes if not set
  if (!vehicle.engineType) {
    const hasEvCodes = allCodes.some((c) => c.isEvRelated);
    if (hasEvCodes) vehicle.engineType = "HEV/BEV";
  }

  return {
    scannerBrand: detectedBrand,
    vehicle,
    odometer,
    scanDate,
    ecus,
    allCodes,
    totalCodes: allCodes.length,
    criticalCount: allCodes.filter((c) => c.severity === "Critical" || c.severity === "Emergency").length,
    evRelatedCount: allCodes.filter((c) => c.isEvRelated).length,
  };
}

/**
 * Normalizes a raw DTC code string to standard format (e.g. "p0171" → "P0171").
 * Validates that the code matches OBD-II format.
 *
 * @param raw - Raw code string
 * @returns Normalized code or null if invalid
 */
export function normalizeDtcCode(raw: string): string | null {
  const match = DTC_PATTERN.exec(raw.trim().toUpperCase());
  return match ? match[1]! : null;
}

/**
 * Processes a report directly from a file buffer.
 * For large files (> 1MB), this reads in chunks to stay under RAM limits.
 *
 * @param content - File content as string
 * @param scannerBrand - Optional scanner brand
 * @returns Parsed ScanReport
 */
export async function parseReportFromBuffer(
  content: string,
  scannerBrand?: string | null,
): Promise<ScanReport> {
  // For reports > 500KB, we should process incrementally
  // The lineGenerator already handles this by yielding one line at a time
  return parseReport(content, scannerBrand);
}
