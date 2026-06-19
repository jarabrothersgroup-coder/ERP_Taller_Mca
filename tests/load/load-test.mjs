#!/usr/bin/env node
/**
 * Load Testing Script — AutomotiveOS ERP
 *
 * Sprint 60: Baseline performance testing with autocannon.
 *
 * Usage:
 *   node tests/load/load-test.mjs [options]
 *
 * Options:
 *   --url       Target URL (default: http://localhost:3000)
 *   --duration  Test duration in seconds (default: 30)
 *   --connections Number of concurrent connections (default: 10)
 *   --pipelining Requests per pipeline (default: 1)
 *
 * Examples:
 *   node tests/load/load-test.mjs                          # Default: 30s, 10 connections
 *   node tests/load/load-test.mjs --duration 60 -c 50      # 60s, 50 connections
 *   node tests/load/load-test.mjs --url http://prod:3000    # Production target
 *
 * @module tests/load/load-test
 */

import autocannon from "autocannon";

// ─── Configuration ─────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const config = {
  url: getArg("url", "http://localhost:3000"),
  duration: parseInt(getArg("duration", "30"), 10),
  connections: parseInt(getArg("connections", "10"), 10),
  pipelining: parseInt(getArg("pipelining", "1"), 10),
  title: "AutomotiveOS ERP Load Test",
};

// ─── Endpoints to Test ─────────────────────────────

const endpoints = [
  { name: "Health Check",     method: "GET",  path: "/health",          auth: false },
  { name: "Liveness Probe",   method: "GET",  path: "/health/live",     auth: false },
  { name: "Readiness Probe",  method: "GET",  path: "/health/ready",    auth: false },
  { name: "Deep Health",      method: "GET",  path: "/health/deep",     auth: false },
  { name: "Metrics",          method: "GET",  path: "/metrics",         auth: false },
  { name: "Dashboard API",    method: "GET",  path: "/api/v1/dashboard", auth: true },
  { name: "Repuestos List",   method: "GET",  path: "/api/v1/inventory/repuestos", auth: true },
];

// ─── Run Tests ─────────────────────────────────────

async function runLoadTest(endpoint) {
  const opts = {
    url: `${config.url}${endpoint.path}`,
    method: endpoint.method,
    connections: config.connections,
    duration: config.duration,
    pipelining: config.pipelining,
    title: `${endpoint.name} — ${config.title}`,
    headers: {
      "Content-Type": "application/json",
    },
  };

  // Add auth header if needed (test token)
  if (endpoint.auth) {
    opts.headers["Authorization"] = "Bearer test-load-token";
  }

  console.log(`\n🚀 Testing: ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
  console.log(`   ${config.connections} connections × ${config.duration}s\n`);

  return new Promise((resolve, reject) => {
    const instance = autocannon(opts, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });

    // Progress bar
    autocannon.track(instance, { renderProgressBar: true });
  });
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  AutomotiveOS ERP — Load Test Suite (Sprint 60)");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Target:    ${config.url}`);
  console.log(`  Duration:  ${config.duration}s per endpoint`);
  console.log(`  Workers:   ${config.connections} concurrent connections`);
  console.log(`  Pipeline:  ${config.pipelining} requests/pipeline`);
  console.log("═══════════════════════════════════════════════════════\n");

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const result = await runLoadTest(endpoint);
      results.push({ endpoint: endpoint.name, ...result });

      console.log(`\n📊 ${endpoint.name} Results:`);
      console.log(`   Latency (avg): ${result.latency.average}ms`);
      console.log(`   Latency (p99): ${result.latency.p99}ms`);
      console.log(`   Throughput:    ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
      console.log(`   Requests:      ${result.requests.average} req/s`);
      console.log(`   Errors:        ${result.errors}`);
      console.log(`   Timeouts:      ${result.timeouts}`);
      console.log(`   Total Req:     ${result.requests.total}`);
    } catch (err) {
      console.error(`   ❌ ${endpoint.name} failed:`, err.message);
      results.push({ endpoint: endpoint.name, error: err.message });
    }
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const r of results) {
    if (r.error) {
      console.log(`  ❌ ${r.endpoint}: FAILED — ${r.error}`);
    } else {
      const status = r.requests.average >= 100 ? "🟢" : r.requests.average >= 50 ? "🟡" : "🔴";
      console.log(`  ${status} ${r.endpoint}: ${r.requests.average} req/s | p99=${r.latency.p99}ms | err=${r.errors}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════");

  // Performance targets
  console.log("\n  🎯 Targets:");
  console.log("     Health checks:  ≥ 500 req/s");
  console.log("     Dashboard API:  ≥ 50 req/s (with auth)");
  console.log("     p99 latency:    < 500ms");
  console.log("     Error rate:     < 1%");
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Load test failed:", err);
  process.exit(1);
});
