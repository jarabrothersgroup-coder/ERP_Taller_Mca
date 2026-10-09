/**
 * Sprint 115 — Cobertura de escritura lote 2 (backlog T-61).
 *
 * 16 ops de escritura sin test del balde post-113, patrón fase7
 * (tenant propio "e2e-s115", fixtures SQL idempotentes, app.inject
 * con template literals para el scanner de T-63).
 *
 * Rutas cubiertas:
 *   - POST   /mobile/push-token
 *   - DELETE /mobile/push-token
 *   - PATCH  /api/notifications/:id/read
 *   - POST   /api/notifications/read-all
 *   - POST   /api-keys
 *   - DELETE /api-keys/:id
 *   - PUT    /enterprise/data-retention
 *   - POST   /enterprise/data-retention/cleanup
 *   - PUT    /label-printing/config
 *   - POST   /label-printing/config/preview
 *   - POST   /label-printing/reimpresiones/:id
 *   - POST   /analytics/report
 *   - POST   /fleet/billing/run
 *   - POST   /2fa/verify
 *   - POST   /finance/payments/link
 *   - PATCH  /api/notifications/:id/read (aislamiento cross-tenant — fix S115)
 *
 * @module tests/fase7-s115-write-coverage
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s115";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f115";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f11d";
const ADMIN_EMAIL = "admin@e2e-s115.test";
const PEER_TENANT = "e2e-s115-peer";
const PEER_TENANT_ID = "00000000-0000-0000-0000-0000e2e4f11e";
const PEER_ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f11f";
const PEER_ADMIN_EMAIL = "admin@e2e-s115-peer.test";
const TS = Date.now().toString(36);

let app: FastifyInstance;
let bearer: string;
let peerBearer: string;

// ─── Helpers ──────────────────────────────────────────────

function auth(): Record<string, string> {
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": TENANT };
}

function peerAuth(): Record<string, string> {
  return { authorization: `Bearer ${peerBearer}`, "x-tenant-slug": PEER_TENANT };
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

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  app = await buildApp();

  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Sprint 115', ${TENANT}, 'tenant_e2e_s115', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 115', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;
  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${PEER_TENANT_ID}, 'E2E Sprint 115 Peer', ${PEER_TENANT}, 'tenant_e2e_s115_peer', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${PEER_ADMIN_ID}, ${PEER_TENANT_ID}, ${PEER_ADMIN_EMAIL}, 'Admin Peer S115', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;

  bearer = generateToken({
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: "admin",
    tenantId: TENANT_ID,
    tenantSlug: TENANT,
  });
  peerBearer = generateToken({
    id: PEER_ADMIN_ID,
    email: PEER_ADMIN_EMAIL,
    role: "admin",
    tenantId: PEER_TENANT_ID,
    tenantSlug: PEER_TENANT,
  });
});

afterAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`DELETE FROM notificaciones WHERE tenant_slug IN (${TENANT}, ${PEER_TENANT})`;
  await sql`DELETE FROM mobile_push_tokens WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM api_keys WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM data_retention_policy WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM invoice_config WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM facturas WHERE tenant_slug = ${TENANT} AND numero_factura_manual LIKE ${`S115-${TS}%`}`;
  await sql`DELETE FROM profiles WHERE id IN (${ADMIN_ID}, ${PEER_ADMIN_ID})`;
  await sql`DELETE FROM tenants WHERE id IN (${TENANT_ID}, ${PEER_TENANT_ID})`;
  await app?.close();
});

// ─── Mobile push-token ────────────────────────────────────

describe("Sprint 115 · Mobile push-token", () => {
  it("POST /mobile/push-token crea token y devuelve ok", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mobile/push-token",
      headers: auth(),
      payload: { deviceId: `dev-s115-${TS}`, pushToken: "token-abc-123", platform: "ios" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.updated).toBe(false);
    expect(typeof body.id).toBe("string");
  });

  it("POST /mobile/push-token con mismo deviceId hace upsert (updated=true)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mobile/push-token",
      headers: auth(),
      payload: { deviceId: `dev-s115-${TS}`, pushToken: "token-xyz-789", platform: "android" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.updated).toBe(true);
  });

  it("POST /mobile/push-token sin deviceId → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mobile/push-token",
      headers: auth(),
      payload: { pushToken: "x" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("DELETE /mobile/push-token elimina token y devuelve ok", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/mobile/push-token",
      headers: auth(),
      payload: { deviceId: `dev-s115-${TS}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("DELETE /mobile/push-token sin deviceId → 400", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/mobile/push-token",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Notifications ────────────────────────────────────────

describe("Sprint 115 · Notifications escritura", () => {
  let notifId: string;
  let peerNotifId: string;

  beforeAll(async () => {
    const ids = await q`
      INSERT INTO notificaciones (id, tipo, titulo, mensaje, leido, tenant_slug)
      VALUES (gen_random_uuid(), 'SISTEMA', 'Test S115', 'Mensaje S115', false, ${TENANT}),
             (gen_random_uuid(), 'SISTEMA', 'Peer S115', 'Mensaje peer', false, ${PEER_TENANT})
      RETURNING id, tenant_slug`;
    notifId = ids.find((r: any) => r.tenant_slug === TENANT)!.id;
    peerNotifId = ids.find((r: any) => r.tenant_slug === PEER_TENANT)!.id;
  });

  it("PATCH /api/notifications/:id/read marca como leída", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/notifications/${notifId}/read`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().leido).toBe(true);
  });

  it("PATCH /api/notifications/:id/read cross-tenant → 404 (aislamiento)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/notifications/${peerNotifId}/read`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
  });

  it("PATCH /api/notifications/:id/read id inexistente → 404", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/notifications/00000000-0000-0000-0000-000000000000/read",
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /api/notifications/read-all marca todas como leídas", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/read-all",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});

// ─── API Keys ─────────────────────────────────────────────

describe("Sprint 115 · API Keys escritura", () => {
  let keyId: string;

  it("POST /api-keys crea key y devuelve apiKey raw", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api-keys",
      headers: auth(),
      payload: { name: `Key S115 ${TS}`, scopes: ["read:workshop"] },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe(`Key S115 ${TS}`);
    expect(typeof body.apiKey).toBe("string");
    expect(body.apiKey.length).toBeGreaterThan(10);
    keyId = pickId(body, "api-key");
  });

  it("DELETE /api-keys/:id revoca key y devuelve ok", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api-keys/${keyId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("DELETE /api-keys/:id inexistente → 404", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api-keys/00000000-0000-0000-0000-000000000000",
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
  });
});

// ─── Enterprise data-retention ────────────────────────────

describe("Sprint 115 · Enterprise data-retention", () => {
  it("PUT /enterprise/data-retention upsert política", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/enterprise/data-retention",
      headers: auth(),
      payload: { auditLogRetentionDays: "365", emailLogRetentionDays: "180" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.auditLogRetentionDays).toBe("365");
    expect(body.emailLogRetentionDays).toBe("180");
  });

  it("PUT /enterprise/data-retention re-upsert actualiza valores", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/enterprise/data-retention",
      headers: auth(),
      payload: { auditLogRetentionDays: "730" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().auditLogRetentionDays).toBe("730");
  });

  it("POST /enterprise/data-retention/cleanup ejecuta con política existente", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/enterprise/data-retention/cleanup",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("POST /enterprise/data-retention/cleanup cross-tenant sin política → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/enterprise/data-retention/cleanup",
      headers: peerAuth(),
    });
    expect(res.statusCode).toBe(404);
  });
});

// ─── Label printing ───────────────────────────────────────

describe("Sprint 115 · Label printing escritura", () => {
  it("PUT /label-printing/config upsert configuración", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/label-printing/config",
      headers: auth(),
      payload: {
        paperWidthMm: 80,
        printerProtocol: "ESCPOS",
        companyNombre: `Taller S115 ${TS}`,
        companyRuc: "80012345-6",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("POST /label-printing/config/preview genera preview con config guardada", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/label-printing/config/preview",
      headers: auth(),
      payload: {
        data: {
          numeroFactura: `S115-${TS}-001`,
          tipoFactura: "MANUAL",
          total: "Gs. 110.000",
          clienteNombre: "Cliente Preview",
          lineItems: "[]",
        },
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it("POST /label-printing/reimpresiones/:id factura inexistente → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/label-printing/reimpresiones/00000000-0000-0000-0000-000000000000",
      headers: auth(),
      payload: { protocolo: "ESCPOS", copias: 1 },
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /label-printing/reimpresiones/:id factura existente → 200 con labelData", async () => {
    const facturas = await q`
      INSERT INTO facturas (id, tenant_slug, tipo, numero_factura_manual, total, estado_pago)
      VALUES (gen_random_uuid(), ${TENANT}, 'MANUAL', ${`S115-${TS}-001`}, '110000', 'PENDIENTE')
      RETURNING id`;
    const fid = facturas[0]!.id;

    const res = await app.inject({
      method: "POST",
      url: `/label-printing/reimpresiones/${fid}`,
      headers: auth(),
      payload: { protocolo: "ESCPOS", copias: 1 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.factura?.numero).toBe(`S115-${TS}-001`);
    expect(body.payload).toBeTruthy();
    expect(body.protocol).toBe("ESCPOS");
  });
});

// ─── Analytics report ─────────────────────────────────────

describe("Sprint 115 · Analytics report", () => {
  it("POST /analytics/report sin type/from/to → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/analytics/report",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /analytics/report type=revenue devuelve report", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/analytics/report",
      headers: auth(),
      payload: {
        type: "revenue",
        from: "2026-01-01",
        to: "2026-12-31",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("trend");
  });

  it("POST /analytics/report type=status devuelve distribución", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/analytics/report",
      headers: auth(),
      payload: {
        type: "status",
        from: "2026-01-01",
        to: "2026-12-31",
      },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ─── Fleet billing ────────────────────────────────────────

describe("Sprint 115 · Fleet billing", () => {
  it("POST /fleet/billing/run sin contratos devuelve generated=0", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/fleet/billing/run",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().generated).toBe(0);
  });
});

// ─── 2FA verify ───────────────────────────────────────────

describe("Sprint 115 · 2FA verify", () => {
  it("POST /2fa/verify sin code → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/2fa/verify",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /2fa/verify con code inválido → valid=false", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/2fa/verify",
      headers: auth(),
      payload: { code: "000000" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().valid).toBe(false);
  });

  it("POST /2fa/verify con secret+code inválido → valid=false", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/2fa/verify",
      headers: auth(),
      payload: { secret: "JBSWY3DPEHPK3PXP", code: "000000" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().valid).toBe(false);
  });
});

// ─── Finance payments link ────────────────────────────────

describe("Sprint 115 · Finance payments link", () => {
  it("POST /finance/payments/link factura inexistente → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/payments/link",
      headers: auth(),
      payload: {
        facturaId: "00000000-0000-0000-0000-000000000000",
        provider: "STRIPE",
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /finance/payments/link factura pendiente STRIPE mock → 200 con paymentUrl", async () => {
    const facturas = await q`
      INSERT INTO facturas (id, tenant_slug, tipo, numero_factura_manual, total, estado_pago)
      VALUES (gen_random_uuid(), ${TENANT}, 'MANUAL', ${`S115-${TS}-PAY`}, '500000', 'PENDIENTE')
      RETURNING id`;
    const fid = facturas[0]!.id;

    const res = await app.inject({
      method: "POST",
      url: "/finance/payments/link",
      headers: auth(),
      payload: { facturaId: fid, provider: "STRIPE" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.provider).toBe("STRIPE");
    expect(typeof body.paymentUrl).toBe("string");
  });

  it("POST /finance/payments/link sin facturaId → 400 (schema)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/payments/link",
      headers: auth(),
      payload: { provider: "STRIPE" },
    });
    expect(res.statusCode).toBe(400);
  });
});
