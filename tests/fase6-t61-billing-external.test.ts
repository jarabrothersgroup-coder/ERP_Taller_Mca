/**
 * Fase 6 · T-61 — Billing externo: portal de Stripe y webhook (Sprint 107).
 *
 * Cierra 2 pares de comportamiento sin test en el scanner de rutas:
 *   POST /billing/portal
 *   POST /billing/webhook
 *
 * Portal: 403 sin X-Tenant-Slug (resolveTenant onRequest), 401 sin auth
 * (authGate preHandler) y 200 con mock cuando Stripe no está configurado
 * (dev mode).
 *
 * Webhook: sin auth (ruta pública), 400 con payload inválido, 400 con secreto
 * de firma configurado pero sin cabecera stripe-signature, y el flujo dev
 * (sin secreto) procesa invoice.paid de forma idempotente (upsert por
 * stripe_invoice_id).
 *
 * El entorno Stripe se fija con vi.stubEnv por test para que la suite sea
 * determinista con o sin .env real (CLAUDE §9 — nunca hardcodear secretos).
 *
 * Fixtures propias bajo el tenant "e2e-t107-billing", limpias en afterAll.
 *
 * @module tests/fase6-t61-billing-external
 */
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-t107-billing";
const TENANT_ID = "00000000-0000-0000-0000-00000107b001";
const ADMIN_ID = "00000000-0000-0000-0000-00000107b002";
const ADMIN_EMAIL = "admin@e2e-t107-billing.test";
const PLAN_ID = "00000000-0000-0000-0000-00000107b003";
const PLAN_CODE = "e2e-t107-billing-plan";
const TS = Date.now().toString(36);

/** stripe_subscription_id compartido por la semilla y el evento invoice.paid */
const STRIPE_SUB_ID = `sub_t107_${TS}`;
const STRIPE_INVOICE_ID = `in_t107_${TS}`;
const MOCK_PORTAL_URL = "/dashboard/billing?mock_portal=true";

let app: FastifyInstance;
let bearer: string;

// ─── Helpers ──────────────────────────────────────────────

function auth(): Record<string, string> {
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": TENANT };
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

/** Fija el entorno Stripe en modo dev (sin secretos) para el test actual. */
function stubStripeDev(): void {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STRIPE_MODE", "test");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv("STRIPE_SECRET_KEY_LIVE", "");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET_LIVE", "");
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  await q`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E T107 Billing', ${TENANT}, 'tenant_e2e_t107_billing', true)
    ON CONFLICT (slug) DO NOTHING`;
  await q`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Billing T107', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;

  // Limpieza defensiva de corridas previas rotas: getSubscription toma la
  // primera suscripción del tenant, debe ser exactamente la nuestra.
  await q`DELETE FROM billing_invoices WHERE tenant_id = ${TENANT_ID}`;
  await q`DELETE FROM billing_subscriptions WHERE tenant_id = ${TENANT_ID}`;

  await q`
    INSERT INTO billing_plans (id, code, name, price_monthly_pyg, is_active)
    VALUES (${PLAN_ID}, ${PLAN_CODE}, 'Plan E2E T107', 490000, true)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, price_monthly_pyg = EXCLUDED.price_monthly_pyg, is_active = true`;

  await q`
    INSERT INTO billing_subscriptions (tenant_id, plan_id, stripe_subscription_id, stripe_customer_id, status, interval)
    VALUES (${TENANT_ID}, ${PLAN_ID}, ${STRIPE_SUB_ID}, ${`cus_t107_${TS}`}, 'active', 'monthly')`;

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

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  const stmts = [
    `DELETE FROM billing_invoices WHERE tenant_id = '${TENANT_ID}'`,
    `DELETE FROM billing_subscriptions WHERE tenant_id = '${TENANT_ID}'`,
    `DELETE FROM billing_plans WHERE code = '${PLAN_CODE}'`,
    `DELETE FROM audit_log WHERE tenant_slug = '${TENANT}'`,
    `DELETE FROM profiles WHERE tenant_id = '${TENANT_ID}'`,
    `DELETE FROM tenants WHERE id = '${TENANT_ID}'`,
  ];
  const sql = getDb() as unknown as {
    unsafe: (stmt: string) => Promise<unknown>;
  };
  for (const stmt of stmts) {
    try {
      await sql.unsafe(stmt);
    } catch (err) {
      console.error("[fase6-t61-billing] cleanup falló:", stmt, err);
    }
  }
  if (app) await app.close();
});

// ─── POST /billing/portal ─────────────────────────────────

describe("Fase 6 · T-61 — POST /billing/portal", () => {
  it("sin X-Tenant-Slug → 403 (resolveTenant no identifica el tenant)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/billing/portal",
      headers: { authorization: `Bearer ${bearer}` },
      payload: {},
    });
    expect(res.statusCode, `portal sin tenant → ${res.statusCode}: ${res.body}`).toBe(403);
  });

  it("con tenant y Bearer inválido → 401 (authGate rechaza el token)", async () => {
    // La cabecera Authorization además bypasea el guard CSRF double-submit
    // (POST sin Bearer/Cookie produciría 403 CSRF antes que 401).
    const res = await app.inject({
      method: "POST",
      url: "/billing/portal",
      headers: {
        authorization: "Bearer inválido.t107.token",
        "x-tenant-slug": TENANT,
      },
      payload: {},
    });
    expect(res.statusCode, `portal token inválido → ${res.statusCode}: ${res.body}`).toBe(401);
  });

  it("con auth, suscripción y Stripe sin configurar → 200 con URL mock de desarrollo", async () => {
    stubStripeDev();
    const res = await app.inject({
      method: "POST",
      url: "/billing/portal",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode, `portal dev → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json().url).toBe(MOCK_PORTAL_URL);
  });
});

// ─── POST /billing/webhook ────────────────────────────────

describe("Fase 6 · T-61 — POST /billing/webhook", () => {
  it("payload sin type/data → 400 (Invalid webhook payload)", async () => {
    stubStripeDev();
    const res = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      payload: { foo: "bar" },
    });
    expect(res.statusCode, `webhook inválido → ${res.statusCode}: ${res.body}`).toBe(400);
    expect(res.json().error).toBe("Invalid webhook payload");
  });

  it("secreto de firma configurado y sin cabecera stripe-signature → 400", async () => {
    stubStripeDev();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_local_t107");
    const res = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      payload: { type: "invoice.paid", data: { object: {} } },
    });
    expect(res.statusCode, `webhook sin firma → ${res.statusCode}: ${res.body}`).toBe(400);
    expect(res.json().error).toBe("Missing stripe-signature header");
  });

  it("evento desconocido (dev) → 200 {received:true} sin efectos", async () => {
    stubStripeDev();
    const res = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      payload: { type: "charge.refunded", data: { object: { id: "ch_x" } } },
    });
    expect(res.statusCode, `evento desconocido → ${res.statusCode}: ${res.body}`).toBe(200);
    expect(res.json()).toEqual({ received: true });
  });

  it("invoice.paid (dev) → 200 y upsert idempotente de la factura", async () => {
    stubStripeDev();
    const payload = {
      type: "invoice.paid",
      data: {
        object: {
          id: STRIPE_INVOICE_ID,
          subscription: STRIPE_SUB_ID,
          amount_paid: 490000,
          currency: "pyg",
        },
      },
    };

    const res1 = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      payload,
    });
    expect(res1.statusCode, `invoice.paid → ${res1.statusCode}: ${res1.body}`).toBe(200);
    expect(res1.json()).toEqual({ received: true });

    // Reintento de Stripe (mismo evento) → sigue 200 y no duplica la fila
    const res2 = await app.inject({
      method: "POST",
      url: "/billing/webhook",
      payload,
    });
    expect(res2.statusCode, `replay → ${res2.statusCode}: ${res2.body}`).toBe(200);

    const rows = await q<{ status: string; amount_pyg: number; currency: string; paid_at: Date | null }>`
      SELECT status, amount_pyg, currency, paid_at
      FROM billing_invoices
      WHERE stripe_invoice_id = ${STRIPE_INVOICE_ID}`;
    expect(rows, "invoice.paid debió persistir la factura del tenant").toHaveLength(1);
    expect(rows[0]!.status).toBe("paid");
    expect(Number(rows[0]!.amount_pyg)).toBe(490000);
    expect(rows[0]!.currency).toBe("PYG");
    expect(rows[0]!.paid_at).toBeTruthy();
  });
});
