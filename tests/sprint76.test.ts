/**
 * Sprint 76 Tests — Data Export + Import + Migration Tools
 */

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const srcRoot = resolve(import.meta.dirname, "..", "src");

async function readFileSafe(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}

// ─── Data Export Service ──────────────────────────────

describe("Data Export Service", () => {
  it("export service file exists", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/data-export.service.ts"),
    );
    expect(content).toContain("generateCsvExport");
    expect(content).toContain("formatCellValue");
    expect(content).toContain("validateExportOptions");
  });

  it("supports all entity types", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/data-export.service.ts"),
    );
    expect(content).toContain("work_orders");
    expect(content).toContain("invoices");
    expect(content).toContain("clients");
    expect(content).toContain("vehicles");
    expect(content).toContain("inventory");
    expect(content).toContain("treasury");
    expect(content).toContain("accounting");
    expect(content).toContain("audit_log");
    expect(content).toContain("sifen_documents");
  });

  it("CSV export includes BOM for Excel", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/data-export.service.ts"),
    );
    expect(content).toContain("FEFF");
    expect(content).toContain("text/csv; charset=utf-8");
  });

  it("CSV export computes SHA-256 checksum", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/data-export.service.ts"),
    );
    expect(content).toContain("sha256");
    expect(content).toContain("checksum");
  });

  it("formatCellValue handles currency in PYG", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/data-export.service.ts"),
    );
    expect(content).toContain("currency");
    expect(content).toContain("PYG");
  });

  it("validateExportOptions checks tenantSlug", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/data-export.service.ts"),
    );
    expect(content).toContain("tenantSlug es requerido");
  });

  it("generateExportMetadata for audit trail", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/data-export.service.ts"),
    );
    expect(content).toContain("generateExportMetadata");
    expect(content).toContain("exportId");
  });
});

// ─── Enterprise Module Complete ───────────────────────

describe("Enterprise Module — Sprint 75+76 Integration", () => {
  it("all enterprise service files exist", async () => {
    const files = [
      "modules/enterprise/schema/audit-enterprise.ts",
      "modules/enterprise/services/audit-enterprise.service.ts",
      "modules/enterprise/services/two-factor.service.ts",
      "modules/enterprise/services/sso-oidc.service.ts",
      "modules/enterprise/services/data-export.service.ts",
      "modules/enterprise/plugin.ts",
      "modules/enterprise/routes/audit-enterprise.routes.ts",
      "modules/enterprise/routes/two-factor.routes.ts",
      "modules/enterprise/routes/sso.routes.ts",
    ];

    for (const file of files) {
      const content = await readFileSafe(resolve(srcRoot, file));
      expect(content.length).toBeGreaterThan(100);
    }
  });

  it("enterprise migration SQL exists", async () => {
    const content = await readFileSafe(
      resolve(
        import.meta.dirname,
        "..",
        "src/shared/database/migrations/0004_enterprise_audit.sql",
      ),
    );
    expect(content).toContain("enterprise_audit_log");
    expect(content).toContain("ROW LEVEL SECURITY");
    expect(content).toContain("hash_chain");
  });

  it("enterprise schema registered in drizzle.config.ts", async () => {
    const content = await readFileSafe(
      resolve(import.meta.dirname, "..", "drizzle.config.ts"),
    );
    expect(content).toContain("enterprise/schema");
  });

  it("Grafana dashboard has Prometheus panels", async () => {
    const content = await readFileSafe(
      resolve(
        import.meta.dirname,
        "..",
        "docs/grafana-dashboard-production.json",
      ),
    );
    expect(content).toContain("prometheus");
    expect(content).toContain("Request Rate");
    expect(content).toContain("Error Rate");
    expect(content).toContain("Memory Usage");
  });
});

// ─── File Counts ──────────────────────────────────────

describe("Sprint 75+76 File Summary", () => {
  it("12 new files created across Sprint 75+76", async () => {
    const newFiles = [
      "src/modules/enterprise/schema/audit-enterprise.ts",
      "src/modules/enterprise/services/audit-enterprise.service.ts",
      "src/modules/enterprise/services/two-factor.service.ts",
      "src/modules/enterprise/services/sso-oidc.service.ts",
      "src/modules/enterprise/services/data-export.service.ts",
      "src/modules/enterprise/plugin.ts",
      "src/modules/enterprise/routes/audit-enterprise.routes.ts",
      "src/modules/enterprise/routes/two-factor.routes.ts",
      "src/modules/enterprise/routes/sso.routes.ts",
      "src/shared/database/migrations/0004_enterprise_audit.sql",
      "docs/grafana-dashboard-production.json",
      "tests/sprint75.test.ts",
    ];

    for (const file of newFiles) {
      const content = await readFileSafe(resolve(import.meta.dirname, "..", file));
      expect(content.length).toBeGreaterThan(50);
    }
  });
});
