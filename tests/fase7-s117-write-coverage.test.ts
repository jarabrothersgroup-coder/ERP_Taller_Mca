/**
 * Sprint 117 — Cobertura de escritura lote 4 (backlog T-61).
 *
 * 15 ops de escritura sin test: 7 WhatsApp (templates CRUD + followups),
 * 3 marketing sequences (PATCH/DELETE/run), 2 CRM sync (sync/:ordenId +
 * retry), 2 Thinkcar (link + assign), 1 white-label upsert.
 * Patrón fase7 (tenant propio "e2e-s117", fixtures SQL idempotentes,
 * app.inject con template literals para el scanner de T-63).
 *
 * Rutas cubiertas:
 *   - POST   /whatsapp/templates
 *   - POST   /whatsapp/templates/preview
 *   - POST   /whatsapp/templates/seed
 *   - DELETE /whatsapp/templates/:key
 *   - POST   /whatsapp/followups
 *   - POST   /whatsapp/followups/:id/cancel
 *   - POST   /whatsapp/followups/process
 *   - PATCH  /marketing/sequences/:id
 *   - DELETE /marketing/sequences/:id
 *   - POST   /marketing/sequences/run
 *   - POST   /crm/sync/:ordenId
 *   - POST   /crm/retry
 *   - POST   /thinkcar/imports/:id/link
 *   - POST   /thinkcar/pending/:id/assign
 *   - PUT    /enterprise/white-label
 *
 * @module tests/fase7-s117-write-coverage
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s117";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f117";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4f11e";
const ADMIN_EMAIL = "admin@e2e-s117.test";
const CLIENTE = "00000000-0000-0000-0000-0000c11e4f17";
const VEHICULO = "00000000-0000-0000-0000-0000c11e4f18";
const OT_ID = "00000000-0000-0000-0000-0000c11e4f19";
const IMPORT_ID = "00000000-0000-0000-0000-0000c11e4f1a";
const IMPORT_ID2 = "00000000-0000-0000-0000-0000c11e4f1b";
const SEQ_ID = "00000000-0000-0000-0000-0000c11e4f1c";
const TS = Date.now().toString(36);

let app: FastifyInstance;
let bearer: string;
let followupId: string;

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

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Sprint 117', ${TENANT}, 'tenant_e2e_s117', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 117', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;
  // Cadena cliente→vehículo→OT para thinkcar assign
  await sql`INSERT INTO clients (id, name, tenant_slug)
    VALUES (${CLIENTE}, ${"Cliente T117"}, ${TENANT}) ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO vehiculos (id, client_id, brand, model, engine_type, tenant_slug)
    VALUES (${VEHICULO}, ${CLIENTE}, ${"Toyota"}, ${"Corolla"}, ${"Nafta"}, ${TENANT})
    ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO ordenes_trabajo (id, vehicle_id, client_id, status, tenant_slug)
    VALUES (${OT_ID}, ${VEHICULO}, ${CLIENTE}, ${"En_Proceso"}, ${TENANT})
    ON CONFLICT (id) DO NOTHING`;
  // Dos thinkcar_imports (link y assign)
  await sql`INSERT INTO thinkcar_imports (id, file_name, file_hash, source_channel, status, pending_assignment)
    VALUES (${IMPORT_ID}, ${`scan-${TS}.json`}, ${`hash-link-${TS}`}, 'usb', 'pending', false)
    ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO thinkcar_imports (id, file_name, file_hash, source_channel, status, pending_assignment)
    VALUES (${IMPORT_ID2}, ${`scan2-${TS}.json`}, ${`hash-assign-${TS}`}, 'usb', 'pending', true)
    ON CONFLICT (id) DO NOTHING`;
  // Secuencia marketing fixture
  await sql`INSERT INTO marketing_sequences (id, tenant_slug, nombre, trigger_event)
    VALUES (${SEQ_ID}, ${TENANT}, ${`Sec T117 ${TS}`}, 'manual')
    ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO marketing_sequence_steps (sequence_id, tenant_slug, orden, delay_days, tipo, mensaje)
    VALUES (${SEQ_ID}, ${TENANT}, 1, 0, 'whatsapp', 'Hola {{nombre}}')
    ON CONFLICT DO NOTHING`;

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

afterAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`DELETE FROM whatsapp_followups WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM whatsapp_templates WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM marketing_sequence_enrollments WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM marketing_sequence_steps WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM marketing_sequences WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM crm_sync_log WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM thinkcar_imports WHERE id IN (${IMPORT_ID}, ${IMPORT_ID2})`;
  await sql`DELETE FROM white_label_config WHERE tenant_slug = ${TENANT}`;
  await sql`DELETE FROM ordenes_trabajo WHERE id = ${OT_ID}`;
  await sql`DELETE FROM vehiculos WHERE id = ${VEHICULO}`;
  await sql`DELETE FROM clients WHERE id = ${CLIENTE}`;
  await sql`DELETE FROM profiles WHERE id = ${ADMIN_ID}`;
  await sql`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
  await app?.close();
});

// ─── WhatsApp templates ───────────────────────────────────

describe("Sprint 117 · WhatsApp templates", () => {
  it("POST /whatsapp/templates crea template (201)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/templates",
      headers: auth(),
      payload: {
        key: `t117-${TS}`,
        name: "Test T117",
        body: "Hola {{nombre}}, tu {{vehiculo}} está listo.",
        category: "ordenes",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.key).toBe(`t117-${TS}`);
    expect(body.name).toBe("Test T117");
    expect(body.active).toBe(true);
    expect(body.variables).toContain("nombre");
  });

  it("POST /whatsapp/templates sin key/name/body → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/templates",
      headers: auth(),
      payload: { name: "Sin key" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /whatsapp/templates/preview extrae variables y renderiza", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/templates/preview",
      headers: auth(),
      payload: {
        body: "Hola {{nombre}}, tu {{vehiculo}} está listo.",
        sampleData: { nombre: "Juan", vehiculo: "Toyota Corolla" },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.preview).toContain("Juan");
    expect(body.preview).toContain("Toyota Corolla");
    expect(body.variables).toEqual(["nombre", "vehiculo"]);
  });

  it("POST /whatsapp/templates/preview sin body → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/templates/preview",
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /whatsapp/templates/seed crea defaults idempotente", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/templates/seed",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.seeded).toBe("number");
    expect(body.seeded).toBeGreaterThanOrEqual(0);
    // Segunda corrida: no debe crear duplicados
    const res2 = await app.inject({
      method: "POST",
      url: "/whatsapp/templates/seed",
      headers: auth(),
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().seeded).toBe(0);
  });

  it("DELETE /whatsapp/templates/:key elimina template", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/whatsapp/templates/t117-${TS}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });
});

// ─── WhatsApp followups ───────────────────────────────────

describe("Sprint 117 · WhatsApp followups", () => {
  it("POST /whatsapp/followups programa follow-up (201)", async () => {
    // Crear template primero
    await app.inject({
      method: "POST",
      url: "/whatsapp/templates",
      headers: auth(),
      payload: {
        key: `fu-${TS}`,
        name: "Follow-up T117",
        body: "Hola {{nombre}}, te recordamos tu servicio.",
      },
    });

    const future = new Date(Date.now() + 3600_000).toISOString();
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/followups",
      headers: auth(),
      payload: {
        templateKey: `fu-${TS}`,
        phone: "+595981123456",
        variables: { nombre: "Juan" },
        scheduledAt: future,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    followupId = body.id;
    expect(body.status).toBe("SCHEDULED");
    expect(body.filledBody).toContain("Juan");
  });

  it("POST /whatsapp/followups sin campos requeridos → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/followups",
      headers: auth(),
      payload: { phone: "+595981" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /whatsapp/followups/:id/cancel cancela follow-up", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/whatsapp/followups/${followupId}/cancel`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("POST /whatsapp/followups/process procesa vencidos (0 si no hay)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/whatsapp/followups/process",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().processed).toBe("number");
  });
});

// ─── Marketing sequences ──────────────────────────────────

describe("Sprint 117 · Marketing sequences", () => {
  it("PATCH /marketing/sequences/:id actualiza nombre", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/marketing/sequences/${SEQ_ID}`,
      headers: auth(),
      payload: { nombre: `Sec T117 upd ${TS}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("PATCH /marketing/sequences/:id inexistente → 404", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/marketing/sequences/00000000-0000-0000-0000-00000000dead",
      headers: auth(),
      payload: { nombre: "X" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /marketing/sequences/run procesa enrollments vencidos", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/marketing/sequences/run",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().processed).toBe("number");
  });

  it("DELETE /marketing/sequences/:id elimina secuencia", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/marketing/sequences/${SEQ_ID}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});

// ─── CRM sync ─────────────────────────────────────────────

describe("Sprint 117 · CRM sync", () => {
  it("POST /crm/sync/:ordenId sin CRM externo → 500 con CrmSyncError", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/crm/sync/${OT_ID}`,
      headers: auth(),
    });
    // Sin credenciales CRM configuradas el worker falla gracefully
    expect([201, 500]).toContain(res.statusCode);
    if (res.statusCode === 500) {
      const body = res.json();
      expect(body.error).toBe("CrmSyncError");
      expect(body.message).toBeTruthy();
    }
  });

  it("POST /crm/retry reintenta syncs fallidos (0 si no hay)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/retry",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(typeof body.retried).toBe("number");
    expect(typeof body.succeeded).toBe("number");
  });
});

// ─── Thinkcar ─────────────────────────────────────────────

describe("Sprint 117 · Thinkcar", () => {
  it("POST /thinkcar/imports/:id/link vincula import por vin", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/thinkcar/imports/${IMPORT_ID}/link`,
      headers: auth(),
      payload: { vin: "1HGCM82633A004352" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("linked");
  });

  it("POST /thinkcar/imports/:id/link inexistente → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/thinkcar/imports/00000000-0000-0000-0000-00000000dead/link",
      headers: auth(),
      payload: { vin: "X" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /thinkcar/pending/:id/assign asigna import a OT", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/thinkcar/pending/${IMPORT_ID2}/assign`,
      headers: auth(),
      payload: { ordenTrabajoId: OT_ID },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("linked");
  });

  it("POST /thinkcar/pending/:id/assign sin ordenTrabajoId → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/thinkcar/pending/${IMPORT_ID2}/assign`,
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Enterprise white-label ───────────────────────────────

describe("Sprint 117 · Enterprise white-label", () => {
  it("PUT /enterprise/white-label upsert config", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/enterprise/white-label",
      headers: auth(),
      payload: {
        companyName: "Taller T117",
        primaryColor: "#ff0000",
        accentColor: "#00ff00",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.companyName).toBe("Taller T117");
    expect(body.primaryColor).toBe("#ff0000");
  });

  it("PUT /enterprise/white-label actualiza config existente (upsert)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/enterprise/white-label",
      headers: auth(),
      payload: {
        companyName: "Taller T117 v2",
        primaryColor: "#0000ff",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().companyName).toBe("Taller T117 v2");
    expect(res.json().primaryColor).toBe("#0000ff");
  });
});
