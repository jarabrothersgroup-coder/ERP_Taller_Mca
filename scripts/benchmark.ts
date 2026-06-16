/**
 * Performance Benchmarks — Automated performance measurement.
 *
 * Measures: Schema validation throughput, CSV parsing, JSON serialization,
 * string operations, memory usage.
 *
 * Run: npx tsx scripts/benchmark.ts
 *
 * @module scripts/benchmark
 */

import { performance } from "perf_hooks";

// ─── Zod Schemas (inline copies for benchmark isolation) ──

import { z } from "zod";

const clientSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  ruc: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
});

const vehicleSchema = z.object({
  clientId: z.string().uuid(),
  brand: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  vin: z.string().min(17).max(17).optional(),
});

// ─── Benchmark Helpers ──

interface BenchmarkResult {
  name: string;
  opsPerSecond: number;
  avgMs: number;
  p95Ms: number;
  p99Ms: number;
  iterations: number;
}

function bench(name: string, fn: () => void, iterations = 10000): BenchmarkResult {
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < Math.min(100, iterations); i++) fn();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const total = times.reduce((a, b) => a + b, 0);
  const avg = total / times.length;
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  const opsPerSec = 1000 / avg;

  return { name, opsPerSecond: opsPerSec, avgMs: avg, p95Ms: p95, p99Ms: p99, iterations };
}

function formatOps(ops: number): string {
  if (ops > 1_000_000) return `${(ops / 1_000_000).toFixed(1)}M`;
  if (ops > 1_000) return `${(ops / 1_000).toFixed(1)}K`;
  return ops.toFixed(0);
}

function memorySnapshot(label: string) {
  const mem = process.memoryUsage();
  console.log(`  📊 ${label}:`);
  console.log(`     RSS:       ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`     Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`     Heap Tot:  ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  return mem;
}

// ─── Main ──

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  🚀 AutomotiveOS Performance Benchmarks");
  console.log("═══════════════════════════════════════════════\n");

  // 1. Schema Validation Benchmark
  console.log("── 1. Schema Validation (Zod) ──────────────");
  const validClient = { name: "Juan Pérez", email: "juan@test.com", phone: "+595991234567" };
  const validVehicle = {
    clientId: "550e8400-e29b-41d4-a716-446655440000",
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    vin: "1HGBH41JXMN109186",
  };
  const invalidClient = { /* missing name */ email: "not-an-email" };

  const clientResult = bench("Client validation (valid)", () => clientSchema.parse(validClient));
  const vehicleResult = bench("Vehicle validation (valid)", () => vehicleSchema.parse(validVehicle));
  const invalidResult = bench("Client validation (invalid — safeParse)", () => clientSchema.safeParse(invalidClient));

  console.log(`  ✅ ${clientResult.name}: ${formatOps(clientResult.opsPerSecond)} ops/s (avg ${clientResult.avgMs.toFixed(3)}ms)`);
  console.log(`  ✅ ${vehicleResult.name}: ${formatOps(vehicleResult.opsPerSecond)} ops/s (avg ${vehicleResult.avgMs.toFixed(3)}ms)`);
  console.log(`  ✅ ${invalidResult.name}: ${formatOps(invalidResult.opsPerSecond)} ops/s (avg ${invalidResult.avgMs.toFixed(3)}ms)`);
  console.log();

  // 2. CSV Parsing Benchmark
  console.log("── 2. CSV Parsing Throughput ───────────────");
  const csvHeader = "name,email,phone,ruc,address,notes";
  const csvRows = Array.from({ length: 1000 }, (_, i) =>
    `Cliente ${i},cliente${i}@test.com,+59599123456${i % 10},${1000000 + i}-8,Asunción ${i},Notas del cliente ${i}`
  );
  const csvContent = [csvHeader, ...csvRows].join("\n");

  const { parse } = await import("csv-parse/sync");
  const csvResult = bench("CSV parse (1000 rows)", () => {
    parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
  }, 100);

  console.log(`  ✅ ${csvResult.name}: ${formatOps(csvResult.opsPerSecond)} ops/s (avg ${csvResult.avgMs.toFixed(2)}ms)`);
  console.log(`     Throughput: ~${Math.round(1000 / csvResult.avgMs * 1000)} rows/sec`);
  console.log();

  // 3. Memory Profile
  console.log("── 3. Memory Profile ──────────────────────");
  const memBefore = memorySnapshot("Before operations");

  const largeArray = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    data: "x".repeat(100),
  }));

  largeArray.filter((x) => x.id > 5000).map((x) => x.name.toUpperCase());

  const memAfter = memorySnapshot("After 10K object operations");
  const delta = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
  console.log(`  📈 Heap delta: ${delta > 0 ? "+" : ""}${delta.toFixed(2)} MB\n`);

  // 4. JSON Serialization
  console.log("── 4. JSON Serialization ──────────────────");
  const jsonData = Array.from({ length: 1000 }, (_, i) => ({
    id: `550e8400-e29b-41d4-a716-44665544${i.toString().padStart(4, "0")}`,
    nombre: `Cliente ${i}`,
    email: `cliente${i}@test.com`,
    telefono: "+595991234567",
    ruc: `${1000000 + i}-8`,
    direccion: `Calle Principal ${i}, Asunción, Paraguay`,
    notas: "Cliente frecuente del taller mecánico",
    fechaCreacion: new Date().toISOString(),
  }));

  const jsonResult = bench("JSON.stringify (1000 records)", () => JSON.stringify(jsonData));
  const parseResult = bench("JSON.parse (1000 records)", () => JSON.parse(JSON.stringify(jsonData)));

  console.log(`  ✅ ${jsonResult.name}: ${formatOps(jsonResult.opsPerSecond)} ops/s (avg ${jsonResult.avgMs.toFixed(3)}ms)`);
  console.log(`  ✅ ${parseResult.name}: ${formatOps(parseResult.opsPerSecond)} ops/s (avg ${parseResult.avgMs.toFixed(3)}ms)`);
  console.log();

  // 5. String Operations (XSS escape simulation)
  console.log("── 5. String Operations (XSS escape) ──────");
  const ENTITY_MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };
  const ENTITY_REGEX = /[&<>"']/g;
  const maliciousStrings = [
    '<script>alert("xss")</script>',
    '<img onerror="alert(1)" src="x">',
    '"><svg onload=alert(1)>',
    "O'Brien's \"shop\" & <Co.",
    "Normal text without special chars",
  ];

  const escapeResult = bench("escapeHtml (50 char avg)", () => {
    for (const s of maliciousStrings) {
      s.replace(ENTITY_REGEX, (c) => ENTITY_MAP[c] || c);
    }
  }, 50000);

  console.log(`  ✅ ${escapeResult.name}: ${formatOps(escapeResult.opsPerSecond)} ops/s`);
  console.log();

  // Summary
  console.log("═══════════════════════════════════════════════");
  console.log("  📋 Summary");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Schema validation: ${formatOps(clientResult.opsPerSecond)} ops/s`);
  console.log(`  CSV parsing:       ~${Math.round(1000 / csvResult.avgMs * 1000)} rows/sec`);
  console.log(`  JSON stringify:    ${formatOps(jsonResult.opsPerSecond)} ops/s`);
  console.log(`  XSS escape:        ${formatOps(escapeResult.opsPerSecond)} ops/s`);
  console.log(`  Heap used:         ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log("═══════════════════════════════════════════════\n");
}

main().catch(console.error);
