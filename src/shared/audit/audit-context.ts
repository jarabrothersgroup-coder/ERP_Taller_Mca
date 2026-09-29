/**
 * Audit actor context (Fase 3 · T-33).
 *
 * Services never receive the Fastify `request`, yet the audit log must record
 * **who** performed a change. This AsyncLocalStorage carries the actor
 * (profile id + client IP) from a root `preHandler` — registered right after
 * the global auth gate — down to every service call of that request.
 *
 * Outside a request (cron, CLI, background jobs) there is no actor: the
 * resolved fallback is `system`, matching the convention already used by the
 * accounting bus.
 *
 * @see src/modules/finance/services/accounting/audit-log.service.ts (logEntityAudit)
 * @module shared/audit/audit-context
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance, FastifyRequest } from "fastify";

/** Who is performing the current operation. */
export interface AuditActor {
  /** Profile id (`request.profile.id`) or `system` / `anonymous`. */
  usuarioId: string;
  /** Client IP, when known. */
  ip: string | null;
}

const auditActorStorage = new AsyncLocalStorage<AuditActor>();

/** Returns the actor of the current execution context, if any. */
export function getAuditActor(): AuditActor | undefined {
  return auditActorStorage.getStore();
}

/**
 * Returns the actor of the current execution context, falling back to
 * `system` when running outside a request (cron/CLI/background jobs).
 */
export function resolveAuditActor(): AuditActor {
  return auditActorStorage.getStore() ?? { usuarioId: "system", ip: null };
}

/**
 * True when the current actor is an actual authenticated profile.
 *
 * The audit log stores `usuarioId` as a real profile id, so the synthetic
 * fallbacks (`system`, `anonymous`) must never be written to columns that
 * carry a FK to `profiles`. Use it to decide between persisting the actor and
 * storing NULL (audit rows tolerate NULL) or `system` (rows that don't).
 */
export function isRealActor(usuarioId: string | null | undefined): boolean {
  return (
    !!usuarioId && usuarioId !== "system" && usuarioId !== "anonymous"
  );
}

/**
 * Registers the root `preHandler` that publishes the audit actor.
 *
 * MUST be registered after `authGate` (which resolves `request.profile`) and
 * MUST call `enterWith` synchronously — before any `await` — for the store to
 * be visible to the route handler (same constraint documented in
 * shared/middleware/transaction-context.ts).
 *
 * @param app - Fastify instance
 */
export function registerAuditContext(app: FastifyInstance): void {
  app.addHook("preHandler", async (request: FastifyRequest) => {
    auditActorStorage.enterWith({
      usuarioId: request.profile?.id ?? "anonymous",
      ip: request.ip ?? null,
    });
  });
}
