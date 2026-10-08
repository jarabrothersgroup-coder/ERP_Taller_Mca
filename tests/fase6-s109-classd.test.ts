/**
 * Sprint 109 — clase D de T-47: tests de comportamiento para 8 paths huérfanos
 * (escritura ∧ sin consumidor ∧ sin test).
 *
 * Universo (Docs/T47 balde "decidir/conectar"): sucursales (POST + PATCH/DELETE),
 * donaciones (POST + PATCH/DELETE), cierre de deal CRM, enroll de secuencia de
 * marketing, resolución de error de WhatsApp, estado de item DVI. De regalo,
 * los fixtures ejercitan también POST /dvi/:id/items y POST /dvi/:id/calculate-score
 * (otros dos de clase D) — el matching del escáner es por path, así que basta
 * un golpe por ruta.
 *
 * Patrón idéntico a tests/fase4-crud.test.ts: tenant propio "e2e-s109",
 * fixtures idempotentes, limpieza en afterAll, SQL crudo para aserciones
 * fuera del API. Cada test usa app.inject con object literal {method, url}
 * para que el scanner de T-63 cuente la cobertura.
 *
 * @module tests/fase6-s109-classd
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s109";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f109";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f10a";
const ADMIN_EMAIL = "admin@e2e-s109.test";
const TS = Date.now().toString(36);

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
    payload: { vehicleId, clientId, description: `Sprint 109 ${TS}` },
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
    VALUES (${TENANT_ID}, 'E2E Sprint 109', ${TENANT}, 'tenant_e2e_s109', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 109', 'admin', true)
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
  const limpiar = [
    `DELETE FROM audit_log WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM dvi_items WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM dvi_photos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM dvi_inspections WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM marketing_sequence_enrollments WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM marketing_sequence_log WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM marketing_sequence_steps WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM marketing_sequences WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM crm_deals WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM crm_pipeline_stages WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM whatsapp_errors_log WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM donaciones WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM sucursales WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM orden_repuestos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM ordenes_trabajo WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM vehiculos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM clients WHERE tenant_slug = '${TENANT}'`,
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
      console.error("[s109] cleanup falló:", stmt, err);
    }
  }
  if (app) await app.close();
});

// ─── /config/sucursales (requireAdmin) ────────────────────

describe("clase D — config/sucursales", () => {
  let sucId: string;

  it("POST /config/sucursales crea → 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/config/sucursales",
      headers: auth(),
      payload: { nombre: `Sucursal S109 ${TS}`, codigo: `S109${TS}`.slice(0, 20) },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(201);
    sucId = pickId(res.json(), "sucursal");
  });

  it("PATCH /config/sucursales/:id persiste → 200", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/config/sucursales/${sucId}`,
      headers: auth(),
      payload: { ciudad: "Asunción", gerente: `Gerente ${TS}` },
    });
    expect(res.statusCode, `PATCH → ${res.statusCode}: ${res.body}`).toBe(200);
    const leida = await q<{ ciudad: string; gerente: string }>`
      SELECT ciudad, gerente FROM sucursales WHERE id = ${sucId}`;
    expect(leida[0]?.ciudad).toBe("Asunción");
    expect(leida[0]?.gerente).toBe(`Gerente ${TS}`);
  });

  it("DELETE /config/sucursales/:id → 204", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/config/sucursales/${sucId}`,
      headers: auth(),
    });
    expect(res.statusCode, `DELETE → ${res.statusCode}: ${res.body}`).toBe(204);
  });
});

// ─── /finance/donaciones ──────────────────────────────────

describe("clase D — finance/donaciones", () => {
  let donId: string;

  it("POST /finance/donaciones → 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/donaciones",
      headers: auth(),
      payload: { beneficiario: `Fundación S109 ${TS}`, monto: 150000 },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(201);
    donId = pickId(res.json(), "donacion");
  });

  it("PATCH /finance/donaciones/:id persiste → 200", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/finance/donaciones/${donId}`,
      headers: auth(),
      payload: { descripcion: `Actualizada ${TS}` },
    });
    expect(res.statusCode, `PATCH → ${res.statusCode}: ${res.body}`).toBe(200);
    const leida = await q<{ descripcion: string }>`
      SELECT descripcion FROM donaciones WHERE id = ${donId}`;
    expect(leida[0]?.descripcion).toBe(`Actualizada ${TS}`);
  });

  it("DELETE /finance/donaciones/:id → 200", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/finance/donaciones/${donId}`,
      headers: auth(),
    });
    expect(res.statusCode, `DELETE → ${res.statusCode}: ${res.body}`).toBe(200);
    const restantes = await q<{ n: number }>`
      SELECT count(*)::int AS n FROM donaciones WHERE id = ${donId}`;
    expect(restantes[0].n).toBe(0);
  });
});

// ─── /crm/deals/:id/close ─────────────────────────────────

describe("clase D — crm/deals/:id/close", () => {
  let dealId: string;

  it("seed de stages + POST /crm/deals → 201", async () => {
    const seed = await app.inject({
      method: "POST",
      url: "/crm/stages/seed",
      headers: auth(),
      payload: {},
    });
    expect([200, 201], `seed → ${seed.statusCode}: ${seed.body}`).toContain(seed.statusCode);
    const stages = seed.json();
    const stageId = Array.isArray(stages) && stages.length > 0 ? stages[0].id : stages?.stages?.[0]?.id;
    expect(stageId, `sin stage en seed: ${seed.body}`).toBeTruthy();

    const res = await app.inject({
      method: "POST",
      url: "/crm/deals",
      headers: auth(),
      payload: { titulo: `Deal S109 ${TS}`, stageId, valorEstimado: 2500000 },
    });
    expect(res.statusCode, `POST deal → ${res.statusCode}: ${res.body}`).toBe(201);
    dealId = pickId(res.json(), "deal");
  });

  it("POST /crm/deals/:id/close cierra ganado → 200 + fechaCierre", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/crm/deals/${dealId}/close`,
      headers: auth(),
      payload: { ganado: true },
    });
    expect(res.statusCode, `close → ${res.statusCode}: ${res.body}`).toBe(200);
    const leido = await q<{ ganado: boolean; fecha_cierre: Date | null }>`
      SELECT ganado, fecha_cierre FROM crm_deals WHERE id = ${dealId}`;
    expect(leido[0]?.ganado).toBe(true);
    expect(leido[0]?.fecha_cierre).not.toBeNull();
  });
});

// ─── /marketing/sequences/:id/enroll ──────────────────────

describe("clase D — marketing/sequences/:id/enroll", () => {
  let seqId: string;

  it("POST /marketing/sequences → 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/marketing/sequences",
      headers: auth(),
      payload: {
        nombre: `Secuencia S109 ${TS}`,
        steps: [{ orden: 1, tipo: "whatsapp", mensaje: "¡Hola! Recordatorio de service." }],
      },
    });
    expect(res.statusCode, `POST sequence → ${res.statusCode}: ${res.body}`).toBe(201);
    seqId = pickId(res.json(), "secuencia");
  });

  it("POST /marketing/sequences/:id/enroll → 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/marketing/sequences/${seqId}/enroll`,
      headers: auth(),
      payload: { clienteNombre: `Cliente S109 ${TS}`, clientePhone: "0981000000" },
    });
    expect(res.statusCode, `enroll → ${res.statusCode}: ${res.body}`).toBe(201);
    const rows = await q<{ n: number }>`
      SELECT count(*)::int AS n FROM marketing_sequence_enrollments
      WHERE sequence_id = ${seqId}`;
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
  });
});

// ─── /whatsapp/errors/:errorId/resolve ────────────────────

describe("clase D — whatsapp/errors/:errorId/resolve", () => {
  let errorId: string;

  it("fixture: fila en whatsapp_errors_log", async () => {
    const rows = await q<{ id: string }>`
      INSERT INTO whatsapp_errors_log (source, operation, error_message, tenant_slug)
      VALUES ('whatsapp', 'send_message', ${`Fallo simulado S109 ${TS}`}, ${TENANT})
      RETURNING id`;
    errorId = rows[0].id;
    expect(errorId).toBeTruthy();
  });

  it("POST /whatsapp/errors/:errorId/resolve marca resuelto → 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/whatsapp/errors/${errorId}/resolve`,
      headers: auth(),
      payload: { notes: `Resuelto en Sprint 109 ${TS}` },
    });
    expect(res.statusCode, `resolve → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json().success).toBe(true);

    const leido = await q<{ resolved: boolean; resolution_notes: string | null }>`
      SELECT resolved, resolution_notes FROM whatsapp_errors_log WHERE id = ${errorId}`;
    expect(leido[0]?.resolved).toBe(true);
    expect(leido[0]?.resolution_notes).toBe(`Resuelto en Sprint 109 ${TS}`);
  });
});

// ─── /dvi/items/:itemId/status (+ items/calculate-score) ──

describe("clase D — dvi/items/:itemId/status", () => {
  let dviId: string;
  let itemId: string;

  it("fixtures: cliente + vehículo + OT + DVI → item (POST /dvi/:id/items)", async () => {
    const clientId = await crearCliente(`DVI S109 ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `S109${TS.slice(-5)}`.toUpperCase());
    const ordenId = await crearOrden(clientId, vehicleId);

    const dvi = await app.inject({
      method: "POST",
      url: "/dvi",
      headers: auth(),
      payload: { ordenTrabajoId: ordenId, inspector: `Inspector S109 ${TS}` },
    });
    expect(dvi.statusCode, `POST /dvi → ${dvi.statusCode}: ${dvi.body}`).toBe(201);
    dviId = pickId(dvi.json(), "dvi");

    const item = await app.inject({
      method: "POST",
      url: `/dvi/${dviId}/items`,
      headers: auth(),
      payload: { categoria: "FRENOS", descripcion: "Pastillas delanteras", estado: "OK", peso: 5 },
    });
    expect(item.statusCode, `POST items → ${item.statusCode}: ${item.body}`).toBe(201);
    itemId = pickId(item.json(), "item");
  });

  it("PATCH /dvi/items/:itemId/status cambia estado → 200", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/dvi/items/${itemId}/status`,
      headers: auth(),
      payload: { estado: "REQUIERE_ATENCION" },
    });
    expect(res.statusCode, `PATCH status → ${res.statusCode}: ${res.body}`).toBe(200);
    const leido = await q<{ estado: string }>`
      SELECT estado FROM dvi_items WHERE id = ${itemId}`;
    expect(leido[0]?.estado).toBe("REQUIERE_ATENCION");
  });

  it("POST /dvi/:id/calculate-score recalcula → 200 con healthScore", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/dvi/${dviId}/calculate-score`,
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode, `calculate-score → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(typeof res.json().healthScore).toBe("number");
  });
});
