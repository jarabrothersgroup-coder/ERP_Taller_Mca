/**
 * Request-scoped database transaction context.
 *
 * Holds the active per-request PostgreSQL transaction so that `db()` can
 * return a transaction-bound Drizzle instance instead of the shared singleton
 * when one is active. This is the foundation of the per-request transaction
 * refactor: it lets us scope `app.current_tenant` (RLS) and `search_path`
 * (per-tenant schema) to a transaction via `SET LOCAL`, eliminating the
 * session-scoped leak that occurs on pooled, reused connections.
 *
 * @see src/shared/middleware/transaction-context.ts
 * @see docs/RUNBOOK_ONPREM.md — "Seguridad multi-tenant"
 *
 * @module shared/database/request-context
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { DbSchema } from "./drizzle.js";

/**
 * Active request database context.
 *
 * `tx` is the postgres.js transaction handle returned by `sql.begin()`
 * (queryable + `.commit()`/`.rollback()`). `drizzle` is the Drizzle ORM
 * instance bound to that transaction.
 */
export interface RequestDbContext {
  /** Reserved postgres.js connection for this request (also queryable as `sql`) */
  tx: any;
  /** Drizzle instance bound to the reserved connection */
  drizzle: PostgresJsDatabase<DbSchema>;
  /** True once the connection has been released back to the pool */
  released?: boolean;
}

/**
 * AsyncLocalStorage carrying the active request DB context.
 *
 * Entered by the transaction-context middleware on `onRequest` and exited on
 * `onResponse`/`onError`. `db()` reads this store; when absent it falls back
 * to the shared singleton (preserving behavior for cron/CLI/background jobs
 * that run outside a request).
 */
export const requestDbStorage = new AsyncLocalStorage<RequestDbContext>();

/** Returns the active request DB context, or `undefined` outside a request tx. */
export function getRequestDb(): RequestDbContext | undefined {
  return requestDbStorage.getStore();
}
