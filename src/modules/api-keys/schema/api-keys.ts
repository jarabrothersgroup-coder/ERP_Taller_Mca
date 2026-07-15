/**
 * API Keys schema — External API access management for SaaS tenants.
 *
 * Each tenant can generate multiple API keys with different permissions
 * and rate limits. Keys are hashed (SHA-256) before storage.
 *
 * @module api-keys/schema
 */

import { pgTable, text, timestamp, uuid, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";

/**
 * API Keys table — stores hashed API keys for external access.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** Tenant this key belongs to */
    tenantSlug: text("tenant_slug").notNull(),

    /** Human-readable key name (e.g., "Production Integration") */
    name: text("name").notNull(),

    /** SHA-256 hash of the API key (never store plain text) */
    keyHash: text("key_hash").notNull(),

    /** Last 4 chars of the key for display purposes */
    keyPrefix: text("key_prefix").notNull(),

    /** Permission scopes (e.g., ["read:workshop", "write:inventory"]) */
    scopes: jsonb("scopes").$type<string[]>().notNull().default(["read"]),

    /** Rate limit override (requests per minute). Null = use tenant default */
    rateLimit: integer("rate_limit"),

    /** Maximum requests per day. Null = unlimited */
    dailyLimit: integer("daily_limit"),

    /** IP whitelist. Empty array = allow all IPs */
    ipWhitelist: jsonb("ip_whitelist").$type<string[]>().notNull().default([]),

    /** Whether the key is currently active */
    isActive: boolean("is_active").notNull().default(true),

    /** When this key was last used */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

    /** Total number of times this key has been used */
    usageCount: integer("usage_count").notNull().default(0),

    /** When this key expires. Null = never expires */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** When this key was created */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    /** When this key was last updated */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_api_keys_tenant").on(table.tenantSlug),
    index("idx_api_keys_hash").on(table.keyHash),
    index("idx_api_keys_active").on(table.isActive),
    index("idx_api_keys_expires").on(table.expiresAt),
  ]
);

/**
 * API Usage Log table — tracks API key usage for analytics.
 */
export const apiKeyUsageLog = pgTable(
  "api_key_usage_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    apiKeyId: uuid("api_key_id").notNull(),
    tenantSlug: text("tenant_slug").notNull(),
    endpoint: text("endpoint").notNull(),
    method: text("method").notNull(),
    statusCode: integer("status_code").notNull(),
    responseTimeMs: integer("response_time_ms"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_api_usage_key_id").on(table.apiKeyId),
    index("idx_api_usage_tenant").on(table.tenantSlug),
    index("idx_api_usage_created").on(table.createdAt),
  ]
);

/**
 * Available permission scopes for API keys.
 */
export const API_SCOPES = {
  // Read scopes
  "read:workshop": "Read workshop data (clients, vehicles, orders)",
  "read:inventory": "Read inventory data (repuestos, herramientas)",
  "read:finance": "Read finance data (invoices, accounting)",
  "read:analytics": "Read analytics and reports",

  // Write scopes
  "write:workshop": "Write workshop data (create/edit clients, vehicles, orders)",
  "write:inventory": "Write inventory data (stock movements, items)",
  "write:finance": "Write finance data (invoices, payments)",

  // Admin scopes
  "admin:tenants": "Manage tenant configuration",
  "admin:users": "Manage user profiles and roles",
  "admin:api-keys": "Manage API keys",

  // Webhook scopes
  "webhooks:manage": "Register and manage webhooks",
} as const;

export type ApiScope = keyof typeof API_SCOPES;
