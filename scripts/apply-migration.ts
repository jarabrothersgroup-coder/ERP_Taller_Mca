import { getDb, closeDb } from "../src/shared/database/connection.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function applyMigration() {
  const sql = getDb();
  const filename = "0007_analytical_dimensions.sql";

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

  // Split by statement-breakpoint markers and execute each statement
  const statements = content
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
      console.log(`  [OK] Executed: ${stmt.slice(0, 60)}...`);
    } catch (err: any) {
      // Column already exists is OK for idempotency
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
  console.log(`\nMigration ${filename} applied successfully.`);
  await closeDb();
}

applyMigration().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
