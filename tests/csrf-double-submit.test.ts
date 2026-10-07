/**
 * B1 — CSRF double-submit cookie: verificación en runtime.
 *
 * `@fastify/cookie` quedó registrado en `app.ts` pero nada ejercitaba el
 * ciclo completo en runtime: emisión de la cookie `_csrf` en `onResponse`,
 * bypass para `Authorization: Bearer`, y rechazo (403) cuando el header no
 * coincide con la cookie. Estos tests fijan ese comportamiento para que una
 * regresión de orden de registro (cookie antes que hook) no pase inadvertida.
 *
 * @module tests/csrf-double-submit
 */
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";

const CSRF_COOKIE = "_csrf";
const CSRF_HEADER = "x-csrf-token";

describe("B1 · CSRF double-submit cookie", () => {
  it("emite la cookie _csrf en respuestas normales", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });

    // `/health` cae tras el gate global de autenticación (401); lo que se
    // verifica aquí es la emisión de la cookie, no el status.
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const raw = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
    expect(raw).toContain(CSRF_COOKIE);
    await app.close();
  });

  it("exento: login sin token CSRF no devuelve 403 de CSRF", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "nadie@example.test", password: "incorrecta" },
    });

    // `/api/auth/login` está en CSRF_EXEMPT_PATHS: el rechazo (422 por
    // validación de tenantSlug) viene del handler, no del hook CSRF. Un 403
    // aquí significaría que la lista de exenciones dejó de aplicarse.
    expect(res.statusCode).not.toBe(403);
    expect(res.json().error).not.toBe("CSRFError");
    await app.close();
  });

  it("bypass: Authorization Bearer salta la verificación CSRF", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/vehiculos",
      headers: { authorization: "Bearer token-invalido-a-proposito" },
      payload: {},
    });

    // Si el hook CSRF interceptara, sería 403 CSRFError. Con Bearer el flujo
    // sigue hasta la auth, así que responde 401 por el token inválido.
    expect(res.statusCode).not.toBe(403);
    await app.close();
  });

  it("POST sin cookie ni header devuelve 403 CSRFError", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/vehiculos",
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("CSRFError");
    await app.close();
  });

  it("POST con cookie y header distintos devuelve 403 CSRFError", async () => {
    const app = await buildApp();
    const seed = await app.inject({ method: "GET", url: "/health" });
    const raw = String(
      Array.isArray(seed.headers["set-cookie"])
        ? seed.headers["set-cookie"][0]
        : seed.headers["set-cookie"],
    );
    const cookieValue = raw.split(";")[0]?.split("=")[1] ?? "";

    const res = await app.inject({
      method: "POST",
      url: "/vehiculos",
      headers: {
        cookie: `${CSRF_COOKIE}=${cookieValue}`,
        [CSRF_HEADER]: "valor-que-no-coincide",
      },
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe("Token CSRF inválido");
    await app.close();
  });

  it("POST con cookie y header coincidentes pasa la verificación CSRF", async () => {
    const app = await buildApp();
    const seed = await app.inject({ method: "GET", url: "/health" });
    const raw = String(
      Array.isArray(seed.headers["set-cookie"])
        ? seed.headers["set-cookie"][0]
        : seed.headers["set-cookie"],
    );
    const cookieValue = raw.split(";")[0]?.split("=")[1] ?? "";
    expect(cookieValue).not.toBe("");

    const res = await app.inject({
      method: "POST",
      url: "/vehiculos",
      headers: {
        cookie: `${CSRF_COOKIE}=${cookieValue}`,
        [CSRF_HEADER]: cookieValue,
      },
      payload: {},
    });

    // Ya no es el hook el que rechaza: la petición llega al handler (validación
    // de sesión o de body), que es exactamente lo que se quiere comprobar.
    expect(res.statusCode).not.toBe(403);
    await app.close();
  });
});