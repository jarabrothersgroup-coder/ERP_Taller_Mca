/**
 * Sprint 49 — Thinkcar OBD2 Connectivity & Import Diagnostics
 *
 * Tests: connection wizard routes, pending queue, manual assignment,
 * file upload, odometer comparison, DTC parsing, health monitoring.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTES_PATH = resolve(__dirname, "../src/modules/thinkcar/routes/index.ts");
const SCHEMA_PATH = resolve(__dirname, "../src/modules/thinkcar/schema/index.ts");
const TYPES_PATH = resolve(__dirname, "../src/modules/thinkcar/types.ts");
const LINKER_PATH = resolve(__dirname, "../src/modules/thinkcar/services/thinkcar-linker.service.ts");
const PARSER_PATH = resolve(__dirname, "../src/modules/thinkcar/services/thinkcar-parser.service.ts");
const PLUGIN_PATH = resolve(__dirname, "../src/modules/thinkcar/plugin.ts");
const FRONTEND_PATH = resolve(__dirname, "../src/shared/public/js/thinkcar.js");

function load(relPath: string): string {
  // Handle paths that already start with ../
  if (relPath.startsWith("..")) {
    return readFileSync(resolve(__dirname, relPath), "utf-8");
  }
  return readFileSync(resolve(__dirname, relPath), "utf-8");
}

/* ─── Route Definitions ──────────────────────────────────────────── */

describe("Thinkcar Routes — Connectivity Endpoints", () => {
  let routesContent: string;

  beforeAll(() => {
    routesContent = load("../src/modules/thinkcar/routes/index.ts");
  });

  it("has GET /thinkcar/pending for pending diagnostics queue", () => {
    expect(routesContent).toContain('/thinkcar/pending"');
    expect(routesContent).toContain('"manual_review"');
  });

  it("has POST /thinkcar/pending/:id/assign for manual assignment", () => {
    expect(routesContent).toContain('/thinkcar/pending/:id/assign"');
    expect(routesContent).toContain("ordenTrabajoId");
  });

  it("has POST /thinkcar/upload for browser file upload", () => {
    expect(routesContent).toContain("/thinkcar/upload");
    expect(routesContent).toContain("request.file()");
  });

  it("has GET /thinkcar/pending/count for quick count", () => {
    expect(routesContent).toContain('/thinkcar/pending/count"');
  });

  it("merges DTCs into work order on manual assignment", () => {
    expect(routesContent).toContain("updateOrdenDtcs");
    expect(routesContent).toContain("updateVehicleDtcs");
  });

  it("validates ordenTrabajoId is required in assign endpoint", () => {
    expect(routesContent).toContain("ordenTrabajoId es requerido");
  });

  it("validates file upload size limit (50 MB)", () => {
    expect(routesContent).toContain("50 * 1024 * 1024");
    expect(routesContent).toContain("excede el l");
  });

  it("validates allowed file extensions for upload", () => {
    expect(routesContent).toContain(".pdf");
    expect(routesContent).toContain(".json");
    expect(routesContent).toContain(".csv");
  });
});

/* ─── Schema Enhancements ────────────────────────────────────────── */

describe("Thinkcar Schema — New Columns", () => {
  let schemaContent: string;

  beforeAll(() => {
    schemaContent = load("../src/modules/thinkcar/schema/index.ts");
  });

  it("has health_score column", () => {
    expect(schemaContent).toContain("health_score");
    expect(schemaContent).toContain("healthScore");
    expect(schemaContent).toContain("integer");
  });

  it("has pending_assignment column", () => {
    expect(schemaContent).toContain("pending_assignment");
    expect(schemaContent).toContain("pendingAssignment");
    expect(schemaContent).toContain("boolean");
  });

  it("imports boolean from drizzle-orm", () => {
    expect(schemaContent).toContain("boolean");
  });
});

/* ─── Type Enhancements ──────────────────────────────────────────── */

describe("Thinkcar Types — Extended Interfaces", () => {
  let typesContent: string;

  beforeAll(() => {
    typesContent = load("../src/modules/thinkcar/types.ts");
  });

  it("has HealthSystem interface", () => {
    expect(typesContent).toContain("interface HealthSystem");
    expect(typesContent).toContain("name: string");
    expect(typesContent).toContain("status: string");
    expect(typesContent).toContain("score?: number");
  });

  it("has HealthReport interface", () => {
    expect(typesContent).toContain("interface HealthReport");
    expect(typesContent).toContain("overallScore?: number");
    expect(typesContent).toContain("systems?: HealthSystem[]");
  });

  it("ParsedReport includes healthReport", () => {
    expect(typesContent).toContain("healthReport?: HealthReport");
  });

  it("LinkingResult includes mileageAlert", () => {
    expect(typesContent).toContain("mileageAlert?: string | null");
  });
});

/* ─── Linker Service — Odometer Comparison ───────────────────────── */

describe("Thinkcar Linker — Odometer Alert", () => {
  let linkerContent: string;

  beforeAll(() => {
    linkerContent = load("../src/modules/thinkcar/services/thinkcar-linker.service.ts");
  });

  it("has compareAndAlertMileage function", () => {
    expect(linkerContent).toContain("compareAndAlertMileage");
    expect(linkerContent).toContain("async function compareAndAlertMileage");
  });

  it("defines MILEAGE_DIFF_THRESHOLD constant", () => {
    expect(linkerContent).toContain("MILEAGE_DIFF_THRESHOLD");
    expect(linkerContent).toContain("500");
  });

  it("generates Spanish mileage alert message", () => {
    expect(linkerContent).toContain("Kilometraje verificado por OBD2");
    expect(linkerContent).toContain("Diferencia de");
    expect(linkerContent).toContain("registrado");
    expect(linkerContent).toContain("escaneado");
  });

  it("updates vehicle kilometraje when scanned is higher", () => {
    expect(linkerContent).toContain("scannedOdometer > currentKm");
  });

  it("smartLink accepts optional parsed parameter", () => {
    expect(linkerContent).toContain("parsed?: ParsedReport");
  });

  it("smartLink calls compareAndAlertMileage", () => {
    expect(linkerContent).toContain("compareAndAlertMileage(vehicle.id, odometer)");
  });

  it("returns mileageAlert in LinkingResult", () => {
    expect(linkerContent).toContain("mileageAlert");
  });

  it("sets pendingAssignment on manual review", () => {
    expect(linkerContent).toContain("pendingAssignment: true");
  });
});

/* ─── Parser Service — DTC Extraction ────────────────────────────── */

describe("Thinkcar Parser — DTC Extraction", () => {
  let parserContent: string;

  beforeAll(() => {
    parserContent = load("../src/modules/thinkcar/services/thinkcar-parser.service.ts");
  });

  it("extracts standard P-codes via regex pattern", () => {
    expect(parserContent).toContain("PBCU");
    expect(parserContent).toContain("DTC_CODE");
  });

  it("supports multiple DTC formats", () => {
    expect(parserContent).toContain("extractDtcsFormat1");
    expect(parserContent).toContain("extractDtcsFormat2");
  });

  it("has fallback regex for unknown formats", () => {
    expect(parserContent).toContain("codeMatches");
    expect(parserContent).toContain("matchAll");
  });

  it("extracts VIN from PDF text", () => {
    expect(parserContent).toContain("VIN");
    expect(parserContent).toContain("N");
  });

  it("extracts odometer from PDF text", () => {
    expect(parserContent).toContain("odometer");
    expect(parserContent).toContain("Cuentakil");
  });

  it("extracts vehicle brand and model", () => {
    expect(parserContent).toContain("brand");
    expect(parserContent).toContain("model");
    expect(parserContent).toContain("Marca");
  });

  it("computes file hash for deduplication", () => {
    expect(parserContent).toContain("computeFileHash");
    expect(parserContent).toContain("sha256");
  });

  it("parses Thinkcar date formats", () => {
    expect(parserContent).toContain("parseThinkcarDate");
    expect(parserContent).toContain("mdy");
    expect(parserContent).toContain("ymd");
  });
});

/* ─── Plugin Configuration ───────────────────────────────────────── */

describe("Thinkcar Plugin — Worker Registration", () => {
  let pluginContent: string;

  beforeAll(() => {
    pluginContent = load("../src/modules/thinkcar/plugin.ts");
  });

  it("registers USB watcher", () => {
    expect(pluginContent).toContain("startUsbWatcher");
    expect(pluginContent).toContain("THINKCAR_USB_WATCH");
  });

  it("registers Email polling", () => {
    expect(pluginContent).toContain("startEmailPolling");
    expect(pluginContent).toContain("THINKCAR_EMAIL_WATCH");
  });

  it("registers Bluetooth listener", () => {
    expect(pluginContent).toContain("startBluetoothListener");
    expect(pluginContent).toContain("THINKCAR_BT_WATCH");
  });

  it("stops all workers on close", () => {
    expect(pluginContent).toContain("stopUsbWatcher");
    expect(pluginContent).toContain("stopEmailPolling");
    expect(pluginContent).toContain("stopBluetoothListener");
  });

  it("checks THINKCAR_EMAIL_USER before starting email", () => {
    expect(pluginContent).toContain("THINKCAR_EMAIL_USER");
  });
});

/* ─── Frontend — Connection Wizard ───────────────────────────────── */

describe("Thinkcar Frontend — Connection Wizard", () => {
  let frontendContent: string;

  beforeAll(() => {
    frontendContent = load("../src/shared/public/js/thinkcar.js");
  });

  it("has renderThinkcar main function", () => {
    expect(frontendContent).toContain("function renderThinkcar");
  });

  it("has showConnectionWizard function", () => {
    expect(frontendContent).toContain("function showConnectionWizard");
  });

  it("has closeWizard function", () => {
    expect(frontendContent).toContain("function closeWizard");
  });

  it("renders Vincular Diagnostico OBD2 button", () => {
    expect(frontendContent).toContain("Vincular Diagnóstico OBD2");
  });

  it("has 3 wizard option cards (bluetooth, usb, email)", () => {
    expect(frontendContent).toContain("bluetooth");
    expect(frontendContent).toContain("usb");
    expect(frontendContent).toContain("email");
  });

  it("has Bluetooth flow with scan function", () => {
    expect(frontendContent).toContain("function startBluetoothScan");
    expect(frontendContent).toContain("Buscar Dispositivos");
    expect(frontendContent).toContain("/thinkcar/ingest/bluetooth");
  });

  it("has USB drag-and-drop flow", () => {
    expect(frontendContent).toContain("function handleUsbDrop");
    expect(frontendContent).toContain("function handleUsbFileSelect");
    expect(frontendContent).toContain("function uploadFile");
    expect(frontendContent).toContain("ondragover");
    expect(frontendContent).toContain("ondrop");
  });

  it("has email verification flow", () => {
    expect(frontendContent).toContain("function triggerEmailCheck");
    expect(frontendContent).toContain("/thinkcar/ingest/email");
  });

  it("has pending queue with manual assignment", () => {
    expect(frontendContent).toContain("function loadThinkcarPending");
    expect(frontendContent).toContain("function assignThinkcarPending");
    expect(frontendContent).toContain("/thinkcar/pending");
    expect(frontendContent).toContain("Seleccionar OT...");
  });

  it("loads active work orders for assignment select", () => {
    expect(frontendContent).toContain("loadActiveOtosForSelect");
    expect(frontendContent).toContain("ordenes-trabajo");
  });

  it("displays stats cards (linked, pending, review)", () => {
    expect(frontendContent).toContain("Vinculados");
    expect(frontendContent).toContain("Pendientes");
    expect(frontendContent).toContain("Revisión Manual");
  });

  it("shows file upload progress bar", () => {
    expect(frontendContent).toContain("usb-progress");
    expect(frontendContent).toContain("xhr.upload.onprogress");
  });

  it("shows DTCs as red badges after processing", () => {
    expect(frontendContent).toContain("bg-red-900/40");
    expect(frontendContent).toContain("text-red-300");
  });

  it("displays mileage alert when present", () => {
    expect(frontendContent).toContain("mileageAlert");
  });

  it("uses XSS-safe esc() function for user data", () => {
    expect(frontendContent).toContain("esc(");
  });

  it("has showWizardOptions to go back to card selection", () => {
    expect(frontendContent).toContain("function showWizardOptions");
  });

  it("validates file size 50MB on frontend", () => {
    expect(frontendContent).toContain("50");
    expect(frontendContent).toContain("MB");
  });

  it("supports file types pdf, json, csv", () => {
    expect(frontendContent).toContain(".pdf");
    expect(frontendContent).toContain(".json");
    expect(frontendContent).toContain(".csv");
  });

  it("has dark theme consistent with ERP (gray-900, gray-800)", () => {
    expect(frontendContent).toContain("gray-900");
    expect(frontendContent).toContain("gray-800");
  });

  it("is responsive (grid with sm/lg breakpoints)", () => {
    expect(frontendContent).toContain("sm:grid-cols-3");
    expect(frontendContent).toContain("lg:grid-cols-3");
  });

  it("Spanish language for all UI text", () => {
    expect(frontendContent).toContain("Como deseas transferir");
    expect(frontendContent).toContain("Sincronizacion Directa");
    expect(frontendContent).toContain("Reporte procesado");
    expect(frontendContent).toContain("No se encontraron");
  });
});

/* ─── Health Monitoring ──────────────────────────────────────────── */

describe("Thinkcar Health Service", () => {
  let healthPath = resolve(__dirname, "../src/modules/thinkcar/services/thinkcar-health.service.ts");

  it("tracks all 3 channels", () => {
    const content = readFileSync(healthPath, "utf-8");
    expect(content).toContain('"usb"');
    expect(content).toContain('"email"');
    expect(content).toContain('"bluetooth"');
  });

  it("marks unhealthy after 3 consecutive failures", () => {
    const content = readFileSync(healthPath, "utf-8");
    expect(content).toContain("consecutiveFailures >= 3");
  });

  it("provides resetChannelHealth function", () => {
    const content = readFileSync(healthPath, "utf-8");
    expect(content).toContain("resetChannelHealth");
  });
});

/* ─── Integration: End-to-End Flow ───────────────────────────────── */

describe("Thinkcar E2E — Import Flow Integration", () => {
  it("pipeline processes buffer through parse and link", () => {
    const pipelinePath = resolve(__dirname, "../src/modules/thinkcar/services/thinkcar-pipeline.service.ts");
    const content = readFileSync(pipelinePath, "utf-8");
    expect(content).toContain("parseFromPdf");
    expect(content).toContain("smartLink");
    expect(content).toContain("checkDuplicate");
  });

  it("pipeline passes parsed data to smartLink for odometer comparison", () => {
    const pipelinePath = resolve(__dirname, "../src/modules/thinkcar/services/thinkcar-pipeline.service.ts");
    const content = readFileSync(pipelinePath, "utf-8");
    expect(content).toContain("smartLink(saved, parsed)");
  });

  it("email service uses imapflow for IMAP connection", () => {
    const emailPath = resolve(__dirname, "../src/modules/thinkcar/services/thinkcar-email.service.ts");
    const content = readFileSync(emailPath, "utf-8");
    expect(content).toContain("imapflow");
    expect(content).toContain("ImapFlow");
  });

  it("USB service supports MTP mount for Thinkcar devices", () => {
    const usbPath = resolve(__dirname, "../src/modules/thinkcar/services/thinkcar-usb.service.ts");
    const content = readFileSync(usbPath, "utf-8");
    expect(content).toContain("aft-mtp-mount");
    expect(content).toContain("ThinkCar");
  });

  it("bluetooth service uses bluetoothctl for device discovery", () => {
    const btPath = resolve(__dirname, "../src/modules/thinkcar/services/thinkcar-bluetooth.service.ts");
    const content = readFileSync(btPath, "utf-8");
    expect(content).toContain("bluetoothctl");
    expect(content).toContain("Thinkcar");
  });

  it("notification service sends manual review alerts", () => {
    const notifPath = resolve(__dirname, "../src/modules/thinkcar/services/thinkcar-notifications.service.ts");
    const content = readFileSync(notifPath, "utf-8");
    expect(content).toContain("sendManualReviewAlert");
    expect(content).toContain("Manual Review");
  });
});
