/**
 * Fase 4 — CRUD y features huérfanas (T-41/T-42 · auditoría 2026-09-25)
 *
 * Tests de banco reales (app real + BD migrada) que demuestran:
 *
 *   0028  Las 11 tablas huérfanas de marketing/fleet existen: los endpoints
 *         de esos módulos responden (antes: "relation ... does not exist" → 500).
 *   T-41  PATCH /workshop/proveedores/:id y PATCH /inventory/almacenes/:id
 *         persisten los cambios.
 *   T-42  Matriz CRUD completa por módulo:
 *         · campañas   — DELETE (tenant-scoped, 409 si ENVIADA, manager+)
 *         · flotas     — PATCH + DELETE soft (`activa = false`, manager+)
 *         · mecánicos  — DELETE soft (`activo = false`, persona e historial
 *                        de comisiones preservados, tenant vía profiles)
 *         · herramientas — DELETE = baja lógica con guarda de préstamos
 *         · DVI        — DELETE con cascada de fotos/items
 *         · guards     — 403 para roles por debajo de manager
 *                        (extendido en tests/security-role-matrix)
 *
 * Fixtures propias bajo el tenant "e2e-fase4" (idempotentes, limpias en
 * afterAll) para no depender de scripts/seed-test.sql.
 *
 * @module tests/fase4-crud
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-fase4";
const OTRO_TENANT = "e2e-fase4-otro";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f000";
// Segundo tenant REAL con su propio perfil y token: el auth-gate resuelve el
// perfil por (email, tenant del header) — sin esto un intento cross-tenant
// devuelve 401 (perfil inexistente en ese tenant) en vez de 404 (tenant-scoped).
const OTRO_TENANT_ID = "00000000-0000-0000-0000-0000e2e4f00b";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f001";
const OTRO_ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f00c";
const MECH_ID = "00000000-0000-0000-0000-0000e2e4f002";
const MECH_DEMO_ID = "00000000-0000-0000-0000-0000e2e4f003"; // mecánico a dar de baja
const ADMIN_EMAIL = "admin@e2e-fase4.test";
const OTRO_ADMIN_EMAIL = "admin@e2e-fase4-otro.test";
const MECH_EMAIL = "mecanico@e2e-fase4.test";
const MECH_DEMO_EMAIL = "mecanico-baja@e2e-fase4.test";
const TS = Date.now().toString(36);

let app: FastifyInstance;
let adminBearer: string;
let mechBearer: string;
let otroBearer: string;

// ─── Helpers ──────────────────────────────────────────────

function auth(slug: string = TENANT, who: "admin" | "mech" = "admin"): Record<string, string> {
  // Intentos cross-tenant usan el token del OTRO tenant (auth pasa; el
  // recurso no existe en ese tenant → 404).
  const bearer =
    slug !== TENANT ? otroBearer : who === "admin" ? adminBearer : mechBearer;
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": slug };
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

async function crearCliente(name: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/workshop/clientes",
    headers: auth(),
    payload: { name, email: `${name.replace(/\W+/g, "-").toLowerCase()}-${TS}@test.dev` },
  });
  expect([200, 201], `POST clientes → ${res.statusCode}: ${res.body}`).toContain(res.statusCode);
  return pickId(res.json(), "cliente");
}

async function crearVehiculo(clientId: string, plate: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/workshop/vehiculos",
    headers: auth(),
    payload: { brand: "Toyota", model: "Corolla", clientId, licensePlate: plate },
  });
  expect([200, 201], `POST vehiculos → ${res.statusCode}: ${res.body}`).toContain(res.statusCode);
  return pickId(res.json(), "vehiculo");
}

async function crearOrden(clientId: string, vehicleId: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/workshop/ordenes",
    headers: auth(),
    payload: { vehicleId, clientId, description: `CRUD Fase 4 ${TS}` },
  });
  expect([200, 201], `POST ordenes → ${res.statusCode}: ${res.body}`).toContain(res.statusCode);
  return pickId(res.json(), "orden");
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Fase 4', ${TENANT}, 'tenant_e2e_fase4', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${OTRO_TENANT_ID}, 'E2E Fase 4 B', ${OTRO_TENANT}, 'tenant_e2e_fase4_b', true)
    ON CONFLICT (slug) DO NOTHING`;
  for (const [id, email, name, role, tenantId] of [
    [ADMIN_ID, ADMIN_EMAIL, "Admin Fase 4", "admin", TENANT_ID],
    [MECH_ID, MECH_EMAIL, "Mecánico Fase 4", "mechanic", TENANT_ID],
    [MECH_DEMO_ID, MECH_DEMO_EMAIL, "Mecánico Baja Fase 4", "mechanic", TENANT_ID],
    [OTRO_ADMIN_ID, OTRO_ADMIN_EMAIL, "Admin Fase 4 B", "admin", OTRO_TENANT_ID],
  ] as const) {
    await sql`
      INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${id}, ${tenantId}, ${email}, ${name}, ${role}, true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;
  }

  adminBearer = generateToken({
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: "admin",
    tenantId: TENANT_ID,
    tenantSlug: TENANT,
  });
  mechBearer = generateToken({
    id: MECH_ID,
    email: MECH_EMAIL,
    role: "mechanic",
    tenantId: TENANT_ID,
    tenantSlug: TENANT,
  });
  otroBearer = generateToken({
    id: OTRO_ADMIN_ID,
    email: OTRO_ADMIN_EMAIL,
    role: "admin",
    tenantId: OTRO_TENANT_ID,
    tenantSlug: OTRO_TENANT,
  });

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  const limpiar = [
    `DELETE FROM audit_log WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM dvi_photos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM dvi_items WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM dvi_inspections WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM control_herramientas WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM tool_instances WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM herramientas WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM mechanic_profiles WHERE profile_id IN (SELECT id FROM profiles WHERE tenant_id = '${TENANT_ID}')`,
    `DELETE FROM fleets WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM fleet_contracts WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM marketing_campaigns WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM marketing_sequence_log WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM marketing_sequence_enrollments WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM marketing_sequence_steps WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM marketing_sequences WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM loyalty_transactions WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM loyalty_accounts WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM loyalty_rewards WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM google_reviews WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM proveedores WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM almacenes WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM orden_repuestos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM ordenes_trabajo WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM vehiculos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM clients WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM profiles WHERE tenant_id = '${TENANT_ID}'`,
    `DELETE FROM profiles WHERE tenant_id = '${OTRO_TENANT_ID}'`,
    `DELETE FROM tenants WHERE id = '${OTRO_TENANT_ID}'`,
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
      console.error("[fase4] cleanup falló:", stmt, err);
    }
  }
  if (app) await app.close();
});

// ─── 0028: módulos huérfanos viven ────────────────────────

describe("0028 — tablas huérfanas de marketing/fleet migradas", () => {
  it("los endpoints de los módulos responden (antes: relation does not exist → 500)", async () => {
    const urls = [
      "/marketing/campaigns",
      "/marketing/campaigns/stats",
      "/marketing/sequences",
      "/marketing/rewards",
      "/marketing/reviews",
      "/marketing/reviews/stats",
      "/fleet",
      "/fleet/billing/stats",
    ];
    for (const url of urls) {
      const res = await app.inject({ method: "GET", url, headers: auth() });
      expect(res.statusCode, `${url} → ${res.statusCode}: ${res.body}`).toBe(200);
    }
  });
});

// ─── T-41: PATCH que faltaba ──────────────────────────────

describe("T-41 — PATCH proveedores y almacenes persisten", () => {
  it("editar proveedor persiste", async () => {
    const creado = await app.inject({
      method: "POST",
      url: "/workshop/proveedores",
      headers: auth(),
      payload: { nombre: `Repuestos F4 ${TS}`, ruc: `800${TS.length}001` },
    });
    expect(creado.statusCode, `POST proveedores → ${creado.body}`).toBe(201);
    const id = pickId(creado.json(), "proveedor");

    const patch = await app.inject({
      method: "PATCH",
      url: `/workshop/proveedores/${id}`,
      headers: auth(),
      payload: { telefono: "0999 111 222" },
    });
    expect(patch.statusCode, `PATCH → ${patch.statusCode}: ${patch.body}`).toBe(200);

    const leido = await app.inject({ method: "GET", url: `/workshop/proveedores/${id}`, headers: auth() });
    expect(leido.statusCode).toBe(200);
    expect(String(leido.json().telefono)).toBe("0999 111 222");
  });

  it("editar almacén persiste", async () => {
    const creado = await app.inject({
      method: "POST",
      url: "/inventory/almacenes",
      headers: auth(),
      payload: { codigo: `F4-${TS}`, nombre: `Almacén F4 ${TS}` },
    });
    expect(creado.statusCode, `POST almacenes → ${creado.body}`).toBe(201);
    const id = pickId(creado.json(), "almacen");

    const patch = await app.inject({
      method: "PATCH",
      url: `/inventory/almacenes/${id}`,
      headers: auth(),
      payload: { nombre: `Almacén F4 editado ${TS}` },
    });
    expect(patch.statusCode, `PATCH → ${patch.statusCode}: ${patch.body}`).toBe(200);

    const leido = await app.inject({ method: "GET", url: `/inventory/almacenes/${id}`, headers: auth() });
    expect(leido.statusCode).toBe(200);
    expect(String(leido.json().nombre)).toBe(`Almacén F4 editado ${TS}`);
  });
});

// ─── T-42: campañas ───────────────────────────────────────

describe("T-42 — CRUD de campañas", () => {
  let campanaId: string;

  it("POST crea (antes la tabla no existía) y aparece en el listado", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/marketing/campaigns",
      headers: auth(),
      payload: { nombre: `Campaña F4 ${TS}`, tipo: "whatsapp", mensaje: "Recordatorio de servicio" },
    });
    expect(res.statusCode, `POST campaigns → ${res.statusCode}: ${res.body}`).toBe(201);
    campanaId = pickId(res.json(), "campaña");
    expect(res.json().estado).toBe("BORRADOR");

    const lista = await app.inject({ method: "GET", url: "/marketing/campaigns", headers: auth() });
    expect(lista.statusCode).toBe(200);
    expect(lista.json().some((c: any) => c.id === campanaId)).toBe(true);
  });

  it("DELETE exige manager+ (mecánico → 403)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/marketing/campaigns/${campanaId}`,
      headers: auth(TENANT, "mech"),
    });
    expect(res.statusCode).toBe(403);
  });

  it("DELETE es tenant-scoped (otro tenant → 404)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/marketing/campaigns/${campanaId}`,
      headers: auth(OTRO_TENANT),
    });
    expect(res.statusCode).toBe(404);
  });

  it("campaña ENVIADA → 409 (se conserva el historial)", async () => {
    await q`UPDATE marketing_campaigns SET estado = 'ENVIADA' WHERE id = ${campanaId}`;

    const res = await app.inject({
      method: "DELETE",
      url: `/marketing/campaigns/${campanaId}`,
      headers: auth(),
    });
    expect(res.statusCode, `DELETE enviada → ${res.statusCode}: ${res.body}`).toBe(409);

    const sigue = await q<{ n: number }>`
      SELECT count(*)::int AS n FROM marketing_campaigns WHERE id = ${campanaId}`;
    expect(sigue[0].n).toBe(1);
  });

  it("DELETE admin sobre campaña borrador → 200 y desaparece", async () => {
    await q`UPDATE marketing_campaigns SET estado = 'BORRADOR' WHERE id = ${campanaId}`;

    const res = await app.inject({
      method: "DELETE",
      url: `/marketing/campaigns/${campanaId}`,
      headers: auth(),
    });
    expect(res.statusCode, `DELETE → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json()).toEqual({ deleted: true });

    const lista = await app.inject({ method: "GET", url: "/marketing/campaigns", headers: auth() });
    expect(lista.json().some((c: any) => c.id === campanaId)).toBe(false);
  });
});

// ─── T-42: flotas ─────────────────────────────────────────

describe("T-42 — CRUD de flotas", () => {
  let fleetId: string;

  it("POST crea con forma camelCase (contratoTipo/descuentoPorcentaje)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/fleet",
      headers: auth(),
      payload: {
        nombre: `Flota F4 ${TS}`,
        empresa: `Empresa F4 ${TS}`,
        contacto: "Juan Pérez",
        telefono: "0981 000 111",
        ruc: `700${TS.length}002`,
        contratoTipo: "MENSUAL",
        descuentoPorcentaje: 10,
      },
    });
    expect(res.statusCode, `POST /fleet → ${res.statusCode}: ${res.body}`).toBe(201);
    const body = res.json();
    fleetId = pickId(body, "flota");
    expect(body.contratoTipo).toBe("MENSUAL");
    expect(Number(body.descuentoPorcentaje)).toBe(10);
  });

  it("PATCH actualiza y persiste", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/fleet/${fleetId}`,
      headers: auth(),
      payload: { contratoTipo: "ANUAL", descuentoPorcentaje: 15 },
    });
    expect(res.statusCode, `PATCH → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json().contratoTipo).toBe("ANUAL");

    const leido = await app.inject({ method: "GET", url: `/fleet/${fleetId}`, headers: auth() });
    expect(leido.statusCode).toBe(200);
    expect(leido.json().contratoTipo).toBe("ANUAL");
    expect(Number(leido.json().descuentoPorcentaje)).toBe(15);
  });

  it("DELETE exige manager+ (mecánico → 403)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/fleet/${fleetId}`,
      headers: auth(TENANT, "mech"),
    });
    expect(res.statusCode).toBe(403);
  });

  it("DELETE es tenant-scoped (otro tenant → 404)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/fleet/${fleetId}`,
      headers: auth(OTRO_TENANT),
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE admin → soft delete (activa=false, sale del listado, la fila se conserva)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/fleet/${fleetId}`,
      headers: auth(),
    });
    expect(res.statusCode, `DELETE → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json()).toEqual({ deleted: true });

    const lista = await app.inject({ method: "GET", url: "/fleet", headers: auth() });
    expect(lista.json().some((f: any) => f.id === fleetId)).toBe(false);

    const filas = await q<{ activa: boolean }>`
      SELECT activa FROM fleets WHERE id = ${fleetId}`;
    expect(filas).toHaveLength(1);
    expect(filas[0].activa).toBe(false);
  });
});

// ─── T-42: mecánicos (soft) ───────────────────────────────

describe("T-42 — baja soft de mecánicos", () => {
  let perfilMecanicoId: string;

  it("el perfil de mecánico existe y aparece en el listado", async () => {
    const filas = await q<{ id: string }>`
      INSERT INTO mechanic_profiles (profile_id, category, base_salary, commission_rate)
      VALUES (${MECH_DEMO_ID}, 'OFICIAL', 2500000, 5)
      RETURNING id`;
    perfilMecanicoId = filas[0].id;

    const lista = await app.inject({
      method: "GET",
      url: "/workshop/mechanic-profiles",
      headers: auth(),
    });
    expect(lista.statusCode).toBe(200);
    expect(lista.json().some((m: any) => m.id === perfilMecanicoId)).toBe(true);
  });

  it("DELETE exige manager+ (mecánico → 403)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/workshop/mechanic-profiles/${perfilMecanicoId}`,
      headers: auth(TENANT, "mech"),
    });
    expect(res.statusCode).toBe(403);
  });

  it("DELETE es tenant-scoped (otro tenant → 404)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/workshop/mechanic-profiles/${perfilMecanicoId}`,
      headers: auth(OTRO_TENANT),
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE admin → activo=false; la persona (profiles) se conserva", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/workshop/mechanic-profiles/${perfilMecanicoId}`,
      headers: auth(),
    });
    expect(res.statusCode, `DELETE → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json()).toEqual({ deleted: true });

    const perfil = await q<{ activo: boolean }>`
      SELECT activo FROM mechanic_profiles WHERE id = ${perfilMecanicoId}`;
    expect(perfil).toHaveLength(1);
    expect(perfil[0].activo).toBe(false);

    // La persona sigue existiendo (soft delete, no cascade)
    const persona = await q<{ n: number }>`
      SELECT count(*)::int AS n FROM profiles WHERE id = ${MECH_DEMO_ID}`;
    expect(persona[0].n).toBe(1);

    const lista = await app.inject({
      method: "GET",
      url: "/workshop/mechanic-profiles",
      headers: auth(),
    });
    expect(lista.json().some((m: any) => m.id === perfilMecanicoId)).toBe(false);
  });
});

// ─── T-42: herramientas (baja lógica) ─────────────────────

describe("T-42 — baja de herramientas", () => {
  let herramientaId: string;
  let ordenId: string;
  let controlId: string;

  it("POST crea con tenant propio y GET por id responde", async () => {
    const creado = await app.inject({
      method: "POST",
      url: "/inventory/herramientas",
      headers: auth(),
      payload: { codigo: `H-F4-${TS}`, nombre: `Llave dinamométrica F4` },
    });
    expect(creado.statusCode, `POST herramientas → ${creado.body}`).toBe(201);
    herramientaId = pickId(creado.json(), "herramienta");

    const leido = await app.inject({
      method: "GET",
      url: `/inventory/herramientas/${herramientaId}`,
      headers: auth(),
    });
    expect(leido.statusCode).toBe(200);
    expect(leido.json().activo).toBe(true);

    const filas = await q<{ tenant_slug: string }>`
      SELECT tenant_slug FROM herramientas WHERE id = ${herramientaId}`;
    expect(filas[0].tenant_slug).toBe(TENANT);
  });

  it("DELETE exige manager+ (mecánico → 403)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/inventory/herramientas/${herramientaId}`,
      headers: auth(TENANT, "mech"),
    });
    expect(res.statusCode).toBe(403);
  });

  it("GET/DELETE por id son tenant-scoped (otro tenant → 404)", async () => {
    const leido = await app.inject({
      method: "GET",
      url: `/inventory/herramientas/${herramientaId}`,
      headers: auth(OTRO_TENANT),
    });
    expect(leido.statusCode).toBe(404);

    const borrado = await app.inject({
      method: "DELETE",
      url: `/inventory/herramientas/${herramientaId}`,
      headers: auth(OTRO_TENANT),
    });
    expect(borrado.statusCode).toBe(404);
  });

  it("un préstamo activo bloquea la baja (409)", async () => {
    const clientId = await crearCliente(`Herr F4 ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `HF4${TS}`);
    ordenId = await crearOrden(clientId, vehicleId);

    const instancias = await q<{ id: string }>`
      INSERT INTO tool_instances (herramienta_id, numero_serie, costo_adquisicion,
                                  fecha_adquisicion, valor_actual_libros, tenant_slug)
      VALUES (${herramientaId}, ${`SF4-${TS}`}, 100, CURRENT_DATE, 100, ${TENANT})
      RETURNING id`;
    const controles = await q<{ id: string }>`
      INSERT INTO control_herramientas
        (herramienta_id, tool_instance_id, orden_trabajo_id, mecanico_id, mecanico_nombre, tenant_slug)
      VALUES (${herramientaId}, ${instancias[0].id}, ${ordenId}, ${MECH_ID}, 'Mecánico Fase 4', ${TENANT})
      RETURNING id`;
    controlId = controles[0].id;

    const res = await app.inject({
      method: "DELETE",
      url: `/inventory/herramientas/${herramientaId}`,
      headers: auth(),
    });
    expect(res.statusCode, `DELETE con préstamo → ${res.statusCode}: ${res.body}`).toBe(409);
    expect(res.json().message).toMatch(/prestad/i);
  });

  it("sin préstamos → baja lógica (activo=false, la fila se conserva)", async () => {
    await q`DELETE FROM control_herramientas WHERE id = ${controlId}`;
    await q`DELETE FROM tool_instances WHERE herramienta_id = ${herramientaId}`;

    const res = await app.inject({
      method: "DELETE",
      url: `/inventory/herramientas/${herramientaId}`,
      headers: auth(),
    });
    expect(res.statusCode, `DELETE → ${res.statusCode}: ${res.body}`).toBe(200);

    const filas = await q<{ activo: boolean }>`
      SELECT activo FROM herramientas WHERE id = ${herramientaId}`;
    expect(filas).toHaveLength(1);
    expect(filas[0].activo).toBe(false);
  });
});

// ─── T-42: DVI ────────────────────────────────────────────

describe("T-42 — DELETE de DVI con cascada", () => {
  let dviId: string;

  it("POST /dvi crea la inspección", async () => {
    const clientId = await crearCliente(`DVI F4 ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `DF4${TS}`);
    const ordenId = await crearOrden(clientId, vehicleId);

    const res = await app.inject({
      method: "POST",
      url: "/dvi",
      headers: auth(),
      payload: { ordenTrabajoId: ordenId, inspector: "Mecánico F4" },
    });
    expect(res.statusCode, `POST /dvi → ${res.statusCode}: ${res.body}`).toBe(201);
    dviId = pickId(res.json(), "dvi");

    await q`
      INSERT INTO dvi_photos (dvi_id, categoria, url, tenant_slug)
      VALUES (${dviId}, 'EXTERIOR', '/storage/e2e/f4.jpg', ${TENANT})`;
  });

  it("DELETE exige manager+ (mecánico → 403)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/dvi/${dviId}`,
      headers: auth(TENANT, "mech"),
    });
    expect(res.statusCode).toBe(403);
  });

  it("DELETE es tenant-scoped (otro tenant → 404)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/dvi/${dviId}`,
      headers: auth(OTRO_TENANT),
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE admin → borra la inspección y sus fotos (cascade)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/dvi/${dviId}`,
      headers: auth(),
    });
    expect(res.statusCode, `DELETE → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json()).toEqual({ deleted: true });

    const inspecciones = await q<{ n: number }>`
      SELECT count(*)::int AS n FROM dvi_inspections WHERE id = ${dviId}`;
    expect(inspecciones[0].n).toBe(0);

    const fotos = await q<{ n: number }>`
      SELECT count(*)::int AS n FROM dvi_photos WHERE dvi_id = ${dviId}`;
    expect(fotos[0].n).toBe(0);
  });
});
