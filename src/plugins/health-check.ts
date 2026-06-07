/**
 * Health check plugin.
 *
 * Provides `/health` endpoint for:
 *   - Liveness probes (Kubernetes / cloud)
 *   - Database connection validation
 *   - Memory usage monitoring (< 50MB RAM enforcement)
 *
 * @module plugins/health-check
 */

import type { FastifyInstance } from "fastify";
import { validateConnection } from "../shared/database/connection.js";
import type { HealthCheckResponse } from "../shared/types/index.js";

const startTime = Date.now();

/**
 * Registers the health check route on the Fastify instance.
 *
 * @param app - Fastify instance
 */
export async function healthCheckPlugin(app: FastifyInstance): Promise<void> {
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

  app.get("/health/live", async (_request, reply) => {
    reply.status(200).send({ alive: true });
  });
}
