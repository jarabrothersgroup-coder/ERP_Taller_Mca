/**
 * Database Migration Runner — Execute SQL migrations in order.
 *
 * Usage:
 *   npx tsx src/shared/database/run-migrations.ts [--dry-run]
 *
 * Reads all .sql files in migrations/ folder, sorts by number prefix,
 * and executes them against the database.
 *
 * @module shared/database/run-migrations
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "./drizzle.js";

const MIGRATIONS_DIR = join(import.meta.dirname, "migrations");

interface MigrationResult {
  filename: string;
  status: "applied" | "skipped" | "error";
  error?: string;
  durationMs: number;
}

async function getExecutedMigrations(): Promise<Set<string>> {
  try {
    // Create migrations tracking table if not exists
    await db().execute(
      `CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );

    const result = await db().execute(
      `SELECT filename FROM _migrations ORDER BY id`
    );

    const rows = result.rows || [];
    return new Set(rows.map((r: any) => r.filename));
  } catch {
    return new Set();
  }
}

async function recordMigration(filename: string): Promise<void> {
  await db().execute(
    `INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
    [filename]
  );
}

async function runMigrations(dryRun = false): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  // Read migration files
  const files = (await readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith(".sql"))
    .sort();

  const executed = await getExecutedMigrations();

  console.log(`[Migrations] Found ${files.length} migration files`);
  console.log(`[Migrations] ${executed.size} already executed`);

  for (const file of files) {
    if (executed.has(file)) {
      results.push({
        filename: file,
        status: "skipped",
        durationMs: 0,
      });
      continue;
    }

    const start = Date.now();
    const filePath = join(MIGRATIONS_DIR, file);

    try {
      const sql = await readFile(filePath, "utf-8");

      if (dryRun) {
        console.log(`[Migrations] DRY RUN: ${file} (${sql.length} bytes)`);
        results.push({
          filename: file,
          status: "skipped",
          durationMs: Date.now() - start,
        });
        continue;
      }

      console.log(`[Migrations] Applying: ${file}...`);
      await db().execute(sql);
      await recordMigration(file);

      const duration = Date.now() - start;
      console.log(`[Migrations] Applied: ${file} (${duration}ms)`);

      results.push({
        filename: file,
        status: "applied",
        durationMs: duration,
      });
    } catch (err: any) {
      const duration = Date.now() - start;
      console.error(`[Migrations] Error in ${file}:`, err.message);

      results.push({
        filename: file,
        status: "error",
        error: err.message,
        durationMs: duration,
      });

      // Stop on error
      break;
    }
  }

  return results;
}

// ─── CLI Entry Point ─────────────────────────

const isMain = process.argv[1]?.endsWith("run-migrations.ts");
if (isMain) {
  const dryRun = process.argv.includes("--dry-run");

  console.log("[Migrations] Starting...");
  if (dryRun) console.log("[Migrations] DRY RUN MODE");

  const results = await runMigrations(dryRun);

  const applied = results.filter(r => r.status === "applied").length;
  const skipped = results.filter(r => r.status === "skipped").length;
  const errors = results.filter(r => r.status === "error").length;

  console.log("\n[Migrations] Summary:");
  console.log(`  Applied: ${applied}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors:  ${errors}`);

  if (errors > 0) {
    console.log("\n[Migrations] Failed migration:", results.find(r => r.status === "error")?.filename);
    process.exit(1);
  }
}

export { runMigrations };
