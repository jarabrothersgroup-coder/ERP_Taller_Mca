/**
 * Sprint 119 — Cobertura de escritura lote 6 (backlog T-61).
 *
 * 22 ops de escritura sin test (las 5 sifen externas quedan fuera, igual que
 * el lote anterior). Todas offline/local o con error-path determinista:
 *
 *   - api-keys: create + list (201/200, DB local)
 *   - config: upload-logo (400 sin archivo / MIME inválido)
 *   - migration: import/file (400 sin archivo / JSON inválido; 200 con export vacío)
 *   - email: send, send-invoice, send-estimate, send-reminder (dev-mode 200)
 *   - email/billing: subscription-activated, payment-failed,
 *     subscription-cancelled, trial-ending (dev-mode 200)
 *   - sso: discover / authorize / logout (400 validación) + validate-domain (200)
 *   - whatsapp: instance/create, disconnect, queue/process, send
 *   - portal: invoices/:id/pay (400 factura inexistente / 401 sin sesión)
 *   - thinkcar: ingest/usb (binario aft-mtp-mount ausente → 500)
 *   - intelligence/manuals/ingest (400 sin archivo)
 *
 * Patrón fase7 (tenant propio "e2e-s119", fixtures SQL idempotentes,
 * app.inject con template literals para el scanner de T-63).
 *
 * @module tests/fase7-s119-write-coverage
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s119";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f119";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f2e1";
const ADMIN_EMAIL = "admin@e2e-s119.test";
const CLIENTE = "00000000-0000-0000-0000-0000c11e4f30";
const CLIENTE_EMAIL = "cliente@e2e-s119.test";
const CLIENTE_PHONE = "+595981123456";
const VEHICULO = "00000000-0000-0000-0000-0000c11e4f31";
const OT_ID = "00000000-0000-0000-0000-0000c11e4f32";
const FAKE_FACTURA = "00000000-0000-0000-0000-0000deadbeef";
const TS = Date.now().toString(36);
// CSRF double-submit: controlamos cookie + header, basta un token autoconsistente.
const CSRF = `csrf-${TS}`;

let app: FastifyInstance;
let bearer: string;
let portalSession: string;

// ─── Helpers ──────────────────────────────────────────────

function auth(): Record<string, string> {
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": TENANT };
}

/** Cabeceras del portal (rutas públicas: tenant + sesión mágica + CSRF). */
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

/**
 * Construye un body multipart/form-data crudo (string): app.inject no usa
 * fetch FormData y un payload Buffer no matchea el content-type parser.
 */
function multipartBody(
  parts: Array<{ name: string; filename?: string; contentType?: string; value: string }>,
): { payload: string; contentType: string } {
  const boundary = `----s119boundary${TS}`;
  let body = "";
  for (const p of parts) {
    body += `--${boundary}\r\n`;
    body += p.filename
      ? `Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\n`
      : `Content-Disposition: form-data; name="${p.name}"\r\n`;
    if (p.contentType) body += `Content-Type: ${p.contentType}\r\n`;
    body += `\r\n${p.value}\r\n`;
  }
  body += `--${boundary}--\r\n`;
  return { payload: body, contentType: `multipart/form-data; boundary=${boundary}` };
}

/** Multipart con una única parte de archivo. */
function multipartFile(
  field: string,
  filename: string,
  contentType: string,
  content: string,
): { payload: string; contentType: string } {
  return multipartBody([{ name: field, filename, contentType, value: content }]);
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  // Entorno determinista para los emails: sin Resend ni SMTP el servicio cae en
  // "dev mode" (200 con messageId). NODE_ENV=test evita el branch production.
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("SMTP_USER", "");
  vi.stubEnv("SMTP_PASS", "");

  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Sprint 119', ${TENANT}, 'tenant_e2e_s119', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 119', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;
  await sql`INSERT INTO clients (id, name, email, phone, tenant_slug)
    VALUES (${CLIENTE}, ${"Cliente T119"}, ${CLIENTE_EMAIL}, ${CLIENTE_PHONE}, ${TENANT})
    ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO vehiculos (id, client_id, brand, model, plate, engine_type, tenant_slug)
    VALUES (${VEHICULO}, ${CLIENTE}, ${"Toyota"}, ${"Corolla"}, ${"ABC119"}, ${"Nafta"}, ${TENANT})
    ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO ordenes_trabajo (id, vehicle_id, client_id, status, tenant_slug)
    VALUES (${OT_ID}, ${VEHICULO}, ${CLIENTE}, ${"En_Proceso"}, ${TENANT})
    ON CONFLICT (id) DO NOTHING`;

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

  await sql`DELETE FROM api_keys WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM email_log WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM whatsapp_messages WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM ordenes_trabajo WHERE id = ${OT_ID}`;
  await sql`DELETE FROM vehiculos WHERE id = ${VEHICULO}`;
  await sql`DELETE FROM clients WHERE id = ${CLIENTE}`;
  await sql`DELETE FROM profiles WHERE id = ${ADMIN_ID}`;
  await sql`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
  await app?.close();
  vi.unstubAllEnvs();
});

// ─── API Keys ─────────────────────────────────────────────

describe("Sprint 119 · API Keys", () => {
  it("POST /api-keys/ crea una API key (201, key cruda una vez)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api-keys/",
      headers: auth(),
      payload: { name: `key-${TS}`, scopes: ["read:workshop"], rateLimit: 60 },
    });
    expect(res.statusCode, res.body).toBe(201);
    const body = res.json();
    expect(body.apiKey).toBeTruthy();
    expect(body.id).toBeTruthy();
    expect(body.name).toBe(`key-${TS}`);
  });

  it("POST /api-keys/ con scope inválido → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api-keys/",
      headers: auth(),
      payload: { name: `bad-${TS}`, scopes: ["no-existe"] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /api-keys/ lista las keys del tenant (200)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api-keys/",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().keys ?? res.json().items ?? res.json())).toBe(true);
  });
});

// ─── Config · upload-logo ─────────────────────────────────

describe("Sprint 119 · Config upload-logo", () => {
  it("POST /api/config/upload-logo sin archivo → 400", async () => {
    // Multipart sin parte de archivo: request.file() → undefined → BadRequestError.
    const mp = multipartBody([{ name: "nota", value: "sin archivo" }]);
    const res = await app.inject({
      method: "POST",
      url: "/api/config/upload-logo",
      headers: { ...auth(), "content-type": mp.contentType },
      payload: mp.payload,
    });
    expect(res.statusCode, res.body).toBe(400);
  });

  it("POST /api/config/upload-logo con MIME no permitido → 400", async () => {
    const mp = multipartFile("file", "nota.txt", "text/plain", "hola");
    const res = await app.inject({
      method: "POST",
      url: "/api/config/upload-logo",
      headers: { ...auth(), "content-type": mp.contentType },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Migration · import/file ──────────────────────────────

describe("Sprint 119 · Migration import/file", () => {
  it("POST /api/v1/migration/import/file sin archivo → 400", async () => {
    const mp = multipartBody([{ name: "nota", value: "sin archivo" }]);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/migration/import/file",
      headers: { ...auth(), "content-type": mp.contentType },
      payload: mp.payload,
    });
    expect(res.statusCode, res.body).toBe(400);
  });

  it("POST /api/v1/migration/import/file con JSON inválido → 400", async () => {
    const mp = multipartFile("file", "export.json", "application/json", "{no-json");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/migration/import/file",
      headers: { ...auth(), "content-type": mp.contentType },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/v1/migration/import/file con export vacío → 200", async () => {
    const exportData = { metadata: { version: 1 }, tables: [] };
    const mp = multipartFile(
      "file",
      "export.json",
      "application/json",
      JSON.stringify(exportData),
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/migration/import/file",
      headers: { ...auth(), "content-type": mp.contentType },
      payload: mp.payload,
    });
    expect(res.statusCode, res.body).toBe(200);
  });
});

// ─── Email transaccional ──────────────────────────────────

describe("Sprint 119 · Email", () => {
  it("POST /email/send envía en dev-mode (200)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/email/send",
      headers: auth(),
      payload: { to: "dest@e2e-s119.test", subject: "Hola", html: "<p>hola</p>" },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().messageId).toBeTruthy();
  });

  it("POST /email/send sin campos requeridos → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/email/send",
      headers: auth(),
      payload: { subject: "x" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /email/send-invoice envía factura (200)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/email/send-invoice",
      headers: auth(),
      payload: {
        to: "dest@e2e-s119.test",
        data: {
          numeroFactura: "001-001-0000001",
          cliente: "Cliente T119",
          ruc: "80012345-6",
          total: "150000",
          fechaEmision: "2030-01-01",
          fechaVencimiento: "2030-01-15",
          estado: "Pagada",
          lineaItems: [
            { descripcion: "Service completo", cantidad: 1, precio: "150000", total: "150000" },
          ],
        },
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().messageId).toBeTruthy();
  });

  it("POST /email/send-estimate envía presupuesto (200)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/email/send-estimate",
      headers: auth(),
      payload: {
        to: "dest@e2e-s119.test",
        data: {
          numeroEstimacion: "EST-119",
          cliente: "Cliente T119",
          vehiculo: "Toyota Corolla",
          total: "250000",
          validez: "15 días",
          items: [
            { descripcion: "Reparación de motor", cantidad: 1, precio: "250000", total: "250000" },
          ],
        },
      },
    });
    expect(res.statusCode, res.body).toBe(200);
  });

  it("POST /email/send-reminder envía recordatorio (200)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/email/send-reminder",
      headers: auth(),
      payload: {
        to: "dest@e2e-s119.test",
        data: { cliente: "Cliente T119", fecha: "2030-01-15" },
      },
    });
    expect(res.statusCode, res.body).toBe(200);
  });
});

// ─── Email · billing ──────────────────────────────────────

describe("Sprint 119 · Email billing", () => {
  it("POST /email/billing/subscription-activated → 200 (admin resuelto)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/email/billing/subscription-activated",
      headers: auth(),
      payload: {
        data: {
          tenantName: "Taller T119",
          planName: "Pro",
          interval: "monthly",
          price: "USD 49",
          nextBillingDate: "2030-01-01",
        },
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().sentTo).toBe(ADMIN_EMAIL);
  });

  it("POST /email/billing/payment-failed → 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/email/billing/payment-failed",
      headers: auth(),
      payload: {
        data: {
          tenantName: "Taller T119",
          planName: "Pro",
          amount: "USD 49",
          dueDate: "2030-01-10",
          invoiceId: "inv-119",
        },
      },
    });
    expect(res.statusCode, res.body).toBe(200);
  });

  it("POST /email/billing/subscription-cancelled → 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/email/billing/subscription-cancelled",
      headers: auth(),
      payload: {
        data: {
          tenantName: "Taller T119",
          planName: "Pro",
          cancelDate: "2030-01-05",
          accessUntil: "2030-02-05",
        },
      },
    });
    expect(res.statusCode, res.body).toBe(200);
  });

  it("POST /email/billing/trial-ending → 200", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/email/billing/trial-ending",
      headers: auth(),
      payload: {
        data: {
          tenantName: "Taller T119",
          planName: "Pro",
          trialEndDate: "2030-01-20",
          daysRemaining: 3,
        },
      },
    });
    expect(res.statusCode, res.body).toBe(200);
  });

  it("POST /email/billing/payment-failed sin body → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/email/billing/payment-failed",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── SSO (OpenID Connect) ─────────────────────────────────

describe("Sprint 119 · SSO", () => {
  it("POST /sso/discover sin issuer → 400 (validación offline)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sso/discover",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /sso/authorize sin parámetros → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sso/authorize",
      headers: auth(),
      payload: { issuer: "https://idp.example.com" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /sso/logout sin parámetros → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sso/logout",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /sso/validate-domain valida el dominio (200, offline)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sso/validate-domain",
      headers: auth(),
      payload: { email: "user@example.com", allowedDomains: ["example.com"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().allowed).toBe(true);
  });

  it("POST /sso/validate-domain sin email → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sso/validate-domain",
      headers: auth(),
      payload: { allowedDomains: ["example.com"] },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── WhatsApp ─────────────────────────────────────────────

describe("Sprint 119 · WhatsApp", () => {
  it("POST /whatsapp/instance/create → 201 si Evolution responde, 500 si offline", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/instance/create",
      headers: auth(),
    });
    expect([201, 500]).toContain(res.statusCode);
    if (res.statusCode === 500) expect(res.json().error).toBe("WhatsAppError");
  });

  it("POST /whatsapp/disconnect → 200 (traga errores de Evolution)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/disconnect",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("POST /whatsapp/queue/process → 200 con contadores (sin pendientes)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/queue/process",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(typeof res.json().processed).toBe("number");
  });

  it("POST /whatsapp/send con orden inexistente → 404 (sin llamada externa)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/send",
      headers: auth(),
      payload: {
        ordenId: "00000000-0000-0000-0000-0000c11e4fff",
        estadoSolicitado: "EN_REPARACION",
        customMessage: "Hola",
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /whatsapp/send con OT válida → 201 (Evolution up) o 500 (offline)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/send",
      headers: auth(),
      payload: {
        ordenId: OT_ID,
        estadoSolicitado: "EN_REPARACION",
        customMessage: `Aviso Sprint 119 ${TS}`,
      },
    });
    expect([201, 500]).toContain(res.statusCode);
    if (res.statusCode === 500) expect(res.json().error).toBe("WhatsAppSendError");
    else expect(res.json().success).toBe(true);
  });
});

// ─── Portal · invoices/pay ────────────────────────────────

describe("Sprint 119 · Portal invoices pay", () => {
  it("POST /portal/invoices/:id/pay sin sesión → 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/portal/invoices/${FAKE_FACTURA}/pay`,
      headers: { "x-tenant-slug": TENANT, "x-csrf-token": CSRF, cookie: `_csrf=${CSRF}` },
      payload: { provider: "STRIPE" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /portal/invoices/:id/pay con factura inexistente → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/portal/invoices/${FAKE_FACTURA}/pay`,
      headers: portalAuth(),
      payload: { provider: "STRIPE" },
    });
    expect(res.statusCode, res.body).toBe(400);
  });
});

// ─── Thinkcar USB + RAG manuals ───────────────────────────

describe("Sprint 119 · Thinkcar USB + manuals ingest", () => {
  it("POST /thinkcar/ingest/usb sin binario aft-mtp-mount → 500", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/thinkcar/ingest/usb",
      headers: auth(),
    });
    // Sin aft-mtp-mount (CI) ingestFromUsb lanza y el handler no lo captura.
    expect(res.statusCode).toBe(500);
  });

  it("POST /intelligence/manuals/ingest sin archivo → 400", async () => {
    const mp = multipartBody([{ name: "nota", value: "sin pdf" }]);
    const res = await app.inject({
      method: "POST",
      url: "/intelligence/manuals/ingest",
      headers: { ...auth(), "content-type": mp.contentType },
      payload: mp.payload,
    });
    expect(res.statusCode, res.body).toBe(400);
  });
});
