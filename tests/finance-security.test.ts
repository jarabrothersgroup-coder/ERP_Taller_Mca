/**
 * Finance & Security — Unit Tests
 *
 * Covers the highest-risk untested code:
 * - validateTenantSchema (SQL injection prevention via schema interpolation)
 * - auth-utils (scrypt password hashing, timing-safe verification)
 *
 * @module tests/finance-security.test
 */

import { describe, it, expect } from "vitest";
import { validateTenantSchema } from "../src/modules/finance/services/FinancialOrchestratorService.js";
import { hashPassword, verifyPassword } from "../src/modules/config/services/auth-utils.js";

// ─── Finance: Tenant Schema Validation ───────

describe("🔴 [CRITICAL] Tenant Schema — SQL Injection Prevention", () => {
  it("accepts valid alphanumeric slug", () => {
    expect(validateTenantSchema("taller01")).toBe("taller01");
  });

  it("accepts snake_case slug", () => {
    expect(validateTenantSchema("taller_el_chero")).toBe("taller_el_chero");
  });

  it("rejects slug with SQL injection comment", () => {
    expect(() =>
      validateTenantSchema("taller'; DROP TABLE tenants; --"),
    ).toThrow("caracteres inválidos");
  });

  it("rejects slug with single quote", () => {
    expect(() => validateTenantSchema("taller'jara")).toThrow("caracteres inválidos");
  });

  it("rejects slug with double quote", () => {
    expect(() => validateTenantSchema('taller"jara')).toThrow("caracteres inválidos");
  });

  it("rejects slug with semicolon", () => {
    expect(() => validateTenantSchema("taller; SELECT * FROM users")).toThrow(
      "caracteres inválidos",
    );
  });

  it("rejects slug with whitespace", () => {
    expect(() => validateTenantSchema("taller jara")).toThrow("caracteres inválidos");
  });

  it("rejects empty string", () => {
    expect(() => validateTenantSchema("")).toThrow("no vacío");
  });

  it("rejects null", () => {
    expect(() => validateTenantSchema(null as unknown as string)).toThrow("no vacío");
  });

  it("rejects hyphenated slug (common attack vector)", () => {
    expect(() => validateTenantSchema("taller-jara")).toThrow("caracteres inválidos");
  });
});

// ─── Auth: scrypt Password Hashing ───────────

describe("🔴 [CRITICAL] Auth — scrypt Password Hashing", () => {
  it("hashPassword returns a hash different from plaintext", async () => {
    const hash = await hashPassword("MiClaveSegura2026!");
    expect(hash).toBeDefined();
    expect(hash).not.toBe("MiClaveSegura2026!");
  });

  it("hashPassword returns salt:key format with hex strings", async () => {
    const hash = await hashPassword("test");
    const parts = hash.split(":");
    expect(parts).toHaveLength(2);
    // Salt is 32 bytes → 64 hex chars, key is 64 bytes → 128 hex chars
    expect(parts[0]).toHaveLength(64);
    expect(parts[1]).toHaveLength(128);
  });

  it("verifyPassword returns true for correct password", async () => {
    const hash = await hashPassword("Admin01$");
    const result = verifyPassword("Admin01$", hash);
    expect(result).toBe(true);
  });

  it("verifyPassword returns false for incorrect password", async () => {
    const hash = await hashPassword("CorrectPass1");
    const result = verifyPassword("WrongPass1", hash);
    expect(result).toBe(false);
  });

  it("verifyPassword returns false for empty password attempt", async () => {
    const hash = await hashPassword("RealPass1");
    const result = verifyPassword("", hash);
    expect(result).toBe(false);
  });

  it("verifyPassword returns false for malformed stored hash", () => {
    const result = verifyPassword("anypass", "invalid-hash-format");
    expect(result).toBe(false);
  });

  it("verifyPassword returns false for missing delimiter in stored hash", () => {
    const result = verifyPassword("anypass", "abcdef123456");
    expect(result).toBe(false);
  });

  it("two hashes of the same password are different (different salts)", async () => {
    const hash1 = await hashPassword("SamePass1!");
    const hash2 = await hashPassword("SamePass1!");
    expect(hash1).not.toBe(hash2);
  });

  it("handles Unicode passwords", async () => {
    const hash = await hashPassword("martín-güémez-2026");
    expect(verifyPassword("martín-güémez-2026", hash)).toBe(true);
  });
});
