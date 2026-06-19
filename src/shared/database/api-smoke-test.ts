/**
 * Production API Smoke Test — Validate all major endpoints.
 *
 * Usage:
 *   npx tsx src/shared/database/api-smoke-test.ts [--base-url URL]
 *
 * Tests:
 *   - Health endpoints
 *   - Auth/login
 *   - Workshop CRUD (clients, vehicles, ordenes)
 *   - DVI endpoints
 *   - Scheduling endpoints
 *   - Marketing endpoints
 *   - Fleet endpoints
 *   - Sync endpoint
 *
 * @module shared/database/api-smoke-test
 */

const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : process.env["API_BASE_URL"] || "http://localhost:3000";

const TENANT_SLUG = process.env["TEST_TENANT"] || "taller-el-chero";
const USER_EMAIL = process.env["TEST_EMAIL"] || "jaraju01@gmail.com";

interface TestResult {
  name: string;
  status: "pass" | "fail" | "skip";
  durationMs: number;
  error?: string;
}

const results: TestResult[] = [];

async function test(
  name: string,
  fn: () => Promise<void>,
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, status: "pass", durationMs: Date.now() - start });
    console.log(`  ✅ ${name}`);
  } catch (err: any) {
    results.push({
      name,
      status: "fail",
      durationMs: Date.now() - start,
      error: err.message,
    });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function skip(name: string, reason: string): void {
  results.push({ name, status: "skip", durationMs: 0, error: reason });
  console.log(`  ⏭️  ${name}: ${reason}`);
}

async function api(
  path: string,
  opts: RequestInit = {},
): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-Slug": TENANT_SLUG,
    "X-User-Email": USER_EMAIL,
    ...(opts.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Tests ───────────────────────────────────

async function runTests(): Promise<void> {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   AutomotiveOS — Production API Smoke Test              ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Base URL:  ${BASE_URL}`);
  console.log(`  Tenant:    ${TENANT_SLUG}`);
  console.log(`  User:      ${USER_EMAIL}`);
  console.log("");

  // ── Health ──
  console.log("📋 Health Endpoints");
  await test("GET /health", async () => {
    const data = await api("/health");
    if (data.status !== "ok" && data.status !== "degraded") {
      throw new Error(`Unexpected status: ${data.status}`);
    }
  });

  await test("GET /health/live", async () => {
    const data = await api("/health/live");
    if (data.alive !== true) throw new Error("Not alive");
  });

  // ── Auth ──
  console.log("\n🔐 Auth");
  await test("POST /api/auth/login", async () => {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        tenantSlug: TENANT_SLUG,
        email: USER_EMAIL,
      }),
    });
    if (!data.profile) throw new Error("No profile returned");
  });

  // ── Workshop ──
  console.log("\n🔧 Workshop");
  await test("GET /workshop/ordenes", async () => {
    const data = await api("/workshop/ordenes");
    if (!Array.isArray(data)) throw new Error("Not an array");
  });

  await test("GET /workshop/clientes", async () => {
    const data = await api("/workshop/clientes");
    if (!Array.isArray(data)) throw new Error("Not an array");
  });

  await test("GET /workshop/vehiculos", async () => {
    const data = await api("/workshop/vehiculos");
    if (!Array.isArray(data)) throw new Error("Not an array");
  });

  await test("GET /workshop/servicios", async () => {
    const data = await api("/workshop/servicios");
    if (!Array.isArray(data)) throw new Error("Not an array");
  });

  // ── DVI ──
  console.log("\n📸 DVI");
  skip("POST /dvi (create inspection)", "Requires valid ordenTrabajoId");
  skip("GET /dvi/:id/photos", "Requires valid inspectionId");

  // ── Scheduling ──
  console.log("\n📅 Scheduling");
  await test("GET /scheduling/appointments", async () => {
    const data = await api("/scheduling/appointments");
    if (!Array.isArray(data)) throw new Error("Not an array");
  });

  await test("GET /scheduling/stats", async () => {
    const data = await api("/scheduling/stats");
    if (typeof data !== "object") throw new Error("Not an object");
  });

  // ── Marketing ──
  console.log("\n📢 Marketing");
  await test("GET /marketing/campaigns", async () => {
    const data = await api("/marketing/campaigns");
    if (!Array.isArray(data)) throw new Error("Not an array");
  });

  // ── Fleet ──
  console.log("\n🚛 Fleet");
  await test("GET /fleet", async () => {
    const data = await api("/fleet");
    if (!Array.isArray(data)) throw new Error("Not an array");
  });

  // ── Inventory ──
  console.log("\n📦 Inventory");
  await test("GET /inventory/repuestos", async () => {
    const data = await api("/inventory/repuestos");
    if (!Array.isArray(data)) throw new Error("Not an array");
  });

  await test("GET /inventory/tecdoc/status", async () => {
    const data = await api("/inventory/tecdoc/status");
    if (typeof data.configured !== "boolean") throw new Error("No configured field");
  });

  // ── Sync ──
  console.log("\n🔄 Sync");
  await test("GET /sync/config", async () => {
    const data = await api("/sync/config");
    if (!data.supportedEntities) throw new Error("No supportedEntities");
  });

  // ── Config ──
  console.log("\n⚙️  Config");
  await test("GET /api/profiles", async () => {
    const data = await api("/api/profiles");
    if (!Array.isArray(data)) throw new Error("Not an array");
  });

  // ── Memory ──
  console.log("\n💾 Memory");
  await test("Memory < 50MB RSS", async () => {
    const mem = process.memoryUsage();
    const rssMb = mem.rss / 1024 / 1024;
    if (rssMb > 50) throw new Error(`RSS ${rssMb.toFixed(2)}MB exceeds 50MB`);
  });
}

// ─── Summary ─────────────────────────────────

async function main(): Promise<void> {
  await runTests();

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const total = results.length;
  const duration = results.reduce((sum, r) => sum + r.durationMs, 0);

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log(`║   Results: ${passed}/${total} passed, ${failed} failed, ${skipped} skipped`.padEnd(57) + "║");
  console.log(`║   Duration: ${duration}ms`.padEnd(57) + "║");

  if (failed > 0) {
    console.log("║                                                          ║");
    console.log("║   ❌ FAILED TESTS:                                       ║");
    for (const r of results.filter((r) => r.status === "fail")) {
      console.log(`║     · ${r.name}`.padEnd(57) + "║");
      if (r.error) console.log(`║       ${r.error.slice(0, 50)}`.padEnd(57) + "║");
    }
  }

  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
