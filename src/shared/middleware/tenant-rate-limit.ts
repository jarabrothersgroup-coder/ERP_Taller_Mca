/**
 * Tenant Rate Limiting Middleware — per-tenant rate limiting with API key support.
 *
 * Applies different rate limits based on:
 * 1. API key's custom rate limit (if set)
 * 2. Tenant's configured rate limit
 * 3. Global default (200 req/min)
 *
 * @module shared/middleware/tenant-rate-limit
 */

import type { FastifyRequest, FastifyReply } from "fastify";

// ─── In-Memory Rate Limiter (per-tenant, per-IP) ────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

// ─── Rate Limit Configuration ───────────────────────────────────────────

interface RateLimitConfig {
  /** Maximum requests per window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  max: 200,
  windowMs: 60 * 1000, // 1 minute
};

// ─── Exempt Paths (no rate limiting) ────────────────────────────────────

const EXEMPT_PATHS = ["/health", "/docs", "/swagger", "/security/hw/status"];

// ─── Middleware ──────────────────────────────────────────────────────────

/**
 * Tenant-aware rate limiting hook.
 *
 * Usage:
 *   app.addHook('onRequest', tenantRateLimit());
 *   app.addHook('onRequest', tenantRateLimit({ max: 100, windowMs: 60000 }));
 */
export function tenantRateLimit(config?: Partial<RateLimitConfig>) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return async function rateLimitHook(request: FastifyRequest, reply: FastifyReply) {
    // Skip exempt paths
    if (EXEMPT_PATHS.some((p) => request.url.startsWith(p))) {
      return;
    }

    // Get tenant and client identifiers
    const tenantSlug = (request as any).tenantSlug || "anonymous";
    const clientIp = request.ip || (request.headers["x-forwarded-for"] as string) || "unknown";
    const apiKeyId = (request as any).apiKeyId;

    // Build rate limit key (tenant + IP or API key)
    const rateLimitKey = apiKeyId
      ? `apikey:${apiKeyId}`
      : `tenant:${tenantSlug}:ip:${clientIp}`;

    // Check rate limit
    const now = Date.now();
    const entry = rateLimitStore.get(rateLimitKey);

    if (entry && entry.resetAt > now) {
      // Within the window
      entry.count++;

      if (entry.count > cfg.max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        reply.header("Retry-After", retryAfter);
        reply.header("X-RateLimit-Limit", cfg.max);
        reply.header("X-RateLimit-Remaining", 0);
        reply.header("X-RateLimit-Reset", new Date(entry.resetAt).toISOString());

        return reply.status(429).send({
          error: "TooManyRequests",
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          retryAfter,
        });
      }
    } else {
      // New window
      rateLimitStore.set(rateLimitKey, {
        count: 1,
        resetAt: now + cfg.windowMs,
      });
    }

    // Set rate limit headers
    const current = rateLimitStore.get(rateLimitKey);
    if (current) {
      reply.header("X-RateLimit-Limit", cfg.max);
      reply.header("X-RateLimit-Remaining", Math.max(0, cfg.max - current.count));
      reply.header("X-RateLimit-Reset", new Date(current.resetAt).toISOString());
    }
  };
}

/**
 * Get current rate limit status for a key.
 */
export function getRateLimitStatus(key: string): {
  count: number;
  remaining: number;
  resetAt: Date;
} | null {
  const entry = rateLimitStore.get(key);
  if (!entry || entry.resetAt < Date.now()) {
    return null;
  }

  return {
    count: entry.count,
    remaining: Math.max(0, DEFAULT_CONFIG.max - entry.count),
    resetAt: new Date(entry.resetAt),
  };
}

/**
 * Reset rate limit for a key.
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}
