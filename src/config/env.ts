/**
 * Environment configuration loader.
 *
 * Reads and validates all required environment variables at startup.
 * Uses dotenv to load from .env in development.
 *
 * @module config/env
 */

import dotenv from "dotenv";

// Load .env in non-production environments
if (process.env["NODE_ENV"] !== "production") {
  dotenv.config();
}

interface EnvConfig {
  /** Remote PostgreSQL connection string (Neon/Supabase) */
  DATABASE_URL: string;
  /** HTTP server port */
  PORT: number;
  /** HTTP server host */
  HOST: string;
  /** Current runtime environment */
  NODE_ENV: "development" | "production" | "test";
  /** Prefix for tenant PostgreSQL schemas */
  TENANT_SCHEMA_PREFIX: string;
  /** Background sync interval in ms (offline-first) */
  SYNC_INTERVAL_MS: number;
  /** Pino log level */
  LOG_LEVEL: string;
}

/**
 * Validates that a required env variable is present.
 * @throws {Error} if the variable is missing in production
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value && process.env["NODE_ENV"] === "production") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value ?? "";
}

/**
 * Parsed and validated environment configuration.
 */
export const env: EnvConfig = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  PORT: parseInt(process.env["PORT"] ?? "3000", 10),
  HOST: process.env["HOST"] ?? "0.0.0.0",
  NODE_ENV: (process.env["NODE_ENV"] as EnvConfig["NODE_ENV"]) ?? "development",
  TENANT_SCHEMA_PREFIX: process.env["TENANT_SCHEMA_PREFIX"] ?? "tenant_",
  SYNC_INTERVAL_MS: parseInt(process.env["SYNC_INTERVAL_MS"] ?? "30000", 10),
  LOG_LEVEL: process.env["LOG_LEVEL"] ?? "info",
};
