/**
 * Sprint 122 — Lote 9 de LECTURA (cierre del balde T-61/T-63).
 *
 * Cubre las 57 rutas GET + 2 POST de validación SIFEN que quedaban en
 * `withoutTest` fuera de EXCLUDED (scan 2026-10-12: 64 → objetivo ~4:
 * solo quedarán las excluidas del DNIT). Módulos: api (6), analytics (6),
 * audit (6), thinkcar (6), portal (6), docs (4), whatsapp (3), billing (3),
 * config (2+logo), crm (2), ws (2), reports (2) y 13 sueltos.
 *
 * Verificado con sonda empírica (app.inject real) antes de escribir las
 * aserciones — los statuses/shapes reflejan el comportamiento observado:
 *  - rutas WS (`{websocket:true}`) con GET HTTP plano → rechazo (sin handshake);
 *  - hooks globales: sin X-Tenant-Slug → 403;
 *  - locale era 401 SIEMPRE (bug: i18n.js/SW fetchan sin token y la ruta
 *    no estaba en PUBLIC_PATHS) → fix en auth-gate.ts → 200 público;
 *  - portal exige header `x-portal-session` (base64url JSON) → 401 sin él;
 *  - whatsapp/qr sin Evolution API → 500 capturado (WhatsAppError);
 *  - SIFEN: nota-credito solo validación de schema (400), reenviar con cola
 *    vacía no llama al DNIT → 200 {enviados:0}.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

const TENANT = "e2e-s122";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f122";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4a122";
/** UUID inexistente para rutas parametrizadas (hex válido). */
const NO_EXISTE = "00000000-0000-0000-0000-0000dead0002";

let app: FastifyInstance;
let bearer: string;

function auth(): Record<string, string> {
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": TENANT };
}

/** Sesión de portal cliente: encodeSession = base64url(JSON). */
function portalSession(): string {
  return Buffer.from(
    JSON.stringify({
      clientId: NO_EXISTE,
      tenantSlug: TENANT,
      email: "portal@e2e-s122.test",
      name: "Portal E2E 122",
      expiresAt: Date.now() + 3_600_000,
    }),
  ).toString("base64url");
}

function portal(): Record<string, string> {
  return { ...auth(), "x-portal-session": portalSession() };
}

/** SQL crudo (postgres.js) para fixtures fuera de requests. */
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
    VALUES (${TENANT_ID}, 'E2E Sprint 122', ${TENANT}, 'tenant_e2e_s122', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, 'admin@e2e-s122.test', 'Admin Sprint 122', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;

  bearer = generateToken({
    id: ADMIN_ID,
    email: "admin@e2e-s122.test",
    role: "admin",
    tenantId: TENANT_ID,
    tenantSlug: TENANT,
  });

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await q`DELETE FROM profiles WHERE id = ${ADMIN_ID}`;
  await q`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
  await app?.close();
});

// ─── Analytics KPIs (6) ───────────────────────────────────

describe("Sprint 122 · Analytics", () => {
  it("GET /analytics/kpis/revenue|ots|avg-value|completion → 200 con label/value", async () => {
    const urls = [
      `/analytics/kpis/revenue`,
      `/analytics/kpis/ots`,
      `/analytics/kpis/avg-value`,
      `/analytics/kpis/completion`,
    ];
    for (const url of urls) {
      const res = await app.inject({ method: "GET", url, headers: auth() });
      expect(res.statusCode, `${url} → ${res.body}`).toBe(200);
      const body = res.json();
      expect(typeof body.label).toBe("string");
      expect(typeof body.value).toBe("number");
      expect(typeof body.trend).toBe("string");
    }
  });

  it("GET /analytics/trends/ots → 200 {trend, range} con default 30d", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/analytics/trends/ots`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.trend)).toBe(true);
    expect(body.range).toMatchObject({ from: expect.any(String), to: expect.any(String) });
  });

  it("GET /analytics/mechanics → 200 {mechanics, range} con limit opcional", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/analytics/mechanics?limit=3`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.mechanics)).toBe(true);
    expect(body.range.from).toEqual(expect.any(String));
  });
});

// ─── Audit enterprise (6) ─────────────────────────────────

describe("Sprint 122 · Audit", () => {
  it("GET /audit y /audit/ → 200 {entries, total, limit, offset, hasMore}", async () => {
    for (const url of [`/audit`, `/audit/`]) {
      const res = await app.inject({
        method: "GET",
        url,
        headers: auth(),
        query: { limit: "1" },
      });
      expect(res.statusCode, `${url} → ${res.body}`).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.entries)).toBe(true);
      expect(body).toHaveProperty("total");
      expect(body.limit).toBe(1);
      expect(body.hasMore).toBe(false);
    }
  });

  it("GET /audit/log → 200 alias del listado", async () => {
    const res = await app.inject({ method: "GET", url: `/audit/log`, headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().entries)).toBe(true);
  });

  it("GET /audit/verify → 200 {valid, verified}", async () => {
    const res = await app.inject({ method: "GET", url: `/audit/verify`, headers: auth() });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(true);
    expect(typeof body.verified).toBe("number");
  });

  it("GET /audit/stats → 200 con period/byAction/bySeverity", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/audit/stats?days=7`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.period).toBeDefined();
    expect(body.byAction).toBeDefined();
    expect(body.bySeverity).toBeDefined();
  });

  it("GET /audit/export → 200 text/csv con cabecera", async () => {
    const res = await app.inject({ method: "GET", url: `/audit/export`, headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("audit-log-");
    expect(res.body.split("\n")[0]).toContain("Acción");
  });
});

// ─── Thinkcar (6) ─────────────────────────────────────────

describe("Sprint 122 · Thinkcar", () => {
  it("GET /thinkcar/health → 200 {channels, allHealthy}", async () => {
    const res = await app.inject({ method: "GET", url: "/thinkcar/health", headers: auth() });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.channels)).toBe(true);
    expect(typeof body.allHealthy).toBe("boolean");
  });

  it("GET /thinkcar/imports → 200 {data, total, limit, offset}", async () => {
    const res = await app.inject({ method: "GET", url: "/thinkcar/imports", headers: auth() });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBe(0);
    expect(body.limit).toBe(50);
  });

  it("GET /thinkcar/imports/:id inexistente → 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/thinkcar/imports/${NO_EXISTE}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NotFoundError");
    expect(res.json().message).toContain("no encontrado");
  });

  it("GET /thinkcar/pending/count → 200 {count: 0}", async () => {
    const res = await app.inject({ method: "GET", url: "/thinkcar/pending/count", headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ count: 0 });
  });

  it("GET /thinkcar/stats → 200 {total, byStatus}", async () => {
    const res = await app.inject({ method: "GET", url: "/thinkcar/stats", headers: auth() });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(0);
    expect(Array.isArray(body.byStatus)).toBe(true);
  });

  it("GET /thinkcar/dtc/lookup/P0300 → found:true; Z9999 → found:false", async () => {
    const ok = await app.inject({
      method: "GET",
      url: "/thinkcar/dtc/lookup/P0300",
      headers: auth(),
    });
    expect(ok.statusCode).toBe(200);
    const found = ok.json();
    expect(found).toMatchObject({ code: "P0300", found: true });
    expect(typeof found.description).toBe("string");
    expect(["Critical", "High", "Medium", "Low", "Info"]).toContain(found.severity);

    const ko = await app.inject({
      method: "GET",
      url: "/thinkcar/dtc/lookup/Z9999",
      headers: auth(),
    });
    expect(ko.statusCode).toBe(200);
    expect(ko.json()).toMatchObject({ code: "Z9999", found: false, system: "Desconocido" });
  });
});

// ─── Portal cliente (6) ───────────────────────────────────

describe("Sprint 122 · Portal", () => {
  it("GET /portal/vehicles|orders|invoices → 200 arrays con sesión; 401 sin ella", async () => {
    for (const url of [`/portal/vehicles`, `/portal/orders`, `/portal/invoices`]) {
      const withSession = await app.inject({ method: "GET", url, headers: portal() });
      expect(withSession.statusCode, `${url} → ${withSession.body}`).toBe(200);
      expect(Array.isArray(withSession.json())).toBe(true);

      const sinSesion = await app.inject({
        method: "GET",
        url,
        headers: { "x-tenant-slug": TENANT },
      });
      expect(sinSesion.statusCode, `${url} sin sesión`).toBe(401);
    }
  });

  it("GET /portal/availability → 400 sin date; 200 con slots", async () => {
    const sinDate = await app.inject({
      method: "GET",
      url: "/portal/availability",
      headers: portal(),
    });
    expect(sinDate.statusCode).toBe(400);

    const conDate = await app.inject({
      method: "GET",
      url: "/portal/availability?date=2026-10-20",
      headers: portal(),
    });
    expect(conDate.statusCode).toBe(200);
    const body = conDate.json();
    expect(typeof body.available).toBe("boolean");
    expect(Array.isArray(body.slots)).toBe(true);
  });

  it("GET /portal/orders/:id inexistente → 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/portal/orders/${NO_EXISTE}`,
      headers: portal(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain("no encontrada");
  });

  it("GET /portal/api/auth/magic/:token inválido → 401; sin tenant → 403", async () => {
    const sinTenant = await app.inject({
      method: "GET",
      url: "/portal/api/auth/magic/noexiste123",
    });
    expect(sinTenant.statusCode).toBe(403);

    const conTenant = await app.inject({
      method: "GET",
      url: "/portal/api/auth/magic/noexiste123",
      headers: { "x-tenant-slug": TENANT },
    });
    expect(conTenant.statusCode).toBe(401);
    expect(conTenant.json()).toHaveProperty("error");
  });
});

// ─── Docs Swagger (4) ─────────────────────────────────────

describe("Sprint 122 · Docs (Swagger UI)", () => {
  it("GET /docs/ → 200 HTML de Swagger UI", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("Swagger UI");
  });

  it("GET /docs/static/index.html → 302 redirect", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/static/index.html" });
    expect([301, 302]).toContain(res.statusCode);
    expect(res.headers.location).toBeDefined();
  });

  it("GET /docs/static/swagger-initializer.js → 200 JS", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/docs/static/swagger-initializer.js",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("window.onload");
  });

  it("GET /docs/yaml → 200 OpenAPI YAML", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/yaml" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("openapi: 3.0.0");
  });
});

// ─── WhatsApp (3) ─────────────────────────────────────────

describe("Sprint 122 · WhatsApp", () => {
  it("GET /whatsapp/qr → 200 con qr o 500 WhatsAppError (sin Evolution API)", async () => {
    const res = await app.inject({ method: "GET", url: "/whatsapp/qr", headers: auth() });
    if (res.statusCode === 200) {
      expect(res.json()).toHaveProperty("qr");
    } else {
      expect(res.statusCode).toBe(500);
      expect(res.json().error).toBe("WhatsAppError");
      expect(typeof res.json().message).toBe("string");
    }
  });

  it("GET /whatsapp/followups/stats → 200 contadores", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/whatsapp/followups/stats",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      total: expect.any(Number),
      scheduled: expect.any(Number),
      sent: expect.any(Number),
      failed: expect.any(Number),
    });
  });

  it("GET /whatsapp/templates/variables → 200 map de variables", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/whatsapp/templates/variables",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.nombre_cliente).toBeDefined();
    expect(body.orden_id).toBeDefined();
  });
});

// ─── Billing (3) ──────────────────────────────────────────

describe("Sprint 122 · Billing", () => {
  it("GET /billing/plans → 200 {plans}; sin tenant header → 403", async () => {
    const sinTenant = await app.inject({ method: "GET", url: "/billing/plans" });
    expect(sinTenant.statusCode).toBe(403);

    const res = await app.inject({ method: "GET", url: "/billing/plans", headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().plans)).toBe(true);
  });

  it("GET /billing/subscription → 200 {subscription}", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/billing/subscription",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("subscription");
  });

  it("GET /billing/invoices → 200 {invoices: []}", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/billing/invoices",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ invoices: [] });
  });
});

// ─── Config + logo (3) ────────────────────────────────────

describe("Sprint 122 · Config dashboard", () => {
  it("GET /config/dashboard/consolidated → 200 con totales", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/config/dashboard/consolidated",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(typeof body.totalSucursales).toBe("number");
    expect(Array.isArray(body.sucursales)).toBe(true);
  });

  it("GET /config/dashboard/role → 200 objeto", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/config/dashboard/role",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json()).toBe("object");
  });

  it("GET /api/config/logo → 200 {logoBase64}", async () => {
    const res = await app.inject({ method: "GET", url: "/api/config/logo", headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().logoBase64).toBe("string");
  });
});

// ─── CRM (2) ──────────────────────────────────────────────

describe("Sprint 122 · CRM sync", () => {
  it("GET /crm/status → 200 {connected: boolean} (500 capturado aceptable)", async () => {
    const res = await app.inject({ method: "GET", url: "/crm/status", headers: auth() });
    expect([200, 500]).toContain(res.statusCode);
    expect(typeof res.json().connected).toBe("boolean");
  });

  it("GET /crm/stats → 200 contadores", async () => {
    const res = await app.inject({ method: "GET", url: "/crm/stats", headers: auth() });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      total: expect.any(Number),
      success: expect.any(Number),
      failed: expect.any(Number),
      pending: expect.any(Number),
    });
  });
});

// ─── WebSocket (3: ws + visual stream) ────────────────────

describe("Sprint 122 · WebSocket (sin handshake)", () => {
  it("GET plano a /ws/notifications, /ws/financial-dashboard y /api/v1/visual/stream → rechazado", async () => {
    // Estas rutas son {websocket:true}: un GET HTTP sin Upgrade no puede
    // completar el handshake y Fastify las rechaza (404/400/426 según versión).
    for (const url of [`/ws/notifications`, `/ws/financial-dashboard`, `/api/v1/visual/stream`]) {
      const res = await app.inject({ method: "GET", url, headers: auth() });
      expect([400, 404, 426], `${url} → ${res.statusCode}`).toContain(res.statusCode);
    }
  });
});

// ─── Reports PDF (2) ──────────────────────────────────────

describe("Sprint 122 · Reports PDF", () => {
  it("GET /reports/client-statement/:clientId → 404 (o 503 sin Chromium); uuid malo → 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/reports/client-statement/${NO_EXISTE}`,
      headers: auth(),
    });
    expect([404, 503]).toContain(res.statusCode);
    if (res.statusCode === 404) expect(res.json().error).toContain("Cliente");

    const malo = await app.inject({
      method: "GET",
      url: "/reports/client-statement/no-uuid",
      headers: auth(),
    });
    expect(malo.statusCode).toBe(400);
  });

  it("GET /reports/vehicle-history/:vehicleId → 404 (o 503 sin Chromium); uuid malo → 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/reports/vehicle-history/${NO_EXISTE}`,
      headers: auth(),
    });
    expect([404, 503]).toContain(res.statusCode);
    if (res.statusCode === 404) expect(res.json().error).toContain("Vehículo");

    const malo = await app.inject({
      method: "GET",
      url: "/reports/vehicle-history/no-uuid",
      headers: auth(),
    });
    expect(malo.statusCode).toBe(400);
  });
});

// ─── API misc (notifications, locale, break-even) ─────────

describe("Sprint 122 · API misc", () => {
  it("GET /api/notifications/poll → 200 {unreadCount}; sin tenant → 403", async () => {
    const sinTenant = await app.inject({ method: "GET", url: "/api/notifications/poll" });
    expect(sinTenant.statusCode).toBe(403);

    const res = await app.inject({
      method: "GET",
      url: "/api/notifications/poll",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.unreadCount).toBe(0);
    expect(typeof body.timestamp).toBe("string");
  });

  it("GET /api/notifications/stream → SSE con evento connected; sin tenant → 403", async () => {
    const sinTenant = await app.inject({ method: "GET", url: "/api/notifications/stream" });
    expect(sinTenant.statusCode).toBe(403);

    const ac = new AbortController();
    const res = await app.inject({
      method: "GET",
      url: "/api/notifications/stream",
      headers: auth(),
      payloadAsStream: true,
      signal: ac.signal,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");

    // light-my-request devuelve un stream de Node (no web ReadableStream);
    // el SSE nunca cierra → se lee el primer chunk y se aborta (patrón s121)
    const stream = res.stream();
    const first = await new Promise<string>((resolve, reject) => {
      stream.once("data", (chunk: Buffer | string) => resolve(String(chunk)));
      stream.once("error", reject);
    });
    expect(first).toContain('"type":"connected"');
    expect(first).toContain(TENANT);
    ac.abort();
    stream.destroy();
  });

  it("GET /api/v1/finance/dashboard/break-even → 200 {ok: true}", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/finance/dashboard/break-even",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.percentage).toBe("number");
    expect(typeof body.breakevenHit).toBe("boolean");
  });

  it("GET /api/v1/locale/es → 200 público (sin token); /xx → 404", async () => {
    // Bug de producción (Sprint 122): la ruta estaba fuera de PUBLIC_PATHS y
    // fuera de todo scope con resolveTenant → i18n.js + SW la fetchan sin
    // Authorization → authGate devolvía 401 SIEMPRE y las traducciones
    // ES/GU nunca cargaban. Fix: "/api/v1/locale/" en PUBLIC_PATHS.
    const sinToken = await app.inject({ method: "GET", url: "/api/v1/locale/es" });
    expect(sinToken.statusCode).toBe(200);
    expect(typeof sinToken.json()).toBe("object");

    const conToken = await app.inject({ method: "GET", url: "/api/v1/locale/es", headers: auth() });
    expect(conToken.statusCode).toBe(200);

    const ko = await app.inject({ method: "GET", url: "/api/v1/locale/xx", headers: auth() });
    expect(ko.statusCode).toBe(404);
    expect(ko.json().supported).toBeDefined();
  });
});

// ─── Suelto: dvi, marketing, mobile, email, label, sync,  ─
//     scheduling, fleet, 2fa (10 rutas)

describe("Sprint 122 · Módulos sueltos", () => {
  it("GET /dvi/orden/:ordenId → 200 array; uuid malo → 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/dvi/orden/${NO_EXISTE}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);

    const malo = await app.inject({
      method: "GET",
      url: "/dvi/orden/no-uuid",
      headers: auth(),
    });
    expect(malo.statusCode).toBe(400);
  });

  it("GET /marketing/sequences/:id/enrollments → 200 array; uuid malo → 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/marketing/sequences/${NO_EXISTE}/enrollments`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);

    const malo = await app.inject({
      method: "GET",
      url: "/marketing/sequences/no-uuid/enrollments",
      headers: auth(),
    });
    expect(malo.statusCode).toBe(400);
  });

  it("GET /mobile/push-tokens → 200 {tokens}", async () => {
    const res = await app.inject({ method: "GET", url: "/mobile/push-tokens", headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().tokens)).toBe(true);
  });

  it("GET /email/status → 200 {configured, providers}", async () => {
    const res = await app.inject({ method: "GET", url: "/email/status", headers: auth() });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.configured).toBe("boolean");
    expect(Array.isArray(body.providers)).toBe(true);
  });

  it("GET /label-printing/factura/:id inexistente → 404; uuid malo → 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/label-printing/factura/${NO_EXISTE}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain("Factura");

    const malo = await app.inject({
      method: "GET",
      url: "/label-printing/factura/no-uuid",
      headers: auth(),
    });
    expect(malo.statusCode).toBe(400);
  });

  it("GET /sync/config → 200 con estrategia de sincronización", async () => {
    const res = await app.inject({ method: "GET", url: "/sync/config", headers: auth() });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.strategy).toBe("last-write-wins");
    expect(typeof body.syncIntervalMs).toBe("number");
    expect(Array.isArray(body.supportedEntities)).toBe(true);
  });

  it("GET /scheduling/stats → 200 contadores", async () => {
    const res = await app.inject({ method: "GET", url: "/scheduling/stats", headers: auth() });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      today: expect.any(Number),
      totalActive: expect.any(Number),
    });
  });

  it("GET /fleet/:fleetId/contracts → 200 array; uuid malo → 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/fleet/${NO_EXISTE}/contracts`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);

    const malo = await app.inject({
      method: "GET",
      url: "/fleet/no-uuid/contracts",
      headers: auth(),
    });
    expect(malo.statusCode).toBe(400);
    expect(malo.json().error).toBe("ValidationError");
  });

  it("GET /2fa/time-remaining → 200 {remaining} en (0..30]", async () => {
    const res = await app.inject({ method: "GET", url: "/2fa/time-remaining", headers: auth() });
    expect(res.statusCode).toBe(200);
    const { remaining } = res.json();
    expect(typeof remaining).toBe("number");
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(30);
  });
});

// ─── SIFEN (2 POST: solo validación, sin llamada al DNIT) ─

describe("Sprint 122 · SIFEN validación", () => {
  it("POST /finance/sifen/nota-credito sin body → 400 (schema cdcOriginal 44 + motivo)", async () => {
    const vacio = await app.inject({
      method: "POST",
      url: "/finance/sifen/nota-credito",
      headers: auth(),
      payload: {},
    });
    expect(vacio.statusCode).toBe(400);

    const cdcCorto = await app.inject({
      method: "POST",
      url: "/finance/sifen/nota-credito",
      headers: auth(),
      payload: { cdcOriginal: "x", motivo: "devolución" },
    });
    expect(cdcCorto.statusCode).toBe(400);
  });

  it("POST /finance/sifen/contingencia/reenviar con cola vacía → 200 enviados 0", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/finance/sifen/contingencia/reenviar",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.enviados).toBe(0);
    expect(body.total).toBe(0);
    expect(typeof body.reenviadoEn).toBe("string");
  });
});
