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
  // Use pino-pretty transport only if installed, fall back to plain JSON
  let transportOpt = undefined;
  if (env.NODE_ENV !== "production") {
    try {
      // Dynamic import to avoid crash if pino-pretty is missing
      await import("pino-pretty");
      transportOpt = { target: "pino-pretty", options: { colorize: true } };
    } catch {
      transportOpt = undefined;
    }
  }

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: transportOpt,
    },
  });

  // ─── Global error handler ──────────────────
  app.setErrorHandler(errorHandler);

  // ─── Request Logging & Tracing ─────────────
  const { requestIdHook, requestTimingHook, metricsHook } = await import("./shared/middleware/logger.js");
  app.addHook("onRequest", requestIdHook);
  app.addHook("onRequest", requestTimingHook);
  app.addHook("onResponse", metricsHook);

  // ─── CORS (Hardened) ─────────────────────────
  // Production: strict origin whitelist + method/header restrictions
  // Development: allows localhost for DX
  const corsOrigins = env.NODE_ENV === "production"
    ? [env.CORS_ORIGIN].filter(Boolean)
    : [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

  await app.register((await import("@fastify/cors")).default, {
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Tenant-Slug",
      "X-User-Email",
      "X-Request-ID",
      "Accept",
      "Origin",
      "Cache-Control",
    ],
    exposedHeaders: [
      "X-Request-ID",
      "Content-Disposition",
    ],
    maxAge: 86400, // Preflight cache: 24 hours
  });

  // ─── Security Headers (Helmet + Custom) ──────
  try {
    await app.register((await import("@fastify/helmet")).default, {
      // CSP is handled by our custom security-headers middleware
      // (more granular control with Tailwind CDN support)
      contentSecurityPolicy: false,
      // HSTS handled by custom middleware (conditional on env)
      hsts: false,
      // X-Frame-Options handled by custom middleware
      frameguard: false,
      // Cross-Origin policies handled by custom middleware
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    });
    app.log.info("Helmet security headers registered (baseline)");
  } catch {
    app.log.warn("Helmet not available — using custom security headers only");
  }

  // ─── Custom Security Headers (OWASP) ─────────
  const { securityHeadersHook } = await import("./shared/middleware/security-headers.js");
  app.addHook("onRequest", securityHeadersHook);
  app.log.info("Custom security headers registered (CSP, HSTS, Permissions-Policy)");

  // ─── RLS Tenant Context (PostgreSQL) ─────────
  // Sets app.current_tenant session variable for Row Level Security
  // Must run AFTER resolveTenant (needs request.tenantSlug)
  const { rlsTenantContext } = await import("./shared/middleware/rls.js");
  // Note: rlsTenantContext is added as a preHandler in plugins that need it
  // rather than globally, because not all requests have a tenant context
  // (login, health check are public routes)
  app.decorate("rlsTenantContext", rlsTenantContext);
  app.log.info("RLS tenant context middleware available (preHandler)");

  // ─── Rate Limiting ──────────────────────────
  try {
    await app.register((await import("@fastify/rate-limit")).default, {
      max: 200, // 200 requests per minute per IP
      timeWindow: "1 minute",
      errorResponseBuilder: (_req, context) => ({
        statusCode: 429,
        error: "Too Many Requests",
        message: `Límite de ${context.max} requests por minuto alcanzado. Intente más tarde.`,
      }),
    });
    app.log.info("Rate limiting registered (200 req/min)");
  } catch {
    app.log.warn("Rate limiter not available — rate limiting disabled");
  }

  // ─── Gzip Compression ───────────────────────
  try {
    await app.register((await import("@fastify/compress")).default, {
      global: true,
      encodings: ['gzip', 'deflate', 'br'],
    });
    app.log.info("Gzip/Brotli compression registered");
  } catch {
    app.log.warn("Compression not available — responses not compressed");
  }

  // ─── OpenAPI / Swagger ──────────────────────
  try {
    await app.register((await import("@fastify/swagger")).default, {
      openapi: {
        openapi: "3.0.0",
        info: {
          title: "AutomotiveOS Cloud ERP API",
          description: "API completa para gestión de talleres automotores en Paraguay. Incluye módulos de Taller, Inventario, Contabilidad, Tesorería, SIFEN y más.",
          version: "1.0.0",
          contact: { name: "Jara Brothers Group", email: "jaraju01@gmail.com" },
          license: { name: "Proprietary" },
        },
        servers: [
          { url: "http://localhost:3000", description: "Development" },
        ],
        components: {
          securitySchemes: {
            tenantHeader: {
              type: "apiKey",
              in: "header",
              name: "X-Tenant-Slug",
              description: "Tenant slug for multi-tenant isolation",
            },
            userHeader: {
              type: "apiKey",
              in: "header",
              name: "X-User-Email",
              description: "User email for RBAC resolution",
            },
          },
        },
        security: [{ tenantHeader: [], userHeader: [] }],
        tags: [
          { name: "Auth", description: "Autenticación y login" },
          { name: "Workshop", description: "Módulo de Taller (vehículos, OTs, ingresos)" },
          { name: "Inventory", description: "Inventario (repuestos, herramientas, stock)" },
          { name: "Finance", description: "Contabilidad, facturación, tesorería" },
          { name: "Search", description: "Búsqueda global" },
          { name: "Export", description: "Exportación CSV" },
          { name: "Config", description: "Configuración del taller" },
        ],
      },
    });
    await app.register((await import("@fastify/swagger-ui")).default, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
        defaultModelsExpandDepth: -1,
      },
    });
    app.log.info("Swagger UI available at /docs");
  } catch {
    app.log.warn("Swagger not available — API docs disabled");
  }

  // ─── Plugins ───────────────────────────────
  await app.register(healthCheckPlugin);

  // ─── Visual Orchestration Module ───────────────
  // WebSocket gateway for TV displays (waiting room & mechanic bay).
  // Real-time JSON streaming (< 1KB/event) — zero GPU/rendering on server.
  // Registered early so its public routes aren't affected by tenant hooks.
  await app.register(
    (await import("./modules/intelligence/visual/plugin.js")).default,
  );

  // ─── Tenant Configuration Module ──────────────
  // Company identity management: logo, RUC, address, operator signatures.
  // Settings persist in config/tenant_settings.json.
  // Logo upload via multipart with 5MB limit, Base64 injection for TV/PDF.
  await app.register(
    (await import("./modules/config/plugin.js")).default,
  );

  // Supabase auth / storage / realtime (lazy init)
  await app.register((await import("./plugins/supabase.js")).default);

  // Offline-first sync endpoints (tenant-scoped)
  await app.register(syncPlugin);

  // ─── File upload support (multipart) ────────
  // Required by: Intelligence OCR endpoints for image uploads
  try {
    await app.register((await import("@fastify/multipart")).default, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB max per file
        files: 1,                    // Max 1 file per request
      },
    });
  } catch (err) {
    app.log.warn({ err }, "@fastify/multipart not available — file uploads disabled");
  }

  // ─── Tenants Classification Module ──────────────
  // MIC classification, IRE regime, obligatory books management.
  // Tenant-isolated via X-Tenant-Slug header.
  await app.register(
    (await import("./modules/tenants/plugin.js")).default,
  );

  // ─── Workshop Core Module ───────────────────
  // Vehicle check-in (ingresos) + third-party work (trabajos de terceros)
  // Tenant-isolated via X-Tenant-Slug header
  await app.register(
    (await import("./modules/workshop/plugin.js")).default,
  );

  // ─── Inventory Module ──────────────────────────
  // Spare parts (repuestos) stock management with barcode/QR support,
  // tool master catalog (herramientas), and tool checkout control
  // (control_herramientas) linked to work orders and mechanics.
  await app.register(
    (await import("./modules/inventory/plugin.js")).default,
  );

  // ─── Intelligence & Peripherals Module ───────
  // DTC parsing (Launch/Thinkcar), OpenCode diagnostic engine,
  // HV safety protocols, computer vision (OCR) for plates & cédulas.
  // All heavy processing runs in async job queue (RAM-safe).
  await app.register(
    (await import("./modules/intelligence/plugin.js")).default,
  );

  // ─── Thinkcar Automated Importer Module ───────
  // Triple-channel ingestion (USB/MTP, Bluetooth RFCOMM, Email IMAP)
  // with SHA-256 deduplication, PDF parsing, and smart VIN→Vehicle→OT→Client linking.
  await app.register(
    (await import("./modules/thinkcar/plugin.js")).default,
  );

  // ─── Finance Module (SIFEN + Accounting) ──────
  // SIFEN V150 electronic invoicing with X.509 digital signature
  // (signed async via worker_threads to prevent RAM spikes — @qa-optimizer validated).
  // HTTPS/SOAP client for DNIT web services (CDC reception).
  // Double-entry accounting (Plan de Cuentas, Asientos Contables)
  // and RG 90 Marangatu export engine.
  await app.register(
    (await import("./modules/finance/plugin.js")).default,
  );

  // ─── Global Search Module ───────────────────
  // Cross-entity search (vehiculos, clientes, ordenes_trabajo)
  // tenant-isolated via X-Tenant-Slug header.
  await app.register(
    (await import("./shared/plugins/search.js")).default,
  );

  // ─── PDF Report Module ──────────────────────
  // Server-side PDF generation for OT + Invoice reports.
  // Requires Chromium (graceful degradation if not available).
  await app.register(
    (await import("./shared/routes/pdf-report.routes.js")).pdfReportRoutes,
  );

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
    const url = `http://${env.HOST}:${env.PORT}`;
    app.log.info(
      { port: env.PORT, env: env.NODE_ENV },
      `AutomotiveOS Cloud ERP iniciado — ${url}`,
    );
    app.log.info(`[HEALTH] ${url}/health`);
    app.log.info(`[SPA]    ${url}/dashboard`);
    app.log.info(`[TV]     ${url}/api/v1/visual/tv`);
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
