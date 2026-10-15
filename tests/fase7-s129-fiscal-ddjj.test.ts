/**
 * Sprint 129 — DDJJ IVA (Formulario 120): workflow de estados.
 *
 * Cierra el ciclo de cumplimiento fiscal del mes: el motor fiscal ya
 * calculaba y listaba liquidaciones (POST/GET /finance/fiscal/form120),
 * pero el estado del período (BORRADOR → PRESENTADO → PAGADO/RECTIFICADO)
 * era inamovible. Este sprint agrega:
 *
 *   - PATCH /finance/fiscal/form120/estado — transición validada de workflow
 *   - Página web /dashboard/contabilidad/cumplimiento (consumidor FE)
 *
 * Cubre: cálculo + historial + transiciones válidas/inválidas + periodo
 * inexistente (404) + validación de esquema (400) + unidad de las
 * transiciones.
 *
 * Patrón fase7 (tenant propio "e2e-s129fis", fixtures SQL idempotentes,
 * app.inject con literales de ruta para el scanner de T-63).
 *
 * @module tests/fase7-s129-fiscal-ddjj
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";
import {
  assertTransicionForm120,
  transicionesPermitidas,
} from "../src/modules/finance/services/fiscal/form120.service.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s129fis";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f129";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4e129";
const ADMIN_EMAIL = "admin@e2e-s129fis.test";

/** Período de prueba (futuro, sin datos reales). */
const ANHO = 2030;
const MES = 5;

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
    VALUES (${TENANT_ID}, 'E2E Sprint 129 Fiscal', ${TENANT}, 'tenant_e2e_s129fis', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 129 Fiscal', 'admin', true)
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
  await q`DELETE FROM liquidaciones_iva WHERE tenant_slug = ${TENANT}`;
  await q`DELETE FROM periodos_fiscales WHERE tenant_slug = ${TENANT}`;
  await q`DELETE FROM profiles WHERE id = ${ADMIN_ID}`;
  await q`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
  await app?.close();
});

// ─── Workflow de estados (unidad) ─────────────────────────

describe("Sprint 129 · transiciones del workflow DDJJ (unidad)", () => {
  it("BORRADOR solo permite PRESENTADO", () => {
    expect(transicionesPermitidas("BORRADOR")).toEqual(["PRESENTADO"]);
  });

  it("PRESENTADO permite PAGADO y RECTIFICADO", () => {
    expect(transicionesPermitidas("PRESENTADO")).toEqual(["PAGADO", "RECTIFICADO"]);
  });

  it("RECTIFICADO permite re-presentar (PRESENTADO)", () => {
    expect(transicionesPermitidas("RECTIFICADO")).toEqual(["PRESENTADO"]);
  });

  it("PAGADO es estado final (sin transiciones)", () => {
    expect(transicionesPermitidas("PAGADO")).toEqual([]);
  });

  it("transiciones válidas no lanzan error", () => {
    expect(() => assertTransicionForm120("BORRADOR", "PRESENTADO")).not.toThrow();
    expect(() => assertTransicionForm120("PRESENTADO", "PAGADO")).not.toThrow();
    expect(() => assertTransicionForm120("PRESENTADO", "RECTIFICADO")).not.toThrow();
    expect(() => assertTransicionForm120("RECTIFICADO", "PRESENTADO")).not.toThrow();
  });

  it("transiciones inválidas lanzan ValidationError", () => {
    expect(() => assertTransicionForm120("BORRADOR", "PAGADO")).toThrow(/no permitida/);
    expect(() => assertTransicionForm120("BORRADOR", "RECTIFICADO")).toThrow(/no permitida/);
    expect(() => assertTransicionForm120("PAGADO", "PRESENTADO")).toThrow(/estado final/);
    expect(() => assertTransicionForm120("PAGADO", "RECTIFICADO")).toThrow(/estado final/);
    expect(() => assertTransicionForm120("RECTIFICADO", "PAGADO")).toThrow(/no permitida/);
    expect(() => assertTransicionForm120("INVENTADO", "PRESENTADO")).toThrow(/inválido/);
    expect(() => assertTransicionForm120("BORRADOR", "INVENTADO")).toThrow(/inválido/);
  });
});

// ─── Flujo HTTP completo ──────────────────────────────────

describe("Sprint 129 · DDJJ IVA Form 120 (HTTP)", () => {
  it(`POST /finance/fiscal/form120/calcular → 200 (crea liquidación BORRADOR)`, async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/fiscal/form120/calcular",
      headers: auth(),
      payload: { anho: ANHO, mes: MES },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.periodo).toMatchObject({ anho: ANHO, mes: MES });
    expect(body.ivaDebito).toBe("0.00");
    expect(body.ivaCredito).toBe("0.00");
    expect(typeof body.liquidacionId).toBe("string");
    expect(Array.isArray(body.alertas)).toBe(true);
  });

  it(`GET /finance/fiscal/form120 → 200 (incluye el período en BORRADOR)`, async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/fiscal/form120?limit=12",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const rows = res.json();
    const row = rows.find((r: any) => r.anho === ANHO && r.mes === MES);
    expect(row, JSON.stringify(rows)).toBeTruthy();
    expect(row.estado).toBe("BORRADOR");
  });

  it(`PATCH /finance/fiscal/form120/estado → 200 (BORRADOR → PRESENTADO)`, async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/finance/fiscal/form120/estado",
      headers: auth(),
      payload: { anho: ANHO, mes: MES, estado: "PRESENTADO" },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      periodo: { anho: ANHO, mes: MES },
      estado: "PRESENTADO",
    });
    expect(typeof body.liquidacionId).toBe("string");
    expect(typeof body.updatedAt).toBe("string");
  });

  it(`PATCH /finance/fiscal/form120/estado → 200 (PRESENTADO → PAGADO)`, async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/finance/fiscal/form120/estado",
      headers: auth(),
      payload: { anho: ANHO, mes: MES, estado: "PAGADO" },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().estado).toBe("PAGADO");
  });

  it(`PATCH /finance/fiscal/form120/estado PAGADO → RECTIFICADO → 422 (estado final)`, async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/finance/fiscal/form120/estado",
      headers: auth(),
      payload: { anho: ANHO, mes: MES, estado: "RECTIFICADO" },
    });
    expect(res.statusCode, res.body).toBe(422);
    expect(res.json().message).toMatch(/no permitida|estado final/);
  });

  it(`PATCH /finance/fiscal/form120/estado período sin liquidación → 404`, async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/finance/fiscal/form120/estado",
      headers: auth(),
      payload: { anho: 2030, mes: 6, estado: "PRESENTADO" },
    });
    expect(res.statusCode, res.body).toBe(404);
    expect(res.json().message).toMatch(/No existe liquidación/);
  });

  it(`PATCH /finance/fiscal/form120/estado estado fuera de enum → 400 (esquema)`, async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/finance/fiscal/form120/estado",
      headers: auth(),
      payload: { anho: ANHO, mes: MES, estado: "BORRADOR" },
    });
    expect(res.statusCode, res.body).toBe(400);
  });

  it(`PATCH /finance/fiscal/form120/estado sin x-tenant-slug → 403 (tenant-resolver)`, async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/finance/fiscal/form120/estado",
      headers: { authorization: `Bearer ${bearer}` },
      payload: { anho: ANHO, mes: MES, estado: "PRESENTADO" },
    });
    expect(res.statusCode, res.body).toBe(403);
  });

  it(`GET /finance/fiscal/form120 → 200 (el historial refleja PAGADO)`, async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/fiscal/form120?limit=12",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const row = res.json().find((r: any) => r.anho === ANHO && r.mes === MES);
    expect(row).toBeTruthy();
    expect(row.estado).toBe("PAGADO");
  });
});
