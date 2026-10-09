/**
 * Sprint 116 — Cobertura de escritura lote 3 (backlog T-61).
 *
 * 11 ops de escritura sin test: 5 calculadoras fiscales DNIT (cálculo puro
 * + persistencia de liquidaciones) y 6 de CRM deals/stages (CRUD pipeline).
 * Patrón fase7 (tenant propio "e2e-s116", fixtures SQL idempotentes,
 * app.inject con template literals para el scanner de T-63).
 *
 * Rutas cubiertas:
 *   - POST /finance/fiscal/form120/calcular
 *   - POST /finance/fiscal/ire/calcular
 *   - POST /finance/fiscal/idu/calcular
 *   - POST /finance/fiscal/isc/calcular
 *   - POST /finance/fiscal/inr/calcular
 *   - POST /crm/stages
 *   - POST /crm/stages/seed
 *   - PATCH /crm/stages/:id
 *   - DELETE /crm/stages/:id
 *   - POST /crm/deals
 *   - PATCH /crm/deals/:id
 *   - POST /crm/deals/:id/move
 *   - POST /crm/deals/:id/close
 *   - DELETE /crm/deals/:id
 *
 * @module tests/fase7-s116-write-coverage
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s116";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f116";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f11e";
const ADMIN_EMAIL = "admin@e2e-s116.test";
const TS = Date.now().toString(36);

let app: FastifyInstance;
let bearer: string;

// IDs de fixtures compartidos entre tests
let stageId: string;
let stage2Id: string;
let dealId: string;

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

function pickId(body: any, label: string): string {
  const id = body?.id ?? body?.data?.id;
  if (!id || typeof id !== "string") {
    throw new Error(`${label}: sin id en respuesta: ${JSON.stringify(body)}`);
  }
  return id;
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  app = await buildApp();

  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Sprint 116', ${TENANT}, 'tenant_e2e_s116', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 116', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;

  bearer = generateToken({
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: "admin",
    tenantId: TENANT_ID,
    tenantSlug: TENANT,
  });
});

afterAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`DELETE FROM crm_deals WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM crm_pipeline_stages WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM liquidaciones_inr WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM liquidaciones_isc WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM liquidaciones_idu WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM liquidaciones_ire WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM liquidaciones_iva WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM periodos_fiscales WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM profiles WHERE id = ${ADMIN_ID}`;
  await sql`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
  await app?.close();
});

// ─── Fiscal calculators ───────────────────────────────────

describe("Sprint 116 · Fiscal calculators", () => {
  it("POST /finance/fiscal/form120/calcular calcula IVA y persiste liquidación", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/fiscal/form120/calcular",
      headers: auth(),
      payload: { anho: 2026, mes: 9 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.periodo).toEqual({ anho: 2026, mes: 9 });
    expect(body.ventas).toHaveProperty("gravada10");
    expect(body.ventas).toHaveProperty("iva10");
    expect(body.compras).toHaveProperty("gravada10");
    expect(typeof body.liquidacionId).toBe("string");
  });

  it("POST /finance/fiscal/form120/calcular mes fuera de rango → 400 (schema)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/fiscal/form120/calcular",
      headers: auth(),
      payload: { anho: 2026, mes: 13 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /finance/fiscal/ire/calcular calcula IRE y persiste liquidación", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/fiscal/ire/calcular",
      headers: auth(),
      payload: { anho: 2026, formulario: "FORM_500_IRE" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.periodo).toEqual({ anho: 2026 });
    expect(body.formulario).toBe("FORM_500_IRE");
    expect(body.ingresos).toHaveProperty("brutos");
    expect(typeof body.liquidacionId).toBe("string");
  });

  it("POST /finance/fiscal/ire/calcular formulario inválido → 400 (schema)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/fiscal/ire/calcular",
      headers: auth(),
      payload: { anho: 2026, formulario: "FORM_INVALIDO" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /finance/fiscal/idu/calcular usa última liquidación IRE", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/fiscal/idu/calcular",
      headers: auth(),
      payload: { anho: 2026, tipoBeneficiario: "RESIDENTE" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("impuestoIdu");
    expect(typeof body.liquidacionId).toBe("string");
  });

  it("POST /finance/fiscal/idu/calcular sin IRE previo → 404", async () => {
    // Año sin liquidación IRE en este tenant
    const res = await app.inject({
      method: "POST",
      url: "/finance/fiscal/idu/calcular",
      headers: auth(),
      payload: { anho: 2025 },
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /finance/fiscal/isc/calcular calcula ISC por rubro", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/fiscal/isc/calcular",
      headers: auth(),
      payload: {
        anho: 2026,
        mes: 9,
        rubro: "COMBUSTIBLE",
        baseImponible: 10000000,
        tasa: 0.10,
        tipoTasa: "PORCENTUAL",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("impuestoIsc");
    expect(body.rubro).toBe("COMBUSTIBLE");
  });

  it("POST /finance/fiscal/isc/calcular tasa inválida → 400 (schema)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/fiscal/isc/calcular",
      headers: auth(),
      payload: {
        anho: 2026,
        mes: 9,
        rubro: "COMBUSTIBLE",
        baseImponible: 100,
        tasa: -1,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /finance/fiscal/inr/calcular calcula retención INR", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/fiscal/inr/calcular",
      headers: auth(),
      payload: {
        anho: 2026,
        mes: 9,
        tipoRenta: "SERVICIOS_TECNICOS",
        beneficiarioNombre: "Proveedor Extranjero",
        beneficiarioPais: "BR",
        montoBruto: 5000000,
        tasaRetencion: 0.15,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("impuestoInr");
    expect(body.tipoRenta).toBe("SERVICIOS_TECNICOS");
  });

  it("POST /finance/fiscal/inr/calcular tasa > 1 → 400 (schema)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/fiscal/inr/calcular",
      headers: auth(),
      payload: {
        anho: 2026,
        mes: 9,
        tipoRenta: "INTERESES",
        montoBruto: 100,
        tasaRetencion: 1.5,
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── CRM stages ───────────────────────────────────────────

describe("Sprint 116 · CRM stages", () => {
  it("POST /crm/stages crea stage y devuelve 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/stages",
      headers: auth(),
      payload: { nombre: `Lead S116 ${TS}`, color: "#ff0000" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.nombre).toBe(`Lead S116 ${TS}`);
    stageId = pickId(body, "stage");
  });

  it("POST /crm/stages sin nombre → 400 (schema)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/stages",
      headers: auth(),
      payload: { color: "#00ff00" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /crm/stages/seed crea stages por defecto idempotente", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/stages/seed",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    expect(res.json().length).toBeGreaterThan(0);
  });

  it("PATCH /crm/stages/:id actualiza nombre", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/crm/stages/${stageId}`,
      headers: auth(),
      payload: { nombre: `Qualified S116 ${TS}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().nombre).toBe(`Qualified S116 ${TS}`);
  });

  it("DELETE /crm/stages/:id devuelve 204", async () => {
    // Crear stage temporal para borrar
    const created = await app.inject({
      method: "POST",
      url: "/crm/stages",
      headers: auth(),
      payload: { nombre: `Temp S116 ${TS}` },
    });
    const tempId = pickId(created.json(), "temp-stage");

    const res = await app.inject({
      method: "DELETE",
      url: `/crm/stages/${tempId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(204);
  });
});

// ─── CRM deals ────────────────────────────────────────────

describe("Sprint 116 · CRM deals", () => {
  beforeAll(async () => {
    // Crear un segundo stage para move
    const s2 = await app.inject({
      method: "POST",
      url: "/crm/stages",
      headers: auth(),
      payload: { nombre: `Negociación S116 ${TS}` },
    });
    stage2Id = pickId(s2.json(), "stage2");
  });

  it("POST /crm/deals crea deal y devuelve 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/deals",
      headers: auth(),
      payload: {
        titulo: `OT nueva S116 ${TS}`,
        stageId,
        clienteNombre: "Cliente CRM",
        valorEstimado: 2500000,
        probabilidad: 60,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.titulo).toBe(`OT nueva S116 ${TS}`);
    expect(body.stageId).toBe(stageId);
    dealId = pickId(body, "deal");
  });

  it("POST /crm/deals sin titulo → 400 (schema)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/deals",
      headers: auth(),
      payload: { stageId },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /crm/deals sin stageId → 400 (schema)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/deals",
      headers: auth(),
      payload: { titulo: "Sin stage" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("PATCH /crm/deals/:id actualiza valor estimado", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/crm/deals/${dealId}`,
      headers: auth(),
      payload: { valorEstimado: 3000000, probabilidad: 80 },
    });
    expect(res.statusCode).toBe(200);
    expect(Number(res.json().valorEstimado)).toBe(3000000);
    expect(res.json().probabilidad).toBe(80);
  });

  it("POST /crm/deals/:id/move mueve a otro stage", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/crm/deals/${dealId}/move`,
      headers: auth(),
      payload: { stageId: stage2Id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().stageId).toBe(stage2Id);
  });

  it("POST /crm/deals/:id/close ganado=true cierra el deal", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/crm/deals/${dealId}/close`,
      headers: auth(),
      payload: { ganado: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ganado).toBe(true);
    expect(res.json().fechaCierre).toBeTruthy();
  });

  it("DELETE /crm/deals/:id devuelve 204", async () => {
    // Crear deal temporal para borrar
    const created = await app.inject({
      method: "POST",
      url: "/crm/deals",
      headers: auth(),
      payload: { titulo: `Temp deal S116 ${TS}`, stageId },
    });
    const tempId = pickId(created.json(), "temp-deal");

    const res = await app.inject({
      method: "DELETE",
      url: `/crm/deals/${tempId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(204);
  });
});
