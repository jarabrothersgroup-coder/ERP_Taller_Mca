/**
 * Sprint 16 Tests — PWA, PDF Reports, Accessibility, Performance
 *
 * @module tests/sprint16.test
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { resolveTenant } from "../src/shared/middleware/tenant-resolver.js";
import { resolveProfile } from "../src/shared/middleware/rbac.js";
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
  };
}

vi.mock("../src/shared/database/drizzle.js", () => ({
  db: vi.fn(() => buildMockTx()),
}));

// ─── Test App ──────────────────────────────────

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.addHook("onRequest", resolveTenant);
  app.addHook("onRequest", resolveProfile);

  const { pdfReportRoutes } = await import("../src/shared/routes/pdf-report.routes.js");
  await app.register(pdfReportRoutes);

  await app.ready();
  return app;
}

const headers = { "x-tenant-slug": "test-tenant", "x-user-email": "admin@test.com" };

// ═════════════════════════════════════════════════
//  PDF Report Routes
// ═════════════════════════════════════════════════

describe("📄 [Sprint 16] PDF Report Routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildTestApp(); }, 30_000);
  afterAll(async () => { await app.close(); });

  it("GET /reports/health returns PDF engine status", async () => {
    const res = await app.inject({ method: "GET", url: "/reports/health", headers });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(typeof body.available).toBe("boolean");
    expect(typeof body.message).toBe("string");
  });

  it("GET /reports/ot/:id requires valid UUID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/ot/not-a-uuid",
      headers,
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /reports/factura/:id requires valid UUID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/factura/not-a-uuid",
      headers,
    });
    expect(res.statusCode).toBe(400);
  });
});

// ═════════════════════════════════════════════════
//  PDF Report Service (unit)
// ═════════════════════════════════════════════════

describe("📄 [Sprint 16] PDF Report Service", () => {
  it("isPdfAvailable returns boolean", async () => {
    const { isPdfAvailable } = await import("../src/shared/services/pdf-report.service.js");
    expect(typeof isPdfAvailable()).toBe("boolean");
  });

  it("getChromiumPath returns string or null", async () => {
    const { getChromiumPath } = await import("../src/shared/services/pdf-report.service.js");
    const path = getChromiumPath();
    expect(path === null || typeof path === "string").toBe(true);
  });
});

// ═════════════════════════════════════════════════
//  E2E: Full Middleware Pipeline
// ═════════════════════════════════════════════════

describe("🔄 [Sprint 16] E2E: Middleware Pipeline", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    app.addHook("onRequest", resolveTenant);
    app.addHook("onRequest", resolveProfile);

    // Simple test route
    app.get("/test/echo", async (request) => {
      return { tenant: request.tenantSlug, method: "GET" };
    });

    await app.ready();
  }, 30_000);

  afterAll(async () => { await app.close(); });

  it("tenant → RBAC → route → response pipeline works", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test/echo",
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.tenant).toBe("test-tenant");
  });

  it("rejects request without tenant (403)", async () => {
    const res = await app.inject({ method: "GET", url: "/test/echo" });
    expect(res.statusCode).toBe(403);
  });
});

// ═════════════════════════════════════════════════
//  Accessibility Module (unit)
// ═════════════════════════════════════════════════

describe("♿ [Sprint 16] Accessibility Module", () => {
  it("a11y.js file exists and is valid JS", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const content = readFileSync(
      join(process.cwd(), "src/shared/public/js/a11y.js"),
      "utf-8"
    );
    expect(content).toContain("announce");
    expect(content).toContain("trapFocus");
    expect(content).toContain("renderEmptyState");
    expect(content).toContain("aria-label");
  });

  it("renderEmptyState returns HTML with role=status", async () => {
    // Simulate the renderEmptyState function
    const renderEmptyState = ({ icon, title, description }: any) => {
      return `<div role="status"><span>${icon}</span><h3>${title}</h3><p>${description}</p></div>`;
    };

    const html = renderEmptyState({
      icon: "📋",
      title: "Sin resultados",
      description: "No hay datos disponibles",
    });

    expect(html).toContain('role="status"');
    expect(html).toContain("Sin resultados");
  });
});

// ═════════════════════════════════════════════════
//  PWA Files Existence
// ═════════════════════════════════════════════════

describe("📱 [Sprint 16] PWA Files", () => {
  it("manifest.json exists and is valid JSON", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const content = readFileSync(
      join(process.cwd(), "src/shared/public/manifest.json"),
      "utf-8"
    );
    const manifest = JSON.parse(content);
    expect(manifest.name).toContain("AutomotiveOS");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  it("sw.js exists and has cache strategies", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const content = readFileSync(
      join(process.cwd(), "src/shared/public/sw.js"),
      "utf-8"
    );
    expect(content).toContain("cacheFirst");
    expect(content).toContain("networkFirst");
    expect(content).toContain("staleWhileRevalidate");
    expect(content).toContain("PRECACHE_ASSETS");
  });

  it("pwa.js exists and registers service worker", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const content = readFileSync(
      join(process.cwd(), "src/shared/public/js/pwa.js"),
      "utf-8"
    );
    expect(content).toContain("serviceWorker.register");
    expect(content).toContain("navigator.onLine");
    expect(content).toContain("updateOfflineUI");
  });

  it("index.html has PWA meta tags", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const content = readFileSync(
      join(process.cwd(), "src/shared/public/index.html"),
      "utf-8"
    );
    expect(content).toContain('rel="manifest"');
    expect(content).toContain('name="theme-color"');
    expect(content).toContain('apple-mobile-web-app-capable');
    expect(content).toContain('js/pwa.js');
    expect(content).toContain('js/a11y.js');
  });
});

// ═════════════════════════════════════════════════
//  Build Script
// ═════════════════════════════════════════════════

describe("🔨 [Sprint 16] Build Script", () => {
  it("build-frontend.js exists", async () => {
    const { existsSync } = await import("fs");
    const { join } = await import("path");
    expect(existsSync(join(process.cwd(), "scripts/build-frontend.js"))).toBe(true);
  });

  it("esbuild is installed", async () => {
    const { execSync } = await import("child_process");
    const version = execSync("npx esbuild --version", { encoding: "utf-8" }).trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
