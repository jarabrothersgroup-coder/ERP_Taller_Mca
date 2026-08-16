/**
 * Neon/Supabase PostgreSQL connection pool.
 *
 * Uses `postgres` – the lightweight (~3KB) PostgreSQL client for Node.js.
 * Connection is lazy (only established on first query) to keep RAM < 50MB.
 *
 * @module shared/database/connection
 */

import postgres from "postgres";
import { env } from "../../config/env.js";
import { getRequestDb } from "./request-context.js";

let sql: postgres.Sql | null = null;

/**
 * Returns a PostgreSQL connection for the current execution context.
 *
 * When a per-request tenant context is active (`ENABLE_REQUEST_TENANT_CONTEXT`),
 * returns that request's dedicated reserved connection so that raw SQL
 * (`getDb().unsafe(...)` / template tags) inherits the request's
 * `app.current_tenant` RLS context — same guarantee `db()` provides for
 * Drizzle queries. Outside a request (CLI, cron, background jobs) falls back
 * to the shared singleton pool.
 *
 * @returns A `postgres.Sql` instance configured for Neon/Supabase.
 */
export function getDb(): postgres.Sql {
  // Reserved request connection first (see transaction-context.ts).
  const ctx = getRequestDb();
  if (ctx && ctx.tx && !ctx.released) {
    return ctx.tx as postgres.Sql;
  }
  if (!sql) {
    sql = postgres(env.DATABASE_URL, {
      max: 5,                      // Max connections in pool — lean for <50MB
      idle_timeout: 30,            // Close idle connections after 30s
      connect_timeout: 10,         // Fail fast if DB is unreachable
      prepare: false,              // Disable prepared statements (serverless friendly)

      ssl: env.DATABASE_URL.includes("sslmode=disable")
        ? false
        : process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: true }
          : { rejectUnauthorized: false },
    });
  }
  return sql;
}

/**
 * Tests the database connection by running a simple query.
 * Used for health checks and startup validation.
 *
 * @returns `true` if the connection is healthy, `false` otherwise.
 */
export async function validateConnection(): Promise<boolean> {
  try {
    const db = getDb();
    const result = await db`SELECT 1 AS alive`;
    return result.length === 1 && result[0]!["alive"] === 1;
  } catch {
    return false;
  }
}

/**
 * Gracefully closes the database connection pool.
 * Should be called on application shutdown.
 */
export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = null;
  }
}
