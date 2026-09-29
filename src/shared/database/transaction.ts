/**
 * Transaction helper (Fase 3 · auditoría 2026-09-25 · T-31/T-32).
 *
 * `withTransaction()` is the single entry point for wrapping multi-statement
 * mutations. It supports the two connection shapes this backend has:
 *
 * 1. **Per-request reserved connection** (`ENABLE_REQUEST_TENANT_CONTEXT`):
 *    the reserved handle produced by `sql.reserve()` does NOT expose
 *    postgres.js `.begin()`, so drizzle's `db().transaction()` cannot run on
 *    it (`this.client.begin is not a function`). We drive `BEGIN` / `COMMIT` /
 *    `ROLLBACK` manually on that pinned connection instead — every query made
 *    through `db()` during the callback is pinned to the same connection, so
 *    they all sit inside the transaction.
 *
 * 2. **Shared singleton pool** (cron, CLI, background jobs, tests): the root
 *    postgres.js object does expose `.begin()`, so we delegate to drizzle's
 *    `db().transaction()`, which already returns a transaction-bound handle.
 *
 * In both cases the active handle is published through
 * {@link file://./tx-context.ts | txStorage} so that every `db()` call down the
 * stack joins the SAME transaction without signature changes.
 *
 * **Nesting:** a nested `withTransaction()` (or a legacy `db().transaction()`
 * on a patched request handle) REUSES the active transaction instead of
 * opening a second one — a nested COMMIT would prematurely commit the outer
 * transaction (see the note in middleware/transaction-context.ts).
 *
 * **Side effects:** commit happens only after the callback resolves. Schedule
 * WhatsApp / e-mail / TV / board notifications AFTER `withTransaction()`
 * resolves: anything floated inside the callback inherits the store and would
 * run on a rolled-back (dead) handle.
 *
 * @module shared/database/transaction
 */

import { db } from "./drizzle.js";
import { getRequestDb, type RequestDbContext } from "./request-context.js";
import { currentTx, runInTransaction, type DbHandle } from "./tx-context.js";

type MaybeTx = { transaction?: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };
type PinnedSql = { (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown> };

/**
 * Runs `fn` inside a single database transaction and returns its result.
 *
 * @param fn - Callback receiving the transaction-bound Drizzle instance
 * @returns The callback result
 * @throws Any error thrown by `fn` — the transaction is rolled back first
 * @example
 * ```ts
 * const orden = await withTransaction(async () => {
 *   await updateOrdenStatusInTx(id, status, tenantSlug);
 *   await consumeStockOnOTClose(id, tenantSlug); // joins via db()
 *   return loadOrden(id);
 * }); // COMMIT aquí — los efectos no críticos van DESPUÉS
 * ```
 */
export async function withTransaction<T>(fn: (tx: DbHandle) => Promise<T>): Promise<T> {
  // 1) Already inside a transaction → reuse it (nesting-safe, no COMMIT here).
  const active = currentTx();
  if (active) return fn(active);

  // 2) Per-request pinned connection → manual BEGIN/COMMIT on that connection.
  const ctx = getRequestDb();
  if (ctx && !ctx.released && ctx.tx) return pinnedTransaction(ctx, fn);

  // 3) Singleton pool (or a `vi.mock`ed `db()` in unit tests) → drizzle's own
  //    transaction. A mock without `.transaction` degrades to a plain call:
  //    unit tests assert on the mock, not on real atomicity.
  const handle = db() as unknown as MaybeTx;
  if (typeof handle.transaction !== "function") {
    return fn(handle as unknown as DbHandle);
  }
  return handle.transaction((tx) =>
    runInTransaction(tx as DbHandle, () => fn(tx as DbHandle)),
  );
}

/**
 * Manual transaction over the reserved per-request connection.
 *
 * The reserved handle is pinned to one physical connection, so a plain
 * `BEGIN` applies to every query issued through `ctx.drizzle` until
 * `COMMIT` / `ROLLBACK`.
 */
async function pinnedTransaction<T>(
  ctx: RequestDbContext,
  fn: (tx: DbHandle) => Promise<T>,
): Promise<T> {
  const raw = ctx.tx as unknown as PinnedSql;
  await raw`BEGIN`;
  try {
    const result = await runInTransaction(ctx.drizzle, () => fn(ctx.drizzle));
    await raw`COMMIT`;
    return result;
  } catch (error) {
    try {
      await raw`ROLLBACK`;
    } catch {
      // Connection may already be broken — the pool discards it anyway.
    }
    throw error;
  }
}

const PATCHED = Symbol.for("automotiveos.pinnedTransaction");

/**
 * Patches the per-request Drizzle instance so its `transaction()` method works
 * on the reserved connection (postgres.js `reserve()` has no `.begin()`) and
 * honours the active-transaction rules.
 *
 * Called once per request by `registerRequestTransactions()`. Every legacy
 * `db().transaction(async (tx) => …)` call site — invoice, payment, treasury,
 * accounting closure, almacen — therefore keeps working inside a request,
 * and nests safely under `withTransaction()`.
 *
 * @param ctx - Request DB context created by the transaction-context middleware
 */
export function patchPinnedTransaction(ctx: RequestDbContext): void {
  const handle = ctx.drizzle as unknown as Record<PropertyKey, unknown> & MaybeTx;
  if (!handle || handle[PATCHED]) return;
  Object.defineProperty(handle, "transaction", {
    configurable: true,
    writable: true,
    value: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
      withTransaction(fn as (tx: DbHandle) => Promise<T>),
  });
  Object.defineProperty(handle, PATCHED, { value: true });
}
