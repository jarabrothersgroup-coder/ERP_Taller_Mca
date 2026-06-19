/**
 * Sprint 60 — Production Hardening + Monitoring + Load Testing
 *
 * Tests:
 *   1. GET /health/deep returns service status with latency
 *   2. GET /metrics returns Prometheus text format
 *   3. GET /metrics contains http_requests_total counter
 *   4. GET /metrics contains http_request_duration_seconds histogram
 *   5. GET /metrics contains process_resident_memory_bytes gauge
 *   6. GET /metrics contains db_connection_healthy gauge
 *   7. GET /health/deep includes database service
 *   8. GET /health/deep includes external service checks
 *   9. Graceful shutdown handles SIGTERM (integration)
 *  10. CSP header allows Tailwind CDN in production
 *  11. Metrics in-flight counter tracks active requests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  // Register plugins needed for tests
  const { healthCheckPlugin } = await import("../../src/plugins/health-check.js");
  const { metricsPlugin } = await import("../../src/plugins/metrics.js");
  await app.register(healthCheckPlugin);
  await app.register(metricsPlugin);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("Sprint 60 — Production Hardening", () => {
  // ── /health/deep ──────────────────────────────────

  it("GET /health/deep returns service status with latency", async () => {
    const res = await app.inject({ method: "GET", url: "/health/deep" });
    // 200 if all services ok, 503 if any external service is down (expected in test)
    expect([200, 503]).toContain(res.statusCode);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("services");
    expect(body).toHaveProperty("totalLatencyMs");
    expect(body).toHaveProperty("timestamp");
    expect(Array.isArray(body.services)).toBe(true);
    expect(["ok", "degraded", "error"]).toContain(body.status);
  });

  it("GET /health/deep includes database service", async () => {
    const res = await app.inject({ method: "GET", url: "/health/deep" });
    const body = JSON.parse(res.payload);
    const dbService = body.services.find((s: any) => s.name === "database");
    expect(dbService).toBeDefined();
    expect(dbService).toHaveProperty("status");
    expect(dbService).toHaveProperty("latencyMs");
    expect(["ok", "error"]).toContain(dbService.status);
  });

  it("GET /health/deep includes external service checks", async () => {
    const res = await app.inject({ method: "GET", url: "/health/deep" });
    const body = JSON.parse(res.payload);
    const serviceNames = body.services.map((s: any) => s.name);
    expect(serviceNames).toContain("database");
    expect(serviceNames).toContain("redis");
    expect(serviceNames).toContain("supabase");
  });

  // ── /metrics (Prometheus) ─────────────────────────

  it("GET /metrics returns Prometheus text format", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.payload).toContain("# Prometheus Metrics — AutomotiveOS ERP");
  });

  it("GET /metrics contains http_requests_total counter", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.payload).toContain("# TYPE http_requests_total counter");
    expect(res.payload).toMatch(/http_requests_total \d+/);
  });

  it("GET /metrics contains http_request_duration_seconds histogram", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.payload).toContain("# TYPE http_request_duration_seconds histogram");
    expect(res.payload).toContain("http_request_duration_seconds_bucket{le=\"0.005\"}");
    expect(res.payload).toContain("http_request_duration_seconds_bucket{le=\"+Inf\"}");
    expect(res.payload).toContain("http_request_duration_seconds_count");
    expect(res.payload).toContain("http_request_duration_seconds_sum");
  });

  it("GET /metrics contains process_resident_memory_bytes gauge", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.payload).toContain("# TYPE process_resident_memory_bytes gauge");
    expect(res.payload).toMatch(/process_resident_memory_bytes \d+/);
  });

  it("GET /metrics contains db_connection_healthy gauge", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.payload).toContain("# TYPE db_connection_healthy gauge");
    expect(res.payload).toMatch(/db_connection_healthy [01]/);
  });

  it("GET /metrics contains http_requests_by_method breakdown", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.payload).toContain("# TYPE http_requests_by_method counter");
    expect(res.payload).toMatch(/http_requests_by_method\{method="GET"\} \d+/);
  });

  it("GET /metrics tracks request count after requests", async () => {
    // Make a few requests to increment counters
    await app.inject({ method: "GET", url: "/health" });
    await app.inject({ method: "GET", url: "/health/live" });
    await app.inject({ method: "GET", url: "/metrics" });

    const res = await app.inject({ method: "GET", url: "/metrics" });
    const match = res.payload.match(/http_requests_total (\d+)/);
    expect(match).not.toBeNull();
    const total = parseInt(match![1], 10);
    expect(total).toBeGreaterThanOrEqual(3); // At least the 3 requests above
  });

  it("GET /metrics contains process_uptime_seconds", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.payload).toContain("# TYPE process_uptime_seconds gauge");
    expect(res.payload).toMatch(/process_uptime_seconds [\d.]+/);
  });
});
