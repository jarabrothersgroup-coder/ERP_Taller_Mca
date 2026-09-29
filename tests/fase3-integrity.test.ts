/**
 * Fase 3 — Integridad transaccional (T-31..T-34 · auditoría 2026-09-25)
 *
 * Tests de banco reales (app real + BD migrada) que demuestran las garantías
 * de integridad introducidas en esta fase:
 *
 *   T-31  `updateOrdenStatus` es una sola transacción: si el consumo de stock
 *         falla, el estado NO cambia, el historial NO queda escrito y el
 *         stock queda intacto (antes cada pieza se tragaba el error).
 *   T-32  `salidaStock`/`ingresoStock` son atómicos: un fallo a mitad de
 *         camino (p.ej. FK de `orden_trabajo_id` inexistente) no deja el
 *         stock descontado sin su movimiento.
 *   T-33  Auditoría de entidades (clientes / vehículos / stock) con actor
 *         resuelto desde la request (`usuario_id` + `ip`) y valores
 *         antes/después.
 *   T-34  `DELETE /workshop/clientes/:id` rechaza clientes con órdenes de
 *         trabajo (409) y FK `facturas.orden_id` con ON DELETE RESTRICT.
 *
 * Fixtures propias bajo el tenant "e2e-fase3" (idempotentes, limpias en
 * afterAll) para no depender de scripts/seed-test.sql.
 *
 * @module tests/fase3-integrity
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-fase3";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e3f000";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e3f001";
const ADMIN_EMAIL = "admin@e2e-fase3.test";
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
  const id = body?.id ?? body?.data?.id ?? body?.cliente?.id ?? body?.orden?.id;
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
  expect([200, 201], `POST clientes → ${res.statusCode}: ${res.body}`).toContain(
    res.statusCode,
  );
  return pickId(res.json(), "cliente");
}

async function crearVehiculo(clientId: string, plate: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/workshop/vehiculos",
    headers: auth(),
    payload: { brand: "Toyota", model: "Corolla", clientId, licensePlate: plate },
  });
  expect([200, 201], `POST vehiculos → ${res.statusCode}: ${res.body}`).toContain(
    res.statusCode,
  );
  return pickId(res.json(), "vehiculo");
}

async function crearOrden(clientId: string, vehicleId: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/workshop/ordenes",
    headers: auth(),
    payload: {
      vehicleId,
      clientId,
      description: `Integridad Fase 3 ${TS}`,
    },
  });
  expect([200, 201], `POST ordenes → ${res.statusCode}: ${res.body}`).toContain(
    res.statusCode,
  );
  return pickId(res.json(), "orden");
}

async function crearRepuesto(codigo: string, stock: number): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/inventory/repuestos",
    headers: auth(),
    payload: {
      codigo,
      descripcion: `Repuesto Fase 3 ${codigo}`,
      precioCosto: 100,
      precioVenta: 150,
      stockActual: stock,
    },
  });
  expect([200, 201], `POST repuestos → ${res.statusCode}: ${res.body}`).toContain(
    res.statusCode,
  );
  return pickId(res.json(), "repuesto");
}

/** Cambia el estado de una OT. Devuelve la respuesta cruda (sin asserts). */
function cambiarEstado(ordenId: string, status: string) {
  return app.inject({
    method: "PATCH",
    url: `/workshop/ordenes/${ordenId}/status`,
    headers: auth(),
    payload: { status },
  });
}

async function estadoDe(ordenId: string): Promise<string> {
  const rows = await q<{ status: string }>`
    SELECT status FROM ordenes_trabajo WHERE id = ${ordenId}`;
  expect(rows[0]?.status, `OT ${ordenId} no encontrada`).toBeTruthy();
  return rows[0].status;
}

async function stockDe(repuestoId: string): Promise<number> {
  const rows = await q<{ stock_actual: number }>`
    SELECT stock_actual FROM repuestos WHERE id = ${repuestoId}`;
  return Number(rows[0].stock_actual);
}

async function historialDe(ordenId: string) {
  return q<{
    estado_anterior: string | null;
    estado_nuevo: string;
    usuario_id: string | null;
  }>`
    SELECT estado_anterior, estado_nuevo, usuario_id
    FROM orden_estado_historial
    WHERE orden_trabajo_id = ${ordenId}
    ORDER BY created_at`;
}

async function auditorias(entidad: string, entidadId: string) {
  return q<{
    accion: string;
    usuario_id: string;
    ip: string | null;
    valor_anterior: Record<string, unknown> | null;
    valor_nuevo: Record<string, unknown> | null;
    descripcion: string | null;
  }>`
    SELECT accion, usuario_id, ip, valor_anterior, valor_nuevo, descripcion
    FROM audit_log
    WHERE tenant_slug = ${TENANT} AND entidad = ${entidad} AND entidad_id = ${entidadId}
    ORDER BY created_at`;
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Fase 3', ${TENANT}, 'tenant_e2e_fase3', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Fase 3', 'admin', true)
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
    `DELETE FROM orden_estado_historial WHERE orden_trabajo_id IN (SELECT id FROM ordenes_trabajo WHERE tenant_slug = '${TENANT}')`,
    `DELETE FROM orden_repuestos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM stock_movements WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM ordenes_trabajo WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM vehiculos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM clients WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM repuestos WHERE tenant_slug = '${TENANT}'`,
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
      console.error("[fase3] cleanup falló:", stmt, err);
    }
  }
  if (app) await app.close();
});

// ─── T-31: rollback completo ──────────────────────────────

describe("T-31 — updateOrdenStatus es una sola transacción", () => {
  it("falla el consumo de stock → no cambia el estado, no escribe historial, no toca stock", async () => {
    const clientId = await crearCliente(`T31 ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `T31${TS}`);
    const ordenId = await crearOrden(clientId, vehicleId);

    // Repuesto vinculado a la OT con stock insuficiente (0 < 1)
    const codigo = `T31-${TS}`;
    const repuestoId = await crearRepuesto(codigo, 0);
    await q`
      INSERT INTO orden_repuestos
        (orden_trabajo_id, repuesto_id, repuesto_nombre, codigo, cantidad,
         precio_unitario, subtotal, tenant_slug)
      VALUES (${ordenId}, ${repuestoId}, 'Pieza T31', ${codigo}, 1, 10, 10, ${TENANT})`;

    const estadoAntes = await estadoDe(ordenId);
    expect(estadoAntes).not.toBe("Listo");

    const res = await cambiarEstado(ordenId, "Listo");

    // El error de negocio llega al cliente (no un 500 silencioso)
    expect(res.statusCode, `PATCH status → ${res.statusCode}: ${res.body}`).toBe(422);
    expect(res.body).toMatch(/stock insuficiente/i);

    // La transacción revirtió: nada quedó a medias
    expect(await estadoDe(ordenId)).toBe(estadoAntes);
    expect(await historialDe(ordenId)).toHaveLength(0);
    expect(await stockDe(repuestoId)).toBe(0);
    const movs = await q<{ n: number }>`
      SELECT count(*)::int AS n FROM stock_movements WHERE orden_trabajo_id = ${ordenId}`;
    expect(movs[0].n).toBe(0);
  });

  it("transición exitosa → historial con el actor de la request (T-33)", async () => {
    const clientId = await crearCliente(`T31b ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `T31b${TS}`);
    const ordenId = await crearOrden(clientId, vehicleId);
    const estadoAntes = await estadoDe(ordenId);

    const res = await cambiarEstado(ordenId, "Listo");
    expect(res.statusCode, `PATCH status → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json().status).toBe("Listo");

    const historial = await historialDe(ordenId);
    expect(historial).toHaveLength(1);
    expect(historial[0].estado_anterior).toBe(estadoAntes);
    expect(historial[0].estado_nuevo).toBe("Listo");
    // Quién lo hizo: el perfil autenticado de la request (no "system")
    expect(historial[0].usuario_id).toBe(ADMIN_ID);
  });
});

// ─── T-32: atomicidad de movimientos de stock ─────────────

describe("T-32 — salida/ingreso de stock atómicos", () => {
  it("salida con orden_trabajo_id inexistente → no descuenta stock ni deja movimiento", async () => {
    const codigo = `T32-${TS}`;
    const repuestoId = await crearRepuesto(codigo, 5);
    const stockAntes = await stockDe(repuestoId);
    expect(stockAntes).toBe(5);

    // FK stock_movements.orden_trabajo_id → ordenes_trabajo.id dispara el
    // fallo DESPUÉS de descontar el stock: la transacción lo revierte.
    const ordenInexistente = "00000000-0000-0000-0000-0000f3f3f3f3";
    const res = await app.inject({
      method: "POST",
      url: "/inventory/repuestos/salida",
      headers: auth(),
      payload: {
        repuestoId,
        cantidad: 2,
        motivo: "Uso en OT",
        ordenTrabajoId: ordenInexistente,
      },
    });
    expect(res.statusCode, `salida → ${res.statusCode}: ${res.body}`).not.toBe(200);

    expect(await stockDe(repuestoId)).toBe(stockAntes);
    const movs = await q<{ n: number }>`
      SELECT count(*)::int AS n FROM stock_movements
      WHERE repuesto_id = ${repuestoId}`;
    expect(movs[0].n).toBe(0);
  });

  it("salida válida → descuenta, registra el movimiento yaudita con actor", async () => {
    const codigo = `T32ok-${TS}`;
    const repuestoId = await crearRepuesto(codigo, 5);

    const res = await app.inject({
      method: "POST",
      url: "/inventory/repuestos/salida",
      headers: auth(),
      payload: { repuestoId, cantidad: 2, motivo: "Uso en OT" },
    });
    expect(res.statusCode, `salida → ${res.statusCode}: ${res.body}`).toBe(200);

    expect(await stockDe(repuestoId)).toBe(3);

    const movs = await q<{ id: string }>`
      SELECT id FROM stock_movements
      WHERE repuesto_id = ${repuestoId} AND tipo = 'SALIDA'
      ORDER BY created_at DESC LIMIT 1`;
    expect(movs).toHaveLength(1);

    const aud = await auditorias("stock_movements", movs[0].id);
    expect(aud).toHaveLength(1);
    expect(aud[0].accion).toBe("CREATE");
    expect(aud[0].usuario_id).toBe(ADMIN_ID);
    expect(aud[0].ip).toBeTruthy();
    expect(Number(aud[0].valor_anterior?.stockActual)).toBe(5);
    expect(Number(aud[0].valor_nuevo?.stockActual)).toBe(3);
  });
});

// ─── T-33: auditoría de entidades ─────────────────────────

describe("T-33 — auditoría de clientes con actor y antes/después", () => {
  it("CREATE y UPDATE escriben audit_log (usuario_id + ip + valores)", async () => {
    const nombreOriginal = `T33 ${TS}`;
    const clientId = await crearCliente(nombreOriginal);

    const creadas = await auditorias("clients", clientId);
    expect(creadas).toHaveLength(1);
    expect(creadas[0].accion).toBe("CREATE");
    expect(creadas[0].usuario_id).toBe(ADMIN_ID);
    expect(creadas[0].ip).toBeTruthy();
    expect(creadas[0].valor_anterior).toBeNull();
    expect(String(creadas[0].valor_nuevo?.name)).toBe(nombreOriginal);

    const nombreNuevo = `T33 editado ${TS}`;
    const patch = await app.inject({
      method: "PATCH",
      url: `/workshop/clientes/${clientId}`,
      headers: auth(),
      payload: { name: nombreNuevo },
    });
    expect(patch.statusCode, `PATCH → ${patch.statusCode}: ${patch.body}`).toBe(200);

    const todas = await auditorias("clients", clientId);
    expect(todas).toHaveLength(2);
    const upd = todas.find((a) => a.accion === "UPDATE");
    expect(upd, "falta la auditoría UPDATE").toBeTruthy();
    expect(upd!.usuario_id).toBe(ADMIN_ID);
    expect(String(upd!.valor_anterior?.name)).toBe(nombreOriginal);
    expect(String(upd!.valor_nuevo?.name)).toBe(nombreNuevo);
    expect(upd!.valor_anterior?.id).toBe(clientId);
  });
});

// ─── T-34: guarda de borrado de clientes ──────────────────

describe("T-34 — deleteClient con guarda referencial", () => {
  it("cliente con OT → 409; cliente sin OT → se borra", async () => {
    const clientId = await crearCliente(`T34 ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `T34${TS}`);
    await crearOrden(clientId, vehicleId);

    const bloqueo = await app.inject({
      method: "DELETE",
      url: `/workshop/clientes/${clientId}`,
      headers: auth(),
    });
    expect(bloqueo.statusCode, `DELETE → ${bloqueo.statusCode}: ${bloqueo.body}`).toBe(409);
    expect(bloqueo.json().message).toMatch(/orden\(es\) de trabajo/i);

    // El cliente sigue vivo
    const sigue = await app.inject({
      method: "GET",
      url: `/workshop/clientes/${clientId}`,
      headers: auth(),
    });
    expect(sigue.statusCode).toBe(200);

    // Cliente sin OT → borrado limpio (+ auditoría DELETE)
    const libre = await crearCliente(`T34 libre ${TS}`);
    const ok = await app.inject({
      method: "DELETE",
      url: `/workshop/clientes/${libre}`,
      headers: auth(),
    });
    expect(ok.statusCode, `DELETE → ${ok.statusCode}: ${ok.body}`).toBe(200);
    expect(ok.json()).toEqual({ deleted: true });

    const aud = await auditorias("clients", libre);
    expect(aud.map((a) => a.accion)).toEqual(["CREATE", "DELETE"]);
    const del = aud.find((a) => a.accion === "DELETE")!;
    expect(del.usuario_id).toBe(ADMIN_ID);
    expect(String(del.valor_anterior?.id)).toBe(libre);
  });
});
