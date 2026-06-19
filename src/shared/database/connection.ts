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

let sql: postgres.Sql | null = null;

/**
 * Returns a shared PostgreSQL connection instance.
 * Creates the connection on first call (singleton pattern).
 *
 * @returns A `postgres.Sql` instance configured for Neon/Supabase.
 */
export function getDb(): postgres.Sql {
  if (!sql) {
    sql = postgres(env.DATABASE_URL, {
      max: 5,                      // Max connections in pool — lean for <50MB
      idle_timeout: 30,            // Close idle connections after 30s
      connect_timeout: 10,         // Fail fast if DB is unreachable
      prepare: false,              // Disable prepared statements (serverless friendly)
      ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false }, // Dev: allow self-signed certs
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
