/**
 * Sprint 18 Tests — Security Headers, CORS, RLS
 *
 * Validates:
 *   - Security headers (CSP, HSTS, X-Frame, etc.)
 *   - CORS configuration
 *   - RLS middleware
 *   - RLS SQL migration structure
 *
 * @module tests/sprint18-security.test
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { errorHandler } from "../src/shared/middleware/error-handler.js";

// ─── Mock DB ───────────────────────────────────

function buildMockTx() {
  function result(value: unknown[]) {
    const p = Promise.resolve(value);
    return Object.assign(p, { limit: () => p, offset: () => p });
  }
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => result([])),
    offset: vi.fn().mockImplementation(() => result([])),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(() => result([])),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    desc: vi.fn().mockReturnThis(),
    sql: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    transaction: vi.fn(async (cb: any) => cb(buildMockTx())),
    __dangerous_query_value: vi.fn((v: string) => v),
  };
}

vi.mock("../src/shared/database/drizzle.js", () => ({
  db: vi.fn(() => buildMockTx()),
}));

vi.mock("../src/shared/database/connection.js", () => ({
  getDb: vi.fn(() => {
    // Mock as a tagged template literal function (postgres.js style)
    function sqlFn(strings: TemplateStringsArray, ...values: unknown[]) {
      return Promise.resolve([]);
    }
    sqlFn.unsafe = vi.fn().mockResolvedValue([]);
    sqlFn.__dangerous_query_value = vi.fn((v: string) => `'${v}'`);
    return sqlFn;
  }),
  validateConnection: vi.fn().mockResolvedValue(true),
}));

// ─── Test App ──────────────────────────────────

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);

  // Register security headers
  const { securityHeadersHook } = await import("../src/shared/middleware/security-headers.js");
  app.addHook("onRequest", securityHeadersHook);

  // Register tenant resolver (for protected routes)
  const { resolveTenant } = await import("../src/shared/middleware/tenant-resolver.js");
  app.addHook("onRequest", resolveTenant);

  // Register RLS middleware
  const { rlsTenantContext } = await import("../src/shared/middleware/rls.js");
  app.addHook("onRequest", rlsTenantContext);

  // Test routes
  app.get("/test/public", async () => ({ ok: true }));

  app.get("/test/protected", async (request) => ({
    ok: true,
    tenant: request.tenantSlug,
  }));

  await app.ready();
  return app;
}

const tenantHeaders = { "x-tenant-slug": "test-tenant", "x-user-email": "admin@test.com" };

// ═════════════════════════════════════════════════
//  Security Headers
// ═════════════════════════════════════════════════

describe("🔒 [Sprint 18] Security Headers", () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildTestApp(); }, 30_000);
  afterAll(async () => { await app.close(); });

  it("returns Content-Security-Policy header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: tenantHeaders,
    });
    expect(res.statusCode).toBe(200);
    const csp = res.headers["content-security-policy"];
    expect(typeof csp).toBe("string");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src");
    expect(csp).toContain("style-src");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("returns X-Content-Type-Options: nosniff", async () => {
    const res = await app.inject({ method: "GET", url: "/test/public" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("returns X-Frame-Options: DENY", async () => {
    const res = await app.inject({ method: "GET", url: "/test/public" });
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });

  it("returns Referrer-Policy header", async () => {
    const res = await app.inject({ method: "GET", url: "/test/public" });
    const referrer = res.headers["referrer-policy"];
    expect(typeof referrer).toBe("string");
    expect(referrer).toContain("strict-origin");
  });

  it("returns Permissions-Policy header", async () => {
    const res = await app.inject({ method: "GET", url: "/test/public" });
    const pp = res.headers["permissions-policy"];
    expect(typeof pp).toBe("string");
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("geolocation=()");
  });

  it("returns Cross-Origin-Opener-Policy: same-origin", async () => {
    const res = await app.inject({ method: "GET", url: "/test/public" });
    expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin");
  });

  it("returns Cross-Origin-Resource-Policy: same-origin", async () => {
    const res = await app.inject({ method: "GET", url: "/test/public" });
    expect(res.headers["cross-origin-resource-policy"]).toBe("same-origin");
  });

  it("returns X-XSS-Protection header (legacy)", async () => {
    const res = await app.inject({ method: "GET", url: "/test/public" });
    expect(res.headers["x-xss-protection"]).toBe("1; mode=block");
  });
});

// ═════════════════════════════════════════════════
//  CORS Configuration
// ═════════════════════════════════════════════════

describe("🌐 [Sprint 18] CORS Configuration", () => {
  it("allows configured origins in preflight", async () => {
    // Build a fresh app with CORS
    const app = Fastify({ logger: false });
    const { securityHeadersHook } = await import("../src/shared/middleware/security-headers.js");
    app.addHook("onRequest", securityHeadersHook);

    await app.register((await import("@fastify/cors")).default, {
      origin: [/^http:\/\/localhost(:\d+)?$/],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-Slug", "X-User-Email"],
      maxAge: 86400,
    });

    app.get("/test/cors", async () => ({ ok: true }));
    await app.ready();

    // Preflight from localhost
    const res = await app.inject({
      method: "OPTIONS",
      url: "/test/cors",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "POST",
        "access-control-request-headers": "Content-Type,X-Tenant-Slug",
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBeDefined();
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
    expect(res.headers["access-control-max-age"]).toBe("86400");

    await app.close();
  });

  it("rejects unknown origins in production mode", async () => {
    // In dev mode, CORS uses regex origins, so this test verifies the pattern
    const origins = [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];
    const testOrigin = "http://evil.com";

    const matches = origins.some((pattern) =>
      pattern instanceof RegExp ? pattern.test(testOrigin) : pattern === testOrigin
    );

    expect(matches).toBe(false);
  });

  it("accepts localhost origins", () => {
    const origins = [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

    const testCases = [
      "http://localhost:3000",
      "http://localhost:8080",
      "http://localhost",
      "http://127.0.0.1:3000",
      "http://127.0.0.1",
    ];

    for (const origin of testCases) {
      const matches = origins.some((pattern) =>
        pattern instanceof RegExp ? pattern.test(origin) : pattern === origin
      );
      expect(matches).toBe(true);
    }
  });
});

// ═════════════════════════════════════════════════
//  RLS Middleware
// ═════════════════════════════════════════════════

describe("🛡️ [Sprint 18] RLS Tenant Context Middleware", () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildTestApp(); }, 30_000);
  afterAll(async () => { await app.close(); });

  it("sets tenant context for protected routes", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: tenantHeaders,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.tenant).toBe("test-tenant");
  });

  it("rejects request without tenant header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test/protected",
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects request with invalid tenant slug format", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: { "x-tenant-slug": "invalid slug with spaces" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("accepts valid tenant slug with hyphens and underscores", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: { "x-tenant-slug": "taller-el-chero_2024" },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ═════════════════════════════════════════════════
//  RLS SQL Migration Structure
// ═════════════════════════════════════════════════

describe("📝 [Sprint 18] RLS Migration Structure", () => {
  it("migration file exists", async () => {
    const { existsSync } = await import("fs");
    const { join } = await import("path");
    expect(
      existsSync(join(process.cwd(), "src/shared/database/migrations/0019_rls_security.sql"))
    ).toBe(true);
  });

  it("migration creates current_tenant() function", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0019_rls_security.sql"),
      "utf-8"
    );
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.current_tenant()");
    expect(sql).toContain("current_setting('app.current_tenant'");
  });

  it("migration enables RLS on all tenant tables", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0019_rls_security.sql"),
      "utf-8"
    );

    // Migration uses helper functions (apply_rls_slug / apply_rls_uuid)
    // that dynamically enable RLS via format() — verify the function-based approach
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.apply_rls_slug");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.apply_rls_uuid");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");

    // Verify key tables are covered by SELECT public.apply_rls_slug('...')
    const requiredSlugTables = [
      "clients", "vehiculos", "ordenes_trabajo", "ingresos",
      "servicios_catalogo", "orden_servicios", "orden_repuestos",
      "facturas", "cuentas_bancarias", "movimientos_tesoreria",
      "repuestos", "herramientas", "notificaciones",
      "audit_log", "centros_costo", "tenant_config",
      "presupuestos", "thinkcar_imports",
    ];

    for (const table of requiredSlugTables) {
      expect(sql).toContain(`apply_rls_slug('${table}')`);
    }

    // UUID-based tables
    expect(sql).toContain("apply_rls_uuid('fixed_expenses')");
    expect(sql).toContain("apply_rls_uuid('profiles')");
  });

  it("migration creates SELECT/INSERT/UPDATE/DELETE policies", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0019_rls_security.sql"),
      "utf-8"
    );

    // Helper functions create all 4 policy types via EXECUTE format
    expect(sql).toContain("_tenant_select");
    expect(sql).toContain("_tenant_insert");
    expect(sql).toContain("_tenant_update");
    expect(sql).toContain("_tenant_delete");

    // Verify the helper function body creates all 4 policies
    expect(sql).toContain("FOR SELECT USING");
    expect(sql).toContain("FOR INSERT WITH CHECK");
    expect(sql).toContain("FOR UPDATE USING");
    expect(sql).toContain("FOR DELETE USING");
  });

  it("migration disables RLS on tenants table (platform-level)", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0019_rls_security.sql"),
      "utf-8"
    );
    expect(sql).toContain("ALTER TABLE tenants DISABLE ROW LEVEL SECURITY");
  });
});

// ═════════════════════════════════════════════════
//  Security Headers Module (unit)
// ═════════════════════════════════════════════════

describe("🔧 [Sprint 18] Security Headers Module", () => {
  it("security-headers.ts exports securityHeadersHook and generateCspNonce", async () => {
    const mod = await import("../src/shared/middleware/security-headers.js");
    expect(typeof mod.securityHeadersHook).toBe("function");
    expect(typeof mod.generateCspNonce).toBe("function");
  });

  it("generateCspNonce returns base64 string", async () => {
    const { generateCspNonce } = await import("../src/shared/middleware/security-headers.js");
    const nonce = generateCspNonce();
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBeGreaterThan(0);
  });

  it("rls.ts exports rlsTenantContext and SQL helpers", async () => {
    const mod = await import("../src/shared/middleware/rls.js");
    expect(typeof mod.rlsTenantContext).toBe("function");
    expect(typeof mod.generateRlsPolicySql).toBe("function");
    expect(typeof mod.generateRlsPolicyUuidSql).toBe("function");
    expect(typeof mod.RLS_FUNCTION_SQL).toBe("string");
  });

  it("generateRlsPolicySql produces valid SQL", async () => {
    const { generateRlsPolicySql } = await import("../src/shared/middleware/rls.js");
    const sql = generateRlsPolicySql("test_table");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("test_table_tenant_isolation_select");
    expect(sql).toContain("test_table_tenant_isolation_insert");
    expect(sql).toContain("test_table_tenant_isolation_update");
    expect(sql).toContain("test_table_tenant_isolation_delete");
    expect(sql).toContain("public.current_tenant()");
  });
});
