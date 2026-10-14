/**
 * Sprint 119 — Reportes GET de contabilidad (balde de cierre, T-47).
 *
 * Saca del balde "Conectar a UI / siguen en la cola" las lecturas
 * especializadas de contabilidad que estaban SIN test y documentadas como
 * pendientes (Docs/T47: cuadratura, rentabilidad/*, libro-*-iva, mappings,
 * audit-log, libro-diario/mayor/inventario). Todas son GETs locales y
 * deterministas (período vacío → reporte en ceros; IDs inexistentes o año/mes
 * fuera de rango → 422 de ValidationError), sin dependencia externa:
 *
 *   - GET /finance/contabilidad/cuadratura/:anho/:mes
 *   - GET /finance/contabilidad/rentabilidad/ot|cliente|mecanico|dashboard
 *   - GET /finance/contabilidad/libro-diario|libro-mayor|libro-inventario
 *   - GET /finance/contabilidad/libro-compras-iva|libro-ventas-iva
 *   - GET /finance/contabilidad/mappings
 *   - GET /finance/contabilidad/audit-log y audit-log/:entidad/:entidadId
 *
 * Patrón fase7 (tenant propio "e2e-s119rpt", fixtures SQL idempotentes,
 * app.inject con template literals para el scanner de T-63).
 *
 * @module tests/fase7-s119-reportes-contabilidad
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s119rpt";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f129";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4e129";
const ADMIN_EMAIL = "admin@e2e-s119rpt.test";
const CLIENTE = "00000000-0000-0000-0000-0000c11e4f50";
const CLIENTE_EMAIL = "cliente@e2e-s119rpt.test";
const CLIENTE_PHONE = "+595981223456";
const VEHICULO = "00000000-0000-0000-0000-0000c11e4f51";
const OT_ID = "00000000-0000-0000-0000-0000c11e4f52";
/** Entidad usada en la fila sembrada de audit_log. */
const AUDIT_ENTIDAD = "00000000-0000-0000-0000-0000a11e4f60";
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

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Sprint 119 Reportes', ${TENANT}, 'tenant_e2e_s119rpt', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 119 Rpt', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;
  await sql`INSERT INTO clients (id, name, email, phone, tenant_slug)
    VALUES (${CLIENTE}, ${`Cliente T119R-${TS}`}, ${CLIENTE_EMAIL}, ${CLIENTE_PHONE}, ${TENANT})
    ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO vehiculos (id, client_id, brand, model, plate, engine_type, tenant_slug)
    VALUES (${VEHICULO}, ${CLIENTE}, ${"Toyota"}, ${"Corolla"}, ${"ABC119R"}, ${"Nafta"}, ${TENANT})
    ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO ordenes_trabajo (id, vehicle_id, client_id, status, tenant_slug, created_at)
    VALUES (${OT_ID}, ${VEHICULO}, ${CLIENTE}, ${"En_Proceso"}, ${TENANT}, ${"2030-12-15T10:00:00-03:00"})
    ON CONFLICT (id) DO NOTHING`;
  // Factura manual en el período → rentabilidad/dashboard/libro-ventas con datos.
  await sql`
    INSERT INTO facturas (id, tenant_slug, tipo, numero_factura_manual, total, sifen_status, estado_pago, orden_id, created_at)
    VALUES (${"00000000-0000-0000-0000-0000f1e4f129"}, ${TENANT}, ${"MANUAL"}, ${"001-001-0000001"}, ${"550000.00"}, ${"MANUAL_CONVERT_QUEUE"}, ${"PENDIENTE"}, ${OT_ID}, ${"2030-12-18T12:00:00-03:00"})
    ON CONFLICT (id) DO NOTHING`;
  // Factura de proveedor en el período → libro-compras-iva con datos.
  await sql`
    INSERT INTO facturas_proveedor (id, proveedor_id, nro_factura, tipo_doc, total, saldo_pendiente, iva_monto, base_imponible, fecha_emision, fecha_vencimiento, estado_pago, concepto, tenant_slug)
    VALUES (${"00000000-0000-0000-0000-0000f1e4f130"}, ${CLIENTE}, ${"FAC-119R-0001"}, ${"FACTURA"}, ${"330000.00"}, ${"330000.00"}, ${"30000.00"}, ${"300000.00"}, ${"2030-12-10T09:00:00-03:00"}, ${"2031-01-10T09:00:00-03:00"}, ${"PENDIENTE"}, ${"Repuestos fila F119R"}, ${TENANT})
    ON CONFLICT (id) DO NOTHING`;
  // Fila de auditoría sembrada para el trail por entidad (append-only).
  await sql`INSERT INTO audit_log (tenant_slug, usuario_id, ip, accion, entidad, entidad_id, descripcion)
    VALUES (${TENANT}, ${ADMIN_EMAIL}, ${"127.0.0.1"}, ${"CREATE"}, ${"plan_cuentas"}, ${AUDIT_ENTIDAD}, ${"seed sprint 119 reportes"})
    ON CONFLICT DO NOTHING`;

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
  await q`DELETE FROM facturas WHERE tenant_slug = ${TENANT}`;
  await q`DELETE FROM facturas_proveedor WHERE tenant_slug = ${TENANT}`;
  await q`DELETE FROM audit_log WHERE tenant_slug = ${TENANT}`;
  await q`DELETE FROM ordenes_trabajo WHERE id = ${OT_ID}`;
  await q`DELETE FROM vehiculos WHERE id = ${VEHICULO}`;
  await q`DELETE FROM clients WHERE id = ${CLIENTE}`;
  await q`DELETE FROM profiles WHERE id = ${ADMIN_ID}`;
  await q`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
  await app?.close();
});

// ─── Cuadratura ───────────────────────────────────────────

describe("Sprint 119 · Reportes GET contabilidad", () => {
  it("GET /finance/contabilidad/cuadratura/:anho/:mes → 200 (período vacío en ceros)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/cuadratura/${2030}/${12}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.periodo).toMatchObject({ anho: 2030, mes: 12 });
    expect(typeof body.balanceado).toBe("boolean");
    expect(body.detalles).toEqual([]);
  });

  it("GET /finance/contabilidad/cuadratura/:anho/:mes con año inválido → 422", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/cuadratura/${2019}/${12}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(422);
  });

  // ─── Rentabilidad ────────────────────────────────

  it("GET /finance/contabilidad/rentabilidad/ot/:id → 200 con la OT sembrada", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/rentabilidad/ot/${OT_ID}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.ordenId).toBe(OT_ID);
    expect(body.clientId).toBe(CLIENTE);
    expect(typeof body.margenBruto).toBe("number");
  });

  it("GET /finance/contabilidad/rentabilidad/ot/:id con OT inexistente → 422", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/rentabilidad/ot/${"00000000-0000-0000-0000-000000000001"}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(422);
  });

  it("GET /finance/contabilidad/rentabilidad/cliente/:id → 200 (clientId y totalOTs)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/rentabilidad/cliente/${CLIENTE}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.clientId).toBe(CLIENTE);
    expect(body.totalOTs).toBeGreaterThanOrEqual(1);
    expect(typeof body.margenPorcentaje).toBe("number");
  });

  it("GET /finance/contabilidad/rentabilidad/cliente/:id inexistente → 422", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/rentabilidad/cliente/${"00000000-0000-0000-0000-000000000002"}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(422);
  });

  it("GET /finance/contabilidad/rentabilidad/mecanico/:id inexistente → 422", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/rentabilidad/mecanico/${"00000000-0000-0000-0000-000000000003"}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(422);
  });

  it("GET /finance/contabilidad/rentabilidad/dashboard/:anho/:mes → 200 con resumen y la OT del período", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/rentabilidad/dashboard/${2030}/${12}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.resumen).toBeDefined();
    expect(body.resumen.totalOTs).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.topOTs)).toBe(true);
  });

  it("GET /finance/contabilidad/rentabilidad/dashboard/:anho/:mes con mes inválido → 422", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/rentabilidad/dashboard/${2030}/${13}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(422);
  });

  // ─── Libros contables (diario / mayor / inventario) ────

  it("GET /finance/contabilidad/libro-diario/:anho/:mes → 200 con totalEntradas", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/libro-diario/${2030}/${12}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.formato).toBe("JSON");
    expect(typeof body.totalDebe).toBe("string");
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it("GET /finance/contabilidad/libro-diario/:anho/:mes?formato=TXT → 200 con contenido", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/libro-diario/${2030}/${12}`,
      headers: auth(),
      query: { formato: "TXT" },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.formato).toBe("TXT");
    expect(typeof body.contenido).toBe("string");
  });

  it("GET /finance/contabilidad/libro-mayor/:anho/:mes → 200 con cuentas", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/libro-mayor/${2030}/${12}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(Array.isArray(res.json().cuentas)).toBe(true);
  });

  it("GET /finance/contabilidad/libro-inventario/:anho/:mes → 200 con secciones", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/libro-inventario/${2030}/${12}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.inventario).toBeDefined();
    expect(body.cuentasPorCobrar).toBeDefined();
    expect(body.cuentasPorPagar).toBeDefined();
    expect(body.bienesDeUso).toBeDefined();
  });

  // ─── Libros de IVA ───────────────────────────────

  it("GET /finance/contabilidad/libro-compras-iva/:anho/:mes → 200 con datos del período", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/libro-compras-iva/${2030}/${12}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.formato).toBe("JSON");
    expect(body.totalCompras).toBe("330000.00");
    expect(body.entries.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /finance/contabilidad/libro-compras-iva/:anho/:mes?formato=CSV → 200 con contenido", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/libro-compras-iva/${2030}/${12}`,
      headers: auth(),
      query: { formato: "CSV" },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.formato).toBe("CSV");
    expect(typeof body.contenido).toBe("string");
    expect(body.contenido).toContain("FAC-119R-0001");
  });

  it("GET /finance/contabilidad/libro-ventas-iva/:anho/:mes → 200 con datos del período", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/libro-ventas-iva/${2030}/${12}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.formato).toBe("JSON");
    expect(body.totalVentas).toBe("550000.00");
    expect(body.entries.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /finance/contabilidad/libro-ventas-iva/:anho/:mes?formato=CSV → 200 con contenido", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/libro-ventas-iva/${2030}/${12}`,
      headers: auth(),
      query: { formato: "CSV" },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.formato).toBe("CSV");
    expect(typeof body.contenido).toBe("string");
    expect(body.contenido).toContain("001-001-0000001");
  });

  it("GET /finance/contabilidad/libro-compras-iva/:anho/:mes período vacío → 200 en ceros", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/libro-compras-iva/${2020}/${1}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.formato).toBe("JSON");
    expect(body.totalCompras).toBe("0.00");
    expect(body.entries).toEqual([]);
  });

  it("GET /finance/contabilidad/libro-ventas-iva/:anho/:mes período vacío → 200 en ceros", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/libro-ventas-iva/${2020}/${1}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.formato).toBe("JSON");
    expect(body.totalVentas).toBe("0.00");
    expect(body.entries).toEqual([]);
  });

  // ─── Mappings ────────────────────────────────────

  it("GET /finance/contabilidad/mappings → 200 (array)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/contabilidad/mappings",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("GET /finance/contabilidad/mappings?modulo=WORKSHOP → 200 filtrado", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/contabilidad/mappings",
      headers: auth(),
      query: { modulo: "WORKSHOP" },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  // ─── Audit log ───────────────────────────────────

  it("GET /finance/contabilidad/audit-log → 200 con total y entries", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/contabilidad/audit-log",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(typeof body.total).toBe("number");
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it("GET /finance/contabilidad/audit-log/:entidad/:entidadId → 200 y encuentra la fila sembrada", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/audit-log/${"plan_cuentas"}/${AUDIT_ENTIDAD}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.entries[0]).toMatchObject({ entidad: "plan_cuentas" });
  });
});