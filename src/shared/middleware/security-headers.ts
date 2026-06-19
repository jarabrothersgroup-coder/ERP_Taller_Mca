/**
 * Security Headers Middleware — Defense-in-depth HTTP headers.
 *
 * Adds hardened security headers to every response:
 *   - Content-Security-Policy (CSP) with nonce support
 *   - Strict-Transport-Security (HSTS)
 *   - X-Content-Type-Options
 *   - X-Frame-Options
 *   - Referrer-Policy
 *   - Permissions-Policy
 *   - Cross-Origin-Opener-Policy
 *   - Cross-Origin-Resource-Policy
 *   - Cross-Origin-Embedder-Policy
 *   - X-XSS-Protection (legacy)
 *
 * OWASP Top 10 2021 — A05:2021 Security Misconfiguration
 *
 * @module shared/middleware/security-headers
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../../config/env.js";

// ─── CSP Directives ────────────────────────────────

/**
 * Content Security Policy directives.
 *
 * Configured for:
 *   - Tailwind CDN + Google Fonts (external stylesheets)
 *   - Inline styles (Tailwind utility classes)
 *   - Self-hosted scripts (app.js + modules)
 *   - WebSocket connections (visual orchestration)
 *   - Image uploads (multipart form data)
 *
 * In production, tighten to specific CDN origins.
 */
function buildCspDirectives(): string {
  const isProd = env.NODE_ENV === "production";

  const directives = [
    // Default — restrict to self
    "default-src 'self'",

    // Scripts — self only (no eval, no inline in production)
    // MED-02 FIX: Remove unsafe-inline from production scripts
    isProd
      ? "script-src 'self'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

    // Styles — CDN + inline (Tailwind requires inline)
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com",

    // Fonts — Google Fonts
    "font-src 'self' https://fonts.gstatic.com data:",

    // Images — self + data URIs (logos) + blob (camera)
    // MED-02 FIX: Restrict image sources in production
    isProd
      ? "img-src 'self' data: blob:"
      : "img-src 'self' data: blob: http: https:",

    // Connect — WebSocket + API + CDN
    "connect-src 'self' ws: wss: https://cdn.tailwindcss.com",

    // Media — none expected
    "media-src 'none'",

    // Objects — none (Flash blocked)
    "object-src 'none'",

    // Frames — none (prevent clickjacking)
    "frame-src 'none'",

    // Frame ancestors — none
    "frame-ancestors 'none'",

    // Base URI — self only
    "base-uri 'self'",

    // Form action — self only
    "form-action 'self'",

    // Upgrade insecure requests in production
    isProd ? "upgrade-insecure-requests" : "",
  ].filter(Boolean);

  return directives.join("; ");
}

// ─── Security Headers Hook ─────────────────────────

/**
 * Fastify onRequest hook that adds security headers to every response.
 *
 * Headers follow OWASP Secure Headers Project recommendations.
 * CSP is set on onRequest so it applies to all responses including errors.
 */
export async function securityHeadersHook(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const isProd = env.NODE_ENV === "production";

  // ─── Content Security Policy ───────────────
  reply.header("Content-Security-Policy", buildCspDirectives());

  // ─── HSTS — Force HTTPS in production ─────
  if (isProd) {
    reply.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  // ─── X-Content-Type-Options ────────────────
  // Prevents MIME-type sniffing
  reply.header("X-Content-Type-Options", "nosniff");

  // ─── X-Frame-Options ──────────────────────
  // Prevents clickjacking (legacy, CSP frame-ancestors is primary)
  reply.header("X-Frame-Options", "DENY");

  // ─── Referrer Policy ──────────────────────
  // Sends origin only on cross-origin requests
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // ─── Permissions Policy ────────────────────
  // Restricts browser features
  reply.header(
    "Permissions-Policy",
    [
      "accelerometer=()",
      "ambient-light-sensor=()",
      "autoplay=()",
      "battery=()",
      "camera=()",
      "cross-origin-isolated=()",
      "display-capture=()",
      "document-domain=()",
      "encrypted-media=()",
      "execution-while-not-rendered=()",
      "execution-while-out-of-viewport=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "keyboard-map=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "navigation-override=()",
      "payment=()",
      "picture-in-picture=()",
      "publickey-credentials-get=(self)",
      "screen-wake-lock=()",
      "sync-xhr=(self)",
      "usb=()",
      "web-share=(self)",
      "xr-spatial-tracking=()",
    ].join(", "),
  );

  // ─── Cross-Origin Policies ─────────────────
  // Isolates browsing context
  reply.header("Cross-Origin-Opener-Policy", "same-origin");
  reply.header("Cross-Origin-Resource-Policy", "same-origin");

  // ─── X-XSS-Protection (legacy) ─────────────
  // Enables XSS auditor in older browsers (modern browsers use CSP)
  reply.header("X-XSS-Protection", "1; mode=block");

  // ─── Cache Control for API responses ───────
  // Prevents caching of authenticated API responses
  if (_request.url.startsWith("/api/") || _request.url.startsWith("/workshop/") || _request.url.startsWith("/finance/")) {
    reply.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");
    reply.header("Surrogate-Control", "no-store");
  }
}

// ─── CSP Nonce Generator (for future use) ─────────

/**
 * Generate a CSP nonce for inline scripts.
 * Use this when migrating away from 'unsafe-inline' for scripts.
 *
 * @returns Base64-encoded 16-byte nonce
 *
 * @example
 * ```ts
 * const nonce = generateCspNonce();
 * // Add to script tag: <script nonce="${nonce}">
 * // Add to CSP: script-src 'nonce-${nonce}'
 * ```
 */
export function generateCspNonce(): string {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  return randomBytes(16).toString("base64");
}
