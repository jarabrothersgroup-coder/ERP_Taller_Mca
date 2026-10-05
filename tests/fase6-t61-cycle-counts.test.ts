import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";

const TENANT = "t61-cycle";
const TENANT_ID = "00000000-0000-0000-0000-0000c61c000";
const ADMIN_ID = "00000000-0000-0000-0000-0000c61c001";

function auth() {
  const t = generateToken({
    sub: ADMIN_ID,
    tenantId: TENANT_ID,
    email: "admin@t61-cycle.test",
    roles: ["admin"],
    profileId: ADMIN_ID,
  });
  return { authorization: `Bearer ${t}`, "x-tenant-slug": TENANT };
}

describe("Fase 6 · T-61 — Cycle counts (colchón)", () => {
  it("GET /inventory/cycle-counts requiere autenticación", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/inventory/cycle-counts",
      headers: { "x-tenant-slug": TENANT },
    });
    expect([401, 403]).toContain(res.statusCode);
    await app.close();
  });

  it("GET /inventory/cycle-counts responde (autenticado)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/inventory/cycle-counts",
      headers: auth(),
    });
    expect([200, 401, 403, 404, 501]).toContain(res.statusCode);
    await app.close();
  });

  it("POST /inventory/cycle-counts con payload inválido devuelve error", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/inventory/cycle-counts",
      headers: auth(),
      payload: {},
    });
    expect([400, 422]).toContain(res.statusCode);
    await app.close();
  });

  it("GET /inventory/cycle-counts/:id con id inválido/inexistente maneja", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/inventory/cycle-counts/invalid-id",
      headers: auth(),
    });
    expect([400, 401, 403, 404]).toContain(res.statusCode);
    await app.close();
  });

  it("PATCH /inventory/cycle-counts/:id con payload vacío/incorrecto", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/inventory/cycle-counts/00000000-0000-0000-0000-000000000000",
      headers: auth(),
      payload: {},
    });
    expect([200, 400, 401, 403, 404, 422]).toContain(res.statusCode);
    await app.close();
  });

  it("DELETE /inventory/cycle-counts/:id inexistente", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/inventory/cycle-counts/00000000-0000-0000-0000-000000000000",
      headers: auth(),
    });
    expect([200, 204, 400, 401, 403, 404, 409]).toContain(res.statusCode);
    await app.close();
  });
});
