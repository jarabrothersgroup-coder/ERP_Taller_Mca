/**
 * Request Logger — Structured request/response logging with tracing.
 *
 * Logs every request with timing, status, tenant, and user context.
 * Provides request tracing via X-Request-ID header.
 *
 * @module shared/middleware/logger
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";
import { maskEmail, maskIp } from "../services/auth-jwt.js";

// ─── Request ID Generation ─────────────────────

/**
 * Add X-Request-ID to every request for distributed tracing.
 * If client provides one, use it; otherwise generate a new one.
 */
export async function requestIdHook(request: FastifyRequest, reply: FastifyReply) {
  const requestId = (request.headers["x-request-id"] as string) || randomUUID();
  request.id = requestId;
  reply.header("X-Request-ID", requestId);
}

// ─── Request Timing ────────────────────────────

/**
 * Log request duration with structured data.
 * Captures: method, URL, status, duration, tenant, user, content-length.
 */
export async function requestTimingHook(request: FastifyRequest, reply: FastifyReply) {
  const startTime = process.hrtime.bigint();

  reply.raw.on("finish", () => {
    const durationNs = Number(process.hrtime.bigint() - startTime);
    const durationMs = (durationNs / 1_000_000).toFixed(1);
    const tenantSlug = (request as any).tenantSlug || "—";
    const userEmail = (request.headers["x-user-email"] as string) || "—";
    const contentLength = reply.getHeader("content-length") || 0;
    const level = reply.statusCode >= 500 ? "error" : reply.statusCode >= 400 ? "warn" : "info";

    const logData = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: parseFloat(durationMs),
      tenantSlug,
      // BAJO-05 FIX: Mask sensitive data in logs
      userEmail: userEmail !== "—" ? maskEmail(userEmail) : userEmail,
      contentLength,
      userAgent: request.headers["user-agent"]?.slice(0, 80),
      ip: request.ip ? maskIp(request.ip) : undefined,
    };

    // Use pino if available, otherwise console
    if (request.log && typeof request.log[level] === "function") {
      request.log[level](logData, `${request.method} ${request.url} ${reply.statusCode} ${durationMs}ms`);
    } else {
      const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️" : "📝";
      console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
        `${prefix} [${request.id?.slice(0, 8)}] ${request.method} ${request.url} → ${reply.statusCode} (${durationMs}ms) tenant=${tenantSlug} user=${userEmail}`
      );
    }
  });
}

// ─── Slow Request Alert ────────────────────────

/**
 * Alert on requests taking > 5 seconds.
 * Useful for identifying N+1 queries and slow endpoints.
 */
export function slowRequestCheck(request: FastifyRequest, thresholdMs: number = 5000) {
  const startTime = Date.now();

  return {
    check: () => {
      const duration = Date.now() - startTime;
      if (duration > thresholdMs) {
        const msg = `SLOW REQUEST: ${request.method} ${request.url} took ${duration}ms`;
        if (request.log) {
          request.log.warn({ duration, url: request.url }, msg);
        } else {
          console.warn(`🐢 ${msg}`);
        }
      }
    },
  };
}

// ─── Health Metrics Collector ──────────────────

const metrics = {
  requestsTotal: 0,
  requestsByStatus: {} as Record<string, number>,
  requestsByTenant: {} as Record<string, number>,
  errorsTotal: 0,
  slowRequests: 0,
  startTime: Date.now(),
};

/**
 * Collect metrics for the /health/metrics endpoint.
 */
export function getMetrics() {
  return {
    ...metrics,
    uptimeSeconds: Math.floor((Date.now() - metrics.startTime) / 1000),
    memoryUsage: {
      rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
    },
  };
}

/**
 * Increment metric counters.
 */
export function recordRequest(statusCode: number, tenantSlug?: string) {
  metrics.requestsTotal++;
  const statusKey = `${Math.floor(statusCode / 100)}xx`;
  metrics.requestsByStatus[statusKey] = (metrics.requestsByStatus[statusKey] || 0) + 1;

  if (tenantSlug) {
    metrics.requestsByTenant[tenantSlug] = (metrics.requestsByTenant[tenantSlug] || 0) + 1;
  }

  if (statusCode >= 500) {
    metrics.errorsTotal++;
  }
}

/**
 * Metrics collection hook — runs on every response.
 */
export async function metricsHook(request: FastifyRequest, reply: FastifyReply) {
  reply.raw.on("finish", () => {
    const tenantSlug = (request as any).tenantSlug;
    recordRequest(reply.statusCode, tenantSlug);
  });
}
