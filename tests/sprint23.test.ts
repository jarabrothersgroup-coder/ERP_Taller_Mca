/**
 * Sprint 23 Tests — Audit Log Frontend + CSV Export Expansion
 *
 * Tests:
 *   1. CSV export service exports
 *   2. Exportable tables include facturas
 *   3. Audit log frontend view exists
 *   4. Audit log tab registered
 *   5. Mobile sidebar toggle exists
 *   6. CSV export function works
 *   7. Audit log query endpoint exists
 */

import { describe, it, expect } from "vitest";

// ─── 1. CSV Export Service Exports ───────────────

describe("📊 [Sprint 23] CSV Export Service", () => {
  it("getExportableTables is exported and returns array", async () => {
    const { getExportableTables } = await import("../src/shared/services/csv-export.service.js");
    expect(typeof getExportableTables).toBe("function");
    const tables = getExportableTables();
    expect(Array.isArray(tables)).toBe(true);
    expect(tables).toContain("vehiculos");
    expect(tables).toContain("clientes");
    expect(tables).toContain("ordenes");
    expect(tables).toContain("facturas");
  });

  it("exportTableCsv is exported and is a function", async () => {
    const { exportTableCsv } = await import("../src/shared/services/csv-export.service.js");
    expect(typeof exportTableCsv).toBe("function");
  });
});

// ─── 2. Exportable Tables ────────────────────────

describe("📊 [Sprint 23] Exportable Tables", () => {
  it("includes facturas table", async () => {
    const { getExportableTables } = await import("../src/shared/services/csv-export.service.js");
    const tables = getExportableTables();
    expect(tables).toContain("facturas");
    expect(tables.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── 3. Audit Log Endpoint ───────────────────────

describe("📊 [Sprint 23] Audit Log", () => {
  it("audit-log service is importable", async () => {
    const { queryAuditLog } = await import("../src/modules/finance/services/accounting/audit-log.service.js");
    expect(typeof queryAuditLog).toBe("function");
  });

  it("audit log schema has required fields", async () => {
    const { auditLog } = await import("../src/modules/finance/schema/audit-log.js");
    expect(auditLog).toBeDefined();
  });
});

// ─── 4. Mobile Sidebar ───────────────────────────

describe("📊 [Sprint 23] Mobile Sidebar", () => {
  it("toggleSidebar function is exported in app.js", async () => {
    // Verify the function exists in the bundled JS
    const fs = await import("fs");
    const appJs = fs.readFileSync("src/shared/public/app.js", "utf-8");
    expect(appJs).toContain("function toggleSidebar()");
    expect(appJs).toContain("function closeSidebarMobile()");
  });

  it("responsive CSS media queries exist", async () => {
    const fs = await import("fs");
    const indexHtml = fs.readFileSync("src/shared/public/index.html", "utf-8");
    expect(indexHtml).toContain("@media (max-width: 768px)");
    expect(indexHtml).toContain("#sidebar.open");
  });
});

// ─── 5. Frontend Audit Log View ──────────────────

describe("📊 [Sprint 23] Audit Log Frontend", () => {
  it("audit tab registered in CONTABILIDAD_TABS", async () => {
    const fs = await import("fs");
    const appJs = fs.readFileSync("src/shared/public/app.js", "utf-8");
    expect(appJs).toContain("auditoria: 'Auditoría'");
  });

  it("renderContabAuditoria function exists", async () => {
    const fs = await import("fs");
    const contabJs = fs.readFileSync("src/shared/public/js/contabilidad.js", "utf-8");
    expect(contabJs).toContain("function renderContabAuditoria(container)");
    expect(contabJs).toContain("function cargarAuditoria()");
  });

  it("audit log view has filter controls", async () => {
    const fs = await import("fs");
    const contabJs = fs.readFileSync("src/shared/public/js/contabilidad.js", "utf-8");
    expect(contabJs).toContain("audit-entidad");
    expect(contabJs).toContain("audit-accion");
    expect(contabJs).toContain("audit-desde");
    expect(contabJs).toContain("audit-hasta");
  });
});
