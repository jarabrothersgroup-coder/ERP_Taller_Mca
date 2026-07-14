/**
 * Authentication enforcement middleware.
 *
 * Unlike resolveProfile (which allows unauthenticated routes),
 * requireAuth REJECTS requests without a valid token.
 *
 * Use on routes that MUST have an authenticated user:
 *   - All CRUD operations
 *   - Dashboard data
 *   - Billing/subscription
 *
 * Do NOT use on:
 *   - Login/register endpoints
 *   - Health checks
 *   - Public portal routes
 *   - Webhook receivers (Stripe, WhatsApp)
 *
 * @module shared/middleware/require-auth
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { UnauthorizedError } from "../errors/app-error.js";

/**
 * Fastify preHandler hook that rejects unauthenticated requests.
 *
 * Must run AFTER resolveProfile (which populates request.profile).
 * If no profile was resolved, the request is rejected.
 */
export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!request.profile) {
    throw new UnauthorizedError("Autenticación requerida. Inicie sesión.");
  }
}

/**
 * Convenience: require auth + specific role.
 *
 * @param allowedRoles - Minimum role(s) required
 */
export function requireAuthAndRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.profile) {
      throw new UnauthorizedError("Autenticación requerida. Inicie sesión.");
    }

    const ROLE_HIERARCHY: Record<string, number> = {
      user: 0,
      mechanic: 1,
      manager: 2,
      admin: 3,
    };

    const userLevel = ROLE_HIERARCHY[request.profile.role] ?? -1;
    const minRequired = Math.min(...allowedRoles.map((r) => ROLE_HIERARCHY[r] ?? 99));

    if (userLevel < minRequired) {
      throw new UnauthorizedError("Acceso denegado: rol insuficiente");
    }
  };
}
