/**
 * T-61 — Lote 3: comportamiento de los ítems de la orden de trabajo.
 *
 * Cierra 14 pares (método, URL) del universo crítico `/workshop` sin test:
 *
 *   1. Ítems de mano de obra — POST/PATCH/DELETE
 *      `/workshop/ordenes/:id/servicios[/:itemId]`: denormalización del
 *      precio del catálogo, recálculo de `subtotal` y de `totalCost` de la OT,
 *      404 al repetir un DELETE.
 *   2. Ítems de repuesto — POST/PATCH/DELETE `/repuestos[/:itemId]`: mismo
 *      contrato de recálculo, validación de cantidad ≤ 0 → 400.
 *   3. Trabajos a terceros — POST + PATCH de estado (enum validado → 400) y
 *      sus adjuntos multipart (upload con archivo → 201, sin archivo → 400;
 *      DELETE con `?path=` → `{deleted:true}` y el listado queda vacío).
 *   4. Asignación — POST `/workshop/ordenes/:id/assign` (asignar/desasignar
 *      y 404 cross-tenant) y PATCH `/workshop/ordenes/:id` (transición de
 *      estado con historial G-02, status fuera del enum → 400).
 *   5. Reloj del técnico — POST `/workshop/servicios/:id/clock-in|clock-out`
 *      sobre un ítem de `orden_servicios`: arranque/cierre de reloj y
 *      guardas de máquina de estados (doble clock-in y clock-out sin reloj
 *      → 422).
 *
 * @module tests/fase6-t61-items
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

const T = "e2e-t61-items";
const T_ID = "00000000-0000-0000-0000-0000f4620001";
const ADMIN = "00000000-0000-0000-0000-0000f4620010";
const MECH = "00000000-0000-0000-0000-0000f4620011";
const CLIENTE = "00000000-0000-0000-0000-0000f4620997";
const VEHICULO = "00000000-0000-0000-0000-0000f4620998";
const EMAIL = "admin@e2e-t61-items.test";

let app: Awaited<ReturnType<typeof buildApp>>;
let token: string;
let ordenId: string;
let servicioId: string;
let itemA: string; // ítem que se edita/borra
let itemB: string; // ítem del reloj (clock-in → clock-out)
let itemC: string; // ítem sin clock-in (guarda 422)
let repuestoItem: string;
let trabajoId: string;
let adjuntoPath: string;

describe("T-61 · ítems de la orden (servicios, repuestos, trabajos-terceros, assign, reloj)", () => {
  beforeAll(async () => {
    const sql = getDb() as any;
    await sql`INSERT INTO tenants (id, name, slug, schema_name, is_active)
      VALUES (${T_ID}, ${T}, ${T}, ${T}, true) ON CONFLICT (slug) DO NOTHING`;
    await sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${ADMIN}, ${T_ID}, ${EMAIL}, 'Admin T61 Items', 'admin', true),
             (${MECH}, ${T_ID}, 'mecanico@e2e-t61-items.test', 'Mecánico T61', 'mechanic', true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET is_active = true`;
    await sql`INSERT INTO clients (id, name, tenant_slug)
      VALUES (${CLIENTE}, ${"Cliente T61 Items"}, ${T}) ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO vehiculos (id, client_id, brand, model, engine_type, tenant_slug)
      VALUES (${VEHICULO}, ${CLIENTE}, ${"Toyota"}, ${"Hilux"}, ${"Nafta"}, ${T})
      ON CONFLICT (id) DO NOTHING`;

    app = await buildApp();
    await app.ready();
    token = generateToken({
      id: ADMIN,
      email: EMAIL,
      role: "admin",
      tenantId: T_ID,
      tenantSlug: T,
    });

    // OT viva (createOrden → estado inicial Presupuestado)
    const ot = await app.inject({
      method: "POST",
      url: "/workshop/ordenes",
      headers: auth(),
      body: { vehicleId: VEHICULO, clientId: CLIENTE, description: "T-61 ítems" },
    });
    expect(ot.statusCode).toBe(201);
    ordenId = ot.json().id;

    // Servicio del catálogo con precio: la POST de ítems lo denormaliza.
    const svc = await app.inject({
      method: "POST",
      url: "/workshop/servicios",
      headers: auth(),
      body: { nombre: "T61 Diagnóstico electrónica", precioEstimado: 100000 },
    });
    expect(svc.statusCode).toBe(201);
    servicioId = svc.json().id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    const sql = getDb() as any;
    const limpiar = [
      `DELETE FROM trabajos_terceros WHERE orden_trabajo_id IN (SELECT id FROM ordenes_trabajo WHERE tenant_slug = '${T}')`,
      `DELETE FROM orden_servicios WHERE tenant_slug = '${T}'`,
      `DELETE FROM orden_repuestos WHERE tenant_slug = '${T}'`,
      `DELETE FROM orden_estado_historial WHERE orden_trabajo_id IN (SELECT id FROM ordenes_trabajo WHERE tenant_slug = '${T}')`,
      `DELETE FROM ordenes_trabajo WHERE tenant_slug = '${T}'`,
      `DELETE FROM servicios_catalogo WHERE tenant_slug = '${T}'`,
      `DELETE FROM vehiculos WHERE id = '${VEHICULO}'`,
      `DELETE FROM clients WHERE id = '${CLIENTE}'`,
      `DELETE FROM profiles WHERE tenant_id = '${T_ID}'`,
      `DELETE FROM tenants WHERE id = '${T_ID}'`,
    ];
    for (const stmt of limpiar) {
      try {
        await sql.unsafe(stmt);
      } catch (err) {
        console.error("[t61-items] cleanup falló:", stmt, err);
      }
    }
  }, 120_000);

  const auth = () => ({ authorization: `Bearer ${token}`, "x-tenant-slug": T });

  /**
   * `GET /workshop/ordenes/:id` serializa solo ORDEN_RESPONSE_PROPS (no
   * incluye totalCost), así que el recálculo se verifica contra la columna
   * real que escriben los ítems.
   */
  async function totalCostOtn(): Promise<number> {
    const sql = getDb() as any;
    const [ot] = await sql`SELECT total_cost FROM ordenes_trabajo WHERE id = ${ordenId}`;
    return Number(ot.total_cost ?? 0);
  }

  // ── 1. Ítems de mano de obra ────────────────────────────────────────────
  it("POST /workshop/ordenes/:id/servicios denormaliza precio y subtotal del catálogo", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenId}/servicios`,
      headers: auth(),
      body: { servicioId, cantidad: 2 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      ordenTrabajoId: ordenId,
      servicioId,
      cantidad: 2,
      precioUnitario: "100000.00",
      subtotal: "200000.00",
      tenantSlug: T,
    });
    itemA = res.json().id;

    const otro = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenId}/servicios`,
      headers: auth(),
      body: { servicioId, cantidad: 1 },
    });
    expect(otro.statusCode).toBe(201);
    itemB = otro.json().id;

    const tercero = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenId}/servicios`,
      headers: auth(),
      body: { servicioId, cantidad: 1 },
    });
    expect(tercero.statusCode).toBe(201);
    itemC = tercero.json().id;

    // Servicio inexistente en el catálogo → 404
    const missing = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenId}/servicios`,
      headers: auth(),
      body: { servicioId: "00000000-0000-0000-0000-0000f462dead" },
    });
    expect(missing.statusCode).toBe(404);
  });

  it("PATCH .../servicios/:itemId cambia la cantidad y recalcula subtotal + totalCost", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/workshop/ordenes/${ordenId}/servicios/${itemA}`,
      headers: auth(),
      body: { cantidad: 3 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: itemA, cantidad: 3, subtotal: "300000.00" });

    // totalCost de la OT = A(300k) + B(100k) + C(100k) = 500k
    expect(await totalCostOtn()).toBe(500000);

    // Cantidad 0 viola el mínimo del schema → 400
    const cero = await app.inject({
      method: "PATCH",
      url: `/workshop/ordenes/${ordenId}/servicios/${itemA}`,
      headers: auth(),
      body: { cantidad: 0 },
    });
    expect(cero.statusCode).toBe(400);
  });

  it("DELETE .../servicios/:itemId borra, recalcula el total y repetir da 404", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/workshop/ordenes/${ordenId}/servicios/${itemA}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });

    expect(await totalCostOtn()).toBe(200000); // B + C

    const again = await app.inject({
      method: "DELETE",
      url: `/workshop/ordenes/${ordenId}/servicios/${itemA}`,
      headers: auth(),
    });
    expect(again.statusCode).toBe(404);
  });

  // ── 2. Ítems de repuesto ───────────────────────────────────────────────
  it("POST .../repuestos agrega la pieza y la cantidad ≤ 0 se rechaza con 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenId}/repuestos`,
      headers: auth(),
      body: { repuestoNombre: "Filtro de aceite T61", codigo: "T61-FO", cantidad: 2, precioUnitario: 35000 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      repuestoNombre: "Filtro de aceite T61",
      cantidad: 2,
      precioUnitario: "35000.00",
      subtotal: "70000.00",
    });
    repuestoItem = res.json().id;

    const invalida = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenId}/repuestos`,
      headers: auth(),
      body: { repuestoNombre: "Nada", cantidad: 0, precioUnitario: 1000 },
    });
    expect(invalida.statusCode).toBe(400);

    const sinPrecio = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenId}/repuestos`,
      headers: auth(),
      body: { repuestoNombre: "Sin precio" },
    });
    expect(sinPrecio.statusCode).toBe(400);
  });

  it("PATCH .../repuestos/:itemId recalcula subtotal con precio y cantidad nuevas", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/workshop/ordenes/${ordenId}/repuestos/${repuestoItem}`,
      headers: auth(),
      body: { cantidad: 3, precioUnitario: 40000 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ cantidad: 3, subtotal: "120000.00" });

    // 200k de servicios (B+C) + 120k de repuesto
    expect(await totalCostOtn()).toBe(320000);
  });

  it("DELETE .../repuestos/:itemId retira la pieza (y repetir da 404)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/workshop/ordenes/${ordenId}/repuestos/${repuestoItem}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });

    const again = await app.inject({
      method: "DELETE",
      url: `/workshop/ordenes/${ordenId}/repuestos/${repuestoItem}`,
      headers: auth(),
    });
    expect(again.statusCode).toBe(404);

    expect(await totalCostOtn()).toBe(200000);
  });

  // ── 3. Trabajos a terceros ─────────────────────────────────────────────
  it("POST .../trabajos-terceros crea el trabajo con costo y queda listado", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenId}/trabajos-terceros`,
      headers: auth(),
      body: { proveedor: "Electricista T61", descripcion: "Rebobinado de alternador", costo: 450000 },
    });
    expect(res.statusCode).toBe(201);
    const { trabajoTercero } = res.json();
    expect(trabajoTercero).toMatchObject({
      ordenTrabajoId: ordenId,
      proveedor: "Electricista T61",
      costo: "450000.00",
      estado: "Pendiente",
    });
    trabajoId = trabajoTercero.id;

    const lista = await app.inject({
      method: "GET",
      url: `/workshop/ordenes/${ordenId}/trabajos-terceros`,
      headers: auth(),
    });
    expect(lista.json()).toHaveLength(1);

    const sinCampos = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenId}/trabajos-terceros`,
      headers: auth(),
      body: { proveedor: "Sin costo" },
    });
    expect(sinCampos.statusCode).toBe(400);
  });

  it("PATCH .../trabajos-terceros/:trabajoId avanza el estado (enum validado)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/workshop/ordenes/${ordenId}/trabajos-terceros/${trabajoId}`,
      headers: auth(),
      body: { estado: "Completado" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: trabajoId, estado: "Completado" });
    expect(res.json().fechaFin).toBeTruthy(); // se auto-setea al completar

    const invalido = await app.inject({
      method: "PATCH",
      url: `/workshop/ordenes/${ordenId}/trabajos-terceros/${trabajoId}`,
      headers: auth(),
      body: { estado: "Volando" },
    });
    expect(invalido.statusCode).toBe(400);
  });

  it("POST .../adjuntos sube el comprobante (multipart) y lo borra por ?path=", async () => {
    const boundary = "----T61Boundary7f3a";
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="factura.pdf"\r\n` +
          `Content-Type: application/pdf\r\n\r\n`,
      ),
      Buffer.from("%PDF-1.4\n% T61 comprobante de prueba\n"),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenId}/trabajos-terceros/${trabajoId}/adjuntos`,
      headers: {
        ...auth(),
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json()).toMatchObject({
      filename: "factura.pdf",
      contentType: "application/pdf",
    });
    adjuntoPath = res.json().path;
    expect(adjuntoPath).toContain(`${T}/trabajos-terceros/${trabajoId}/`);

    // listFiles une `prefix + "/" + name` y el prefijo ya termina en "/",
    // así que el listado normaliza distinto al path del upload: comparar con
    // las barras colapsadas.
    const norm = (p: string) => p.replace(/\/{2,}/g, "/");
    const lista = await app.inject({
      method: "GET",
      url: `/workshop/ordenes/${ordenId}/trabajos-terceros/${trabajoId}/adjuntos`,
      headers: auth(),
    });
    expect(
      lista.json().some((f: { path: string }) => norm(f.path) === norm(adjuntoPath)),
    ).toBe(true);

    // Sin archivo el upload es 400 (no un 500 ni un 201 vacío)
    const vacio = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenId}/trabajos-terceros/${trabajoId}/adjuntos`,
      headers: {
        ...auth(),
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="nota"\r\n\r\nx\r\n--${boundary}--\r\n`),
    });
    expect(vacio.statusCode).toBe(400);

    const del = await app.inject({
      method: "DELETE",
      url: `/workshop/ordenes/${ordenId}/trabajos-terceros/${trabajoId}/adjuntos?path=${encodeURIComponent(adjuntoPath)}`,
      headers: auth(),
    });
    expect(del.statusCode).toBe(200);
    expect(del.json()).toEqual({ deleted: true });

    const lista2 = await app.inject({
      method: "GET",
      url: `/workshop/ordenes/${ordenId}/trabajos-terceros/${trabajoId}/adjuntos`,
      headers: auth(),
    });
    expect(
      lista2.json().some((f: { path: string }) => norm(f.path) === norm(adjuntoPath)),
    ).toBe(false);
  });

  // ── 4. Asignación y estado de la OT ────────────────────────────────────
  it("POST /workshop/ordenes/:id/assign asigna, desasigna y da 404 si la OT no existe", async () => {
    const asignar = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenId}/assign`,
      headers: auth(),
      body: { mechanicId: MECH },
    });
    expect(asignar.statusCode).toBe(200);
    expect(asignar.json()).toMatchObject({ id: ordenId, assignedTo: MECH });

    const desasignar = await app.inject({
      method: "POST",
      url: `/workshop/ordenes/${ordenId}/assign`,
      headers: auth(),
      body: { mechanicId: null },
    });
    expect(desasignar.json()).toMatchObject({ id: ordenId, assignedTo: null });

    const missing = await app.inject({
      method: "POST",
      url: "/workshop/ordenes/00000000-0000-0000-0000-0000f462dead/assign",
      headers: auth(),
      body: { mechanicId: MECH },
    });
    expect(missing.statusCode).toBe(404);
  });

  it("PATCH /workshop/ordenes/:id cambia el estado y deja historial (G-02)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/workshop/ordenes/${ordenId}`,
      headers: auth(),
      body: { status: "Aprobado" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: ordenId, status: "Aprobado" });

    const sql = getDb() as any;
    const hist = await sql`
      SELECT estado_anterior, estado_nuevo FROM orden_estado_historial
      WHERE orden_trabajo_id = ${ordenId} ORDER BY created_at DESC LIMIT 1`;
    expect(hist).toHaveLength(1);
    expect(hist[0]).toMatchObject({ estado_anterior: "Presupuestado", estado_nuevo: "Aprobado" });

    const invalido = await app.inject({
      method: "PATCH",
      url: `/workshop/ordenes/${ordenId}`,
      headers: auth(),
      body: { status: "Volando" },
    });
    expect(invalido.statusCode).toBe(400);
  });

  // ── 5. Reloj del técnico sobre un ítem ─────────────────────────────────
  it("POST /workshop/servicios/:id/clock-in arranca el reloj (y doble clock-in → 422)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workshop/servicios/${itemB}/clock-in`,
      headers: auth(),
      body: { tecnicoId: MECH },
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json()).toMatchObject({ servicioId: itemB, tecnicoId: MECH });
    expect(res.json().horaInicio).toBeTruthy();

    const again = await app.inject({
      method: "POST",
      url: `/workshop/servicios/${itemB}/clock-in`,
      headers: auth(),
      body: { tecnicoId: MECH },
    });
    expect(again.statusCode).toBe(422);

    const sinTecnico = await app.inject({
      method: "POST",
      url: `/workshop/servicios/${itemB}/clock-in`,
      headers: auth(),
      body: {},
    });
    expect(sinTecnico.statusCode).toBe(400);
  });

  it("POST /workshop/servicios/:id/clock-out cierra el reloj y guarda la duración", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workshop/servicios/${itemB}/clock-out`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const out = res.json();
    expect(out).toMatchObject({ servicioId: itemB });
    expect(out.horaFin).toBeTruthy();
    expect(typeof out.duracionReal).toBe("number");

    // Estado terminal: segundo cierre → 422
    const again = await app.inject({
      method: "POST",
      url: `/workshop/servicios/${itemB}/clock-out`,
      headers: auth(),
    });
    expect(again.statusCode).toBe(422);
  });

  it("clock-out sin haber marcado entrada → 422 (guarda de máquina de estados)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workshop/servicios/${itemC}/clock-out`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().message).toContain("inicio");
  });
});
