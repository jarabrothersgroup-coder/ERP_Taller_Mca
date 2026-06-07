/**
 * Database connection validator script.
 *
 * Run with: `npx tsx src/shared/database/validate.ts`
 * Validates the Neon/Supabase PostgreSQL connection from .env config.
 */

import { validateConnection, closeDb } from "./connection.js";

async function main(): Promise<void> {
  console.log("🔌 Validating database connection...");
  console.log("   Target: Remote PostgreSQL (Neon/Supabase)\n");

  const isHealthy = await validateConnection();

  if (isHealthy) {
    console.log("✅  Database connection successful!");
    console.log("   PostgreSQL remote instance is reachable and responsive.\n");
  } else {
    console.error("❌  Database connection FAILED.");
    console.error("   Check your DATABASE_URL in .env and ensure the remote DB is running.\n");
    process.exit(1);
  }

  await closeDb();
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
