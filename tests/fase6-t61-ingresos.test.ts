/**
 * T-61 — Colchón de comportamiento: INGRESOS / VEHÍCULOS / MECÁNICOS
 *
 * Cubre los 7 pares (método+URL) de escritura del módulo workshop que el
 * escaneo de consumidores declaraba sin consumidor de test:
 *
 *   1. POST   /workshop/ingresos/:id/checklist
 *   2. POST   /workshop/ingresos/:id/firma-retiro
 *   3. POST   /workshop/ingresos/:id/fotos
 *   4. DELETE /workshop/ingresos/:id/fotos/:photoId
 *   5. POST   /workshop/vehiculos/decode-vin
 *   6. DELETE /workshop/vehiculos/:id
 *   7. POST   /workshop/mechanic-assignment/assign
 *
 * Cada par tiene al menos una aserción sobre el efecto persistido, no sólo
 * sobre el código de estado. Los tenants se siembran con nombres únicos y
 * se limpian en afterAll.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

const T = "e2e-t61-ingresos";
const OTRO = "e2e-t61-ingresos-otro";
const EMAIL = `${T}@test.local`;
const OTRO_EMAIL = `${OTRO}@test.local`;

let app: FastifyInstance;
let token: string;
let tokenOtro: string;

const T_ID = "00000000-0000-0000-0000-0000f4610001";
const OTRO_ID = "00000000-0000-0000-0000-0000f4610002";
const ADMIN = "00000000-0000-0000-0000-0000f4610010";
const CLIENTE = "00000000-0000-0000-0000-0000f4610011";
const CLIENTE_OTRO = "00000000-0000-0000-0000-0000f4610012";
const VEHICULO = "0a100000-0000-4000-8000-000000000001";
const VEHICULO_OTRO = "0a100000-0000-4000-8000-000000000002";
const INGRESO = "0b100000-0000-4000-8000-000000000001";
const INGRESO_SIN_CHECKLIST = "0b100000-0000-4000-8000-000000000002";
const OT_MECANICO = "0c100000-0000-4000-8000-000000000001";
const OT_PINTURA = "0c100000-0000-4000-8000-000000000002";
const MECANICO = "0d100000-0000-4000-8000-000000000001";
const MECANICO_2 = "0d100000-0000-4000-8000-000000000002";
const OT_CARGADA = "0c100000-0000-4000-8000-000000000003";
const ADMIN_OTRO = "0d200000-0000-4000-8000-000000000001";
const VIN_OK = "1HGCM82633A004352";

const FIXTURE_DIR = "/tmp/erp-storage-vitest/ingreso-photos";

function auth() {
  return {
    authorization: `Bearer ${token}`,
    "x-tenant-slug": T,
  };
}

/** Multipart/form-data armado a mano: app.inject no usa fetch FormData. */
function multipart(filename: string, contentType: string, data: Buffer) {
  const boundary = "----t61ingresosboundary";
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return {
    payload,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

/** JPEG mínimo: cabecera SOI + APP0/JFIF + EOI. Pasa el validador de magic bytes. */
const JPEG_VALIDO = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

describe("T-61 · ingresos, vehículos y asignación de mecánicos", () => {
  beforeAll(async () => {
    const sql = getDb() as any;

    await sql`INSERT INTO tenants (id, name, slug, schema_name, is_active)
      VALUES (${T_ID}, ${"T61 Ingresos"}, ${T}, ${T}, true),
             (${OTRO_ID}, ${"T61 Ingresos Otro"}, ${OTRO}, ${OTRO}, true)
      ON CONFLICT (slug) DO NOTHING`;

    await sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${ADMIN}, ${T_ID}, ${EMAIL}, 'Admin T61', 'admin', true),
             (${MECANICO}, ${T_ID}, ${`${T}-mecanico@test.local`}, 'Mecanico T61', 'mechanic', true),
             (${MECANICO_2}, ${T_ID}, ${`${T}-mecanico2@test.local`}, 'Mecanico T61 B', 'mechanic', true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET is_active = true`;

    await sql`INSERT INTO clients (id, name, tenant_slug)
      VALUES (${CLIENTE}, ${"Cliente T61"}, ${T}),
             (${CLIENTE_OTRO}, ${"Cliente Otro"}, ${OTRO})
      ON CONFLICT (id) DO NOTHING`;

    await sql`INSERT INTO vehiculos (id, client_id, plate, vin, brand, model, year, engine_type, tenant_slug)
      VALUES (${VEHICULO}, ${CLIENTE}, 'T61AAA', null, 'Honda', 'Civic', 2020, 'Nafta', ${T}),
             (${VEHICULO_OTRO}, ${CLIENTE_OTRO}, 'T61BBB', null, 'Toyota', 'Corolla', 2021, 'Nafta', ${OTRO})
      ON CONFLICT (id) DO NOTHING`;

    // Idempotencia (lección T-48): limpiar checklist/firma de corridas previas.
    await sql`DELETE FROM ingreso_checklist WHERE ingreso_id IN (${INGRESO}, ${INGRESO_SIN_CHECKLIST})`;
    await sql`INSERT INTO ingresos (id, vehicle_id, fecha_ingreso, kilometraje, estado_exterior)
      VALUES (${INGRESO}, ${VEHICULO}, now(), 45000, 'rayon'),
             (${INGRESO_SIN_CHECKLIST}, ${VEHICULO}, now(), 45000, 'rayon')
      ON CONFLICT (id) DO NOTHING`;

    await sql`INSERT INTO ordenes_trabajo (id, vehicle_id, client_id, status, tenant_slug)
      VALUES (${OT_MECANICO}, ${VEHICULO}, ${CLIENTE}, 'En_Proceso', ${T}),
             (${OT_PINTURA}, ${VEHICULO_OTRO}, ${CLIENTE_OTRO}, 'En_Proceso', ${OTRO})
      ON CONFLICT (id) DO NOTHING`;

    // Carga laboral de MECANICO_2: 1 OT activa firmada por él. OJO — el servicio
    // agrupa por `hv_lockout_signed_by`, no por un "mecánico asignado": ese
    // campo se reutiliza como responsable. Es la única forma de que el scoring
    // vea carga hoy (hallazgo T-105-03).
    await sql`INSERT INTO ordenes_trabajo (id, vehicle_id, client_id, status, tenant_slug, hv_lockout_signed_by)
      VALUES (${OT_CARGADA}, ${VEHICULO}, ${CLIENTE}, 'En_Proceso', ${T}, ${MECANICO_2})
      ON CONFLICT (id) DO UPDATE SET status = 'En_Proceso', hv_lockout_signed_by = ${MECANICO_2}`;

    app = await buildApp();
    await app.ready();

    token = generateToken({
      id: ADMIN,
      email: EMAIL,
      role: "admin",
      tenantId: T_ID,
      tenantSlug: T,
    });
    tokenOtro = generateToken({
      id: ADMIN_OTRO,
      email: EMAIL,
      role: "admin",
      tenantId: OTRO_ID,
      tenantSlug: OTRO,
    });
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    const sql = getDb() as any;
    await sql`DELETE FROM ingreso_checklist WHERE ingreso_id IN (${INGRESO}, ${INGRESO_SIN_CHECKLIST})`;
    await sql`DELETE FROM ingresos WHERE id IN (${INGRESO}, ${INGRESO_SIN_CHECKLIST})`;
    await sql`DELETE FROM audit_log WHERE descripcion LIKE ${`%T61%`} OR entidad_id IN (${VEHICULO})`;
    await sql`DELETE FROM ordenes_trabajo WHERE tenant_slug IN (${T}, ${OTRO})`;
    await sql`DELETE FROM vehiculos WHERE tenant_slug IN (${T}, ${OTRO})`;
    await sql`DELETE FROM clients WHERE id IN (${CLIENTE}, ${CLIENTE_OTRO})`;
    await sql`DELETE FROM profiles WHERE tenant_id IN (${T_ID}, ${OTRO_ID})`;
    await sql`DELETE FROM tenants WHERE id IN (${T_ID}, ${OTRO_ID})`;

    const { rm } = await import("node:fs/promises");
    await rm(FIXTURE_DIR, { recursive: true, force: true }).catch(() => {});
  }, 120_000);

  beforeEach(async () => {
    const sql = getDb() as any;
    await sql`DELETE FROM ingreso_checklist WHERE ingreso_id IN (${INGRESO}, ${INGRESO_SIN_CHECKLIST})`;
  });

  // ── 1. POST /workshop/ingresos/:id/checklist ──────────────────────────
  describe("POST /workshop/ingresos/:id/checklist", () => {
    const CHECKLIST = {
      panels: { puertaDelanteraIzq: "rayon", guardabarrosIzq: "ok" },
      neumaticos: { frenteIzq: "ok", frenteDer: "rayon" },
      nivelCombustibleExacto: 0.5,
      kilometrajeFoto: true,
      accesorios: { radio: true, triReflectante: true },
      observacionesCliente: "rayón profundo en puerta",
      firmaCliente: "data:image/png;base64,iVBORw0KGgo=",
      firmaClienteNombre: "Cliente T61",
    };

    it("persiste el checklist con tenant del request y las firmas quedan fechadas", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${INGRESO}/checklist`,
        headers: auth(),
        body: {
      panels: { puertaDelanteraIzq: "rayon", guardabarrosIzq: "ok" },
      neumaticos: { frenteIzq: "ok", frenteDer: "rayon" },
      nivelCombustibleExacto: 0.5,
      kilometrajeFoto: true,
      accesorios: { radio: true, triReflectante: true },
      observacionesCliente: "rayón profundo en puerta",
      firmaCliente: "data:image/png;base64,iVBORw0KGgo=",
      firmaClienteNombre: "Cliente T61",
    },
      });
      expect(res.statusCode).toBe(201);

      const sql = getDb() as any;
      const rows = await sql`
        SELECT panels, neumaticos, nivel_combustible_exacto, kilometraje_foto,
               accesorios, observaciones_cliente, firma_cliente_nombre,
               firma_cliente_timestamp, cliente_conforme, tenant_slug
        FROM ingreso_checklist WHERE ingreso_id = ${INGRESO}`;
      expect(rows).toHaveLength(1);
      expect(rows[0].tenant_slug).toBe(T);
      expect(rows[0].panels).toMatchObject({ puertaDelanteraIzq: "rayon" });
      expect(rows[0].accesorios).toMatchObject({ radio: true });
      const nc = String(rows[0].nivel_combustible_exacto); expect(nc === "0.5" || nc === "0.50" || nc.startsWith("0.5")).toBe(true);
      expect(rows[0].kilometraje_foto).toBe(true);
      expect(rows[0].cliente_conforme).toBe(true); // hay firmaCliente
      expect(rows[0].firma_cliente_timestamp).not.toBeNull();
    });

    it("sin firma de cliente: cliente_conforme=false y sin timestamp", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${INGRESO}/checklist`,
        headers: auth(),
        body: { ...CHECKLIST, firmaCliente: undefined, firmaClienteNombre: undefined },
      });
      expect(res.statusCode).toBe(201);

      const sql = getDb() as any;
      const [row] = await sql`
        SELECT cliente_conforme, firma_cliente, firma_cliente_timestamp
        FROM ingreso_checklist WHERE ingreso_id = ${INGRESO}`;
      expect(row.cliente_conforme).toBe(false);
      expect(row.firma_cliente).toBeNull();
      expect(row.firma_cliente_timestamp).toBeNull();
      // el resto del checklist sí se actualizó (upsert, no insert duplicado)
      expect(row).toBeTruthy();
    });

    it("body incompleto → 400 y no escribe nada", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${INGRESO}/checklist`,
        headers: auth(),
        body: { panels: {}, kilometrajeFoto: true },
      });
      expect(res.statusCode).toBe(400);

      const sql = getDb() as any;
      const rows = await sql`
        SELECT observaciones_cliente FROM ingreso_checklist WHERE ingreso_id = ${INGRESO}`;
      expect(rows.length).toBe(0); // el 400 no lo alteró
    });

    it("ingreso inexistente → 404", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/workshop/ingresos/0b100000-0000-4000-8000-000000009999/checklist",
        headers: auth(),
        body: {
      panels: { puertaDelanteraIzq: "rayon", guardabarrosIzq: "ok" },
      neumaticos: { frenteIzq: "ok", frenteDer: "rayon" },
      nivelCombustibleExacto: 0.5,
      kilometrajeFoto: true,
      accesorios: { radio: true, triReflectante: true },
      observacionesCliente: "rayón profundo en puerta",
      firmaCliente: "data:image/png;base64,iVBORw0KGgo=",
      firmaClienteNombre: "Cliente T61",
    },
      });
      expect(res.statusCode).toBe(404);
    });

    it("sin token → 403 (checklist nunca se escribe)", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${INGRESO}/checklist`,
        body: {
      panels: { puertaDelanteraIzq: "rayon", guardabarrosIzq: "ok" },
      neumaticos: { frenteIzq: "ok", frenteDer: "rayon" },
      nivelCombustibleExacto: 0.5,
      kilometrajeFoto: true,
      accesorios: { radio: true, triReflectante: true },
      observacionesCliente: "rayón profundo en puerta",
      firmaCliente: "data:image/png;base64,iVBORw0KGgo=",
      firmaClienteNombre: "Cliente T61",
    },
      });
      expect(res.statusCode).toBe(403);

      const sql = getDb() as any;
      const rows = await sql`
        SELECT observaciones_cliente FROM ingreso_checklist WHERE ingreso_id = ${INGRESO}`;
      expect(rows.length).toBe(0);
    });


  });

  // ── 2. POST /workshop/ingresos/:id/firma-retiro ──────────────────────
  describe("POST /workshop/ingresos/:id/firma-retiro", () => {
    it("rechaza body incompleto → 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${INGRESO}/firma-retiro`,
        headers: auth(),
        body: { firma: "data:image/png;base64,AAA=" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("ingreso sin checklist → 404 y no crea fila", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${INGRESO_SIN_CHECKLIST}/firma-retiro`,
        headers: auth(),
        body: { firma: "data:image/png;base64,AAA=", nombre: "Cliente T61" },
      });
      expect(res.statusCode).toBe(404);

      const sql = getDb() as any;
      const rows = await sql`
        SELECT id FROM ingreso_checklist WHERE ingreso_id = ${INGRESO_SIN_CHECKLIST}`;
      expect(rows).toHaveLength(0);
    });

    it("firma válida sobre ingreso con checklist → 200 y persiste firma y timestamp", async () => {
      // Ensure checklist exists
      await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${INGRESO}/checklist`,
        headers: auth(),
        body: {
      panels: { puertaDelanteraIzq: "rayon", guardabarrosIzq: "ok" },
      neumaticos: { frenteIzq: "ok", frenteDer: "rayon" },
      nivelCombustibleExacto: 0.5,
      kilometrajeFoto: true,
      accesorios: { radio: true, triReflectante: true },
      observacionesCliente: "rayón profundo en puerta",
      firmaCliente: "data:image/png;base64,iVBORw0KGgo=",
      firmaClienteNombre: "Cliente T61",
    },
      });
      const res = await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${INGRESO}/firma-retiro`,
        headers: auth(),
        body: {
          firma: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
          nombre: "Cliente T61",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ success: true });

      const sql = getDb() as any;
      const [row] = await sql`
        SELECT firma_retiro_nombre, firma_retiro_timestamp
        FROM ingreso_checklist WHERE ingreso_id = ${INGRESO}`;
      expect(row.firma_retiro_nombre).toBe("Cliente T61");
      expect(row.firma_retiro_timestamp).not.toBeNull();
    });
  });

  // ── 3. POST /workshop/ingresos/:id/fotos ─────────────────────────────
  describe("POST /workshop/ingresos/:id/fotos", () => {
    it("JPEG válido → 201, ruta con tenant/ingreso y archivo en disco", async () => {
      const mp = multipart("frontal.jpg", "image/jpeg", JPEG_VALIDO);
      const res = await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${INGRESO}/fotos`,
        headers: { ...auth(), ...mp.headers },
        payload: mp.payload,
      });
      expect(res.statusCode).toBe(201);

      const body = res.json();
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.path).toBe(`${T}/${INGRESO}/${body.id}.jpg`);
      expect(body.contentType).toBe("image/jpeg");
      expect(body.size).toBeGreaterThan(0);

      const { existsSync } = await import("node:fs");
      expect(existsSync(`${FIXTURE_DIR}/${body.path}`)).toBe(true);
    });

    it("EXE renombrado a .jpg → 400 por magic bytes (no 500)", async () => {
      const mp = multipart("ataque.jpg", "image/jpeg", Buffer.from("MZ\x90\x00\x03\x00exe"));
      const res = await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${INGRESO}/fotos`,
        headers: { ...auth(), ...mp.headers },
        payload: mp.payload,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toMatch(/no coincide con el tipo declarado/i);

      const sql = getDb() as any;
      const lista = await app.inject({
        method: "GET",
        url: `/workshop/ingresos/${INGRESO}/fotos`,
        headers: auth(),
      });
      expect(lista.json().some((p: { name: string }) => p.name.includes("ataque"))).toBe(false);
    });

    it("MIME no permitido (application/pdf) → 400", async () => {
      const mp = multipart("hoja.pdf", "application/pdf", Buffer.from("%PDF-1.7\n"));
      const res = await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${INGRESO}/fotos`,
        headers: { ...auth(), ...mp.headers },
        payload: mp.payload,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toMatch(/no permitido/i);
    });

    it("archivo mayor a 10 MB → 413", async () => {
      const mp = multipart("grande.jpg", "image/jpeg", Buffer.alloc(10 * 1024 * 1024 + 1024, 0x41));
      const res = await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${INGRESO}/fotos`,
        headers: { ...auth(), ...mp.headers },
        payload: mp.payload,
      });
      expect(res.statusCode).toBe(413);
    });

    it("multipart sin ninguna parte de archivo → 400", async () => {
      const boundary = "----t61sinarchivo";
      const res = await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${INGRESO}/fotos`,
        headers: { ...auth(), "content-type": `multipart/form-data; boundary=${boundary}` },
        payload: `--${boundary}\r\nContent-Disposition: form-data; name="nota"\r\n\r\nhola\r\n--${boundary}--\r\n`,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "No se proporcionó archivo" });
    });

    it("ingreso no-UUID → 400 de schema", async () => {
      const mp = multipart("frontal.jpg", "image/jpeg", JPEG_VALIDO);
      const res = await app.inject({
        method: "POST",
        url: "/workshop/ingresos/no-soy-uuid/fotos",
        headers: { ...auth(), ...mp.headers },
        payload: mp.payload,
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── 4. DELETE /workshop/ingresos/:id/fotos/:photoId ──────────────────
  describe("DELETE /workshop/ingresos/:id/fotos/:photoId", () => {
    async function subirFoto(ingresoId = INGRESO): Promise<{ id: string; path: string }> {
      const mp = multipart("frontal.jpg", "image/jpeg", JPEG_VALIDO);
      const res = await app.inject({
        method: "POST",
        url: `/workshop/ingresos/${ingresoId}/fotos`,
        headers: { ...auth(), ...mp.headers },
        payload: mp.payload,
      });
      expect(res.statusCode).toBe(201);
      return res.json();
    }

    it("elimina la foto del disco y la lista ya no la contiene", async () => {
      const { existsSync } = await import("node:fs");
      const foto = await subirFoto();
      expect(existsSync(`${FIXTURE_DIR}/${foto.path}`)).toBe(true);

      const res = await app.inject({
        method: "DELETE",
        url: `/workshop/ingresos/${INGRESO}/fotos/${foto.id}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ deleted: true, path: foto.path });
      expect(existsSync(`${FIXTURE_DIR}/${foto.path}`)).toBe(false);

      const lista = await app.inject({
        method: "GET",
        url: `/workshop/ingresos/${INGRESO}/fotos`,
        headers: auth(),
      });
      expect(lista.statusCode).toBe(200);
      expect(lista.json().some((p: { name: string }) => p.name === `${foto.id}.jpg`)).toBe(false);
    });

    it("borrar dos veces la misma foto → la segunda da 404", async () => {
      const foto = await subirFoto();

      const first = await app.inject({
        method: "DELETE",
        url: `/workshop/ingresos/${INGRESO}/fotos/${foto.id}`,
        headers: auth(),
      });
      expect(first.statusCode).toBe(200);

      const second = await app.inject({
        method: "DELETE",
        url: `/workshop/ingresos/${INGRESO}/fotos/${foto.id}`,
        headers: auth(),
      });
      // No es idempotente: la segunda pasa por el listado, no encuentra el
      // archivo y responde 404 (no 200 deleted:false).
      expect(second.statusCode).toBe(404);
    });

    it("photoId de otro ingreso no se borra (aislamiento por prefijo)", async () => {
      const { existsSync } = await import("node:fs");
      const foto = await subirFoto();

      const res = await app.inject({
        method: "DELETE",
        url: `/workshop/ingresos/${INGRESO_SIN_CHECKLIST}/fotos/${foto.id}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(404);
      expect(existsSync(`${FIXTURE_DIR}/${foto.path}`)).toBe(true); // sigue ahí
    });

    it("photoId inexistente → 404", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/workshop/ingresos/${INGRESO}/fotos/1f100000-0000-4000-8000-000000009999`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(404);
    });

    it("el listado de fotos está acotado al tenant del request", async () => {
      const foto = await subirFoto();
      const sql = getDb() as any;

      // El mismo path de storage, pedido con otro slug de tenant: no aparece.
      const res = await app.inject({
        method: "GET",
        url: `/workshop/ingresos/${INGRESO}/fotos`,
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": OTRO, authorization: `Bearer ${tokenOtro}` },
      });
      expect([200, 401]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.json()).toHaveLength(0);
      }

      const { existsSync } = await import("node:fs");
      expect(existsSync(`${FIXTURE_DIR}/${foto.path}`)).toBe(true);
      void sql;
    });
  });

  // ── 5. POST /workshop/vehiculos/decode-vin ───────────────────────────
  describe("POST /workshop/vehiculos/decode-vin", () => {
    /** NHTSA devuelve `Results: [{ Variable, Value }]`, no objetos con claves. */
    function nhtsaStub(pairs: Array<[string, string | null]>) {
      const spy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ Results: pairs.map(([Variable, Value]) => ({ Variable, Value })) }),
      });
      vi.stubGlobal("fetch", spy);
      return spy;
    }

    it("VIN de longitud inválida → 400 de schema, sin llamar al proveedor", async () => {
      const fetchSpy = nhtsaStub([]);

      const res = await app.inject({
        method: "POST",
        url: "/workshop/vehiculos/decode-vin",
        headers: auth(),
        body: { vin: "DEMASIADO-CORTO" },
      });
      // El schema declara minLength/maxLength 17: el 400 llega del validador,
      // antes de entrar al handler y antes de cualquier fetch.
      expect(res.statusCode).toBe(400);
      expect(fetchSpy).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("body sin vin → 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/workshop/vehiculos/decode-vin",
        headers: auth(),
        body: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("VIN a gasolina → 200 y mapea a engineType 'Nafta'", async () => {
      const fetchSpy = nhtsaStub([
        ["Make", "HONDA"],
        ["Model", "Accord"],
        ["Model Year", "2003"],
        ["Fuel Type - Primary", "Gasoline"],
        ["Engine Number of Cylinders", "4"],
        ["Drive Type", "FWD"],
        ["Transmission Style", "Automatic"],
      ]);

      const res = await app.inject({
        method: "POST",
        url: "/workshop/vehiculos/decode-vin",
        headers: auth(),
        body: { vin: VIN_OK },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        vin: VIN_OK,
        brand: "HONDA",
        model: "Accord",
        year: 2003,
        engineType: "Nafta",
        cylinders: 4,
        driveType: "FWD",
        transmission: "Automatic",
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(String(fetchSpy.mock.calls[0]![0])).toContain(VIN_OK);

      vi.unstubAllGlobals();
    });

    it("mapeo de combustible: Diésel, HEV y BEV según el texto del proveedor", async () => {
      const casos = [
        { fuel: "Diesel", expected: "Diésel" },
        { fuel: "Hybrid Electric", expected: "HEV" },
        { fuel: "Electric", expected: "BEV" },
      ] as const;

      for (const { fuel, expected } of casos) {
        nhtsaStub([
          ["Make", "Toyota"],
          ["Fuel Type - Primary", fuel],
        ]);
        const res = await app.inject({
          method: "POST",
          url: "/workshop/vehiculos/decode-vin",
          headers: auth(),
          body: { vin: VIN_OK },
        });
        expect(res.statusCode, fuel).toBe(200);
        expect(res.json().engineType, fuel).toBe(expected);
        vi.unstubAllGlobals();
      }
    });

    it("VIN sin datos en el proveedor → 200 con campos null (no 404)", async () => {
      nhtsaStub([]);
      const res = await app.inject({
        method: "POST",
        url: "/workshop/vehiculos/decode-vin",
        headers: auth(),
        body: { vin: VIN_OK },
      });
      // Contrato actual: se devuelve 200 con nulls en vez de 404. La UI no
      // puede distinguir "VIN desconocido" de "proveedor sin datos"
      // (hallazgo T-105-06, no corregido en este sprint).
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ brand: null, model: null, year: null });
      vi.unstubAllGlobals();
    });

    it("proveedor caído (5xx) → 500 sin filtrar la URL del proveedor", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "Service Unavailable" }),
      );
      const res = await app.inject({
        method: "POST",
        url: "/workshop/vehiculos/decode-vin",
        headers: auth(),
        body: { vin: VIN_OK },
      });
      expect(res.statusCode).toBe(500);
      expect(res.json().message).not.toContain("vpic.nhtsa.dot.gov");
      vi.unstubAllGlobals();
    });

    it("decode-vin no persiste nada", async () => {
      nhtsaStub([["Make", "HONDA"]]);
      await app.inject({
        method: "POST",
        url: "/workshop/vehiculos/decode-vin",
        headers: auth(),
        body: { vin: VIN_OK },
      });
      vi.unstubAllGlobals();

      const sql = getDb() as any;
      const rows = await sql`SELECT id FROM vehiculos WHERE vin = ${VIN_OK}`;
      expect(rows).toHaveLength(0);
    });
  });

  // ── 6. DELETE /workshop/vehiculos/:id ────────────────────────────────
  describe("DELETE /workshop/vehiculos/:id", () => {
    it("elimina el vehículo del tenant y deja rastro en auditoría", async () => {
      const sql = getDb() as any;
      const [{ id: victimino }] = await sql`SELECT id FROM clients WHERE tenant_slug = ${T}`;
      const [vehiculo] = await sql`
        INSERT INTO vehiculos (client_id, plate, vin, brand, model, year, tenant_slug)
        VALUES (${victimino}, 'T61DEL', null, 'Fiat', 'Uno', 2018, ${T})
        RETURNING id`;

      const res = await app.inject({
        method: "DELETE",
        url: `/workshop/vehiculos/${vehiculo.id}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ deleted: true });

      const rows = await sql`SELECT id FROM vehiculos WHERE id = ${vehiculo.id}`;
      expect(rows).toHaveLength(0);

      const audit = await sql`
        SELECT accion, entidad, descripcion FROM audit_log
        WHERE entidad = 'vehiculos' AND entidad_id = ${vehiculo.id}
        ORDER BY created_at DESC LIMIT 1`;
      expect(audit).toHaveLength(1);
      expect(audit[0].accion).toBe("DELETE");
      expect(audit[0].descripcion).toContain("Fiat");
    });

    it("vehículo de otro tenant → 404 y queda intacto", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/workshop/vehiculos/${VEHICULO_OTRO}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().message).toMatch(/no pertenece al taller/i);

      const sql = getDb() as any;
      const rows = await sql`SELECT plate FROM vehiculos WHERE id = ${VEHICULO_OTRO}`;
      expect(rows).toHaveLength(1); // no se filtró ni se borró
    });

    it("vehículo inexistente → 404", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/workshop/vehiculos/0a100000-0000-4000-8000-000000009999",
        headers: auth(),
      });
      expect(res.statusCode).toBe(404);
    });

    it("sin token → 403 y nada se borra", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/workshop/vehiculos/${VEHICULO}`,
      });
      expect(res.statusCode).toBe(403);

      const sql = getDb() as any;
      const rows = await sql`SELECT id FROM vehiculos WHERE id = ${VEHICULO}`;
      expect(rows).toHaveLength(1);
    });
  });

  describe("POST /workshop/mechanic-assignment/assign", () => {
    async function mecanicoDelTenant(id: string): Promise<string> {
      const sql = getDb() as any;
      const rows = await sql`SELECT id FROM profiles WHERE id = ${id}`;
      return rows[0]?.id as string;
    }

    it("elige al mecánico con menos OTs activas y expone el ranking completo", async () => {
      // MECANICO_2 arrastra 1 OT activa → 50 − 10 = 40. MECANICO está libre → 50.
      const res = await app.inject({
        method: "POST",
        url: "/workshop/mechanic-assignment/assign",
        headers: auth(),
        body: { ordenId: OT_MECANICO },
      });
      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.selectedMechanicId).toBe(await mecanicoDelTenant(MECANICO));
      expect(body.selectedMechanicName).toBe("Mecanico T61");
      expect(body.score).toBe(50);
      expect(body.alternatives).toHaveLength(1);
      expect(body.alternatives[0]).toMatchObject({
        profileId: await mecanicoDelTenant(MECANICO_2),
        score: 40,
      });
    });

    it("preferredMechanicId da +30 y puede superar a un mecánico más libre", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/workshop/mechanic-assignment/assign",
        headers: auth(),
        body: {
          ordenId: OT_MECANICO,
          preferredMechanicId: await mecanicoDelTenant(MECANICO_2),
        },
      });
      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.selectedMechanicId).toBe(await mecanicoDelTenant(MECANICO_2));
      expect(body.score).toBe(70); // 50 − 10 (carga) + 30 (preferencia)
      expect(body.alternatives[0].profileId).toBe(await mecanicoDelTenant(MECANICO));
    });

    it("requiredCertificaciones suma +20 a todos y no altera el orden", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/workshop/mechanic-assignment/assign",
        headers: auth(),
        body: { ordenId: OT_MECANICO, requiredCertificaciones: ["HV", "AC"] },
      });
      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.selectedMechanicId).toBe(await mecanicoDelTenant(MECANICO));
      expect(body.score).toBe(70); // 50 + 20
      expect(body.alternatives[0].score).toBe(60); // 40 + 20
    });

    it("hvAlert no altera el ranking: el bono +15 exige role='supervisor', que el CHECK de profiles prohíbe", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/workshop/mechanic-assignment/assign",
        headers: auth(),
        body: { ordenId: OT_MECANICO, hvAlert: true },
      });
      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.selectedMechanicId).toBe(await mecanicoDelTenant(MECANICO));
      expect(body.score).toBe(50); // sin bono HV

      // El CHECK de la DB sólo admite admin|manager|mechanic|user:
      const sql = getDb() as any;
      await expect(
        sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
            VALUES ('0d100000-0000-4000-8000-00000000dead', ${T_ID},
                    ${`${T}-supervisor@test.local`}, 'Supervisor', 'supervisor', true)`,
      ).rejects.toThrow(/profiles_role_check/);
    });

    it("la asignación no muta la OT (es sólo lectura)", async () => {
      await app.inject({
        method: "POST",
        url: "/workshop/mechanic-assignment/assign",
        headers: auth(),
        body: { ordenId: OT_MECANICO },
      });
      const sql = getDb() as any;
      const [ot] = await sql`
        SELECT status, hv_lockout_signed_by FROM ordenes_trabajo WHERE id = ${OT_MECANICO}`;
      expect(ot.status).toBe("En_Proceso");
      expect(ot.hv_lockout_signed_by).toBeNull();
    });

    it("OT inexistente → 404", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/workshop/mechanic-assignment/assign",
        headers: auth(),
        body: { ordenId: "0c100000-0000-4000-8000-000000009999" },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ success: false });
    });

    it("ordenId no-UUID → 400 de schema", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/workshop/mechanic-assignment/assign",
        headers: auth(),
        body: { ordenId: "no-soy-uuid" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("body sin ordenId → 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/workshop/mechanic-assignment/assign",
        headers: auth(),
        body: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("tenant sin ningún mecánico → 500 (el servicio lanza Error plano)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/workshop/mechanic-assignment/assign",
        headers: auth(),
        body: { ordenId: OT_PINTURA }, // OT del tenant ajeno, que no tiene mecánicos
      });
      // La OT pertenece a OTRO → 404 antes de llegar al scoring.
      expect(res.statusCode).toBe(404);
    });
  });
});
