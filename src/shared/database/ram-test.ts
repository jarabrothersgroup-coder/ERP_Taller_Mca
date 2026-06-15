/**
 * RAM footprint measurement — Drizzle ORM + postgres connection.
 *
 * Measures actual heap/RSS after GC to verify < 50MB target.
 * Run with compiled JS for accurate results:
 *
 *   DATABASE_URL="postgresql://..." node --expose-gc dist/shared/database/ram-test.js
 *
 * @module shared/database/ram-test
 */

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL required");
  process.exit(1);
}

async function main(): Promise<void> {
  // Force GC for clean baseline
  if (global.gc) global.gc();
  await new Promise((r) => setTimeout(r, 200));
  if (global.gc) global.gc();
  await new Promise((r) => setTimeout(r, 100));

  const baseline = process.memoryUsage();

  // ─── Step 1: Import modules ────
  console.log("1️⃣  Loading modules...");
  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const schema = await import("./schema/index.js");

  const afterImport = process.memoryUsage();
  console.log(
    `    heapUsed: ${((afterImport.heapUsed - baseline.heapUsed) / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(
    `    rss:      ${((afterImport.rss - baseline.rss) / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log("");

  // ─── Step 2: Establish connection ────
  console.log("2️⃣  Connecting to Supabase...");
  const sql = postgres(DATABASE_URL!, {
    max: 5,
    idle_timeout: 10,
    connect_timeout: 10,
    ssl: { rejectUnauthorized: false },
  });

  const ping = await sql`SELECT 1 AS alive`;
  console.log(`    ✅  Connected | SELECT 1 = ${ping[0]?.alive}`);

  const afterConnect = process.memoryUsage();
  console.log(
    `    heapUsed: ${((afterConnect.heapUsed - baseline.heapUsed) / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(
    `    rss:      ${((afterConnect.rss - baseline.rss) / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log("");

  // ─── Step 3: Drizzle ORM query ────
  console.log("3️⃣  Running Drizzle ORM query...");
  const db = drizzle(sql, { schema });

  // Query tenants table (may be empty)
  const tenants = await db.select().from(schema.tenants).limit(5);
  console.log(`    ✅  Query OK | ${tenants.length} rows returned`);

  const afterQuery = process.memoryUsage();
  console.log(
    `    heapUsed: ${((afterQuery.heapUsed - baseline.heapUsed) / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(
    `    rss:      ${((afterQuery.rss - baseline.rss) / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log("");

  // ─── Step 4: GC and measure stable footprint ────
  console.log("4️⃣  Measuring stable footprint (after GC)...");
  if (global.gc) global.gc();
  await new Promise((r) => setTimeout(r, 200));
  if (global.gc) global.gc();
  await new Promise((r) => setTimeout(r, 100));

  const afterGC = process.memoryUsage();

  console.log(
    `    heapUsed: ${((afterGC.heapUsed - baseline.heapUsed) / 1024 / 1024).toFixed(2)} MB (delta from baseline)`,
  );
  console.log(`    heapUsed: ${(afterGC.heapUsed / 1024 / 1024).toFixed(2)} MB (absolute)`);
  console.log(`    rss:      ${(afterGC.rss / 1024 / 1024).toFixed(2)} MB (absolute)`);
  console.log("");

  // ─── Conclusion ────
  const overhead = (afterGC.heapUsed - baseline.heapUsed) / 1024 / 1024;
  if (overhead < 50) {
    console.log("✅  RAM OK — Drizzle ORM + postgres overhead < 50 MB");
  } else {
    console.log(`⚠️   RAM exceeds target by ${(overhead - 50).toFixed(2)} MB`);
  }

  await sql.end({ timeout: 3 });
}

main().catch((err) => {
  console.error("❌  Test failed:", err);
  process.exit(1);
});
