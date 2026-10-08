/**
 * Fase 6 · T-61 — Carga inicial de inventario + auto-PO (Sprint 107).
 *
 * Cierra 2 pares de comportamiento sin test en el scanner de rutas:
 *   POST /inventory/initial-load
 *   POST /inventory/auto-po/generate
 *
 * initial-load: valida el 422 (sin items), el 404 (repuestoId inexistente) y
 * el 201 completo — batchId, asiento contable balanceado, alta del repuesto
 * con PPP inicial y movimiento CARGA_INICIAL.
 *
 * auto-po: genera una OC real desde una reorder_alert PENDIENTE (estado
 * PENDIENTE en purchase_orders, alerta → EN_OC) y es idempotente al
 * re-ejecutarse (la alerta ya no está PENDIENTE).
 *
 * Fixtures propias bajo el tenant "e2e-t107-inv", limpias en afterAll.
 *
 * @module tests/fase6-t61-initial-load-auto-po
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-t107-inv";
const TENANT_ID = "00000000-0000-0000-0000-00000107e001";
const ADMIN_ID = "00000000-0000-0000-0000-00000107e002";
const ADMIN_EMAIL = "admin@e2e-t107-inv.test";
const REPUESTO_ID_FANTASMA = "00000000-0000-0000-0000-000000000099";
const TS = Date.now().toString(36);

const COSTO_PROMEDIO = 50000;
const LOTE_ECONOMICO = 8;
const TOTAL_ESPERADO = COSTO_PROMEDIO * LOTE_ECONOMICO; // 400000

let app: FastifyInstance;
let bearer: string;
/** batchId de cada carga exitosa — para limpiar el asiento en afterAll */
const batchIds: string[] = [];

// ─── Helpers ──────────────────────────────────────────────

function auth(): Record<string, string> {
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": TENANT };
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

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  await q`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E T107 Inventario', ${TENANT}, 'tenant_e2e_t107_inv', true)
    ON CONFLICT (slug) DO NOTHING`;
  await q`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Inventario T107', 'admin', true)
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
  // Capturar batchIds (incluidos los de corridas previas rotas del mismo tenant)
  try {
    const rows = await q<{ batch_id: string }>`
      SELECT DISTINCT batch_id FROM initial_inventory_loads WHERE tenant_slug = ${TENANT}`;
    for (const r of rows) batchIds.push(r.batch_id);
  } catch {
    /* tabla vacía */
  }

  const stmts = [
    `DELETE FROM audit_log WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM initial_inventory_loads WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM stock_movements WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM purchase_order_items WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM reorder_alerts WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM purchase_orders WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM repuestos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM profiles WHERE tenant_id = '${TENANT_ID}'`,
    `DELETE FROM tenants WHERE id = '${TENANT_ID}'`,
  ];
  const sql = getDb() as unknown as {
    unsafe: (stmt: string) => Promise<unknown>;
  };
  for (const stmt of stmts) {
    try {
      await sql.unsafe(stmt);
    } catch (err) {
      console.error("[fase6-t61-initial-load] cleanup falló:", stmt, err);
    }
  }
  // Los asientos se borran al final: initial_inventory_loads los referencia
  for (const batchId of new Set(batchIds)) {
    try {
      await sql.unsafe(
        `DELETE FROM asientos_contables WHERE documento_ref = '${batchId}'`,
      );
    } catch (err) {
      console.error("[fase6-t61-initial-load] cleanup asiento falló:", batchId, err);
    }
  }
  if (app) await app.close();
});

// ─── POST /inventory/initial-load ─────────────────────────

describe("Fase 6 · T-61 — POST /inventory/initial-load", () => {
  it("sin repuestos ni herramientas → 422 (ValidationError)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/inventory/initial-load",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode, `carga vacía → ${res.statusCode}: ${res.body}`).toBe(422);
    expect(res.json().message).toContain("al menos");
  });

  it("repuestoId inexistente → 404 (NotFoundError)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/inventory/initial-load",
      headers: auth(),
      payload: {
        repuestos: [
          { repuestoId: REPUESTO_ID_FANTASMA, cantidad: 1, valorEstimadoMercado: 1000 },
        ],
      },
    });
    expect(res.statusCode, `repuesto fantasma → ${res.statusCode}: ${res.body}`).toBe(404);
  });

  it("carga válida → 201 con batchId, asiento balanceado, stock y CARGA_INICIAL", async () => {
    const codigo = `IL-T107-${TS}`;
    const res = await app.inject({
      method: "POST",
      url: "/inventory/initial-load",
      headers: auth(),
      payload: {
        repuestos: [
          {
            codigo,
            descripcion: "Repuesto de carga inicial T-61",
            categoria: "Filtros",
            cantidad: 5,
            valorEstimadoMercado: 100000,
          },
        ],
        concepto: `Carga inicial T-61 ${TS}`,
      },
    });
    expect(res.statusCode, `carga inicial → ${res.statusCode}: ${res.body}`).toBe(201);
    const body = res.json();

    expect(body.batchId).toMatch(/^LOAD-\d{8}-[A-Z0-9]{4}$/);
    batchIds.push(body.batchId);
    expect(body.repuestosCargados).toBe(1);
    expect(body.herramientasCargadas).toBe(0);
    expect(body.valorTotalCargado).toBe("500000.00");

    expect(body.asiento).toBeTruthy();
    expect(body.asiento.totalDebe).toBe("500000.00");
    expect(body.asiento.totalHaber).toBe("500000.00");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].tipo).toBe("REPUESTOS");
    expect(body.items[0].valorTotal).toBe("500000.00");

    // Repuesto creado en el tenant correcto con PPP inicial
    const [rep] = await q<{ id: string; stock_actual: number; costo_promedio: string; tenant_slug: string }>`
      SELECT id, stock_actual, costo_promedio, tenant_slug
      FROM repuestos WHERE codigo = ${codigo}`;
    expect(rep, "la carga debió crear el repuesto").toBeTruthy();
    expect(Number(rep!.stock_actual)).toBe(5);
    expect(Number(rep!.costo_promedio)).toBe(100000);
    expect(rep!.tenant_slug).toBe(TENANT);

    // Auditoría del lote
    const auditoria = await q<{ batch_id: string; asiento_id: string }>`
      SELECT batch_id, asiento_id FROM initial_inventory_loads
      WHERE batch_id = ${body.batchId} AND tenant_slug = ${TENANT}`;
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]!.asiento_id).toBe(body.asiento.id);

    // Movimiento de entrada por carga inicial
    const movimientos = await q<{ tipo: string; cantidad: number; motivo: string }>`
      SELECT tipo, cantidad, motivo FROM stock_movements
      WHERE repuesto_id = ${rep!.id} AND motivo = 'CARGA_INICIAL'`;
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]!.tipo).toBe("ENTRADA");
    expect(Number(movimientos[0]!.cantidad)).toBe(5);

    // El asiento existe y está balanceado en la BD
    const [asiento] = await q<{ total_debe: string; total_haber: string; estado: string }>`
      SELECT total_debe, total_haber, estado FROM asientos_contables
      WHERE documento_ref = ${body.batchId}`;
    expect(asiento, "el asiento debe persistirse con documento_ref = batchId").toBeTruthy();
    expect(Number(asiento!.total_debe)).toBe(500000);
    expect(Number(asiento!.total_debe)).toBe(Number(asiento!.total_haber));
  });
});

// ─── POST /inventory/auto-po/generate ─────────────────────

describe("Fase 6 · T-61 — POST /inventory/auto-po/generate", () => {
  it("sin alertas PENDIENTE → 200 con generated: 0", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/inventory/auto-po/generate",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode, `generate sin alertas → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.generated).toBe(0);
    expect(body.orders).toEqual([]);
  });

  it("con alerta PENDIENTE genera OC, marca alerta EN_OC y es idempotente", async () => {
    const codigo = `AP-T107-${TS}`;
    const [rep] = await q<{ id: string }>`
      INSERT INTO repuestos (codigo, descripcion, categoria, stock_actual, stock_minimo, proveedor, costo_promedio, lote_economico, tenant_slug)
      VALUES (${codigo}, 'Repuesto bajo stock T-61', 'Filtros', 2, 10, 'Autopartes T107', ${COSTO_PROMEDIO}, ${LOTE_ECONOMICO}, ${TENANT})
      RETURNING id`;
    expect(rep).toBeTruthy();

    const [alerta] = await q<{ id: string }>`
      INSERT INTO reorder_alerts (repuesto_id, stock_actual, punto_reorden, estado, tenant_slug)
      VALUES (${rep!.id}, 2, 10, 'PENDIENTE', ${TENANT})
      RETURNING id`;
    expect(alerta).toBeTruthy();

    const res = await app.inject({
      method: "POST",
      url: "/inventory/auto-po/generate",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode, `generate → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body.generated).toBe(1);
    expect(body.orders).toHaveLength(1);

    const order = body.orders[0];
    expect(order.created).toBe(true);
    expect(order.poNumero).toMatch(/^OC-\d{4}-\d{4}$/);
    expect(order.items).toBe(1);
    expect(order.totalEstimado).toBe(TOTAL_ESPERADO);

    const [po] = await q<{ id: string; estado: string; proveedor: string; total_oc: string }>`
      SELECT id, estado, proveedor, total_oc FROM purchase_orders WHERE numero = ${order.poNumero}`;
    expect(po, "la OC debe persistirse").toBeTruthy();
    expect(po!.estado).toBe("PENDIENTE");
    expect(po!.proveedor).toBe("Autopartes T107");
    expect(Number(po!.total_oc)).toBe(TOTAL_ESPERADO);

    const [item] = await q<{ cantidad: number; costo_unitario: string }>`
      SELECT cantidad, costo_unitario FROM purchase_order_items WHERE orden_compra_id = ${po!.id}`;
    expect(Number(item!.cantidad)).toBe(LOTE_ECONOMICO);
    expect(Number(item!.costo_unitario)).toBe(COSTO_PROMEDIO);

    const [alertaTras] = await q<{ estado: string; oc_generada_id: string }>`
      SELECT estado, oc_generada_id FROM reorder_alerts WHERE id = ${alerta!.id}`;
    expect(alertaTras!.estado).toBe("EN_OC");
    expect(alertaTras!.oc_generada_id).toBe(po!.id);

    // Idempotente: la alerta ya no está PENDIENTE → nada que generar
    const res2 = await app.inject({
      method: "POST",
      url: "/inventory/auto-po/generate",
      headers: auth(),
      payload: {},
    });
    expect(res2.statusCode, `re-generate → ${res2.statusCode}: ${res2.body}`).toBe(200);
    expect(res2.json().generated).toBe(0);
  });
});
