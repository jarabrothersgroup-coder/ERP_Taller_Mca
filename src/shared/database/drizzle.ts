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
  if (!_db) {
    const sql = getDb();
    _db = drizzle(sql, { schema, logger: false });
  }
  return _db;
}

/**
 * Creates a fresh Drizzle instance for a specific tenant schema.
 *
 * This allows querying per-tenant tables using the same Drizzle API
 * but scoped to the tenant's isolated schema (e.g., `tenant_taller_el_chero`).
 *
 * @param schemaName - The tenant's PostgreSQL schema name (e.g. `tenant_acme`)
 * @returns A Drizzle ORM instance scoped to that schema
 *
 * @example
 * ```ts
 * const tenantDb = dbForTenant("tenant_taller_el_chero");
 * const clients = await tenantDb.execute(sql`SELECT * FROM ${sql(schemaName)}.clients`);
 * ```
 */
export function dbForTenant(schemaName: string): PostgresJsDatabase<DbSchema> {
  const sql = getDb();
  // Set the search path to the tenant schema + public
  sql`SET search_path TO ${sql(schemaName)}, public`.execute();
  return drizzle(sql, { schema, logger: false });
}
