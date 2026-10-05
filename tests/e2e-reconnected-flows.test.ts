/**
 * E2E — 12 flujos reconectados (Fase 1 · auditoría 2026-09-25)
 *
 * A diferencia de los tests "e2e" previos (rutas inline simuladas con Fastify
 * mínimo), este archivo arranca la APLICACIÓN REAL con buildApp() y ejercita
 * los endpoints de producción contra la base de datos migrada, con asserts de
 * round-trip de datos (no sólo status 200).
 *
 * Flujos cubiertos:
 *   T-11 citas · T-12 SSE · T-13 analytics · T-14 stock ingreso/salida ·
 *   T-15 tool-loans · T-16 payroll · T-17 cuentas contables ·
 *   T-18 label-printing (6 endpoints) · T-19 storage round-trip ·
 *   T-20 lockout HEV · T-21 portal cliente · colaterales (shapes paginados)
 *
 * Fixtures propias bajo el tenant "e2e-reconnected" (idempotentes, limpias en
 * afterAll) para no depender de scripts/seed-test.sql.
 *
 * @module tests/e2e-reconnected-flows
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";
import { uploadFile } from "../src/shared/storage/local-storage.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-reconnected";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e00000";
const ADMIN_PROFILE_ID = "00000000-0000-0000-0000-0000e2e00001";
const ADMIN_EMAIL = "admin@e2e-reconnected.test";
const HERRAMIENTA_ID = "00000000-0000-0000-0000-0000e2e00005";
const TOOL_INSTANCE_ID = "00000000-0000-0000-0000-0000e2e00006";
const TS = Date.now().toString(36);

let app: FastifyInstance;
let baseUrl: string;
let bearer: string;

const state: {
  clientId?: string;
  vehicleId?: string;
  ordenId?: string;
  ordenHvId?: string;
  appointmentId?: string;
  repuestoId?: string;
  loanId?: string;
} = {};

// ─── Helpers ──────────────────────────────────────────────

function auth(extra: Record<string, string> = {}): Record<string, string> {
  return {
    authorization: `Bearer ${bearer}`,
    "x-tenant-slug": TENANT,
    ...extra,
  };
}

/** Ejecuta un bloque SQL con app.current_tenant = TENANT (para fixtures/limpieza fuera de requests). */
async function asTenant<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  const sql = getDb() as any;
  return sql.begin(async (tx: any) => {
    await tx`SELECT set_config('app.current_tenant', ${TENANT}, true)`;
    return fn(tx);
  });
}

/** Extrae el id de cualquier shape de respuesta ({id}, {cliente:{id}}, {data:{id}}, …). */
function pickId(body: any, label: string): string {
  const id =
    body?.id ??
    body?.data?.id ??
    body?.cliente?.id ??
    body?.client?.id ??
    body?.vehicle?.id ??
    body?.vehiculo?.id ??
    body?.orden?.id ??
    body?.turno?.id;
  if (!id || typeof id !== "string") {
    throw new Error(`${label}: no se encontró id en respuesta: ${JSON.stringify(body)}`);
  }
  return id;
}

async function ensureCliente(): Promise<string> {
  if (state.clientId) return state.clientId;
  const res = await app.inject({
    method: "POST",
    url: "/workshop/clientes",
    headers: auth(),
    payload: { name: `Cliente E2E ${TS}`, email: `e2e-${TS}@test.dev`, phone: "0981000000" },
  });
  expect([200, 201], `POST /workshop/clientes → ${res.statusCode}: ${res.body}`).toContain(res.statusCode);
  state.clientId = pickId(res.json(), "cliente");
  return state.clientId;
}

async function ensureVehiculo(): Promise<string> {
  if (state.vehicleId) return state.vehicleId;
  const clientId = await ensureCliente();
  const res = await app.inject({
    method: "POST",
    url: "/workshop/vehiculos",
    headers: auth(),
    payload: { brand: "Toyota", model: "Corolla", clientId, licensePlate: `E2E${TS}` },
  });
  expect([200, 201], `POST /workshop/vehiculos → ${res.statusCode}: ${res.body}`).toContain(res.statusCode);
  state.vehicleId = pickId(res.json(), "vehiculo");
  return state.vehicleId;
}

async function ensureOrden(hvAlert: boolean): Promise<string> {
  const key = hvAlert ? "ordenHvId" : "ordenId";
  if (state[key]) return state[key]!;
  const [vehicleId, clientId] = [await ensureVehiculo(), await ensureCliente()];
  const res = await app.inject({
    method: "POST",
    url: "/workshop/ordenes",
    headers: auth(),
    payload: {
      vehicleId,
      clientId,
      description: hvAlert ? "Diagnóstico HEV E2E" : "Mantenimiento E2E",
      hvAlert,
    },
  });
  expect([200, 201], `POST /workshop/ordenes → ${res.statusCode}: ${res.body}`).toContain(res.statusCode);
  state[key] = pickId(res.json(), "orden");
  return state[key]!;
}

async function ensureRepuesto(): Promise<{ id: string; codigo: string }> {
  if (state.repuestoId) return { id: state.repuestoId, codigo: `E2E-${TS}` };
  const codigo = `E2E-${TS}`;
  const res = await app.inject({
    method: "POST",
    url: "/inventory/repuestos",
    headers: auth(),
    payload: { codigo, descripcion: "Repuesto E2E auditoría", precioCosto: 100, precioVenta: 150, stockActual: 0 },
  });
  expect([200, 201], `POST /inventory/repuestos → ${res.statusCode}: ${res.body}`).toContain(res.statusCode);
  state.repuestoId = pickId(res.json(), "repuesto");
  return { id: state.repuestoId, codigo };
}

/** Crea (idempotente) la herramienta + instancia de herramienta para tool-loans. */
async function ensureToolFixture(): Promise<void> {
  await asTenant(async (tx) => {
    await tx`
      INSERT INTO herramientas (id, codigo, nombre, tenant_slug)
      VALUES (${HERRAMIENTA_ID}, ${`E2E-HER-${TS}`}, 'Maceta de impacto E2E', ${TENANT})
      ON CONFLICT (id) DO UPDATE SET
        codigo = EXCLUDED.codigo,
        activo = true,
        tenant_slug = EXCLUDED.tenant_slug
    `;
    await tx`
      INSERT INTO tool_instances
        (id, herramienta_id, numero_serie, fecha_adquisicion, estado_actual, activa, tenant_slug)
      VALUES
        (${TOOL_INSTANCE_ID}, ${HERRAMIENTA_ID}, ${`SN-E2E-${TS}`}, CURRENT_DATE, 'DISPONIBLE', true, ${TENANT})
      ON CONFLICT (id) DO UPDATE SET
        estado_actual = 'DISPONIBLE',
        activa = true,
        tecnico_actual_id = NULL,
        orden_trabajo_actual_id = NULL,
        tenant_slug = EXCLUDED.tenant_slug
    `;
  });
}

async function limpiarTenant(): Promise<void> {
  const tablas = [
    "agendamientos",
    "clients",
    "vehiculos",
    "ordenes_trabajo",
    "orden_repuestos",
    "orden_servicios",
    "repuestos",
    "stock_movements",
    "herramientas",
    "tool_instances",
    "control_herramientas",
    "notificaciones",
  ];
  for (const t of tablas) {
    try {
      await asTenant((tx) => tx.unsafe(`DELETE FROM ${t} WHERE tenant_slug = $1`, [TENANT]));
    } catch {
      // tabla sin columna tenant_slug o ya inexistente — se ignora
    }
  }
  try {
    await (getDb() as any)`DELETE FROM plan_cuentas WHERE codigo LIKE 'E2E-%'`;
  } catch {
    // sin filas o sin permiso — se ignora
  }
  const sql = getDb() as any;
  await sql`DELETE FROM profiles WHERE tenant_id = ${TENANT_ID}`;
  await sql`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  const sql = getDb() as any;

  // Tenant + admin profile (sin RLS sobre estas tablas)
  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Reconnected', ${TENANT}, 'tenant_e2e_reconnected', true)
    ON CONFLICT (slug) DO NOTHING
  `;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_PROFILE_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin E2E', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      is_active = true
  `;

  bearer = generateToken({
    id: ADMIN_PROFILE_ID,
    email: ADMIN_EMAIL,
    role: "admin",
    tenantId: TENANT_ID,
    tenantSlug: TENANT,
  });

  app = await buildApp();
  await app.ready();
  baseUrl = await app.listen({ port: 0, host: "127.0.0.1" });
});

afterAll(async () => {
  try {
    await limpiarTenant();
  } catch (err) {
    console.error("[e2e-reconnected] cleanup falló:", err);
  }
  if (app) await app.close();
  // Los crons arrancados por buildApp (setInterval sin stop exportado) mantienen
  // vivo el event loop del fork — desreferenciar para que vitest pueda salir.
  const handles = (process as any)._getActiveHandles?.() ?? [];
  for (const h of handles) {
    if (h && typeof h.unref === "function") {
      try {
        h.unref();
      } catch {
        /* ignore */
      }
    }
  }
});

// ─── Flujos ───────────────────────────────────────────────

describe("Fase 1 — 12 flujos reconectados (app real + DB)", () => {
  it("T-11 citas: crea un turno y lo lee de vuelta", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/scheduling/appointments",
      headers: auth(),
      payload: {
        clienteNombre: "Cliente Turno E2E",
        clientePhone: "0981111111",
        vehiculoChapa: "ABC123",
        vehiculoMarca: "Toyota",
        vehiculoModelo: "Corolla",
        fechaTurno: "2026-10-05",
        horaTurno: "09:30",
        tipoServicio: "RAPIDO",
      },
    });
    expect([200, 201], `POST /scheduling/appointments → ${create.statusCode}: ${create.body}`).toContain(
      create.statusCode,
    );
    const created = create.json();
    state.appointmentId = pickId(created, "turno");
    expect(created.estado).toBeTruthy();

    const read = await app.inject({
      method: "GET",
      url: `/scheduling/appointments/${state.appointmentId}`,
      headers: auth(),
    });
    expect(read.statusCode, read.body).toBe(200);
    const turno = read.json();
    expect(turno.id).toBe(state.appointmentId);
    expect(turno.clienteNombre ?? turno.cliente_nombre).toBe("Cliente Turno E2E");
  });

  it("T-12 SSE: /api/notifications/stream emite evento connected", async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/notifications/stream?tenant=${TENANT}`, {
      headers: auth(),
      signal: controller.signal,
    });
    try {
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      const reader = res.body!.getReader();
      const { value, done } = await reader.read();
      expect(done).toBe(false);
      const chunk = Buffer.from(value!).toString("utf8");
      expect(chunk).toContain('"type":"connected"');
      expect(chunk).toContain(TENANT);
    } finally {
      controller.abort();
    }
  });

  it("T-13 analytics: /analytics/kpis devuelve los 4 KPIs", async () => {
    const res = await app.inject({ method: "GET", url: "/analytics/kpis", headers: auth() });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.kpis)).toBe(true);
    expect(body.kpis).toHaveLength(4);
    expect(body.range).toBeTruthy();
  });

  it("T-14 stock: ingreso y salida actualizan stockActual y registran movimientos", async () => {
    const { id } = await ensureRepuesto();

    const ingreso = await app.inject({
      method: "POST",
      url: `/inventory/repuestos/${id}/ingreso`,
      headers: auth(),
      payload: { cantidad: 10, motivo: "Compra", costoUnitario: 100 },
    });
    expect(ingreso.statusCode, ingreso.body).toBe(200);
    const ing = ingreso.json();
    expect(ing.repuesto.stockActual).toBe(10);
    expect(ing.repuesto.stockAnterior).toBe(0);
    expect(ing.movimiento.cantidad).toBe(10);

    const salida = await app.inject({
      method: "POST",
      url: "/inventory/repuestos/salida",
      headers: auth(),
      payload: { repuestoId: id, cantidad: 4, motivo: "Uso en OT" },
    });
    expect(salida.statusCode, salida.body).toBe(200);
    const sal = salida.json();
    expect(sal.repuesto.stockActual).toBe(6);
    expect(sal.repuesto.stockAnterior).toBe(10);
    expect(sal.movimiento.cantidad).toBe(4);

    const read = await app.inject({ method: "GET", url: `/inventory/repuestos/${id}`, headers: auth() });
    expect(read.statusCode, read.body).toBe(200);
    expect(read.json().stockActual).toBe(6);
  });

  it("T-15 tool-loans: presta y devuelve una herramienta", async () => {
    await ensureToolFixture();
    const ordenId = await ensureOrden(false);

    const lend = await app.inject({
      method: "POST",
      url: "/inventory/tool-loans/lend",
      headers: auth(),
      payload: {
        toolInstanceId: TOOL_INSTANCE_ID,
        ordenTrabajoId: ordenId,
        mecanicoId: ADMIN_PROFILE_ID,
        fechaEsperadaDevolucion: "2026-10-01T00:00:00.000Z",
        condicionSalida: "BUENO",
      },
    });
    expect([200, 201], `POST /inventory/tool-loans/lend → ${lend.statusCode}: ${lend.body}`).toContain(
      lend.statusCode,
    );
    const lendBody = lend.json();
    state.loanId = lendBody?.loan?.id ?? lendBody?.id;
    expect(state.loanId, JSON.stringify(lendBody)).toBeTruthy();

    const dev = await app.inject({
      method: "POST",
      url: `/inventory/tool-loans/${state.loanId}/return`,
      headers: auth(),
      payload: { condicionRetorno: "BUENO", observaciones: "Devuelta E2E" },
    });
    expect(dev.statusCode, dev.body).toBe(200);
    const devBody = dev.json();
    expect(devBody.loan.id).toBe(state.loanId);
    expect(String(devBody.loan.estado)).not.toBe("Asignado");

    const list = await app.inject({ method: "GET", url: "/inventory/tool-loans?limit=50", headers: auth() });
    expect(list.statusCode, list.body).toBe(200);
    const items: any[] = list.json().items ?? [];
    const loan = items.find((i) => i.id === state.loanId);
    expect(loan, "el préstamo devuelto no aparece en GET /inventory/tool-loans").toBeTruthy();
    expect(String(loan!.estado)).not.toBe("Asignado");
  });

  it("T-16 payroll: cálculo mensual responde con comisiones", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/finance/payroll/calculate",
      headers: auth(),
      payload: { month: 9, year: 2026 },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.month).toBe(9);
    expect(body.year).toBe(2026);
    expect(typeof body.commissionsCreated).toBe("number");
  });

  it("T-17 cuentas contables: crea una cuenta y aparece en el árbol", async () => {
    const codigo = `E2E-${TS}`.slice(0, 20);
    const create = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/cuentas",
      headers: auth(),
      payload: { codigo, nombre: "Cuenta E2E Auditoría", tipo: "GASTO" },
    });
    expect([200, 201], `POST /finance/contabilidad/cuentas → ${create.statusCode}: ${create.body}`).toContain(
      create.statusCode,
    );
    const cuenta = create.json();
    expect(cuenta.id).toBeTruthy();
    expect(cuenta.codigo).toBe(codigo);

    const arbol = await app.inject({
      method: "GET",
      url: "/finance/contabilidad/cuentas/arbol",
      headers: auth(),
    });
    expect(arbol.statusCode, arbol.body).toBe(200);
    expect(arbol.body).toContain(codigo);
  });

  it("T-18 label-printing: 6 endpoints responden con su shape", async () => {
    const { id: repuestoId } = await ensureRepuesto();
    await ensureToolFixture();

    const health = await app.inject({ method: "GET", url: "/label-printing/health", headers: auth() });
    expect(health.statusCode, health.body).toBe(200);

    const generate = await app.inject({
      method: "POST",
      url: "/label-printing/generate",
      headers: auth(),
      payload: {
        tipo: "REPUESTO",
        protocolo: "ESCPOS",
        copias: 1,
        data: { codigo: `E2E-${TS}`, descripcion: "Pastilla de freno E2E" },
      },
    });
    expect(generate.statusCode, generate.body).toBe(200);
    const gen = generate.json();
    expect(typeof gen.payload).toBe("string");
    expect(gen.protocol).toBe("ESCPOS");
    expect(gen.copias).toBe(1);

    const preview = await app.inject({
      method: "POST",
      url: "/label-printing/preview",
      headers: auth(),
      payload: { tipo: "HERRAMIENTA", data: { codigo: "HER-E2E", nombre: "Llave dinamométrica" } },
    });
    expect(preview.statusCode, preview.body).toBe(200);
    const prev = preview.json();
    expect(typeof prev.html).toBe("string");
    expect(prev.html.length).toBeGreaterThan(0);
    expect(prev.widthMm).toBeGreaterThan(0);

    const porRepuesto = await app.inject({
      method: "GET",
      url: `/label-printing/repuesto/${repuestoId}`,
      headers: auth(),
    });
    expect(porRepuesto.statusCode, porRepuesto.body).toBe(200);
    expect(porRepuesto.body).toContain(`E2E-${TS}`);

    const porHerramienta = await app.inject({
      method: "GET",
      url: `/label-printing/herramienta/${HERRAMIENTA_ID}`,
      headers: auth(),
    });
    expect(porHerramienta.statusCode, porHerramienta.body).toBe(200);

    const reimpresiones = await app.inject({
      method: "GET",
      url: "/label-printing/reimpresiones",
      headers: auth(),
    });
    expect(reimpresiones.statusCode, reimpresiones.body).toBe(200);
    const reim: any = reimpresiones.json();
    const reimItems = Array.isArray(reim) ? reim : (reim.items ?? reim.facturas ?? reim.data);
    expect(Array.isArray(reimItems), `shape inesperado: ${reimpresiones.body}`).toBe(true);
  });

  it("T-19 storage: round-trip upload → GET /storage", async () => {
    const contenido = `hola-e2e-${TS}`;
    const uploaded = await uploadFile({
      bucket: "e2e-reconnected",
      path: "roundtrip.txt",
      data: Buffer.from(contenido, "utf8"),
      contentType: "text/plain",
    });
    expect(uploaded.size).toBe(Buffer.byteLength(contenido));

    const res = await app.inject({
      method: "GET",
      url: "/storage/e2e-reconnected/roundtrip.txt",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.body).toBe(contenido);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("T-20 lockout HEV: bloquea Listo sin firma, firma y libera", async () => {
    const ordenHvId = await ensureOrden(true);

    const bloqueado = await app.inject({
      method: "PATCH",
      url: `/workshop/ordenes/${ordenHvId}/status`,
      headers: auth(),
      payload: { status: "Listo" },
    });
    expect([400, 409, 422], `PATCH status sin firma → ${bloqueado.statusCode}: ${bloqueado.body}`).toContain(
      bloqueado.statusCode,
    );
    expect(bloqueado.body).toMatch(/lockout|alta tensión/i);

    const firma = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenHvId}/sign-lockout`,
      headers: auth(),
      payload: { mechanicId: ADMIN_PROFILE_ID },
    });
    expect(firma.statusCode, firma.body).toBe(200);
    const firmada = firma.json();
    expect(firmada.signed).toBe(true);
    expect(firmada.signedAt).toBeTruthy();

    const listo = await app.inject({
      method: "PATCH",
      url: `/workshop/ordenes/${ordenHvId}/status`,
      headers: auth(),
      payload: { status: "Listo" },
    });
    expect(listo.statusCode, listo.body).toBe(200);
    expect(listo.json().status).toBe("Listo");
  });

  it("T-21 portal cliente: PIN → sesión → /portal/summary", { timeout: 60000 }, async () => {
    const clientId = await ensureCliente();

    const pinRes = await app.inject({
      method: "POST",
      url: "/portal/auth/pin",
      headers: auth(),
      payload: { clientId },
    });
    expect(pinRes.statusCode, pinRes.body).toBe(200);
    const { success, pin } = pinRes.json();
    expect(success).toBe(true);
    expect(pin).toMatch(/^\d{6}$/);

    const valRes = await app.inject({
      method: "POST",
      url: "/portal/auth/pin/validate",
      headers: auth(),
      payload: { clientId, pin },
    });
    expect(valRes.statusCode, valRes.body).toBe(200);
    const { session } = valRes.json();
    expect(typeof session).toBe("string");

    const portalHeaders = { ...auth(), "x-portal-session": session };
    const sesion = await app.inject({ method: "GET", url: "/portal/session", headers: portalHeaders });
    expect(sesion.statusCode, sesion.body).toBe(200);
    expect(sesion.json().valid).toBe(true);

    const summary = await app.inject({ method: "GET", url: "/portal/summary", headers: portalHeaders });
    expect(summary.statusCode, summary.body).toBe(200);
    const resumen = summary.json();
    expect(resumen).toBeTruthy();
    expect(typeof resumen).toBe("object");
  });

  it("colaterales: shapes paginados de repuestos, clientes y turnos", async () => {
    const repuestos = await app.inject({
      method: "GET",
      url: "/inventory/repuestos?page=1&limit=5",
      headers: auth(),
    });
    expect(repuestos.statusCode, repuestos.body).toBe(200);
    const rp = repuestos.json();
    expect(Array.isArray(rp.items)).toBe(true);
    expect(typeof rp.total).toBe("number");
    expect(rp.page).toBe(1);
    expect(typeof rp.totalPages).toBe("number");

    const clientes = await app.inject({ method: "GET", url: "/workshop/clientes", headers: auth() });
    expect(clientes.statusCode, clientes.body).toBe(200);
    const cl: any = clientes.json();
    const clientesArr = Array.isArray(cl) ? cl : (cl.items ?? cl.data ?? cl.clientes);
    expect(Array.isArray(clientesArr)).toBe(true);

    const turnos = await app.inject({ method: "GET", url: "/scheduling/appointments?limit=10", headers: auth() });
    expect(turnos.statusCode, turnos.body).toBe(200);
    const tn: any = turnos.json();
    const turnosArr = Array.isArray(tn) ? tn : (tn.items ?? tn.data ?? tn.turnos ?? tn.appointments);
    expect(Array.isArray(turnosArr)).toBe(true);
  });
});
