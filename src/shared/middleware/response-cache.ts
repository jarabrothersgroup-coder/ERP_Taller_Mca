/**
 * Response Cache Middleware — in-memory GET response caching.
 *
 * Caches GET responses for a configurable TTL to reduce database
 * and computation load on frequently accessed endpoints.
 *
 * Features:
 *   - Configurable TTL per route (default 60s)
 *   - Cache key: URL path + query string + tenant slug
 *   - Auto-invalidation on non-GET requests to same base path
 *   - Max 500 entries with LRU eviction
 *   - Skips caching when Cache-Control: no-store is set
 *
 * @module shared/middleware/response-cache
 */

import type { FastifyRequest, FastifyReply } from "fastify";

// ─── Cache store ────────────────────────────────

interface CacheEntry {
  data: string;
  contentType: string;
  statusCode: number;
  expiry: number;
  lastAccessed: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 500;

// ─── Helpers ────────────────────────────────────

/**
 * Evicts the oldest entry when cache exceeds max size.
 */
function evictOldest(): void {
  if (cache.size <= MAX_CACHE_SIZE) return;

  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of cache) {
    if (entry.lastAccessed < oldestTime) {
      oldestTime = entry.lastAccessed;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    cache.delete(oldestKey);
  }
}

/**
 * Builds a cache key from request properties.
 */
function buildCacheKey(request: FastifyRequest): string {
  const url = request.url;
  const tenant = request.tenantSlug ?? "default";
  return `${tenant}:${url}`;
}

/**
 * Extracts the base path from a URL (path without query params).
 */
function getBasePath(url: string): string {
  const idx = url.indexOf("?");
  return idx >= 0 ? url.substring(0, idx) : url;
}

// ─── Middleware factory ─────────────────────────

/**
 * Creates a response caching middleware for Fastify.
 *
 * @param ttlMs - Time-to-live in milliseconds (default: 60000 = 60s)
 * @returns Fastify preHandler hook
 *
 * @example
 * ```ts
 * app.get("/api/data", { preHandler: [createCacheMiddleware(30000)] }, handler);
 * ```
 */
export function createCacheMiddleware(ttlMs: number = 60_000) {
  return async function cacheHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Only cache GET requests
    if (request.method !== "GET") {
      // Invalidate cache for this base path on any non-GET request
      const basePath = getBasePath(request.url);
      const tenant = request.tenantSlug ?? "default";
      const prefix = `${tenant}:${basePath}`;
      for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
          cache.delete(key);
        }
      }
      return;
    }

    // Check if response should not be cached
    const cacheControl = reply.getHeader("cache-control");
    if (typeof cacheControl === "string" && cacheControl.includes("no-store")) {
      return;
    }

    // Check cache
    const cacheKey = buildCacheKey(request);
    const entry = cache.get(cacheKey);

    if (entry && Date.now() < entry.expiry) {
      // Cache hit
      entry.lastAccessed = Date.now();
      reply.code(entry.statusCode).header("content-type", entry.contentType);
      reply.send(entry.data);
      return;
    }

    // Cache miss — intercept response to cache it
    const originalSend = reply.send.bind(reply);

    reply.send = function (data: unknown) {
      // Only cache successful responses
      if (reply.statusCode >= 200 && reply.statusCode < 300 && typeof data === "string") {
        evictOldest();
        cache.set(cacheKey, {
          data,
          contentType: reply.getHeader("content-type") as string ?? "application/json",
          statusCode: reply.statusCode,
          expiry: Date.now() + ttlMs,
          lastAccessed: Date.now(),
        });
      }

      return originalSend(data);
    };
  };
}

/**
 * Clears the entire response cache.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Returns cache statistics.
 */
export function getCacheStats(): { size: number; maxSize: number; hitRate: number } {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    hitRate: 0, // TODO: track hits/misses for observability
  };
}
