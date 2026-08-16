/**
 * Drizzle ORM client — lightweight wrapper over the shared postgres connection.
 *
 * Uses the existing lazy singleton from `connection.ts` and wraps it
 * with Drizzle ORM for type-safe queries.
 *
 * RAM impact: negligible (~200KB additional heap). The underlying
 * postgres connection is already lazy (created on first use).
 *
 * @module shared/database/drizzle
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getDb } from "./connection.js";
import { requestDbStorage } from "./request-context.js";
import * as schema from "./schema/index.js";

// Re-export `sql` helper so all modules import from one place
export { sql };

/**
 * Schema type for the Drizzle ORM instance.
 * Provides full type-safety for all queries.
 */
export type DbSchema = typeof schema;

let _db: PostgresJsDatabase<DbSchema> | null = null;

/**
 * Returns a shared Drizzle ORM instance over the singleton postgres connection.
 *
 * Created lazily on first call — no overhead at import time.
 * Suitable for use in route handlers, services, and middleware.
 *
 * @example
 * ```ts
 * import { db } from "../shared/database/drizzle.js";
 * const tenants = await db().select().from(schema.tenants);
 * ```
 */
export function db(): PostgresJsDatabase<DbSchema> {
  // When a request tenant context is active, return the connection-bound
  // Drizzle instance so all queries run on that request's dedicated
  // connection (and inherit its `app.current_tenant` RLS context). Outside a
  // request (cron, CLI, background jobs) fall back to the shared singleton.
  const ctx = requestDbStorage.getStore();
  if (ctx) return ctx.drizzle;
  if (!_db) {
    const sql = getDb();
    _db = drizzle(sql, { schema, logger: false });
  }
  return _db;
}
