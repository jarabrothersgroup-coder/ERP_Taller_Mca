/**
 * Active-transaction context (Fase 3 · auditoría 2026-09-25 · T-31/T-32).
 *
 * `db()` is the single query entry point of the whole backend. Carrying the
 * active transaction in an AsyncLocalStorage lets every service — including
 * deep ones like the accounting bus (`emit`/`createAsiento`) — join the SAME
 * transaction without threading a `tx` parameter through dozens of signatures.
 *
 * Rules:
 *   - Only `withTransaction()` (shared/database/drizzle.ts) opens a
 *     transaction and installs the store.
 *   - Nested `withTransaction()` calls REUSE the active transaction instead of
 *     opening a second one: a nested COMMIT would prematurely commit the outer
 *     transaction (see the note in middleware/transaction-context.ts).
 *   - Side effects that must survive a rollback (WhatsApp, email, TV, board
 *     ping) have to be scheduled AFTER `withTransaction()` resolves — anything
 *     floated inside inherits this store and would run on a dead transaction.
 *
 * @see src/shared/database/drizzle.ts
 * @module shared/database/tx-context
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { DbSchema } from "./drizzle.js";

/** Drizzle instance bound to a transaction (or the request connection). */
export type DbHandle = PostgresJsDatabase<DbSchema>;

/** AsyncLocalStorage carrying the active transaction-bound Drizzle instance. */
export const txStorage = new AsyncLocalStorage<DbHandle>();

/** Returns the active transaction handle, or `undefined` outside one. */
export function currentTx(): DbHandle | undefined {
  return txStorage.getStore();
}

/** True while executing inside `withTransaction()`. */
export function inTransaction(): boolean {
  return txStorage.getStore() !== undefined;
}

/** Runs `fn` with `tx` installed as the active transaction handle. */
export function runInTransaction<T>(tx: DbHandle, fn: () => Promise<T>): Promise<T> {
  return txStorage.run(tx, fn);
}
