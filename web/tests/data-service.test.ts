/**
 * Tests for data-service.ts
 *
 * Covers:
 *   - fetchOrMock: API success, API timeout, API error → mock fallback
 *   - Mappers: mapWorkOrderFromApi, mapInventoryFromApi, mapInvoiceFromApi
 *   - Tenant slug resolution
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Enable mock fallback mode for tests (otherwise fetchOrMock re-throws errors)
process.env["NEXT_PUBLIC_ENABLE_MOCKS"] = "true";

// ── Mock fetch global ─────────────────────────

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
    mockFetch([{ id: "1", cliente: "Test", status: "En_Proceso" }]);

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
    // Mock fetch to reject (simulating network timeout)
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Timeout"));

    const { fetchWorkOrders } = await import("@/lib/data-service");
    const mockFactory = () => [{ id: "mock-1", client: "Timeout Fallback", vehicle: "Mock", plate: "", year: 2024, service: "", status: "pending" as const, technician: "", deadline: "", estimatedCost: 0, createdAt: "" }];

    const result = await fetchWorkOrders(mockFactory);
    expect(result).toHaveLength(1);
    expect(result[0].client).toBe("Timeout Fallback");
  });
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

  describe("mapBankAccountFromApi", () => {
    it("maps backend bank account to UI shape", async () => {
      mockFetch([{
        id: "cta-1",
        codigo: "1.1.01.001",
        nombre: "Caja Chica",
        tipo: "CAJA",
        moneda: "PYG",
        saldoInicial: "2000000",
        saldoActual: "1850000",
        activo: true,
      }]);

      const { fetchBankAccounts } = await import("@/lib/data-service");
      const result = await fetchBankAccounts(() => []);

      expect(result[0].nombre).toBe("Caja Chica");
      expect(result[0].tipo).toBe("CAJA");
      expect(result[0].saldoActual).toBe(1850000);
      expect(result[0].moneda).toBe("PYG");
    });
  });

  describe("mapMovementFromApi", () => {
    it("maps backend treasury movement to UI shape", async () => {
      mockFetch([{
        id: "mov-1",
        tipo: "INGRESO",
        medioPago: "EFECTIVO",
        cuentaNombre: "Caja Chica",
        monto: "450000",
        concepto: "Cobro factura",
        fecha: new Date().toISOString(),
        conciliado: true,
      }]);

      const { fetchMovements } = await import("@/lib/data-service");
      const result = await fetchMovements(() => []);

      expect(result[0].tipo).toBe("INGRESO");
      expect(result[0].monto).toBe(450000);
      expect(result[0].conciliado).toBe(true);
      expect(result[0].medioPago).toBe("EFECTIVO");
    });
  });

  describe("mapAnalyticsFromApi", () => {
    it("maps backend analytics data to UI shape", async () => {
      mockFetch({
        totalIngresos: "28650000",
        totalOrdenes: 42,
        ordenesCompletadas: 28,
        productividad: 76,
        clientesAtendidos: 24,
        margenBruto: 58.3,
        ticketPromedio: "682143",
      });

      const { fetchAnalyticsDashboard } = await import("@/lib/data-service");
      const result = await fetchAnalyticsDashboard(() => ({
        totalIngresos: 0, totalOrdenes: 0, ordenesCompletadas: 0,
        productividad: 0, clientesAtendidos: 0, margenBruto: 0,
        ticketPromedio: 0, mesActual: "",
      }));

      expect(result.totalIngresos).toBe(28650000);
      expect(result.productividad).toBe(76);
      expect(result.margenBruto).toBe(58.3);
    });
  });

  describe("mapUserFromApi", () => {
    it("maps backend user profile to UI shape", async () => {
      mockFetch([{
        id: "usr-1",
        name: "Juan Ángel Jara",
        email: "jaraju01@gmail.com",
        role: "admin",
        activo: true,
        createdAt: new Date().toISOString(),
      }]);

      const { fetchUsers } = await import("@/lib/data-service");
      const result = await fetchUsers(() => []);

      expect(result[0].name).toBe("Juan Ángel Jara");
      expect(result[0].email).toBe("jaraju01@gmail.com");
      expect(result[0].role).toBe("admin");
      expect(result[0].activo).toBe(true);
    });
  });

  describe("mapAppointmentFromApi", () => {
    it("maps backend appointment to UI shape", async () => {
      mockFetch([{
        id: "appt-1",
        clienteNombre: "María González",
        clientePhone: "+595981234567",
        clienteEmail: "maria@gmail.com",
        vehiculoChapa: "ABC 123",
        vehiculoMarca: "Toyota",
        vehiculoModelo: "Corolla",
        fechaTurno: "2026-07-15",
        horaTurno: "09:30",
        tipoServicio: "RAPIDO",
        estado: "CONFIRMADO",
        createdAt: new Date().toISOString(),
      }]);

      const { fetchAppointments } = await import("@/lib/data-service");
      const result = await fetchAppointments(() => []);

      expect(result[0].clienteNombre).toBe("María González");
      expect(result[0].vehiculoChapa).toBe("ABC 123");
      expect(result[0].tipoServicio).toBe("RAPIDO");
      expect(result[0].estado).toBe("CONFIRMADO");
    });
  });

  describe("mapConfigFromApi", () => {
    it("maps backend config settings to UI shape", async () => {
      mockFetch({
        companyName: "Taller El Chero",
        companyRuc: "80012345-6",
        companyAddress: "Av. Mariscal López 1234",
        companyPhone: "+595981234567",
        companyEmail: "info@taller.com",
      });

      const { fetchConfigSettings } = await import("@/lib/data-service");
      const result = await fetchConfigSettings(() => ({
        companyName: "", companyRuc: "", companyAddress: "",
        companyPhone: "", companyEmail: "", fiscalRegimen: "",
        timbrado: "", facturaInicio: "",
      }));

      expect(result.companyName).toBe("Taller El Chero");
      expect(result.companyRuc).toBe("80012345-6");
      expect(result.companyPhone).toBe("+595981234567");
    });
  });

  describe("mapWhatsAppMessageFromApi", () => {
    it("maps backend WhatsApp message to UI shape", async () => {
      mockFetch({ items: [{
        id: "msg-1",
        clienteName: "Juan Pérez",
        phoneNumber: "+595981234567",
        template: "RECEPCIONADO",
        messageText: "Su vehículo fue recibido",
        status: "SENT",
        sentAt: new Date().toISOString(),
        hasAttachment: false,
      }]});

      const { fetchWhatsAppMessages } = await import("@/lib/data-service");
      const result = await fetchWhatsAppMessages(() => []);

      expect(result[0].clienteName).toBe("Juan Pérez");
      expect(result[0].template).toBe("RECEPCIONADO");
      expect(result[0].status).toBe("SENT");
    });
  });

  describe("mapFleetFromApi", () => {
    it("maps backend fleet record to UI shape", async () => {
      mockFetch([{
        id: "fl-1",
        nombre: "Transporte Norte",
        empresa: "Transportes del Norte S.A.",
        contacto: "Carlos Ruiz",
        telefono: "+595981111222",
        email: "carlos@transportesnorte.com",
        ruc: "80012345-7",
        contratoTipo: "MENSUAL",
        descuentoPorcentaje: 15,
        createdAt: new Date().toISOString(),
      }]);

      const { fetchFleets } = await import("@/lib/data-service");
      const result = await fetchFleets(() => []);

      expect(result[0].nombre).toBe("Transporte Norte");
      expect(result[0].empresa).toBe("Transportes del Norte S.A.");
      expect(result[0].contratoTipo).toBe("MENSUAL");
      expect(result[0].descuentoPorcentaje).toBe(15);
    });
  });

  describe("mapAuditFromApi", () => {
    it("maps backend audit log entry to UI shape", async () => {
      mockFetch([{
        id: "aud-1",
        usuario: "admin@taller.com",
        accion: "CREAR",
        entidad: "OT",
        entidadId: "ot-123",
        descripcion: "Creación de orden de trabajo",
        createdAt: new Date().toISOString(),
      }]);

      const { fetchAuditLog } = await import("@/lib/data-service");
      const result = await fetchAuditLog(() => []);

      expect(result[0].usuario).toBe("admin@taller.com");
      expect(result[0].accion).toBe("CREAR");
      expect(result[0].entidad).toBe("OT");
      expect(result[0].descripcion).toBe("Creación de orden de trabajo");
    });
  });
});
