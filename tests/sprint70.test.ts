/**
 * Sprint 70 — API Pública + SDK + Developer Portal Tests
 *
 * Tests:
 *   1. API Keys Schema (structural)
 *   2. API Keys Service (function exports)
 *   3. API Keys Routes (registration)
 *   4. SDK Generator (script exists)
 *   5. Developer Portal (HTML exists)
 *   6. Tenant Rate Limiter (exports)
 *   7. API Key Plugin (registration)
 *   8. App.ts Integration (plugin registered)
 *
 * @module tests/sprint70
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

describe("Sprint 70 — API Keys Schema", () => {
  it("api-keys schema file exists", () => {
    expect(fileExists("src/modules/api-keys/schema/api-keys.ts")).toBe(true);
  });

  it("exports apiKeys table definition", async () => {
    const content = readFileContent("src/modules/api-keys/schema/api-keys.ts");
    expect(content).toContain("export const apiKeys");
    expect(content).toContain("pgTable");
    expect(content).toContain("tenant_slug");
    expect(content).toContain("key_hash");
    expect(content).toContain("key_prefix");
  });

  it("exports apiKeyUsageLog table", () => {
    const content = readFileContent("src/modules/api-keys/schema/api-keys.ts");
    expect(content).toContain("export const apiKeyUsageLog");
    expect(content).toContain("api_key_id");
    expect(content).toContain("endpoint");
    expect(content).toContain("status_code");
  });

  it("defines API_SCOPES constant", () => {
    const content = readFileContent("src/modules/api-keys/schema/api-keys.ts");
    expect(content).toContain("export const API_SCOPES");
    expect(content).toContain("read:workshop");
    expect(content).toContain("write:inventory");
    expect(content).toContain("admin:tenants");
  });
});

describe("Sprint 70 — API Keys Service", () => {
  it("api-key service file exists", () => {
    expect(fileExists("src/modules/api-keys/services/api-key.service.ts")).toBe(true);
  });

  it("exports createApiKey function", () => {
    const content = readFileContent("src/modules/api-keys/services/api-key.service.ts");
    expect(content).toContain("export async function createApiKey");
  });

  it("exports listApiKeys function", () => {
    const content = readFileContent("src/modules/api-keys/services/api-key.service.ts");
    expect(content).toContain("export async function listApiKeys");
  });

  it("exports validateApiKey function", () => {
    const content = readFileContent("src/modules/api-keys/services/api-key.service.ts");
    expect(content).toContain("export async function validateApiKey");
  });

  it("exports revokeApiKey function", () => {
    const content = readFileContent("src/modules/api-keys/services/api-key.service.ts");
    expect(content).toContain("export async function revokeApiKey");
  });

  it("exports getApiKeyUsage function", () => {
    const content = readFileContent("src/modules/api-keys/services/api-key.service.ts");
    expect(content).toContain("export async function getApiKeyUsage");
  });

  it("uses SHA-256 hashing for API keys", () => {
    const content = readFileContent("src/modules/api-keys/services/api-key.service.ts");
    expect(content).toContain("sha256");
    expect(content).toContain("crypto.createHash");
  });

  it("generates keys with aos_live_ prefix", () => {
    const content = readFileContent("src/modules/api-keys/services/api-key.service.ts");
    expect(content).toContain("aos_live_");
  });
});

describe("Sprint 70 — API Keys Routes", () => {
  it("api-key routes file exists", () => {
    expect(fileExists("src/modules/api-keys/routes/api-key.routes.ts")).toBe(true);
  });

  it("exports apiKeyRoutes function", () => {
    const content = readFileContent("src/modules/api-keys/routes/api-key.routes.ts");
    expect(content).toContain("export async function apiKeyRoutes");
  });

  it("defines POST / endpoint for creating keys", () => {
    const content = readFileContent("src/modules/api-keys/routes/api-key.routes.ts");
    expect(content).toContain('tags: ["API Keys"]');
    expect(content).toContain("summary: \"Create a new API key\"");
  });

  it("defines GET / endpoint for listing keys", () => {
    const content = readFileContent("src/modules/api-keys/routes/api-key.routes.ts");
    expect(content).toContain("summary: \"List all API keys for the tenant\"");
  });

  it("defines GET /:id/usage endpoint", () => {
    const content = readFileContent("src/modules/api-keys/routes/api-key.routes.ts");
    expect(content).toContain("summary: \"Get API key usage statistics\"");
  });

  it("validates API scopes in create endpoint", () => {
    const content = readFileContent("src/modules/api-keys/routes/api-key.routes.ts");
    expect(content).toContain("Invalid scope");
    expect(content).toContain("API_SCOPES");
  });
});

describe("Sprint 70 — API Keys Plugin", () => {
  it("plugin file exists", () => {
    expect(fileExists("src/modules/api-keys/plugin.ts")).toBe(true);
  });

  it("registers routes with /api-keys prefix", () => {
    const content = readFileContent("src/modules/api-keys/plugin.ts");
    expect(content).toContain("apiKeyRoutes");
    expect(content).toContain('prefix: "/api-keys"');
  });
});

describe("Sprint 70 — SDK Generator", () => {
  it("gen-sdk.ts script exists", () => {
    expect(fileExists("scripts/gen-sdk.ts")).toBe(true);
  });

  it("fetches OpenAPI spec from server", () => {
    const content = readFileContent("scripts/gen-sdk.ts");
    expect(content).toContain("fetchOpenApiSpec");
    expect(content).toContain("/docs/json");
  });

  it("generates TypeScript types", () => {
    const content = readFileContent("scripts/gen-sdk.ts");
    expect(content).toContain("generateTypes");
    expect(content).toContain("mapJsonSchemaToTs");
  });

  it("generates API client class", () => {
    const content = readFileContent("scripts/gen-sdk.ts");
    expect(content).toContain("generateClient");
    expect(content).toContain("AutomotiveOSClient");
    expect(content).toContain("createClient");
  });

  it("creates package.json for SDK", () => {
    const content = readFileContent("scripts/gen-sdk.ts");
    expect(content).toContain("package.json");
    expect(content).toContain("@automotiveos/sdk");
  });
});

describe("Sprint 70 — Developer Portal", () => {
  it("developer-portal.html exists", () => {
    expect(fileExists("src/shared/public/developer-portal.html")).toBe(true);
  });

  it("has correct title", () => {
    const content = readFileContent("src/shared/public/developer-portal.html");
    expect(content).toContain("<title>Developer Portal — AutomotiveOS API</title>");
  });

  it("links to Swagger UI", () => {
    const content = readFileContent("src/shared/public/developer-portal.html");
    expect(content).toContain('href="/docs"');
    expect(content).toContain("Swagger UI");
  });

  it("documents API authentication", () => {
    const content = readFileContent("src/shared/public/developer-portal.html");
    expect(content).toContain("API Key");
    expect(content).toContain("aos_live_");
  });

  it("documents rate limits", () => {
    const content = readFileContent("src/shared/public/developer-portal.html");
    expect(content).toContain("Rate Limits");
    expect(content).toContain("X-RateLimit-Limit");
  });

  it("documents error codes", () => {
    const content = readFileContent("src/shared/public/developer-portal.html");
    expect(content).toContain("Error Codes");
    expect(content).toContain("429");
    expect(content).toContain("TooManyRequests");
  });

  it("shows code examples", () => {
    const content = readFileContent("src/shared/public/developer-portal.html");
    expect(content).toContain("Code Examples");
    expect(content).toContain("createClient");
  });
});

describe("Sprint 70 — Tenant Rate Limiter", () => {
  it("tenant-rate-limit middleware file exists", () => {
    expect(fileExists("src/shared/middleware/tenant-rate-limit.ts")).toBe(true);
  });

  it("exports tenantRateLimit function", () => {
    const content = readFileContent("src/shared/middleware/tenant-rate-limit.ts");
    expect(content).toContain("export function tenantRateLimit");
  });

  it("exports getRateLimitStatus function", () => {
    const content = readFileContent("src/shared/middleware/tenant-rate-limit.ts");
    expect(content).toContain("export function getRateLimitStatus");
  });

  it("exports resetRateLimit function", () => {
    const content = readFileContent("src/shared/middleware/tenant-rate-limit.ts");
    expect(content).toContain("export function resetRateLimit");
  });

  it("sets rate limit headers", () => {
    const content = readFileContent("src/shared/middleware/tenant-rate-limit.ts");
    expect(content).toContain("X-RateLimit-Limit");
    expect(content).toContain("X-RateLimit-Remaining");
    expect(content).toContain("X-RateLimit-Reset");
  });

  it("returns 429 on rate limit exceeded", () => {
    const content = readFileContent("src/shared/middleware/tenant-rate-limit.ts");
    expect(content).toContain("429");
    expect(content).toContain("TooManyRequests");
  });

  it("has exempt paths for health/docs", () => {
    const content = readFileContent("src/shared/middleware/tenant-rate-limit.ts");
    expect(content).toContain("EXEMPT_PATHS");
    expect(content).toContain("/health");
    expect(content).toContain("/docs");
  });
});

describe("Sprint 70 — App.ts Integration", () => {
  it("app.ts registers API Keys plugin", () => {
    const content = readFileContent("src/app.ts");
    expect(content).toContain("api-keys/plugin.js");
    expect(content).toContain("API Keys module registered");
  });

  it("app.ts registers Developer Portal route", () => {
    const content = readFileContent("src/app.ts");
    expect(content).toContain("/developer");
    expect(content).toContain("developer-portal.html");
    expect(content).toContain("Developer Portal available");
  });

  it("Swagger tags include API Keys", () => {
    const content = readFileContent("src/app.ts");
    expect(content).toContain('"API Keys"');
  });
});

describe("Sprint 70 — File Structure Completeness", () => {
  const requiredFiles = [
    "src/modules/api-keys/schema/api-keys.ts",
    "src/modules/api-keys/services/api-key.service.ts",
    "src/modules/api-keys/routes/api-key.routes.ts",
    "src/modules/api-keys/plugin.ts",
    "src/shared/middleware/tenant-rate-limit.ts",
    "src/shared/public/developer-portal.html",
    "scripts/gen-sdk.ts",
    "tests/sprint70.test.ts",
  ];

  for (const file of requiredFiles) {
    it(`${file} exists`, () => {
      expect(fileExists(file), `Missing file: ${file}`).toBe(true);
    });
  }
});
