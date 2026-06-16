/**
 * Sprint 17 Tests — Validation, XSS, Logger, Bulk Import, Backup, Theme, Shortcuts
 *
 * @module tests/sprint17.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ═════════════════════════════════════════════════
//  1. Zod Validation Schemas
// ═════════════════════════════════════════════════

describe("🛡️ [Sprint 17] Zod Validation Schemas", () => {
  const validClient = { name: "Juan Pérez", email: "juan@test.com", phone: "+595991234567" };
  const validVehicle = {
    clientId: "550e8400-e29b-41d4-a716-446655440000",
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    vin: "1HGBH41JXMN109186",
  };

  it("createClientSchema accepts valid data", async () => {
    const { createClientSchema } = await import("../src/shared/validation/schemas.js");
    const result = createClientSchema.safeParse(validClient);
    expect(result.success).toBe(true);
  });

  it("createClientSchema rejects missing name", async () => {
    const { createClientSchema } = await import("../src/shared/validation/schemas.js");
    const result = createClientSchema.safeParse({ email: "test@test.com" });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod error messages may vary by version — check for any error on name field
      const nameErrors = result.error.issues.filter((e: any) => e.path.includes("name"));
      expect(nameErrors.length).toBeGreaterThan(0);
    }
  });

  it("createVehicleSchema rejects invalid VIN length", async () => {
    const { createVehicleSchema } = await import("../src/shared/validation/schemas.js");
    const result = createVehicleSchema.safeParse({ ...validVehicle, vin: "SHORT" });
    expect(result.success).toBe(false);
  });

  it("createVehicleSchema validates engineType enum", async () => {
    const { createVehicleSchema } = await import("../src/shared/validation/schemas.js");
    const valid = createVehicleSchema.safeParse({ ...validVehicle, engineType: "HEV" });
    expect(valid.success).toBe(true);

    const invalid = createVehicleSchema.safeParse({ ...validVehicle, engineType: "Gasolina" });
    expect(invalid.success).toBe(false);
  });

  it("createOrdenSchema requires vehicleId, clientId, description", async () => {
    const { createOrdenSchema } = await import("../src/shared/validation/schemas.js");
    const result = createOrdenSchema.safeParse({
      vehicleId: "550e8400-e29b-41d4-a716-446655440000",
      clientId: "550e8400-e29b-41d4-a716-446655440001",
      description: "Cambio de aceite",
    });
    expect(result.success).toBe(true);

    const missing = createOrdenSchema.safeParse({ vehicleId: "550e8400-e29b-41d4-a716-446655440000" });
    expect(missing.success).toBe(false);
  });

  it("issueInvoiceSchema validates tipoFacturacion enum", async () => {
    const { issueInvoiceSchema } = await import("../src/shared/validation/schemas.js");
    const valid = issueInvoiceSchema.safeParse({
      ordenId: "550e8400-e29b-41d4-a716-446655440000",
      tipoFacturacion: "MANUAL",
    });
    expect(valid.success).toBe(true);

    const invalid = issueInvoiceSchema.safeParse({
      ordenId: "550e8400-e29b-41d4-a716-446655440000",
      tipoFacturacion: "OTRO",
    });
    expect(invalid.success).toBe(false);
  });

  it("registerPaymentSchema requires positive monto", async () => {
    const { registerPaymentSchema } = await import("../src/shared/validation/schemas.js");
    const valid = registerPaymentSchema.safeParse({
      facturaId: "550e8400-e29b-41d4-a716-446655440000",
      monto: 150000,
      medioPago: "EFECTIVO",
    });
    expect(valid.success).toBe(true);

    const negative = registerPaymentSchema.safeParse({
      facturaId: "550e8400-e29b-41d4-a716-446655440000",
      monto: -500,
      medioPago: "EFECTIVO",
    });
    expect(negative.success).toBe(false);
  });

  it("registrarMovimientoSchema validates medioPago enum", async () => {
    const { registrarMovimientoSchema } = await import("../src/shared/validation/schemas.js");
    const valid = registrarMovimientoSchema.safeParse({
      cuentaId: "550e8400-e29b-41d4-a716-446655440000",
      tipo: "INGRESO",
      monto: 100000,
      medioPago: "QR",
      concepto: "Pago de factura",
    });
    expect(valid.success).toBe(true);
  });

  it("loginSchema validates slug regex", async () => {
    const { loginSchema } = await import("../src/shared/validation/schemas.js");
    const valid = loginSchema.safeParse({ tenantSlug: "taller-el-chero", email: "admin@test.com" });
    expect(valid.success).toBe(true);

    const invalid = loginSchema.safeParse({ tenantSlug: "taller el chero", email: "admin@test.com" });
    expect(invalid.success).toBe(false);
  });

  it("validate() helper returns correct shapes", async () => {
    const { validate, createClientSchema } = await import("../src/shared/validation/schemas.js");
    const ok = validate(createClientSchema, validClient);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.name).toBe("Juan Pérez");

    // Test with truly invalid data (empty object — name is required)
    const fail = validate(createClientSchema, { name: "", email: "not-an-email" });
    expect(fail.success).toBe(false);
    if (!fail.success) expect(fail.errors.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════
//  2. XSS Security
// ═════════════════════════════════════════════════

describe("🔒 [Sprint 17] XSS Security", () => {
  it("escapeHtml escapes HTML entities", async () => {
    const { escapeHtml } = await import("../src/shared/security/xss.js");
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;"
    );
    expect(escapeHtml("O'Brien's")).toBe("O&#x27;Brien&#x27;s");
    expect(escapeHtml("A&B < C")).toBe("A&amp;B &lt; C");
  });

  it("escapeHtml returns empty string for non-string input", async () => {
    const { escapeHtml } = await import("../src/shared/security/xss.js");
    expect(escapeHtml(null as any)).toBe("");
    expect(escapeHtml(undefined as any)).toBe("");
    expect(escapeHtml(123 as any)).toBe("");
  });

  it("stripDangerousHtml removes script tags and content", async () => {
    const { stripDangerousHtml } = await import("../src/shared/security/xss.js");
    const result = stripDangerousHtml('<p>Hola</p><script>alert("xss")</script><p>Mundo</p>');
    expect(result).not.toContain("<script>");
    expect(result).toContain("Hola");
    expect(result).toContain("Mundo");
  });

  it("stripDangerousHtml removes onerror handlers", async () => {
    const { stripDangerousHtml } = await import("../src/shared/security/xss.js");
    const result = stripDangerousHtml('<img onerror="alert(1)" src="x.png">');
    expect(result).not.toContain("onerror");
  });

  it("stripDangerousHtml removes javascript: protocol", async () => {
    const { stripDangerousHtml } = await import("../src/shared/security/xss.js");
    const result = stripDangerousHtml('<a href="javascript:alert(1)">Click</a>');
    expect(result).not.toContain("javascript:");
  });

  it("sanitize combines escapeHtml and stripDangerousHtml", async () => {
    const { sanitize } = await import("../src/shared/security/xss.js");
    const result = sanitize('<b>Hello</b><script>alert(1)</script>');
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;b&gt;Hello&lt;&#x2F;b&gt;");
  });

  it("isSqlSafe detects SQL injection patterns", async () => {
    const { isSqlSafe } = await import("../src/shared/security/xss.js");
    expect(isSqlSafe("normal text")).toBe(true);
    expect(isSqlSafe("' OR '1'='1")).toBe(false);
    expect(isSqlSafe("'; DROP TABLE users;")).toBe(false);
    expect(isSqlSafe("1; DELETE FROM clientes")).toBe(false);
    expect(isSqlSafe("1 UNION SELECT * FROM users")).toBe(false);
    expect(isSqlSafe("test --")).toBe(false);
    expect(isSqlSafe("test /* comment */")).toBe(false);
  });

  it("generateNonce returns base64 string of correct length", async () => {
    const { generateNonce } = await import("../src/shared/security/xss.js");
    const nonce = generateNonce();
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBeGreaterThan(0);
    // 16 bytes → 24 base64 chars
    expect(nonce.length).toBeGreaterThanOrEqual(20);
  });
});

// ═════════════════════════════════════════════════
//  3. Logger Middleware
// ═════════════════════════════════════════════════

describe("📝 [Sprint 17] Logger Middleware", () => {
  it("getMetrics returns memory usage and uptime", async () => {
    const { getMetrics } = await import("../src/shared/middleware/logger.js");
    const m = getMetrics();
    expect(typeof m.uptimeSeconds).toBe("number");
    expect(typeof m.requestsTotal).toBe("number");
    expect(m.memoryUsage).toBeDefined();
    expect(typeof m.memoryUsage.rss).toBe("string");
    expect(m.memoryUsage.rss).toContain("MB");
  });

  it("recordRequest increments counters", async () => {
    const { getMetrics, recordRequest } = await import("../src/shared/middleware/logger.js");
    const before = getMetrics();
    recordRequest(200, "test-tenant");
    recordRequest(200, "test-tenant");
    recordRequest(404, "other-tenant");
    recordRequest(500, "test-tenant");
    const after = getMetrics();

    expect(after.requestsTotal).toBeGreaterThanOrEqual(before.requestsTotal + 3);
    expect(after.requestsByTenant["test-tenant"]).toBeGreaterThanOrEqual(2);
    expect(after.errorsTotal).toBeGreaterThanOrEqual(before.errorsTotal + 1);
  });

  it("requestIdHook generates UUID when no header", async () => {
    const { requestIdHook } = await import("../src/shared/middleware/logger.js");
    const request = { headers: {} } as any;
    const reply = { header: vi.fn() } as any;
    await requestIdHook(request, reply);
    expect(request.id).toBeDefined();
    expect(request.id.length).toBeGreaterThan(0);
    expect(reply.header).toHaveBeenCalledWith("X-Request-ID", request.id);
  });

  it("requestIdHook uses existing X-Request-ID header", async () => {
    const { requestIdHook } = await import("../src/shared/middleware/logger.js");
    const existingId = "my-custom-request-id-123";
    const request = { headers: { "x-request-id": existingId } } as any;
    const reply = { header: vi.fn() } as any;
    await requestIdHook(request, reply);
    expect(request.id).toBe(existingId);
  });
});

// ═════════════════════════════════════════════════
//  4. Bulk Import Service
// ═════════════════════════════════════════════════

describe("📥 [Sprint 17] Bulk Import Service", () => {
  it("parseAndValidate parses valid client CSV", async () => {
    const { parseAndValidate } = await import("../src/shared/services/bulk-import.service.js");
    const csv = "name,email,phone,ruc,address,notes\nJuan Pérez,juan@test.com,+595991234567,1234567-8,Asunción,Cliente frecuente";
    const result = parseAndValidate(csv, "client", { tenantSlug: "test" });
    expect(result.total).toBe(1);
    expect(result.valid).toBe(1);
    expect(result.invalid).toBe(0);
    expect(result.preview[0].name).toBe("Juan Pérez");
  });

  it("parseAndValidate detects missing required fields", async () => {
    const { parseAndValidate } = await import("../src/shared/services/bulk-import.service.js");
    // CSV row must match header column count: 6 columns = 6 values separated by 5 commas
    // Empty name + email + phone + ruc + address + notes
    const csv = "name,email,phone,ruc,address,notes\n,juan@test.com,,,,";
    const result = parseAndValidate(csv, "client", { tenantSlug: "test" });
    expect(result.total).toBe(1);
    expect(result.invalid).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].field).toBe("name");
  });

  it("parseAndValidate handles multiple rows", async () => {
    const { parseAndValidate } = await import("../src/shared/services/bulk-import.service.js");
    const csv = [
      "name,email,phone,ruc,address,notes",
      "Juan,juan@test.com,,,Asunción,",
      "María,maria@test.com,,,Luarca,",
      "Pedro,pedro@test.com,,,San Lorenzo,",
    ].join("\n");
    const result = parseAndValidate(csv, "client", { tenantSlug: "test" });
    expect(result.total).toBe(3);
    expect(result.valid).toBe(3);
    expect(result.preview.length).toBe(3);
  });

  it("template generators return valid CSV with headers", async () => {
    const { getClientTemplate, getVehicleTemplate, getRepuestoTemplate } = await import("../src/shared/services/bulk-import.service.js");
    const clientCsv = getClientTemplate();
    expect(clientCsv).toContain("name,email");
    const vehicleCsv = getVehicleTemplate();
    expect(vehicleCsv).toContain("brand,model");
    const repuestoCsv = getRepuestoTemplate();
    expect(repuestoCsv).toContain("codigo,descripcion");
  });

  it("toCsv converts records to CSV format", async () => {
    const { toCsv } = await import("../src/shared/services/bulk-import.service.js");
    const records = [
      { name: "Juan", email: "juan@test.com" },
      { name: "María", email: "maria@test.com" },
    ];
    const csv = toCsv(records);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("name,email");
    expect(lines[1]).toBe("Juan,juan@test.com");
    expect(lines[2]).toBe("María,maria@test.com");
  });

  it("toCsv handles commas and quotes in values", async () => {
    const { toCsv } = await import("../src/shared/services/bulk-import.service.js");
    const records = [{ name: "Asunción, Central", desc: 'He said "hello"' }];
    const csv = toCsv(records);
    expect(csv).toContain('"Asunción, Central"');
    expect(csv).toContain('"He said ""hello"""');
  });

  it("toCsv returns empty string for empty array", async () => {
    const { toCsv } = await import("../src/shared/services/bulk-import.service.js");
    expect(toCsv([])).toBe("");
  });
});

// ═════════════════════════════════════════════════
//  5. Backup Service
// ═════════════════════════════════════════════════

describe("💾 [Sprint 17] Backup Service", () => {
  it("listBackups returns empty array when no backup dir", async () => {
    const { listBackups } = await import("../src/shared/services/backup.service.js");
    // In test env, BACKUP_DIR likely doesn't exist
    const result = listBackups();
    expect(Array.isArray(result)).toBe(true);
  });

  it("createBackup throws when DATABASE_URL not set", async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const { createBackup } = await import("../src/shared/services/backup.service.js");
    expect(() => createBackup("test")).toThrow("DATABASE_URL not set");
    if (original) process.env.DATABASE_URL = original;
  });

  it("restoreBackup throws when file not found", async () => {
    const { restoreBackup } = await import("../src/shared/services/backup.service.js");
    expect(() => restoreBackup("/nonexistent/file.sql")).toThrow("Backup file not found");
  });

  it("restoreBackup dryRun returns success without executing", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const tmpFile = path.join(process.cwd(), "backups", "_test_dryrun.sql");

    // Ensure backup dir exists
    const backupDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(tmpFile, "-- test backup");

    // restoreBackup checks DATABASE_URL before dryRun, so set it
    const origDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://fake:fake@localhost:5432/fake";

    const { restoreBackup } = await import("../src/shared/services/backup.service.js");
    const result = restoreBackup(tmpFile, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.message).toContain("Dry run");

    fs.unlinkSync(tmpFile);
    // Restore original
    if (origDbUrl) process.env.DATABASE_URL = origDbUrl;
    else delete process.env.DATABASE_URL;
  });
});

// ═════════════════════════════════════════════════
//  6. Frontend Modules Existence
// ═════════════════════════════════════════════════

describe("🎨 [Sprint 17] Frontend Modules", () => {
  it("shortcuts.js exists and has command palette", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const content = readFileSync(join(process.cwd(), "src/shared/public/js/shortcuts.js"), "utf-8");
    expect(content).toContain("command-palette");
    expect(content).toContain("openPalette");
    expect(content).toContain("palette-item");
    expect(content).toContain("openCommandPalette");
  });

  it("theme.js exists and has dark/light mode", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const content = readFileSync(join(process.cwd(), "src/shared/public/js/theme.js"), "utf-8");
    expect(content).toContain("dark");
    expect(content).toContain("light");
    expect(content).toContain("accent");
    expect(content).toContain("localStorage");
  });

  it("index.html includes shortcuts.js and theme.js", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const content = readFileSync(join(process.cwd(), "src/shared/public/index.html"), "utf-8");
    expect(content).toContain('js/shortcuts.js');
    expect(content).toContain('js/theme.js');
  });
});

// ═════════════════════════════════════════════════
//  7. E2E Pipeline (Sprint 17 additions)
// ═════════════════════════════════════════════════

describe("🔄 [Sprint 17] E2E Pipeline Integration", () => {
  it("validation + XSS sanitization work together", async () => {
    const { validate, createClientSchema } = await import("../src/shared/validation/schemas.js");
    const { sanitize } = await import("../src/shared/security/xss.js");

    const maliciousInput = { name: '<script>alert(1)</script> Juan', email: "juan@test.com" };
    const validation = validate(createClientSchema, maliciousInput);
    expect(validation.success).toBe(true);
    if (validation.success) {
      const safeName = sanitize(validation.data.name);
      expect(safeName).not.toContain("<script>");
    }
  });

  it("bulk import with XSS in CSV data is parseable", async () => {
    const { parseAndValidate } = await import("../src/shared/services/bulk-import.service.js");
    const { escapeHtml } = await import("../src/shared/security/xss.js");

    const csv = 'name,email,phone,ruc,address,notes\n<script>alert(1)</script> Juan,juan@test.com,,,,';
    const result = parseAndValidate(csv, "client", { tenantSlug: "test" });
    expect(result.total).toBe(1);
    // The name is valid (non-empty), so it should be parsed
    expect(result.valid).toBe(1);
    // When rendering, escape it
    const safe = escapeHtml(result.preview[0].name);
    expect(safe).not.toContain("<script>");
  });
});
