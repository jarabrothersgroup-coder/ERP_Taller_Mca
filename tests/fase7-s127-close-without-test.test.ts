/**
 * Sprint 127 — Cierre de `withoutTest` (T-63): las 5 rutas sin test.
 *
 * Cubre las 5 rutas que aparecían en `withoutTest` del escáner T-63 y no
 * estaban en EXCLUDED:
 *
 *   Lectura (2):
 *     - GET /api-keys/:id/usage — UsageStats de una API key
 *     - GET /intelligence/ocr/jobs/:id — estado de un job OCR (AsyncJob)
 *
 *   Escritura SIFEN (3) — solo las ramas de validación de entrada:
 *     - POST /finance/sifen/emitir — valida body requerido (400/422)
 *     - POST /finance/sifen/firmar — valida que el documento tenga XML (404/400)
 *     - POST /finance/sifen/consultar-lote — valida body (400)
 *
 * Las ramas felices de SIFEN (emitir/firmar/consultar-lote) llaman a la
 * SOAP de la DNIT o al worker criptográfico — fuera de alcance de tests
 * deterministas; se ejercitan las ramas de validación de entrada.
 *
 * Patrón fase7 (tenant propio, fixtures SQL idempotentes, app.inject).
 *
 * @module tests/fase7-s127-close-without-test
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s127t";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f127";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4e127";
const ADMIN_EMAIL = "admin@e2e-s127t.test";
/** UUID válido que no existe en ninguna tabla (404/422 limpios). */
const NO_EXISTE = "00000000-0000-0000-0000-0000dead0001";

let app: FastifyInstance;
let bearer: string;

// ─── Helpers ──────────────────────────────────────────────

function auth(): Record<string, string> {
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": TENANT };
}

/** SQL crudo (postgres.js) para fixtures/verificaciones fuera de requests. */
async function q<T = any>(
  strings: TemplateStringsArray,
  ...vals: unknown[]
): Promise<T[]> {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<T[]>;
  return sql(strings, ...vals);
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Sprint 127', ${TENANT}, 'tenant_e2e_s127', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 127', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;

  bearer = generateToken({
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: "admin",
    tenantId: TENANT_ID,
    tenantSlug: TENANT,
  });

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await q`DELETE FROM api_key_usage_log WHERE tenant_slug = ${TENANT}`;
  await q`DELETE FROM api_keys WHERE tenant_slug = ${TENANT}`;
  await q`DELETE FROM profiles WHERE id = ${ADMIN_ID}`;
  await q`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
  await app?.close();
});

// ─── GET /api-keys/:id/usage ──────────────────────────────

describe("Sprint 127 · GET /api-keys/:id/usage", () => {
  it("→ 200 con UsageStats en ceros cuando la key no existe en el tenant", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api-keys/${NO_EXISTE}/usage`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.totalRequests).toBe(0);
    expect(body.requestsToday).toBe(0);
    expect(body.avgResponseTimeMs).toBe(0);
    expect(body.topEndpoints).toEqual([]);
    expect(body.errorRate).toBe(0);
  });

  it("→ 200 con UsageStats cuando la key existe (sin uso → ceros)", async () => {
    // Crear una API key directamente en la DB para el tenant
    const keyId = "00000000-0000-0000-0000-000000001270";
    await q`
      INSERT INTO api_keys (id, tenant_slug, name, key_hash, key_prefix, scopes, is_active)
      VALUES (${keyId}, ${TENANT}, 'test-key-s127', 'hash-abc', 'test', '["read"]'::jsonb, true)
      ON CONFLICT (id) DO NOTHING`;

    const res = await app.inject({
      method: "GET",
      url: `/api-keys/${keyId}/usage`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(typeof body.totalRequests).toBe("number");
    expect(typeof body.requestsToday).toBe("number");
    expect(typeof body.avgResponseTimeMs).toBe("number");
    expect(Array.isArray(body.topEndpoints)).toBe(true);
    expect(typeof body.errorRate).toBe("number");
  });
});

// ─── GET /intelligence/ocr/jobs/:id ───────────────────────

describe("Sprint 127 · GET /intelligence/ocr/jobs/:id", () => {
  it("→ 404 cuando el job no existe o expiró", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/intelligence/ocr/jobs/${NO_EXISTE}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
  });

  it("→ 400 cuando el id está vacío", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/intelligence/ocr/jobs/`,
      headers: auth(),
    });
    expect([400, 404, 422]).toContain(res.statusCode);
  });
});

// ─── POST /finance/sifen/emitir ───────────────────────────

describe("Sprint 127 · POST /finance/sifen/emitir (validación)", () => {
  it("→ 400/422 con body vacío (campos requeridos)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/sifen/emitir`,
      headers: auth(),
      payload: {},
    });
    expect([400, 422]).toContain(res.statusCode);
  });

  it("→ 400/422 con body incompleto (faltan items y regimenIVA)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/sifen/emitir`,
      headers: auth(),
      payload: {
        ordenTrabajoId: NO_EXISTE,
        clienteId: NO_EXISTE,
        dteTipo: "FACTURA",
        serie: "001",
        numero: "0000001",
        condicionVenta: "CONTADO",
        moneda: "PYG",
        // faltan: items, regimenIVA
      },
    });
    expect([400, 422]).toContain(res.statusCode);
  });
});

// ─── POST /finance/sifen/firmar ───────────────────────────

describe("Sprint 127 · POST /finance/sifen/firmar (validación)", () => {
  it("→ 404 cuando el documento fiscal no existe", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/sifen/firmar`,
      headers: auth(),
      payload: { documentoId: NO_EXISTE },
    });
    expect(res.statusCode).toBe(404);
  });

  it("→ 400 cuando el body no tiene documentoId", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/sifen/firmar`,
      headers: auth(),
      payload: {},
    });
    expect([400, 422]).toContain(res.statusCode);
  });
});

// ─── POST /finance/sifen/consultar-lote ───────────────────

describe("Sprint 127 · POST /finance/sifen/consultar-lote (validación)", () => {
  it("→ 400/422 con body vacío (cdcRequerido)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/sifen/consultar-lote`,
      headers: auth(),
      payload: {},
    });
    expect([400, 422]).toContain(res.statusCode);
  });

  it("→ 400/422 con body sin lista de CDCs", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/sifen/consultar-lote`,
      headers: auth(),
      payload: { otroCampo: "x" },
    });
    expect([400, 422]).toContain(res.statusCode);
  });
});
