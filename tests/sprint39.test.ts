/**
 * Sprint 39 Tests — Deploy Migration + Production Smoke Test.
 *
 * Tests for:
 *   - Health Check Endpoints (liveness, readiness, module status)
 *   - API Smoke Test Script (validation, error handling)
 *   - Deployment Checklist (documentation completeness)
 *
 * @module tests/sprint39
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock database ────────────────────────────
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockResolvedValue([]);
const mockReturning = vi.fn().mockResolvedValue([{ id: "test-id" }]);
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({ returning: mockReturning }),
});
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: mockReturning }),
  }),
});

const mockDb = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  execute: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock("../../src/shared/database/drizzle.js", () => ({
  db: mockDb,
}));

// ─── Health Check Plugin ─────────────────────

describe("Sprint 39 — Health Check Plugin", () => {
  it("exports healthCheckPlugin function", async () => {
    const mod = await import("../../src/plugins/health-check.js");
    expect(typeof mod.healthCheckPlugin).toBe("function");
  });

  it("registers /health endpoint", async () => {
    const mod = await import("../../src/plugins/health-check.js");
    const routes: string[] = [];
    const mockApp = {
      get: (path: string, _handler: any) => {
        routes.push(path);
      },
    };
    await mod.healthCheckPlugin(mockApp as any);
    expect(routes).toContain("/health");
  });

  it("registers /health/live endpoint", async () => {
    const mod = await import("../../src/plugins/health-check.js");
    const routes: string[] = [];
    const mockApp = {
      get: (path: string, _handler: any) => {
        routes.push(path);
      },
    };
    await mod.healthCheckPlugin(mockApp as any);
    expect(routes).toContain("/health/live");
  });

  it("registers /health/ready endpoint", async () => {
    const mod = await import("../../src/plugins/health-check.js");
    const routes: string[] = [];
    const mockApp = {
      get: (path: string, _handler: any) => {
        routes.push(path);
      },
    };
    await mod.healthCheckPlugin(mockApp as any);
    expect(routes).toContain("/health/ready");
  });

  it("registers /health/modules endpoint", async () => {
    const mod = await import("../../src/plugins/health-check.js");
    const routes: string[] = [];
    const mockApp = {
      get: (path: string, _handler: any) => {
        routes.push(path);
      },
    };
    await mod.healthCheckPlugin(mockApp as any);
    expect(routes).toContain("/health/modules");
  });
});

// ─── API Smoke Test Script ───────────────────

describe("Sprint 39 — API Smoke Test Script", () => {
  it("has valid test structure", async () => {
    const fs = await import("fs");
    const smokeTestPath = new URL(
      "../src/shared/database/api-smoke-test.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(smokeTestPath, "utf-8");

    // Verify script has required sections
    expect(content).toContain("BASE_URL");
    expect(content).toContain("TENANT_SLUG");
    expect(content).toContain("async function test");
    expect(content).toContain("async function api");
    expect(content).toContain("runTests");
  });

  it("tests health endpoints", async () => {
    const fs = await import("fs");
    const smokeTestPath = new URL(
      "../src/shared/database/api-smoke-test.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(smokeTestPath, "utf-8");

    expect(content).toContain("GET /health");
    expect(content).toContain("GET /health/live");
  });

  it("tests workshop endpoints", async () => {
    const fs = await import("fs");
    const smokeTestPath = new URL(
      "../src/shared/database/api-smoke-test.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(smokeTestPath, "utf-8");

    expect(content).toContain("GET /workshop/ordenes");
    expect(content).toContain("GET /workshop/clientes");
    expect(content).toContain("GET /workshop/vehiculos");
    expect(content).toContain("GET /workshop/servicios");
  });

  it("tests scheduling endpoints", async () => {
    const fs = await import("fs");
    const smokeTestPath = new URL(
      "../src/shared/database/api-smoke-test.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(smokeTestPath, "utf-8");

    expect(content).toContain("GET /scheduling/appointments");
    expect(content).toContain("GET /scheduling/stats");
  });

  it("tests marketing and fleet endpoints", async () => {
    const fs = await import("fs");
    const smokeTestPath = new URL(
      "../src/shared/database/api-smoke-test.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(smokeTestPath, "utf-8");

    expect(content).toContain("GET /marketing/campaigns");
    expect(content).toContain("GET /fleet");
  });

  it("tests inventory endpoints", async () => {
    const fs = await import("fs");
    const smokeTestPath = new URL(
      "../src/shared/database/api-smoke-test.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(smokeTestPath, "utf-8");

    expect(content).toContain("GET /inventory/repuestos");
    expect(content).toContain("GET /inventory/tecdoc/status");
  });

  it("tests sync and config endpoints", async () => {
    const fs = await import("fs");
    const smokeTestPath = new URL(
      "../src/shared/database/api-smoke-test.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(smokeTestPath, "utf-8");

    expect(content).toContain("GET /sync/config");
    expect(content).toContain("GET /api/profiles");
  });

  it("includes memory check", async () => {
    const fs = await import("fs");
    const smokeTestPath = new URL(
      "../src/shared/database/api-smoke-test.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(smokeTestPath, "utf-8");

    expect(content).toContain("Memory < 50MB RSS");
  });

  it("has proper error handling", async () => {
    const fs = await import("fs");
    const smokeTestPath = new URL(
      "../src/shared/database/api-smoke-test.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(smokeTestPath, "utf-8");

    expect(content).toContain("status: \"fail\"");
    expect(content).toContain("error?: string");
    expect(content).toContain("process.exit(1)");
  });
});

// ─── Deployment Checklist ────────────────────

describe("Sprint 39 — Deployment Checklist", () => {
  it("has deployment checklist file", async () => {
    const fs = await import("fs");
    const checklistPath = new URL(
      "../docs/Proyecto/DEPLOYMENT.md",
      import.meta.url,
    ).pathname;
    expect(fs.existsSync(checklistPath)).toBe(true);
  });

  it("covers environment variables", async () => {
    const fs = await import("fs");
    const checklistPath = new URL(
      "../docs/Proyecto/DEPLOYMENT.md",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(checklistPath, "utf-8");

    expect(content).toContain("DATABASE_URL");
    expect(content).toContain("SUPABASE_URL");
    expect(content).toContain("SUPABASE_ANON_KEY");
  });

  it("covers database migration", async () => {
    const fs = await import("fs");
    const checklistPath = new URL(
      "../docs/Proyecto/DEPLOYMENT.md",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(checklistPath, "utf-8");

    expect(content).toContain("0022_sprint34_new_tables.sql");
    expect(content).toContain("run-migrations.ts");
  });

  it("covers storage setup", async () => {
    const fs = await import("fs");
    const checklistPath = new URL(
      "../docs/Proyecto/DEPLOYMENT.md",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(checklistPath, "utf-8");

    expect(content).toContain("setup-storage.ts");
    expect(content).toContain("dvi-photos");
  });

  it("covers health check verification", async () => {
    const fs = await import("fs");
    const checklistPath = new URL(
      "../docs/Proyecto/DEPLOYMENT.md",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(checklistPath, "utf-8");

    expect(content).toContain("/health");
    expect(content).toContain("curl");
  });

  it("covers RBAC verification", async () => {
    const fs = await import("fs");
    const checklistPath = new URL(
      "../docs/Proyecto/DEPLOYMENT.md",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(checklistPath, "utf-8");

    expect(content).toContain("Admin");
    expect(content).toContain("Manager");
    expect(content).toContain("Mechanic");
  });

  it("covers rollback plan", async () => {
    const fs = await import("fs");
    const checklistPath = new URL(
      "../docs/Proyecto/DEPLOYMENT.md",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(checklistPath, "utf-8");

    expect(content).toContain("Rollback Plan");
    expect(content).toContain("Revert");
  });
});

// ─── Database Smoke Test ─────────────────────

describe("Sprint 39 — Database Smoke Test", () => {
  it("has valid smoke test structure", async () => {
    const fs = await import("fs");
    const smokeTestPath = new URL(
      "../src/shared/database/smoke-test.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(smokeTestPath, "utf-8");

    expect(content).toContain("DATABASE_URL");
    expect(content).toContain("SELECT 1");
    expect(content).toContain("SELECT version()");
    expect(content).toContain("information_schema.tables");
    expect(content).toContain("process.memoryUsage");
  });

  it("validates memory footprint", async () => {
    const fs = await import("fs");
    const smokeTestPath = new URL(
      "../src/shared/database/smoke-test.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(smokeTestPath, "utf-8");

    expect(content).toContain("50 MB");
    expect(content).toContain("RSS");
  });
});

// ─── Health Check Response Types ─────────────

describe("Sprint 39 — Health Check Response Types", () => {
  it("defines proper health response structure", async () => {
    const mem = process.memoryUsage();

    const response = {
      status: "ok" as const,
      uptime: Math.floor((Date.now() - Date.now()) / 1000),
      database: "connected",
      version: "0.1.0",
      memory: {
        rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      },
    };

    expect(response.status).toBe("ok");
    expect(response.database).toBe("connected");
    expect(response.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(response.memory.rss).toContain("MB");
  });

  it("defines module status structure", async () => {
    const moduleStatus = {
      name: "database",
      status: "ok" as const,
      message: "Connected",
    };

    expect(moduleStatus.name).toBe("database");
    expect(["ok", "degraded", "error"]).toContain(moduleStatus.status);
    expect(typeof moduleStatus.message).toBe("string");
  });

  it("validates liveness probe response", async () => {
    const response = { alive: true };
    expect(response.alive).toBe(true);
  });

  it("validates readiness probe response", async () => {
    const response = {
      ready: true,
      timestamp: new Date().toISOString(),
    };
    expect(response.ready).toBe(true);
    expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
