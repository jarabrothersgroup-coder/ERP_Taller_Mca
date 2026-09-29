/**
 * T-54 — Tests del data-service: filtros y paginación server-side.
 *
 * `fetchClients` / `fetchVehicles` / `fetchWorkOrders` ahora hablan con los
 * endpoints paginados del backend, que responden un envelope
 * `{ items, total, page, limit, totalPages }`. Estos tests fijan ese contrato:
 *
 *  1. Se devuelve `items` (no el envelope entero).
 *  2. `search` / `status` viajan en la query string → el filtrado ocurre en el
 *     servidor, no en el cliente.
 *  3. El fetch va acotado a `T54_MAX_LIMIT` (100) para no traer el catálogo
 *     entero al navegador.
 *  4. Con filtro activo se desactiva el fallback a mocks: un mock no respeta
 *     el filtro del servidor y devolvería filas que el backend no devolvió.
 *  5. Se tolera una respuesta array plano (compatibilidad hacia atrás).
 *
 * @module web/tests/t54-server-side-filters
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** El límite que el data-service pide a los listados paginados */
const MAX_LIMIT = 100;

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

const clientRow = { id: "c-1", name: "Juan", email: null, phone: null, ruc: null, address: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const vehicleRow = { id: "v-1", brand: "Toyota", model: "Corolla", plate: "ABC123", vin: null, clientId: "c-1", year: 2020, engineType: "Nafta", kilometraje: 100, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const orderRow = { id: "ot-1", cliente: "Juan", vehiculo: "Toyota Corolla", plate: "ABC123", status: "En_Proceso", createdAt: "2026-01-01", updatedAt: "2026-01-01" };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("T-54 — fetchClients con paginación server-side", () => {
  it("desenvuelve `items` del envelope paginado", async () => {
    mockFetch({ items: [clientRow], total: 1, page: 1, limit: MAX_LIMIT, totalPages: 1 });
    const { fetchClients } = await freshDataService();

    const result = await fetchClients(() => []);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Juan");
  });

  it("envía la búsqueda al backend en vez de filtrar en cliente", async () => {
    mockFetch({ items: [], total: 0, page: 1, limit: MAX_LIMIT, totalPages: 0 });
    const { fetchClients } = await freshDataService();

    await fetchClients(() => [], undefined, { search: "juan" });

    expect(lastUrl()).toContain("/workshop/clientes?");
    expect(lastUrl()).toContain("search=juan");
    expect(lastUrl()).toContain(`limit=${MAX_LIMIT}`);
  });

  it("acota la petición a 100 filas incluso sin filtros", async () => {
    mockFetch({ items: [], total: 0, page: 1, limit: MAX_LIMIT, totalPages: 0 });
    const { fetchClients } = await freshDataService();

    await fetchClients(() => []);

    expect(lastUrl()).toContain(`limit=${MAX_LIMIT}`);
  });

  it("desactiva el fallback a mocks cuando hay búsqueda activa", async () => {
    // Ante un error de red con filtro activo devuelve lista vacía en vez del
    // mock: un mock no respeta el filtro del servidor, así que mostraría filas
    // que el backend nunca devolvió.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const { fetchClients } = await freshDataService();
    const mock = vi.fn(() => [{ id: "mock", name: "Mock" } as never]);

    const result = await fetchClients(mock, undefined, { search: "juan" });

    expect(result).toEqual([]);
    expect(mock).not.toHaveBeenCalled();
  });

  it("tolera una respuesta array plano (contrato viejo)", async () => {
    mockFetch([clientRow]);
    const { fetchClients } = await freshDataService();

    const result = await fetchClients(() => []);

    expect(result).toHaveLength(1);
  });
});

describe("T-54 — fetchVehicles con paginación server-side", () => {
  it("desenvuelve `items` del envelope paginado", async () => {
    mockFetch({ items: [vehicleRow], total: 1, page: 1, limit: MAX_LIMIT, totalPages: 1 });
    const { fetchVehicles } = await freshDataService();

    const result = await fetchVehicles(() => []);

    expect(result).toHaveLength(1);
    expect(result[0].brand).toBe("Toyota");
  });

  it("envía search y brand al backend", async () => {
    mockFetch({ items: [], total: 0, page: 1, limit: MAX_LIMIT, totalPages: 0 });
    const { fetchVehicles } = await freshDataService();

    await fetchVehicles(() => [], undefined, { search: "corolla", brand: "Toyota" });

    const url = lastUrl();
    expect(url).toContain("/workshop/vehiculos?");
    expect(url).toContain("search=corolla");
    expect(url).toContain("brand=Toyota");
  });
});

describe("T-54 — fetchWorkOrders con paginación server-side", () => {
  it("desenvuelve `items` del envelope paginado", async () => {
    mockFetch({ items: [orderRow], total: 1, page: 1, limit: MAX_LIMIT, totalPages: 1 });
    const { fetchWorkOrders } = await freshDataService();

    const result = await fetchWorkOrders(() => []);

    expect(result).toHaveLength(1);
    expect(result[0].client).toBe("Juan");
  });

  it("envía status y search al backend (filtro por estado server-side)", async () => {
    mockFetch({ items: [], total: 0, page: 1, limit: MAX_LIMIT, totalPages: 0 });
    const { fetchWorkOrders } = await freshDataService();

    await fetchWorkOrders(() => [], undefined, { status: "En_Proceso", search: "toyota" });

    const url = lastUrl();
    expect(url).toContain("/workshop/ordenes?");
    expect(url).toContain("status=En_Proceso");
    expect(url).toContain("search=toyota");
  });

  it("propaga la página solicitada", async () => {
    mockFetch({ items: [], total: 200, page: 3, limit: MAX_LIMIT, totalPages: 2 });
    const { fetchWorkOrders } = await freshDataService();

    await fetchWorkOrders(() => [], undefined, { page: 3 });

    expect(lastUrl()).toContain("page=3");
  });
});
