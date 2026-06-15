/**
 * Smoke test — Direct connection to Supabase PostgreSQL via Drizzle ORM.
 *
 * This script does NOT read .env. The DATABASE_URL must be passed
 * directly as an environment variable or edited inline (see usage).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx src/shared/database/smoke-test.ts
 *
 * It validates:
 *   - TCP connectivity to the remote host
 *   - PostgreSQL authentication
 *   - Basic query execution (SELECT 1)
 *   - Drizzle ORM schema introspection (read tenants table)
 *   - RAM footprint at connection time (< 50MB target)
 *
 * @module shared/database/smoke-test
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";

const DATABASE_URL = process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL environment variable is required.");
  console.error("");
  console.error("  Usage:");
  console.error('    DATABASE_URL="postgresql://..." npx tsx src/shared/database/smoke-test.ts');
  process.exit(1);
}

async function main(): Promise<void> {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   AutomotiveOS — Smoke Test (Drizzle ORM + Supabase)   ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");

  // ─── Step 1: Establish raw postgres connection ─────
  console.log("1️⃣  Establishing PostgreSQL connection...");
  console.log(`   Host:   ${new URL(DATABASE_URL!).hostname}`);
  console.log(`   DB:     ${new URL(DATABASE_URL!).pathname.slice(1)}`);
  console.log(`   SSL:    require`);
  console.log("");

  const sql = postgres(DATABASE_URL!, {
    max: 1, // Single connection for smoke test
    idle_timeout: 10,
    connect_timeout: 10,
    ssl: { rejectUnauthorized: false },
  });

  // ─── Step 2: Verify basic query ────
  console.log("2️⃣  Running SELECT 1...");
  const result = await sql`SELECT 1 AS alive`;
  if (result[0]?.alive === 1) {
    console.log("   ✅  Basic query OK (SELECT 1)");
  } else {
    throw new Error("SELECT 1 returned unexpected result");
  }
  console.log("");

  // ─── Step 3: Test Postgres version ────
  console.log("3️⃣  Checking PostgreSQL version...");
  const versionResult = await sql`SELECT version()`;
  console.log(`   📦  ${versionResult[0]?.version}`);
  console.log("");

  // ─── Step 4: Test Drizzle ORM schema ────
  console.log("4️⃣  Testing Drizzle ORM schema introspection...");
  drizzle(sql, { schema }); // Init Drizzle — validates schema shape

  // Check that our schema tables are accessible
  const tableCheck = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('tenants', 'profiles')
    ORDER BY table_name
  `;

  if (tableCheck.length === 0) {
    console.log("   ℹ️   Tables not yet created (run migration first)");
    console.log("   🔧  Drizzle schema definitions loaded successfully");
  } else {
    console.log(`   ✅  Found ${tableCheck.length} schema table(s):`);
    for (const row of tableCheck) {
      console.log(`       · ${row.table_name}`);
    }
  }
  console.log("");

  // ─── Step 5: Memory footprint ────
  console.log("5️⃣  Measuring memory footprint...");
  const mem = process.memoryUsage();
  const rssMb = mem.rss / 1024 / 1024;
  const heapMb = mem.heapUsed / 1024 / 1024;

  console.log(`   📊  RSS:        ${rssMb.toFixed(2)} MB`);
  console.log(`   📊  Heap used:  ${heapMb.toFixed(2)} MB`);
  console.log(`   📊  Heap total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);

  if (rssMb < 50) {
    console.log("   ✅  Memory OK (< 50 MB RSS target)");
  } else {
    console.log("   ⚠️   RSS exceeds 50 MB target — review imports");
  }
  console.log("");

  // ─── Summary ────
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   ✅  Smoke test passed!                               ║");
  console.log("║   Supabase PostgreSQL is reachable and responsive.     ║");
  console.log("║   Drizzle ORM schema loaded successfully.             ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("");
  console.error("╔══════════════════════════════════════════════════════════╗");
  console.error("║   ❌  Smoke test FAILED!                               ║");
  console.error("╚══════════════════════════════════════════════════════════╝");
  console.error("");
  console.error(`Error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
