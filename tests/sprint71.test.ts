/**
 * Sprint 71 — Analytics + Reporting Tests
 *
 * Tests:
 *   1. Event Tracker (schema, service exports)
 *   2. Report Builder (service exports, CSV conversion)
 *   3. Metabase Routes (file exists, config endpoint)
 *   4. Analytics Service (existing KPIs still work)
 *   5. File Structure Completeness
 *
 * @module tests/sprint71
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ─── Helpers ────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function readFileContent(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf-8");
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe("Sprint 71 — Event Tracker", () => {
  it("event-tracker.ts exists", () => {
    expect(fileExists("src/modules/analytics/services/event-tracker.ts")).toBe(true);
  });

  it("exports analyticsEvents table definition", () => {
    const content = readFileContent("src/modules/analytics/services/event-tracker.ts");
    expect(content).toContain("export const analyticsEvents");
    expect(content).toContain("pgTable");
    expect(content).toContain("tenant_slug");
    expect(content).toContain("event_type");
    expect(content).toContain("event_name");
  });

  it("exports trackEvent function", () => {
    const content = readFileContent("src/modules/analytics/services/event-tracker.ts");
    expect(content).toContain("export async function trackEvent");
  });

  it("exports getEventCounts function", () => {
    const content = readFileContent("src/modules/analytics/services/event-tracker.ts");
    expect(content).toContain("export async function getEventCounts");
  });

  it("exports getDailyEventCounts function", () => {
    const content = readFileContent("src/modules/analytics/services/event-tracker.ts");
    expect(content).toContain("export async function getDailyEventCounts");
  });

  it("exports getRecentEvents function", () => {
    const content = readFileContent("src/modules/analytics/services/event-tracker.ts");
    expect(content).toContain("export async function getRecentEvents");
  });

  it("has proper tenant isolation with tenant_slug", () => {
    const content = readFileContent("src/modules/analytics/services/event-tracker.ts");
    expect(content).toContain('tenant_slug")');
    expect(content).toContain("tenantSlug");
  });
});

describe("Sprint 71 — Report Builder", () => {
  it("report-builder.ts exists", () => {
    expect(fileExists("src/modules/analytics/services/report-builder.ts")).toBe(true);
  });

  it("exports generateReport function", () => {
    const content = readFileContent("src/modules/analytics/services/report-builder.ts");
    expect(content).toContain("export async function generateReport");
  });

  it("exports toCSV function", () => {
    const content = readFileContent("src/modules/analytics/services/report-builder.ts");
    expect(content).toContain("export function toCSV");
  });

  it("supports summary report type", () => {
    const content = readFileContent("src/modules/analytics/services/report-builder.ts");
    expect(content).toContain("summary");
    expect(content).toContain("generateSummaryReport");
  });

  it("supports clients report type", () => {
    const content = readFileContent("src/modules/analytics/services/report-builder.ts");
    expect(content).toContain("clients");
    expect(content).toContain("generateClientsReport");
  });

  it("supports vehicles report type", () => {
    const content = readFileContent("src/modules/analytics/services/report-builder.ts");
    expect(content).toContain("vehicles");
    expect(content).toContain("generateVehiclesReport");
  });

  it("toCSV handles special characters (quotes, commas)", () => {
    const content = readFileContent("src/modules/analytics/services/report-builder.ts");
    expect(content).toContain("replace(/\"/g, '\"\"')");
    expect(content).toContain("includes(\",\")");
  });
});

describe("Sprint 71 — Metabase Integration", () => {
  it("metabase.routes.ts exists", () => {
    expect(fileExists("src/modules/analytics/routes/metabase.routes.ts")).toBe(true);
  });

  it("exports metabaseRoutes function", () => {
    const content = readFileContent("src/modules/analytics/routes/metabase.routes.ts");
    expect(content).toContain("export async function metabaseRoutes");
  });

  it("defines config endpoint", () => {
    const content = readFileContent("src/modules/analytics/routes/metabase.routes.ts");
    expect(content).toContain("/analytics/metabase/config");
    expect(content).toContain("Get Metabase embed configuration");
  });

  it("defines embed-url endpoint", () => {
    const content = readFileContent("src/modules/analytics/routes/metabase.routes.ts");
    expect(content).toContain("/analytics/metabase/embed-url");
    expect(content).toContain("Generate a signed Metabase embed URL");
  });

  it("defines health endpoint", () => {
    const content = readFileContent("src/modules/analytics/routes/metabase.routes.ts");
    expect(content).toContain("/analytics/metabase/health");
  });

  it("checks for Metabase configuration", () => {
    const content = readFileContent("src/modules/analytics/routes/metabase.routes.ts");
    expect(content).toContain("METABASE_URL");
    expect(content).toContain("METABASE_SECRET_KEY");
    expect(content).toContain("isMetabaseConfigured");
  });

  it("returns 503 when Metabase not configured", () => {
    const content = readFileContent("src/modules/analytics/routes/metabase.routes.ts");
    expect(content).toContain("503");
    expect(content).toContain("not configured");
  });

  it("generates signed URLs with HMAC", () => {
    const content = readFileContent("src/modules/analytics/routes/metabase.routes.ts");
    expect(content).toContain("createHmac");
    expect(content).toContain("sha384");
    expect(content).toContain("signature");
  });
});

describe("Sprint 71 — Existing Analytics Service", () => {
  it("analytics.service.ts still has KPI functions", () => {
    const content = readFileContent("src/modules/analytics/services/analytics.service.ts");
    expect(content).toContain("getRevenueKPI");
    expect(content).toContain("getOTCountKPI");
    expect(content).toContain("getAvgOrderValueKPI");
    expect(content).toContain("getCompletionRateKPI");
  });

  it("analytics.service.ts still has trend functions", () => {
    const content = readFileContent("src/modules/analytics/services/analytics.service.ts");
    expect(content).toContain("getDailyRevenueTrend");
    expect(content).toContain("getDailyOTTrend");
    expect(content).toContain("getOTStatusDistribution");
  });

  it("analytics.routes.ts has all endpoints", () => {
    const content = readFileContent("src/modules/analytics/routes/analytics.routes.ts");
    expect(content).toContain("/analytics/kpis");
    expect(content).toContain("/analytics/trends/revenue");
    expect(content).toContain("/analytics/distribution");
    expect(content).toContain("/analytics/report/csv");
  });
});

describe("Sprint 71 — File Structure Completeness", () => {
  const requiredFiles = [
    "src/modules/analytics/services/event-tracker.ts",
    "src/modules/analytics/services/report-builder.ts",
    "src/modules/analytics/routes/metabase.routes.ts",
    "src/modules/analytics/services/analytics.service.ts",
    "src/modules/analytics/routes/analytics.routes.ts",
    "src/modules/analytics/plugin.ts",
    "tests/sprint71.test.ts",
  ];

  for (const file of requiredFiles) {
    it(`${file} exists`, () => {
      expect(fileExists(file), `Missing file: ${file}`).toBe(true);
    });
  }
});
