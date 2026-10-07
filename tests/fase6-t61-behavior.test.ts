/**
 * T-61 — Tests de comportamiento vía app.inject (primer lote).
 *
 * La auditoría 2026-09-25 encontró la causa raíz de T-47: "código que compila,
 * tipa y se registra, pero que nadie ejecuta". T-48 ya sondeó 6 rutas rotas;
 * este archivo ejercita COMPORTAMIENTO (no solo superficie) de rutas de
 * escritura críticas que además eran clase D (escritura sin consumidor NI
 * test) — cada happy path aquí también baja el guard T-63:
 *
 *   1. PATCH /workshop/ordenes/:id/status — transición de estado con la
 *      transacción T-31: update + historial de auditoría (G-02) atómicos;
 *      aislamiento por tenant (404 cross-tenant) y enum validado (400).
 *   2. POST /inventory/adjustments + approve/reject — flujo de aprobación
 *      multi-nivel: umbral (>10 un → PENDIENTE), stock nunca negativo (422),
 *      aplicación real de stock + movimiento AJUSTE al aprobar, y estados
 *      terminales que no se re-resuelven (422).
 *
 * Convenciones verificadas en T-48: schema inválido → 400, ValidationError →
 * 422, NotFoundError → 404, POST exitoso → 201.
 *
 * @module tests/fase6-t61-behavior
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

const T = "e2e-t61-behavior";
const T_ID = "00000000-0000-0000-0000-0000f4600001";
const OTRO_ID = "00000000-0000-0000-0000-0000f4600002";
const ADMIN = "00000000-0000-0000-0000-0000f4600010";
const CLIENTE = "00000000-0000-0000-0000-0000f4600997";
const VEHICULO = "00000000-0000-0000-0000-0000f4600998";
const OT_A = "00000000-0000-0000-0000-0000f4600a01";
const OT_B = "00000000-0000-0000-0000-0000f4600a02";
const REP_PEQ = "00000000-0000-0000-0000-0000f4600b01";
const REP_GRA = "00000000-0000-0000-0000-0000f4600b02";
const REP_NEG = "00000000-0000-0000-0000-0000f4600b03";
const REP_INEXISTENTE = "00000000-0000-0000-0000-0000f4688888";
const EMAIL = "admin@e2e-t61.test";

let app: Awaited<ReturnType<typeof buildApp>>;
let token: string;

async function seedRepuesto(id: string, codigo: string, stock: number) {
  const sql = getDb() as any;
  // Idempotencia (lección de T-48): si una corrida anterior falló a mitad de
  // los happy paths, el repuesto ya existía con el stock MODIFICADO por los
  // ajustes y el ON CONFLICT DO NOTHING lo preservaba — los reintentos
  // acumulaban desvíos. Resetear el stock y limpiar sus movimientos: los
  // ajustes viven en memoria, pero sus movimientos AJUSTE quedan en la DB.
  await sql`DELETE FROM stock_movements WHERE repuesto_id = ${id}`;
  await sql`INSERT INTO repuestos (id, codigo, descripcion, stock_actual, tenant_slug)
    VALUES (${id}, ${codigo}, ${"Repuesto " + codigo}, ${stock}, ${T})
    ON CONFLICT (codigo) DO UPDATE SET stock_actual = ${stock}`;
}

describe("T-61 · comportamiento de escritura crítica (app.inject)", () => {
  beforeAll(async () => {
    const sql = getDb() as any;
    await sql`INSERT INTO tenants (id, name, slug, schema_name, is_active)
      VALUES (${T_ID}, ${T}, ${T}, ${T}, true), (${OTRO_ID}, ${"e2e-t61-otro"}, ${"e2e-t61-otro"}, ${"e2e-t61-otro"}, true)
      ON CONFLICT (slug) DO NOTHING`;
    await sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${ADMIN}, ${T_ID}, ${EMAIL}, 'Admin T61', 'admin', true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET is_active = true`;
    await sql`INSERT INTO clients (id, name, tenant_slug)
      VALUES (${CLIENTE}, ${"Cliente T61"}, ${T}) ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO vehiculos (id, client_id, brand, model, engine_type, tenant_slug)
      VALUES (${VEHICULO}, ${CLIENTE}, ${"Toyota"}, ${"Corolla"}, ${"Nafta"}, ${T})
      ON CONFLICT (id) DO NOTHING`;
    // Dos OTs: una para el happy path, otra de un tenant ajeno (aislamiento).
    // Idempotencia (T-48): resetear status y borrar historial de corridas
    // previas para que la transición En_Proceso → Control_Calidad sea
    // reproducible en reintentos.
    await sql`DELETE FROM orden_estado_historial WHERE orden_trabajo_id IN (${OT_A}, ${OT_B})`;
    await sql`INSERT INTO ordenes_trabajo (id, vehicle_id, client_id, status, tenant_slug)
      VALUES (${OT_A}, ${VEHICULO}, ${CLIENTE}, ${"En_Proceso"}, ${T}),
             (${OT_B}, ${VEHICULO}, ${CLIENTE}, ${"En_Proceso"}, ${"e2e-t61-otro"})
      ON CONFLICT (id) DO UPDATE SET status = 'En_Proceso'`;
    await seedRepuesto(REP_PEQ, "T61-PEQ", 5);
    await seedRepuesto(REP_GRA, "T61-GRA", 100);
    await seedRepuesto(REP_NEG, "T61-NEG", 2);

    app = await buildApp();
    await app.ready();
    token = generateToken({
      id: ADMIN,
      email: EMAIL,
      role: "admin",
      tenantId: T_ID,
      tenantSlug: T,
    });
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    const sql = getDb() as any;
    await sql`DELETE FROM ordenes_trabajo WHERE tenant_slug IN (${T}, ${"e2e-t61-otro"})`;
    // Los ajustes auto-aprobados generan movimientos AJUSTE con FK al repuesto:
    // borrarlos primero (mismo tenant de test)
    await sql`DELETE FROM stock_movements WHERE tenant_slug = ${T}`;
    await sql`DELETE FROM repuestos WHERE tenant_slug = ${T}`;
    await sql`DELETE FROM vehiculos WHERE id = ${VEHICULO}`;
    await sql`DELETE FROM clients WHERE id = ${CLIENTE}`;
    await sql`DELETE FROM profiles WHERE tenant_id = ${T_ID}`;
    await sql`DELETE FROM tenants WHERE id IN (${T_ID}, ${OTRO_ID})`;
  }, 120_000);

  const auth = () => ({ authorization: `Bearer ${token}`, "x-tenant-slug": T });

  // ── 1. PATCH /workshop/ordenes/:id/status ────────────────────────────
  it("transición válida actualiza el estado Y deja registro de historial (misma tx)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/workshop/ordenes/${OT_A}/status`,
      headers: auth(),
      body: { status: "Control_Calidad" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: OT_A, status: "Control_Calidad" });

    const sql = getDb() as any;
    const [ot] = await sql`SELECT status FROM ordenes_trabajo WHERE id = ${OT_A}`;
    expect(ot.status).toBe("Control_Calidad");

    // G-02: el historial de auditoría existe y refleja la transición
    const hist = await sql`
      SELECT estado_anterior, estado_nuevo, usuario_id
      FROM orden_estado_historial WHERE orden_trabajo_id = ${OT_A}
      ORDER BY created_at DESC LIMIT 1`;
    expect(hist).toHaveLength(1);
    expect(hist[0].estado_anterior).toBe("En_Proceso");
    expect(hist[0].estado_nuevo).toBe("Control_Calidad");
  });

  it("estado fuera del enum es rechazado con 400 antes de tocar la OT", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/workshop/ordenes/${OT_A}/status`,
      headers: auth(),
      body: { status: "Despachado" },
    });
    expect(res.statusCode).toBe(400);

    const sql = getDb() as any;
    const [ot] = await sql`SELECT status FROM ordenes_trabajo WHERE id = ${OT_A}`;
    expect(ot.status).toBe("Control_Calidad"); // intacto
  });

  it("la OT de otro tenant no existe aquí (404, sin filtrar por slug no ocurre)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/workshop/ordenes/${OT_B}/status`,
      headers: auth(),
      body: { status: "Listo" },
    });
    expect(res.statusCode).toBe(404);

    const sql = getDb() as any;
    const [ot] = await sql`SELECT status FROM ordenes_trabajo WHERE id = ${OT_B}`;
    expect(ot.status).toBe("En_Proceso"); // la del otro tenant, intacta
  });

  // ── 2. POST /inventory/adjustments (flujo de aprobación) ─────────────
  it("body inválido (sin motivo) → 400 de schema", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/inventory/adjustments",
      headers: auth(),
      body: { repuestoId: REP_PEQ, cantidad: 3 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("repuesto inexistente en el tenant → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/inventory/adjustments",
      headers: auth(),
      body: { repuestoId: REP_INEXISTENTE, cantidad: 3, motivo: "prueba" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("un ajuste que dejaría stock negativo → 422 y no toca el stock", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/inventory/adjustments",
      headers: auth(),
      body: { repuestoId: REP_NEG, cantidad: -5, motivo: "merma" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().message).toContain("negativo");

    const sql = getDb() as any;
    const [rep] = await sql`SELECT stock_actual FROM repuestos WHERE id = ${REP_NEG}`;
    expect(rep.stock_actual).toBe(2);
  });

  it("ajuste pequeño se auto-aprueba: 201 APROBADO, stock aplicado y movimiento AJUSTE", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/inventory/adjustments",
      headers: auth(),
      body: { repuestoId: REP_PEQ, cantidad: 3, motivo: "conteo cíclico" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ estado: "APROBADO", cantidad: 3 });

    const sql = getDb() as any;
    const [rep] = await sql`SELECT stock_actual FROM repuestos WHERE id = ${REP_PEQ}`;
    expect(rep.stock_actual).toBe(8); // 5 + 3

    const [mov] = await sql`
      SELECT tipo, stock_anterior, stock_posterior
      FROM stock_movements WHERE repuesto_id = ${REP_PEQ}
      ORDER BY created_at DESC LIMIT 1`;
    expect(mov.tipo).toBe("AJUSTE");
    expect(mov.stock_anterior).toBe(5);
    expect(mov.stock_posterior).toBe(8);
  });

  it("ajuste grande queda PENDIENTE (umbral >10), stock intacto, y aparece en pending", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/inventory/adjustments",
      headers: auth(),
      body: { repuestoId: REP_GRA, cantidad: 50, motivo: "recuento anual" },
    });
    expect(res.statusCode).toBe(201);
    const { id, estado } = res.json();
    expect(estado).toBe("PENDIENTE");

    const sql = getDb() as any;
    const [rep] = await sql`SELECT stock_actual FROM repuestos WHERE id = ${REP_GRA}`;
    expect(rep.stock_actual).toBe(100); // aún no aplicado

    const lista = await app.inject({
      method: "GET",
      url: "/inventory/adjustments/pending",
      headers: auth(),
    });
    expect(lista.statusCode).toBe(200);
    expect(lista.json().some((r: { id: string }) => r.id === id)).toBe(true);

    // Aprobar aplica el stock real
    const ok = await app.inject({
      method: "POST",
      url: `/inventory/adjustments/${id}/approve`,
      headers: auth(),
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ estado: "APROBADO" });

    const [rep2] = await sql`SELECT stock_actual FROM repuestos WHERE id = ${REP_GRA}`;
    expect(rep2.stock_actual).toBe(150); // 100 + 50

    // Re-aprobar una solicitud resuelta → 422
    const again = await app.inject({
      method: "POST",
      url: `/inventory/adjustments/${id}/approve`,
      headers: auth(),
    });
    expect(again.statusCode).toBe(422);
  });

  it("rechazar un ajuste pendiente preserva el stock, registra el motivo y cierra el caso", async () => {
    const alta = await app.inject({
      method: "POST",
      url: "/inventory/adjustments",
      headers: auth(),
      body: { repuestoId: REP_GRA, cantidad: -20, motivo: "rotura en depósito" },
    });
    expect(alta.statusCode).toBe(201);
    const { id } = alta.json();
    expect(alta.json().estado).toBe("PENDIENTE"); // |−20| > 10

    const sql = getDb() as any;
    const [antes] = await sql`SELECT stock_actual FROM repuestos WHERE id = ${REP_GRA}`;

    const res = await app.inject({
      method: "POST",
      url: `/inventory/adjustments/${id}/reject`,
      headers: auth(),
      body: { motivoRechazo: "no hay evidencia de la rotura" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ estado: "RECHAZADO", motivoRechazo: "no hay evidencia de la rotura" });

    const [rep] = await sql`SELECT stock_actual FROM repuestos WHERE id = ${REP_GRA}`;
    expect(rep.stock_actual).toBe(antes.stock_actual); // rechazado ≠ aplicado

    // Re-rechazar → 422 (estado terminal)
    const again = await app.inject({
      method: "POST",
      url: `/inventory/adjustments/${id}/reject`,
      headers: auth(),
      body: { motivoRechazo: "segunda vez" },
    });
    expect(again.statusCode).toBe(422);

    // Ya no está en pending
    const lista = await app.inject({
      method: "GET",
      url: "/inventory/adjustments/pending",
      headers: auth(),
    });
    expect(lista.json().some((r: { id: string }) => r.id === id)).toBe(false);
  });

  // ── Sprint 105: consumidor FE real de GET /api/notifications/ws/status ──
  // notification-bell.js consulta el estado del gateway en el `close` del WS
  // (la fuente de verdad server-side). Ejercitarlo aquí saca la ruta del balde
  // "sin test" del guard T-63 — la exclusión de triaje se quitó.
  it("GET /api/notifications/ws/status devuelve connected + timestamp sin WS abierto", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/notifications/ws/status",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { connected: number; timestamp: string };
    expect(typeof body.connected).toBe("number");
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    expect(body.connected).toBe(0); // este test no abre el WebSocket
  });
});
