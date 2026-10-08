/**
 * Sprint 111 — clase D tanda 3 (contabilidad): tests de comportamiento para
 * los 19 paths huérfanos restantes de /finance/contabilidad/*.
 *
 * Universo: asientos/automatico, apertura, devengamiento (ingresos, gastos,
 * revertir), depreciación (activos, calcular), centralización (ventas,
 * compras, ejecutar), tipos-cambio, diferencia-cambio, revaluo, refundir,
 * reserva-legal, centros-costo, reversar, validar y nota-credito-debito.
 * Quedan fuera las 3 externas sifen/emitir|firmar|consultar-lote (DNIT).
 *
 * Fixtures: plan de cuentas mínimo (12 cuentas; saldo inicial 5M/5M para la
 * apertura), activo fijo con depreciación y revalúo, liquidación IRE 2045
 * para la reserva legal, asientos fixture para refundir/reversar y factura
 * fixture para la NC. Limpieza en afterAll (capturados + sweeps por
 * módulo/fecha + tenant) y pre-limpieza en beforeAll (corridas previas).
 *
 * Previamente aplicó 2 fixes de código para que estos tests sean posibles:
 *   1. generarAsientoAutomatico desbalanceaba (2t vs t → 422): añade el par
 *      Costo/Inventario (1.1.03.x) — ledger.service.ts
 *   2. schema refundir exigía minItems 1 pero el servicio requiere ≥2
 *      (un id → 500): minItems 2 — routes/accounting.ts
 *
 * Patrón idéntico a tests/fase7-s110-classd2.test.ts: tenant propio
 * "e2e-s111", fixtures idempotentes, SQL crudo para verificaciones fuera
 * del API y object literals {method, url} para el scanner de T-63.
 *
 * @module tests/fase7-s111-contabilidad
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s111";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f111";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f11b";
const ADMIN_EMAIL = "admin@e2e-s111.test";
const TS = Date.now().toString(36);

const ASIENTO_REVERSAR = "00000000-0000-0000-0000-0000c111a001";
const REF_REVERSAR = "00000000-0000-0000-0000-0000c111d001";
const REFUND_A = "00000000-0000-0000-0000-0000c111a002";
const REFUND_B = "00000000-0000-0000-0000-0000c111a003";
const FACTURA_ID = "00000000-0000-0000-0000-0000c111f001";
const PERIODO_FISCAL_ID = "00000000-0000-0000-0000-0000c111b001";
const LIQUIDACION_ID = "00000000-0000-0000-0000-0000c111e001";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** [codigo, nombre, tipo, saldo_inicial] */
const CUENTAS_SEMILLA: Array<[string, string, string, number]> = [
  ["1.1.01.001", "Caja S111", "ACTIVO", 0],
  ["1.1.02", "Cuentas por Cobrar S111", "ACTIVO", 0],
  ["1.1.03.001", "Inventario Repuestos S111", "ACTIVO", 0],
  ["1.1.99.01", "Activo Diverso S111", "ACTIVO", 5000000],
  ["1.2.99", "Depreciación Acumulada S111", "ACTIVO", 0],
  ["2.1.99.01", "Pasivo Diverso S111", "PASIVO", 5000000],
  ["3.3.99.01", "Reserva de Revalúo S111", "PATRIMONIO", 0],
  ["3.4.99.01", "Ganancias Retenidas S111", "PATRIMONIO", 0],
  ["3.5.99.01", "Reserva Legal S111", "PATRIMONIO", 0],
  ["4.1.99", "Ingresos Devengados S111", "INGRESO", 0],
  ["6.1.01", "Costo de Servicios S111", "COSTO", 0],
  ["6.3.01", "Gasto Depreciación S111", "GASTO", 0],
];

let app: FastifyInstance;
let bearer: string;
let activoId: string;

const cuentas = new Map<string, string>();
const capturados: string[] = [];

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

function cuenta(codigo: string): string {
  const id = cuentas.get(codigo);
  if (!id) throw new Error(`Cuenta ${codigo} sin sembrar`);
  return id;
}

function capturar(id: unknown): void {
  if (typeof id === "string" && UUID_RE.test(id)) capturados.push(id);
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
    payload: { vehicleId, clientId, description: `Sprint 111 ${TS}` },
  });
  expect([200, 201], `POST ordenes → ${res.statusCode}: ${res.body}`).toContain(res.statusCode);
  return pickId(res.json(), "orden");
}

// ─── Limpieza ─────────────────────────────────────────────

/** Sweep de asientos creados por esta suite (capturados + módulo/fecha + S111). */
function sweepAsientos(): string {
  const ids = [
    ...new Set([ASIENTO_REVERSAR, REFUND_A, REFUND_B, ...capturados]),
  ].filter((id) => UUID_RE.test(id));
  const lista = ids.map((id) => `'${id}'`).join(", ");
  return `concepto LIKE '%S111%'
    OR id IN (${lista})
    OR (modulo_origen IN ('APERTURA', 'DEPRECIACION', 'RESERVA_LEGAL', 'REVALUO', 'REFUNDICION', 'REVERSION_DEVENGAMIENTO')
        AND fecha >= '2045-10-01' AND fecha < '2046-01-02')
    OR (modulo_origen = 'DEVENGAMIENTO_INGRESOS' AND fecha >= '2045-12-01' AND fecha < '2046-01-01')
    OR (modulo_origen = 'DEVENGAMIENTO_GASTOS' AND fecha::date = CURRENT_DATE)`;
}

async function limpiarTodo(): Promise<void> {
  const sql = getDb() as unknown as {
    (s: TemplateStringsArray, ...v: unknown[]): Promise<unknown>;
    unsafe: (stmt: string) => Promise<unknown>;
  };
  const sweep = sweepAsientos();
  const codigos = CUENTAS_SEMILLA.map(([c]) => `'${c}'`).join(", ");
  const sentencias = [
    `DELETE FROM audit_log WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM revaluaciones WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM depreciacion_activos WHERE activo_fijo_id IN (SELECT id FROM activos_fijos WHERE tenant_slug = '${TENANT}')`,
    `DELETE FROM activos_fijos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM liquidaciones_ire WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM periodos_fiscales WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM tipos_cambio WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM centros_costo WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM facturas WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM asientos_detalle WHERE asiento_id IN (SELECT id FROM asientos_contables WHERE ${sweep})`,
    `DELETE FROM asientos_contables WHERE ${sweep}`,
    `DELETE FROM plan_cuentas WHERE codigo IN (${codigos})`,
    `DELETE FROM orden_repuestos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM ordenes_trabajo WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM vehiculos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM clients WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM tenant_config WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM profiles WHERE tenant_id = '${TENANT_ID}'`,
    `DELETE FROM tenants WHERE id = '${TENANT_ID}'`,
  ];
  for (const stmt of sentencias) {
    try {
      await sql.unsafe(stmt);
    } catch (err) {
      console.error("[s111] cleanup falló:", stmt, err);
    }
  }
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  // Corridas previas: restos de fixtures/tenant/plan
  await limpiarTodo();

  await q`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Sprint 111', ${TENANT}, 'tenant_e2e_s111', true)
    ON CONFLICT (slug) DO NOTHING`;
  await q`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 111', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;

  bearer = generateToken({
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: "admin",
    tenantId: TENANT_ID,
    tenantSlug: TENANT,
  });

  // ── Plan de cuentas mínimo (apertura 5M = 5M, pares para el asiento
  //    automático, devengamiento, revalúo, reserva legal y NC) ──
  for (const [codigo, nombre, tipo, saldo] of CUENTAS_SEMILLA) {
    await q`
      INSERT INTO plan_cuentas (codigo, nombre, tipo, saldo_inicial)
      VALUES (${codigo}, ${nombre}, ${tipo}, ${saldo})
      ON CONFLICT (codigo) DO NOTHING`;
  }
  for (const [codigo] of CUENTAS_SEMILLA) {
    const [fila] = await q<{ id: string }>`
      SELECT id FROM plan_cuentas WHERE codigo = ${codigo}`;
    if (!fila) throw new Error(`Cuenta ${codigo} no sembrada`);
    cuentas.set(codigo, fila.id);
  }

  // ── Fixture: asiento CONTABILIZADO para reversar (SIFEN) ──
  await q`
    INSERT INTO asientos_contables (id, numero, fecha, concepto, estado, documento_ref, modulo_origen)
    VALUES (${ASIENTO_REVERSAR}, 990201, '2045-10-15T12:00:00Z',
      ${`Asiento fixture reversa S111 ${TS}`}, 'CONTABILIZADO', ${`SIFEN:${REF_REVERSAR}`}, 'TEST_S111')`;
  await q`
    INSERT INTO asientos_detalle (asiento_id, cuenta_id, numero_linea, debe, descripcion)
    VALUES (${ASIENTO_REVERSAR}, ${cuenta("1.1.01.001")}, 1, 100, 'Fixture reversa S111')`;
  await q`
    INSERT INTO asientos_detalle (asiento_id, cuenta_id, numero_linea, haber, descripcion)
    VALUES (${ASIENTO_REVERSAR}, ${cuenta("2.1.99.01")}, 2, 100, 'Fixture reversa S111')`;

  // ── Fixtures: 2 asientos para refundir (netos 350/350 balanceados) ──
  await q`
    INSERT INTO asientos_contables (id, numero, fecha, concepto, estado, modulo_origen)
    VALUES (${REFUND_A}, 990211, '2045-11-15T12:00:00Z',
      ${`Refundición fixture A S111 ${TS}`}, 'CONTABILIZADO', 'TEST_S111')`;
  await q`
    INSERT INTO asientos_detalle (asiento_id, cuenta_id, numero_linea, debe, descripcion)
    VALUES (${REFUND_A}, ${cuenta("1.1.01.001")}, 1, 100, 'Refund A S111')`;
  await q`
    INSERT INTO asientos_detalle (asiento_id, cuenta_id, numero_linea, haber, descripcion)
    VALUES (${REFUND_A}, ${cuenta("2.1.99.01")}, 2, 100, 'Refund A S111')`;
  await q`
    INSERT INTO asientos_contables (id, numero, fecha, concepto, estado, modulo_origen)
    VALUES (${REFUND_B}, 990212, '2045-11-20T12:00:00Z',
      ${`Refundición fixture B S111 ${TS}`}, 'CONTABILIZADO', 'TEST_S111')`;
  await q`
    INSERT INTO asientos_detalle (asiento_id, cuenta_id, numero_linea, debe, descripcion)
    VALUES (${REFUND_B}, ${cuenta("1.1.01.001")}, 1, 250, 'Refund B S111')`;
  await q`
    INSERT INTO asientos_detalle (asiento_id, cuenta_id, numero_linea, haber, descripcion)
    VALUES (${REFUND_B}, ${cuenta("2.1.99.01")}, 2, 250, 'Refund B S111')`;

  // ── Fixture: liquidación IRE 2045 (reserva legal 5%) ──
  await q`
    INSERT INTO periodos_fiscales (id, formulario, anho, mes, tenant_slug)
    VALUES (${PERIODO_FISCAL_ID}, 'FORM_500_IRE', 2045, 12, ${TENANT})
    ON CONFLICT DO NOTHING`;
  await q`
    INSERT INTO liquidaciones_ire (id, periodo_fiscal_id, renta_neta, tenant_slug)
    VALUES (${LIQUIDACION_ID}, ${PERIODO_FISCAL_ID}, 10000000, ${TENANT})
    ON CONFLICT (id) DO NOTHING`;

  // ── Fixture: factura original para la nota de crédito ──
  await q`
    INSERT INTO facturas (id, tenant_slug, tipo, total)
    VALUES (${FACTURA_ID}, ${TENANT}, 'MANUAL', 500000)
    ON CONFLICT (id) DO NOTHING`;

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await limpiarTodo();
  if (app) await app.close();
});

// ─── Tests ────────────────────────────────────────────────

describe("clase D — contabilidad (Sprint 111)", () => {
  it("POST /finance/contabilidad/centros-costo crea → 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/centros-costo",
      headers: auth(),
      payload: { codigo: `CC111${TS}`.slice(0, 20), nombre: `Centro S111 ${TS}` },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(201);
    const body = res.json();
    expect(body.id, JSON.stringify(body)).toBeTruthy();
    expect(String(body.codigo)).toMatch(/^CC111/);
  });

  it("POST /finance/contabilidad/tipos-cambio registra USD → 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/tipos-cambio",
      headers: auth(),
      payload: { moneda: "USD", fecha: "2045-12-15", compra: 7000, venta: 7100 },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(201);
    const body = res.json();
    expect(body.id, JSON.stringify(body)).toBeTruthy();
    expect(body.moneda).toBe("USD");
  });

  it("POST /finance/contabilidad/diferencia-cambio/calcular sin cuentas ME → 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/diferencia-cambio/calcular",
      headers: auth(),
      payload: { anho: 2045, mes: 12 },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.periodo).toBe("2045-12");
  });

  it("POST /finance/contabilidad/depreciacion/activos crea → 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/depreciacion/activos",
      headers: auth(),
      payload: {
        codigo: `FA111${TS}`,
        nombre: "Equipo Diagnóstico S111",
        tipo: "EQUIPO_DIAGNOSTICO",
        fechaAdquisicion: "2045-01-10",
        costoAdquisicion: 1200000,
        vidaUtilAnos: 5,
      },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(201);
    const body = res.json();
    activoId = pickId(body, "activo fijo");
    expect(body.estado).toBe("ACTIVO");
  });

  it("POST /finance/contabilidad/depreciacion/calcular 2045-12 → 200 con asiento", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/depreciacion/calcular",
      headers: auth(),
      payload: { anho: 2045, mes: 12 },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.periodo).toBe("2045-12");
    expect(body.fixedAssetsCount).toBeGreaterThanOrEqual(1);
    expect(body.totalDepreciacion).toBeGreaterThan(0);
    expect(body.asientoId, JSON.stringify(body)).toBeTruthy();
    capturar(body.asientoId);
  });

  it("POST /finance/contabilidad/revaluo incrementa → 200 + BD actualizada", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/revaluo",
      headers: auth(),
      payload: {
        activoFijoId: activoId,
        nuevoValor: 1500000,
        fecha: "2045-11-15",
        motivo: `Tasación S111 ${TS}`,
      },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.tipo).toBe("INCREMENTO");
    expect(body.asientoId, JSON.stringify(body)).toBeTruthy();
    expect(body.incremento).toBeGreaterThan(0);
    capturar(body.asientoId);

    const [fila] = await q<{ valor_actual_libros: string }>`
      SELECT valor_actual_libros FROM activos_fijos WHERE id = ${activoId}`;
    expect(fila?.valor_actual_libros).toBe("1500000.00");
  });

  it("POST /finance/contabilidad/apertura 2045-12 → 201 balanceado", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/apertura",
      headers: auth(),
      payload: { anho: 2045, mes: 12 },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(201);
    const body = res.json();
    expect(body.asiento, JSON.stringify(body)).toBeTruthy();
    expect(body.asiento.totalDebe).toBe(body.asiento.totalHaber);
    expect(parseFloat(body.asiento.totalDebe)).toBeGreaterThanOrEqual(5000000);
    expect(body.lineas.length).toBeGreaterThanOrEqual(2);
    capturar(body.asiento.id);
  });

  it("POST /finance/contabilidad/asientos/automatico → 201 con 4 líneas balanceadas", async () => {
    const clienteId = await crearCliente(`Cliente S111 ${TS}`);
    const vehiculoId = await crearVehiculo(clienteId, `S111${TS}`.toUpperCase().slice(0, 7));
    const ordenId = await crearOrden(clienteId, vehiculoId);
    await q`
      UPDATE ordenes_trabajo SET total_cost = 500000 WHERE id = ${ordenId}`;

    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/asientos/automatico",
      headers: auth(),
      payload: {
        ordenTrabajoId: ordenId,
        fecha: "2045-10-20T10:00:00.000Z",
        concepto: `Facturación automática S111 ${TS}`,
      },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(201);
    const body = res.json();
    expect(body.asiento.totalDebe).toBe(body.asiento.totalHaber);
    expect(body.lineas).toHaveLength(4);
    capturar(body.asiento.id);
  });

  it("POST /finance/contabilidad/devengamiento/ingresos → 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/devengamiento/ingresos",
      headers: auth(),
      payload: { anho: 2045, mes: 12 },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    capturar(body.asientoId);
  });

  it("POST /finance/contabilidad/devengamiento/gastos → 200 con asiento", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/devengamiento/gastos",
      headers: auth(),
      payload: {
        gastos: [
          {
            concepto: `Gasto S111 ${TS}`,
            monto: 75000,
            cuentaGastoId: cuenta("6.3.01"),
            cuentaPagarId: cuenta("2.1.99.01"),
          },
        ],
      },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.asientoId, JSON.stringify(body)).toBeTruthy();
    expect(body.totalDebe).toBe("75000.00");
    capturar(body.asientoId);
  });

  it("POST /finance/contabilidad/devengamiento/revertir → 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/devengamiento/revertir",
      headers: auth(),
      payload: { anho: 2045, mes: 12 },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    capturar(body.asientoId);
  });

  it("POST /finance/contabilidad/centralizacion/ventas → 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/centralizacion/ventas",
      headers: auth(),
      payload: { anho: 2045, mes: 11 },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.module).toBe("VENTAS");
    expect(body.success).toBe(true);
  });

  it("POST /finance/contabilidad/centralizacion/compras → 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/centralizacion/compras",
      headers: auth(),
      payload: { anho: 2045, mes: 11 },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.module).toBe("COMPRAS");
    expect(body.success).toBe(true);
  });

  it("POST /finance/contabilidad/centralizacion/ejecutar → 200 consolidado", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/centralizacion/ejecutar",
      headers: auth(),
      payload: { anho: 2045, mes: 11 },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.periodo).toBe("2045-11");
    expect(body.consolidado).toBe(true);
  });

  it("POST /finance/contabilidad/refundir consolida 2 asientos → 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/refundir",
      headers: auth(),
      payload: {
        asientoIds: [REFUND_A, REFUND_B],
        fecha: "2045-11-20",
        concepto: `Refundición S111 ${TS}`,
      },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.asientosOriginales).toBe(2);
    expect(body.lineasConsolidadas).toBe(2);
    expect(body.totalDebe).toBe("350.00");
    expect(body.totalHaber).toBe("350.00");
    expect(body.asientoNuevoId).toBeTruthy();
    capturar(body.asientoNuevoId);

    const [fila] = await q<{ modulo_origen: string }>`
      SELECT modulo_origen FROM asientos_contables WHERE id = ${REFUND_A}`;
    expect(fila?.modulo_origen).toBe("TEST_S111_REFUNDIDO");
  });

  it("POST /finance/contabilidad/refundir con 1 asiento → 400 (minItems 2)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/refundir",
      headers: auth(),
      payload: { asientoIds: [REFUND_A] },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(400);
  });

  it("POST /finance/contabilidad/reversar revierte → 200 + original ANULADO", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/reversar",
      headers: auth(),
      payload: {
        referenciaId: REF_REVERSAR,
        referenciaTipo: "SIFEN",
        motivo: `Reversa S111 ${TS}`,
      },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.reversalAsientoId, JSON.stringify(body)).toBeTruthy();
    capturar(body.reversalAsientoId);

    const [fila] = await q<{ estado: string }>`
      SELECT estado FROM asientos_contables WHERE id = ${ASIENTO_REVERSAR}`;
    expect(fila?.estado).toBe("ANULADO");
  });

  it("POST /finance/contabilidad/reversar repetido → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/reversar",
      headers: auth(),
      payload: {
        referenciaId: REF_REVERSAR,
        referenciaTipo: "SIFEN",
        motivo: `Reversa repetida S111 ${TS}`,
      },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(404);
  });

  it("POST /finance/contabilidad/reversar sin campos → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/reversar",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(400);
    expect(String(res.json().error)).toContain("Se requieren");
  });

  it("POST /finance/contabilidad/reserva-legal 2045 → 200 con asiento", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/reserva-legal",
      headers: auth(),
      payload: { anho: 2045 },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.rentaNeta).toBe(10000000);
    expect(body.reservaLegalCalculada).toBeGreaterThan(0);
    expect(body.asientoId, JSON.stringify(body)).toBeTruthy();
    capturar(body.asientoId);
  });

  it("POST /finance/contabilidad/validar sin mapping → 200 valido=false", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/validar",
      headers: auth(),
      payload: { modulo: "CONTABILIDAD", tipoEvento: "EVENTO_S111", monto: 150000 },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.valido).toBe(false);
    expect(String(body.errores?.[0] ?? "")).toContain("No hay mapping");
  });

  it("POST /finance/contabilidad/nota-credito-debito sin campos → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/nota-credito-debito",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(400);
    expect(String(res.json().error)).toContain("Se requieren");
  });

  it("POST /finance/contabilidad/nota-credito-debito tipo inválido → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/nota-credito-debito",
      headers: auth(),
      payload: { facturaOriginalId: crypto.randomUUID(), tipo: "INVALIDO", motivo: "x" },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(400);
    expect(String(res.json().error)).toContain("tipo debe ser");
  });

  it("POST /finance/contabilidad/nota-credito-debito factura inexistente → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/nota-credito-debito",
      headers: auth(),
      payload: {
        facturaOriginalId: crypto.randomUUID(),
        tipo: "CREDITO",
        motivo: `NC missing S111 ${TS}`,
      },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(String(body.error)).toContain("no encontrada");
  });

  it("POST /finance/contabilidad/nota-credito-debito NC sobre factura → 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/nota-credito-debito",
      headers: auth(),
      payload: {
        facturaOriginalId: FACTURA_ID,
        tipo: "CREDITO",
        motivo: `NC S111 ${TS}`,
      },
    });
    expect(res.statusCode, `POST → ${res.statusCode}: ${res.body}`).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.notaAsientoId, JSON.stringify(body)).toBeTruthy();
    expect(body.monto).toBe("500000.00");
    capturar(body.notaAsientoId);
  });
});
