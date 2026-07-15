/**
 * Load Testing Script — Automated API load testing for ERP backend.
 *
 * Tests throughput, latency percentiles, error rates, and memory usage
 * under concurrent load. Designed for Paraguayan workshop production loads.
 *
 * Usage: npx tsx scripts/load-test.ts [--base-url URL] [--concurrency N] [--duration S]
 *
 * @module scripts/load-test
 */

import http from "node:http";

/* ── Configuration ───────────────────────────────────── */

interface LoadTestConfig {
  baseUrl: string;
  concurrency: number;
  durationSeconds: number;
  rampUpSeconds: number;
  endpoints: EndpointConfig[];
}

interface EndpointConfig {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: Record<string, any>;
  headers?: Record<string, string>;
  weight: number; // relative probability of being selected
}

const DEFAULT_CONFIG: LoadTestConfig = {
  baseUrl: "http://localhost:3000",
  concurrency: 10,
  durationSeconds: 30,
  rampUpSeconds: 5,
  endpoints: [
    // Health (lightweight)
    { method: "GET", path: "/health", weight: 3 },
    { method: "GET", path: "/health/live", weight: 2 },
    { method: "GET", path: "/health/modules", weight: 1 },

    // Workshop (core)
    { method: "GET", path: "/workshop/clientes", weight: 5 },
    { method: "GET", path: "/workshop/vehiculos", weight: 5 },
    { method: "GET", path: "/workshop/ordenes", weight: 4 },
    { method: "GET", path: "/workshop/ingresos", weight: 2 },

    // Inventory
    { method: "GET", path: "/inventory/repuestos", weight: 3 },
    { method: "GET", path: "/inventory/herramientas", weight: 2 },

    // Finance
    { method: "GET", path: "/finance/invoices", weight: 3 },
    { method: "GET", path: "/finance/contabilidad/cuentas", weight: 2 },
    { method: "GET", path: "/finance/treasury/cuentas", weight: 2 },

    // Notifications
    { method: "GET", path: "/api/notifications?limit=10", weight: 2 },
    { method: "GET", path: "/api/notifications/count", weight: 2 },

    // Search
    { method: "GET", path: "/api/v1/search?q=toyota", weight: 2 },

    // Analytics
    { method: "GET", path: "/analytics/kpis", weight: 1 },
  ],
};

/* ── Types ───────────────────────────────────────────── */

interface RequestResult {
  statusCode: number;
  latencyMs: number;
  error?: string;
  timestamp: number;
}

interface LoadTestResults {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  requestsPerSecond: number;
  latency: {
    min: number;
    max: number;
    mean: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  statusCodes: Record<number, number>;
  errors: Record<string, number>;
  durationMs: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  endpoints: Record<string, {
    count: number;
    avgLatency: number;
    errorCount: number;
  }>;
}

/* ── Helpers ─────────────────────────────────────────── */

function parseArgs(): Partial<LoadTestConfig> {
  const args = process.argv.slice(2);
  const config: Partial<LoadTestConfig> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--base-url":
        config.baseUrl = args[++i];
        break;
      case "--concurrency":
        config.concurrency = parseInt(args[++i], 10);
        break;
      case "--duration":
        config.durationSeconds = parseInt(args[++i], 10);
        break;
      case "--ramp-up":
        config.rampUpSeconds = parseInt(args[++i], 10);
        break;
    }
  }

  return config;
}

function weightedRandom(endpoints: EndpointConfig[]): EndpointConfig {
  const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;

  for (const endpoint of endpoints) {
    random -= endpoint.weight;
    if (random <= 0) return endpoint;
  }

  return endpoints[endpoints.length - 1];
}

function makeRequest(
  baseUrl: string,
  endpoint: EndpointConfig,
  tenantSlug: string = "demo",
): Promise<RequestResult> {
  return new Promise((resolve) => {
    const url = new URL(endpoint.path, baseUrl);
    const startTime = performance.now();
    const timestamp = Date.now();

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: endpoint.method,
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Slug": tenantSlug,
        ...endpoint.headers,
      },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        const latencyMs = performance.now() - startTime;
        resolve({
          statusCode: res.statusCode ?? 0,
          latencyMs,
          timestamp,
        });
      });
    });

    req.on("error", (err) => {
      const latencyMs = performance.now() - startTime;
      resolve({
        statusCode: 0,
        latencyMs,
        error: err.message,
        timestamp,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      const latencyMs = performance.now() - startTime;
      resolve({
        statusCode: 0,
        latencyMs,
        error: "TIMEOUT",
        timestamp,
      });
    });

    if (endpoint.body) {
      req.write(JSON.stringify(endpoint.body));
    }

    req.end();
  });
}

function calculatePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/* ── Load Test Runner ────────────────────────────────── */

async function runLoadTest(config: LoadTestConfig): Promise<LoadTestResults> {
  console.log(`\n🚀 ERP Load Test`);
  console.log(`   Base URL:    ${config.baseUrl}`);
  console.log(`   Concurrency: ${config.concurrency}`);
  console.log(`   Duration:    ${config.durationSeconds}s`);
  console.log(`   Ramp-up:     ${config.rampUpSeconds}s`);
  console.log(`   Endpoints:   ${config.endpoints.length}`);
  console.log(`\n`);

  const results: RequestResult[] = [];
  const endpointStats: Record<string, { count: number; totalLatency: number; errorCount: number }> = {};
  const startTime = Date.now();
  const endTime = startTime + config.durationSeconds * 1000;
  const rampUpEnd = startTime + config.rampUpSeconds * 1000;

  let activeWorkers = 0;
  let totalCreated = 0;

  // Worker function
  async function worker(id: number) {
    activeWorkers++;
    while (Date.now() < endTime) {
      const endpoint = weightedRandom(config.endpoints);
      const result = await makeRequest(config.baseUrl, endpoint);
      results.push(result);

      // Track endpoint stats
      const key = `${endpoint.method} ${endpoint.path}`;
      if (!endpointStats[key]) {
        endpointStats[key] = { count: 0, totalLatency: 0, errorCount: 0 };
      }
      endpointStats[key].count++;
      endpointStats[key].totalLatency += result.latencyMs;
      if (result.error || result.statusCode >= 400) {
        endpointStats[key].errorCount++;
      }

      // Small delay to prevent overwhelming
      await new Promise((r) => setTimeout(r, 10));
    }
    activeWorkers--;
  }

  // Ramp up workers gradually
  const workerPromises: Promise<void>[] = [];
  for (let i = 0; i < config.concurrency; i++) {
    const delay = (i / config.concurrency) * config.rampUpSeconds * 1000;
    totalCreated++;

    const promise = new Promise<void>((resolve) => {
      setTimeout(() => {
        worker(i).then(resolve);
      }, delay);
    });
    workerPromises.push(promise);

    // Progress indicator
    if (totalCreated % 5 === 0 || totalCreated === config.concurrency) {
      console.log(`   ⏳ Launched ${totalCreated}/${config.concurrency} workers...`);
    }
  }

  // Wait for all workers to complete
  await Promise.all(workerPromises);

  const durationMs = Date.now() - startTime;
  const memUsage = process.memoryUsage();

  // Calculate stats
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const statusCodes: Record<number, number> = {};
  const errors: Record<string, number> = {};

  let successful = 0;
  let failed = 0;

  for (const r of results) {
    statusCodes[r.statusCode] = (statusCodes[r.statusCode] || 0) + 1;
    if (r.error) {
      errors[r.error] = (errors[r.error] || 0) + 1;
      failed++;
    } else if (r.statusCode >= 400) {
      errors[`HTTP_${r.statusCode}`] = (errors[`HTTP_${r.statusCode}`] || 0) + 1;
      failed++;
    } else {
      successful++;
    }
  }

  const endpointResults: Record<string, { count: number; avgLatency: number; errorCount: number }> = {};
  for (const [key, stats] of Object.entries(endpointStats)) {
    endpointResults[key] = {
      count: stats.count,
      avgLatency: stats.count > 0 ? stats.totalLatency / stats.count : 0,
      errorCount: stats.errorCount,
    };
  }

  return {
    totalRequests: results.length,
    successfulRequests: successful,
    failedRequests: failed,
    errorRate: results.length > 0 ? (failed / results.length) * 100 : 0,
    requestsPerSecond: durationMs > 0 ? (results.length / durationMs) * 1000 : 0,
    latency: {
      min: latencies[0] || 0,
      max: latencies[latencies.length - 1] || 0,
      mean: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p50: calculatePercentile(latencies, 50),
      p75: calculatePercentile(latencies, 75),
      p90: calculatePercentile(latencies, 90),
      p95: calculatePercentile(latencies, 95),
      p99: calculatePercentile(latencies, 99),
    },
    statusCodes,
    errors,
    durationMs,
    memoryUsage: {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
    },
    endpoints: endpointResults,
  };
}

function printResults(results: LoadTestResults): void {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`📊 LOAD TEST RESULTS`);
  console.log(`${"═".repeat(60)}\n`);

  console.log(`Duration:           ${(results.durationMs / 1000).toFixed(1)}s`);
  console.log(`Total Requests:     ${results.totalRequests}`);
  console.log(`Successful:         ${results.successfulRequests}`);
  console.log(`Failed:             ${results.failedRequests}`);
  console.log(`Error Rate:         ${results.errorRate.toFixed(2)}%`);
  console.log(`Requests/sec:       ${results.requestsPerSecond.toFixed(1)}`);

  console.log(`\n── Latency ──`);
  console.log(`  Min:    ${results.latency.min.toFixed(1)}ms`);
  console.log(`  Mean:   ${results.latency.mean.toFixed(1)}ms`);
  console.log(`  P50:    ${results.latency.p50.toFixed(1)}ms`);
  console.log(`  P75:    ${results.latency.p75.toFixed(1)}ms`);
  console.log(`  P90:    ${results.latency.p90.toFixed(1)}ms`);
  console.log(`  P95:    ${results.latency.p95.toFixed(1)}ms`);
  console.log(`  P99:    ${results.latency.p99.toFixed(1)}ms`);
  console.log(`  Max:    ${results.latency.max.toFixed(1)}ms`);

  console.log(`\n── Memory ──`);
  console.log(`  RSS:        ${(results.memoryUsage.rss / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Heap Used:  ${(results.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Heap Total: ${(results.memoryUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`);

  console.log(`\n── Status Codes ──`);
  for (const [code, count] of Object.entries(results.statusCodes).sort()) {
    const pct = ((count / results.totalRequests) * 100).toFixed(1);
    const icon = code.startsWith("2") ? "✅" : code.startsWith("3") ? "↩️" : "❌";
    console.log(`  ${icon} ${code}: ${count} (${pct}%)`);
  }

  if (Object.keys(results.errors).length > 0) {
    console.log(`\n── Errors ──`);
    for (const [error, count] of Object.entries(results.errors).sort((a, b) => b[1] - a[1])) {
      console.log(`  ❌ ${error}: ${count}`);
    }
  }

  console.log(`\n── Top Endpoints by Latency ──`);
  const sortedEndpoints = Object.entries(results.endpoints)
    .sort((a, b) => b[1].avgLatency - a[1].avgLatency)
    .slice(0, 10);

  for (const [endpoint, stats] of sortedEndpoints) {
    const errorInfo = stats.errorCount > 0 ? ` (${stats.errorCount} errors)` : "";
    console.log(`  ${stats.avgLatency.toFixed(0).padStart(6)}ms avg | ${String(stats.count).padStart(4)} req | ${endpoint}${errorInfo}`);
  }

  console.log(`\n${"═".repeat(60)}`);

  // Performance grade
  const grade = results.errorRate < 1 && results.latency.p95 < 500
    ? "🟢 A — Production Ready"
    : results.errorRate < 5 && results.latency.p95 < 1000
      ? "🟡 B — Acceptable with optimization"
      : results.errorRate < 10 && results.latency.p95 < 2000
        ? "🟠 C — Needs optimization before production"
        : "🔴 D — Not production ready";

  console.log(`Performance Grade: ${grade}`);
  console.log(`${"═".repeat(60)}\n`);
}

/* ── Main ────────────────────────────────────────────── */

async function main(): Promise<void> {
  const args = parseArgs();
  const config: LoadTestConfig = { ...DEFAULT_CONFIG, ...args };

  try {
    const results = await runLoadTest(config);
    printResults(results);

    // Exit with error code if error rate > 10%
    if (results.errorRate > 10) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Load test failed:", err);
    process.exit(1);
  }
}

main();
