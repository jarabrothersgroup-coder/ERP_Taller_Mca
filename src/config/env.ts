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

  /** When true, each request reserves a dedicated PostgreSQL connection and
   *  sets `app.current_tenant` session-scoped on it (overwritten every request
   *  and reset before release). This closes the pooled-connection RLS leak
   *  where a session-scoped setting on the shared singleton could carry a
   *  previous tenant into a later request. Off by default. */
  ENABLE_REQUEST_TENANT_CONTEXT: boolean;
  /** Prefix for tenant PostgreSQL schemas */
  TENANT_SCHEMA_PREFIX: string;
  /** Background sync interval in ms (offline-first) */
  SYNC_INTERVAL_MS: number;
  /** Pino log level */
  LOG_LEVEL: string;
  /** Application base URL (required in production — used in email templates, payment redirects, webhooks) */
  APP_URL: string;
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

  // ─── SET Configuration ─────────────────────
  /** Whether SET/SIFEN invoicing is enabled (true = production with valid cert) */
  SET_CONFIG: boolean;

  // ─── RAG / OpenAI ──────────────────────────
  /** OpenAI API key for embedding generation (RAG system) */
  OPENAI_API_KEY: string;

  // ─── Thinkcar Email Notifications ──────────
  /** Email user for Thinkcar SMTP alerts (e.g., Gmail address) */
  THINKCAR_EMAIL_USER: string;
  /** Email password for Thinkcar SMTP */
  THINKCAR_EMAIL_PASSWORD: string;
  /** Alert recipient email (defaults to THINKCAR_EMAIL_USER) */
  THINKCAR_ALERT_RECIPIENT: string;

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

  // ─── Clerk Auth ────────────────────────────────
  /** Clerk secret key for backend API calls */
  CLERK_SECRET_KEY: string;
  /** Clerk publishable key (used for JWKS fetching) */
  CLERK_PUBLISHABLE_KEY: string;
  /** Clerk issuer URL for JWT verification (e.g. "https://clerk.your-app.com") */
  CLERK_ISSUER: string;

  // ─── Stripe Billing ────────────────────────────
  /** Stripe secret key for API calls (required in production) */
  STRIPE_SECRET_KEY: string;
  /** Stripe webhook signing secret (required in production) */
  STRIPE_WEBHOOK_SECRET: string;

  // ─── Resend (Email) ────────────────────────────
  /** Resend API key for transactional email (required in production) */
  RESEND_API_KEY: string;

  // ─── PagosPy (Paraguay local payments) ─────────
  /** PagosPy API key for online payments */
  PAGOSPY_API_KEY: string;
  /** PagosPy API base URL */
  PAGOSPY_API_URL: string;
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
  ENABLE_REQUEST_TENANT_CONTEXT: process.env["ENABLE_REQUEST_TENANT_CONTEXT"] === "true",
  TENANT_SCHEMA_PREFIX: process.env["TENANT_SCHEMA_PREFIX"] ?? "tenant_",
  SYNC_INTERVAL_MS: parseInt(process.env["SYNC_INTERVAL_MS"] ?? "30000", 10),
  LOG_LEVEL: process.env["LOG_LEVEL"] ?? "info",
  CORS_ORIGIN: process.env["CORS_ORIGIN"] ?? "",

  // Application base URL (required in production for email/payment redirects)
  APP_URL: requireEnv("APP_URL"),

  // JWT auth — required in production (empty string allowed in dev/test)
  JWT_SECRET: requireEnv("JWT_SECRET"),

  // Local storage
  STORAGE_PATH: process.env["STORAGE_PATH"] || "/data/erp-storage",

  // SIFEN — required when SET_CONFIG=true
  SIFEN_CERT_PATH: process.env["SIFEN_CERT_PATH"] ?? "",
  SIFEN_CERT_PASS: process.env["SIFEN_CERT_PASS"] ?? "",
  SIFEN_USE_TEST: process.env["SIFEN_USE_TEST"] === "true" || true,
  SIFEN_PROD_URL: process.env["SIFEN_PROD_URL"] ?? "https://sifen.dnit.gov.py/sifen-ws",
  SIFEN_TEST_URL: process.env["SIFEN_TEST_URL"] ?? "https://sifen-test.dnit.gov.py/sifen-ws",

  // SET invoicing enabled (requires valid SIFEN cert in production)
  SET_CONFIG: process.env["SET_CONFIG"] === "true",

  // RAG defaults (optional — fallback to ILIKE search)
  OPENAI_API_KEY: process.env["OPENAI_API_KEY"] ?? "",

  // ─── Thinkcar Email — optional (alerts skipped if not configured) ──
  THINKCAR_EMAIL_USER: process.env["THINKCAR_EMAIL_USER"] ?? "",
  THINKCAR_EMAIL_PASSWORD: process.env["THINKCAR_EMAIL_PASSWORD"] ?? "",
  THINKCAR_ALERT_RECIPIENT: process.env["THINKCAR_ALERT_RECIPIENT"] ?? "",

  // ─── WhatsApp / Evolution API ──────────────
  WHATSAPP_API_URL: process.env["WHATSAPP_API_URL"] || "http://localhost:8080",
  WHATSAPP_API_KEY: process.env["WHATSAPP_API_KEY"] ?? "",

  // ─── Twenty CRM ───────────────────────────
  TWENTY_API_URL: process.env["TWENTY_API_URL"] || "http://localhost:3001",
  TWENTY_API_KEY: process.env["TWENTY_API_KEY"] ?? "",
  TWENTY_GRAPHQL_URL: process.env["TWENTY_GRAPHQL_URL"] || "",

  // ─── Clerk Auth ────────────────────────────────
  CLERK_SECRET_KEY: process.env["CLERK_SECRET_KEY"] ?? "",
  CLERK_PUBLISHABLE_KEY: process.env["CLERK_PUBLISHABLE_KEY"] ?? "",
  CLERK_ISSUER: process.env["CLERK_ISSUER"] ?? "",

  // ─── Stripe Billing ────────────────────────────
  STRIPE_SECRET_KEY: requireEnv("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: requireEnv("STRIPE_WEBHOOK_SECRET"),

  // ─── Resend (Email) ────────────────────────────────────
  RESEND_API_KEY: requireEnv("RESEND_API_KEY"),

  // ─── PagosPy ───────────────────────────────────
  PAGOSPY_API_KEY: process.env["PAGOSPY_API_KEY"] ?? "",
  PAGOSPY_API_URL: process.env["PAGOSPY_API_URL"] ?? "https://api.pasarelapy.com/v1",
};
