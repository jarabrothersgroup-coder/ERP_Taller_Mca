/**
 * Monitoring Plugin — Performance metrics + Security audit endpoints.
 *
 * Provides:
 *   - GET /health/metrics — Performance dashboard data (requests, timing, memory)
 *   - GET /health/security-audit — Validates security headers are correctly set
 *   - GET /health/performance — Request timing percentiles + slow endpoint report
 *
 * RAM: < 5KB (in-memory counters only, no external deps).
 *
 * @module plugins/monitoring
 */

import type { FastifyInstance } from "fastify";
import { getMetrics } from "../shared/middleware/logger.js";
import { validateConnection } from "../shared/database/connection.js";

// ─── Performance Tracking (in-memory) ────────────

const performanceData = {
  endpointTimings: new Map<string, { count: number; totalMs: number; maxMs: number; p95Ms: number; recentMs: number[] }>(),
  recentResponseTimes: [] as number[],
  MAX_RECENT: 1000,
};

/**
 * Record a request's response time for performance tracking.
 */
export function recordResponseTime(url: string, _statusCode: number, durationMs: number): void {
  const normalizedUrl = url.split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id");

  const existing = performanceData.endpointTimings.get(normalizedUrl);
  if (existing) {
    existing.count++;
    existing.totalMs += durationMs;
    existing.maxMs = Math.max(existing.maxMs, durationMs);
    existing.recentMs.push(durationMs);
    if (existing.recentMs.length > 100) existing.recentMs.shift();
    const sorted = [...existing.recentMs].sort((a, b) => a - b);
    existing.p95Ms = sorted[Math.floor(sorted.length * 0.95)] || 0;
  } else {
    performanceData.endpointTimings.set(normalizedUrl, {
      count: 1,
      totalMs: durationMs,
      maxMs: durationMs,
      p95Ms: durationMs,
      recentMs: [durationMs],
    });
  }

  performanceData.recentResponseTimes.push(durationMs);
  if (performanceData.recentResponseTimes.length > performanceData.MAX_RECENT) {
    performanceData.recentResponseTimes.shift();
  }
}

/**
 * Get performance statistics for all tracked endpoints.
 */
export function getPerformanceStats() {
  const endpoints = Array.from(performanceData.endpointTimings.entries())
    .map(([url, data]) => ({
      url,
      count: data.count,
      avgMs: Math.round(data.totalMs / data.count * 10) / 10,
      maxMs: Math.round(data.maxMs * 10) / 10,
      p95Ms: Math.round(data.p95Ms * 10) / 10,
    }))
    .sort((a, b) => b.avgMs - a.avgMs);

  const allTimes = performanceData.recentResponseTimes;
  const sorted = [...allTimes].sort((a, b) => a - b);
  const len = sorted.length;

  return {
    totalRequestsTracked: allTimes.length,
    percentiles: {
      p50: len > 0 ? Math.round(sorted[Math.floor(len * 0.5)] * 10) / 10 : 0,
      p75: len > 0 ? Math.round(sorted[Math.floor(len * 0.75)] * 10) / 10 : 0,
      p90: len > 0 ? Math.round(sorted[Math.floor(len * 0.9)] * 10) / 10 : 0,
      p95: len > 0 ? Math.round(sorted[Math.floor(len * 0.95)] * 10) / 10 : 0,
      p99: len > 0 ? Math.round(sorted[Math.floor(len * 0.99)] * 10) / 10 : 0,
      max: len > 0 ? Math.round(sorted[len - 1] * 10) / 10 : 0,
    },
    slowestEndpoints: endpoints.slice(0, 10),
    fastestEndpoints: endpoints.slice(-5).reverse(),
  };
}

// ─── Security Audit ──────────────────────────────

interface HeaderCheck {
  header: string;
  description: string;
  required: boolean;
  validate: (value: string | string[] | undefined) => { pass: boolean; actual: string; expected: string };
}

const SECURITY_HEADER_CHECKS: HeaderCheck[] = [
  {
    header: "content-security-policy",
    description: "Content Security Policy — prevents XSS",
    required: true,
    validate: (v) => {
      const val = Array.isArray(v) ? v[0] : v;
      return { pass: !!val && val.includes("default-src"), actual: val || "(missing)", expected: "CSP with default-src directive" };
    },
  },
  {
    header: "strict-transport-security",
    description: "HSTS — forces HTTPS (production only)",
    required: false,
    validate: (v) => {
      const val = Array.isArray(v) ? v[0] : v;
      return { pass: !!val && val.includes("max-age="), actual: val || "(missing)", expected: "max-age >= 31536000" };
    },
  },
  {
    header: "x-content-type-options",
    description: "Prevents MIME-type sniffing",
    required: true,
    validate: (v) => {
      const val = Array.isArray(v) ? v[0] : v;
      return { pass: val === "nosniff", actual: val || "(missing)", expected: "nosniff" };
    },
  },
  {
    header: "x-frame-options",
    description: "Prevents clickjacking",
    required: true,
    validate: (v) => {
      const val = Array.isArray(v) ? v[0] : v;
      return { pass: val === "DENY" || val === "SAMEORIGIN", actual: val || "(missing)", expected: "DENY or SAMEORIGIN" };
    },
  },
  {
    header: "referrer-policy",
    description: "Controls referrer information",
    required: true,
    validate: (v) => {
      const val = Array.isArray(v) ? v[0] : v;
      return { pass: !!val, actual: val || "(missing)", expected: "strict-origin-when-cross-origin" };
    },
  },
  {
    header: "permissions-policy",
    description: "Restricts browser features",
    required: true,
    validate: (v) => {
      const val = Array.isArray(v) ? v[0] : v;
      return { pass: !!val && val.includes("camera=()"), actual: val || "(missing)", expected: "camera=() present" };
    },
  },
  {
    header: "cross-origin-opener-policy",
    description: "Isolates browsing context",
    required: true,
    validate: (v) => {
      const val = Array.isArray(v) ? v[0] : v;
      return { pass: !!val, actual: val || "(missing)", expected: "same-origin" };
    },
  },
  {
    header: "cross-origin-resource-policy",
    description: "Prevents cross-origin reads",
    required: true,
    validate: (v) => {
      const val = Array.isArray(v) ? v[0] : v;
      return { pass: !!val, actual: val || "(missing)", expected: "same-origin" };
    },
  },
  {
    header: "x-xss-protection",
    description: "Legacy XSS auditor (older browsers)",
    required: false,
    validate: (v) => {
      const val = Array.isArray(v) ? v[0] : v;
      return { pass: !!val, actual: val || "(missing)", expected: "1; mode=block" };
    },
  },
];

/**
 * Run security audit against a test response.
 */
async function runSecurityAudit(app: FastifyInstance) {
  const response = await app.inject({ method: "GET", url: "/health" });

  const results = SECURITY_HEADER_CHECKS.map((check) => {
    const value = response.headers[check.header] as string | string[] | undefined;
    const { pass, actual, expected } = check.validate(value);
    return { header: check.header, description: check.description, required: check.required, passed: pass, actual, expected };
  });

  const requiredPassed = results.filter((r) => r.required && r.passed).length;
  const requiredTotal = results.filter((r) => r.required).length;
  const optionalPassed = results.filter((r) => !r.required && r.passed).length;
  const score = requiredPassed * 10 + optionalPassed * 5;
  const maxScore = requiredTotal * 10 + (results.length - requiredTotal) * 5;
  const pct = score / maxScore;
  const grade = pct >= 0.9 ? "A" : pct >= 0.8 ? "B" : pct >= 0.7 ? "C" : pct >= 0.5 ? "D" : "F";

  const recommendations: string[] = [];
  for (const r of results) {
    if (!r.passed) {
      if (r.header === "strict-transport-security") {
        recommendations.push("Enable HSTS in production by setting NODE_ENV=production");
      } else if (r.header === "content-security-policy") {
        recommendations.push("Review CSP directives in security-headers.ts");
      } else if (r.header === "x-xss-protection") {
        recommendations.push("Add X-XSS-Protection: 1; mode=block for legacy browser support");
      } else {
        recommendations.push(`Add missing header: ${r.header} (${r.expected})`);
      }
    }
  }

  return { score, maxScore, grade, headers: results, recommendations };
}

// ─── Plugin Registration ─────────────────────────

export async function monitoringPlugin(app: FastifyInstance): Promise<void> {
  // ── GET /health/metrics ────────────────────────────────────
  app.get("/health/metrics", async (_request, reply) => {
    const loggerMetrics = getMetrics();
    const dbHealthy = await validateConnection();

    return reply.send({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: loggerMetrics.uptimeSeconds,
      requests: {
        total: loggerMetrics.requestsTotal,
        byStatus: loggerMetrics.requestsByStatus,
        byTenant: loggerMetrics.requestsByTenant,
        errors: loggerMetrics.errorsTotal,
        slowRequests: loggerMetrics.slowRequests,
      },
      memory: loggerMetrics.memoryUsage,
      database: dbHealthy ? "connected" : "disconnected",
      nodeVersion: process.version,
      platform: process.platform,
    });
  });

  // ── GET /health/performance ────────────────────────────────
  app.get("/health/performance", async (_request, reply) => {
    const perfStats = getPerformanceStats();
    const loggerMetrics = getMetrics();

    return reply.send({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: loggerMetrics.uptimeSeconds,
      memory: loggerMetrics.memoryUsage,
      performance: perfStats,
    });
  });

  // ── GET /health/security-audit ─────────────────────────────
  app.get("/health/security-audit", async (_request, reply) => {
    const audit = await runSecurityAudit(app);

    return reply.send({
      status: audit.grade === "F" ? "critical" : audit.grade === "D" ? "warning" : "ok",
      timestamp: new Date().toISOString(),
      ...audit,
    });
  });

  app.log.info("Monitoring plugin registered (/health/metrics, /health/performance, /health/security-audit)");
}
