/**
 * Sprint 110 — clase D tanda 2 (liviana): tests de comportamiento para los
 * 8 paths huérfanos restantes de escritura sin consumidor ni test.
 *
 * Universo (Docs/T47 balde "decidir/conectar"): items y refresh de
 * presupuestos, cuenta de tesorería, perfil del contribuyente, instancia de
 * WhatsApp, compartir DVI, exportación RG 90 y guardar en contingencia SIFEN.
 * Se evitó a propósito contabilidad (~21 rutas, fixtures pesadas de períodos)
 * y sifen emitir/firmar (riesgo de llamada externa al DNIT).
 *
 * Nota: DELETE /whatsapp/instance llama a Evolution API (localhost) pero
 * `deleteInstance` traga todo error — la respuesta es siempre 200.
 *
 * Patrón idéntico a tests/fase6-s109-classd.test.ts: tenant propio
 * "e2e-s110", fixtures idempotentes, limpieza en afterAll, SQL crudo para
 * aserciones fuera del API. Cada test usa app.inject con object literal
 * {method, url} o template literal para que el scanner de T-63 cuente la
 * cobertura.
 *
 * @module tests/fase7-s110-classd2
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s110";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f110";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f11a";
const ADMIN_EMAIL = "admin@e2e-s110.test";
const TS = Date.now().toString(36);

let app: FastifyInstance;
let bearer: string;

let centroId: string;
let presupuestoId: string;
let cuentaId: string;
let planCuentaId: string;
let asientoId: string;

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
    payload: { vehicleId, clientId, description: `Sprint 110 ${TS}` },
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
    VALUES (${TENANT_ID}, 'E2E Sprint 110', ${TENANT}, 'tenant_e2e_s110', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 110', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;

  bearer = generateToken({
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: "admin",
    tenantId: TENANT_ID,
    tenantSlug: TENANT,
  });

  // ── Fixtures SQL: presupuesto + centro de costo ──
  centroId = crypto.randomUUID();
  await sql`
    INSERT INTO centros_costo (id, codigo, nombre, tenant_slug)
    VALUES (${centroId}, ${`CC110${TS}`.slice(0, 20)}, ${`Taller Central ${TS}`}, ${TENANT})`;

  presupuestoId = crypto.randomUUID();
  await sql`
    INSERT INTO presupuestos (id, periodo, descripcion, estado, tenant_slug)
    VALUES (${presupuestoId}, '2045-12', ${`Presupuesto S110 ${TS}`}, 'borrador', ${TENANT})`;

  // ── Fixture SQL: cuenta bancaria ──
  cuentaId = crypto.randomUUID();
  await sql`
    INSERT INTO cuentas_bancarias (id, codigo, nombre, tipo, tenant_slug)
    VALUES (${cuentaId}, ${`TB110${TS}`.slice(0, 20)}, 'Cuenta S110', 'BANCO', ${TENANT})`;

  // ── Fixtures SQL: asiento contabilizado para RG 90 (período aislado 2045-12) ──
  planCuentaId = crypto.randomUUID();
  await sql`
    INSERT INTO plan_cuentas (id, codigo, nombre, tipo)
    VALUES (${planCuentaId}, '6.9.01', 'Gasto Sprint 110', 'GASTO')`;

  asientoId = crypto.randomUUID();
  await sql`
    INSERT INTO asientos_contables (id, numero, fecha, concepto, estado)
    VALUES (${asientoId}, 990111, '2045-12-15T12:00:00Z', ${`Asiento S110 ${TS}`}, 'CONTABILIZADO')`;
  await sql`
    INSERT INTO asientos_detalle (asiento_id, cuenta_id, numero_linea, debe, descripcion)
    VALUES (${asientoId}, ${planCuentaId}, 1, 50000, 'Detalle S110')`;

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  const limpiar = [
    `DELETE FROM audit_log WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM dvi_items WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM dvi_photos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM dvi_inspections WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM presupuestos_items WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM presupuestos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM centros_costo WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM cuentas_bancarias WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM tenant_config WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM libros_obligatorios WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM sifen_contingencia_queue WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM asientos_detalle WHERE asiento_id = '${asientoId}'`,
    `DELETE FROM asientos_contables WHERE id = '${asientoId}'`,
    `DELETE FROM plan_cuentas WHERE id = '${planCuentaId}'`,
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
      console.error("[s110] cleanup falló:", stmt, err);
    }
  }
  if (app) await app.close();
});

// ─── /finance/presupuestos ────────────────────────────────

describe("clase D — finance/presupuestos items", () => {
  let itemId: string;

  it("POST /finance/presupuestos/:id/items crea → 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/presupuestos/${presupuestoId}/items`,
      headers: auth(),
      payload: { centroCostoId: centroId, categoria: "repuestos", montoPresupuestado: 150000 },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(201);
    itemId = pickId(res.json(), "presupuesto item");
    expect(res.json().montoPresupuestado).toBe("150000.00");
    expect(res.json().categoria).toBe("repuestos");
  });

  it("POST duplicado (mismo centro+categoría) → 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/presupuestos/${presupuestoId}/items`,
      headers: auth(),
      payload: { centroCostoId: centroId, categoria: "repuestos", montoPresupuestado: 1 },
    });
    expect(res.statusCode, `POST duplicado → ${res.statusCode}: ${res.body}`).toBe(409);
  });

  it("POST a presupuesto inexistente → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/presupuestos/${crypto.randomUUID()}/items`,
      headers: auth(),
      payload: { centroCostoId: centroId, categoria: "repuestos", montoPresupuestado: 1 },
    });
    expect(res.statusCode, `POST 404 → ${res.statusCode}: ${res.body}`).toBe(404);
  });

  it("el ítem persiste en BD", async () => {
    const fila = await q<{ id: string; monto_real: string }>`
      SELECT id, monto_real FROM presupuestos_items WHERE id = ${itemId}`;
    expect(fila).toHaveLength(1);
    expect(fila[0].monto_real).toBe("0.00");
  });
});

describe("clase D — finance/presupuestos refresh", () => {
  it("POST /finance/presupuestos/:id/refresh → 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/presupuestos/${presupuestoId}/refresh`,
      headers: auth(),
    });
    expect(res.statusCode, `refresh → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("refresh de presupuesto inexistente → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/presupuestos/${crypto.randomUUID()}/refresh`,
      headers: auth(),
    });
    expect(res.statusCode, `refresh 404 → ${res.statusCode}: ${res.body}`).toBe(404);
  });
});

// ─── /finance/treasury/cuentas ────────────────────────────

describe("clase D — finance/treasury/cuentas", () => {
  it("PATCH /finance/treasury/cuentas/:id persiste → 200", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/finance/treasury/cuentas/${cuentaId}`,
      headers: auth(),
      payload: { nombre: `Cuenta S110 editada ${TS}`, banco: "BBVA" },
    });
    expect(res.statusCode, `PATCH → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json().nombre).toBe(`Cuenta S110 editada ${TS}`);
    const fila = await q<{ banco: string }>`
      SELECT banco FROM cuentas_bancarias WHERE id = ${cuentaId}`;
    expect(fila[0]?.banco).toBe("BBVA");
  });

  it("PATCH de cuenta inexistente → 404", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/finance/treasury/cuentas/${crypto.randomUUID()}`,
      headers: auth(),
      payload: { nombre: "No existe" },
    });
    expect(res.statusCode, `PATCH 404 → ${res.statusCode}: ${res.body}`).toBe(404);
  });
});

// ─── /api/tenant/profile ──────────────────────────────────

describe("clase D — api/tenant/profile", () => {
  it("GET /api/tenant/profile auto-crea perfil → 200", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tenant/profile",
      headers: auth(),
    });
    expect(res.statusCode, `GET → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json().tenantSlug).toBe(TENANT);
    expect(typeof res.json().clasificacionMic).toBe("string");
  });

  it("PATCH /api/tenant/profile reclasifica → 200", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/tenant/profile",
      headers: auth(),
      payload: {
        razonSocial: `Taller S110 ${TS}`,
        ingresosAnuales: 750000000,
        cantidadPersonal: 4,
      },
    });
    expect(res.statusCode, `PATCH → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.razonSocial).toBe(`Taller S110 ${TS}`);
    expect(body.ingresosAnuales).toBe("750000000.00");
    expect(body.cantidadPersonal).toBe(4);
    expect(typeof body.clasificacionMic).toBe("string");
    expect(typeof body.regimenIre).toBe("string");
  });
});

// ─── /whatsapp/instance ───────────────────────────────────

describe("clase D — whatsapp/instance", () => {
  // deleteInstance llama a Evolution API (localhost) y traga cualquier error:
  // la respuesta es siempre 200. Timeout amplio por si la API local tarda.
  it(
    "DELETE /whatsapp/instance → 200",
    async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/whatsapp/instance",
        headers: auth(),
      });
      expect(res.statusCode, `DELETE → ${res.statusCode}: ${res.body}`).toBe(200);
      expect(res.json().success).toBe(true);
    },
    30000,
  );
});

// ─── /dvi/:id/share ───────────────────────────────────────

describe("clase D — dvi share", () => {
  it("POST /dvi/:id/share devuelve URL → 200", async () => {
    const clientId = await crearCliente(`Cliente Share ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `SHARE${TS}`.slice(0, 8).toUpperCase());
    const ordenId = await crearOrden(clientId, vehicleId);

    const dvi = await app.inject({
      method: "POST",
      url: "/dvi",
      headers: auth(),
      payload: { ordenTrabajoId: ordenId, inspector: `Inspector S110 ${TS}` },
    });
    expect(dvi.statusCode, `POST /dvi → ${dvi.statusCode}: ${dvi.body}`).toBe(201);
    const dviId = pickId(dvi.json(), "dvi");

    const res = await app.inject({
      method: "POST",
      url: `/dvi/${dviId}/share`,
      headers: auth(),
    });
    expect(res.statusCode, `share → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json().healthScoreUrl).toMatch(/^https:\/\/dvi\.taller\.com\.py\/score\//);

    const fila = await q<{ compartido_whatsapp: boolean }>`
      SELECT compartido_whatsapp FROM dvi_inspections WHERE id = ${dviId}`;
    expect(fila[0]?.compartido_whatsapp).toBe(true);
  });
});

// ─── /finance/rg90/exportar ───────────────────────────────

describe("clase D — finance/rg90/exportar", () => {
  it("POST /finance/rg90/exportar con asientos → 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/rg90/exportar",
      headers: auth(),
      payload: { anho: 2045, mes: 12, formato: "JSON" },
    });
    expect(res.statusCode, `exportar → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.totalRegistros).toBe(1);
    expect(body.archivoUrl).toContain("2045");
    expect(body.formato).toBe("JSON");
  });

  it("POST /finance/rg90/exportar sin asientos → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/rg90/exportar",
      headers: auth(),
      payload: { anho: 2046, mes: 1, formato: "JSON" },
    });
    expect(res.statusCode, `exportar 404 → ${res.statusCode}: ${res.body}`).toBe(404);
  });
});

// ─── /finance/sifen/contingencia/guardar ──────────────────

describe("clase D — sifen/contingencia/guardar", () => {
  it("POST /finance/sifen/contingencia/guardar encola → 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/sifen/contingencia/guardar",
      headers: auth(),
      payload: {
        documentoId: crypto.randomUUID(),
        xmlOriginal: "<DTE>prueba sprint 110</DTE>",
        dteTipo: "01",
        totalDocumento: "100000",
      },
    });
    expect(res.statusCode, `guardar → ${res.statusCode}: ${res.body}`).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(typeof body.entryId).toBe("string");
    expect(typeof body.queueSize).toBe("number");
  });

  it("POST sin campos requeridos → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/sifen/contingencia/guardar",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode, `guardar 400 → ${res.statusCode}: ${res.body}`).toBe(400);
  });
});
