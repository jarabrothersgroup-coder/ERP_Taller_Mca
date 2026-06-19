/**
 * Sprint 50 — Frontend UI for AI Copilot, SIFEN Monitor, WhatsApp Monitor
 *
 * Tests: frontend modules, sidebar integration, markdown rendering,
 * status indicators, action buttons, responsive design.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function load(relPath: string): string {
  return readFileSync(resolve(__dirname, relPath), "utf-8");
}

/* ─── AI Copilot Module ─────────────────────────────────────────── */

describe("AI Copilot — Frontend Module", () => {
  let content: string;
  beforeAll(() => { content = load("../src/shared/public/js/ai-copilot.js"); });

  it("has renderAiCopilotSidebar function", () => {
    expect(content).toContain("function renderAiCopilotSidebar");
  });

  it("has toggleAiCopilot function", () => {
    expect(content).toContain("function toggleAiCopilot");
  });

  it("has closeAiCopilot function", () => {
    expect(content).toContain("function closeAiCopilot");
  });

  it("renders Copiloto IA title in sidebar", () => {
    expect(content).toContain("Copiloto IA");
    expect(content).toContain("Consulta Tecnica");
  });

  it("has DTC input field", () => {
    expect(content).toContain("ai-dtc-input");
    expect(content).toContain("P0300, P0171, P0420");
  });

  it("has description textarea for custom faults", () => {
    expect(content).toContain("ai-desc-input");
    expect(content).toContain("pierde fuerza en subidas");
  });

  it("has vehicle and mileage inputs", () => {
    expect(content).toContain("ai-vehicle-input");
    expect(content).toContain("ai-km-input");
  });

  it("has Analizar con IA button", () => {
    expect(content).toContain("Analizar con IA");
    expect(content).toContain("analyzeWithAi");
  });

  it("has Buscar Boletines Tecnicos button", () => {
    expect(content).toContain("searchTechnicalWeb");
    expect(content).toContain("Buscar Boletines");
  });

  it("calls POST /intelligence/ai-diagnosis endpoint", () => {
    expect(content).toContain("/intelligence/ai-diagnosis");
  });

  it("calls POST /intelligence/manuals/query for web search", () => {
    expect(content).toContain("/intelligence/manuals/query");
  });

  it("has renderMarkdown function for AI responses", () => {
    expect(content).toContain("function renderMarkdown");
  });

  it("markdown renderer handles bold, code, headers, lists", () => {
    expect(content).toContain("bold");
    expect(content).toContain("font-semibold");
    expect(content).toContain("list-disc");
    expect(content).toContain("list-decimal");
    expect(content).toContain("bg-gray-950");
  });

  it("has AI_SYSTEM_PROMPT hidden from user", () => {
    expect(content).toContain("AI_SYSTEM_PROMPT");
    expect(content).toContain("mecanico automotriz experto");
  });

  it("has loading messages array", () => {
    expect(content).toContain("AI_LOADING_MESSAGES");
    expect(content).toContain("Analizando codigos DTC");
    expect(content).toContain("Calculando procedimiento");
  });

  it("shows animated spinner during loading", () => {
    expect(content).toContain("animate-spin");
    expect(content).toContain("ai-loading-indicator");
  });

  it("renders DTC code badges in results", () => {
    expect(content).toContain("bg-red-900/40");
    expect(content).toContain("font-mono");
  });

  it("shows confidence percentage with color coding", () => {
    expect(content).toContain("porcentajeConfianza");
    expect(content).toContain("confianza");
  });

  it("displays cost in Guaranies", () => {
    expect(content).toContain("Gs.");
    expect(content).toContain("costoEstimado");
  });

  it("displays estimated time", () => {
    expect(content).toContain("tiempoEstimadoHoras");
  });

  it("auto-loads DTCs from work order", () => {
    expect(content).toContain("loadCopilotDtcSuggestions");
    expect(content).toContain("dtcCodes");
  });

  it("has dark theme consistent with ERP", () => {
    expect(content).toContain("gray-900");
    expect(content).toContain("gray-800");
  });

  it("is responsive (sm:w-[420px])", () => {
    expect(content).toContain("sm:w-[420px]");
  });

  it("Spanish language for all UI text", () => {
    expect(content).toContain("Analizando");
    expect(content).toContain("Causa Mas Probable");
    expect(content).toContain("Repuestos Necesarios");
  });
});

/* ─── SIFEN Monitor Module ──────────────────────────────────────── */

describe("SIFEN Monitor — Frontend Module", () => {
  let content: string;
  beforeAll(() => { content = load("../src/shared/public/js/sifen-monitor.js"); });

  it("has renderSifenMonitor function", () => {
    expect(content).toContain("function renderSifenMonitor");
  });

  it("has loadSifenDashboard function", () => {
    expect(content).toContain("function loadSifenDashboard");
  });

  it("calls GET /finance/sifen/dashboard", () => {
    expect(content).toContain("/finance/sifen/dashboard");
  });

  it("calls GET /finance/sifen/health for connection check", () => {
    expect(content).toContain("/finance/sifen/health");
    expect(content).toContain("checkSifenHealth");
  });

  it("has forceSifenTransmission function", () => {
    expect(content).toContain("function forceSifenTransmission");
  });

  it("calls POST /finance/sifen/enviar for manual send", () => {
    expect(content).toContain("/finance/sifen/enviar");
  });

  it("shows 6 status cards (BORRADOR, FIRMADO, ENVIADO, APROBADO, RECHAZADO, ANULADO)", () => {
    expect(content).toContain("BORRADOR");
    expect(content).toContain("FIRMADO");
    expect(content).toContain("ENVIADO");
    expect(content).toContain("APROBADO");
    expect(content).toContain("RECHAZADO");
    expect(content).toContain("ANULADO");
  });

  it("renders pending documents with age indicator", () => {
    expect(content).toContain("sifen-pending");
    expect(content).toContain("ageHours");
    expect(content).toContain("Enviar ahora");
  });

  it("renders recent activity with status dots", () => {
    expect(content).toContain("sifen-activity");
    expect(content).toContain("exitoso");
  });

  it("has Forzar Transmision button", () => {
    expect(content).toContain("Forzar Transmision");
  });

  it("has Verificar conexion button", () => {
    expect(content).toContain("Verificar conexion");
  });

  it("shows health check result with green/red indicator", () => {
    expect(content).toContain("bg-green-400");
    expect(content).toContain("bg-red-400");
    expect(content).toContain("Conexion con DNIT");
  });

  it("alerts when rechazados > 0", () => {
    expect(content).toContain("Requiere atencion");
  });

  it("confirms before force transmission", () => {
    expect(content).toContain("confirm(");
  });

  it("Spanish language for all UI text", () => {
    expect(content).toContain("Monitor Fiscal SIFEN");
    expect(content).toContain("Documentos Pendientes");
    expect(content).toContain("Actividad Reciente");
  });
});

/* ─── WhatsApp Monitor Module ───────────────────────────────────── */

describe("WhatsApp Monitor — Frontend Module", () => {
  let content: string;
  beforeAll(() => { content = load("../src/shared/public/js/whatsapp-monitor.js"); });

  it("has renderWhatsappMonitor function", () => {
    expect(content).toContain("function renderWhatsappMonitor");
  });

  it("has refreshWhatsAppMonitor function", () => {
    expect(content).toContain("function refreshWhatsAppMonitor");
  });

  it("calls GET /whatsapp/log for message history", () => {
    expect(content).toContain("/whatsapp/log");
  });

  it("calls GET /whatsapp/queue/stats for statistics", () => {
    expect(content).toContain("/whatsapp/queue/stats");
  });

  it("calls GET /whatsapp/status for connection", () => {
    expect(content).toContain("/whatsapp/status");
  });

  it("calls GET /whatsapp/errors for error log", () => {
    expect(content).toContain("/whatsapp/errors");
  });

  it("has retryFailedWhatsApp function", () => {
    expect(content).toContain("function retryFailedWhatsApp");
  });

  it("calls POST /whatsapp/queue/retry for retry", () => {
    expect(content).toContain("/whatsapp/queue/retry");
  });

  it("has resendWhatsAppMessage function", () => {
    expect(content).toContain("function resendWhatsAppMessage");
  });

  it("has resolveWhatsAppError function", () => {
    expect(content).toContain("function resolveWhatsAppError");
  });

  it("shows 3 status colors: green (SENT), yellow (PENDING), red (FAILED)", () => {
    expect(content).toContain("bg-green-400");
    expect(content).toContain("bg-yellow-400");
    expect(content).toContain("bg-red-400");
  });

  it("getWhatsAppStatusConfig returns correct configs", () => {
    expect(content).toContain("function getWhatsAppStatusConfig");
    expect(content).toContain("Enviado");
    expect(content).toContain("En cola");
    expect(content).toContain("Fallido");
  });

  it("shows Reenviar button for failed messages", () => {
    expect(content).toContain("Reenviar");
    expect(content).toContain("FAILED");
  });

  it("shows Marcar resuelto for unresolved errors", () => {
    expect(content).toContain("Marcar resuelto");
    expect(content).toContain("resolveWhatsAppError");
  });

  it("has connection status indicator (green pulse)", () => {
    expect(content).toContain("wa-connection-status");
    expect(content).toContain("animate-pulse");
    expect(content).toContain("WhatsApp conectado");
  });

  it("has 4 stat cards (Enviados, En Cola, Fallidos, Tasa Exito)", () => {
    expect(content).toContain("Enviados");
    expect(content).toContain("En Cola");
    expect(content).toContain("Fallidos");
    expect(content).toContain("Tasa Exito");
  });

  it("supports pagination", () => {
    expect(content).toContain("loadWhatsAppLogPage");
    expect(content).toContain("hasNext");
  });

  it("Spanish language for all UI text", () => {
    expect(content).toContain("Monitor de Mensajeria WhatsApp");
    expect(content).toContain("Historial de Mensajes");
    expect(content).toContain("Errores Recientes");
  });
});

/* ─── App Integration ───────────────────────────────────────────── */

describe("App Integration — Navigation & Routing", () => {
  let appContent: string;
  let indexContent: string;

  beforeAll(() => {
    appContent = load("../src/shared/public/app.js");
    indexContent = load("../src/shared/public/index.html");
  });

  it("app.js routes sifen-monitor view", () => {
    expect(appContent).toContain("sifen-monitor");
    expect(appContent).toContain("renderSifenMonitor");
  });

  it("app.js routes whatsapp-monitor view", () => {
    expect(appContent).toContain("whatsapp-monitor");
    expect(appContent).toContain("renderWhatsappMonitor");
  });

  it("app.js has titles for both monitor views", () => {
    expect(appContent).toContain("Monitor SIFEN");
    expect(appContent).toContain("Monitor WhatsApp");
  });

  it("index.html has SIFEN Monitor sidebar button", () => {
    expect(indexContent).toContain('data-view="sifen-monitor"');
    expect(indexContent).toContain("SIFEN Fiscal");
  });

  it("index.html has WhatsApp Monitor sidebar button", () => {
    expect(indexContent).toContain('data-view="whatsapp-monitor"');
    expect(indexContent).toContain("WA Colas");
  });

  it("index.html loads ai-copilot.js script", () => {
    expect(indexContent).toContain('src="js/ai-copilot.js"');
  });

  it("index.html loads sifen-monitor.js script", () => {
    expect(indexContent).toContain('src="js/sifen-monitor.js"');
  });

  it("index.html loads whatsapp-monitor.js script", () => {
    expect(indexContent).toContain('src="js/whatsapp-monitor.js"');
  });

  it("index.html has ai-copilot-mount container", () => {
    expect(indexContent).toContain("ai-copilot-mount");
  });

  it("index.html mounts copilot sidebar on DOMContentLoaded", () => {
    expect(indexContent).toContain("renderAiCopilotSidebar");
  });

  it("ordenes.js has AI Copilot button in OT modal", () => {
    const ordenesContent = load("../src/shared/public/js/ordenes.js");
    expect(ordenesContent).toContain("toggleAiCopilot");
    expect(ordenesContent).toContain("Copiloto IA");
  });
});

/* ─── Monitors Section in Sidebar ───────────────────────────────── */

describe("Sidebar — Monitors Section", () => {
  let indexContent: string;
  beforeAll(() => { indexContent = load("../src/shared/public/index.html"); });

  it("has Monitores section divider", () => {
    expect(indexContent).toContain("Monitores");
  });

  it("has both monitor buttons in the Monitores section", () => {
    var sifenIdx = indexContent.indexOf('data-view="sifen-monitor"');
    var waIdx = indexContent.indexOf('data-view="whatsapp-monitor"');
    var monitoresIdx = indexContent.indexOf("Monitores");
    expect(sifenIdx).toBeGreaterThan(monitoresIdx);
    expect(waIdx).toBeGreaterThan(sifenIdx);
  });
});

/* ─── AI Copilot → OT Apply Flow ────────────────────────────────── */

describe("AI Copilot — Apply to OT Flow", () => {
  let copilotContent: string;
  beforeAll(() => { copilotContent = load("../src/shared/public/js/ai-copilot.js"); });

  it("has applyDiagnosis function", () => {
    expect(copilotContent).toContain("function applyDiagnosis");
  });

  it("applyDiagnosis reads _aiCopilotOrderId", () => {
    expect(copilotContent).toContain("_aiCopilotOrderId");
  });

  it("applyDiagnosis posts to /intelligence/ai-diagnosis/apply", () => {
    expect(copilotContent).toContain("/intelligence/ai-diagnosis/apply");
  });

  it("applyDiagnosis sends codigo, causaProbable, recomendaciones, repuestosNecesarios", () => {
    expect(copilotContent).toContain("causaProbable");
    expect(copilotContent).toContain("recomendaciones");
    expect(copilotContent).toContain("repuestosNecesarios");
  });

  it("applyDiagnosis shows success toast", () => {
    expect(copilotContent).toContain("showToast");
    expect(copilotContent).toContain("Diagnostico IA aplicado");
  });

  it("applyDiagnosis calls refreshOrdenModal after success", () => {
    expect(copilotContent).toContain("refreshOrdenModal");
  });

  it("renderAiResult includes 'Aplicar a OT' button with data attributes", () => {
    expect(copilotContent).toContain("Aplicar a OT");
    expect(copilotContent).toContain('data-codigo=');
    expect(copilotContent).toContain('data-causa=');
    expect(copilotContent).toContain('data-recomendaciones=');
    expect(copilotContent).toContain('data-repuestos=');
  });

  it("button has green styling", () => {
    expect(copilotContent).toContain("bg-green-600");
  });

  it("has showToast helper function", () => {
    expect(copilotContent).toContain("function showToast");
  });

  it("showToast creates toast with animation", () => {
    expect(copilotContent).toContain("slideUp");
  });
});

/* ─── OT Modal — AI Diagnosis Display ────────────────────────────── */

describe("OT Modal — AI Diagnosis Display", () => {
  let ordenesContent: string;
  beforeAll(() => { ordenesContent = load("../src/shared/public/js/ordenes.js"); });

  it("renderOrdenModalBody checks o.diagnosis", () => {
    expect(ordenesContent).toContain("o.diagnosis");
  });

  it("diagnosis section has purple styling (AI indicator)", () => {
    expect(ordenesContent).toContain("bg-purple-900/20");
  });

  it("diagnosis section has robot emoji label", () => {
    expect(ordenesContent).toContain("Diagnóstico IA");
  });

  it("diagnosis renders as whitespace-pre-wrap", () => {
    expect(ordenesContent).toContain("whitespace-pre-wrap");
  });

  it("has refreshOrdenModal function", () => {
    expect(ordenesContent).toContain("function refreshOrdenModal");
  });

  it("refreshOrdenModal calls _refreshOrdenModal", () => {
    expect(ordenesContent).toContain("_refreshOrdenModal");
  });

  it("showOrdenModal delegates to _refreshOrdenModal", () => {
    expect(ordenesContent).toContain("_refreshOrdenModal(ordenId)");
  });
});

/* ─── Backend: Apply Endpoint ─────────────────────────────────────── */

describe("Backend — POST /intelligence/ai-diagnosis/apply", () => {
  let routeContent: string;
  beforeAll(() => {
    routeContent = load("../src/modules/intelligence/routes/ai-dtc-assistant.routes.ts");
  });

  it("has /intelligence/ai-diagnosis/apply route", () => {
    expect(routeContent).toContain("/intelligence/ai-diagnosis/apply");
  });

  it("requires ordenTrabajoId, codigo, causaProbable", () => {
    expect(routeContent).toContain('"ordenTrabajoId"');
    expect(routeContent).toContain('"codigo"');
    expect(routeContent).toContain('"causaProbable"');
  });

  it("fetches the work order from DB", () => {
    expect(routeContent).toContain("ordenesTrabajo");
    expect(routeContent).toContain("eq(ordenesTrabajo.id, ordenTrabajoId)");
  });

  it("builds timestamped diagnosis block", () => {
    expect(routeContent).toContain("--- Diagnostico IA");
    expect(routeContent).toContain("--- Fin diagnostico IA ---");
  });

  it("merges DTC codes into existing array", () => {
    expect(routeContent).toContain("mergedDtcs");
    expect(routeContent).toContain("dtcCodes");
  });

  it("returns ok: true with diagnosis and dtcCodes", () => {
    expect(routeContent).toContain("ok: true");
    expect(routeContent).toContain("diagnosis: updatedDiagnosis");
    expect(routeContent).toContain("dtcCodes: mergedDtcs");
  });

  it("returns 404 for non-existent OT", () => {
    expect(routeContent).toContain("404");
    expect(routeContent).toContain("no encontrada");
  });
});
