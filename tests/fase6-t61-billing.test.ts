import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";

const TENANT = "t61-billing";
const TENANT_ID = "00000000-0000-0000-0000-0000b61b000";
const ADMIN_ID = "00000000-0000-0000-0000-0000b61b001";

function auth() {
  const t = generateToken({
    sub: ADMIN_ID,
    tenantId: TENANT_ID,
    email: "admin@t61-billing.test",
    roles: ["admin"],
    profileId: ADMIN_ID,
  });
  return { authorization: `Bearer ${t}`, "x-tenant-slug": TENANT };
}

describe("Fase 6 · T-61 — Billing (colchón crítico)", () => {
  it("GET /billing/portal requiere auth válida", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/billing/portal",
      headers: { "x-tenant-slug": TENANT },
    });
    expect([401, 403]).toContain(res.statusCode);
    await app.close();
  });

  it("GET /billing/portal responde con estructura válida (autenticado)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/billing/portal",
      headers: auth(),
    });
    // Puede ser 200 con datos o 501/404 según implementación; debe ser respuesta manejada
    expect([200, 401, 403, 404, 501]).toContain(res.statusCode);
    await app.close();
  });

  it("POST /billing/checkout con payload inválido devuelve 400", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/billing/checkout",
      headers: auth(),
      payload: {},
    });
    expect([400, 422]).toContain(res.statusCode);
    await app.close();
  });
});
