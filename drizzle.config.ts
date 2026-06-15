/**
 * Drizzle ORM configuration — AutomotiveOS Cloud ERP.
 *
 * Schema source: `src/shared/database/schema/*.ts`
 * Migration output: `src/shared/database/migrations/`
 * Dialect: PostgreSQL (remote Supabase/Neon)
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx drizzle-kit generate
 *   DATABASE_URL="postgresql://..." npx drizzle-kit push
 *   DATABASE_URL="postgresql://..." npx drizzle-kit migrate
 *
 * The DATABASE_URL is read from the environment (NOT from .env)
 * to avoid accidental credential leaks. Pass it inline or export it
 * in your shell profile.
 *
 * @module drizzle.config
 */

import { defineConfig } from "drizzle-kit";

const dbUrl = process.env["DATABASE_URL"];

if (!dbUrl) {
  throw new Error(
    "DATABASE_URL environment variable is required. " +
      "Pass it inline, e.g.:\n" +
      '  DATABASE_URL="postgresql://..." npx drizzle-kit generate\n' +
      "Do NOT rely on .env files for Drizzle CLI commands.",
  );
}

export default defineConfig({
  schema: [
    "./src/shared/database/schema/*.ts",
    "./src/modules/workshop/schema/*.ts",
    "./src/modules/inventory/schema/*.ts",
    "./src/modules/finance/schema/*.ts",
    "./src/modules/thinkcar/schema/*.ts",
    "./src/modules/tenants/schema/*.ts",
  ],
  out: "./src/shared/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
  // Strict mode: warns if tables are missing PKs or have other issues
  strict: true,
  // Print SQL statements during generation
  verbose: true,
});
