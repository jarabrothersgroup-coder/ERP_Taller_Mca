/**
 * Migration 0010 — Multi-almacén.
 *
 * Executes the 0010_almacenes.sql migration against the database.
 * Uses the existing PostgreSQL connection pattern from apply-migration.ts.
 *
 * Run: npx tsx scripts/apply-0010.ts
 *
 * @module scripts/apply-0010
 */

import { getDb, closeDb } from "../src/shared/database/connection.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filename = "0010_almacenes.sql";

async function applyMigration() {
  const sql = getDb();

  // Check if already applied
  const [existing] = await sql`
    SELECT id FROM public.migrations WHERE filename = ${filename}
  `;
  if (existing) {
    console.log(`Migration ${filename} already applied.`);
    await closeDb();
    return;
  }

  const filePath = join(__dirname, "../src/shared/database/migrations", filename);
  const content = readFileSync(filePath, "utf-8");

  // Split by semicolon and execute each statement
  const statements = content
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    if (!stmt) continue;
    try {
      await sql.unsafe(stmt + ";");
      console.log(`  [OK] Executed: ${stmt.slice(0, 60)}...`);
    } catch (err: any) {
      // Column/table already exists is OK for idempotency
      if (err.message?.includes("already exists")) {
        console.log(`  [SKIP] ${err.message.slice(0, 60)}`);
      } else {
        throw err;
      }
    }
  }

  // Record migration
  await sql`
    INSERT INTO public.migrations (filename) VALUES (${filename})
  `;
  console.log(`\n✅ Migration ${filename} applied successfully.`);
  await closeDb();
}

applyMigration().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
