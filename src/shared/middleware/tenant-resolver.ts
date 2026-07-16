/**
 * Multi-Tenant resolver middleware.
 *
 * Extracts the tenant context from the request and attaches it to
 * the Fastify request instance for downstream route handlers.
 *
 * Resolution strategy (in priority order):
 *   1. Header `X-Tenant-Slug` — explicit, for API clients / tests.
 *   2. Custom domain — `Host` header matched against
 *      `white_label_config.custom_domain` (e.g. taller.com).
 *   3. Subdomain — first label of the host (e.g. `taller-el-chero.app.com`
 *      → slug `taller-el-chero`). Ignores www/api/app.
 *
 * @module shared/middleware/tenant-resolver
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { ForbiddenError } from "../errors/app-error.js";
import { eq } from "drizzle-orm";
import { db } from "../database/drizzle.js";
import { whiteLabelConfig } from "../database/schema/index.js";

/**
 * Decorates Fastify request with tenant context.
 */
declare module "fastify" {
  interface FastifyRequest {
    /** Resolved tenant slug for the current request */
    tenantSlug: string;
  }
}

const SLUG_RE = /^[a-zA-Z0-9_-]+$/;

/** Subdomains that are platform-level, not tenant slugs. */
const RESERVED_SUBDOMAINS = new Set(["www", "api", "app", "admin", "mail"]);

/**
 * Resolve the tenant slug from a hostname.
 *
 * Tries custom domain lookup first, then falls back to subdomain parsing.
 * Returns null when no tenant can be derived from the host.
 */
async function resolveSlugFromHost(host: string): Promise<string | null> {
  const hostname = host.split(":")[0]!.toLowerCase();

  // 1. Custom domain → white_label_config.custom_domain
  try {
    const rows = await db()
      .select({ tenantSlug: whiteLabelConfig.tenantSlug })
      .from(whiteLabelConfig)
      .where(eq(whiteLabelConfig.customDomain, hostname))
      .limit(1);
    if (rows.length > 0 && rows[0]!.tenantSlug) {
      return rows[0]!.tenantSlug;
    }
  } catch {
    // DB unavailable — fall through to subdomain parsing
  }

  // 2. Subdomain → first label (taller-el-chero.app.com → taller-el-chero)
  const parts = hostname.split(".");
  if (parts.length > 2) {
    const sub = parts[0]!;
    if (sub && !RESERVED_SUBDOMAINS.has(sub) && SLUG_RE.test(sub)) {
      return sub;
    }
  }

  return null;
}

/**
 * Fastify hook that resolves the tenant from the request.
 *
 * Priority: `X-Tenant-Slug` header → custom domain → subdomain.
 *
 * @param request - Fastify request object
 * @param _reply - Fastify reply object
 */
export async function resolveTenant(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  // 1. Explicit header (highest priority)
  const headerSlug = request.headers["x-tenant-slug"] as string | undefined;
  if (headerSlug) {
    if (!SLUG_RE.test(headerSlug)) {
      throw new ForbiddenError("Invalid tenant slug format.");
    }
    request.tenantSlug = headerSlug;
    return;
  }

  // 2 + 3. Hostname-based resolution (custom domain, then subdomain)
  const host =
    (request.headers["host"] as string | undefined) ?? request.hostname;
  if (host) {
    const slug = await resolveSlugFromHost(host);
    if (slug) {
      request.tenantSlug = slug;
      return;
    }
  }

  throw new ForbiddenError(
    "Tenant not identified. Provide X-Tenant-Slug header or use a configured domain/subdomain.",
  );
}
