/**
 * Sprint 119 — Regresión: serializador de schema en GET /config/sucursales.
 *
 * Descubierto por la e2e de flujos UI 113 (Sprint 119): la respuesta del
 * listado usaba `items: { type: "object" }` en el schema de respuesta, lo que
 * hacía que fast-json-stringify serializara cada fila como `{}` (pérdida
 * total de datos → tabla de Sucursales vacía en la UI). El fix añade
 * `additionalProperties: true` (los endpoints sin schema de respuesta ya
 * devolvían la fila completa).
 *
 * Este test fija que el listado devuelva las filas con sus campos, para que
 * la regresión no se repita.
 *
 * @module tests/fase7-s119-sucursales-list
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

const TENANT = "e2e-s119s";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f1a1";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4fd11";
const ADMIN_EMAIL = "admin@e2e-s119s.test";
const SUCURSAL_ID = "00000000-0000-0000-0000-0000e2e4fd21";
const SUCURSAL_CODIGO = "SCR-S119-LIST";
const SUCURSAL_NOMBRE = "Sucursal Legado Sprint 119";

let app: FastifyInstance;
let bearer: string;

function auth(): Record<string, string> {
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": TENANT };
}

beforeAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Sprint 119 Sucs', ${TENANT}, 'tenant_e2e_s119s', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 119 Sucs', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;
  await sql`
    INSERT INTO sucursales (id, nombre, codigo, activa, tenant_slug)
    VALUES (${SUCURSAL_ID}, ${SUCURSAL_NOMBRE}, ${SUCURSAL_CODIGO}, true, ${TENANT})
    ON CONFLICT (codigo) DO NOTHING`;

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
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`DELETE FROM sucursales WHERE codigo = ${SUCURSAL_CODIGO}`;
  await sql`DELETE FROM profiles WHERE id = ${ADMIN_ID}`;
  await sql`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
  await app?.close();
});

describe("GET /config/sucursales (serializador de respuesta)", () => {
  it("devuelve las filas con sus campos (no `{}`) tras el fix de schema", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/config/sucursales",
      headers: auth(),
    });

    expect(res.statusCode).toBe(200);
    const rows = res.json() as Array<Record<string, unknown>>;
    expect(Array.isArray(rows)).toBe(true);

    const creada = rows.find((r) => r.codigo === SUCURSAL_CODIGO);
    expect(creada).toBeDefined();
    expect(creada!.nombre).toBe(SUCURSAL_NOMBRE);
    expect(creada!.activa).toBe(true);
    expect(creada!.id).toBe(SUCURSAL_ID);
    expect(Object.keys(creada!).length).toBeGreaterThan(3);
  });

  it("GET /config/sucursales/:id sigue devolviendo la fila completa", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/config/sucursales/${SUCURSAL_ID}`,
      headers: auth(),
    });

    expect(res.statusCode).toBe(200);
    const row = res.json() as Record<string, unknown>;
    expect(row.codigo).toBe(SUCURSAL_CODIGO);
    expect(row.activa).toBe(true);
  });
});