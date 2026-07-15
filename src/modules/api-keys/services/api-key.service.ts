/**
 * API Key Management Service — CRUD operations, hashing, and validation.
 *
 * API keys are hashed with SHA-256 before storage. The raw key is only
 * returned once at creation time. Subsequent operations use the hash.
 *
 * @module api-keys/services/api-key.service
 */

import { eq, and, gt, sql, desc } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { apiKeys, apiKeyUsageLog, type ApiScope } from "../schema/api-keys.js";
import crypto from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────

export interface CreateApiKeyInput {
  tenantSlug: string;
  name: string;
  scopes?: ApiScope[];
  rateLimit?: number | null;
  dailyLimit?: number | null;
  ipWhitelist?: string[];
  expiresAt?: Date | null;
}

export interface ApiKeyResult {
  id: string;
  name: string;
  /** The raw API key — only returned at creation time */
  apiKey: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number | null;
  dailyLimit: number | null;
  ipWhitelist: string[];
  isActive: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number | null;
  dailyLimit: number | null;
  ipWhitelist: string[];
  isActive: boolean;
  lastUsedAt: Date | null;
  usageCount: number;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface UsageStats {
  totalRequests: number;
  requestsToday: number;
  avgResponseTimeMs: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  errorRate: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure API key.
 * Format: `aos_live_` (8 chars random) + `_` + (8 chars random)
 * Total: 25 chars including prefix
 */
function generateApiKey(): string {
  const part1 = crypto.randomBytes(6).toString("base64url");
  const part2 = crypto.randomBytes(6).toString("base64url");
  return `aos_live_${part1}_${part2}`;
}

/**
 * Hash an API key with SHA-256.
 */
function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Get the last 4 characters of an API key for display.
 */
function getKeyPrefix(key: string): string {
  return key.slice(-4);
}

// ─── Service Functions ──────────────────────────────────────────────────

/**
 * Create a new API key. Returns the raw key only this once.
 */
export async function createApiKey(input: CreateApiKeyInput): Promise<ApiKeyResult> {
  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = getKeyPrefix(rawKey);

  const [created] = await db()
    .insert(apiKeys)
    .values({
      tenantSlug: input.tenantSlug,
      name: input.name,
      keyHash,
      keyPrefix,
      scopes: input.scopes ?? ["read"],
      rateLimit: input.rateLimit ?? null,
      dailyLimit: input.dailyLimit ?? null,
      ipWhitelist: input.ipWhitelist ?? [],
      expiresAt: input.expiresAt ?? null,
    })
    .returning();

  return {
    id: created.id,
    name: created.name,
    apiKey: rawKey,
    keyPrefix: created.keyPrefix,
    scopes: (created.scopes as string[]) ?? [],
    rateLimit: created.rateLimit,
    dailyLimit: created.dailyLimit,
    ipWhitelist: (created.ipWhitelist as string[]) ?? [],
    isActive: created.isActive,
    expiresAt: created.expiresAt,
    createdAt: created.createdAt,
  };
}

/**
 * List all API keys for a tenant (without exposing hashes).
 */
export async function listApiKeys(tenantSlug: string): Promise<ApiKeyInfo[]> {
  const keys = await db()
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.tenantSlug, tenantSlug))
    .orderBy(desc(apiKeys.createdAt));

  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scopes: (k.scopes as string[]) ?? [],
    rateLimit: k.rateLimit,
    dailyLimit: k.dailyLimit,
    ipWhitelist: (k.ipWhitelist as string[]) ?? [],
    isActive: k.isActive,
    lastUsedAt: k.lastUsedAt,
    usageCount: k.usageCount,
    expiresAt: k.expiresAt,
    createdAt: k.createdAt,
  }));
}

/**
 * Get a single API key by ID.
 */
export async function getApiKey(tenantSlug: string, keyId: string): Promise<ApiKeyInfo | null> {
  const [key] = await db()
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.tenantSlug, tenantSlug), eq(apiKeys.id, keyId)))
    .limit(1);

  if (!key) return null;

  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scopes: (key.scopes as string[]) ?? [],
    rateLimit: key.rateLimit,
    dailyLimit: key.dailyLimit,
    ipWhitelist: (key.ipWhitelist as string[]) ?? [],
    isActive: key.isActive,
    lastUsedAt: key.lastUsedAt,
    usageCount: key.usageCount,
    expiresAt: key.expiresAt,
    createdAt: key.createdAt,
  };
}

/**
 * Validate an API key and return its info. Checks:
 * - Key exists and is active
 * - Key is not expired
 * - IP is in whitelist (if whitelist is set)
 */
export async function validateApiKey(
  rawKey: string,
  clientIp?: string,
): Promise<{ valid: boolean; keyInfo?: ApiKeyInfo; error?: string }> {
  const keyHash = hashApiKey(rawKey);

  const [key] = await db()
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!key) {
    return { valid: false, error: "Invalid API key" };
  }

  if (!key.isActive) {
    return { valid: false, error: "API key is disabled" };
  }

  if (key.expiresAt && key.expiresAt < new Date()) {
    return { valid: false, error: "API key has expired" };
  }

  // Check IP whitelist
  const ipWhitelist = (key.ipWhitelist as string[]) ?? [];
  if (ipWhitelist.length > 0 && clientIp && !ipWhitelist.includes(clientIp)) {
    return { valid: false, error: "IP address not in whitelist" };
  }

  // Update usage stats (fire-and-forget)
  db()
    .update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      usageCount: sql`${apiKeys.usageCount} + 1`,
    })
    .where(eq(apiKeys.id, key.id))
    .catch(() => {}); // Don't block on analytics

  return {
    valid: true,
    keyInfo: {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: (key.scopes as string[]) ?? [],
      rateLimit: key.rateLimit,
      dailyLimit: key.dailyLimit,
      ipWhitelist: (key.ipWhitelist as string[]) ?? [],
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      usageCount: key.usageCount,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    },
  };
}

/**
 * Revoke (disable) an API key.
 */
export async function revokeApiKey(tenantSlug: string, keyId: string): Promise<boolean> {
  await db()
    .update(apiKeys)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(apiKeys.tenantSlug, tenantSlug), eq(apiKeys.id, keyId)));

  return true;
}

/**
 * Delete an API key permanently.
 */
export async function deleteApiKey(tenantSlug: string, keyId: string): Promise<boolean> {
  await db()
    .delete(apiKeys)
    .where(and(eq(apiKeys.tenantSlug, tenantSlug), eq(apiKeys.id, keyId)));

  return true;
}

/**
 * Get usage statistics for an API key.
 */
export async function getApiKeyUsage(
  tenantSlug: string,
  keyId: string,
): Promise<UsageStats> {
  // Total requests
  const [totalResult] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(apiKeyUsageLog)
    .where(and(eq(apiKeyUsageLog.tenantSlug, tenantSlug), eq(apiKeyUsageLog.apiKeyId, keyId)));

  // Requests today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [todayResult] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(apiKeyUsageLog)
    .where(
      and(
        eq(apiKeyUsageLog.tenantSlug, tenantSlug),
        eq(apiKeyUsageLog.apiKeyId, keyId),
        gt(apiKeyUsageLog.createdAt, today),
      ),
    );

  // Average response time
  const [avgResult] = await db()
    .select({
      avg: sql<number>`coalesce(avg(${apiKeyUsageLog.responseTimeMs}), 0)::int`,
    })
    .from(apiKeyUsageLog)
    .where(and(eq(apiKeyUsageLog.tenantSlug, tenantSlug), eq(apiKeyUsageLog.apiKeyId, keyId)));

  // Top endpoints
  const topEndpoints = await db()
    .select({
      endpoint: apiKeyUsageLog.endpoint,
      count: sql<number>`count(*)::int`,
    })
    .from(apiKeyUsageLog)
    .where(and(eq(apiKeyUsageLog.tenantSlug, tenantSlug), eq(apiKeyUsageLog.apiKeyId, keyId)))
    .groupBy(apiKeyUsageLog.endpoint)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  // Error rate (4xx + 5xx)
  const [errorResult] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(apiKeyUsageLog)
    .where(
      and(
        eq(apiKeyUsageLog.tenantSlug, tenantSlug),
        eq(apiKeyUsageLog.apiKeyId, keyId),
        gt(apiKeyUsageLog.statusCode, 399),
      ),
    );

  const total = totalResult?.count ?? 0;
  const errors = errorResult?.count ?? 0;

  return {
    totalRequests: total,
    requestsToday: todayResult?.count ?? 0,
    avgResponseTimeMs: avgResult?.avg ?? 0,
    topEndpoints: topEndpoints.map((e) => ({ endpoint: e.endpoint, count: e.count })),
    errorRate: total > 0 ? (errors / total) * 100 : 0,
  };
}

/**
 * Log an API key usage event.
 */
export async function logApiKeyUsage(params: {
  apiKeyId: string;
  tenantSlug: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs?: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await db()
    .insert(apiKeyUsageLog)
    .values({
      apiKeyId: params.apiKeyId,
      tenantSlug: params.tenantSlug,
      endpoint: params.endpoint,
      method: params.method,
      statusCode: params.statusCode,
      responseTimeMs: params.responseTimeMs,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    })
    .catch(() => {}); // Fire-and-forget
}
