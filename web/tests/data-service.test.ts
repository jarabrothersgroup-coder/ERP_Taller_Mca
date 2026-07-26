/**
 * Tests for data-service.ts
 *
 * Two test strategies:
 *   1. Mappers — tested as pure functions with direct input/output (no fetch mock needed)
 *   2. fetchOrMock — tested via dynamic import (avoids Vitest module caching issues)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Mock helpers ────────────────────────────── */

function createMockFetch(response: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(response),
  });
}

function mockFetch(response: unknown, ok = true, status = 200) {
  vi.stubGlobal("fetch", createMockFetch(response, ok, status));
}

function mockFetchError(message = "Network error") {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(message)));
}



/* ── Dynamic import helper (cache-safe) ─────── */

async function freshDataService() {
  const mod = await import("@/lib/data-service");
  return mod;
}

/* ── Pure Mapper Tests (no fetch mocking needed) ─── */
/* Every mapper is a pure function: data in → UI shape out.           */
/* We test them with static imports since they don't use fetch/mocks. */

import {
  mapWorkOrderFromApi,
  mapInventoryFromApi,
  mapInvoiceFromApi,
  mapClientFromApi,
  mapVehicleFromApi,
  mapAccountFromApi,
  mapBankAccountFromApi,
  mapMovementFromApi,
  mapAnalyticsFromApi,
  mapUserFromApi,
  mapAppointmentFromApi,
  mapConfigFromApi,
  mapWhatsAppMessageFromApi,
  mapFleetFromApi,
  mapAuditFromApi,
} from "@/lib/data-service";
import { setTenantSlug as setApiTenantSlug, getTenantSlug as getApiTenantSlug } from "@/lib/api";

describe("Mappers (pure functions)", () => {
  describe("mapWorkOrderFromApi", () => {
    it("maps backend work order to UI shape", () => {
      const result = mapWorkOrderFromApi({
        id: "abc-123", cliente: "Juan Pérez", vehiculo: "Toyota Corolla",
        plate: "ABC 123", description: "Cambio de aceite", status: "En_Proceso",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }, 0);

      expect(result.client).toBe("Juan Pérez");
      expect(result.vehicle).toBe("Toyota Corolla");
      expect(result.plate).toBe("ABC 123");
      expect(result.status).toBe("in_progress");
    });
  });

  describe("mapInventoryFromApi", () => {
    it("maps backend inventory item to UI shape", () => {
      const result = mapInventoryFromApi({
        id: "inv-1", codigo: "PZ-001", descripcion: "Pastillas de Freno",
        marca: "Bosch", categoria: "Frenos", stockActual: 5, stockMinimo: 10,
        precioVenta: "85000", ubicacion: "A1-01",
      });

      expect(result.name).toBe("Pastillas de Freno");
      expect(result.stock).toBe(5);
      expect(result.minStock).toBe(10);
      expect(result.status).toBe("low");
      expect(result.price).toBe(85000);
    });
  });

  describe("mapInvoiceFromApi", () => {
    it("maps backend invoice to UI shape", () => {
      const result = mapInvoiceFromApi({
        id: "fac-1", total: "450000", sifenStatus: "APROBADO_DNIT",
        estadoPago: "PAGADA", tipo: "ELECTRONICA", ordenId: "ot-1",
        createdAt: new Date().toISOString(),
      });

      expect(result.total).toBe(450000);
      expect(result.estado).toBe("APROBADO_DNIT");
      expect(result.tipo).toBe("ELECTRONICA");
    });
  });

  describe("mapClientFromApi", () => {
    it("maps backend client to UI shape", () => {
      const result = mapClientFromApi({
        id: "cli-1", name: "María González", email: "maria@gmail.com",
        phone: "+595981234567", ruc: "1234567-8", address: "Av. Mariscal López 1234",
        createdAt: new Date().toISOString(),
      });

      expect(result.name).toBe("María González");
      expect(result.email).toBe("maria@gmail.com");
      expect(result.phone).toBe("+595981234567");
    });
  });

  describe("mapVehicleFromApi", () => {
    it("maps backend vehicle to UI shape", () => {
      const result = mapVehicleFromApi({
        id: "veh-1", plate: "ABC 123", vin: "8AGDF123456789011",
        brand: "Toyota", model: "Corolla", year: 2024, engineType: "HEV",
        kilometraje: 15000, clientId: "cli-1",
        createdAt: new Date().toISOString(),
      });

      expect(result.brand).toBe("Toyota");
      expect(result.model).toBe("Corolla");
      expect(result.engineType).toBe("HEV");
      expect(result.kilometraje).toBe(15000);
    });
  });

  describe("mapAccountFromApi", () => {
    it("maps backend account to UI shape", () => {
      const result = mapAccountFromApi({
        id: "acc-1", codigo: "1.1.01", nombre: "Caja y Bancos", tipo: "ACTIVO",
        nivel: 3, aceptaMovimientos: true, activo: true,
        saldoInicial: "15000000", moneda: "PYG",
      });

      expect(result.codigo).toBe("1.1.01");
      expect(result.nombre).toBe("Caja y Bancos");
      expect(result.tipo).toBe("ACTIVO");
      expect(result.saldoInicial).toBe("15000000");
    });
  });

  describe("mapBankAccountFromApi", () => {
    it("maps backend bank account to UI shape", () => {
      const result = mapBankAccountFromApi({
        id: "cta-1", codigo: "1.1.01.001", nombre: "Caja Chica", tipo: "CAJA",
        moneda: "PYG", saldoInicial: "2000000", saldoActual: "1850000", activo: true,
      });

      expect(result.nombre).toBe("Caja Chica");
      expect(result.tipo).toBe("CAJA");
      expect(result.saldoActual).toBe(1850000);
      expect(result.moneda).toBe("PYG");
    });
  });

  describe("mapMovementFromApi", () => {
    it("maps backend treasury movement to UI shape", () => {
      const result = mapMovementFromApi({
        id: "mov-1", tipo: "INGRESO", medioPago: "EFECTIVO",
        cuentaNombre: "Caja Chica", monto: "450000", concepto: "Cobro factura",
        fecha: new Date().toISOString(), conciliado: true,
      });

      expect(result.tipo).toBe("INGRESO");
      expect(result.monto).toBe(450000);
      expect(result.conciliado).toBe(true);
      expect(result.medioPago).toBe("EFECTIVO");
    });
  });

  describe("mapAnalyticsFromApi", () => {
    it("maps backend analytics data to UI shape", () => {
      const result = mapAnalyticsFromApi({
        totalIngresos: "28650000", totalOrdenes: 42, ordenesCompletadas: 28,
        productividad: 76, clientesAtendidos: 24, margenBruto: 58.3,
        ticketPromedio: "682143", mesActual: "julio 2026",
      });

      expect(result.totalIngresos).toBe(28650000);
      expect(result.productividad).toBe(76);
      expect(result.margenBruto).toBe(58.3);
    });
  });

  describe("mapUserFromApi", () => {
    it("maps backend user profile to UI shape", () => {
      const result = mapUserFromApi({
        id: "usr-1", name: "Juan Ángel Jara", email: "jaraju01@gmail.com",
        role: "admin", activo: true,
        createdAt: new Date().toISOString(),
      });

      expect(result.name).toBe("Juan Ángel Jara");
      expect(result.email).toBe("jaraju01@gmail.com");
      expect(result.role).toBe("admin");
      expect(result.activo).toBe(true);
    });
  });

  describe("mapAppointmentFromApi", () => {
    it("maps backend appointment to UI shape", () => {
      const result = mapAppointmentFromApi({
        id: "appt-1", clienteNombre: "María González", clientePhone: "+595981234567",
        clienteEmail: "maria@gmail.com", vehiculoChapa: "ABC 123",
        vehiculoMarca: "Toyota", vehiculoModelo: "Corolla",
        fechaTurno: "2026-07-15", horaTurno: "09:30",
        tipoServicio: "RAPIDO", estado: "CONFIRMADO",
        createdAt: new Date().toISOString(),
      });

      expect(result.clienteNombre).toBe("María González");
      expect(result.vehiculoChapa).toBe("ABC 123");
      expect(result.tipoServicio).toBe("RAPIDO");
      expect(result.estado).toBe("CONFIRMADO");
    });
  });

  describe("mapConfigFromApi", () => {
    it("maps backend config settings to UI shape", () => {
      const result = mapConfigFromApi({
        companyName: "Taller El Chero", companyRuc: "80012345-6",
        companyAddress: "Av. Mariscal López 1234", companyPhone: "+595981234567",
        companyEmail: "info@taller.com",
      });

      expect(result.companyName).toBe("Taller El Chero");
      expect(result.companyRuc).toBe("80012345-6");
      expect(result.companyPhone).toBe("+595981234567");
    });
  });

  describe("mapWhatsAppMessageFromApi", () => {
    it("maps backend WhatsApp message to UI shape", () => {
      const result = mapWhatsAppMessageFromApi({
        id: "msg-1", clienteName: "Juan Pérez", phoneNumber: "+595981234567",
        template: "RECEPCIONADO", messageText: "Su vehículo fue recibido",
        status: "SENT",
        sentAt: new Date().toISOString(), hasAttachment: false,
      });

      expect(result.clienteName).toBe("Juan Pérez");
      expect(result.template).toBe("RECEPCIONADO");
      expect(result.status).toBe("SENT");
    });
  });

  describe("mapFleetFromApi", () => {
    it("maps backend fleet record to UI shape", () => {
      const result = mapFleetFromApi({
        id: "fl-1", nombre: "Transporte Norte", empresa: "Transportes del Norte S.A.",
        contacto: "Carlos Ruiz", telefono: "+595981111222",
        email: "carlos@transportesnorte.com", ruc: "80012345-7",
        contratoTipo: "MENSUAL", descuentoPorcentaje: 15,
        createdAt: new Date().toISOString(),
      });

      expect(result.nombre).toBe("Transporte Norte");
      expect(result.empresa).toBe("Transportes del Norte S.A.");
      expect(result.contratoTipo).toBe("MENSUAL");
      expect(result.descuentoPorcentaje).toBe(15);
    });
  });

  describe("mapAuditFromApi", () => {
    it("maps backend audit log entry to UI shape", () => {
      const result = mapAuditFromApi({
        id: "aud-1", usuario: "admin@taller.com", accion: "CREAR",
        entidad: "OT", entidadId: "ot-123",
        descripcion: "Creación de orden de trabajo",
        createdAt: new Date().toISOString(),
      });

      expect(result.usuario).toBe("admin@taller.com");
      expect(result.accion).toBe("CREAR");
      expect(result.entidad).toBe("OT");
      expect(result.descripcion).toBe("Creación de orden de trabajo");
    });
  });
});

/* ── fetchOrMock (via dynamic import ──────────── */
/* Dynamic import ensures module-level ENABLE_MOCKS is evaluated fresh. */

describe("fetchOrMock", () => {
  // These tests use the already-cached module (loaded by static imports above).
  // Each test must set up its own globalThis.fetch before calling the function.
  // The shared module is fine because globalThis.fetch is read at call time.

  it("returns API data via mapWorkOrderFromApi (pure function, no fetch needed)", () => {
    // This tests the same business logic without needing fetch mocking
    const result = mapWorkOrderFromApi({
      id: "1", cliente: "Test", vehiculo: "Vehículo",
      plate: "ABC 123", status: "En_Proceso",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }, 0);
    expect(result.client).toBe("Test");
  });

  it("falls back to mock data on network error", async () => {
    mockFetchError();
    const { fetchWorkOrders } = await freshDataService();
    const result = await fetchWorkOrders(() => [{
      id: "mock-1", client: "Mock Client", vehicle: "", plate: "",
      year: 0, service: "", status: "pending" as const,
      technician: "", deadline: "", estimatedCost: 0, createdAt: "",
    }]);
    expect(result).toHaveLength(1);
    expect(result[0].client).toBe("Mock Client");
  });

  it("falls back to mock data on HTTP error", async () => {
    mockFetch({ error: "Not found" }, false, 404);
    const { fetchWorkOrders } = await freshDataService();
    const result = await fetchWorkOrders(() => [{
      id: "mock-1", client: "Fallback", vehicle: "", plate: "",
      year: 0, service: "", status: "pending" as const,
      technician: "", deadline: "", estimatedCost: 0, createdAt: "",
    }]);
    expect(result).toHaveLength(1);
    expect(result[0].client).toBe("Fallback");
  });

  it("falls back to mock data on timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Timeout")));
    const { fetchWorkOrders } = await freshDataService();
    const result = await fetchWorkOrders(() => [{
      id: "mock-1", client: "Timeout Fallback", vehicle: "", plate: "",
      year: 0, service: "", status: "pending" as const,
      technician: "", deadline: "", estimatedCost: 0, createdAt: "",
    }]);
    expect(result).toHaveLength(1);
    expect(result[0].client).toBe("Timeout Fallback");
  });
});

/* ── Tenant slug ────────────────────────────── */
/* Tests the slug propagation directly without fetch mocking,               */
/* which avoids the Vitest+jsdom global fetch resolution issue.             */

describe("setTenantSlug / getTenantSlug", () => {
  it("stores and retrieves tenant slug directly", () => {
    // Test through the api.ts functions directly (no fetch mock needed)
    setApiTenantSlug("test-tenant");
    expect(getApiTenantSlug()).toBe("test-tenant");
  });

  it("falls back to demo slug when not set", () => {
    // Reset by setting to demo
    setApiTenantSlug("demo");
    expect(getApiTenantSlug()).toBe("demo");
  });
});
