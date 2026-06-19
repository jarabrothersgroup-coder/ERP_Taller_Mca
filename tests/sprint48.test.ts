/**
 * Sprint 48 Tests — CSRF, Persistent Rate Limiting, Zod Validation.
 *
 * @module tests/sprint48
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ═══════════════════════════════════════════
// 1. CSRF Protection
// ═══════════════════════════════════════════

describe("Sprint 48 — CSRF Protection", () => {
  it("exports CSRF functions", async () => {
    const mod = await import("../../src/shared/middleware/csrf.js");
    expect(typeof mod.registerCsrfProtection).toBe("function");
    expect(typeof mod.csrfSetCookieHook).toBe("function");
    expect(typeof mod.csrfVerifyHook).toBe("function");
  });

  it("CSRF middleware is registered in app.ts", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/app.ts"),
      "utf8",
    );
    expect(content).toContain("registerCsrfProtection");
    expect(content).toContain("csrf.js");
  });

  it("frontend sends CSRF token header on mutations", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/shared/public/app.js"),
      "utf8",
    );
    expect(content).toContain("X-CSRF-Token");
    expect(content).toContain("_csrf");
  });
});

// ═══════════════════════════════════════════
// 2. Persistent Rate Limiting
// ═══════════════════════════════════════════

describe("Sprint 48 — Persistent Rate Limiter", () => {
  it("exports rate limiter functions", async () => {
    const mod = await import("../../src/shared/services/rate-limiter.js");
    expect(typeof mod.checkRateLimit).toBe("function");
    expect(typeof mod.recordAttempt).toBe("function");
    expect(typeof mod.resetAttempts).toBe("function");
    expect(typeof mod.getRateLimitStatus).toBe("function");
    expect(typeof mod.flushStore).toBe("function");
  });

  it("checkRateLimit allows requests within limit", async () => {
    const { checkRateLimit, resetAttempts } = await import("../../src/shared/services/rate-limiter.js");
    const key = `test-allow-${Date.now()}`;
    resetAttempts(key);
    // Should not throw
    checkRateLimit(key, { maxAttempts: 5, windowMs: 60000 });
    resetAttempts(key);
  });

  it("checkRateLimit blocks requests exceeding limit", async () => {
    const { checkRateLimit, recordAttempt, resetAttempts } = await import("../../src/shared/services/rate-limiter.js");
    const key = `test-block-${Date.now()}`;
    resetAttempts(key);
    // Exhaust the limit
    checkRateLimit(key, { maxAttempts: 3, windowMs: 60000 });
    recordAttempt(key);
    checkRateLimit(key, { maxAttempts: 3, windowMs: 60000 });
    recordAttempt(key);
    checkRateLimit(key, { maxAttempts: 3, windowMs: 60000 });
    recordAttempt(key);
    // Next check should throw
    expect(() => checkRateLimit(key, { maxAttempts: 3, windowMs: 60000 })).toThrow();
    resetAttempts(key);
  });

  it("getRateLimitStatus returns correct status", async () => {
    const { getRateLimitStatus, resetAttempts, recordAttempt } = await import("../../src/shared/services/rate-limiter.js");
    const key = `test-status-${Date.now()}`;
    resetAttempts(key);
    const status = getRateLimitStatus(key, { maxAttempts: 5, windowMs: 60000 });
    expect(status.allowed).toBe(true);
    expect(status.remaining).toBe(5);
    expect(status.retryAfter).toBe(0);
    resetAttempts(key);
  });

  it("auth.ts uses persistent rate limiter (not in-memory Map)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/modules/config/routes/auth.ts"),
      "utf8",
    );
    // Should import from rate-limiter service
    expect(content).toContain("rate-limiter.js");
    expect(content).toContain("checkRateLimit");
    expect(content).toContain("recordAttempt");
    expect(content).toContain("resetAttempts");
    // Should NOT have in-memory Map
    expect(content).not.toContain("new Map<string");
    expect(content).not.toContain("loginAttempts = new Map");
  });
});

// ═══════════════════════════════════════════
// 3. Zod Validation
// ═══════════════════════════════════════════

describe("Sprint 48 — Zod Validation Schemas", () => {
  it("exports validation schemas", async () => {
    const mod = await import("../../src/shared/schemas/validation.js");
    expect(mod.loginBodySchema).toBeDefined();
    expect(mod.tenantSlugSchema).toBeDefined();
    expect(mod.emailSchema).toBeDefined();
    expect(mod.passwordSchema).toBeDefined();
    expect(mod.vehicleSchema).toBeDefined();
    expect(mod.clienteSchema).toBeDefined();
    expect(mod.ordenTrabajoSchema).toBeDefined();
    expect(mod.repuestoSchema).toBeDefined();
    expect(mod.bulkImportSchema).toBeDefined();
    expect(mod.portalMagicLinkSchema).toBeDefined();
    expect(mod.portalPinSchema).toBeDefined();
    expect(mod.portalFeedbackSchema).toBeDefined();
    expect(mod.portalAppointmentSchema).toBeDefined();
    expect(mod.paginationSchema).toBeDefined();
  });

  it("loginBodySchema validates correct input", async () => {
    const { loginBodySchema } = await import("../../src/shared/schemas/validation.js");
    const result = loginBodySchema.safeParse({
      tenantSlug: "taller-test",
      email: "user@test.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("loginBodySchema rejects invalid email", async () => {
    const { loginBodySchema } = await import("../../src/shared/schemas/validation.js");
    const result = loginBodySchema.safeParse({
      tenantSlug: "taller-test",
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("loginBodySchema rejects empty password", async () => {
    const { loginBodySchema } = await import("../../src/shared/schemas/validation.js");
    const result = loginBodySchema.safeParse({
      tenantSlug: "taller-test",
      email: "user@test.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("loginBodySchema rejects invalid tenant slug", async () => {
    const { loginBodySchema } = await import("../../src/shared/schemas/validation.js");
    const result = loginBodySchema.safeParse({
      tenantSlug: "invalid slug with spaces!",
      email: "user@test.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("vehicleSchema validates correct input", async () => {
    const { vehicleSchema } = await import("../../src/shared/schemas/validation.js");
    const result = vehicleSchema.safeParse({
      vin: "1HGBH41JXMN109186",
      marca: "Toyota",
      modelo: "Corolla",
      anio: 2020,
    });
    expect(result.success).toBe(true);
  });

  it("vehicleSchema rejects invalid VIN length", async () => {
    const { vehicleSchema } = await import("../../src/shared/schemas/validation.js");
    const result = vehicleSchema.safeParse({
      vin: "12345",
      marca: "Toyota",
      modelo: "Corolla",
      anio: 2020,
    });
    expect(result.success).toBe(false);
  });

  it("validateBody throws ValidationError on invalid input", async () => {
    const { validateBody, loginBodySchema } = await import("../../src/shared/schemas/validation.js");
    expect(() => validateBody({ tenantSlug: "", email: "bad", password: "" }, loginBodySchema)).toThrow();
  });

  it("validateBody returns validated data on valid input", async () => {
    const { validateBody, loginBodySchema } = await import("../../src/shared/schemas/validation.js");
    const data = validateBody({
      tenantSlug: "taller-test",
      email: "user@test.com",
      password: "password123",
    }, loginBodySchema);
    expect(data.tenantSlug).toBe("taller-test");
    expect(data.email).toBe("user@test.com");
  });

  it("auth.ts uses Zod validation", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/modules/config/routes/auth.ts"),
      "utf8",
    );
    expect(content).toContain("validateBody");
    expect(content).toContain("loginBodySchema");
  });
});

// ═══════════════════════════════════════════
// 4. Security Integration
// ═══════════════════════════════════════════

describe("Sprint 48 — Security Integration", () => {
  it("all 3 remaining medium vulnerabilities are fixed", async () => {
    const fs = await import("fs");
    const path = await import("path");

    // CSRF: app.ts registers CSRF
    const appContent = fs.readFileSync(path.resolve(__dirname, "../src/app.ts"), "utf8");
    expect(appContent).toContain("registerCsrfProtection");

    // Rate limiting: auth.ts uses persistent store
    const authContent = fs.readFileSync(path.resolve(__dirname, "../src/modules/config/routes/auth.ts"), "utf8");
    expect(authContent).toContain("rate-limiter.js");

    // Validation: auth.ts uses Zod
    expect(authContent).toContain("validateBody");
    expect(authContent).toContain("loginBodySchema");
  });

  it("no in-memory rate limiters remain in auth.ts", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/modules/config/routes/auth.ts"),
      "utf8",
    );
    expect(content).not.toContain("new Map");
    expect(content).not.toContain("loginAttempts");
    expect(content).not.toContain("CLEANUP_INTERVAL");
  });
});
