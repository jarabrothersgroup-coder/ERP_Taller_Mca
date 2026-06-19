/**
 * Sprint 24 Tests — Dashboard KPIs Enhancement + Error Boundaries
 *
 * Tests:
 *   1. Dashboard KPIs include secondary metrics
 *   2. Global error boundary exists
 *   3. Toast notification function exists
 *   4. Slide-up animation CSS exists
 *   5. Keyboard shortcuts still work
 *   6. Analytics service exports
 *   7. Dashboard HTML includes new KPI elements
 */

import { describe, it, expect } from "vitest";

// ─── 1. Dashboard KPIs Enhancement ───────────────

describe("📊 [Sprint 24] Dashboard KPIs", () => {
  it("dashboard.js has secondary KPI elements", async () => {
    const fs = await import("fs");
    const dashboardJs = fs.readFileSync("src/shared/public/js/dashboard.js", "utf-8");
    expect(dashboardJs).toContain("d-avg-repair");
    expect(dashboardJs).toContain("d-collection-rate");
    expect(dashboardJs).toContain("d-active-clients");
    expect(dashboardJs).toContain("d-gross-margin");
  });

  it("dashboard.js fetches secondary KPIs", async () => {
    const fs = await import("fs");
    const dashboardJs = fs.readFileSync("src/shared/public/js/dashboard.js", "utf-8");
    expect(dashboardJs).toContain("Tiempo Promedio Reparación");
    expect(dashboardJs).toContain("Tasa de Cobro");
    expect(dashboardJs).toContain("Clientes Activos");
    expect(dashboardJs).toContain("Margen Bruto");
  });
});

// ─── 2. Global Error Boundary ─────────────────────

describe("📊 [Sprint 24] Error Boundary", () => {
  it("unhandledrejection listener exists", async () => {
    const fs = await import("fs");
    const appJs = fs.readFileSync("src/shared/public/app.js", "utf-8");
    expect(appJs).toContain("unhandledrejection");
    expect(appJs).toContain("GLOBAL ERROR BOUNDARY");
  });

  it("global error listener exists", async () => {
    const fs = await import("fs");
    const appJs = fs.readFileSync("src/shared/public/app.js", "utf-8");
    expect(appJs).toContain("window.addEventListener('error'");
  });

  it("showToast function exists", async () => {
    const fs = await import("fs");
    const appJs = fs.readFileSync("src/shared/public/app.js", "utf-8");
    expect(appJs).toContain("function showToast(message, type");
  });
});

// ─── 3. Animation CSS ─────────────────────────────

describe("📊 [Sprint 24] Animations", () => {
  it("slideUp animation CSS exists", async () => {
    const fs = await import("fs");
    const indexHtml = fs.readFileSync("src/shared/public/index.html", "utf-8");
    expect(indexHtml).toContain("@keyframes slideUp");
    expect(indexHtml).toContain("animate-slide-up");
  });
});

// ─── 4. Keyboard Shortcuts ────────────────────────

describe("📊 [Sprint 24] Keyboard Shortcuts", () => {
  it("shortcuts module still exports", async () => {
    const fs = await import("fs");
    const shortcutsJs = fs.readFileSync("src/shared/public/js/shortcuts.js", "utf-8");
    expect(shortcutsJs).toContain("SHORTCUTS");
    expect(shortcutsJs).toContain("command-palette");
  });
});

// ─── 5. Analytics Service ─────────────────────────

describe("📊 [Sprint 24] Analytics Service", () => {
  it("getDashboardKPIs is exported", async () => {
    const { getDashboardKPIs } = await import("../src/modules/workshop/services/analytics.service.js");
    expect(typeof getDashboardKPIs).toBe("function");
  });

  it("DashboardKPIs type includes secondary fields", async () => {
    const fs = await import("fs");
    const serviceTs = fs.readFileSync("src/modules/workshop/services/analytics.service.ts", "utf-8");
    expect(serviceTs).toContain("promedioDuracionDias");
    expect(serviceTs).toContain("margenBruto");
  });
});
