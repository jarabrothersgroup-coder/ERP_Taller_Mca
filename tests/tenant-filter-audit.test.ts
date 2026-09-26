/**
 * T-21d — Auditoría de filtros de tenant + prueba de fuego cross-tenant
 *         (SEG-02, decisión (b): app-filtered con auditoría)
 *
 * La auditoría 2026-09-25 marcó SEG-02: RLS inerte (BYPASSRLS + default
 * ENABLE_REQUEST_TENANT_CONTEXT=false + set_config session-scoped en el pool
 * compartido) → el aislamiento real depende 100% de filtros app, de los que
 * una parte no filtraba tenant (INV-05 entre ellos).
 *
 * Este test cubre las dos patas de la decisión (b):
 *
 * 1. Techo de lookups sin tenant — ejecuta scripts/audit-tenant-filters.mjs
 *    (importado) y exige `withoutTenant <= CEILING`. El número NO puede
 *    crecer: cada fix lo baja y actualiza este techo.
 *
 * 2. Prueba de fuego cross-tenant — dos tenants aislados sobre el módulo de
 *    repuestos/movimientos: leer/escribir el id del otro tenant debe morir en
 *    404 (nunca 200), la lista nunca cruza, y un intento de salida sobre el
 *    repuesto ajeno no toca su stock.
 *
 * @module tests/tenant-filter-audit
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";
// @ts-expect-error — script .mjs sin declaraciones de tipos
import { runAudit } from "../scripts/audit-tenant-filters.mjs";

// ─── Techo vigente (medido; bajarlo con cada fix, jamás subirlo) ───
// Última medición: 372 tras el fix de INV-05 (stock.service.ts) y el filtro
// de listRepuestos/listStockMovements. Sitios restantes = checks de
// unicidad global (codigo unique) y filtros vía variable `whereClause`
// (cubiertos por la prueba de fuego de este archivo).
const CEILING = 372;

// ─── Fixtures: dos tenants espejo ────────────────────────────────────────

const TENANT_A = "e2e-tf-a";
const TENANT_B = "e2e-tf-b";
const TENANT_A_ID = "00000000-0000-0000-0000-0000e23d0000";
const TENANT_B_ID = "00000000-0000-0000-0000-0000e23d0001";
const ADMIN_A = "00000000-0000-0000-0000-0000e23d0010";
const ADMIN_B = "00000000-0000-0000-0000-0000e23d0011";

const CODIGO_A = "TF-A-001";
const CODIGO_B = "TF-B-001";

let app: FastifyInstance;
let tokenA: string;
let tokenB: string;
let repIdA: string;
let repIdB: string;
let stockAAfterSalida: number;

function h(slug: string, token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "x-tenant-slug": slug };
}

async function createRepuesto(slug: string, token: string, codigo: string, stock: number) {
  const res = await app.inject({
    method: "POST",
    url: "/inventory/repuestos",
    headers: h(slug, token),
    payload: { codigo, descripcion: `Prueba tenant ${codigo}`, stockActual: stock },
  });
  expect(res.statusCode).toBe(201);
  return res.json().id as string;
}

// ─── Auditoría (parte 1) ────────────────────────────────────────────────

describe("T-21d: techo de lookups sin filtro de tenant", () => {
  it(`sin tenant ≤ CEILING (${CEILING}) — el número no puede crecer`, () => {
    const r = runAudit();
    expect(r.sites).toBeGreaterThan(0);
    expect(r.tables).toBeGreaterThan(0);
    expect(r.withoutTenant).toBeLessThanOrEqual(CEILING);
    if (r.withoutTenant > 100) {
      console.warn(
        `[tenant-audit] ${r.withoutTenant}/${r.sites} lookups sin tenant. Top:`,
        Object.entries(r.byFile)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
      );
    }
  });
});

// ─── Prueba de fuego cross-tenant (parte 2) ─────────────────────────────

describe("T-21d: aislamiento cross-tenant en inventory (INV-05)", () => {
  beforeAll(async () => {
    const sql = getDb() as unknown as (
      strings: TemplateStringsArray,
      ...vals: unknown[]
    ) => Promise<unknown>;

    await sql`
      INSERT INTO tenants (id, name, slug, schema_name, is_active)
      VALUES
        (${TENANT_A_ID}, 'E2E Tenant A', ${TENANT_A}, 'tenant_e2e_tf_a', true),
        (${TENANT_B_ID}, 'E2E Tenant B', ${TENANT_B}, 'tenant_e2e_tf_b', true)
      ON CONFLICT (slug) DO NOTHING
    `;
    await sql`
      INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES
        (${ADMIN_A}, ${TENANT_A_ID}, 'admin@e2e-tf-a.test', 'Admin A', 'admin', true),
        (${ADMIN_B}, ${TENANT_B_ID}, 'admin@e2e-tf-b.test', 'Admin B', 'admin', true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true
    `;

    tokenA = generateToken({
      id: ADMIN_A,
      email: "admin@e2e-tf-a.test",
      role: "admin",
      tenantId: TENANT_A_ID,
      tenantSlug: TENANT_A,
    });
    tokenB = generateToken({
      id: ADMIN_B,
      email: "admin@e2e-tf-b.test",
      role: "admin",
      tenantId: TENANT_B_ID,
      tenantSlug: TENANT_B,
    });

    app = await buildApp();
    await app.ready();

    // createRepuesto debe estampar tenantSlug (antes caía al default 'demo')
    repIdA = await createRepuesto(TENANT_A, tokenA, CODIGO_A, 10);
    repIdB = await createRepuesto(TENANT_B, tokenB, CODIGO_B, 5);

    // Salida real de A: movimiento con tenant A + stock 10 → 8
    const salida = await app.inject({
      method: "POST",
      url: "/inventory/repuestos/salida",
      headers: h(TENANT_A, tokenA),
      payload: { repuestoId: repIdA, cantidad: 2, motivo: "Uso en OT" },
    });
    expect(salida.statusCode).toBe(200);

    const after = await app.inject({
      method: "GET",
      url: `/inventory/repuestos/${repIdA}`,
      headers: h(TENANT_A, tokenA),
    });
    expect(after.statusCode).toBe(200);
    stockAAfterSalida = after.json().stockActual;
    expect(stockAAfterSalida).toBe(8);
  });

  afterAll(async () => {
    try {
      const sql = getDb() as unknown as (
        strings: TemplateStringsArray,
        ...vals: unknown[]
      ) => Promise<unknown>;
      await sql`DELETE FROM stock_movements WHERE tenant_slug IN (${TENANT_A}, ${TENANT_B})`;
      await sql`DELETE FROM repuestos WHERE tenant_slug IN (${TENANT_A}, ${TENANT_B})`;
      await sql`DELETE FROM profiles WHERE tenant_id IN (${TENANT_A_ID}, ${TENANT_B_ID})`;
      await sql`DELETE FROM tenants WHERE id IN (${TENANT_A_ID}, ${TENANT_B_ID})`;
    } catch (err) {
      console.error("[tenant-filter-audit] cleanup falló:", err);
    }
    if (app) await app.close();
    const handles = (process as unknown as {
      _getActiveHandles?: () => Array<{ unref?: () => void }>;
    })._getActiveHandles?.() ?? [];
    for (const handle of handles) {
      if (handle && typeof handle.unref === "function") {
        try {
          handle.unref();
        } catch {
          /* ignore */
        }
      }
    }
  });

  it("GET :id del repuesto ajeno → 404 (nunca 200)", async () => {
    const asB = await app.inject({
      method: "GET",
      url: `/inventory/repuestos/${repIdA}`,
      headers: h(TENANT_B, tokenB),
    });
    expect(asB.statusCode).toBe(404);

    const asA = await app.inject({
      method: "GET",
      url: `/inventory/repuestos/${repIdA}`,
      headers: h(TENANT_A, tokenA),
    });
    expect(asA.statusCode).toBe(200);
    expect(asA.json().id).toBe(repIdA);
  });

  it("GET :id propio del otro tenant → 404 (recíproco)", async () => {
    const asA = await app.inject({
      method: "GET",
      url: `/inventory/repuestos/${repIdB}`,
      headers: h(TENANT_A, tokenA),
    });
    expect(asA.statusCode).toBe(404);
  });

  it("lista de repuestos nunca cruza tenants", async () => {
    const listA = await app.inject({
      method: "GET",
      url: "/inventory/repuestos",
      headers: h(TENANT_A, tokenA),
    });
    expect(listA.statusCode).toBe(200);
    const bodyA = listA.body;
    expect(bodyA).toContain(CODIGO_A);
    expect(bodyA).not.toContain(CODIGO_B);

    const listB = await app.inject({
      method: "GET",
      url: "/inventory/repuestos",
      headers: h(TENANT_B, tokenB),
    });
    expect(listB.statusCode).toBe(200);
    expect(listB.body).toContain(CODIGO_B);
    expect(listB.body).not.toContain(CODIGO_A);
  });

  it("PATCH sobre el repuesto ajeno → 404 (sin escritura cross-tenant)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/inventory/repuestos/${repIdA}`,
      headers: h(TENANT_B, tokenB),
      payload: { descripcion: "intento cross-tenant" },
    });
    expect(res.statusCode).toBe(404);

    // el valor original quedó intacto
    const asA = await app.inject({
      method: "GET",
      url: `/inventory/repuestos/${repIdA}`,
      headers: h(TENANT_A, tokenA),
    });
    expect(asA.json().descripcion).not.toBe("intento cross-tenant");
  });

  it("salida sobre el repuesto ajeno → 404 y el stock de A no cambia", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/inventory/repuestos/salida",
      headers: h(TENANT_B, tokenB),
      payload: { repuestoId: repIdA, cantidad: 3, motivo: "Robo" },
    });
    expect(res.statusCode).toBe(404);

    const after = await app.inject({
      method: "GET",
      url: `/inventory/repuestos/${repIdA}`,
      headers: h(TENANT_A, tokenA),
    });
    expect(after.statusCode).toBe(200);
    expect(after.json().stockActual).toBe(stockAAfterSalida);
  });

  it("movimientos de stock nunca cruzan tenants", async () => {
    const movA = await app.inject({
      method: "GET",
      url: "/inventory/stock-movements",
      headers: h(TENANT_A, tokenA),
    });
    expect(movA.statusCode).toBe(200);
    expect(movA.body).toContain(repIdA);

    const movB = await app.inject({
      method: "GET",
      url: "/inventory/stock-movements",
      headers: h(TENANT_B, tokenB),
    });
    expect(movB.statusCode).toBe(200);
    expect(movB.body).not.toContain(repIdA);
    expect(movB.body).not.toContain(CODIGO_A);
  });
});
