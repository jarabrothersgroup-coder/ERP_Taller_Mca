/**
 * Health check plugin.
 *
 * Provides endpoints for:
 *   - `/health` — Full health check (DB, memory, modules)
 *   - `/health/live` — Liveness probe (Kubernetes)
 *   - `/health/ready` — Readiness probe (DB + modules)
 *   - `/health/modules` — Module status check
 *   - `/health/deep` — Deep check with external services (Redis, Supabase, Evolution API, Twenty CRM)
 *
 * Sprint 60: Added /health/deep for production readiness validation.
 *
 * @module plugins/health-check
 */

import type { FastifyInstance } from "fastify";
import { validateConnection } from "../shared/database/connection.js";
import type { HealthCheckResponse } from "../shared/types/index.js";

const startTime = Date.now();

/** Module health status */
interface ModuleStatus {
  name: string;
  status: "ok" | "degraded" | "error";
  message?: string;
  latencyMs?: number;
}

/** Deep service check result */
interface DeepServiceCheck {
  name: string;
  status: "ok" | "degraded" | "error" | "skip";
  latencyMs: number;
  message?: string;
}

/** Get status of all registered modules */
async function getModuleStatuses(): Promise<ModuleStatus[]> {
  const modules: ModuleStatus[] = [];

  // Database
  const dbStart = Date.now();
  const dbHealthy = await validateConnection();
  modules.push({
    name: "database",
    status: dbHealthy ? "ok" : "error",
    message: dbHealthy ? "Connected" : "Disconnected",
    latencyMs: Date.now() - dbStart,
  });

  // Memory
  const mem = process.memoryUsage();
  const rssMb = mem.rss / 1024 / 1024;
  modules.push({
    name: "memory",
    status: rssMb < 50 ? "ok" : rssMb < 75 ? "degraded" : "error",
    message: `${rssMb.toFixed(2)}MB RSS`,
  });

  // Uptime
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  modules.push({
    name: "uptime",
    status: "ok",
    message: `${uptimeSeconds}s`,
  });

  // Node.js version
  modules.push({
    name: "runtime",
    status: "ok",
    message: process.version,
  });

  return modules;
}

/**
 * Ping an external service with timeout.
 * Returns status and latency without throwing.
 */
async function pingService(
  name: string,
  url: string,
  timeoutMs: number = 3000,
): Promise<DeepServiceCheck> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "AutomotiveOS-HealthCheck/1.0" },
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    return {
      name,
      status: res.ok ? "ok" : "degraded",
      latencyMs,
      message: `HTTP ${res.status}`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const isTimeout = err?.name === "AbortError";
    return {
      name,
      status: "error",
      latencyMs,
      message: isTimeout ? `Timeout after ${timeoutMs}ms` : err?.message || "Connection failed",
    };
  }
}

/**
 * Registers health check routes on the Fastify instance.
 *
 * @param app - Fastify instance
 */
export async function healthCheckPlugin(app: FastifyInstance): Promise<void> {
  // Full health check
  app.get("/health", async (_request, reply) => {
    const dbHealthy = await validateConnection();
    const mem = process.memoryUsage();

    const response: HealthCheckResponse = {
      status: dbHealthy ? "ok" : "degraded",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      database: dbHealthy ? "connected" : "disconnected",
      version: "0.1.0",
      memory: {
        rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      },
    };

    const statusCode = dbHealthy ? 200 : 503;
    reply.status(statusCode).send(response);
  });

  // Liveness probe (always 200 if server is running)
  app.get("/health/live", async (_request, reply) => {
    reply.status(200).send({ alive: true });
  });

  // Readiness probe (200 only if DB is connected)
  app.get("/health/ready", async (_request, reply) => {
    const dbHealthy = await validateConnection();
    const statusCode = dbHealthy ? 200 : 503;
    reply.status(statusCode).send({
      ready: dbHealthy,
      timestamp: new Date().toISOString(),
    });
  });

  // Module status check
  app.get("/health/modules", async (_request, reply) => {
    const modules = await getModuleStatuses();
    const allOk = modules.every((m) => m.status === "ok");
    const hasErrors = modules.some((m) => m.status === "error");

    const statusCode = hasErrors ? 503 : allOk ? 200 : 200;
    reply.status(statusCode).send({
      status: hasErrors ? "degraded" : "ok",
      modules,
      timestamp: new Date().toISOString(),
    });
  });

  // Sprint 60: Deep health check — pings all external services
  app.get("/health/deep", async (_request, reply) => {
    const deepStart = Date.now();

    // Parallel pings to all external services
    const [db, redis, evolutionApi, twentyCrm] = await Promise.all([
      // DB — reuse existing validator
      (async (): Promise<DeepServiceCheck> => {
        const s = Date.now();
        const ok = await validateConnection();
        return { name: "database", status: ok ? "ok" : "error", latencyMs: Date.now() - s, message: ok ? "Connected" : "Disconnected" };
      })(),
      // Redis — check if port is reachable
      pingService("redis", "http://localhost:6379", 2000).catch(() => ({
        name: "redis", status: "skip" as const, latencyMs: 0, message: "Not configured",
      })),
      // Evolution API — ping health endpoint
      pingService("evolution-api", `${process.env.EVOLUTION_API_URL || "http://localhost:8080"}/health`, 3000),
      // Twenty CRM — ping health endpoint
      pingService("twenty-crm", `${process.env.TWENTY_CRM_URL || "http://localhost:3000"}/health`, 3000),
    ]);

    const services = [db, redis, evolutionApi, twentyCrm];
    const errors = services.filter((s) => s.status === "error").length;
    const degraded = services.filter((s) => s.status === "degraded").length;
    const totalLatencyMs = Date.now() - deepStart;

    // Overall status: error if any critical service is down
    let overallStatus: "ok" | "degraded" | "error" = "ok";
    if (errors > 0) overallStatus = "error";
    else if (degraded > 0) overallStatus = "degraded";

    const statusCode = overallStatus === "error" ? 503 : 200;
    reply.status(statusCode).send({
      status: overallStatus,
      services,
      totalLatencyMs,
      timestamp: new Date().toISOString(),
    });
  });
}
