/**
 * Health check plugin.
 *
 * Provides endpoints for:
 *   - `/health` — Full health check (DB, memory, modules)
 *   - `/health/live` — Liveness probe (Kubernetes)
 *   - `/health/ready` — Readiness probe (DB + modules)
 *   - `/health/modules` — Module status check
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
}

/** Get status of all registered modules */
async function getModuleStatuses(): Promise<ModuleStatus[]> {
  const modules: ModuleStatus[] = [];

  // Database
  const dbHealthy = await validateConnection();
  modules.push({
    name: "database",
    status: dbHealthy ? "ok" : "error",
    message: dbHealthy ? "Connected" : "Disconnected",
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
}
