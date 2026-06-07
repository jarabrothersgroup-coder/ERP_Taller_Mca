/**
 * Multi-Tenant resolver middleware.
 *
 * Extracts the tenant context from the request and attaches it to
 * the Fastify request instance for downstream route handlers.
 *
 * Strategy: Header-based tenant resolution (`X-Tenant-Slug`)
 * Falls back to subdomain-based resolution for future use.
 *
 * @module shared/middleware/tenant-resolver
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { ForbiddenError } from "../errors/app-error.js";

/**
 * Decorates Fastify request with tenant context.
 */
declare module "fastify" {
  interface FastifyRequest {
    /** Resolved tenant slug for the current request */
    tenantSlug: string;
  }
}

/**
 * Fastify hook that resolves the tenant from the request.
 *
 * Expected header: `X-Tenant-Slug: taller-el-chero`
 *
 * @param request - Fastify request object
 * @param _reply - Fastify reply object
 */
export async function resolveTenant(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const tenantSlug =
    request.headers["x-tenant-slug"] as string | undefined;

  if (!tenantSlug) {
    throw new ForbiddenError(
      "Tenant not identified. Provide X-Tenant-Slug header.",
    );
  }

  // Validate slug format (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantSlug)) {
    throw new ForbiddenError("Invalid tenant slug format.");
  }

  request.tenantSlug = tenantSlug;
}
