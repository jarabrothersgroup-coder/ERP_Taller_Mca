/**
 * D1 — Tests de contrato de las variantes paginadas `fetchVehiclesPage` y
 * `fetchWorkOrdersPage`.
 *
 * Fijan el contrato que consumen las páginas `vehiculos` y `taller` en modo
 * `serverSide` del DataTable:
 *
 *  1. El envelope del backend (`{ items, total, page, totalPages }`) se
 *     preserva en vez de descartarse: la tabla necesita `total`/`totalPages`
 *     para navegar más allá de las primeras 100 filas.
 *  2. Cada request pide `limit=25` (página real) y propaga `page` base 1, a
 *     diferencia de las variantes T-54 que pedían 100 y paginaban en cliente.
 *  3. Los filtros (`search`/`brand`/`engineType`/`status`) viajan en la query.
 *  4. Fallback a mocks paginado (slice) sin filtro; con filtro activo y API
 *     caída devuelve vacío, porque un mock no respeta el filtro del servidor.
 *
 * @module web/tests/d1-server-side-pages
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** El tamaño de página D1 que el data-service debe pedir al backend */
const PAGE_SIZE = 25;

function mockFetch(response: unknown, ok = true, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(response) }));
}

/** URL del único fetch realizado por la llamada bajo prueba */
function lastUrl(): string {
  return String((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]);
}

async function freshDataService() {
  return await import("@/lib/data-service");
}

const vehicleRow = { id: "v-1", brand: "Toyota", model: "Corolla", plate: "ABC123", vin: null, clientId: "c-1", year: 2020, engineType: "Nafta", kilometraje: 100, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const orderRow = { id: "ot-1", cliente: "Juan", vehiculo: "Toyota Corolla", plate: "ABC123", status: "En_Proceso", createdAt: "2026-01-01", updatedAt: "2026-01-01" };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("D1 — fetchVehiclesPage", () => {
  it("preserva el envelope paginado (items mapeados + total/totalPages)", async () => {
    mockFetch({ items: [vehicleRow], total: 60, page: 2, limit: PAGE_SIZE, totalPages: 3 });
    const { fetchVehiclesPage } = await freshDataService();

    const result = await fetchVehiclesPage(() => [], undefined, { page: 2 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].brand).toBe("Toyota");
    expect(result.items[0].plate).toBe("ABC123");
    expect(result.total).toBe(60);
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(3);
  });

  it("pide limit=25 (página real, no el tope 100) y propaga page base 1", async () => {
    mockFetch({ items: [], total: 0, page: 3, limit: PAGE_SIZE, totalPages: 0 });
    const { fetchVehiclesPage } = await freshDataService();

    await fetchVehiclesPage(() => [], undefined, { page: 3 });

    expect(lastUrl()).toContain("/workshop/vehiculos?");
    expect(lastUrl()).toContain(`limit=${PAGE_SIZE}`);
    expect(lastUrl()).toContain("page=3");
  });

  it("default a page=1 cuando no se pasa página", async () => {
    mockFetch({ items: [], total: 0, page: 1, limit: PAGE_SIZE, totalPages: 0 });
    const { fetchVehiclesPage } = await freshDataService();

    await fetchVehiclesPage(() => []);

    expect(lastUrl()).toContain("page=1");
  });

  it("propaga search/brand/engineType al backend", async () => {
    mockFetch({ items: [], total: 0, page: 1, limit: PAGE_SIZE, totalPages: 0 });
    const { fetchVehiclesPage } = await freshDataService();

    await fetchVehiclesPage(() => [], undefined, { search: "corolla", brand: "Toyota", engineType: "HEV" });

    expect(lastUrl()).toContain("search=corolla");
    expect(lastUrl()).toContain("brand=Toyota");
    expect(lastUrl()).toContain("engineType=HEV");
  });

  it("fallback a mocks paginado (slice) cuando la API no responde y no hay filtro", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const { fetchVehiclesPage } = await freshDataService();
    const mocks = Array.from({ length: 60 }, (_, i) => ({
      id: `v-${i + 1}`,
      plate: `MOCK${i + 1}`,
      vin: null,
      brand: "Toyota",
      model: "Corolla",
      year: 2020,
      engineType: "Nafta",
      kilometraje: 0,
      clientId: "c-1",
      createdAt: "1/1/2026",
    }));

    const result = await fetchVehiclesPage(() => mocks, undefined, { page: 2 });

    expect(result.items).toHaveLength(25);
    expect(result.items[0].id).toBe("v-26");
    expect(result.total).toBe(60);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(2);
  });

  it("con filtro activo y API caída devuelve vacío (el mock no respeta el filtro)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const { fetchVehiclesPage } = await freshDataService();
    const mock = vi.fn(() => [{ id: "mock", brand: "Mock", model: "Mock", plate: "M1", vin: null, year: 2020, engineType: "Nafta", kilometraje: 0, clientId: "c", createdAt: "1/1/2026" }]);

    const result = await fetchVehiclesPage(mock, undefined, { search: "corolla" });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(mock).toHaveBeenCalled();
  });
});

describe("D1 — fetchWorkOrdersPage", () => {
  it("preserva el envelope y mapea status/joined fields", async () => {
    mockFetch({ items: [orderRow], total: 40, page: 1, limit: PAGE_SIZE, totalPages: 2 });
    const { fetchWorkOrdersPage } = await freshDataService();

    const result = await fetchWorkOrdersPage(() => []);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].client).toBe("Juan");
    expect(result.items[0].vehicle).toBe("Toyota Corolla");
    expect(result.items[0].status).toBe("in_progress");
    expect(result.total).toBe(40);
    expect(result.totalPages).toBe(2);
  });

  it("pide limit=25 y propaga search/status/page", async () => {
    mockFetch({ items: [], total: 0, page: 2, limit: PAGE_SIZE, totalPages: 0 });
    const { fetchWorkOrdersPage } = await freshDataService();

    await fetchWorkOrdersPage(() => [], undefined, { search: "juan", status: "En_Proceso", page: 2 });

    expect(lastUrl()).toContain("/workshop/ordenes?");
    expect(lastUrl()).toContain(`limit=${PAGE_SIZE}`);
    expect(lastUrl()).toContain("search=juan");
    expect(lastUrl()).toContain("status=En_Proceso");
    expect(lastUrl()).toContain("page=2");
  });

  it("fallback a mocks paginado sin filtro", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const { fetchWorkOrdersPage } = await freshDataService();
    const mocks = Array.from({ length: 30 }, (_, i) => ({
      id: `ot-${i + 1}`,
      client: `Cliente ${i + 1}`,
      vehicle: "Toyota Corolla",
      plate: "ABC 123",
      year: 2024,
      service: "Service",
      status: "in_progress" as const,
      technician: "Sin asignar",
      deadline: "Pendiente",
      estimatedCost: 0,
      createdAt: "1/1/2026",
    }));

    const result = await fetchWorkOrdersPage(() => mocks, undefined, { page: 2 });

    expect(result.items).toHaveLength(5);
    expect(result.items[0].id).toBe("ot-26");
    expect(result.total).toBe(30);
    expect(result.totalPages).toBe(2);
  });

  it("con status activo y API caída devuelve vacío", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const { fetchWorkOrdersPage } = await freshDataService();
    const mock = vi.fn(() => []);

    const result = await fetchWorkOrdersPage(mock, undefined, { status: "Listo" });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});
