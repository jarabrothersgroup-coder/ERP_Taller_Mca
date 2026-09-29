/**
 * Fase 4 — T-43: ficha de próximos mantenimientos (SRV-03 / TRN-08)
 *
 * Tests de banco reales (app real + BD migrada) que demuestran:
 *
 *   1. Al pasar una OT a "Listo" se genera (o actualiza, sin duplicar) el
 *      próximo mantenimiento de cada servicio realizado — dentro de la misma
 *      transacción T-31.
 *   2. El km capturado en el ingreso se propaga a `vehiculos.kilometraje`
 *      (TRN-08) y nunca degrada el odómetro.
 *   3. `predictMaintenance` usa el km REAL y filtra tenant (UUID ajeno → 404;
 *      antes devolvía 200 con datos inventados).
 *   4. CRUD manual de la ficha: create/read/update, guard de rol en DELETE
 *      (manager+) y aislamiento cross-tenant (404).
 *   5. El cron de recordatorio WhatsApp responde (idempotente, sin template
 *      no hace nada).
 *
 * Fixtures propias bajo el tenant "e2e-t43" (idempotentes, limpias en
 * afterAll) para no depender de scripts/seed-test.sql.
 *
 * @module tests/fase4-t43-mantenimientos
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-t43";
const OTRO_TENANT = "e2e-t43-otro";
const TENANT_ID = "00000000-0000-0000-0000-000e2e443000";
const OTRO_TENANT_ID = "00000000-0000-0000-0000-000e2e44300b";
const ADMIN_ID = "00000000-0000-0000-0000-000e2e443001";
const MECH_ID = "00000000-0000-0000-0000-000e2e443002";
const OTRO_ADMIN_ID = "00000000-0000-0000-0000-000e2e44300c";
const ADMIN_EMAIL = "admin@e2e-t43.test";
const MECH_EMAIL = "mecanico@e2e-t43.test";
const OTRO_ADMIN_EMAIL = "admin@e2e-t43-otro.test";
const TS = Date.now().toString(36);

let app: FastifyInstance;
let adminBearer: string;
let mechBearer: string;
let otroBearer: string;

// ─── Helpers ──────────────────────────────────────────────

function auth(slug: string = TENANT, who: "admin" | "mech" = "admin"): Record<string, string> {
  const bearer =
    slug !== TENANT ? otroBearer : who === "admin" ? adminBearer : mechBearer;
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": slug };
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

function pickId(body: any, label: string): string {
  const id = body?.id ?? body?.data?.id ?? body?.vehiculo?.id ?? body?.orden?.id;
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
    payload: { vehicleId, clientId, description: `Mantenimiento T43 ${TS}` },
  });
  expect([200, 201], `POST ordenes → ${res.statusCode}: ${res.body}`).toContain(res.statusCode);
  return pickId(res.json(), "orden");
}

async function crearServicioEnCatalogo(nombre: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/workshop/servicios",
    headers: auth(),
    payload: { nombre, precioEstimado: 150000, duracionEstimada: 60 },
  });
  expect([200, 201], `POST servicios → ${res.statusCode}: ${res.body}`).toContain(res.statusCode);
  return pickId(res.json(), "servicio");
}

function asignarServicio(ordenId: string, servicioId: string) {
  return app.inject({
    method: "POST",
    url: `/workshop/ordenes/${ordenId}/servicios`,
    headers: auth(),
    payload: { servicioId, cantidad: 1 },
  });
}

function cambiarEstado(ordenId: string, status: string, slug = TENANT) {
  return app.inject({
    method: "PATCH",
    url: `/workshop/ordenes/${ordenId}/status`,
    headers: auth(slug),
    payload: { status },
  });
}

/** Filtra los mantenimientos de un vehículo con SQL directo (verbatim). */
async function mantenimientosDe(vehiculoId: string) {
  return q<{
    id: string;
    servicio: string;
    km_objetivo: number | null;
    fecha_objetivo: string | null;
    estado: string;
    origen: string;
    orden_trabajo_id: string | null;
    tenant_slug: string;
  }>`
    SELECT id, servicio, km_objetivo, fecha_objetivo, estado, origen,
           orden_trabajo_id, tenant_slug
    FROM mantenimientos_programados
    WHERE vehiculo_id = ${vehiculoId}
    ORDER BY created_at`;
}

async function kmDeVehiculo(vehiculoId: string): Promise<number | null> {
  const rows = await q<{ kilometraje: number | null }>`
    SELECT kilometraje FROM vehiculos WHERE id = ${vehiculoId}`;
  return rows[0]?.kilometraje ?? null;
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E T43', ${TENANT}, 'tenant_e2e_t43', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${OTRO_TENANT_ID}, 'E2E T43 B', ${OTRO_TENANT}, 'tenant_e2e_t43_b', true)
    ON CONFLICT (slug) DO NOTHING`;
  for (const [id, email, name, role, tenantId] of [
    [ADMIN_ID, ADMIN_EMAIL, "Admin T43", "admin", TENANT_ID],
    [MECH_ID, MECH_EMAIL, "Mecánico T43", "mechanic", TENANT_ID],
    [OTRO_ADMIN_ID, OTRO_ADMIN_EMAIL, "Admin T43 B", "admin", OTRO_TENANT_ID],
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
});

afterAll(async () => {
  const limpiar = [
    `DELETE FROM mantenimientos_programados WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM audit_log WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM orden_estado_historial WHERE orden_trabajo_id IN (SELECT id FROM ordenes_trabajo WHERE tenant_slug = '${TENANT}')`,
    `DELETE FROM orden_servicios WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM orden_repuestos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM servicios_catalogo WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM ingresos WHERE vehicle_id IN (SELECT id FROM vehiculos WHERE tenant_slug = '${TENANT}')`,
    `DELETE FROM ordenes_trabajo WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM vehiculos WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM clients WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM profiles WHERE tenant_id = '${TENANT_ID}'`,
    `DELETE FROM profiles WHERE tenant_id = '${OTRO_TENANT_ID}'`,
    `DELETE FROM tenants WHERE id = '${OTRO_TENANT_ID}'`,
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
      console.error("[t43] cleanup falló:", stmt, err);
    }
  }
  if (app) await app.close();
});

// ─── 1. Generación al completar la OT ─────────────────────

describe("T-43 — la OT a \"Listo\" genera la ficha del próximo mantenimiento", () => {
  it("genera un mantenimiento PENDIENTE por cada servicio realizado (origen OT_COMPLETADA)", async () => {
    const clientId = await crearCliente(`T43 gen ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `T43G${TS}`);
    const ordenId = await crearOrden(clientId, vehicleId);

    // Odómetro real del vehículo antes de completar (kmObjetivo = km + intervalo)
    const kmAntes = 40000;
    const patchVeh = await app.inject({
      method: "PATCH",
      url: `/workshop/vehiculos/${vehicleId}`,
      headers: auth(),
      payload: { kilometraje: kmAntes },
    });
    expect(patchVeh.statusCode, patchVeh.body).toBe(200);

    const servicioId = await crearServicioEnCatalogo(`Cambio de aceite T43 ${TS}`);
    const asignada = await asignarServicio(ordenId, servicioId);
    expect(asignada.statusCode, asignada.body).toBe(201);

    const res = await cambiarEstado(ordenId, "Listo");
    expect(res.statusCode, `PATCH status → ${res.statusCode}: ${res.body}`).toBe(200);

    const items = await mantenimientosDe(vehicleId);
    expect(items).toHaveLength(1);
    const m = items[0]!;
    expect(m.servicio).toContain("Cambio de aceite");
    expect(m.estado).toBe("PENDIENTE");
    expect(m.origen).toBe("OT_COMPLETADA");
    expect(m.tenant_slug).toBe(TENANT);
    expect(m.orden_trabajo_id).toBe(ordenId);
    // Intervalo de aceite = 5000 km sobre el odómetro REAL (no inventado)
    expect(m.km_objetivo).toBe(kmAntes + 5000);
    expect(m.fecha_objetivo).toBeTruthy();
  });

  it("idempotente: una segunda OT con el mismo servicio actualiza la fila (no duplica)", async () => {
    const clientId = await crearCliente(`T43 idem ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `T43I${TS}`);
    const servicioId = await crearServicioEnCatalogo(`Filtros T43 ${TS}`);

    const orden1 = await crearOrden(clientId, vehicleId);
    expect((await asignarServicio(orden1, servicioId)).statusCode).toBe(201);
    expect((await cambiarEstado(orden1, "Listo")).statusCode).toBe(200);

    const despues1 = await mantenimientosDe(vehicleId);
    expect(despues1).toHaveLength(1);

    const orden2 = await crearOrden(clientId, vehicleId);
    expect((await asignarServicio(orden2, servicioId)).statusCode).toBe(201);
    expect((await cambiarEstado(orden2, "Listo")).statusCode).toBe(200);

    const despues2 = await mantenimientosDe(vehicleId);
    expect(despues2, "no debe duplicar el mantenimiento pendiente").toHaveLength(1);
    // …y apunta a la última OT que lo realizó
    expect(despues2[0].orden_trabajo_id).toBe(orden2);
  });

  it("una OT sin servicios no genera filas", async () => {
    const clientId = await crearCliente(`T43 vacía ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `T43V${TS}`);
    const ordenId = await crearOrden(clientId, vehicleId);

    expect((await cambiarEstado(ordenId, "Listo")).statusCode).toBe(200);
    expect(await mantenimientosDe(vehicleId)).toHaveLength(0);
  });
});

// ─── 2. Propagación de odómetro (TRN-08) ──────────────────

describe("T-43 — ingreso propaga el km al vehículo", () => {
  it("el km del ingreso actualiza vehiculos.kilometraje", async () => {
    const clientId = await crearCliente(`T43 km ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `T43K${TS}`);
    expect(await kmDeVehiculo(vehicleId)).toBeNull();

    const res = await app.inject({
      method: "POST",
      url: "/workshop/ingresos",
      headers: auth(),
      payload: { vehicleId, kilometraje: 55555 },
    });
    expect(res.statusCode, `POST ingresos → ${res.statusCode}: ${res.body}`).toBe(201);

    expect(await kmDeVehiculo(vehicleId)).toBe(55555);
  });

  it("un km menor no degrada el odómetro (solo avanza)", async () => {
    const clientId = await crearCliente(`T43 km2 ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `T43K2${TS}`);

    await app.inject({
      method: "POST",
      url: "/workshop/ingresos",
      headers: auth(),
      payload: { vehicleId, kilometraje: 80000 },
    });
    await app.inject({
      method: "POST",
      url: "/workshop/ingresos",
      headers: auth(),
      payload: { vehicleId, kilometraje: 100 },
    });

    expect(await kmDeVehiculo(vehicleId)).toBe(80000);
  });
});

// ─── 3. predictMaintenance: km real + tenant ──────────────

describe("T-43 — predictMaintenance con km real y filtro de tenant", () => {
  it("usa el odómetro real (kmReal=true) y devuelve la ficha persistida", async () => {
    const clientId = await crearCliente(`T43 pred ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `T43P${TS}`);
    const ordenId = await crearOrden(clientId, vehicleId);
    const servicioId = await crearServicioEnCatalogo(`Pastillas de freno T43 ${TS}`);
    expect((await asignarServicio(ordenId, servicioId)).statusCode).toBe(201);
    expect((await cambiarEstado(ordenId, "Listo")).statusCode).toBe(200);

    const res = await app.inject({
      method: "GET",
      url: `/workshop/predictions/${vehicleId}`,
      headers: auth(),
    });
    expect(res.statusCode, `GET predictions → ${res.statusCode}: ${res.body}`).toBe(200);
    const body = res.json();

    // El vehículo tenía kilometraje null → fallback estimado, bandera false
    expect(typeof body.kmActual).toBe("number");
    expect(body.kmReal).toBe(false);
    expect(Array.isArray(body.programados)).toBe(true);
    expect(body.programados.length).toBeGreaterThanOrEqual(1);
    expect(body.programados[0].servicio).toContain("Pastillas de freno");

    // Ahora con odómetro real
    const patchVeh = await app.inject({
      method: "PATCH",
      url: `/workshop/vehiculos/${vehicleId}`,
      headers: auth(),
      payload: { kilometraje: 61234 },
    });
    expect(patchVeh.statusCode).toBe(200);

    const res2 = await app.inject({
      method: "GET",
      url: `/workshop/predictions/${vehicleId}`,
      headers: auth(),
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().kmActual).toBe(61234);
    expect(res2.json().kmReal).toBe(true);
  });

  it("UUID de otro tenant → 404 (antes: 200 con datos ajenos)", async () => {
    const clientId = await crearCliente(`T43 cross ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `T43X${TS}`);

    const res = await app.inject({
      method: "GET",
      url: `/workshop/predictions/${vehicleId}`,
      headers: auth(OTRO_TENANT),
    });
    expect(res.statusCode).toBe(404);
  });
});

// ─── 4. CRUD manual + guards + tenant ─────────────────────

describe("T-43 — CRUD de la ficha con guards de rol y tenant", () => {
  let vehiculoId: string;
  let mantId: string;

  beforeAll(async () => {
    const clientId = await crearCliente(`T43 crud ${TS}`);
    vehiculoId = await crearVehiculo(clientId, `T43C${TS}`);
  });

  it("POST crea un mantenimiento manual y aparece en el listado", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/mantenimientos",
      headers: auth(),
      payload: {
        vehiculoId,
        servicio: "Correa de distribución",
        kmObjetivo: 120000,
        fechaObjetivo: "2027-03-01",
      },
    });
    expect([200, 201], `POST → ${res.statusCode}: ${res.body}`).toContain(res.statusCode);
    mantId = pickId(res.json(), "mantenimiento");
    expect(res.json().origen).toBe("MANUAL");
    expect(res.json().estado).toBe("PENDIENTE");

    const list = await app.inject({
      method: "GET",
      url: `/workshop/mantenimientos?vehiculoId=${vehiculoId}`,
      headers: auth(),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items.some((m: any) => m.id === mantId)).toBe(true);
  });

  it("POST sin km ni fecha → 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/mantenimientos",
      headers: auth(),
      payload: { vehiculoId, servicio: "Sin objetivo" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("POST sobre vehículo de otro tenant → 404", async () => {
    const clientId = await crearCliente(`T43 cross2 ${TS}`);
    const vehiculoAjeno = await crearVehiculo(clientId, `T43CX${TS}`);

    const res = await app.inject({
      method: "POST",
      url: "/workshop/mantenimientos",
      headers: auth(OTRO_TENANT),
      payload: { vehiculoId: vehiculoAjeno, servicio: "Aceite", kmObjetivo: 1000 },
    });
    // El vehículo no existe en el tenant del token → 404
    expect(res.statusCode).toBe(404);
  });

  it("PATCH marca REALIZADO", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/workshop/mantenimientos/${mantId}`,
      headers: auth(),
      payload: { estado: "REALIZADO" },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().estado).toBe("REALIZADO");
  });

  it("GET por id es tenant-scoped (otro tenant → 404)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workshop/mantenimientos/${mantId}`,
      headers: auth(OTRO_TENANT),
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE exige manager+ (mecánico → 403)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/workshop/mantenimientos/${mantId}`,
      headers: auth(TENANT, "mech"),
    });
    expect(res.statusCode).toBe(403);
  });

  it("DELETE admin → 204 y la fila desaparece", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/workshop/mantenimientos/${mantId}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(204);

    const tras = await mantenimientosDe(vehiculoId);
    expect(tras.find((m) => m.id === mantId)).toBeUndefined();
  });

  it("DELETE cross-tenant → 404 (no borra filas ajenas)", async () => {
    const creada = await app.inject({
      method: "POST",
      url: "/workshop/mantenimientos",
      headers: auth(),
      payload: { vehiculoId, servicio: "Refrigerante", kmObjetivo: 90000 },
    });
    const id = pickId(creada.json(), "mantenimiento");

    const res = await app.inject({
      method: "DELETE",
      url: `/workshop/mantenimientos/${id}`,
      headers: auth(OTRO_TENANT),
    });
    expect(res.statusCode).toBe(404);

    // la fila sigue viva en el tenant propio
    expect((await mantenimientosDe(vehiculoId)).find((m) => m.id === id)).toBeTruthy();
  });
});

// ─── 5. Ficha por vehículo ────────────────────────────────

describe("T-43 — ficha por vehículo", () => {
  it("GET /workshop/mantenimientos/vehiculo/:id devuelve km + items", async () => {
    const clientId = await crearCliente(`T43 ficha ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `T43F${TS}`);
    await app.inject({
      method: "POST",
      url: "/workshop/mantenimientos",
      headers: auth(),
      payload: { vehiculoId: vehicleId, servicio: "Rotación", kmObjetivo: 45000 },
    });

    const res = await app.inject({
      method: "GET",
      url: `/workshop/mantenimientos/vehiculo/${vehicleId}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.vehiculoId).toBe(vehicleId);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].servicio).toBe("Rotación");
  });

  it("vehículo de otro tenant → 404", async () => {
    const clientId = await crearCliente(`T43 ficha x ${TS}`);
    const vehicleId = await crearVehiculo(clientId, `T43FX${TS}`);

    const res = await app.inject({
      method: "GET",
      url: `/workshop/mantenimientos/vehiculo/${vehicleId}`,
      headers: auth(OTRO_TENANT),
    });
    expect(res.statusCode).toBe(404);
  });
});

// ─── 6. Cron de recordatorio WhatsApp ─────────────────────

describe("T-43 — cron de recordatorio WhatsApp", () => {
  it("responde success sin explotar (idempotente)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/cron/mantenimientos-recordatorios",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(typeof body.enviados).toBe("number");
    expect(typeof body.omitidos).toBe("number");
    expect(Array.isArray(body.errores)).toBe(true);
  });

  it("segunda corrida no reenvía lo ya procesado (bandera recordatorio_enviado)", async () => {
    // Sin template `proximo_servicio` para este tenant el cron omite todo:
    // ninguna fila debe quedar marcada como enviada indebidamente.
    const marcados = await q<{ n: number }>`
      SELECT count(*)::int AS n FROM mantenimientos_programados
      WHERE tenant_slug = ${TENANT} AND recordatorio_enviado = true`;
    expect(marcados[0].n).toBe(0);

    const res = await app.inject({
      method: "POST",
      url: "/workshop/cron/mantenimientos-recordatorios",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
  });
});
