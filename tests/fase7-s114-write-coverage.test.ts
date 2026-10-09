/**
 * Sprint 114 — Cobertura de escritura del balde T-47 "Conectar a UI" (113).
 *
 * Los 14 endpoints de escritura cableados en Sprint 113 no tenían tests de
 * comportamiento. Este fichero los cubre con el patrón fase7 (tenant propio
 * "e2e-s114", fixtures SQL idempotentes, app.inject con template literals
 * para que el scanner de T-63 cuente la cobertura).
 *
 * Rutas cubiertas:
 *   - POST   /finance/treasury/cuentas
 *   - POST   /finance/treasury/movimientos
 *   - POST   /finance/treasury/facturas-proveedor
 *   - POST   /finance/treasury/facturas-proveedor/:id/pagar
 *   - POST   /finance/presupuestos
 *   - POST   /finance/presupuestos/:id/aprobar
 *   - POST   /finance/contabilidad/asientos
 *   - POST   /finance/contabilidad/grupos
 *   - POST   /finance/contabilidad/grupos/:id/miembros
 *   - DELETE /finance/contabilidad/grupos/:id/miembros/:tenantSlug
 *   - DELETE /finance/contabilidad/grupos/:id
 *   - PATCH  /finance/contabilidad/centros-costo/:id
 *   - DELETE /finance/contabilidad/centros-costo/:id
 *   - POST   /dvi/:inspectionId/photos
 *   - DELETE /dvi/:inspectionId/photos/:photoId
 *
 * @module tests/fase7-s114-write-coverage
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s114";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f114";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f11c";
const ADMIN_EMAIL = "admin@e2e-s114.test";
const PEER_TENANT = "e2e-s114-peer";
const TS = Date.now().toString(36);

let app: FastifyInstance;
let bearer: string;

// IDs de fixtures compartidos entre tests
let clienteId: string;
let vehicleId: string;
let cuentaId: string;
let facturaProvId: string;
let presupuestoId: string;
let presupuestoAprobarId: string;
let grupoId: string;
let centroCostoId: string;
let cuentaDebeId: string;
let cuentaHaberId: string;

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

/** Multipart/form-data armado a mano: app.inject no usa fetch FormData. */
function multipart(filename: string, contentType: string, data: Buffer) {
  const boundary = "----t114writeboundary";
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

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  app = await buildApp();

  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Sprint 114', ${TENANT}, 'tenant_e2e_s114', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 114', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;

  bearer = generateToken({
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: "admin",
    tenantId: TENANT_ID,
    tenantSlug: TENANT,
  });

  // ── Fixture: cliente + vehículo (para aprobar → OT) ──
  clienteId = crypto.randomUUID();
  vehicleId = crypto.randomUUID();
  await sql`
    INSERT INTO clients (id, name, tenant_slug)
    VALUES (${clienteId}, 'Cliente S114', ${TENANT})`;
  await sql`
    INSERT INTO vehiculos (id, client_id, brand, model, engine_type, tenant_slug)
    VALUES (${vehicleId}, ${clienteId}, 'Toyota', 'Corolla', 'Nafta', ${TENANT})`;

  // ── Fixture: plan de cuentas (2 hojas con movimientos) ──
  cuentaDebeId = crypto.randomUUID();
  cuentaHaberId = crypto.randomUUID();
  await sql`
    INSERT INTO plan_cuentas (id, codigo, nombre, tipo, acepta_movimientos)
    VALUES (${cuentaDebeId}, ${`SC${TS}D`}, 'Caja S114', 'ACTIVO', true),
           (${cuentaHaberId}, ${`SC${TS}H`}, 'Ingresos S114', 'INGRESO', true)`;
});

afterAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`DELETE FROM tenant_group_members WHERE group_id IN (SELECT id FROM tenant_groups WHERE owner_tenant_slug = ${TENANT})`;
  await sql`DELETE FROM tenant_groups WHERE owner_tenant_slug = ${TENANT}`;
  await sql`DELETE FROM asientos_detalle WHERE asiento_id IN (SELECT id FROM asientos_contables WHERE concepto LIKE ${`S114-${TS}%`})`;
  await sql`DELETE FROM asientos_contables WHERE concepto LIKE ${`S114-${TS}%`}`;
  await sql`DELETE FROM presupuestos WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM ordenes_trabajo WHERE tenant_slug = ${TENANT} AND description LIKE ${`%S114%`}`;
  await sql`DELETE FROM centros_costo WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM movimientos_tesoreria WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM facturas_proveedor WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM cuentas_bancarias WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM plan_cuentas WHERE id IN (${cuentaDebeId}, ${cuentaHaberId})`;
  await sql`DELETE FROM vehiculos WHERE id = ${vehicleId}`;
  await sql`DELETE FROM clients WHERE id = ${clienteId}`;
  await app?.close();
});

// ─── Treasury ─────────────────────────────────────────────

describe("Sprint 114 · Treasury escritura", () => {
  it("POST /finance/treasury/cuentas crea cuenta y devuelve 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/treasury/cuentas`,
      headers: auth(),
      payload: {
        codigo: `TB${TS}`.slice(0, 20),
        nombre: "Cuenta S114",
        tipo: "CTA_CTE",
        saldoInicial: "1000000",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.tenantSlug).toBe(TENANT);
    expect(body.saldoActual).toBe("1000000");
    cuentaId = pickId(body, "cuenta");
  });

  it("POST /finance/treasury/cuentas devuelve 409 si código duplicado", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/treasury/cuentas`,
      headers: auth(),
      payload: {
        codigo: `TB${TS}`.slice(0, 20),
        nombre: "Duplicada",
        tipo: "CTA_CTE",
        saldoInicial: "0",
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it("POST /finance/treasury/movimientos registra INGRESO y recalcula saldo", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/treasury/movimientos`,
      headers: auth(),
      payload: {
        tipo: "INGRESO",
        medioPago: "TRANSFERENCIA",
        cuentaId,
        monto: "500000",
        concepto: "Ingreso S114",
        fecha: new Date().toISOString(),
      },
    });
    // Route returns 201 on success
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeTruthy();

    // Saldo = saldoInicial + ingreso
    const [cuenta] = await q`
      SELECT saldo_actual FROM cuentas_bancarias WHERE id = ${cuentaId}`;
    expect(parseFloat(cuenta.saldo_actual)).toBe(1500000);
  });

  it("POST /finance/treasury/movimientos devuelve 404 si cuenta inexistente", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/treasury/movimientos`,
      headers: auth(),
      payload: {
        tipo: "INGRESO",
        medioPago: "EFECTIVO",
        cuentaId: crypto.randomUUID(),
        monto: "1000",
        concepto: "Sin cuenta",
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /finance/treasury/facturas-proveedor crea factura PENDIENTE", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/treasury/facturas-proveedor`,
      headers: auth(),
      payload: {
        nroFactura: `FC-${TS}`,
        total: "200000",
        fechaEmision: new Date().toISOString(),
        fechaVencimiento: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.estadoPago).toBe("PENDIENTE");
    expect(body.saldoPendiente).toBe("200000");
    facturaProvId = pickId(body, "factura-proveedor");
  });

  it("POST /finance/treasury/facturas-proveedor/:id/pagar paga total y crea EGRESO", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/treasury/facturas-proveedor/${facturaProvId}/pagar`,
      headers: auth(),
      payload: {
        monto: 200000,
        medioPago: "TRANSFERENCIA",
        cuentaId,
        concepto: "Pago total S114",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.nuevoEstado).toBe("PAGA");

    // Saldo bajó: 1.500.000 - 200.000
    const [cuenta] = await q`
      SELECT saldo_actual FROM cuentas_bancarias WHERE id = ${cuentaId}`;
    expect(parseFloat(cuenta.saldo_actual)).toBe(1300000);
  });

  it("POST /finance/treasury/facturas-proveedor/:id/pagar devuelve 400 sin campos requeridos", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/treasury/facturas-proveedor/${facturaProvId}/pagar`,
      headers: auth(),
      payload: { monto: 100 },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Presupuestos ─────────────────────────────────────────

describe("Sprint 114 · Presupuestos escritura", () => {
  it("POST /finance/presupuestos crea presupuesto en borrador", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/presupuestos`,
      headers: auth(),
      payload: { periodo: `2045-${TS.slice(-2)}`, descripcion: "Presupuesto S114" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.estado).toBe("borrador");
    presupuestoId = pickId(body, "presupuesto");
  });

  it("POST /finance/presupuestos devuelve 409 si período duplicado", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/presupuestos`,
      headers: auth(),
      payload: { periodo: `2045-${TS.slice(-2)}`, descripcion: "Duplicado" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("POST /finance/presupuestos/:id/aprobar APROBAR convierte a OT (201)", async () => {
    // Crear presupuesto con cliente+vehículo para poder aprobarlo
    const create = await app.inject({
      method: "POST",
      url: `/finance/presupuestos`,
      headers: auth(),
      payload: { periodo: `2046-${TS.slice(-2)}`, descripcion: "Para aprobar S114" },
    });
    presupuestoAprobarId = pickId(create.json(), "presupuesto-aprobar");
    await q`
      UPDATE presupuestos
      SET cliente_id = ${clienteId}, vehicle_id = ${vehicleId}
      WHERE id = ${presupuestoAprobarId}`;

    const res = await app.inject({
      method: "POST",
      url: `/finance/presupuestos/${presupuestoAprobarId}/aprobar`,
      headers: auth(),
      payload: { accion: "APROBAR", metodoAprobacion: "PRESENCIAL" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.ordenTrabajoId).toBeTruthy();

    // Presupuesto quedó ligado a la OT
    const [p] = await q`
      SELECT orden_trabajo_id, estado FROM presupuestos WHERE id = ${presupuestoAprobarId}`;
    expect(p.orden_trabajo_id).toBe(body.ordenTrabajoId);
  });

  it("POST /finance/presupuestos/:id/aprobar APROBAR sin cliente/vehículo devuelve error", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/presupuestos/${presupuestoId}/aprobar`,
      headers: auth(),
      payload: { accion: "APROBAR" },
    });
    // ValidationError → 422 (error-handler mapping)
    expect(res.statusCode).toBe(422);
  });

  it("POST /finance/presupuestos/:id/aprobar RECHAZAR cierra el presupuesto", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/presupuestos/${presupuestoId}/aprobar`,
      headers: auth(),
      payload: { accion: "RECHAZAR" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.estado).toBe("RECHAZADO");

    const [p] = await q`
      SELECT estado FROM presupuestos WHERE id = ${presupuestoId}`;
    expect(p.estado).toBe("cerrado");
  });
});

// ─── Contabilidad ─────────────────────────────────────────

describe("Sprint 114 · Contabilidad escritura", () => {
  it("POST /finance/contabilidad/asientos crea asiento balanceado (201)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/contabilidad/asientos`,
      headers: auth(),
      payload: {
        fecha: new Date().toISOString(),
        concepto: `S114-${TS} asiento test`,
        lineas: [
          { cuentaId: cuentaDebeId, debe: "100000", descripcion: "Caja" },
          { cuentaId: cuentaHaberId, haber: "100000", descripcion: "Ingresos" },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.asiento.totalDebe).toBe("100000.00");
    expect(body.asiento.totalHaber).toBe("100000.00");
    expect(body.lineas).toHaveLength(2);
  });

  it("POST /finance/contabilidad/asientos devuelve 422 si no balancea", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/contabilidad/asientos`,
      headers: auth(),
      payload: {
        fecha: new Date().toISOString(),
        concepto: `S114-${TS} desbalanceado`,
        lineas: [
          { cuentaId: cuentaDebeId, debe: "100000" },
          { cuentaId: cuentaHaberId, haber: "50000" },
        ],
      },
    });
    expect(res.statusCode).toBe(422);
  });

  it("POST /finance/contabilidad/asientos devuelve 400 con menos de 2 líneas (schema)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/contabilidad/asientos`,
      headers: auth(),
      payload: {
        fecha: new Date().toISOString(),
        concepto: `S114-${TS} una línea`,
        lineas: [{ cuentaId: cuentaDebeId, debe: "100" }],
      },
    });
    // Fastify schema minItems: 2 → 400 antes de llegar al servicio
    expect(res.statusCode).toBe(400);
  });

  it("POST /finance/contabilidad/grupos crea grupo con OWNER auto-agregado", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/contabilidad/grupos`,
      headers: auth(),
      payload: { name: `Grupo S114 ${TS}`, description: "Consolidación test" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.ownerTenantSlug).toBe(TENANT);
    expect(body.isActive).toBe(true);
    grupoId = body.id;

    // OWNER auto-insertado
    const members = await q`
      SELECT tenant_slug, role_in_group FROM tenant_group_members
      WHERE group_id = ${grupoId} AND is_active = TRUE`;
    expect(members).toHaveLength(1);
    expect(members[0].tenant_slug).toBe(TENANT);
    expect(members[0].role_in_group).toBe("OWNER");
  });

  it("POST /finance/contabilidad/grupos devuelve 400 sin name", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/contabilidad/grupos`,
      headers: auth(),
      payload: { description: "sin nombre" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /finance/contabilidad/grupos/:id/miembros agrega peer (201)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/contabilidad/grupos/${grupoId}/miembros`,
      headers: auth(),
      payload: { tenantSlug: PEER_TENANT, roleInGroup: "MEMBER" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.tenantSlug).toBe(PEER_TENANT);
    expect(body.roleInGroup).toBe("MEMBER");
  });

  it("POST /finance/contabilidad/grupos/:id/miembros devuelve 404 si grupo inactivo", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/finance/contabilidad/grupos/${crypto.randomUUID()}/miembros`,
      headers: auth(),
      payload: { tenantSlug: PEER_TENANT },
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE /finance/contabilidad/grupos/:id/miembros/:tenantSlug remueve peer (204)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/finance/contabilidad/grupos/${grupoId}/miembros/${PEER_TENANT}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(204);

    const [member] = await q`
      SELECT is_active FROM tenant_group_members
      WHERE group_id = ${grupoId} AND tenant_slug = ${PEER_TENANT}`;
    expect(member.is_active).toBe(false);
  });

  it("DELETE /finance/contabilidad/grupos/:id/miembros/:tenantSlug devuelve 404 si no existe", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/finance/contabilidad/grupos/${grupoId}/miembros/${crypto.randomUUID()}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE /finance/contabilidad/grupos/:id desactiva grupo (204)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/finance/contabilidad/grupos/${grupoId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(204);

    const [g] = await q`
      SELECT is_active FROM tenant_groups WHERE id = ${grupoId}`;
    expect(g.is_active).toBe(false);
  });

  it("DELETE /finance/contabilidad/grupos/:id devuelve 404 si ya inactivo", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/finance/contabilidad/grupos/${grupoId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
  });

  it("PATCH /finance/contabilidad/centros-costo/:id actualiza nombre", async () => {
    // Crear vía fixture SQL (POST requiere revisar preHandler admin)
    centroCostoId = crypto.randomUUID();
    await q`
      INSERT INTO centros_costo (id, codigo, nombre, tenant_slug)
      VALUES (${centroCostoId}, ${`CC${TS}`}, 'Taller S114', ${TENANT})`;

    const res = await app.inject({
      method: "PATCH",
      url: `/finance/contabilidad/centros-costo/${centroCostoId}`,
      headers: auth(),
      payload: { nombre: "Taller S114 Renombrado", descripcion: "Actualizado en S114" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.nombre).toBe("Taller S114 Renombrado");

    const [cc] = await q`
      SELECT nombre, descripcion FROM centros_costo WHERE id = ${centroCostoId}`;
    expect(cc.nombre).toBe("Taller S114 Renombrado");
  });

  it("PATCH /finance/contabilidad/centros-costo/:id devuelve 404 si no existe", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/finance/contabilidad/centros-costo/${crypto.randomUUID()}`,
      headers: auth(),
      payload: { nombre: "Ghost" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE /finance/contabilidad/centros-costo/:id desactiva (soft delete, 204)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/finance/contabilidad/centros-costo/${centroCostoId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(204);

    const [cc] = await q`
      SELECT activo FROM centros_costo WHERE id = ${centroCostoId}`;
    expect(cc.activo).toBe(false);
  });
});

// ─── DVI Photos ───────────────────────────────────────────

describe("Sprint 114 · DVI photos escritura", () => {
  let photoId: string;
  // Cualquier UUID sirve: upload no valida existencia de la inspección en DB
  const inspectionId = crypto.randomUUID();

  it("POST /dvi/:inspectionId/photos sube JPEG válido (201)", async () => {
    const mp = multipart("frontal.jpg", "image/jpeg", JPEG_VALIDO);
    const res = await app.inject({
      method: "POST",
      url: `/dvi/${inspectionId}/photos`,
      headers: { ...auth(), ...mp.headers },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeTruthy();
    expect(body.contentType).toBe("image/jpeg");
    expect(body.path).toContain(inspectionId);
    photoId = body.id;
  });

  it("POST /dvi/:inspectionId/photos devuelve 406 sin multipart", async () => {
    // Sin Content-Type multipart, el parser rechaza con 406 Not Acceptable
    const res = await app.inject({
      method: "POST",
      url: `/dvi/${inspectionId}/photos`,
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(406);
  });

  it("POST /dvi/:inspectionId/photos rechaza MIME spoofing (magic bytes)", async () => {
    const fake = Buffer.from("MZ\x90\x00\x03\x00exe malware content padding!");
    const mp = multipart("malware.jpg", "image/jpeg", fake);
    const res = await app.inject({
      method: "POST",
      url: `/dvi/${inspectionId}/photos`,
      headers: { ...auth(), ...mp.headers },
      payload: mp.payload,
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("GET /dvi/:inspectionId/photos lista la foto subida", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/dvi/${inspectionId}/photos`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const photos = res.json();
    expect(Array.isArray(photos)).toBe(true);
    expect(photos.length).toBeGreaterThanOrEqual(1);
    expect(photos.some((p: any) => p.name.includes(photoId))).toBe(true);
  });

  it("DELETE /dvi/:inspectionId/photos/:photoId elimina la foto (bugfix extensión)", async () => {
    // Regresión: el handler construía la ruta SIN extensión
    // ({tenant}/{inspection}/{photoId}) pero upload guarda {photoId}.jpg
    // → ENOENT → 500. Fix: resolver el archivo real por prefijo photoId.
    const res = await app.inject({
      method: "DELETE",
      url: `/dvi/${inspectionId}/photos/${photoId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deleted).toBe(true);

    // Ya no aparece en el listado
    const list = await app.inject({
      method: "GET",
      url: `/dvi/${inspectionId}/photos`,
      headers: auth(),
    });
    const photos = list.json();
    expect(photos.some((p: any) => p.name.includes(photoId))).toBe(false);
  });

  it("DELETE /dvi/:inspectionId/photos/:photoId devuelve 404 si no existe", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/dvi/${inspectionId}/photos/${crypto.randomUUID()}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
  });
});
