/**
 * Sprint 112 — regresión de conciliación bancaria + triaje T-47.
 *
 * `cerrarConciliacion` usaba `sql\`id = ANY(${ids}::uuid[])\`` en crudo:
 * drizzle expande el array a `ANY(($1,$2)::uuid[])` y postgres rechaza el
 * cast `record → uuid[]` → 500 con cualquier lista de ≥1 movimiento (el
 * mismo bug que Sprint 111 corrigió en journal-consolidation.service.ts).
 * Fix: migrado a `inArray()` (treasury.service.ts). Este fichero es la
 * red que impide regresar al patrón roto y además saca de "sin test" los
 * 3 paths de `/finance/treasury/conciliacion`.
 *
 * Patrón idéntico a tests/fase7-s110-classd2.test.ts: tenant propio
 * "e2e-s112", fixtures SQL idempotentes, limpieza en afterAll, SQL crudo
 * para aserciones fuera del API. Cada test usa app.inject con template
 * literal para que el scanner de T-63 cuente la cobertura.
 *
 * @module tests/fase7-s112-treasury
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s112";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f112";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f11b";
const ADMIN_EMAIL = "admin@e2e-s112.test";
const TS = Date.now().toString(36);

let app: FastifyInstance;
let bearer: string;

let cuentaId: string;
let mov1Id: string;
let mov2Id: string;
let conciliacionId: string;

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
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Sprint 112', ${TENANT}, 'tenant_e2e_s112', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 112', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;

  bearer = generateToken({
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: "admin",
    tenantId: TENANT_ID,
    tenantSlug: TENANT,
  });

  // ── Fixture SQL: cuenta bancaria + 2 movimientos ──
  cuentaId = crypto.randomUUID();
  await sql`
    INSERT INTO cuentas_bancarias (id, codigo, nombre, tipo, tenant_slug)
    VALUES (${cuentaId}, ${`TB112${TS}`.slice(0, 20)}, 'Cuenta S112', 'CTA_CTE', ${TENANT})`;

  mov1Id = crypto.randomUUID();
  mov2Id = crypto.randomUUID();
  await sql`
    INSERT INTO movimientos_tesoreria
      (id, tipo, medio_pago, cuenta_id, monto, fecha, concepto, tenant_slug)
    VALUES
      (${mov1Id}, 'INGRESO', 'TRANSFERENCIA', ${cuentaId}, 100000,
       '2045-12-10T12:00:00Z', ${`Cobro S112 ${TS}`}, ${TENANT}),
      (${mov2Id}, 'EGRESO', 'TRANSFERENCIA', ${cuentaId}, 40000,
       '2045-12-11T12:00:00Z', ${`Pago S112 ${TS}`}, ${TENANT})`;

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  const limpiar = [
    `DELETE FROM audit_log WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM movimientos_tesoreria WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM conciliacion_bancaria WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM cuentas_bancarias WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM profiles WHERE tenant_id = '${TENANT_ID}'`,
    `DELETE FROM tenants WHERE id = '${TENANT_ID}'`,
  ];
  const sql = getDb() as unknown as {
    (s: TemplateStringsArray, ...v: unknown[]): Promise<unknown>;
    unsafe: (stmt: string) => Promise<unknown>;
  };
  for (const stmt of limpiar) {
    try {
      await sql.unsafe(stmt);
    } catch (err) {
      console.error("[s112] cleanup falló:", stmt, err);
    }
  }
  if (app) await app.close();
});

// ─── /finance/treasury/conciliacion ───────────────────────

describe("regresión — finance/treasury/conciliacion", () => {
  it("POST /finance/treasury/conciliacion inicia → 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/treasury/conciliacion`,
      headers: auth(),
      payload: { cuentaId, periodo: "2045-12", saldoBanco: "0" },
    });
    expect(res.statusCode, `iniciar → ${res.statusCode}: ${res.body}`).toBe(201);
    conciliacionId = pickId(res.json(), "conciliacion");
    expect(res.json().conciliado).toBe(false);
  });

  it("POST /finance/treasury/conciliacion/:id/cerrar con 2 movimientos → 200 (regresión ANY → inArray)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/treasury/conciliacion/${conciliacionId}/cerrar`,
      headers: auth(),
      payload: { movimientoIds: [mov1Id, mov2Id] },
    });
    expect(res.statusCode, `cerrar → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json().conciliado).toBe(true);

    const movs = await q<{ id: string; conciliado: boolean; fecha_conciliacion: string | null }>`
      SELECT id, conciliado, fecha_conciliacion FROM movimientos_tesoreria
      WHERE id IN (${mov1Id}, ${mov2Id}) ORDER BY id`;
    expect(movs).toHaveLength(2);
    for (const m of movs) {
      expect(m.conciliado, `movimiento ${m.id} no quedó conciliado`).toBe(true);
      expect(m.fecha_conciliacion).not.toBeNull();
    }
  });

  it("POST cerrar con lista vacía cierra sin marcar → 200", async () => {
    const otra = await app.inject({
      method: "POST",
      url: `/finance/treasury/conciliacion`,
      headers: auth(),
      payload: { cuentaId, periodo: "2045-11", saldoBanco: "0" },
    });
    expect(otra.statusCode, `iniciar 2 → ${otra.statusCode}: ${otra.body}`).toBe(201);
    const id2 = pickId(otra.json(), "conciliacion 2");

    const res = await app.inject({
      method: "POST",
      url: `/finance/treasury/conciliacion/${id2}/cerrar`,
      headers: auth(),
      payload: { movimientoIds: [] },
    });
    expect(res.statusCode, `cerrar vacío → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json().conciliado).toBe(true);
  });

  it("POST cerrar de conciliación inexistente → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/treasury/conciliacion/${crypto.randomUUID()}/cerrar`,
      headers: auth(),
      payload: { movimientoIds: [mov1Id] },
    });
    expect(res.statusCode, `cerrar 404 → ${res.statusCode}: ${res.body}`).toBe(404);
  });

  it("GET /finance/treasury/conciliacion/:cuentaId lista → 200", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/treasury/conciliacion/${cuentaId}`,
      headers: auth(),
    });
    expect(res.statusCode, `list → ${res.statusCode}: ${res.body}`).toBe(200);
    const lista = res.json();
    expect(Array.isArray(lista)).toBe(true);
    expect(lista.length).toBeGreaterThanOrEqual(2);
    expect(lista.some((c: any) => c.id === conciliacionId)).toBe(true);
  });
});
