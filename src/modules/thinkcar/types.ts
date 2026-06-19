export type SourceChannel = "usb" | "bluetooth" | "email" | "api";

export type ImportStatus =
  | "pending"
  | "linked"
  | "manual_review"
  | "error"
  | "duplicate";

export interface DtcEntry {
  code: string;
  description: string;
  status: string;
  system: string;
}

export interface HealthSystem {
  name: string;
  status: string;
  score?: number;
}

export interface HealthReport {
  overallScore?: number;
  systems?: HealthSystem[];
}

export interface ParsedReport {
  brand: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  plate: string | null;
  odometer: number | null;
  scanDate: Date | null;
  dtcs: DtcEntry[];
  reportType: string | null;
  scannerBrand: string;
  rawText: string;
  healthReport?: HealthReport;
}

export interface LinkingResult {
  status: "linked" | "manual_review" | "error";
  vehicleId: string | null;
  ordenTrabajoId: string | null;
  clientId: string | null;
  message: string;
  mileageAlert?: string | null;
}

export interface PipelineResult {
  importId: string;
  status: ImportStatus;
  parsed: ParsedReport | null;
  linking: LinkingResult | null;
  duplicate: boolean;
  error?: string;
}
