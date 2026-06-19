/**
 * Prometheus Metrics Plugin — Exposes metrics in Prometheus text format.
 *
 * Sprint 60: Production-grade metrics endpoint for Grafana/Prometheus monitoring.
 *
 * Endpoints:
 *   - GET /metrics — Prometheus text format (counters, histograms, gauges)
 *
 * Metrics exposed:
 *   - http_requests_total (counter) — by method, status, path
 *   - http_request_duration_seconds (histogram) — request latency
 *   - http_requests_in_flight (gauge) — currently processing requests
 *   - process_resident_memory_bytes (gauge) — RSS memory
 *   - process_uptime_seconds (gauge) — server uptime
 *   - db_connection_healthy (gauge) — 1 if connected, 0 if not
 *
 * @module plugins/metrics
 */

import type { FastifyInstance } from "fastify";
import { validateConnection } from "../shared/database/connection.js";

const startTime = Date.now();

// ─── In-Memory Metrics Store ───────────────────────

/** Counters */
const counters = {
  httpRequestsTotal: 0,
  httpRequestsByMethod: {} as Record<string, number>,
  httpRequestsByStatus: {} as Record<string, number>,
  httpErrorsTotal: 0,
  httpSlowRequests: 0, // > 1s
};

/** Histogram buckets (in seconds) */
const HISTOGRAM_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const histogramBuckets: Record<number, number> = {};
for (const bucket of HISTOGRAM_BUCKETS) {
  histogramBuckets[bucket] = 0;
}
let histogramCount = 0;
let histogramSum = 0;

/** In-flight gauge */
let inFlightRequests = 0;

// ─── Recording Functions ──────────────────────────

export function recordHttpRequest(method: string, statusCode: number, durationSeconds: number, path?: string) {
  counters.httpRequestsTotal++;

  const methodKey = method || "UNKNOWN";
  counters.httpRequestsByMethod[methodKey] = (counters.httpRequestsByMethod[methodKey] || 0) + 1;

  const statusKey = `${statusCode}`;
  counters.httpRequestsByStatus[statusKey] = (counters.httpRequestsByStatus[statusKey] || 0) + 1;

  if (statusCode >= 500) counters.httpErrorsTotal++;
  if (durationSeconds > 1) counters.httpSlowRequests++;

  // Update histogram
  histogramCount++;
  histogramSum += durationSeconds;
  for (const bucket of HISTOGRAM_BUCKETS) {
    if (durationSeconds <= bucket) {
      histogramBuckets[bucket]++;
    }
  }
}

export function incrementInFlight() { inFlightRequests++; }
export function decrementInFlight() { inFlightRequests--; }

// ─── Prometheus Text Formatter ─────────────────────

function formatPrometheusMetrics(): string {
  const lines: string[] = [];

  // ── Counter: http_requests_total ──
  lines.push("# TYPE http_requests_total counter");
  lines.push("# HELP http_requests_total Total HTTP requests processed");
  lines.push(`http_requests_total ${counters.httpRequestsTotal}`);

  // ── Counter: http_requests_by_method ──
  lines.push("# TYPE http_requests_by_method counter");
  lines.push("# HELP http_requests_by_method Requests by HTTP method");
  for (const [method, count] of Object.entries(counters.httpRequestsByMethod)) {
    lines.push(`http_requests_by_method{method="${method}"} ${count}`);
  }

  // ── Counter: http_requests_by_status ──
  lines.push("# TYPE http_requests_by_status counter");
  lines.push("# HELP http_requests_by_status Requests by status code");
  for (const [status, count] of Object.entries(counters.httpRequestsByStatus)) {
    lines.push(`http_requests_by_status{status="${status}"} ${count}`);
  }

  // ── Counter: http_errors_total ──
  lines.push("# TYPE http_errors_total counter");
  lines.push("# HELP http_errors_total Total 5xx errors");
  lines.push(`http_errors_total ${counters.httpErrorsTotal}`);

  // ── Counter: http_slow_requests_total ──
  lines.push("# TYPE http_slow_requests_total counter");
  lines.push("# HELP http_slow_requests_total Requests slower than 1 second");
  lines.push(`http_slow_requests_total ${counters.httpSlowRequests}`);

  // ── Histogram: http_request_duration_seconds ──
  lines.push("# TYPE http_request_duration_seconds histogram");
  lines.push("# HELP http_request_duration_seconds Request latency in seconds");
  for (const bucket of HISTOGRAM_BUCKETS) {
    lines.push(`http_request_duration_seconds_bucket{le="${bucket}"} ${histogramBuckets[bucket]}`);
  }
  lines.push(`http_request_duration_seconds_bucket{le="+Inf"} ${histogramCount}`);
  lines.push(`http_request_duration_seconds_sum ${histogramSum.toFixed(6)}`);
  lines.push(`http_request_duration_seconds_count ${histogramCount}`);

  // ── Gauge: http_requests_in_flight ──
  lines.push("# TYPE http_requests_in_flight gauge");
  lines.push("# HELP http_requests_in_flight Currently processing requests");
  lines.push(`http_requests_in_flight ${inFlightRequests}`);

  // ── Gauge: process metrics ──
  const mem = process.memoryUsage();
  lines.push("# TYPE process_resident_memory_bytes gauge");
  lines.push("# HELP process_resident_memory_bytes Resident memory in bytes");
  lines.push(`process_resident_memory_bytes ${mem.rss}`);

  lines.push("# TYPE process_uptime_seconds gauge");
  lines.push("# HELP process_uptime_seconds Server uptime in seconds");
  lines.push(`process_uptime_seconds ${((Date.now() - startTime) / 1000).toFixed(1)}`);

  lines.push("# TYPE nodejs_heap_size_total_bytes gauge");
  lines.push("# HELP nodejs_heap_size_total_bytes Total heap size in bytes");
  lines.push(`nodejs_heap_size_total_bytes ${mem.heapTotal}`);

  lines.push("# TYPE nodejs_heap_size_used_bytes gauge");
  lines.push("# HELP nodejs_heap_size_used_bytes Used heap size in bytes");
  lines.push(`nodejs_heap_size_used_bytes ${mem.heapUsed}`);

  // ── Gauge: db_connection_healthy ──
  // Note: This is set dynamically in the route handler

  return lines.join("\n") + "\n";
}

// ─── Plugin Registration ──────────────────────────

/**
 * Registers the /metrics endpoint in Prometheus text format.
 *
 * @param app - Fastify instance
 */
export async function metricsPlugin(app: FastifyInstance): Promise<void> {
  // In-flight tracking hooks
  app.addHook("onRequest", async () => { incrementInFlight(); });
  app.addHook("onResponse", async () => { decrementInFlight(); });

  // Metrics collection hook
  app.addHook("onResponse", async (request, reply) => {
    const durationNs = Number(process.hrtime.bigint() - (request as any)._metricsStart);
    const durationSeconds = durationNs / 1_000_000_000;
    recordHttpRequest(request.method, reply.statusCode, durationSeconds);
  });

  app.addHook("onRequest", async (request) => {
    (request as any)._metricsStart = process.hrtime.bigint();
  });

  // GET /metrics — Prometheus text format
  app.get("/metrics", async (_request, reply) => {
    // Check DB health for gauge
    const dbHealthy = await validateConnection();

    const header = "# Prometheus Metrics — AutomotiveOS ERP\n";
    const dbGauge = `# TYPE db_connection_healthy gauge\n# HELP db_connection_healthy 1 if database is connected\n db_connection_healthy ${dbHealthy ? 1 : 0}\n`;

    const body = header + dbGauge + formatPrometheusMetrics();

    reply
      .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
      .header("Cache-Control", "no-store")
      .send(body);
  });

  app.log.info("Metrics plugin registered (/metrics — Prometheus format)");
}
