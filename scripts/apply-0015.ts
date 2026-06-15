/**
 * Apply migration 0015_treasury.sql to the database.
 *
 * Usage:
 *   npx tsx scripts/apply-0015.ts
 *
 * @module scripts/apply-0015
 */

import { getDb, closeDb } from "../src/shared/database/connection.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function apply0015() {
  const sql = getDb();
  const filename = "0015_treasury.sql";

  // Check if already applied
  const [existing] = await sql`
    SELECT id FROM public.migrations WHERE filename = ${filename}
  `;
  if (existing) {
    console.log(`Migration ${filename} already applied.`);
    await closeDb();
    return;
  }

  const filePath = join(
    __dirname, "../src/shared/database/migrations", filename,
  );
  const content = readFileSync(filePath, "utf-8");

  // Run the entire SQL file as a batch
  console.log(`Applying ${filename}...`);
  await sql.unsafe(content);
  console.log("  ✅  Migration SQL executed successfully.");

  // Record migration
  await sql`
    INSERT INTO public.migrations (filename) VALUES (${filename})
  `;
  console.log(`\n✅  Migration ${filename} applied successfully.`);
  await closeDb();
}

apply0015().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
