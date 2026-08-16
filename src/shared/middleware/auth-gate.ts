/**
 * Global Authentication Gate.
 *
 * Fastify preHandler hook that REJECTS unauthenticated requests on every
 * route EXCEPT a curated allowlist of public endpoints.
 *
 * Why this exists:
 *   Most modules registered only `resolveTenant` + `resolveProfile`, and
 *   `resolveProfile` silently passes for unauthenticated requests. That meant
 *   the whole API surface (finance, workshop, inventory, …) was reachable by
 *   anyone who sent an `X-Tenant-Slug` header — a full authentication bypass.
 *
 * This hook closes the gap centrally:
 *   1. Public paths (login, health probes, webhooks, client portal, TV, static
 *      SPA assets, onboarding, …) are allowed through.
 *   2. Everything else must resolve a verified user profile; otherwise the
 *      request is rejected with 401.
 *
 * The profile resolution is done here (not relying on per-plugin hooks) so the
 * enforcement is uniform even for modules that never registered
 * `resolveProfile` themselves.
 *
 * @see src/shared/middleware/rbac.ts — resolveProfile / requireAuth
 * @module shared/middleware/auth-gate
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { resolveProfile } from "./rbac.js";
import { UnauthorizedError } from "../errors/app-error.js";

/** Static assets of the legacy SPA served by the Visual plugin (public). */
const STATIC_ASSET_RE = /\.(html?|js|css|svg|png|jpe?g|gif|ico|json|webp|woff2?|ttf|map|txt)$/i;

/** Public endpoints — reachable without authentication. */
const PUBLIC_PATHS = [
  // Health probes (used by Docker/Podman/K8s healthchecks)
  "/health/live",
  "/health/ready",
  "/health/modules",
  "/health/deep",
  // Auth (login/logout) + onboarding (tenant + admin creation)
  "/api/auth/",
  "/api/onboarding/",
  // Landing page lead capture
  "/api/lead",
  // Payment provider webhooks (Stripe/PagosPy don't send JWT)
  "/finance/payments/webhook",
  // Client portal (own magic-link / PIN auth)
  "/portal/",
  // TV display + status (public by design)
  "/api/v1/visual/",
  // Legacy SPA entry points (login handled client-side)
  "/dashboard",
  "/app.js",
  "/landing",
  // Developer portal + Swagger docs
  "/developer",
  "/docs",
  // External integrations (Evolution API inbound webhook, public booking)
  "/scheduling/webhook/whatsapp",
  "/scheduling/ai-suggestions",
  "/scheduling/check-availability",
  // Mobile app probe
  "/mobile/health",
  // Reports service probe
  "/reports/health",
  // Prometheus metrics (scraped by infra without JWT — TODO: protect with
  // network ACL / basic auth in production)
  "/metrics",
];

/**
 * Segment-boundary prefix match: `/health/live` matches `/health/live` and
 * `/health/live/x`, but NOT `/health/liverpool`. Prefixes that already end in
 * `/` (e.g. `/api/auth/`) are handled without duplicating the separator.
 */
function matchesPrefix(path: string, prefix: string): boolean {
  if (path === prefix) return true;
  const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return path.startsWith(`${base}/`);
}

/** True when the request path is public (exact/prefix match or static asset). */
export function isPublicRoute(path: string): boolean {
  const url = path.split("?")[0] ?? path;
  if (STATIC_ASSET_RE.test(url)) return true;
  return PUBLIC_PATHS.some((p) => matchesPrefix(url, p));
}

/**
 * Fastify preHandler hook — global authentication enforcement.
 *
 * Must run AFTER the per-plugin `onRequest` hooks that resolve the tenant
 * (`resolveTenant`), so `request.tenantSlug` is available for the
 * tenant-scoped profile lookup inside `resolveProfile`.
 */
export async function authGate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (isPublicRoute(request.url)) return;

  // Resolve the user profile only when it wasn't already resolved by a
  // module-level onRequest hook.
  if (!request.profile) {
    await resolveProfile(request, reply);
  }

  if (!request.profile) {
    throw new UnauthorizedError("Autenticación requerida. Inicie sesión.");
  }
}
