/**
 * Sprint 121 — Lote 8: GETs de lectura de workshop + inventory SIN test (T-47).
 *
 * Cubre las 43 rutas GET de `/workshop/**` (24) e `/inventory/**` (19) que
 * aparecían en `withoutTest` del escáner T-63 y no estaban en EXCLUDED.
 * Todo local y determinista; sin dependencia externa:
 *
 *   - Inventory analytics: turnover, dead-stock, reorder (con fixtures de
 *     repuestos + OT + orden_repuestos para verificar ventas reales)
 *   - auto-po/pending, herramientas/control, initial-load/batches(:batchId)
 *   - reports: stock/movements/valuation (PDF → %PDF)
 *   - tecdoc: search/vin + search/brand (400 por schema), status (local)
 *   - tool-instances: disponibles, due-for-calibration; tool-loans: overdue,
 *     mechanic/:mecanicoId; tool-service-events/calibration; book-value (404)
 *   - Workshop analytics: top-servicios, top-clientes, productividad,
 *     scorecard
 *   - clientes/vehiculos :id/history (no-existente → null; real → OTs)
 *   - flat-rate technician/:id y bay/:number (400 por pattern)
 *   - hub/board + hub/board/stream (SSE vía payloadAsStream)
 *   - ingresos/:id/qr (404), ordenes historial/pdf/stock-preview
 *   - predictions (+ ml, ml/:vehiculoId, ml/training-data)
 *   - pricing-matrix (400/200-null), pricing-suggest (400/404)
 *   - reference: vehicle-types, fuel-types, mileage-intervals, tecnicos
 *
 * Bugs de producción cubiertos por este fichero (RED → fix en
 * `batch-inventory.service.ts` → GREEN):
 *   - analytics/turnover y analytics/reorder consultaban `orden_items` +
 *     `ordenes_trabajo.fecha_ingreso` (tabla/columna inexistentes) → 500
 *     SIEMPRE; además leían `(execute()).rows`, que con postgres-js no
 *     existe (execute() devuelve el array de filas) → ventas siempre en 0.
 *   - analytics/dead-stock: mismo `orden_items`/`fecha_ingreso` inexistente
 *     → 500 con stock > 0, y `(lastSale).rows[0].last_sale` siempre
 *     undefined → todo marcado dead-stock con 999 días.
 * Corregido a `orden_repuestos` + `created_at` + iterar el array directo.
 *
 * `tecdoc/search/*`: sin TECDOC_API_URL/KEY configurados el servicio
 * responde vacío sin red; solo se afirma forma (parts array, total number).
 * `ordenes/:id/pdf`: sin Chromium devuelve 503; con Chromium, OT
 * inexistente → 404 — se aceptan ambas ramas.
 * `hub/board/stream` es SSE (nunca cierra); se lee la primera con
 * `payloadAsStream: true` (resuelve en writeHead) y se aborta.
 *
 * Patrón fase7 (tenant propio "e2e-s121", fixtures SQL idempotentes,
 * app.inject con template literals para el scanner de T-63).
 *
 * @module tests/fase7-s121-read-taller-inventario
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s121";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f121";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4e121";
const ADMIN_EMAIL = "admin@e2e-s121.test";
/** UUID válido que no existe en ninguna tabla (404/400 limpios). */
const NO_EXISTE = "00000000-0000-0000-0000-0000dead0001";

const CLIENTE = "00000000-0000-0000-0000-0000e2e4c121";
const VEHICULO = "00000000-0000-0000-0000-0000e2e4d121";
const OT_ID = "00000000-0000-0000-0000-0000e2e40121";
const OP_ID = "00000000-0000-0000-0000-0000e2e45121";
/** Repuesto con venta recientemente (NO debe salir en dead-stock). */
const REP_VENDIDO = "00000000-0000-0000-0000-0000e2e4a121";
/** Repuesto sin ventas (dead-stock por 999 días). */
const REP_SECO = "00000000-0000-0000-0000-0000e2e4b121";

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
    VALUES (${TENANT_ID}, 'E2E Sprint 121 Lectura', ${TENANT}, 'tenant_e2e_s121', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 121', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;
  await sql`
    INSERT INTO clients (id, name, tenant_slug)
    VALUES (${CLIENTE}, 'Cliente E2E S121', ${TENANT})
    ON CONFLICT (id) DO NOTHING`;
  await sql`
    INSERT INTO vehiculos (id, client_id, brand, model, plate, engine_type, tenant_slug)
    VALUES (${VEHICULO}, ${CLIENTE}, 'Toyota', 'Corolla', 'E2E121', 'Nafta', ${TENANT})
    ON CONFLICT (id) DO NOTHING`;
  await sql`
    INSERT INTO ordenes_trabajo (id, vehicle_id, client_id, status, tenant_slug)
    VALUES (${OT_ID}, ${VEHICULO}, ${CLIENTE}, 'En_Proceso', ${TENANT})
    ON CONFLICT (id) DO NOTHING`;
  await sql`
    INSERT INTO repuestos (id, codigo, descripcion, tenant_slug, stock_actual, precio_venta, punto_reorden, activo)
    VALUES
      (${REP_VENDIDO}, 'E2E121-A', 'Filtro de aceite E2E121', ${TENANT}, 10, 100000, 3, true),
      (${REP_SECO}, 'E2E121-B', 'Pastilla de freno E2E121', ${TENANT}, 5, 50000, 2, true)
    ON CONFLICT (id) DO NOTHING`;
  // Venta reciente (created_at = now → dentro de las ventanas de 30/90 días)
  await sql`
    INSERT INTO orden_repuestos (id, orden_trabajo_id, repuesto_id, repuesto_nombre, codigo, cantidad, precio_unitario, subtotal, tenant_slug)
    VALUES (${OP_ID}, ${OT_ID}, ${REP_VENDIDO}, 'Filtro de aceite E2E121', 'E2E121-A', 5, 100000, 500000, ${TENANT})
    ON CONFLICT (id) DO NOTHING`;

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
  await q`DELETE FROM orden_repuestos WHERE tenant_slug = ${TENANT}`;
  await q`DELETE FROM ordenes_trabajo WHERE tenant_slug = ${TENANT}`;
  await q`DELETE FROM repuestos WHERE tenant_slug = ${TENANT}`;
  await q`DELETE FROM vehiculos WHERE id = ${VEHICULO}`;
  await q`DELETE FROM clients WHERE id = ${CLIENTE}`;
  await q`DELETE FROM profiles WHERE id = ${ADMIN_ID}`;
  await q`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
  await app?.close();
});

// ─── Inventory · Analytics (fixtures de venta) ────────────

describe("Sprint 121 · Inventory analytics GET", () => {
  it("GET /inventory/analytics/turnover → 200 con ventas30d reales", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/inventory/analytics/turnover`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.turnover)).toBe(true);
    expect(body.count).toBe(2);

    const vendido = body.turnover.find(
      (t: { repuestoId: string }) => t.repuestoId === REP_VENDIDO,
    );
    const seco = body.turnover.find(
      (t: { repuestoId: string }) => t.repuestoId === REP_SECO,
    );
    // Ventas reales de los últimos 30 días (5 unidades) — con el bug
    // (tabla fantasma `orden_items`) esto era 500; con `.rows` malogrado, 0.
    expect(vendido.ventas30d).toBe(5);
    expect(vendido.turnoverRate).toBe(0.5); // 5 ventas / stock 10
    expect(vendido.daysOfStock).toBe(60); // (10 / 5) * 30
    expect(seco.ventas30d).toBe(0);
    expect(seco.daysOfStock).toBe(999);
  });

  it("GET /inventory/analytics/dead-stock → solo el repuesto sin ventas", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/inventory/analytics/dead-stock`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    // Con el bug: 500 (stock > 0 ⇒ query a `orden_items` inexistente); si
    // solo fallara `.rows`, saldrían AMBOS con 999 días.
    expect(body.count).toBe(1);
    expect(body.deadStock).toHaveLength(1);
    expect(body.deadStock[0].repuestoId).toBe(REP_SECO);
    expect(body.deadStock[0].diasSinMovimiento).toBe(999);
    expect(body.deadStock[0].valorTotal).toBe(250000); // 5 * 50000
    expect(body.totalValue).toBe(250000);
  });

  it("GET /inventory/analytics/reorder → promedio diario real para el vendido", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/inventory/analytics/reorder`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.count).toBe(2);
    expect(typeof body.critico).toBe("number");

    const vendido = body.predictions.find(
      (p: { repuestoId: string }) => p.repuestoId === REP_VENDIDO,
    );
    const seco = body.predictions.find(
      (p: { repuestoId: string }) => p.repuestoId === REP_SECO,
    );
    // 5 unidades / 90 días ≈ 0.06 — con el bug era siempre 0 (y 999 días).
    expect(vendido.promedioDiario).toBeGreaterThan(0);
    expect(vendido.diasParaReorden).toBeLessThan(999);
    expect(seco.promedioDiario).toBe(0);
    expect(seco.diasParaReorden).toBe(999);
    for (const p of body.predictions) {
      expect(["CRITICO", "ALTO", "MEDIO", "BAJO"]).toContain(p.urgencia);
    }
  });
});

// ─── Inventory · Rutas generales ──────────────────────────

describe("Sprint 121 · Inventory GET", () => {
  it("GET /inventory/auto-po/pending → 200 sin alertas", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/inventory/auto-po/pending`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ total: 0, items: [] });
  });

  it("GET /inventory/herramientas/control → 200 paginado + 400 con uuid inválido", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/inventory/herramientas/control`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.totalPages).toBe(0);

    const bad = await app.inject({
      method: "GET",
      url: `/inventory/herramientas/control?ordenTrabajoId=not-a-uuid`,
      headers: auth(),
    });
    expect(bad.statusCode).toBe(400);
  });

  it("GET /inventory/initial-load/batches → 200 [] y :batchId con pattern", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/inventory/initial-load/batches?limit=5`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual([]);

    // batchId con formato válido (LOAD-YYYYMMDD-XXXX) sin datos → []
    const detalle = await app.inject({
      method: "GET",
      url: `/inventory/initial-load/batches/${"LOAD-20301231-ZZZZ"}`,
      headers: auth(),
    });
    expect(detalle.statusCode, detalle.body).toBe(200);
    expect(detalle.json()).toEqual([]);

    // Fuera del pattern → 400 de Fastify
    const bad = await app.inject({
      method: "GET",
      url: `/inventory/initial-load/batches/${NO_EXISTE}`,
      headers: auth(),
    });
    expect(bad.statusCode).toBe(400);
  });

  it("GET /inventory/reports/stock|movements|valuation → 200 PDF", async () => {
    const urls = [
      `/inventory/reports/stock`,
      `/inventory/reports/movements?from=2030-01-01&to=2030-12-31`,
      `/inventory/reports/valuation`,
    ];
    for (const url of urls) {
      const res = await app.inject({
        method: "GET",
        url,
        headers: auth(),
      });
      expect(res.statusCode, `${url} → ${res.body}`).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
    }
  });

  it("GET /inventory/tecdoc/search/vin|brand → 400 por schema, 200 sin red", async () => {
    const sinVin = await app.inject({
      method: "GET",
      url: `/inventory/tecdoc/search/vin`,
      headers: auth(),
    });
    expect(sinVin.statusCode).toBe(400);

    const vin = await app.inject({
      method: "GET",
      url: `/inventory/tecdoc/search/vin?vin=12345678901234567&q=filtros`,
      headers: auth(),
    });
    expect(vin.statusCode, vin.body).toBe(200);
    const vinBody = vin.json();
    expect(Array.isArray(vinBody.parts)).toBe(true);
    expect(typeof vinBody.total).toBe("number");

    const sinBrand = await app.inject({
      method: "GET",
      url: `/inventory/tecdoc/search/brand?brand=Toyota`,
      headers: auth(),
    });
    expect(sinBrand.statusCode).toBe(400);

    const brand = await app.inject({
      method: "GET",
      url: `/inventory/tecdoc/search/brand?brand=Toyota&model=Corolla&year=2020&q=filtros`,
      headers: auth(),
    });
    expect(brand.statusCode, brand.body).toBe(200);
    const brandBody = brand.json();
    expect(Array.isArray(brandBody.parts)).toBe(true);
    expect(typeof brandBody.total).toBe("number");
  });

  it("GET /inventory/tecdoc/status → 200 integración local", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/inventory/tecdoc/status`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.provider).toBe("TecDoc");
    expect(typeof body.configured).toBe("boolean");
  });

  it("GET /inventory/tool-instances/disponibles y due-for-calibration → 200 []", async () => {
    const disp = await app.inject({
      method: "GET",
      url: `/inventory/tool-instances/disponibles`,
      headers: auth(),
    });
    expect(disp.statusCode, disp.body).toBe(200);
    expect(Array.isArray(disp.json())).toBe(true);

    const due = await app.inject({
      method: "GET",
      url: `/inventory/tool-instances/due-for-calibration?days=7`,
      headers: auth(),
    });
    expect(due.statusCode, due.body).toBe(200);
    expect(Array.isArray(due.json())).toBe(true);
  });

  it("GET /inventory/tool-loans/overdue y mechanic/:mecanicoId → 200 []", async () => {
    const overdue = await app.inject({
      method: "GET",
      url: `/inventory/tool-loans/overdue`,
      headers: auth(),
    });
    expect(overdue.statusCode, overdue.body).toBe(200);
    expect(Array.isArray(overdue.json())).toBe(true);

    const mech = await app.inject({
      method: "GET",
      url: `/inventory/tool-loans/mechanic/${NO_EXISTE}`,
      headers: auth(),
    });
    expect(mech.statusCode, mech.body).toBe(200);
    expect(Array.isArray(mech.json())).toBe(true);
  });

  it("GET /inventory/tool-service-events/calibration/:id → 200 []", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/inventory/tool-service-events/calibration/${NO_EXISTE}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("GET /inventory/tools/depreciation/book-value/:id → 404 inexistente", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/inventory/tools/depreciation/book-value/${NO_EXISTE}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Herramienta no encontrada");
  });
});

// ─── Workshop · Analytics ─────────────────────────────────

describe("Sprint 121 · Workshop analytics GET", () => {
  it("GET /workshop/analytics/top-servicios y top-clientes → 200 arrays", async () => {
    const servicios = await app.inject({
      method: "GET",
      url: `/workshop/analytics/top-servicios?limit=5`,
      headers: auth(),
    });
    expect(servicios.statusCode, servicios.body).toBe(200);
    expect(Array.isArray(servicios.json())).toBe(true);

    const clientes = await app.inject({
      method: "GET",
      url: `/workshop/analytics/top-clientes?limit=5`,
      headers: auth(),
    });
    expect(clientes.statusCode, clientes.body).toBe(200);
    expect(Array.isArray(clientes.json())).toBe(true);
  });

  it("GET /workshop/analytics/productividad → 200 resumen + detalleMensual", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/analytics/productividad?desde=2030-01-01&hasta=2030-12-31`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.resumen).toBeDefined();
    expect(typeof body.resumen.totalOTsCompletadas).toBe("number");
    expect(Array.isArray(body.detalleMensual)).toBe(true);
  });

  it("GET /workshop/analytics/scorecard → 200 objeto", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/analytics/scorecard`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(typeof res.json()).toBe("object");
    expect(res.json()).not.toBeNull();
  });
});

// ─── Workshop · Historiales ───────────────────────────────

describe("Sprint 121 · Workshop historiales GET", () => {
  it("GET /workshop/clientes/:id/history → null inexistente, OTs reales", async () => {
    const vacio = await app.inject({
      method: "GET",
      url: `/workshop/clientes/${NO_EXISTE}/history`,
      headers: auth(),
    });
    expect(vacio.statusCode, vacio.body).toBe(200);
    expect(vacio.json()).toEqual({
      client: null,
      vehicles: [],
      ordenes: [],
      totalVehicles: 0,
      totalOrdenes: 0,
    });

    const real = await app.inject({
      method: "GET",
      url: `/workshop/clientes/${CLIENTE}/history`,
      headers: auth(),
    });
    expect(real.statusCode, real.body).toBe(200);
    const body = real.json();
    expect(body.client.id).toBe(CLIENTE);
    expect(body.totalOrdenes).toBeGreaterThanOrEqual(1);
    expect(body.totalVehicles).toBeGreaterThanOrEqual(1);
  });

  it("GET /workshop/vehiculos/:id/history → null inexistente, OTs reales", async () => {
    const vacio = await app.inject({
      method: "GET",
      url: `/workshop/vehiculos/${NO_EXISTE}/history`,
      headers: auth(),
    });
    expect(vacio.statusCode, vacio.body).toBe(200);
    expect(vacio.json()).toEqual({
      vehicle: null,
      ordenes: [],
      totalOrdenes: 0,
    });

    const real = await app.inject({
      method: "GET",
      url: `/workshop/vehiculos/${VEHICULO}/history`,
      headers: auth(),
    });
    expect(real.statusCode, real.body).toBe(200);
    const body = real.json();
    expect(body.vehicle.id).toBe(VEHICULO);
    expect(body.totalOrdenes).toBeGreaterThanOrEqual(1);
  });
});

// ─── Workshop · Flat rate / Hub / QR ──────────────────────

describe("Sprint 121 · Workshop flat-rate / hub / QR GET", () => {
  it("GET /workshop/flat-rate/technician/:id → 200 métricas", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/flat-rate/technician/${NO_EXISTE}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(typeof body.serviciosCompletados).toBe("number");
    expect(body.tecnicoId).toBe(NO_EXISTE);
  });

  it("GET /workshop/flat-rate/bay/:number → 200, 400 con no-numérico", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/flat-rate/bay/${1}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().bayNumber).toBe(1);

    const bad = await app.inject({
      method: "GET",
      url: `/workshop/flat-rate/bay/abc`,
      headers: auth(),
    });
    expect(bad.statusCode).toBe(400);
  });

  it("GET /workshop/hub/board → 200 con ordenes + tecnicos", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/hub/board?limit=10`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.ordenes)).toBe(true);
    expect(Array.isArray(body.tecnicos)).toBe(true);
    // La OT fixture (En_Proceso) debe aparecer en el tablero
    expect(
      body.ordenes.some((o: { id: string }) => o.id === OT_ID),
    ).toBe(true);
  });

  it("GET /workshop/hub/board/stream → SSE conectado y cierra al abortar", async () => {
    const ac = new AbortController();
    const res = await app.inject({
      method: "GET",
      url: `/workshop/hub/board/stream`,
      headers: auth(),
      payloadAsStream: true,
      signal: ac.signal,
    });
    // light-my-request con payloadAsStream resuelve en writeHead (la
    // respuesta SSE nunca termina: STREAM_MAX_AGE_MS = 5 min).
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");

    const stream = res.stream();
    const first = await new Promise<string>((resolve, reject) => {
      stream.once("data", (chunk: Buffer | string) => resolve(String(chunk)));
      stream.once("error", reject);
    });
    expect(first).toContain('"type":"connected"');
    expect(first).toContain(TENANT);

    // Desconectar dispara `request.raw.on("close")` → cleanup del cliente
    // SSE + timer de 5 minutos en el servidor.
    ac.abort();
    stream.destroy();
  });

  it("GET /workshop/ingresos/:id/qr → 404 inexistente", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/ingresos/${NO_EXISTE}/qr`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain("no encontrado");
  });
});

// ─── Workshop · Ordenes ───────────────────────────────────

describe("Sprint 121 · Workshop ordenes GET", () => {
  it("GET /workshop/ordenes/:id/historial → 200 [] inexistente", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/ordenes/${NO_EXISTE}/historial`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("GET /workshop/ordenes/:id/pdf → 404 inexistente (o 503 sin Chromium)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/ordenes/${NO_EXISTE}/pdf`,
      headers: auth(),
    });
    // Con Chromium instalado la OT inexistente da 404; sin él, 503.
    expect([404, 503]).toContain(res.statusCode);
    if (res.statusCode === 404) {
      expect(res.json().error).toBe("OT no encontrada");
    } else {
      expect(res.json().error).toContain("Chromium");
    }
  });

  it("GET /workshop/ordenes/:id/stock-preview → 200 [] inexistente", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/ordenes/${NO_EXISTE}/stock-preview`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

// ─── Workshop · Predictions ───────────────────────────────

describe("Sprint 121 · Workshop predictions GET", () => {
  it("GET /workshop/predictions → 200 {total, items}", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/predictions`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(typeof body.total).toBe("number");
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("GET /workshop/predictions/ml → 200 {total, items}", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/predictions/ml`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(typeof body.total).toBe("number");
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("GET /workshop/predictions/ml/:vehiculoId → 404 inexistente, 200 real", async () => {
    const noExiste = await app.inject({
      method: "GET",
      url: `/workshop/predictions/ml/${NO_EXISTE}`,
      headers: auth(),
    });
    expect(noExiste.statusCode).toBe(404);
    expect(noExiste.json().error).toBe("NotFoundError");

    const real = await app.inject({
      method: "GET",
      url: `/workshop/predictions/ml/${VEHICULO}`,
      headers: auth(),
    });
    expect(real.statusCode, real.body).toBe(200);
    expect(real.json()).not.toBeNull();
  });

  it("GET /workshop/predictions/ml/training-data → 200 estadísticas", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/predictions/ml/training-data`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(typeof body.totalVehiculos).toBe("number");
    expect(body.totalVehiculos).toBeGreaterThanOrEqual(1);
  });
});

// ─── Workshop · Pricing / reference / tecnicos ────────────

describe("Sprint 121 · Workshop pricing y reference GET", () => {
  it("GET /workshop/pricing-matrix → 400 sin params, 200 null sin regla", async () => {
    const sinParams = await app.inject({
      method: "GET",
      url: `/workshop/pricing-matrix`,
      headers: auth(),
    });
    expect(sinParams.statusCode).toBe(400);

    const res = await app.inject({
      method: "GET",
      url: `/workshop/pricing-matrix?servicioId=${NO_EXISTE}&vehicleTypeId=${NO_EXISTE}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toBeNull();
  });

  it("GET /workshop/pricing-suggest → 400 sin params, 404 sin datos", async () => {
    const sinParams = await app.inject({
      method: "GET",
      url: `/workshop/pricing-suggest`,
      headers: auth(),
    });
    expect(sinParams.statusCode).toBe(400);

    const res = await app.inject({
      method: "GET",
      url: `/workshop/pricing-suggest?servicioId=${NO_EXISTE}&vehicleTypeId=${NO_EXISTE}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain("precios");
  });

  it("GET /workshop/reference/vehicle-types|fuel-types|mileage-intervals → 200 arrays", async () => {
    // Literales explícitos: el scanner T-63 convierte ${...} en `*`, que solo
    // matchea rutas paramétricas — las estáticas requieren el path completo.
    const urls = [
      `/workshop/reference/vehicle-types`,
      `/workshop/reference/fuel-types`,
      `/workshop/reference/mileage-intervals`,
    ];
    for (const url of urls) {
      const res = await app.inject({
        method: "GET",
        url,
        headers: auth(),
      });
      expect(res.statusCode, `${url} → ${res.body}`).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    }
  });

  it("GET /workshop/tecnicos → 200 array", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/tecnicos?limit=5`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});
