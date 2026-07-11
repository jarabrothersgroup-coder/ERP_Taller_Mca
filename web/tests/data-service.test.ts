/**
 * Tests for data-service.ts
 *
 * Covers:
 *   - fetchOrMock: API success, API timeout, API error → mock fallback
 *   - Mappers: mapWorkOrderFromApi, mapInventoryFromApi, mapInvoiceFromApi
 *   - Tenant slug resolution
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock fetch global ─────────────────────────

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(response: unknown, ok = true, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(response),
  });
}

function mockFetchError(message = "Network error") {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error(message));
}

// ── fetchOrMock ───────────────────────────────

describe("fetchOrMock", () => {
  it("returns API data on successful fetch", async () => {
    // We test via fetchWorkOrders which uses fetchOrMock internally
    mockFetch([{ id: "1", cliente: "Test", status: "En_Proceso" }]);

    // Dynamic import to use fresh modules with mocked fetch
    const { fetchWorkOrders } = await import("@/lib/data-service");
    const mockFactory = () => [{ id: "mock-1", client: "Mock", vehicle: "Mock", plate: "", year: 2024, service: "", status: "pending" as const, technician: "", deadline: "", estimatedCost: 0, createdAt: "" }];

    const result = await fetchWorkOrders(mockFactory);

    expect(result).toHaveLength(1);
    expect(result[0].client).toBe("Test");
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("falls back to mock data on network error", async () => {
    mockFetchError();

    const { fetchWorkOrders } = await import("@/lib/data-service");
    const mockFactory = () => [{ id: "mock-1", client: "Mock Client", vehicle: "Mock", plate: "", year: 2024, service: "", status: "pending" as const, technician: "", deadline: "", estimatedCost: 0, createdAt: "" }];

    const result = await fetchWorkOrders(mockFactory);

    expect(result).toHaveLength(1);
    expect(result[0].client).toBe("Mock Client");
  });

  it("falls back to mock data on HTTP error", async () => {
    mockFetch({ error: "Not found" }, false, 404);

    const { fetchWorkOrders } = await import("@/lib/data-service");
    const mockFactory = () => [{ id: "mock-1", client: "Fallback", vehicle: "Mock", plate: "", year: 2024, service: "", status: "pending" as const, technician: "", deadline: "", estimatedCost: 0, createdAt: "" }];

    const result = await fetchWorkOrders(mockFactory);

    expect(result).toHaveLength(1);
    expect(result[0].client).toBe("Fallback");
  });

  it("falls back to mock data on timeout", async () => {
    // Simulate slow response (longer than 1s timeout)
    globalThis.fetch = vi.fn().mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
    );

    const { fetchWorkOrders } = await import("@/lib/data-service");
    const mockFactory = () => [{ id: "mock-1", client: "Timeout Fallback", vehicle: "Mock", plate: "", year: 2024, service: "", status: "pending" as const, technician: "", deadline: "", estimatedCost: 0, createdAt: "" }];

    const result = await fetchWorkOrders(mockFactory);
    expect(result).toHaveLength(1);
    expect(result[0].client).toBe("Timeout Fallback");
  }, 10000); // 10s timeout for this test
});

// ── Tenant slug cache ─────────────────────────

describe("setTenantSlug / getTenantSlug", () => {
  it("stores and retrieves tenant slug", async () => {
    const { setTenantSlug, fetchInvoices } = await import("@/lib/data-service");
    setTenantSlug("test-tenant");

    mockFetch([]);
    const mockFactory = () => [];

    await fetchInvoices(mockFactory);

    // Verify the X-Tenant-Slug header was sent
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]?.headers?.["X-Tenant-Slug"]).toBe("test-tenant");
  });
});

// ── Mappers ───────────────────────────────────

describe("Mappers", () => {
  describe("mapWorkOrderFromApi", () => {
    it("maps backend work order to UI shape", async () => {
      mockFetch([{
        id: "abc-123",
        cliente: "Juan Pérez",
        vehiculo: "Toyota Corolla",
        plate: "ABC 123",
        description: "Cambio de aceite",
        status: "En_Proceso",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]);

      const { fetchWorkOrders } = await import("@/lib/data-service");
      const result = await fetchWorkOrders(() => []);

      expect(result[0].client).toBe("Juan Pérez");
      expect(result[0].vehicle).toBe("Toyota Corolla");
      expect(result[0].plate).toBe("ABC 123");
      expect(result[0].status).toBe("in_progress");
    });
  });

  describe("mapInventoryFromApi", () => {
    it("maps backend inventory item to UI shape", async () => {
      mockFetch({ items: [{
        id: "inv-1",
        codigo: "PZ-001",
        descripcion: "Pastillas de Freno",
        marca: "Bosch",
        categoria: "Frenos",
        stockActual: 5,
        stockMinimo: 10,
        precioVenta: "85000",
        ubicacion: "A1-01",
      }]});

      const { fetchInventoryItems } = await import("@/lib/data-service");
      const result = await fetchInventoryItems(() => []);

      expect(result[0].name).toBe("Pastillas de Freno");
      expect(result[0].stock).toBe(5);
      expect(result[0].minStock).toBe(10);
      expect(result[0].status).toBe("low");
      expect(result[0].price).toBe(85000);
    });
  });

  describe("mapInvoiceFromApi", () => {
    it("maps backend invoice to UI shape", async () => {
      mockFetch([{
        id: "fac-1",
        total: "450000",
        sifenStatus: "APROBADO_DNIT",
        estadoPago: "PAGADA",
        tipo: "ELECTRONICA",
        ordenId: "ot-1",
        createdAt: new Date().toISOString(),
      }]);

      const { fetchInvoices } = await import("@/lib/data-service");
      const result = await fetchInvoices(() => []);

      expect(result[0].total).toBe(450000);
      expect(result[0].estado).toBe("APROBADO_DNIT");
      expect(result[0].tipo).toBe("ELECTRONICA");
    });
  });

  describe("mapClientFromApi", () => {
    it("maps backend client to UI shape", async () => {
      mockFetch([{
        id: "cli-1",
        name: "María González",
        email: "maria@gmail.com",
        phone: "+595981234567",
        ruc: "1234567-8",
        address: "Av. Mariscal López 1234",
        createdAt: new Date().toISOString(),
      }]);

      const { fetchClients } = await import("@/lib/data-service");
      const result = await fetchClients(() => []);

      expect(result[0].name).toBe("María González");
      expect(result[0].email).toBe("maria@gmail.com");
      expect(result[0].phone).toBe("+595981234567");
    });
  });

  describe("mapVehicleFromApi", () => {
    it("maps backend vehicle to UI shape", async () => {
      mockFetch([{
        id: "veh-1",
        plate: "ABC 123",
        vin: "8AGDF123456789011",
        brand: "Toyota",
        model: "Corolla",
        year: 2024,
        engineType: "HEV",
        kilometraje: 15000,
        clientId: "cli-1",
        createdAt: new Date().toISOString(),
      }]);

      const { fetchVehicles } = await import("@/lib/data-service");
      const result = await fetchVehicles(() => []);

      expect(result[0].brand).toBe("Toyota");
      expect(result[0].model).toBe("Corolla");
      expect(result[0].engineType).toBe("HEV");
      expect(result[0].kilometraje).toBe(15000);
    });
  });

  describe("mapAccountFromApi", () => {
    it("maps backend account to UI shape", async () => {
      mockFetch([{
        id: "acc-1",
        codigo: "1.1.01",
        nombre: "Caja y Bancos",
        tipo: "ACTIVO",
        nivel: 3,
        aceptaMovimientos: true,
        activo: true,
        saldoInicial: "15000000",
        moneda: "PYG",
      }]);

      const { fetchAccounts } = await import("@/lib/data-service");
      const result = await fetchAccounts(() => []);

      expect(result[0].codigo).toBe("1.1.01");
      expect(result[0].nombre).toBe("Caja y Bancos");
      expect(result[0].tipo).toBe("ACTIVO");
      expect(result[0].saldoInicial).toBe("15000000");
    });
  });
});
