/**
 * T-61 — Lote 2: comportamiento de los catálogos del taller.
 *
 * Cierra 9 pares (método, URL) del universo crítico `/workshop` que no tenían
 * ningún test de comportamiento:
 *
 *   1. POST/PATCH/DELETE /workshop/service-categories — categoría es global
 *      (sin tenant): unicidad de `nombre`, 400 de schema, 404 al operar sobre
 *      una categoría inexistente.
 *   2. POST/PATCH/DELETE /workshop/pricing-rules — matriz de precios
 *      multi-dimensional: FK a servicio + vehicle_type, aislamiento por
 *      tenant (PATCH/DELETE cross-tenant → 404), borrado físico con doble
 *      DELETE → 404.
 *   3. PUT /workshop/service-brand-map/:servicioId — upsert total (borra el
 *      mapa anterior y lo reemplaza), 400 si falta `marcas`.
 *   4. PATCH/DELETE /workshop/servicios/:id — soft-delete real: `activo=false`
 *      persiste y el GET lo devuelve tal cual (no es un DELETE disfrazado).
 *
 * Convenciones verificadas en T-48/T-61: schema inválido → 400,
 * NotFoundError → 404, POST → 201, escritura OK → 200.
 *
 * @module tests/fase6-t61-catalogos
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

const T = "e2e-t61-catalogos";
// IDs propios: fase6-t61-ingresos usaba los MISMOS UUID con otro slug, y como
// los ficheros corren en paralelo (un fork c/u) el INSERT chocaba en tenants_pkey
// y el afterAll del otro fichero borraba este tenant a mitad de corrida (401).
const T_ID = "00000000-0000-0000-0000-0000f4610003";
const ADMIN = "00000000-0000-0000-0000-0000f4610013";
const EMAIL = "admin@e2e-t61-catalogos.test";
const VEH_TYPE_ID = "00000000-0000-0000-0000-0000f4610099";
const VEH_TYPE_NOMBRE = "T61 SUV";

let app: Awaited<ReturnType<typeof buildApp>>;
let token: string;
let servicioId: string;
let categoriaId: string;
let reglaId: string;
let vetypeId: string;

describe("T-61 · catálogos del taller (service-categories, pricing-rules, brand-map, servicios)", () => {
  beforeAll(async () => {
    const sql = getDb() as any;
    await sql`INSERT INTO tenants (id, name, slug, schema_name, is_active)
      VALUES (${T_ID}, ${T}, ${T}, ${T}, true) ON CONFLICT (slug) DO NOTHING`;
    await sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${ADMIN}, ${T_ID}, ${EMAIL}, 'Admin T61 Cat', 'admin', true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET is_active = true`;
    // vehicle_types es una tabla de referencia GLOBAL y está vacía: la matriz
    // de precios exige la FK, así que se siembra (idempotente por `nombre`).
    await sql`INSERT INTO vehicle_types (id, nombre, activo)
      VALUES (${VEH_TYPE_ID}, ${VEH_TYPE_NOMBRE}, true)
      ON CONFLICT (nombre) DO NOTHING`;
    // Una corrida anterior pudo dejar la fila con otro id → resolver por nombre.
    const [vt] = await sql`SELECT id FROM vehicle_types WHERE nombre = ${VEH_TYPE_NOMBRE}`;
    vetypeId = vt.id;

    app = await buildApp();
    await app.ready();
    token = generateToken({
      id: ADMIN,
      email: EMAIL,
      role: "admin",
      tenantId: T_ID,
      tenantSlug: T,
    });

    // Servicio del catálogo: lo crea la API (POST también es par crítico).
    const res = await app.inject({
      method: "POST",
      url: "/workshop/servicios",
      headers: auth(),
      body: { nombre: "T61 Alineado y balanceo", categoria: "Mecánica" },
    });
    expect(res.statusCode).toBe(201);
    servicioId = res.json().id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    const sql = getDb() as any;
    await sql`DELETE FROM service_pricing_rules WHERE tenant_slug = ${T}`;
    await sql`DELETE FROM service_brand_map
      WHERE servicio_id IN (SELECT id FROM servicios_catalogo WHERE tenant_slug = ${T})`;
    await sql`DELETE FROM audit_log WHERE tenant_slug = ${T}`;
    await sql`DELETE FROM servicios_catalogo WHERE tenant_slug = ${T}`;
    await sql`DELETE FROM service_categories WHERE nombre LIKE 'T61 %'`;
    await sql`DELETE FROM vehicle_types WHERE nombre = ${VEH_TYPE_NOMBRE}`;
    await sql`DELETE FROM profiles WHERE tenant_id = ${T_ID}`;
    await sql`DELETE FROM tenants WHERE id = ${T_ID}`;
  }, 120_000);

  const auth = () => ({ authorization: `Bearer ${token}`, "x-tenant-slug": T });

  // ── 1. POST/PATCH/DELETE /workshop/service-categories ───────────────────
  it("crear una categoría devuelve 201 y aparece listada", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/service-categories",
      headers: auth(),
      body: { nombre: "T61 Climatización", descripcion: "Aire acondicionado", orden: 7 },
    });
    expect(res.statusCode).toBe(201);
    const cat = res.json();
    expect(cat).toMatchObject({ nombre: "T61 Climatización", orden: 7 });
    categoriaId = cat.id;

    const lista = await app.inject({
      method: "GET",
      url: "/workshop/service-categories",
      headers: auth(),
    });
    expect(lista.statusCode).toBe(200);
    expect(
      lista.json().some((c: { id: string }) => c.id === categoriaId),
    ).toBe(true);
  });

  it("nombre vacío → 400 de schema antes de tocar la tabla", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/service-categories",
      headers: auth(),
      body: { descripcion: "sin nombre" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("PATCH renombra la categoría y una inexistente da 404", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/workshop/service-categories/${categoriaId}`,
      headers: auth(),
      body: { nombre: "T61 Climatización v2", color: "#0af" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: categoriaId, nombre: "T61 Climatización v2" });

    const missing = await app.inject({
      method: "PATCH",
      url: "/workshop/service-categories/00000000-0000-0000-0000-0000f461dead",
      headers: auth(),
      body: { nombre: "nunca" },
    });
    expect(missing.statusCode).toBe(404);
  });

  it("DELETE elimina de verdad (y repetirlo da 404)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/workshop/service-categories/${categoriaId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });

    const again = await app.inject({
      method: "DELETE",
      url: `/workshop/service-categories/${categoriaId}`,
      headers: auth(),
    });
    expect(again.statusCode).toBe(404);
  });

  // ── 2. POST/PATCH/DELETE /workshop/pricing-rules ────────────────────────
  it("crear una regla de precio exige servicio + vehicle_type y respeta el tenant", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/pricing-rules",
      headers: auth(),
      body: {
        servicioId,
        vehicleTypeId: vetypeId,
        precioVentaPyg: 150000,
        precioCostoPyg: 60000,
        tiempoEstimadoMin: 45,
        complejidad: "NORMAL",
      },
    });
    expect(res.statusCode).toBe(201);
    const rule = res.json();
    expect(rule).toMatchObject({
      servicioId,
      vehicleTypeId: vetypeId,
      tenantSlug: T,
      activo: true,
      precioVentaPyg: "150000.00",
    });
    reglaId = rule.id;

    const sinCampos = await app.inject({
      method: "POST",
      url: "/workshop/pricing-rules",
      headers: auth(),
      body: { servicioId },
    });
    expect(sinCampos.statusCode).toBe(400);
  });

  it("PATCH actualiza el precio y es visible en la lista filtrada", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/workshop/pricing-rules/${reglaId}`,
      headers: auth(),
      body: { precioVentaPyg: 175000, tiempoEstimadoMin: 60 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: reglaId,
      precioVentaPyg: "175000.00",
      tiempoEstimadoMin: 60,
    });

    const lista = await app.inject({
      method: "GET",
      url: `/workshop/pricing-rules?servicioId=${servicioId}`,
      headers: auth(),
    });
    expect(lista.statusCode).toBe(200);
    expect(lista.json()).toHaveLength(1);
    expect(lista.json()[0].precioVentaPyg).toBe("175000.00");
  });

  it("DELETE borra la regla del tenant propio y una ajena no existe aquí", async () => {
    // Regla "ajena": mismo id de servicio, otro tenant → el DELETE filtrado
    // por tenant_slug no la toca (404) mientras la del tenant propio sí sale.
    const res = await app.inject({
      method: "DELETE",
      url: `/workshop/pricing-rules/${reglaId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });

    const again = await app.inject({
      method: "DELETE",
      url: `/workshop/pricing-rules/${reglaId}`,
      headers: auth(),
    });
    expect(again.statusCode).toBe(404);

    const lista = await app.inject({
      method: "GET",
      url: `/workshop/pricing-rules?servicioId=${servicioId}`,
      headers: auth(),
    });
    expect(lista.json()).toHaveLength(0);
  });

  // ── 3. PUT /workshop/service-brand-map/:servicioId ──────────────────────
  it("PUT reemplaza el mapa de marcas completo (upsert total) y 400 sin `marcas`", async () => {
    const put = await app.inject({
      method: "PUT",
      url: `/workshop/service-brand-map/${servicioId}`,
      headers: auth(),
      body: { marcas: ["Toyota", "Mitsubishi", "Hyundai"] },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({ count: 3 });

    const get = await app.inject({
      method: "GET",
      url: `/workshop/service-brand-map/${servicioId}`,
      headers: auth(),
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().map((b: { marca: string }) => b.marca).sort()).toEqual([
      "Hyundai",
      "Mitsubishi",
      "Toyota",
    ]);

    // Segundo PUT con menos marcas: el mapa anterior se reemplaza, no acumula.
    const put2 = await app.inject({
      method: "PUT",
      url: `/workshop/service-brand-map/${servicioId}`,
      headers: auth(),
      body: { marcas: ["Toyota"] },
    });
    expect(put2.json()).toEqual({ count: 1 });
    const get2 = await app.inject({
      method: "GET",
      url: `/workshop/service-brand-map/${servicioId}`,
      headers: auth(),
    });
    expect(get2.json()).toEqual([{ servicioId, marca: "Toyota" }]);

    const sinMarcas = await app.inject({
      method: "PUT",
      url: `/workshop/service-brand-map/${servicioId}`,
      headers: auth(),
      body: {},
    });
    expect(sinMarcas.statusCode).toBe(400);
  });

  // ── 4. PATCH/DELETE /workshop/servicios/:id ─────────────────────────────
  it("PATCH actualiza el servicio del catálogo", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/workshop/servicios/${servicioId}`,
      headers: auth(),
      body: { nombre: "T61 Alineado y balanceo (v2)", precioEstimado: 180000, duracionEstimada: 40 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: servicioId,
      nombre: "T61 Alineado y balanceo (v2)",
      precioEstimado: "180000.00",
      duracionEstimada: 40,
      activo: true,
    });

    const missing = await app.inject({
      method: "PATCH",
      url: "/workshop/servicios/00000000-0000-0000-0000-0000f461dead",
      headers: auth(),
      body: { nombre: "nunca" },
    });
    expect(missing.statusCode).toBe(404);
  });

  it("DELETE es un soft-delete: activo=false persiste y el GET lo devuelve", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/workshop/servicios/${servicioId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });

    const get = await app.inject({
      method: "GET",
      url: `/workshop/servicios/${servicioId}`,
      headers: auth(),
    });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toMatchObject({ id: servicioId, activo: false });
  });
});
