/**
 * Per-request tenant context (multi-tenant RLS isolation fix).
 *
 * When `ENABLE_REQUEST_TENANT_CONTEXT` is on, every request reserves a
 * dedicated PostgreSQL connection and sets `app.current_tenant` session-scoped
 * on it (overwritten at the start of every request, and reset before the
 * connection is released back to the pool).
 *
 * Why this closes the leak: the original bug was a session-scoped
 * `set_config('app.current_tenant', ..., false)` applied to the SHARED
 * singleton connection pool. A pooled connection that served tenant A could be
 * reused by a later request that did not re-apply the tenant (or applied a
 * different one), leaking A's context. By reserving a dedicated connection per
 * request and always overwriting + resetting the setting, the context cannot
 * escape to another request.
 *
 * We deliberately use a session-scoped `SET` (not `SET LOCAL` inside a
 * transaction): it avoids the postgres.js/drizzle nested-transaction conflict
 * (a service-level `db().transaction()` would otherwise prematurely COMMIT the
 * outer transaction). The dedicated connection + overwrite + reset gives the
 * same isolation guarantee without that complexity.
 *
 * `db()` (see drizzle.ts) reads the active connection from AsyncLocalStorage,
 * so handlers keep calling `db()` unchanged. Outside a request (cron/CLI) the
 * singleton is used.
 *
 * @see src/shared/database/request-context.ts
 * @see src/shared/middleware/rls.ts
 * @see docs/RUNBOOK_ONPREM.md — "Seguridad multi-tenant"
 *
 * @module shared/middleware/transaction-context
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { getDb } from "../database/connection.js";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../database/schema/index.js";
import { requestDbStorage, type RequestDbContext } from "../database/request-context.js";
import { env } from "../../config/env.js";

/**
 * Registers the per-request tenant-context hooks.
 *
 * No-ops entirely when `ENABLE_REQUEST_TENANT_CONTEXT` is false, preserving the
 * current (session-scoped-on-shared-pool) behavior. Safe to register
 * unconditionally.
 */
export async function registerRequestTransactions(
  app: FastifyInstance,
): Promise<void> {
  if (!env.ENABLE_REQUEST_TENANT_CONTEXT) return;

  // Reserve a dedicated connection + set the tenant context at the start of
  // each request.
  //
  // IMPORTANT: `requestDbStorage.enterWith(ctx)` MUST be called synchronously
  // (before any `await`). AsyncLocalStorage binds the store to the current
  // async resource; an `await` before `enterWith` would move the continuation
  // into a new resource that the Fastify handler does not share, so the store
  // would be invisible to handlers. We therefore create the context object,
  // enter it synchronously, then fill `tx`/`drizzle` after the awaits (the
  // handler runs only after `onRequest` fully resolves, so the fields are set).
  app.addHook("onRequest", async (request: FastifyRequest) => {
    const tenantSlug = (request as { tenantSlug?: string }).tenantSlug;
    const ctx: RequestDbContext = {
      tx: undefined as never,
      drizzle: undefined as never,
      released: false,
    };
    requestDbStorage.enterWith(ctx);

    const sql = getDb();
    const conn = await sql.reserve();
    // The reserved connection lacks `.options`, which the drizzle driver
    // requires (client.options.parsers). Share the parent's options.
    conn.options = sql.options;
    // Session-scoped SET on the dedicated connection. Non-tenant requests get
    // '' (allow-all) so RLS policies keep working. Overwritten every request,
    // so a value left by a previous request cannot leak.
    const safeSlug = tenantSlug
      ? String(tenantSlug).replace(/[^a-zA-Z0-9_-]/g, "")
      : "";
    await conn`SELECT set_config('app.current_tenant', ${safeSlug}, false)`;

    ctx.tx = conn;
    ctx.drizzle = drizzle(conn as never, { schema, logger: false });
  });

  // Reset the tenant context + release the connection when the request ends.
  const releaseContext = async () => {
    const ctx = requestDbStorage.getStore();
    if (!ctx || ctx.released || !ctx.tx) return;
    // Hygiene: clear the session setting before the connection returns to the
    // pool. The next request that reserves it will overwrite it anyway.
    try {
      await ctx.tx`SELECT set_config('app.current_tenant', '', false)`;
    } catch {
      // Connection may already be closed — nothing to do.
    }
    ctx.tx.release();
    ctx.released = true;
    requestDbStorage.exit(() => {});
  };

  app.addHook("onResponse", releaseContext);
  // Fail-closed: also reset + release on error (onResponse still runs
  // afterwards but will find no active store and skip).
  app.addHook("onError", releaseContext);
}
