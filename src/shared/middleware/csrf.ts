/**
 * CSRF Protection — Double-Submit Cookie Pattern.
 *
 * Protects state-changing operations (POST, PUT, PATCH, DELETE) against
 * Cross-Site Request Forgery attacks using the double-submit cookie pattern:
 *   1. Server generates a random CSRF token and sets it as a cookie
 *   2. Client reads the cookie and sends the token in a custom header
 *   3. Server compares cookie value with header value
 *
 * This is stateless (no server-side session) and works with JWT auth.
 *
 * OWASP Top 10 2021 — A01:2021 Broken Access Control
 *
 * @module shared/middleware/csrf
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { randomBytes } from "node:crypto";

const CSRF_COOKIE_NAME = "_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_MAX_AGE = 3600; // 1 hour

// HTTP methods that are state-changing and require CSRF protection
const STATEFUL_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Paths exempt from CSRF (public endpoints that don't modify state)
const CSRF_EXEMPT_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/lead",
  "/health",
  "/health/live",
  "/health/ready",
  "/health/modules",
  "/health/metrics",
  "/health/performance",
  "/health/security-audit",
  "/health/deep",
  "/metrics",
  "/docs",
]);

/**
 * Generate a cryptographically secure CSRF token.
 */
function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Fastify hook that sets a CSRF cookie on every response.
 * The cookie is HttpOnly=false so JavaScript can read it.
 */
export async function csrfSetCookieHook(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Only set cookie if not already present
  const existing = _request.cookies?.[CSRF_COOKIE_NAME];
  if (!existing && typeof reply.cookie === 'function') {
    const token = generateCsrfToken();
    reply.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by JavaScript
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: CSRF_COOKIE_MAX_AGE,
    });
  }
}

/**
 * Fastify preHandler hook that verifies CSRF token on state-changing requests.
 *
 * Compares the token from the CSRF cookie with the token in the X-CSRF-Token header.
 * Exempts safe methods (GET, HEAD, OPTIONS) and public paths.
 */
export async function csrfVerifyHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const method = request.method.toUpperCase();

  // Skip CSRF for safe methods
  if (!STATEFUL_METHODS.has(method)) return;

  // Skip for exempt paths
  const url = request.url.split("?")[0];
  if (CSRF_EXEMPT_PATHS.has(url)) return;

  // Skip for API key / external integrations (they use different auth)
  const authHeader = request.headers["authorization"];
  if (!authHeader && !request.headers["x-user-email"]) return;

  // Get token from cookie
  const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];

  // Get token from header
  const headerToken = request.headers[CSRF_HEADER_NAME] as string | undefined;

  if (!cookieToken || !headerToken) {
    reply.status(403).send({
      error: "CSRFError",
      message: "Token CSRF requerido",
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (cookieToken.length !== headerToken.length) {
    reply.status(403).send({
      error: "CSRFError",
      message: "Token CSRF inválido",
    });
    return;
  }

  const { timingSafeEqual } = await import("node:crypto");
  const cookieBuf = Buffer.from(cookieToken);
  const headerBuf = Buffer.from(headerToken);

  if (!timingSafeEqual(cookieBuf, headerBuf)) {
    reply.status(403).send({
      error: "CSRFError",
      message: "Token CSRF inválido",
    });
    return;
  }
}

/**
 * CSRF middleware configuration for Fastify.
 * Call this to register CSRF protection hooks.
 */
export async function registerCsrfProtection(app: import("fastify").FastifyInstance): Promise<void> {
  // Set CSRF cookie on every response
  app.addHook("onResponse", csrfSetCookieHook);
  // Verify CSRF token on state-changing requests
  app.addHook("preHandler", csrfVerifyHook);
  app.log.info("CSRF double-submit cookie protection registered");
}
