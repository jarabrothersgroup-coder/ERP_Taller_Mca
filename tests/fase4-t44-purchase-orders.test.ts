/**
 * Fase 4 · T-44 (INV-03) — CRUD manual de Órdenes de Compra.
 *
 * Antes de T-44 las OC sólo se generaban automáticamente desde alertas de
 * reorden (`auto-po.service`): no había forma de crear una OC a mano, editarla,
 * recepcionarla ni cancelarla. Este archivo prueba el flujo completo contra la
 * app real y la BD migrada:
 *
 *   CREAR    → BORRADOR con items, total calculado y número correlativo
 *   LEER     → listado con filtros (estado / proveedor / búsqueda) y detalle
 *   EDITAR   → proveedor, fechas, notas, estado y reemplazo de items
 *   RECIBIR  → ingreso de stock con re-cálculo de PPP + movimiento vinculado
 *              a la OC + asiento contable; transición a RECIBIDA_PARCIAL y
 *              luego RECIBIDA
 *   CANCELAR → estado CANCELADA (histórico preservado)
 *   BORRAR   → sólo en BORRADOR y sin recepciones
 *
 * Guards de rol (matriz rol×endpoint) y aislamiento cross-tenant.
 *
 * Fixtures propios bajo el tenant "e2e-fase4-t44" (idempotentes, limpios en
 * afterAll) para no depender de scripts/seed-test.sql.
 *
 * @module tests/fase4-t44-purchase-orders
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-fase4-t44";
const OTRO_TENANT = "e2e-fase4-t44-otro";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f044";
const OTRO_TENANT_ID = "00000000-0000-0000-0000-0000e2e4f04b";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f044";
const MECH_ID = "00000000-0000-0000-0000-0000e2e4f045";
const OTRO_ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f04c";
const ADMIN_EMAIL = "admin@e2e-fase4-t44.test";
const MECH_EMAIL = "mecanico@e2e-fase4-t44.test";
const OTRO_ADMIN_EMAIL = "admin@e2e-fase4-t44-otro.test";
const TS = Date.now().toString(36);

let app: FastifyInstance;
let adminBearer: string;
let mechBearer: string;
let otroBearer: string;

// Ids de repuestos creados en beforeAll
let repuestoA: string;
let repuestoB: string;
let repuestoOtroTenant: string;

// ─── Helpers ──────────────────────────────────────────────

function auth(slug: string = TENANT, who: "admin" | "mech" = "admin"): Record<string, string> {
  const bearer =
    slug !== TENANT ? otroBearer : who === "admin" ? adminBearer : mechBearer;
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": slug };
}

/** SQL crudo (postgres.js) para fixtures y verificaciones. */
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

async function crearRepuesto(codigo: string, slug = TENANT): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/inventory/repuestos",
    headers: auth(slug),
    payload: {
      codigo: `${codigo}-${TS}`,
      descripcion: `Repuesto T44 ${codigo}`,
      stockActual: 0,
      stockMinimo: 0,
      precioCosto: 10000,
      precioVenta: 15000,
    },
  });
  expect([200, 201], `POST repuestos → ${res.statusCode}: ${res.body}`).toContain(
    res.statusCode,
  );
  return res.json().id;
}

function nuevoOCPayload(overrides: Record<string, unknown> = {}) {
  return {
    proveedor: "Autopartes del Este",
    notas: `OC de prueba ${TS}`,
    items: [{ repuestoId: repuestoA, cantidad: 10, costoUnitario: 25000 }],
    ...overrides,
  };
}

async function crearOC(
  payload: Record<string, unknown> = {},
  headers = auth(),
): Promise<{ status: number; body: any }> {
  const res = await app.inject({
    method: "POST",
    url: "/inventory/purchase-orders",
    headers,
    payload: nuevoOCPayload(payload),
  });
  return { status: res.statusCode, body: res.json() };
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Fase 4 T44', ${TENANT}, 'tenant_e2e_f4_t44', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${OTRO_TENANT_ID}, 'E2E Fase 4 T44 B', ${OTRO_TENANT}, 'tenant_e2e_f4_t44_b', true)
    ON CONFLICT (slug) DO NOTHING`;
  for (const [id, email, name, role, tenantId] of [
    [ADMIN_ID, ADMIN_EMAIL, "Admin T44", "admin", TENANT_ID],
    [MECH_ID, MECH_EMAIL, "Mecánico T44", "mechanic", TENANT_ID],
    [OTRO_ADMIN_ID, OTRO_ADMIN_EMAIL, "Admin T44 B", "admin", OTRO_TENANT_ID],
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

  repuestoA = await crearRepuesto("T44-A");
  repuestoB = await crearRepuesto("T44-B");
  repuestoOtroTenant = await crearRepuesto("T44-X", OTRO_TENANT);
});

afterAll(async () => {
  const limpiar = [
    `DELETE FROM audit_log WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM stock_movements WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM purchase_order_items WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM purchase_orders WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM repuestos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM repuestos WHERE tenant_slug = '${OTRO_TENANT}'`,
    `DELETE FROM profiles WHERE tenant_id = '${TENANT_ID}'`,
    `DELETE FROM profiles WHERE tenant_id = '${OTRO_TENANT_ID}'`,
    `DELETE FROM tenants WHERE id = '${TENANT_ID}'`,
    `DELETE FROM tenants WHERE id = '${OTRO_TENANT_ID}'`,
  ];
  const sql = getDb() as unknown as {
    (s: TemplateStringsArray, ...v: unknown[]): Promise<unknown>;
    unsafe: (stmt: string) => Promise<unknown>;
  };
  for (const stmt of limpiar) {
    try {
      await sql.unsafe(stmt);
    } catch (err) {
      console.error("[fase4-t44] cleanup falló:", stmt, err);
    }
  }
  if (app) await app.close();
});

// ─── CREATE ───────────────────────────────────────────────

describe("T-44 · crear OC manual", () => {
  it("crea en BORRADOR con items, total calculado y número correlativo", async () => {
    const { status, body } = await crearOC();
    expect(status, `POST OC → ${status}: ${JSON.stringify(body)}`).toBe(201);

    expect(body.estado).toBe("BORRADOR");
    expect(body.proveedor).toBe("Autopartes del Este");
    expect(body.totalOc).toBe(250000); // 10 × 25.000
    expect(body.numero).toMatch(/^OC-\d{4}-\d{4}$/);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].cantidad).toBe(10);
    expect(body.items[0].cantidadRecibida).toBe(0);
    // El item trae los datos del repuesto (join de lectura)
    expect(body.items[0].codigo).toContain("T44-A");
  });

  it("los números de OC son correlativos dentro del tenant", async () => {
    const a = await crearOC();
    const b = await crearOC();
    const nA = Number(a.body.numero.split("-")[2]);
    const nB = Number(b.body.numero.split("-")[2]);
    expect(nB).toBe(nA + 1);
  });

  it("sin items → 422", async () => {
    const { status } = await crearOC({ items: [] });
    expect(status).toBe(422);
  });

  it("cantidad 0 → 422 (validación de items)", async () => {
    const { status } = await crearOC({
      items: [{ repuestoId: repuestoA, cantidad: 0, costoUnitario: 1000 }],
    });
    expect(status).toBe(422);
  });

  it("repuesto de otro tenant → 404 (no valida contra el catálogo ajeno)", async () => {
    const { status, body } = await crearOC({
      items: [{ repuestoId: repuestoOtroTenant, cantidad: 1, costoUnitario: 1000 }],
    });
    expect(status).toBe(404);
    expect(JSON.stringify(body)).toContain("no encontrado");
  });

  it("exige manager+ (mecánico → 403)", async () => {
    const { status } = await crearOC({}, auth(TENANT, "mech"));
    expect(status).toBe(403);
  });
});

// ─── READ ─────────────────────────────────────────────────

describe("T-44 · lectura de OC", () => {
  it("GET por id devuelve la OC con sus items", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "GET",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.id).toBe(oc.id);
    expect(body.items).toHaveLength(1);
  });

  it("GET es tenant-scoped (otro tenant → 404, no filtra existencia)", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "GET",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(OTRO_TENANT),
    });
    expect(res.statusCode).toBe(404);
  });

  it("el listado filtra por estado, proveedor y búsqueda", async () => {
    const { body: oc } = await crearOC({ proveedor: "Filtro Unico SA" });

    const porEstado = await app.inject({
      method: "GET",
      url: "/inventory/purchase-orders?estado=BORRADOR",
      headers: auth(),
    });
    expect(porEstado.statusCode).toBe(200);
    expect(porEstado.json().items.length).toBeGreaterThan(0);
    expect(porEstado.json().items.every((o: any) => o.estado === "BORRADOR")).toBe(true);

    const porProveedor = await app.inject({
      method: "GET",
      url: "/inventory/purchase-orders?proveedor=Filtro Unico SA",
      headers: auth(),
    });
    expect(porProveedor.json().items.map((o: any) => o.id)).toContain(oc.id);

    const porNumero = await app.inject({
      method: "GET",
      url: `/inventory/purchase-orders?search=${encodeURIComponent(oc.numero)}`,
      headers: auth(),
    });
    expect(porNumero.json().items.map((o: any) => o.id)).toContain(oc.id);

    // Un estado que no existe en el tenant no devuelve filas
    const inexistente = await app.inject({
      method: "GET",
      url: "/inventory/purchase-orders?estado=CANCELADA&search=zzz-no-existe-zzz",
      headers: auth(),
    });
    expect(inexistente.json().items).toHaveLength(0);
  });

  it("el listado sólo muestra OC del tenant propio", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "GET",
      url: "/inventory/purchase-orders",
      headers: auth(OTRO_TENANT),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((o: any) => o.id)).not.toContain(oc.id);
  });
});

// ─── UPDATE ───────────────────────────────────────────────

describe("T-44 · editar OC", () => {
  it("actualiza proveedor, notas y recalcula el total al cambiar items", async () => {
    const { body: oc } = await crearOC();

    const res = await app.inject({
      method: "PATCH",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(),
      payload: {
        proveedor: "Proveedor Editado SA",
        notas: "Editada",
        items: [
          { repuestoId: repuestoA, cantidad: 4, costoUnitario: 10000 },
          { repuestoId: repuestoB, cantidad: 2, costoUnitario: 5000 },
        ],
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.proveedor).toBe("Proveedor Editado SA");
    expect(body.totalOc).toBe(50000); // 4×10.000 + 2×5.000
    expect(body.items).toHaveLength(2);
  });

  it("cambia de estado dentro del ciclo de vida", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "PATCH",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(),
      payload: { estado: "APROBADA" },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().estado).toBe("APROBADA");
  });

  it("no permite saltar a RECIBIDA* por PATCH (exclusivo del flujo de recepción)", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "PATCH",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(),
      payload: { estado: "RECIBIDA" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.body).toContain("receive");
  });

  it("rechaza un estado fuera del ciclo de vida → 422", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "PATCH",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(),
      payload: { estado: "INVENTADA" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("PATCH es tenant-scoped (otro tenant → 404)", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "PATCH",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(OTRO_TENANT),
      payload: { notas: "intento ajeno" },
    });
    expect(res.statusCode).toBe(404);

    // La OC quedó intacta
    const own = await app.inject({
      method: "GET",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(),
    });
    expect(own.json().notas).not.toBe("intento ajeno");
  });

  it("exige manager+ (mecánico → 403)", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "PATCH",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(TENANT, "mech"),
      payload: { notas: "no permitido" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ─── RECEIVE (recepción → stock + asiento) ────────────────

describe("T-44 · recepción: stock + asiento", () => {
  it("recepción total deja la OC en RECIBIDA, sube el stock y crea el movimiento", async () => {
    const { body: oc } = await crearOC();
    const itemId = oc.items[0].id;

    const res = await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/receive`,
      headers: auth(),
      payload: { items: [{ itemId, cantidadRecibida: 10 }] },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();

    expect(body.estado).toBe("RECIBIDA");
    expect(body.oc.estado).toBe("RECIBIDA");
    expect(body.oc.fechaRecepcion).not.toBeNull();
    expect(body.recibido).toHaveLength(1);
    expect(body.recibido[0].cantidad).toBe(10);
    expect(body.recibido[0].movimientoId).toBeTruthy();

    // Stock efectivamente subido en el catálogo
    const rep = await q<{ stock_actual: number; costo_promedio: string }>`
      SELECT stock_actual, costo_promedio FROM repuestos WHERE id = ${repuestoA}`;
    expect(rep[0].stock_actual).toBe(10);

    // Movimiento persistido y VINCULADO a la OC
    // (`min()` no existe para uuid en Postgres, así que se agrupa y se exige
    //  que TODOS los movimientos del repuesto pertenezcan a esta OC).
    const movs = await q<{ n: number; purchase_order_id: string; tipo: string }>`
      SELECT count(*)::int AS n, purchase_order_id, tipo
      FROM stock_movements WHERE repuesto_id = ${repuestoA}
      GROUP BY purchase_order_id, tipo`;
    expect(movs.length).toBeGreaterThan(0);
    for (const m of movs) {
      expect(m.purchase_order_id).toBe(oc.id);
      expect(m.tipo).toBe("ENTRADA");
    }

    // El item acumula lo recibido
    expect(body.oc.items[0].cantidadRecibida).toBe(10);
  });

  it("recepción parcial deja la OC en RECIBIDA_PARCIAL y admite la restante", async () => {
    const { body: oc } = await crearOC();
    const itemId = oc.items[0].id;

    const primera = await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/receive`,
      headers: auth(),
      payload: { items: [{ itemId, cantidadRecibida: 4 }] },
    });
    expect(primera.statusCode, primera.body).toBe(200);
    expect(primera.json().estado).toBe("RECIBIDA_PARCIAL");

    const segunda = await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/receive`,
      headers: auth(),
      payload: { items: [{ itemId, cantidadRecibida: 6 }] },
    });
    expect(segunda.statusCode, segunda.body).toBe(200);
    expect(segunda.json().estado).toBe("RECIBIDA");
    expect(segunda.json().oc.items[0].cantidadRecibida).toBe(10);
  });

  it("no se puede recibir más de lo pedido → 422 y el stock no se mueve", async () => {
    const { body: oc } = await crearOC();
    const itemId = oc.items[0].id;

    const antes = await q<{ stock_actual: number }>`
      SELECT stock_actual FROM repuestos WHERE id = ${repuestoA}`;

    const res = await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/receive`,
      headers: auth(),
      payload: { items: [{ itemId, cantidadRecibida: 11 }] },
    });
    expect(res.statusCode).toBe(422);

    const despues = await q<{ stock_actual: number }>`
      SELECT stock_actual FROM repuestos WHERE id = ${repuestoA}`;
    expect(despues[0].stock_actual).toBe(antes[0].stock_actual);
  });

  it("una recepción fallida revierte el stock de los items ya procesados (todo-o-nada)", async () => {
    // 2 items: el primero se procesa bien, el segundo viola el stock máximo.
    const rMax = await app.inject({
      method: "POST",
      url: "/inventory/repuestos",
      headers: auth(),
      payload: {
        codigo: `T44-MAX-${TS}`,
        descripcion: "Repuesto con tope de stock",
        stockActual: 0,
        stockMaximo: 2,
        precioCosto: 1000,
      },
    });
    const repConTope = idDeRepuesto(rMax);

    const { body: oc } = await crearOC({
      items: [
        { repuestoId: repuestoB, cantidad: 3, costoUnitario: 1000 },
        { repuestoId: repConTope, cantidad: 5, costoUnitario: 1000 },
      ],
    });
    const [itemOk, itemTope] = oc.items;

    const stockBAntes = await q<{ stock_actual: number }>`
      SELECT stock_actual FROM repuestos WHERE id = ${repuestoB}`;

    const res = await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/receive`,
      headers: auth(),
      payload: {
        items: [
          { itemId: itemOk.id, cantidadRecibida: 3 },
          { itemId: itemTope.id, cantidadRecibida: 5 },
        ],
      },
    });
    expect(res.statusCode).toBe(422);

    // El primer item NO quedó descontado: la transacción entera revirtió
    const stockBDespues = await q<{ stock_actual: number }>`
      SELECT stock_actual FROM repuestos WHERE id = ${repuestoB}`;
    expect(stockBDespues[0].stock_actual).toBe(stockBAntes[0].stock_actual);

    // Y la OC sigue sin recepciones registradas
    const detalle = await app.inject({
      method: "GET",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(),
    });
    expect(detalle.json().estado).toBe("BORRADOR");
    expect(detalle.json().items.every((i: any) => i.cantidadRecibida === 0)).toBe(true);
  });

  it("recibir una OC ya recepcionada completa → 409", async () => {
    const { body: oc } = await crearOC();
    const itemId = oc.items[0].id;
    const payload = { items: [{ itemId, cantidadRecibida: 10 }] };

    const primera = await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/receive`,
      headers: auth(),
      payload,
    });
    expect(primera.statusCode).toBe(200);

    const segunda = await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/receive`,
      headers: auth(),
      payload,
    });
    expect(segunda.statusCode).toBe(409);
  });

  it("un item de otra OC → 404 y no se toca el stock", async () => {
    const { body: oc1 } = await crearOC();
    const { body: oc2 } = await crearOC();
    const stockAntes = await q<{ stock_actual: number }>`
      SELECT stock_actual FROM repuestos WHERE id = ${repuestoB}`;

    const res = await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc1.id}/receive`,
      headers: auth(),
      payload: { items: [{ itemId: oc2.items[0].id, cantidadRecibida: 1 }] },
    });
    expect(res.statusCode).toBe(404);

    const stockDespues = await q<{ stock_actual: number }>`
      SELECT stock_actual FROM repuestos WHERE id = ${repuestoB}`;
    expect(stockDespues[0].stock_actual).toBe(stockAntes[0].stock_actual);
  });

  it("reciprocación es tenant-scoped (otro tenant → 404)", async () => {
    const { body: oc } = await crearOC();
    const stockAntes = await q<{ stock_actual: number }>`
      SELECT stock_actual FROM repuestos WHERE id = ${repuestoA}`;

    const res = await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/receive`,
      headers: auth(OTRO_TENANT),
      payload: { items: [{ itemId: oc.items[0].id, cantidadRecibida: 10 }] },
    });
    expect(res.statusCode).toBe(404);

    const stockDespues = await q<{ stock_actual: number }>`
      SELECT stock_actual FROM repuestos WHERE id = ${repuestoA}`;
    expect(stockDespues[0].stock_actual).toBe(stockAntes[0].stock_actual);
  });

  it("exige manager+ (mecánico → 403)", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/receive`,
      headers: auth(TENANT, "mech"),
      payload: { items: [{ itemId: oc.items[0].id, cantidadRecibida: 1 }] },
    });
    expect(res.statusCode).toBe(403);
  });

  it("el movimiento expone el asiento contable cuando el plan de cuentas lo permite", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/receive`,
      headers: auth(),
      payload: { items: [{ itemId: oc.items[0].id, cantidadRecibida: 10 }] },
    });
    expect(res.statusCode, res.body).toBe(200);
    const recibido = res.json().recibido[0];

    // `asientoId` es null cuando el tenant no tiene plan de cuentas configurado
    // (degradación conocida), pero el movimiento queda registrado con el importe.
    if (recibido.asientoId === null) {
      const mov = await q<{ n: number }>`
        SELECT count(*)::int AS n FROM stock_movements
        WHERE purchase_order_id = ${oc.id} AND costo_unitario IS NOT NULL`;
      expect(mov[0].n).toBeGreaterThan(0);
    } else {
      const asiento = await q<{ n: number }>`
        SELECT count(*)::int AS n FROM asientos WHERE id = ${recibido.asientoId}`;
      expect(asiento[0].n).toBe(1);
    }
  });
});

// ─── CANCEL / DELETE ──────────────────────────────────────

describe("T-44 · cancelar y borrar", () => {
  it("cancelar marca CANCELADA preservando el histórico", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/cancel`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().estado).toBe("CANCELADA");
    expect(res.json().items).toHaveLength(1); // histórico preservado

    const filas = await q<{ n: number }>`
      SELECT count(*)::int AS n FROM purchase_orders WHERE id = ${oc.id}`;
    expect(filas[0].n).toBe(1);
  });

  it("una OC cancelada no admite edición (409)", async () => {
    const { body: oc } = await crearOC();
    await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/cancel`,
      headers: auth(),
    });
    const res = await app.inject({
      method: "PATCH",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(),
      payload: { notas: "no editable" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("no se puede cancelar una OC ya recepcionada (409)", async () => {
    const { body: oc } = await crearOC();
    await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/receive`,
      headers: auth(),
      payload: { items: [{ itemId: oc.items[0].id, cantidadRecibida: 10 }] },
    });
    const res = await app.inject({
      method: "POST",
      url: `/inventory/purchase-orders/${oc.id}/cancel`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(409);
  });

  it("DELETE borra una OC en BORRADOR y sus items (cascade)", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "DELETE",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(204);

    const po = await q<{ n: number }>`
      SELECT count(*)::int AS n FROM purchase_orders WHERE id = ${oc.id}`;
    expect(po[0].n).toBe(0);

    const items = await q<{ n: number }>`
      SELECT count(*)::int AS n FROM purchase_order_items WHERE orden_compra_id = ${oc.id}`;
    expect(items[0].n).toBe(0);
  });

  it("DELETE en una OC no BORRADOR → 409 (usar cancel)", async () => {
    const { body: oc } = await crearOC({ estado: "APROBADA" });
    const res = await app.inject({
      method: "DELETE",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(409);
    expect(res.body).toContain("BORRADOR");
  });

  it("DELETE exige manager+ (mecánico → 403)", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "DELETE",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(TENANT, "mech"),
    });
    expect(res.statusCode).toBe(403);
  });

  it("DELETE es tenant-scoped (otro tenant → 404, no borra filas ajenas)", async () => {
    const { body: oc } = await crearOC();
    const res = await app.inject({
      method: "DELETE",
      url: `/inventory/purchase-orders/${oc.id}`,
      headers: auth(OTRO_TENANT),
    });
    expect(res.statusCode).toBe(404);

    const po = await q<{ n: number }>`
      SELECT count(*)::int AS n FROM purchase_orders WHERE id = ${oc.id}`;
    expect(po[0].n).toBe(1);
  });
});

/** Extrae el id de una respuesta de creación de repuesto. */
function idDeRepuesto(res: { statusCode: number; json(): any }): string {
  expect([200, 201], `POST repuestos → ${res.statusCode}`).toContain(res.statusCode);
  return res.json().id;
}
