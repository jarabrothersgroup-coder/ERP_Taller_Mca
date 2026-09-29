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
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getDb } from "./connection.js";
import { requestDbStorage } from "./request-context.js";
import { currentTx } from "./tx-context.js";
import * as schema from "./schema/index.js";

// Re-export `sql` helper so all modules import from one place.
// Se reexporta DIRECTAMENTE desde drizzle-orm, no `import { sql } ... export { sql }`:
// con la forma import+export, el pipeline SSR de Vite deja el binding en
// `undefined` cuando drizzle-orm está externalizado (es ESM-only), y todo módulo
// que hace `import { db, sql } from ".../drizzle.js"` —migration.service,
// consolidated-report, accounting— revienta con
// "TypeError: sql is not a function" al llamar a la función. En producción
// (tsx/Node) la forma antigua funcionaba, así que el bug era invisible fuera de
// vitest y dejaba esa superficie de API intestable. T-48.
export { sql } from "drizzle-orm";

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
  // Fase 3 (T-31/T-32): an active `withTransaction()` transaction wins over
  // everything else. Every `db()` call in the call stack — accounting bus,
  // stock consumers, audit writes — then runs on the SAME connection inside
  // the SAME transaction, so any throw rolls all of it back atomically.
  const tx = currentTx();
  if (tx) return tx;
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

// NOTE: `withTransaction()` lives in ./transaction.js (not here) so that
// unit tests which `vi.mock()` this module still get a working transaction
// helper — the mock only ever provides `db()`.
