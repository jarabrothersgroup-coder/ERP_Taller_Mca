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
 * We deliberately use a session-scoped `SET` (not `SET LOCAL`): tenant RLS
 * context therefore survives `BEGIN`/`COMMIT` on this connection, and it avoids
 * the postgres.js/drizzle nested-transaction conflict (a service-level
 * `db().transaction()` would otherwise prematurely COMMIT the outer
 * transaction). Multi-statement atomicity is provided instead by
 * `withTransaction()` (shared/database/transaction.ts), which drives BEGIN /
 * COMMIT on this pinned connection and nests safely — see Fase 3 (T-31/T-32).
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

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getDb } from "../database/connection.js";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../database/schema/index.js";
import { requestDbStorage, type RequestDbContext } from "../database/request-context.js";
import { patchPinnedTransaction } from "../database/transaction.js";
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

  /**
   * Reset the tenant setting + release the pinned connection.
   *
   * Idempotente por diseño (`released` se marca ANTES de cualquier await, ver
   * FIX T-61), así que puede invocarse desde varios disparadores — onResponse,
   * onError y el backstop de `reply.raw` "close" — sin doble release.
   */
  const releasePinnedContext = async (ctx: RequestDbContext): Promise<void> => {
    if (!ctx.tx) return;
    // FIX (T-61): marcar liberado ANTES de cualquier await. Así, cualquier
    // `db()` disparado en paralelo (fire-and-forget del handler) cae al pool
    // compartido en vez de encolarse sobre esta conexión, evitando queries
    // sobre un handle ya devuelto al pool (desincroniza el protocolo y la
    // query siguiente nunca recibe respuesta).
    ctx.released = true;
    // Hygiene: clear the session setting before the connection returns to the
    // pool. The next request that reserves it will overwrite it anyway.
    try {
      await ctx.tx`SELECT set_config('app.current_tenant', '', false)`;
    } catch {
      // Connection may already be closed — nothing to do.
    }
    ctx.tx.release();
  };

  // Reserve a dedicated connection + set the tenant context at the start of
  // each request.
  //
  // Registered as PREHANDLER (not onRequest): the per-tenant resolveTenant
  // hook runs as onRequest in EACH module's scoped plugin, and Fastify runs
  // parent-scope hooks BEFORE child-scope hooks. A root onRequest would
  // execute before resolveTenant, leaving request.tenantSlug undefined and
  // setting app.current_tenant='' on every request — breaking tenant
  // isolation. As preHandler it runs after all onRequest hooks (resolveTenant
  // included) and before the handler.
  //
  // IMPORTANT: `requestDbStorage.enterWith(ctx)` MUST be called synchronously
  // (before any `await`). AsyncLocalStorage binds the store to the current
  // async resource; an `await` before `enterWith` would move the continuation
  // into a new resource that the Fastify handler does not share, so the store
  // would be invisible to handlers. We therefore create the context object,
  // enter it synchronously, then fill `tx`/`drizzle` after the awaits (the
  // handler runs only after the preHandler fully resolves, so the fields are
  // set).
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = (request as { tenantSlug?: string }).tenantSlug;
    const ctx: RequestDbContext = {
      tx: undefined as never,
      drizzle: undefined as never,
      released: false,
    };
    requestDbStorage.enterWith(ctx);

    // Rutas de streaming (SSE / WebSocket): la respuesta se escribe sobre
    // `reply.raw` o se secuestra con `reply.hijack()`, por lo que Fastify
    // NUNCA emite `onResponse` y esta conexión quedaría retenida para
    // siempre. Con un pool de 5 conexiones, cada stream abierto destruye
    // capacidad hasta que la siguiente request se queda esperando en
    // `sql.reserve()` sin ninguna actividad visible en Postgres. Estos
    // handlers no consultan la DB, así que no reservan conexión.
    if (request.routeOptions?.config?.reserveDb === false) return;

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
    // Fase 3 (T-31/T-32): `sql.reserve()` has no `.begin()`, so drizzle's
    // `transaction()` would throw on this handle. Patch it to drive BEGIN /
    // COMMIT on the pinned connection and to reuse any active transaction.
    patchPinnedTransaction(ctx);

    // FIX (wedge E2E 2026-10-07): si el cliente aborta el request en vuelo
    // (timeout del test, navegación, page.close()), Fastify NO emite ni
    // `onResponse` ni `onError`, así que la conexión reservada quedaba
    // retenida para siempre. Con 5 abortos el pool (max 5) se agotaba y el
    // backend se wedgeaba: /health responde 401 en ~2ms (el authGate corta
    // antes del reserve) pero TODO lo demás cuelga en `sql.reserve()` con
    // Postgres mostrando conns idle y sin lock waits. Repro determinista:
    // abortar 15 requests paralelas → el siguiente login queda HANG.
    // `reply.raw` "close" se dispara SIEMPRE (tras respuesta normal Y tras
    // aborto del socket), y `released` hace el doble release inocuo.
    reply.raw.once("close", () => {
      void releasePinnedContext(ctx);
    });

    // Si el cliente ya había abortado mientras esperábamos `sql.reserve()` /
    // el set_config, liberamos ya: nadie va a disparar onResponse después.
    if (reply.raw.destroyed) await releasePinnedContext(ctx);
  });

  // Reset the tenant context + release the connection when the request ends.
  // El release en sí vive en `releasePinnedContext` (idempotente), compartido
  // con el backstop de aborto del preHandler.
  const releaseContext = async () => {
    const ctx = requestDbStorage.getStore();
    if (!ctx || ctx.released || !ctx.tx) return;
    await releasePinnedContext(ctx);
    requestDbStorage.exit(() => {});
  };

  app.addHook("onResponse", releaseContext);
  // Fail-closed: also reset + release on error (onResponse still runs
  // afterwards but will find no active store and skip).
  app.addHook("onError", releaseContext);
}
