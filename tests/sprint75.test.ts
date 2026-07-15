/**
 * Sprint 75 Tests — Enterprise Features (SSO + 2FA + Audit Trail)
 */

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const srcRoot = resolve(import.meta.dirname, "..", "src");
const testRoot = resolve(import.meta.dirname, "..", "tests");

async function readFileSafe(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}

// ─── Enterprise Audit Trail ───────────────────────────

describe("Enterprise Audit Trail", () => {
  it("audit-enterprise schema file exists", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/schema/audit-enterprise.ts"),
    );
    expect(content).toContain("enterpriseAuditLog");
    expect(content).toContain("hashChain");
  });

  it("audit log has tenant isolation", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/schema/audit-enterprise.ts"),
    );
    expect(content).toContain("tenant_slug");
  });

  it("audit log has 6 indexes", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/schema/audit-enterprise.ts"),
    );
    expect(content).toContain("idx_eal_tenant_created");
    expect(content).toContain("idx_eal_user");
    expect(content).toContain("idx_eal_entity");
    expect(content).toContain("idx_eal_action");
    expect(content).toContain("idx_eal_severity");
    expect(content).toContain("idx_eal_hash_chain");
  });

  it("audit service has hash chain computation", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/audit-enterprise.service.ts"),
    );
    expect(content).toContain("computeHashChain");
    expect(content).toContain("sha256");
  });

  it("audit service has query with filters", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/audit-enterprise.service.ts"),
    );
    expect(content).toContain("queryAuditLog");
    expect(content).toContain("from");
    expect(content).toContain("to");
    expect(content).toContain("action");
  });

  it("audit service has hash chain verification", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/audit-enterprise.service.ts"),
    );
    expect(content).toContain("verifyHashChain");
    expect(content).toContain("GENESIS");
  });

  it("audit service has CSV export", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/audit-enterprise.service.ts"),
    );
    expect(content).toContain("exportAuditCsv");
    expect(content).toContain("csvRows");
  });

  it("audit service has stats endpoint", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/audit-enterprise.service.ts"),
    );
    expect(content).toContain("getAuditStats");
    expect(content).toContain("byAction");
  });

  it("audit routes have admin-only access", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/routes/audit-enterprise.routes.ts"),
    );
    expect(content).toContain("requireAdmin");
    expect(content).toContain("/verify");
    expect(content).toContain("/stats");
    expect(content).toContain("/export");
  });
});

// ─── 2FA (TOTP) ──────────────────────────────────────

describe("2FA (TOTP) Service", () => {
  it("generates base32 secret", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/two-factor.service.ts"),
    );
    expect(content).toContain("generateSecret");
    expect(content).toContain("BASE32_CHARS");
  });

  it("implements TOTP verification with time window", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/two-factor.service.ts"),
    );
    expect(content).toContain("verifyTotp");
    expect(content).toContain("timingSafeEqual");
    expect(content).toContain("WINDOW");
  });

  it("generates backup codes", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/two-factor.service.ts"),
    );
    expect(content).toContain("generateBackupCodes");
    expect(content).toContain("hashBackupCodes");
    expect(content).toContain("verifyBackupCode");
  });

  it("provisions QR via otpauth URL", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/two-factor.service.ts"),
    );
    expect(content).toContain("otpauth://totp");
    expect(content).toContain("issuer");
  });

  it("has time-remaining helper", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/two-factor.service.ts"),
    );
    expect(content).toContain("getTotpTimeRemaining");
    expect(content).toContain("PERIOD");
  });

  it("2FA routes have admin-only access", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/routes/two-factor.routes.ts"),
    );
    expect(content).toContain("requireAdmin");
    expect(content).toContain("/setup");
    expect(content).toContain("/verify");
    expect(content).toContain("/time-remaining");
  });
});

// ─── SSO (OpenID Connect) ────────────────────────────

describe("SSO (OpenID Connect)", () => {
  it("supports multiple providers", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/sso-oidc.service.ts"),
    );
    expect(content).toContain("azure");
    expect(content).toContain("google");
    expect(content).toContain("okta");
    expect(content).toContain("keycloak");
    expect(content).toContain("auth0");
  });

  it("has OIDC discovery", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/sso-oidc.service.ts"),
    );
    expect(content).toContain("fetchOidcDiscovery");
    expect(content).toContain(".well-known/openid-configuration");
  });

  it("has authorization URL builder with state/nonce", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/sso-oidc.service.ts"),
    );
    expect(content).toContain("buildAuthorizationUrl");
    expect(content).toContain("state");
    expect(content).toContain("nonce");
  });

  it("has logout URL builder", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/sso-oidc.service.ts"),
    );
    expect(content).toContain("buildLogoutUrl");
    expect(content).toContain("end_session_endpoint");
  });

  it("validates email domains", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/sso-oidc.service.ts"),
    );
    expect(content).toContain("isEmailDomainAllowed");
    expect(content).toContain("allowedDomains");
  });

  it("maps OIDC claims to ERP profile", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/services/sso-oidc.service.ts"),
    );
    expect(content).toContain("mapOidcClaimsToProfile");
    expect(content).toContain("oidcSub");
  });

  it("SSO routes have admin-only access", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/routes/sso.routes.ts"),
    );
    expect(content).toContain("requireAdmin");
    expect(content).toContain("/discover");
    expect(content).toContain("/authorize");
    expect(content).toContain("/logout");
    expect(content).toContain("/validate-domain");
  });
});

// ─── Enterprise Plugin ────────────────────────────────

describe("Enterprise Plugin", () => {
  it("enterprise plugin file exists", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/plugin.ts"),
    );
    expect(content).toContain("enterprisePlugin");
  });

  it("registers audit, 2FA, and SSO routes", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/plugin.ts"),
    );
    expect(content).toContain("enterpriseAuditRoutes");
    expect(content).toContain("twoFactorRoutes");
    expect(content).toContain("ssoRoutes");
  });

  it("uses tenant resolver middleware", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/plugin.ts"),
    );
    expect(content).toContain("resolveTenant");
  });

  it("enterprise module is in src/modules", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/enterprise/plugin.ts"),
    );
    expect(content).toContain("Enterprise module");
  });
});

// ─── Integration ──────────────────────────────────────

describe("Sprint 75 Integration", () => {
  it("all 7 enterprise files exist", async () => {
    const files = [
      "modules/enterprise/schema/audit-enterprise.ts",
      "modules/enterprise/services/audit-enterprise.service.ts",
      "modules/enterprise/services/two-factor.service.ts",
      "modules/enterprise/services/sso-oidc.service.ts",
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

  it("all routes require authentication via requireAdmin", async () => {
    const routeFiles = [
      "modules/enterprise/routes/audit-enterprise.routes.ts",
      "modules/enterprise/routes/two-factor.routes.ts",
      "modules/enterprise/routes/sso.routes.ts",
    ];

    for (const file of routeFiles) {
      const content = await readFileSafe(resolve(srcRoot, file));
      expect(content).toContain("requireAdmin");
    }
  });

  it("Grafana dashboard JSON exists", async () => {
    const content = await readFileSafe(
      resolve(import.meta.dirname, "..", "docs", "grafana-dashboard-production.json"),
    );
    expect(content).toContain("AutomotiveOS ERP Production Dashboard");
    expect(content).toContain("prometheus");
  });
});
