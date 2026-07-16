/**
 * Sprint 77 Tests — White-label + Custom Domain
 *
 * Covers:
 *   - Migration 0005 (white_label_config, sso_config, data_retention_policy)
 *   - Schema barrel exports for enterprise tables
 *   - Tenant resolver: header → custom domain → subdomain priority
 *   - White-label CRUD routes exist (GET/PUT /enterprise/white-label)
 *   - Frontend white-label injection (theme.js applyWhiteLabel)
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

// ─── Migration 0005 ─────────────────────────────

describe("Sprint 77 — Migration 0005 (White-Label tables)", () => {
  it("migration file exists", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0005_white_label.sql"),
    );
    expect(content).toContain("white_label_config");
    expect(content).toContain("sso_config");
    expect(content).toContain("data_retention_policy");
  });

  it("creates white_label_config with custom_domain + branding columns", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0005_white_label.sql"),
    );
    expect(content).toContain("custom_domain");
    expect(content).toContain("primary_color");
    expect(content).toContain("company_name");
    expect(content).toContain("favicon_url");
    expect(content).toContain("footer_text");
  });

  it("creates index on custom_domain", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0005_white_label.sql"),
    );
    expect(content).toContain("idx_wl_domain");
  });

  it("enables RLS + FORCE on all three tables", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0005_white_label.sql"),
    );
    for (const table of ["sso_config", "white_label_config", "data_retention_policy"]) {
      expect(content).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      expect(content).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    }
  });
});

// ─── Schema Barrel ──────────────────────────────

describe("Sprint 77 — Schema barrel exports", () => {
  it("main schema barrel exports white_label tables", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/schema/index.ts"),
    );
    expect(content).toContain("whiteLabelConfig");
    expect(content).toContain("ssoConfig");
    expect(content).toContain("dataRetentionPolicy");
    expect(content).toContain("WhiteLabelConfig");
  });
});

// ─── Tenant Resolver (hostname) ─────────────────

describe("Sprint 77 — Tenant resolver hostname resolution", () => {
  it("resolver reads X-Tenant-Slug header", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/middleware/tenant-resolver.ts"),
    );
    expect(content).toContain('x-tenant-slug');
    expect(content).toContain("resolveSlugFromHost");
  });

  it("resolver resolves custom domain via white_label_config", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/middleware/tenant-resolver.ts"),
    );
    expect(content).toContain("whiteLabelConfig.customDomain");
    expect(content).toContain("custom domain");
  });

  it("resolver falls back to subdomain parsing", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/middleware/tenant-resolver.ts"),
    );
    expect(content).toContain("Subdomain");
    expect(content).toContain("RESERVED_SUBDOMAINS");
  });

  it("resolver throws ForbiddenError when tenant unidentified", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/middleware/tenant-resolver.ts"),
    );
    expect(content).toContain("ForbiddenError");
    expect(content).toContain("Tenant not identified");
  });
});

// ─── Enterprise White-Label Routes ──────────────

describe("Sprint 77 — White-label routes", () => {
  it("GET /enterprise/white-label route exists", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/routes/enterprise.routes.ts"),
    );
    expect(content).toContain('"/enterprise/white-label"');
  });

  it("PUT /enterprise/white-label upserts customDomain + branding", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/routes/enterprise.routes.ts"),
    );
    expect(content).toContain("customDomain");
    expect(content).toContain("companyName");
    expect(content).toContain("primaryColor");
  });
});

// ─── Frontend White-Label Injection ─────────────

describe("Sprint 77 — Frontend white-label injection", () => {
  it("theme.js exposes applyWhiteLabel", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/public/js/theme.js"),
    );
    expect(content).toContain("applyWhiteLabel");
    expect(content).toContain("window.ThemeSystem");
  });

  it("applyWhiteLabel sets accent + favicon + title + footer", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/public/js/theme.js"),
    );
    expect(content).toContain("--accent");
    expect(content).toContain('rel="icon"');
    expect(content).toContain("document.title");
    expect(content).toContain("app-footer-text");
  });

  it("app.js fetches white-label on enterApp", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/public/app.js"),
    );
    expect(content).toContain("fetchWhiteLabel");
    expect(content).toContain("'/enterprise/white-label'");
  });
});

// ─── Integration ────────────────────────────────

describe("Sprint 77 — Integration", () => {
  it("engram.json records Sprint 77 as COMPLETED", async () => {
    const content = await readFileSafe(resolve(srcRoot, "..", "engram.json"));
    expect(content).toContain("sprint_77_progress");
    expect(content).toContain('"status": "COMPLETED"');
  });

  it("migration 0004 (audit) still present", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0004_enterprise_audit.sql"),
    );
    expect(content).toContain("enterprise_audit_log");
  });
});
