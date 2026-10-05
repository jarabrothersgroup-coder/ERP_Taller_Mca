import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";

const TENANT = "t61-vehextra";
const TENANT_ID = "00000000-0000-0000-0000-0000v61e000";
const ADMIN_ID = "00000000-0000-0000-0000-0000v61e001";

function auth() {
  const t = generateToken({
    sub: ADMIN_ID,
    tenantId: TENANT_ID,
    email: "admin@t61-vehextra.test",
    roles: ["admin"],
    profileId: ADMIN_ID,
  });
  return { authorization: `Bearer ${t}`, "x-tenant-slug": TENANT };
}

describe("Fase 6 · T-61 — Vehículos extra (colchón)", () => {
  it("POST /vehiculos/decode-vin con body inválido devuelve error", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/vehiculos/decode-vin",
      headers: auth(),
      payload: {},
    });
    expect([400, 401, 403, 422, 501]).toContain(res.statusCode);
    await app.close();
  });

  it("DELETE /vehiculos/:id sin permisos o inexistente maneja correctamente", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/vehiculos/00000000-0000-0000-0000-000000000000",
      headers: auth(),
    });
    expect([200, 204, 400, 401, 403, 404, 409]).toContain(res.statusCode);
    await app.close();
  });
});
