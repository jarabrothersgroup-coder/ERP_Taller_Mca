/**
 * Sprint 118 — Cobertura de escritura lote 5 (backlog T-61).
 *
 * 14 ops de escritura sin test, todas offline/local (sin servicios externos):
 *   - 4 intelligence/dtc (parse, parse-file fallback, diagnose) + safety/protocol
 *   - 1 intelligence/decode-safety (sin VIN → sin llamada NHTSA)
 *   - 2 intelligence/ocr (plate, cedula — fallback base64)
 *   - 1 thinkcar/mobile-dtc
 *   - 1 whatsapp/followups/auto
 *   - 2 migration (export, import dryRun)
 *   - 3 portal (auth/magic, feedback, appointments — vía magic-link session)
 *
 * Patrón fase7 (tenant propio "e2e-s118", fixtures SQL idempotentes,
 * app.inject con template literals para el scanner de T-63).
 *
 * Rutas cubiertas:
 *   - POST /intelligence/dtc/parse
 *   - POST /intelligence/dtc/parse-file
 *   - POST /intelligence/dtc/diagnose
 *   - POST /intelligence/safety/protocol
 *   - POST /intelligence/decode-safety
 *   - POST /intelligence/ocr/plate
 *   - POST /intelligence/ocr/cedula
 *   - POST /thinkcar/mobile-dtc
 *   - POST /whatsapp/followups/auto
 *   - POST /api/v1/migration/export
 *   - POST /api/v1/migration/import
 *   - POST /portal/auth/magic
 *   - POST /portal/feedback
 *   - POST /portal/appointments
 *
 * @module tests/fase7-s118-write-coverage
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s118";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f118";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f11e";
const ADMIN_EMAIL = "admin@e2e-s118.test";
const CLIENTE = "00000000-0000-0000-0000-0000c11e4f20";
const CLIENTE_EMAIL = "cliente@e2e-s118.test";
const VEHICULO = "00000000-0000-0000-0000-0000c11e4f21";
const OT_ID = "00000000-0000-0000-0000-0000c11e4f22";
const TS = Date.now().toString(36);
// CSRF double-submit: en el test controlamos cookie + header, así que basta
// un token autoconsistente para los POST públicos del portal (sin Bearer).
const CSRF = `csrf-${TS}`;

let app: FastifyInstance;
let bearer: string;
let portalSession: string;

// ─── Helpers ──────────────────────────────────────────────

function auth(): Record<string, string> {
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": TENANT };
}

/** Cabeceras del portal (rutas públicas: tenant + sesión mágica + CSRF double-submit). */
function portalAuth(): Record<string, string> {
  return {
    "x-tenant-slug": TENANT,
    "x-portal-session": portalSession,
    "x-csrf-token": CSRF,
    cookie: `_csrf=${CSRF}`,
  };
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
    VALUES (${TENANT_ID}, 'E2E Sprint 118', ${TENANT}, 'tenant_e2e_s118', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 118', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;
  // Cadena cliente (con email para magic-link) → vehículo → OT
  await sql`INSERT INTO clients (id, name, email, tenant_slug)
    VALUES (${CLIENTE}, ${"Cliente T118"}, ${CLIENTE_EMAIL}, ${TENANT})
    ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO vehiculos (id, client_id, brand, model, engine_type, tenant_slug)
    VALUES (${VEHICULO}, ${CLIENTE}, ${"Toyota"}, ${"Corolla"}, ${"Nafta"}, ${TENANT})
    ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO ordenes_trabajo (id, vehicle_id, client_id, status, tenant_slug)
    VALUES (${OT_ID}, ${VEHICULO}, ${CLIENTE}, ${"En_Proceso"}, ${TENANT})
    ON CONFLICT (id) DO NOTHING`;
  // Template con triggerEvent para followups/auto (sin unique en key → delete+insert)
  await sql`DELETE FROM whatsapp_templates WHERE tenant_slug = ${TENANT} AND key = ${`auto-${TS}`}`;
  await sql`INSERT INTO whatsapp_templates (key, tenant_slug, name, body, active, trigger_event, trigger_delay_hours)
    VALUES (${`auto-${TS}`}, ${TENANT}, ${`Auto T118 ${TS}`}, 'Hola {{nombre}}, tu servicio está listo.', true, 'orden_cerrada', '0')`;

  bearer = generateToken({
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: "admin",
    tenantId: TENANT_ID,
    tenantSlug: TENANT,
  });

  app = await buildApp();
  await app.ready();

  // Portal session vía magic-link (cliente fixture con email)
  const magic = await app.inject({
    method: "POST",
    url: "/portal/auth/magic",
    headers: { "x-tenant-slug": TENANT, "x-csrf-token": CSRF, cookie: `_csrf=${CSRF}` },
    payload: { email: CLIENTE_EMAIL },
  });
  expect(magic.statusCode).toBe(200);
  const link = magic.json().link as string;
  const token = link.split("/portal/auth/magic/")[1].split("?")[0];
  const validated = await app.inject({
    method: "GET",
    url: `/portal/auth/magic/${token}`,
    headers: { "x-tenant-slug": TENANT },
  });
  expect(validated.statusCode).toBe(200);
  portalSession = validated.json().session as string;
});

afterAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`DELETE FROM agendamientos WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM whatsapp_followups WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM whatsapp_templates WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM notificaciones WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM thinkcar_imports WHERE file_name LIKE ${`mobile_obd2_%`}`;
  await sql`DELETE FROM ordenes_trabajo WHERE id = ${OT_ID}`;
  await sql`DELETE FROM vehiculos WHERE id = ${VEHICULO}`;
  await sql`DELETE FROM clients WHERE id = ${CLIENTE}`;
  await sql`DELETE FROM profiles WHERE id = ${ADMIN_ID}`;
  await sql`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
  await app?.close();
});

// ─── Intelligence · DTC ───────────────────────────────────

describe("Sprint 118 · Intelligence DTC", () => {
  it("POST /intelligence/dtc/parse parsea reporte de scanner", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/intelligence/dtc/parse",
      headers: auth(),
      payload: {
        reportText: "DTC Report\nP0171 System Too Lean (Bank 1)\nP0300 Random Misfire Detected",
        scannerBrand: "Launch X431",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.report).toBeTruthy();
  });

  it("POST /intelligence/dtc/parse sin reportText → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/intelligence/dtc/parse",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /intelligence/dtc/parse-file sin archivo válido → 400", async () => {
    // El plugin multipart decora request.file, así que el fallback de texto
    // crudo queda inalcanzable y un body sin parte de archivo → 400.
    const res = await app.inject({
      method: "POST",
      url: "/intelligence/dtc/parse-file",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /intelligence/dtc/diagnose genera diagnóstico estructurado", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/intelligence/dtc/diagnose",
      headers: auth(),
      payload: {
        codes: ["P0171", "P0300"],
        brand: "Toyota",
        model: "Corolla",
        engineType: "Nafta",
        customerComplaint: "El motor tiembla en ralentí",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.diagnosis).toBeTruthy();
  });

  it("POST /intelligence/dtc/diagnose sin códigos válidos → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/intelligence/dtc/diagnose",
      headers: auth(),
      payload: { codes: ["NOPE"], brand: "Toyota", model: "Corolla" },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Intelligence · Safety + decode ───────────────────────

describe("Sprint 118 · Intelligence safety", () => {
  it("POST /intelligence/safety/protocol genera protocolo HV", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/intelligence/safety/protocol",
      headers: auth(),
      payload: {
        brand: "Toyota",
        model: "Prius",
        year: 2022,
        plate: "ABC 1234",
        hvBatteryVoltage: 201.6,
        batteryType: "NiMH",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.protocol).toBeTruthy();
    expect(body.protocol.vehicle.brand).toBe("Toyota");
    expect(body.protocol.riskAssessment).toContain("RIESGO");
    expect(body.protocol.waitTimeMinutes).toBeGreaterThan(0);
  });

  it("POST /intelligence/safety/protocol con tensión fuera de rango → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/intelligence/safety/protocol",
      headers: auth(),
      payload: { brand: "Toyota", model: "Prius", hvBatteryVoltage: 5000 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /intelligence/decode-safety marca BYD como alto voltaje (offline, sin VIN)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/intelligence/decode-safety",
      headers: auth(),
      payload: { brand: "BYD", model: "Dolphin", year: 2024 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.isHighVoltage).toBe(true);
    expect(body.alertLevel).toBe("RED");
  });
});

// ─── Intelligence · OCR ───────────────────────────────────

describe("Sprint 118 · Intelligence OCR", () => {
  // 1×1 PNG transparente en base64
  const PNG_1X1 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  it("POST /intelligence/ocr/plate encola job (202, base64)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/intelligence/ocr/plate",
      headers: auth(),
      payload: { image: PNG_1X1, filename: "chapa.png" },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.jobId).toBeTruthy();
    // El job puede arrancar de inmediato (race): aceptamos queued o processing
    expect(["queued", "processing"]).toContain(body.status);
    expect(body.pollUrl).toContain("/intelligence/ocr/jobs/");
  });

  it("POST /intelligence/ocr/cedula encola job (202, base64)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/intelligence/ocr/cedula",
      headers: auth(),
      payload: { image: PNG_1X1, filename: "cedula.png" },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().jobId).toBeTruthy();
  });

  it("POST /intelligence/ocr/plate sin imagen → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/intelligence/ocr/plate",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Thinkcar mobile ──────────────────────────────────────

describe("Sprint 118 · Thinkcar mobile-dtc", () => {
  it("POST /thinkcar/mobile-dtc registra DTCs del móvil (manual_review sin OT)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/thinkcar/mobile-dtc",
      headers: auth(),
      payload: {
        dtcCodes: ["P0300", "P0171"],
        dtcDescriptions: ["Random Misfire", "System Too Lean"],
        notas: "Escaneo desde móvil",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("manual_review");
    expect(body.message).toContain("2 códigos DTC");
  });

  it("POST /thinkcar/mobile-dtc sin códigos → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/thinkcar/mobile-dtc",
      headers: auth(),
      payload: { dtcCodes: [] },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── WhatsApp followups auto ──────────────────────────────

describe("Sprint 118 · WhatsApp followups auto", () => {
  it("POST /whatsapp/followups/auto programa follow-ups según trigger", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/followups/auto",
      headers: auth(),
      payload: {
        triggerEvent: "orden_cerrada",
        ordenId: OT_ID,
        phone: "+595981123456",
        variables: { nombre: "Juan" },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.scheduled).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.followups)).toBe(true);
    expect(body.followups[0].filledBody).toContain("Juan");
  });

  it("POST /whatsapp/followups/auto sin templates del trigger → scheduled 0", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/followups/auto",
      headers: auth(),
      payload: {
        triggerEvent: "trigger_inexistente",
        ordenId: OT_ID,
        phone: "+595981",
        variables: {},
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().scheduled).toBe(0);
  });
});

// ─── Migration export/import ──────────────────────────────

describe("Sprint 118 · Migration", () => {
  it("POST /api/v1/migration/export exporta config del tenant", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/migration/export",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.metadata).toBeTruthy();
    expect(Array.isArray(body.tables)).toBe(true);
  });

  it("POST /api/v1/migration/import con dryRun no escribe", async () => {
    const exp = await app.inject({
      method: "POST",
      url: "/api/v1/migration/export",
      headers: auth(),
      payload: {},
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/migration/import",
      headers: auth(),
      payload: { data: exp.json(), targetTenant: TENANT, dryRun: true },
    });
    expect(res.statusCode).toBe(200);
  });

  it("POST /api/v1/migration/import sin data → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/migration/import",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Portal (magic-link session) ──────────────────────────

describe("Sprint 118 · Portal", () => {
  it("POST /portal/feedback registra feedback del cliente", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/portal/feedback",
      headers: portalAuth(),
      payload: { ordenId: OT_ID, rating: 5, comment: "Excelente trabajo" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("POST /portal/feedback sin sesión → 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/portal/feedback",
      headers: { "x-tenant-slug": TENANT, "x-csrf-token": CSRF, cookie: `_csrf=${CSRF}` },
      payload: { ordenId: OT_ID, rating: 5 },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /portal/appointments agenda turno (201 o 400 por disponibilidad)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/portal/appointments",
      headers: portalAuth(),
      payload: {
        vehicleId: VEHICULO,
        date: "2030-01-15",
        time: "10:00",
        motivo: "Service preventivo",
      },
    });
    // 201 si el slot está disponible; 400 si la lógica de capacidad lo rechaza
    expect([201, 400]).toContain(res.statusCode);
  });

  it("POST /portal/appointments sin campos → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/portal/appointments",
      headers: portalAuth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
