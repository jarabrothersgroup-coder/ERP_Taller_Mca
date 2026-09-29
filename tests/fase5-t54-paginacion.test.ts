/**
 * T-54 — Contrato de paginación server-side de los listados del taller.
 *
 * Antes, `GET /workshop/clientes`, `/workshop/vehiculos` y `/workshop/ordenes`
 * devolvían un array plano, lo que obligaba a la UI a traer el listado entero
 * para filtrar en cliente. Con la paginación movida al servidor:
 *
 *  1. Los 3 endpoints responden un envelope `{ items, total, page, limit,
 *     totalPages }` (mismo contrato que `/inventory/repuestos`).
 *  2. `search` / `status` viajan al backend como query params.
 *  3. `page` es 1-based y `limit` está acotado a 100; fuera de rango → 400.
 *  4. El tenant se propaga al servicio (aislamiento multi-tenant).
 *
 * Los servicios están mockeados: aquí se valida el contrato HTTP y el
 * reenvío de query params, no el SQL (eso vive en los tests de servicio).
 *
 * @module tests/fase5-t54-paginacion
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

// ─── Mock de servicios (orden de llamadas registrado) ────────────────

const listClients = vi.fn();
const listVehicles = vi.fn();
const listOrdenes = vi.fn();

vi.mock("../src/modules/workshop/services/client.service.js", () => ({
  listClients: (...args: unknown[]) => listClients(...args),
  getClient: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
}));

vi.mock("../src/modules/workshop/services/vehicle.service.js", () => ({
  listVehicles: (...args: unknown[]) => listVehicles(...args),
  getVehicle: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
}));

vi.mock("../src/modules/workshop/services/orden.service.js", () => ({
  listOrdenes: (...args: unknown[]) => listOrdenes(...args),
  getOrden: vi.fn(),
}));

// Otros collaborators que las rutas importan al registrarse
vi.mock("../src/modules/workshop/services/history.service.js", () => ({
  getClientHistory: vi.fn(),
  getVehicleHistory: vi.fn(),
}));

vi.mock("../src/shared/middleware/rbac.js", () => ({
  requireManager: async () => undefined,
}));

const { clientesRoutes } = await import("../src/modules/workshop/routes/clientes.js");
const { vehiculosRoutes } = await import("../src/modules/workshop/routes/vehiculos.js");
const { ordenesRoutes } = await import("../src/modules/workshop/routes/ordenes.js");

// ─── Helpers ─────────────────────────────────────────────────────────

const TENANT = "taller-mca";

/** Envelope paginado mínimo, con la forma que espera el response schema */
function envelope(items: unknown[] = [], total = items.length) {
  return { items, total, page: 1, limit: 20, totalPages: Math.ceil(total / 20) };
}

/** Registra las 3 rutas de listado en una app Fastify con tenant resuelto */
async function buildApp() {
  const app = Fastify();
  app.decorateRequest("tenantSlug", null);
  app.addHook("onRequest", async (request) => {
    (request as { tenantSlug: string }).tenantSlug = TENANT;
  });
  await app.register(clientesRoutes);
  await app.register(vehiculosRoutes);
  await app.register(ordenesRoutes);
  await app.ready();
  return app;
}

describe("T-54 — contrato de paginación server-side", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listClients.mockResolvedValue(envelope());
    listVehicles.mockResolvedValue(envelope());
    listOrdenes.mockResolvedValue(envelope());
  });

  /* ── 1. Envelope en los 3 endpoints ─────────────────────────────── */

  it.each([
    ["/workshop/clientes", "clients"],
    ["/workshop/vehiculos", "vehicles"],
    ["/workshop/ordenes", "orders"],
  ])("GET %s responde un envelope paginado, no un array", async (url) => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(false);
    expect(body).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      page: expect.any(Number),
      limit: expect.any(Number),
      totalPages: expect.any(Number),
    });
    await app.close();
  });

  it("el envelope de clientes incluye los clientes de la página", async () => {
    listClients.mockResolvedValue(envelope([{ id: "c-1", name: "Juan" }], 1));
    const app = await buildApp();

    const body = (await app.inject({ method: "GET", url: "/workshop/clientes" })).json();

    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Juan");
    await app.close();
  });

  /* ── 2. Filtros que consultan el backend ────────────────────────── */

  it("GET /workshop/clientes propaga search, page y limit al servicio", async () => {
    const app = await buildApp();

    await app.inject({ method: "GET", url: "/workshop/clientes?search=juan&page=3&limit=10" });

    expect(listClients).toHaveBeenCalledWith(
      expect.objectContaining({ search: "juan", page: 3, limit: 10, tenantSlug: TENANT }),
    );
    await app.close();
  });

  it("GET /workshop/vehiculos propaga search y filtros al servicio", async () => {
    const app = await buildApp();

    await app.inject({ method: "GET", url: "/workshop/vehiculos?search=abc&engineType=HEV" });

    expect(listVehicles).toHaveBeenCalledWith(
      expect.objectContaining({ search: "abc", engineType: "HEV", page: 1, limit: 20 }),
      TENANT,
    );
    await app.close();
  });

  it("GET /workshop/ordenes propaga search y status al servicio", async () => {
    const app = await buildApp();

    await app.inject({ method: "GET", url: "/workshop/ordenes?search=toyota&status=En_Proceso" });

    expect(listOrdenes).toHaveBeenCalledWith(
      expect.objectContaining({ search: "toyota", status: "En_Proceso", page: 1, limit: 20 }),
      TENANT,
    );
    await app.close();
  });

  /* ── 3. Validación de page/limit ────────────────────────────────── */

  it.each([
    "/workshop/clientes?page=0",
    "/workshop/clientes?limit=0",
    "/workshop/clientes?limit=101",
    "/workshop/vehiculos?page=abc",
    "/workshop/ordenes?limit=999",
  ])("rechaza page/limit fuera de rango: %s", async (url) => {
    const app = await buildApp();

    const res = await app.inject({ method: "GET", url });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it.each([
    "/workshop/clientes?page=1&limit=100",
    "/workshop/vehiculos?page=2&limit=50",
    "/workshop/ordenes?limit=100",
  ])("acepta page/limit en rango: %s", async (url) => {
    const app = await buildApp();

    const res = await app.inject({ method: "GET", url });

    expect(res.statusCode).toBe(200);
    await app.close();
  });

  /* ── 4. Aislamiento multi-tenant ────────────────────────────────── */

  it.each([
    ["/workshop/clientes", "clients"],
    ["/workshop/vehiculos", "vehicles"],
    ["/workshop/ordenes", "orders"],
  ])("%s propaga el tenant resuelto a la capa de servicio", async (url, which) => {
    const app = await buildApp();

    await app.inject({ method: "GET", url });

    const call = { clients: listClients, vehicles: listVehicles, orders: listOrdenes }[
      which as "clients" | "vehicles" | "orders"
    ];
    const args = call.mock.calls[0] as unknown[];
    // clientes recibe el tenant dentro del objeto de filtros; vehículos y
    // órdenes lo reciben como segundo argumento posicional.
    const tenant =
      which === "clients" ? (args[0] as { tenantSlug?: string }).tenantSlug : args[1];
    expect(tenant).toBe(TENANT);
    await app.close();
  });
});
