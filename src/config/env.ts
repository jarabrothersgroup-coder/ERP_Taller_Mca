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
  /** PostgreSQL connection string (local or remote) */
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
  /** Allowed CORS origin (production) */
  CORS_ORIGIN: string;

  /** JWT signing secret (required in production) */
  JWT_SECRET: string;

  /** Local filesystem storage path for uploads (DVI photos, etc.) */
  STORAGE_PATH: string;

  // ─── SIFEN / DNIT Configuration ────────────
  /** Path to SIFEN PKCS#12 (.p12) certificate file */
  SIFEN_CERT_PATH: string;
  /** Password for the SIFEN certificate */
  SIFEN_CERT_PASS: string;
  /** Whether to use SIFEN test/homologation endpoint */
  SIFEN_USE_TEST: boolean;
  /** SIFEN production SOAP endpoint URL (optional override) */
  SIFEN_PROD_URL: string;
  /** SIFEN test SOAP endpoint URL (optional override) */
  SIFEN_TEST_URL: string;

  // ─── RAG / OpenAI ──────────────────────────
  /** OpenAI API key for embedding generation (RAG system) */
  OPENAI_API_KEY: string;

  // ─── WhatsApp / Evolution API ──────────────
  /** Evolution API base URL (e.g., http://localhost:8080) */
  WHATSAPP_API_URL: string;
  /** Evolution API authentication key */
  WHATSAPP_API_KEY: string;

  // ─── Twenty CRM ───────────────────────────
  /** Twenty CRM REST API base URL */
  TWENTY_API_URL: string;
  /** Twenty CRM API key (Settings → API Keys) */
  TWENTY_API_KEY: string;
  /** Twenty CRM GraphQL endpoint */
  TWENTY_GRAPHQL_URL: string;
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
  CORS_ORIGIN: process.env["CORS_ORIGIN"] ?? "",

  // JWT auth
  JWT_SECRET: process.env["JWT_SECRET"] ?? "",

  // Local storage
  STORAGE_PATH: process.env["STORAGE_PATH"] || "/data/erp-storage",

  // SIFEN defaults (optional, not requireEnv to allow offline dev)
  SIFEN_CERT_PATH: process.env["SIFEN_CERT_PATH"] ?? "",
  SIFEN_CERT_PASS: process.env["SIFEN_CERT_PASS"] ?? "",
  SIFEN_USE_TEST: process.env["SIFEN_USE_TEST"] === "true" || true,
  SIFEN_PROD_URL: process.env["SIFEN_PROD_URL"] ?? "https://sifen.dnit.gov.py/sifen-ws",
  SIFEN_TEST_URL: process.env["SIFEN_TEST_URL"] ?? "https://sifen-test.dnit.gov.py/sifen-ws",

  // RAG defaults (optional — fallback to ILIKE search)
  OPENAI_API_KEY: process.env["OPENAI_API_KEY"] ?? "",

  // ─── WhatsApp / Evolution API ──────────────
  WHATSAPP_API_URL: process.env["WHATSAPP_API_URL"] || "http://localhost:8080",
  WHATSAPP_API_KEY: process.env["WHATSAPP_API_KEY"] ?? "",

  // ─── Twenty CRM ───────────────────────────
  TWENTY_API_URL: process.env["TWENTY_API_URL"] || "http://localhost:3001",
  TWENTY_API_KEY: process.env["TWENTY_API_KEY"] ?? "",
  TWENTY_GRAPHQL_URL: process.env["TWENTY_GRAPHQL_URL"] || "",
};
