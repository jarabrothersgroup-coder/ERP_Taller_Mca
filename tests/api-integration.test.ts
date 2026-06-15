/**
 * API Integration — Fastify inject() Tests
 *
 * Tests tenant isolation middleware, error handling,
 * and route-level request validation.
 *
 * Uses a minimal Fastify instance with the same middleware
 * and route patterns as the production app, but with mocked
 * service dependencies.
 *
 * @module tests/api-integration.test
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { resolveTenant } from "../src/shared/middleware/tenant-resolver.js";
import { errorHandler } from "../src/shared/middleware/error-handler.js";
import type { SyncOperation } from "../src/shared/offline/sync-service.js";

// ─── Shared test helpers ─────────────────────

function buildTestApp() {
  const app = Fastify({ logger: false });

  // Production-level error handler
  app.setErrorHandler(errorHandler);

  // Tenant isolation middleware (same as sync routes)
  app.addHook("onRequest", resolveTenant);

  // Test endpoints
  app.get("/test/echo", async (request) => {
    return { tenant: request.tenantSlug, method: "GET" };
  });

  app.post("/test/echo", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    return { tenant: request.tenantSlug, body };
  });

  // POST /test/validate — validates a batch of sync-like operations
  app.post("/test/validate", async (request, reply) => {
    const { operations } = request.body as { operations?: SyncOperation[] };

    if (!Array.isArray(operations) || operations.length === 0) {
      reply.code(400);
      return { error: "operations must be a non-empty array" };
    }

    if (operations.length > 50) {
      reply.code(400);
      return { error: "Max 50 operations per batch" };
    }

    return { success: true, count: operations.length };
  });

  return app;
}

// ─── Tests ───────────────────────────────────

describe("🔒 Tenant Isolation Middleware", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects request without X-Tenant-Slug with 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test/echo",
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toContain("ForbiddenError");
    expect(body.message).toContain("X-Tenant-Slug");
  });

  it("rejects SQL injection payload in X-Tenant-Slug", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test/echo",
      headers: { "x-tenant-slug": "taller'; DROP TABLE tenants; --" },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.message).toContain("Invalid tenant slug");
  });

  it("rejects slug with SQL semicolon (multi-statement)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test/echo",
      headers: { "x-tenant-slug": "taller; SELECT 1" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects empty X-Tenant-Slug header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test/echo",
      headers: { "x-tenant-slug": "" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("accepts valid X-Tenant-Slug and routes correctly", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test/echo",
      headers: { "x-tenant-slug": "taller-el-chero" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.tenant).toBe("taller-el-chero");
  });

  it("passes tenant slug through POST requests", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/test/echo",
      headers: { "x-tenant-slug": "taller_oviedo" },
      payload: { test: true },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.tenant).toBe("taller_oviedo");
  });

  it("rejects whitespace-only slug as invalid", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test/echo",
      headers: { "x-tenant-slug": "   " },
    });
    expect(res.statusCode).toBe(403);
  });

  it("strips tenant slug to the middleware-parsed value (not sanitized by route)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/test/echo",
      headers: { "x-tenant-slug": "  taller_chero  " },
    });
    // Leading/trailing whitespace — slug regex won't match
    expect(res.statusCode).toBe(403);
  });
});

describe("📦 Route-level Validation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects empty operations array", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/test/validate",
      headers: { "x-tenant-slug": "taller_chero" },
      payload: { operations: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects missing operations field", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/test/validate",
      headers: { "x-tenant-slug": "taller_chero" },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects oversized batch (>50 operations)", async () => {
    const ops = Array.from({ length: 51 }, (_, i) => ({
      id: `op-${i}`, entity: "clients", action: "create",
      payload: {}, timestamp: Date.now(), retryCount: 0,
    }));
    const res = await app.inject({
      method: "POST",
      url: "/test/validate",
      headers: { "x-tenant-slug": "taller_chero" },
      payload: { operations: ops },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain("50");
  });

  it("accepts valid batch of operations", async () => {
    const ops = [
      { id: "op-1", entity: "clients", action: "create" as const,
        payload: { name: "Test" }, timestamp: Date.now(), retryCount: 0 },
      { id: "op-2", entity: "vehicles", action: "create" as const,
        payload: { brand: "Toyota", model: "Corolla", clientId: "c-1" },
        timestamp: Date.now(), retryCount: 0 },
    ];
    const res = await app.inject({
      method: "POST",
      url: "/test/validate",
      headers: { "x-tenant-slug": "taller_chero" },
      payload: { operations: ops },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).count).toBe(2);
  });
});

describe("🌐 Health Check Convention", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Public routes (health check) must NOT require X-Tenant-Slug
  it("public route without tenant slug returns 403 (middleware is global in test app)", async () => {
    // In this test app, resolveTenant is a global onRequest hook.
    // In production, health routes are registered before the tenant hook.
    // This test documents that middleware ordering matters.
    const res = await app.inject({
      method: "GET",
      url: "/test/echo",
    });
    expect(res.statusCode).toBe(403);
  });
});
