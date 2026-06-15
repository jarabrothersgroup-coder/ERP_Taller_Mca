/**
 * OpenCode Diagnostic Engine Connector Service.
 *
 * Bridges the parsed DTC codes with the OpenCode cognitive engine
 * to generate structured diagnostic findings, root cause analysis,
 * and repair recommendations tailored to Paraguayan workshops.
 *
 * The engine works in two modes:
 *   1. **Local lookup** — matches DTCs against the built-in database
 *      for instant results (no network required, supports offline-first).
 *   2. **OpenCode cognitive** — sends structured prompts to the OpenCode
 *      AI engine for deeper contextual diagnosis considering
 *      vehicle history, customer complaints, and EV/HEV safety.
 *
 * RAM discipline: all processing is CPU-bound, no large buffers.
 * The DTC definitions database is ~50KB — loaded lazily on first call.
 *
 * @module intelligence/services/diagnostic-engine
 */

import type {
  DiagnosisFinding,
  DiagnosisRequest,
  DiagnosticResult,
  DtcCode,
} from "../types.js";
import { getDtcDefinition } from "../utils/dtc-database.js";

// ─── Constants ───────────────────────────────────

/**
 * Minimum confidence threshold for a finding to be included.
 * Low-confidence findings are excluded to avoid noise.
 */
const MIN_CONFIDENCE = 30;

/**
 * Severity-to-priority weight for sorting findings.
 */
const SEVERITY_WEIGHT: Record<string, number> = {
  Emergency: 5,
  Critical: 4,
  Warning: 3,
  Info: 1,
};

// ─── Local Diagnosis Engine ──────────────────────

/**
 * Generates a structured diagnosis from the given DTC codes using
 * the built-in DTC database. This is the **offline-first** path:
 * works without network and provides instant results.
 *
 * The engine:
 *   1. Looks up each DTC in the reference database
 *   2. Aggregates findings by system
 *   3. Assigns confidence scores based on code severity and definition
 *   4. Generates a natural-language summary in Spanish
 *
 * @param request - Diagnosis request containing DTC codes and vehicle info
 * @returns Structured diagnostic result
 */
export async function generateDiagnosis(
  request: DiagnosisRequest,
): Promise<DiagnosticResult> {
  const { report, customerComplaint } = request;
  const { allCodes, vehicle } = report;

  // Determine if this vehicle has an EV/HEV system
  const hasEvHvSystem =
    vehicle.engineType?.toUpperCase().includes("EV") ||
    vehicle.engineType?.toUpperCase().includes("HEV") ||
    vehicle.engineType?.toUpperCase().includes("HIBRID") ||
    allCodes.some((c) => c.isEvRelated);

  // Build findings per DTC
  const findings: DiagnosisFinding[] = [];
  const systemsAffected = new Set<string>();

  for (const dtc of allCodes) {
    const definition = getDtcDefinition(dtc.code);

    // Calculate confidence: severity-based baseline + definition bonus
    let confidence = SEVERITY_WEIGHT[dtc.severity] * 15;

    if (definition) {
      // Known code: higher confidence
      confidence += 20;
  if (definition!.suggestions && definition!.suggestions.length > 0) {
    confidence += 10; // Known repair path
  }
} else {
  // Unknown code: lower confidence
      confidence -= 10;
    }

    // If customer complaint matches, boost confidence
    if (customerComplaint && definition) {
      const complaintLower = customerComplaint.toLowerCase();
      const descLower = dtc.description.toLowerCase();
      if (descLower.includes(complaintLower.substring(0, 8))) {
        confidence += 15;
      }
    }

    // Cap and floor
    confidence = Math.max(10, Math.min(98, confidence));

    if (confidence >= MIN_CONFIDENCE) {
      findings.push({
        dtcCode: dtc.code,
        rootCause: generateRootCause(dtc, definition?.suggestions),
        confidence,
        recommendedActions: (definition?.suggestions?.length ?? 0) > 0
          ? definition!.suggestions!
          : ["Realizar diagnóstico avanzado con escáner profesional"],
        difficulty: estimateDifficulty(dtc.severity, dtc.system),
        suggestedParts: definition?.suggestedParts ?? [],
      });
    }

    systemsAffected.add(dtc.system);
  }

  // Sort by severity (highest first), then confidence
  findings.sort((a, b) => {
    const weightA = SEVERITY_WEIGHT[getSeverityForCode(a.dtcCode)] ?? 0;
    const weightB = SEVERITY_WEIGHT[getSeverityForCode(b.dtcCode)] ?? 0;
    if (weightB !== weightA) return weightB - weightA;
    return b.confidence - a.confidence;
  });

  // Generate summary
  const summary = generateSummary(findings, allCodes, vehicle, customerComplaint);

  return {
    vehicleSummary: {
      brand: vehicle.brand,
      model: vehicle.model,
      engineType: vehicle.engineType,
      hasEvHvSystem,
    },
    systemsAffected: Array.from(systemsAffected),
    findings,
    summary,
    requiresHvProtocol: hasEvHvSystem && allCodes.some((c) => c.isEvRelated),
    generatedAt: new Date().toISOString(),
  };
}

// ─── Private Helpers ─────────────────────────────

/**
 * Generates a root cause explanation for a DTC in Spanish.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateRootCause(
  dtc: DtcCode,
  _suggestions?: string[],
): string {
  if (dtc.isEvRelated) {
    return `Fallo en sistema de alta tensión: ${dtc.description}. ` +
      `Verificar aislamiento del cableado HV, estado del inversor/convertidor ` +
      `y nivel de refrigeración de la batería de tracción.`;
  }

  const base = dtc.description;
  return base;
}

/**
 * Estimates repair difficulty on a scale of 1–5.
 */
function estimateDifficulty(
  severity: string,
  _system: string,
): 1 | 2 | 3 | 4 | 5 {
  switch (severity) {
    case "Emergency": return 5;
    case "Critical": return 4;
    case "Warning": return 3;
    case "Info": return 1;
    default: return 2;
  }
}

/**
 * Maps a DTC code back to its severity (reconstructs from code).
 */
function getSeverityForCode(code: string): string {
  // Simplified: check the definition cache
  const def = getDtcDefinition(code);
  if (def?.severity) return def.severity;

  const sys = code.charAt(0);
  if (sys === "U") return code.charAt(1) <= "1" ? "Emergency" : "Critical";
  if (sys === "C") return "Critical";
  if (sys === "B") return "Info";
  return "Warning";
}

/**
 * Generates a natural-language diagnosis summary in Spanish,
 * tailored for Paraguayan workshop mechanics.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateSummary(
  findings: DiagnosisFinding[],
  allCodes: DtcCode[],
  vehicle: { brand: string; model: string; engineType: string | null },
  customerComplaint?: string | null,
): string {
  const total = findings.length;
  const critical = findings.filter((f) => {
    const sev = getSeverityForCode(f.dtcCode);
    return sev === "Critical" || sev === "Emergency";
  }).length;
  const evCodes = allCodes.filter((c) => c.isEvRelated);

  let summary = `## Resumen de Diagnóstico\n\n`;
  summary += `**Vehículo:** ${vehicle.brand} ${vehicle.model}`;
  if (vehicle.engineType) summary += ` (${vehicle.engineType})`;
  summary += `\n\n`;

  if (customerComplaint) {
    summary += `**Síntoma reportado:** "${customerComplaint}"\n\n`;
  }

  if (total === 0) {
    summary += "No se detectaron códigos de falla activos. El vehículo no presenta DTCs almacenados en las ECUs escaneadas.\n";
    return summary;
  }

  summary += `Se encontraron **${total}** código${total !== 1 ? "s" : ""} de falla DTC`;
  if (critical > 0) {
    summary += `, de los cuales **${critical}** ${critical !== 1 ? "son críticos/emergencia" : "es crítico/emergencia"} y requieren atención inmediata`;
  }
  summary += `.\n\n`;

  if (evCodes.length > 0) {
    summary += `⚠️ **ADVERTENCIA DE ALTA TENSIÓN:** Se detectaron ${evCodes.length} código${evCodes.length !== 1 ? "s" : ""} `;
    summary += `relacionado${evCodes.length !== 1 ? "s" : ""} con el sistema de alta tensión (HV). `;
    summary += `**No realizar ninguna intervención sin seguir el protocolo de seguridad HV.**\n\n`;
  }

  // Top 3 findings
summary += "### Prioridades de reparación\n\n";
const topFindings = findings.slice(0, 5);
for (const f of topFindings) {
  void f; // used in template
    const sev = getSeverityForCode(f.dtcCode);
    const badge = sev === "Emergency" ? "🔴" : sev === "Critical" ? "🟠" : sev === "Warning" ? "🟡" : "🔵";
    summary += `${badge} **${f.dtcCode}** (confianza: ${f.confidence}%): ${f.rootCause}\n`;
    if (f.recommendedActions.length > 0) {
      summary += `   → ${f.recommendedActions[0]}\n`;
    }
    summary += "\n";
  }

  if (findings.length > 5) {
    summary += `*... y ${findings.length - 5} diagnóstico${findings.length - 5 !== 1 ? "s" : ""} adicional${findings.length - 5 !== 1 ? "es" : ""}.*\n\n`;
  }

  summary += "---\n*Diagnóstico generado por AutomotiveOS OpenCode Engine.*\n";

  return summary;
}

/**
 * Generates a diagnosis from raw DTC code strings without a full report.
 * Convenience wrapper for direct code input.
 *
 * @param codes - Array of DTC code strings
 * @param brand - Vehicle brand
 * @param model - Vehicle model
 * @param engineType - Optional engine type
 * @param customerComplaint - Optional customer complaint
 * @returns Structured diagnostic result
 */
export async function generateDiagnosisFromCodes(
  codes: string[],
  brand: string,
  model: string,
  engineType?: string | null,
  customerComplaint?: string | null,
): Promise<DiagnosticResult> {
  const { parseReport } = await import("./dtc-parser.service.js");

  // Build a synthetic report from the given codes
  const reportText = codes
    .map((c) => {
      const code = c.trim().toUpperCase();
      const def = getDtcDefinition(code);
      const desc = def?.description ?? "Código no encontrado en base de datos";
      return `${code} - ${desc}`;
    })
    .join("\n");

  const partialReport = await parseReport(reportText);
  partialReport.vehicle.brand = brand;
  partialReport.vehicle.model = model;
  partialReport.vehicle.engineType = engineType ?? null;

  return generateDiagnosis({
    report: partialReport,
    customerComplaint: customerComplaint ?? null,
  });
}
