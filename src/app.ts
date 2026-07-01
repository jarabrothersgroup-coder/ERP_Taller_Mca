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
  const { recordResponseTime } = await import("./plugins/monitoring.js");
  app.addHook("onRequest", requestIdHook);
  app.addHook("onRequest", requestTimingHook);
  app.addHook("onResponse", metricsHook);
  // Performance tracking hook — records per-endpoint response times
  app.addHook("onResponse", async (request, reply) => {
    const start = (request as any)._performanceStartTime as number | undefined;
    if (start) {
      const durationMs = (Date.now() - start);
      recordResponseTime(request.url, reply.statusCode, durationMs);
    }
  });
  // Capture start time for performance tracking
  app.addHook("onRequest", async (request) => {
    (request as any)._performanceStartTime = Date.now();
  });

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
  // BAJO-06 FIX: Re-enable Helmet with selective overrides
  try {
    await app.register((await import("@fastify/helmet")).default, {
      // CSP is handled by our custom security-headers middleware
      contentSecurityPolicy: false,
      // HSTS handled by custom middleware (conditional on env)
      hsts: false,
      // X-Frame-Options handled by custom middleware
      frameguard: false,
      // Cross-Origin policies handled by custom middleware
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      // Enable remaining Helmet protections
      hidePoweredBy: true,
      ieNoOpen: true,
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    });
    app.log.info("Helmet security headers registered (baseline)");
  } catch {
    app.log.warn("Helmet not available — using custom security headers only");
  }

  // ─── Custom Security Headers (OWASP) ─────────
  const { securityHeadersHook } = await import("./shared/middleware/security-headers.js");
  app.addHook("onRequest", securityHeadersHook);
  app.log.info("Custom security headers registered (CSP, HSTS, Permissions-Policy)");

  // ─── CSRF Protection (Double-Submit Cookie) ──
  // MED-03 FIX: Protect state-changing endpoints against CSRF
  const { registerCsrfProtection } = await import("./shared/middleware/csrf.js");
  await registerCsrfProtection(app);

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

  // ─── OpenAPI / Swagger (development only) ─────────
  if (env.NODE_ENV !== "production") {
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
  } // end NODE_ENV check (Swagger dev-only)

  // ─── Plugins ───────────────────────────────
  await app.register(healthCheckPlugin);

  // Sprint 60: Prometheus metrics endpoint (/metrics)
  await app.register(
    (await import("./plugins/metrics.js")).metricsPlugin,
  );

  // ─── Lead Capture (Public — no auth/tenant required) ──
  await app.register(
    (await import("./modules/marketing/routes/lead.routes.js")).leadRoutes,
  );

  // ─── Monitoring Plugin (Performance + Security Audit) ──
  // Registers: /health/metrics, /health/performance, /health/security-audit
  await app.register(
    (await import("./plugins/monitoring.js")).monitoringPlugin,
  );

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

  // Local filesystem storage (replaces Supabase Storage)
  await app.register((await import("./plugins/storage.js")).storagePlugin);

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

  // ─── WhatsApp Integration Module ──────────────
  // Evolution API gateway for WhatsApp messaging.
  // QR pairing, message templates per order state, PDF attachments.
  // Tenant-isolated via X-Tenant-Slug header.
  await app.register(
    (await import("./modules/whatsapp/plugin.js")).default,
  );

  // ─── Twenty CRM Integration Module ───────────
  // Reverse sync ERP → Twenty CRM for walk-in clients.
  // UPSERT contacts when orders reach FINALIZADO_RETIRADO.
  // Tenant-isolated via X-Tenant-Slug header.
  await app.register(
    (await import("./modules/crm/plugin.js")).crmPlugin,
  );

  // ─── Scheduling & Appointment Module ─────────
  // Intelligent appointment management: capacity control,
  // WhatsApp reminders, check-in → OT conversion.
  // Bridges Twenty CRM (commercial) and ERP (execution).
  await app.register(
    (await import("./modules/scheduling/plugin.js")).schedulingPlugin,
  );

  // ─── Tenant Migration Module ─────────────────
  // Export/Import of tenant-agnostic config (chart of accounts,
  // service catalog, pricing) between tenants.
  await app.register(
    (await import("./modules/migration/plugin.js")).migrationPlugin,
  );

  // ─── DVI (Digital Vehicle Inspection) Module ──
  // Photo capture, markup annotations, health score calculation.
  // WhatsApp sharing for client transparency.
  await app.register(
    (await import("./modules/dvi/plugin.js")).default,
  );

  // ─── Marketing Module ───────────────────────
  // Campaign management, Google Reviews, loyalty program.
  await app.register(
    (await import("./modules/marketing/plugin.js")).default,
  );

  // ─── Fleet Module (B2B) ─────────────────────
  // Corporate fleet management with service contracts.
  await app.register(
    (await import("./modules/fleet/plugin.js")).default,
  );

  // ─── Analytics Module ─────────────────────
  // KPIs, trends, comparisons, custom reports with CSV export.
  await app.register(
    (await import("./modules/analytics/plugin.js")).default,
  );

  // ─── Global Search Module ───────────────────
  // Cross-entity search (vehiculos, clientes, ordenes_trabajo)
  // tenant-isolated via X-Tenant-Slug header.
  await app.register(
    (await import("./shared/plugins/search.js")).default,
  );

  // ─── CSV Import Module ─────────────────────
  // CSV data import for vehiculos, clientes, repuestos
  await app.register(
    (await import("./shared/routes/import.routes.js")).importRoutes,
  );

  // ─── Filter Presets Module ──────────────────
  // Advanced multi-field filtering with saved presets
  await app.register(
    (await import("./shared/routes/filter-presets.routes.js")).filterPresetRoutes,
  );

  // ─── Locale (i18n) Routes ──────────────────
  // Serves ES/GU translation JSON files for the SPA.
  await app.register(
    (await import("./modules/intelligence/routes/locale.routes.js")).default,
  );

  // ─── PDF Report Module ──────────────────────
  // Server-side PDF generation for OT + Invoice reports.
  // Requires Chromium (graceful degradation if not available).
  await app.register(
    (await import("./shared/routes/pdf-report.routes.js")).pdfReportRoutes,
  );

  // ─── Label Printing Module ──────────────────
  // Industrial thermal/label printer support (ESC/POS, ZPL, TSPL).
  // Barcode & QR generation for repuestos and herramientas.
  await app.register(
    (await import("./modules/label-printing/plugin.js")).default,
  );

  // ─── Backup & Restore Module ────────────────
  // Automated pg_dump, compression, AES-256 encryption.
  // Cron-based scheduling, restore wizard with 2FA.
  await app.register(
    (await import("./modules/backup/plugin.js")).default,
  );

  // ─── Client Portal Module ───────────────────
  // Public view for client's vehicles, invoices, and work orders.
  // Auth: magic link + PIN, self-service appointments.
  await app.register(
    (await import("./modules/client-portal/plugin.js")).default,
  );

  // ─── Hardware Security Module (USB Kill Switch) ──
  // USB dongle validation, hardware fingerprinting, kill switch middleware.
  // CRITICAL: Must be registered early to protect all routes.
  await app.register(
    (await import("./modules/security-hw/plugin.js")).default,
  );

  // ─── Audit Log Export Module ────────────────
  // CSV export for audit log entries with date/entity/action filters.
  await app.register(
    (await import("./shared/routes/audit-export.routes.js")).auditExportRoutes,
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

  // Sprint 60: Improved graceful shutdown with drain period
  let isShuttingDown = false;
  const SHUTDOWN_TIMEOUT_MS = 10_000; // 10s max drain period

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return; // Prevent double-shutdown
    isShuttingDown = true;

    app.log.info({ signal }, "Shutting down gracefully — draining in-flight requests");

    // Stop accepting new connections
    await app.close();

    // Wait up to SHUTDOWN_TIMEOUT_MS for in-flight requests to complete
    const forceExitTimer = setTimeout(() => {
      app.log.warn("Shutdown timeout reached — forcing exit with in-flight requests");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExitTimer.unref(); // Don't keep process alive for this timer

    // Close database connections
    try {
      const { closeDb } = await import("./shared/database/connection.js");
      await closeDb();
      app.log.info("Database connections closed");
    } catch (err) {
      app.log.error(err, "Error closing database connections");
    }

    clearTimeout(forceExitTimer);
    app.log.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Prevent unhandled rejections from crashing in production
  process.on("unhandledRejection", (reason) => {
    app.log.error({ reason }, "Unhandled promise rejection");
  });
}

start();
