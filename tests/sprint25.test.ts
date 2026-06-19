/**
 * Sprint 25 Tests — Offline Cache + Activity Feed + Form Validation
 *
 * Tests:
 *   1. Cache layer exists and has required methods
 *   2. API function uses cache for GET requests
 *   3. Cache invalidation on mutations
 *   4. Activity feed section in dashboard
 *   5. timeAgo function exists
 *   6. Form validation helpers exist
 *   7. Validators object has common validators
 *   8. attachValidation function exists
 */

import { describe, it, expect } from "vitest";

// ─── 1. Offline Cache Layer ──────────────────────

describe("📊 [Sprint 25] Offline Cache", () => {
  it("cache object exists in app.js", async () => {
    const fs = await import("fs");
    const appJs = fs.readFileSync("src/shared/public/app.js", "utf-8");
    expect(appJs).toContain("const cache = {");
    expect(appJs).toContain("get(key)");
    expect(appJs).toContain("set(key, value, ttlMs");
    expect(appJs).toContain("load()");
    expect(appJs).toContain("invalidate(pattern)");
  });

  it("api function uses cache for GET requests", async () => {
    const fs = await import("fs");
    const appJs = fs.readFileSync("src/shared/public/app.js", "utf-8");
    expect(appJs).toContain("const cached = cache.get(path)");
    expect(appJs).toContain("cache.set(path, data, 300000)");
  });

  it("cache invalidation on mutations", async () => {
    const fs = await import("fs");
    const appJs = fs.readFileSync("src/shared/public/app.js", "utf-8");
    expect(appJs).toContain("cache.invalidate(basePath)");
  });
});

// ─── 2. Activity Feed ────────────────────────────

describe("📊 [Sprint 25] Activity Feed", () => {
  it("dashboard has activity feed section", async () => {
    const fs = await import("fs");
    const dashboardJs = fs.readFileSync("src/shared/public/js/dashboard.js", "utf-8");
    expect(dashboardJs).toContain("d-activity-feed");
    expect(dashboardJs).toContain("Actividad Reciente");
  });

  it("dashboard fetches audit log for activity feed", async () => {
    const fs = await import("fs");
    const dashboardJs = fs.readFileSync("src/shared/public/js/dashboard.js", "utf-8");
    expect(dashboardJs).toContain("/finance/contabilidad/audit-log?limit=8");
  });

  it("timeAgo helper function exists", async () => {
    const fs = await import("fs");
    const dashboardJs = fs.readFileSync("src/shared/public/js/dashboard.js", "utf-8");
    expect(dashboardJs).toContain("function timeAgo(date)");
  });
});

// ─── 3. Form Validation Helpers ──────────────────

describe("📊 [Sprint 25] Form Validation", () => {
  it("validateField function exists", async () => {
    const fs = await import("fs");
    const uxJs = fs.readFileSync("src/shared/public/js/ux.js", "utf-8");
    expect(uxJs).toContain("function validateField(field, validator)");
  });

  it("validateForm function exists", async () => {
    const fs = await import("fs");
    const uxJs = fs.readFileSync("src/shared/public/js/ux.js", "utf-8");
    expect(uxJs).toContain("function validateForm(schema)");
  });

  it("Validators object has common validators", async () => {
    const fs = await import("fs");
    const uxJs = fs.readFileSync("src/shared/public/js/ux.js", "utf-8");
    expect(uxJs).toContain("const Validators = {");
    expect(uxJs).toContain("required:");
    expect(uxJs).toContain("email:");
    expect(uxJs).toContain("ruc:");
    expect(uxJs).toContain("phone:");
    expect(uxJs).toContain("plate:");
    expect(uxJs).toContain("vin:");
  });

  it("attachValidation function exists", async () => {
    const fs = await import("fs");
    const uxJs = fs.readFileSync("src/shared/public/js/ux.js", "utf-8");
    expect(uxJs).toContain("function attachValidation(formId, schema)");
  });
});

// ─── 4. Global Exports ───────────────────────────

describe("📊 [Sprint 25] Global Exports", () => {
  it("validation helpers are exposed to window", async () => {
    const fs = await import("fs");
    const uxJs = fs.readFileSync("src/shared/public/js/ux.js", "utf-8");
    expect(uxJs).toContain("window.validateField = validateField");
    expect(uxJs).toContain("window.validateForm = validateForm");
    expect(uxJs).toContain("window.Validators = Validators");
    expect(uxJs).toContain("window.attachValidation = attachValidation");
  });
});
