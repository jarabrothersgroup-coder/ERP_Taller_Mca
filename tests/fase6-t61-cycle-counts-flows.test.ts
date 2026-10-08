/**
 * Fase 6 · T-61 — Ciclo de vida real de conteos cíclicos (Sprint 107).
 *
 * Cierra 4 pares de comportamiento sin test en el scanner de rutas:
 *   POST /inventory/cycle-counts/:id/start
 *   POST /inventory/cycle-counts/:id/items
 *   POST /inventory/cycle-counts/:id/complete
 *   POST /inventory/cycle-counts/:id/adjust
 *
 * No es un "colchón" de códigos: ejercita el flujo completo ABIERTO →
 * EN_PROGRESO → COMPLETADO → AJUSTADO contra la BD real (stock del repuesto,
 * stock_movements de tipo AJUSTE, item marcado ajustado) y los caminos de
 * error (estados inválidos, cross-tenant 404).
 *
 * Fixtures propias bajo el tenant "e2e-t107-cycle", limpias en afterAll.
 *
 * @module tests/fase6-t61-cycle-counts-flows
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-t107-cycle";
const OTRO_TENANT = "e2e-t107-cycle2";
const TENANT_ID = "00000000-0000-0000-0000-00000107c001";
const OTRO_TENANT_ID = "00000000-0000-0000-0000-00000107c003";
const ADMIN_ID = "00000000-0000-0000-0000-00000107c002";
const OTRO_ADMIN_ID = "00000000-0000-0000-0000-00000107c004";
const ADMIN_EMAIL = "admin@e2e-t107-cycle.test";
const OTRO_ADMIN_EMAIL = "admin@e2e-t107-cycle2.test";
const TS = Date.now().toString(36);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const STOCK_INICIAL = 10;
const STOCK_REAL = 7;

let app: FastifyInstance;
let adminBearer: string;
let otroBearer: string;
let almacenId: string;
let repuestoId: string;

// Conteos creados en el flujo feliz (compartidos entre its secuenciales)
let ccId: string;
let itemId: string;

// ─── Helpers ──────────────────────────────────────────────

function auth(slug: string = TENANT): Record<string, string> {
  const bearer = slug === TENANT ? adminBearer : otroBearer;
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": slug };
}

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

async function crearConteo(): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/inventory/cycle-counts",
    headers: auth(),
    payload: { almacenId, observaciones: `Conteo T-61 ${TS}` },
  });
  expect(res.statusCode, `POST cycle-counts → ${res.statusCode}: ${res.body}`).toBe(201);
  const id = res.json().id;
  expect(id).toMatch(UUID_RE);
  return id;
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  await q`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E T107 Cycle Counts', ${TENANT}, 'tenant_e2e_t107_cycle', true)
    ON CONFLICT (slug) DO NOTHING`;
  await q`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${OTRO_TENANT_ID}, 'E2E T107 Cycle B', ${OTRO_TENANT}, 'tenant_e2e_t107_cycle_b', true)
    ON CONFLICT (slug) DO NOTHING`;
  await q`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Cycle T107', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;
  await q`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${OTRO_ADMIN_ID}, ${OTRO_TENANT_ID}, ${OTRO_ADMIN_EMAIL}, 'Admin Cycle B T107', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;

  adminBearer = generateToken({
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: "admin",
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

  const [almacen] = await q<{ id: string }>`
    INSERT INTO almacenes (codigo, nombre, tenant_slug)
    VALUES (${'ALM-T107-' + TS}, 'Almacén T107', ${TENANT})
    RETURNING id`;
  almacenId = almacen!.id;

  const [rep] = await q<{ id: string }>`
    INSERT INTO repuestos (codigo, descripcion, categoria, stock_actual, stock_minimo, tenant_slug)
    VALUES (${'CC-T107-' + TS}, 'Repuesto conteo cíclico T-61', 'Filtros', ${STOCK_INICIAL}, 2, ${TENANT})
    RETURNING id`;
  repuestoId = rep!.id;

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  const stmts = [
    `DELETE FROM audit_log WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM audit_log WHERE tenant_slug = '${OTRO_TENANT}'`,
    `DELETE FROM cycle_counts WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM cycle_counts WHERE tenant_slug = '${OTRO_TENANT}'`,
    `DELETE FROM stock_movements WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM stock_movements WHERE tenant_slug = '${OTRO_TENANT}'`,
    `DELETE FROM repuestos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM repuestos WHERE tenant_slug = '${OTRO_TENANT}'`,
    `DELETE FROM almacenes WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM profiles WHERE tenant_id = '${TENANT_ID}'`,
    `DELETE FROM profiles WHERE tenant_id = '${OTRO_TENANT_ID}'`,
    `DELETE FROM tenants WHERE id = '${TENANT_ID}'`,
    `DELETE FROM tenants WHERE id = '${OTRO_TENANT_ID}'`,
  ];
  const sql = getDb() as unknown as {
    unsafe: (stmt: string) => Promise<unknown>;
  };
  for (const stmt of stmts) {
    try {
      await sql.unsafe(stmt);
    } catch (err) {
      console.error("[fase6-t61-cycle-counts] cleanup falló:", stmt, err);
    }
  }
  if (app) await app.close();
});

// ─── Flujo feliz: ABIERTO → EN_PROGRESO → COMPLETADO → AJUSTADO ────

describe("Fase 6 · T-61 — ciclo de vida de conteos cíclicos (flujo feliz)", () => {
  it("POST /inventory/cycle-counts crea un conteo en estado ABIERTO", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/inventory/cycle-counts",
      headers: auth(),
      payload: { almacenId, observaciones: `Flujo T-61 ${TS}` },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(201);
    const body = res.json();
    expect(body.estado).toBe("ABIERTO");
    expect(body.id).toMatch(UUID_RE);
    expect(body.almacenId).toBe(almacenId);
    expect(body.tenantSlug).toBe(TENANT);
    ccId = body.id;
  });

  it("POST /inventory/cycle-counts/:id/start pasa a EN_PROGRESO y autopobla el item", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${ccId}/start`,
      headers: auth(),
      payload: { autoPopulate: true },
    });
    expect(res.statusCode, `start → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json().estado).toBe("EN_PROGRESO");

    const items = await q<{ id: string; stock_sistema: number; stock_real: number; diferencia: number }>`
      SELECT id, stock_sistema, stock_real, diferencia
      FROM cycle_count_items
      WHERE cycle_count_id = ${ccId} AND repuesto_id = ${repuestoId}`;
    expect(items, "start debió autopoblar el item del repuesto").toHaveLength(1);
    expect(Number(items[0]!.stock_sistema)).toBe(STOCK_INICIAL);
    expect(Number(items[0]!.diferencia)).toBe(0);
    itemId = items[0]!.id;
  });

  it("POST /inventory/cycle-counts/:id/items registra el conteo físico y calcula la diferencia", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${ccId}/items`,
      headers: auth(),
      payload: { itemId, stockReal: STOCK_REAL, observaciones: "Conteo físico T-61" },
    });
    expect(res.statusCode, `items → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.stockReal).toBe(STOCK_REAL);
    expect(body.diferencia).toBe(STOCK_REAL - STOCK_INICIAL);
    expect(body.observaciones).toBe("Conteo físico T-61");
  });

  it("POST /inventory/cycle-counts/:id/complete pasa a COMPLETADO", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${ccId}/complete`,
      headers: auth(),
    });
    expect(res.statusCode, `complete → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.estado).toBe("COMPLETADO");
    expect(body.fechaFin).toBeTruthy();
  });

  it("POST /inventory/cycle-counts/:id/adjust aplica stock, movimiento AJUSTADO y estado AJUSTADO", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${ccId}/adjust`,
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode, `adjust → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.adjustedItems).toBe(1);
    expect(body.cycleCount.estado).toBe("AJUSTADO");
    expect(body.details).toHaveLength(1);
    expect(body.details[0].diferencia).toBe(STOCK_REAL - STOCK_INICIAL);

    const [rep] = await q<{ stock_actual: number }>`
      SELECT stock_actual FROM repuestos WHERE id = ${repuestoId}`;
    expect(Number(rep!.stock_actual)).toBe(STOCK_REAL);

    const movimientos = await q<{ tipo: string; cantidad: number; stock_anterior: number; stock_posterior: number }>`
      SELECT tipo, cantidad, stock_anterior, stock_posterior
      FROM stock_movements
      WHERE motivo LIKE 'Ajuste por conteo cíclico%' AND tenant_slug = ${TENANT}
      ORDER BY created_at DESC
      LIMIT 1`;
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]!.tipo).toBe("AJUSTE");
    expect(Number(movimientos[0]!.cantidad)).toBe(STOCK_INICIAL - STOCK_REAL);
    expect(Number(movimientos[0]!.stock_anterior)).toBe(STOCK_INICIAL);
    expect(Number(movimientos[0]!.stock_posterior)).toBe(STOCK_REAL);

    const [item] = await q<{ ajustado: boolean; movimiento_ajuste_id: string | null }>`
      SELECT ajustado, movimiento_ajuste_id FROM cycle_count_items WHERE id = ${itemId}`;
    expect(item!.ajustado).toBe(true);
    expect(item!.movimiento_ajuste_id).toBeTruthy();
  });

  it("POST /inventory/cycle-counts/:id/start sobre un conteo YA AJUSTADO → 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${ccId}/start`,
      headers: auth(),
      payload: { autoPopulate: true },
    });
    expect(res.statusCode, `start repetido → ${res.statusCode}`).toBe(422);
    expect(res.json().message).toContain("ABIERTO");
  });
});

// ─── Estados inválidos y aislamiento cross-tenant ─────────

describe("Fase 6 · T-61 — conteos cíclicos: estados inválidos", () => {
  it("POST /inventory/cycle-counts/:id/items sin haber iniciado → 422", async () => {
    const pendiente = await crearConteo();
    const res = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${pendiente}/items`,
      headers: auth(),
      payload: { itemId: repuestoId, stockReal: 5 },
    });
    expect(res.statusCode, `items sin iniciar → ${res.statusCode}: ${res.body}`).toBe(422);
    expect(res.json().message).toContain("EN_PROGRESO");
  });

  it("POST /inventory/cycle-counts/:id/complete sin haber iniciado → 422", async () => {
    const pendiente = await crearConteo();
    const res = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${pendiente}/complete`,
      headers: auth(),
    });
    expect(res.statusCode, `complete sin iniciar → ${res.statusCode}: ${res.body}`).toBe(422);
    expect(res.json().message).toContain("EN_PROGRESO");
  });

  it("POST /inventory/cycle-counts/:id/adjust sobre EN_PROGRESO → 422", async () => {
    const enProgreso = await crearConteo();
    const start = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${enProgreso}/start`,
      headers: auth(),
      payload: { autoPopulate: true },
    });
    expect(start.statusCode, `start → ${start.statusCode}: ${start.body}`).toBe(200);

    const res = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${enProgreso}/adjust`,
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode, `adjust en EN_PROGRESO → ${res.statusCode}: ${res.body}`).toBe(422);
    expect(res.json().message).toContain("COMPLETADOS");
  });

  it("POST /inventory/cycle-counts/:id/adjust sin diferencias → 422", async () => {
    const sinDiferencias = await crearConteo();
    const start = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${sinDiferencias}/start`,
      headers: auth(),
      payload: { autoPopulate: true },
    });
    expect(start.statusCode, `start → ${start.statusCode}: ${start.body}`).toBe(200);

    const [item] = await q<{ id: string }>`
      SELECT id FROM cycle_count_items
      WHERE cycle_count_id = ${sinDiferencias} AND repuesto_id = ${repuestoId}`;
    expect(item, "start debió autopoblar el item").toBeTruthy();

    // Conteo idéntico al sistema → diferencia 0 en todos los items
    const record = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${sinDiferencias}/items`,
      headers: auth(),
      payload: { itemId: item!.id, stockReal: STOCK_REAL },
    });
    expect(record.statusCode, `items → ${record.statusCode}: ${record.body}`).toBe(200);

    const complete = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${sinDiferencias}/complete`,
      headers: auth(),
    });
    expect(complete.statusCode, `complete → ${complete.statusCode}: ${complete.body}`).toBe(200);

    const res = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${sinDiferencias}/adjust`,
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode, `adjust sin diferencias → ${res.statusCode}: ${res.body}`).toBe(422);
    expect(res.json().message).toContain("No hay diferencias");
  });

  it("POST /inventory/cycle-counts/:id/start cross-tenant → 404 (tenant-scoped)", async () => {
    const propio = await crearConteo();
    const res = await app.inject({
      method: "POST",
      url: `/inventory/cycle-counts/${propio}/start`,
      headers: auth(OTRO_TENANT),
      payload: { autoPopulate: true },
    });
    expect(res.statusCode, `start cross-tenant → ${res.statusCode}: ${res.body}`).toBe(404);
  });
});
