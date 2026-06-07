/**
 * AutomotiveOS Cloud ERP — Application Entry Point.
 *
 * Fastify server with:
 *   - Remote PostgreSQL (Neon/Supabase) connection
 *   - Multi-tenant isolation
 *   - Offline-first sync support
 *   - Health check endpoints
 *   - Paraguayan SIFEN fiscal readiness
 *
 * RAM target: < 50MB at rest.
 *
 * @module app
 */

import Fastify from "fastify";
import { env } from "./config/env.js";
import { healthCheckPlugin } from "./plugins/health-check.js";
import { syncPlugin } from "./plugins/sync.js";
import { errorHandler } from "./shared/middleware/error-handler.js";

async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // ─── Global error handler ──────────────────
  app.setErrorHandler(errorHandler);

  // ─── Plugins ───────────────────────────────
  await app.register(healthCheckPlugin);

  // Offline-first sync endpoints (tenant-scoped)
  await app.register(syncPlugin);

  // ─── Startup health check ──────────────────
  app.addHook("onReady", async () => {
    const { validateConnection } = await import("./shared/database/connection.js");
    const dbOk = await validateConnection();
    if (!dbOk) {
      app.log.warn("Database connection failed at startup — running in degraded mode");
    } else {
      app.log.info("Database connection established successfully");
    }

    // Log memory usage to confirm < 50MB target
    const mem = process.memoryUsage();
    app.log.info(
      { rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB` },
      "Startup memory footprint",
    );
  });

  return app;
}

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(
      { port: env.PORT, env: env.NODE_ENV },
      "AutomotiveOS Cloud ERP started",
    );
  } catch (err) {
    app.log.error(err, "Failed to start server");
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down gracefully");
    await app.close();
    const { closeDb } = await import("./shared/database/connection.js");
    await closeDb();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
