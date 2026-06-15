/**
 * Intelligence & Peripherals Module — Shared Types & DTOs.
 *
 * Request/response schemas for the intelligence Fastify endpoints.
 * Covers DTC parsing, OpenCode diagnostics, HV safety protocols,
 * and Computer Vision (OCR) for license plates and Cédulas Verdes.
 *
 * RAM discipline: all types are plain interfaces (zero overhead).
 * File/image data uses streaming (no full buffering in RAM).
 *
 * @module intelligence/types
 */

// ─── DTC (Diagnostic Trouble Codes) ─────────────

/** OBD-II system classification */
export type DtcSystem = "Powertrain" | "Chassis" | "Body" | "Network" | "Unknown";

/** DTC severity level for workshop triage */
export type DtcSeverity = "Info" | "Warning" | "Critical" | "Emergency";

/** Single parsed Diagnostic Trouble Code */
export interface DtcCode {
  /** Standard OBD-II code (e.g. P0171, U0100) */
  code: string;
  /** Human-readable description (Spanish — Paraguayan context) */
  description: string;
  /** OBD-II system category */
  system: DtcSystem;
  /** Severity level */
  severity: DtcSeverity;
  /** Suggested actions for the mechanic */
  suggestions: string[];
  /** Whether this code is EV/HEV-specific */
  isEvRelated: boolean;
  /** Raw line from the scanner report (for traceability) */
  raw: string;
}

/** ECU (Electronic Control Unit) entry in a scan report */
export interface EcuEntry {
  /** ECU name (e.g. "Engine (PCM)", "Transmission (TCM)") */
  name: string;
  /** DTCs found in this ECU */
  codes: DtcCode[];
}

/** Fully parsed scanner report */
export interface ScanReport {
  /** Scanner brand/model (e.g. "Launch X431", "Thinkcar ThinkTool") */
  scannerBrand: string;
  /** Vehicle identification */
  vehicle: {
    brand: string;
    model: string;
    year: number | null;
    vin: string | null;
    plate: string | null;
    engineType: string | null;
  };
  /** Odometer reading at scan time */
  odometer: number | null;
  /** Scan date (ISO 8601) */
  scanDate: string | null;
  /** Per-ECU DTC entries */
  ecus: EcuEntry[];
  /** All unique codes flattened (convenience) */
  allCodes: DtcCode[];
  /** Total number of fault codes found */
  totalCodes: number;
  /** Critical/emergency codes found */
  criticalCount: number;
  /** EV/HEV related codes found */
  evRelatedCount: number;
}

// ─── Diagnostic Engine (OpenCode) ──────────────

/** Input for the diagnosis engine */
export interface DiagnosisRequest {
  /** Parsed scan report */
  report: ScanReport;
  /** Optional vehicle history notes */
  vehicleHistory?: string | null;
  /** Customer-reported symptoms */
  customerComplaint?: string | null;
}

/** Single diagnosis finding */
export interface DiagnosisFinding {
  /** Related DTC code */
  dtcCode: string;
  /** Root cause analysis */
  rootCause: string;
  /** Probability (0–100) */
  confidence: number;
  /** Recommended repair actions */
  recommendedActions: string[];
  /** Estimated difficulty (1–5) */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Parts that may need replacement */
  suggestedParts: string[];
}

/** Complete diagnostic result */
export interface DiagnosticResult {
  /** Vehicle summary */
  vehicleSummary: {
    brand: string;
    model: string;
    engineType: string | null;
    hasEvHvSystem: boolean;
  };
  /** Number of unique systems affected */
  systemsAffected: string[];
  /** Priority-ordered findings */
  findings: DiagnosisFinding[];
  /** Natural-language summary (Spanish) */
  summary: string;
  /** Whether an HV safety protocol is required */
  requiresHvProtocol: boolean;
  /** Generated ISO timestamp */
  generatedAt: string;
}

// ─── HV Safety Protocol ─────────────────────────

/** PPE item required for HV work */
export interface PpeItem {
  /** Item name (e.g. "Guantes aislantes Clase 0") */
  item: string;
  /** Certification / standard */
  standard: string;
  /** Verification step */
  checkProcedure: string;
}

/** Step in the HV safety disconnect procedure */
export interface HvSafetyStep {
  /** Step order */
  order: number;
  /** Action description */
  action: string;
  /** Safety notes */
  warning: string | null;
  /** Expected output / verification */
  verification: string | null;
}

/** Complete High-Voltage safety protocol */
export interface HvSafetyProtocol {
  /** Vehicle identification */
  vehicle: {
    brand: string;
    model: string;
    year: number | null;
    plate: string | null;
    /** HV battery nominal voltage */
    hvBatteryVoltage: number | null;
    /** Battery type (Li-Ion, NiMH, etc.) */
    batteryType: string | null;
  };
  /** Risk assessment summary */
  riskAssessment: string;
  /** Required PPE */
  ppe: PpeItem[];
  /** Step-by-step disconnect procedure */
  disconnectProcedure: HvSafetyStep[];
  /** Minimum wait time after disconnect (minutes) */
  waitTimeMinutes: number;
  /** Voltage verification procedure */
  voltageVerification: string;
  /** Emergency contacts */
  emergencyContacts: string[];
  /** Generated ISO timestamp */
  generatedAt: string;
}

// ─── OCR (Computer Vision) ──────────────────────

/** Type of document to OCR */
export type OcrDocumentType = "plate" | "cedula_verde";

/** Request to submit an OCR job */
export interface OcrJobRequest {
  /** Document type */
  documentType: OcrDocumentType;
  /** Optional: known vehicle VIN to cross-reference */
  knownVin?: string | null;
  /** Optional: tenant-specific OCR model tuning */
  options?: Record<string, string>;
}

/** Single OCR field result */
export interface OcrField {
  /** Field name */
  name: string;
  /** Recognized value */
  value: string;
  /** Confidence score (0–1) */
  confidence: number;
}

/** Result of OCR processing */
export interface OcrResult {
  /** Document type */
  documentType: OcrDocumentType;
  /** Recognized fields */
  fields: OcrField[];
  /** Full raw text extracted */
  rawText: string;
  /** Overall confidence (0–1) */
  overallConfidence: number;
  /** Processing time (ms) */
  processingTimeMs: number;
}

// ─── Async Job Queue ────────────────────────────

/** Possible states of an async processing job */
export type JobStatus = "queued" | "processing" | "completed" | "failed";

/** Async job tracking record */
export interface AsyncJob<T = unknown> {
  /** Unique job identifier */
  id: string;
  /** Job type descriptor */
  type: string;
  /** Current status */
  status: JobStatus;
  /** Progress percentage (0–100), null if unknown */
  progress: number | null;
  /** Result payload (available when completed) */
  result: T | null;
  /** Error message (available when failed) */
  error: string | null;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** ISO timestamp of completion/failure */
  finishedAt: string | null;
}

// ─── API Request/Response DTOs ──────────────────

/** POST /intelligence/dtc/parse request */
export interface ParseDtcRequest {
  /** Raw scanner report text */
  reportText: string;
  /** Optional scanner brand hint */
  scannerBrand?: string | null;
}

/** POST /intelligence/dtc/parse response */
export interface ParseDtcResponse {
  report: ScanReport;
}

/** POST /intelligence/dtc/diagnose request */
export interface DiagnoseRequest {
  /** Pre-parsed DTC codes */
  codes: string[];
  /** Vehicle brand */
  brand: string;
  /** Vehicle model */
  model: string;
  /** Engine type (optional) */
  engineType?: string | null;
  /** Customer complaint */
  customerComplaint?: string | null;
  /** Vehicle history notes */
  vehicleHistory?: string | null;
}

/** POST /intelligence/dtc/diagnose response */
export interface DiagnoseResponse {
  diagnosis: DiagnosticResult;
}

/** POST /intelligence/safety/protocol request */
export interface SafetyProtocolRequest {
  /** Vehicle brand */
  brand: string;
  /** Vehicle model */
  model: string;
  /** Manufacturing year */
  year?: number | null;
  /** License plate */
  plate?: string | null;
  /** HV battery voltage (V) */
  hvBatteryVoltage: number;
  /** Battery type */
  batteryType?: string | null;
}

/** POST /intelligence/safety/protocol response */
export interface SafetyProtocolResponse {
  protocol: HvSafetyProtocol;
}

/** POST /intelligence/ocr/... responses */
export interface OcrJobResponse {
  jobId: string;
  status: JobStatus;
  /** Poll this URL for updates */
  pollUrl: string;
}

/** GET /intelligence/ocr/jobs/:id response */
export type OcrJobPollResponse = AsyncJob<OcrResult>;

/** Error response */
export interface IntelligenceApiError {
  error: string;
  message: string;
  details?: Record<string, string[]>;
}

/**
 * Type helper for multipart file handler.
 * Used internally by OCR routes.
 */
export interface FileUpload {
  /** Field name in the multipart form */
  fieldname: string;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimetype: string;
  /** File size in bytes */
  bytesRead: number;
  /** Readable stream of file content */
  file: NodeJS.ReadableStream;
}

/**
 * Multipart file reference — returned by loadMultipart helper.
 */
export interface MultipartFile {
  file: NodeJS.ReadableStream;
  filename: string;
  mimetype: string;
  bytesRead: number;
}
