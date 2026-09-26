/**
 * Canonical Fastify request augmentation — AutomotiveOS.
 *
 * Single source of truth for properties attached to the request by
 * middleware (tenant-resolver, rbac, api-keys). Do NOT re-declare these
 * in other modules: interface merging duplicates caused the drift that
 * forced ~130 `(request as any)` casts across route handlers.
 *
 * @module types/fastify-request
 */

// File must be a module (not a global script) so `declare module "fastify"`
// below AUGMENTS the package types instead of replacing them.
import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    /**
     * Resolved tenant slug for the current request.
     * Set by shared/middleware/tenant-resolver.ts (X-Tenant-Slug header,
     * custom domain or subdomain). Always defined after that hook runs.
     */
    tenantSlug: string;

    /**
     * Authenticated user email (set by auth/rbac hooks when a profile
     * is resolved). Optional: public/unauthenticated routes never set it.
     */
    userEmail?: string;

    /**
     * API key id when the request authenticated via X-API-Key
     * (set by the api-keys auth path). Optional.
     */
    apiKeyId?: string;
  }
}
