/**
 * FB-2 · ADM-04 — Tests de contrato del panel por rol.
 *
 * Fijan cómo el FE consume los endpoints multi-sucursal que antes no tenían
 * consumidor en la web:
 *
 *  1. `GET /config/dashboard/role` — sin `sucursalId` no agrega querystring;
 *     con `sucursalId` lo propaga tal cual (el backend resuelve la vista).
 *  2. `GET /config/dashboard/consolidated` — agregado multi-sucursal.
 *  3. El `view` del payload dirige el render (lo cubre el test de componente).
 *
 * @module web/tests/dashboard-role
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "@/lib/api";

function mockFetch(response: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(response) }),
  );
}

/** URL del único fetch realizado por la llamada bajo prueba */
function lastUrl(): string {
  return String((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const UUID = "00000000-0000-0000-0000-000000000123";

describe("FB-2 — api.getRoleDashboard", () => {
  it("sin sucursalId llama a /config/dashboard/role sin querystring", async () => {
    mockFetch({ view: "user", totalOTs: 0, otActivas: 0 });

    await api.getRoleDashboard();

    expect(lastUrl()).toBe("/config/dashboard/role");
  });

  it("propaga sucursalId como querystring cuando se acota la sucursal", async () => {
    mockFetch({ view: "manager", totalOTs: 1, otActivas: 0, branch: null });

    await api.getRoleDashboard({ sucursalId: UUID });

    expect(lastUrl()).toBe(`/config/dashboard/role?sucursalId=${UUID}`);
  });

  it("preserva el payload del rol (view + campos específicos)", async () => {
    const payload = {
      view: "admin",
      totalOTs: 42,
      otActivas: 7,
      totalSucursales: 2,
      totalIngresoMes: 500000,
      totalOTCompletadasMes: 3,
      branches: [
        {
          sucursalId: UUID,
          sucursalNombre: "Casa Central",
          otActivas: 4,
          otCompletadasMes: 3,
          ingresoMes: 500000,
          eficienciaMecanicos: 0,
          stockBajo: 1,
        },
      ],
    };
    mockFetch(payload);

    const result = await api.getRoleDashboard();

    expect(result.view).toBe("admin");
    expect(result.totalSucursales).toBe(2);
    expect(result.branches).toHaveLength(1);
    expect(result.branches?.[0].sucursalNombre).toBe("Casa Central");
  });
});

describe("FB-2 — api.getConsolidatedDashboard", () => {
  it("llama a /config/dashboard/consolidated", async () => {
    mockFetch({
      totalSucursales: 0,
      totalOTActivas: 0,
      totalOTCompletadasMes: 0,
      totalIngresoMes: 0,
      eficienciaPromedio: 0,
      sucursales: [],
    });

    await api.getConsolidatedDashboard();

    expect(lastUrl()).toBe("/config/dashboard/consolidated");
  });

  it("expone la eficiencia promedio y el desglose por sucursal", async () => {
    mockFetch({
      totalSucursales: 1,
      totalOTActivas: 2,
      totalOTCompletadasMes: 5,
      totalIngresoMes: 1000000,
      eficienciaPromedio: 88,
      sucursales: [
        {
          sucursalId: UUID,
          sucursalNombre: "Sucursal 1",
          otActivas: 2,
          otCompletadasMes: 5,
          ingresoMes: 1000000,
          eficienciaMecanicos: 88,
          stockBajo: 0,
        },
      ],
    });

    const result = await api.getConsolidatedDashboard();

    expect(result.eficienciaPromedio).toBe(88);
    expect(result.sucursales[0].stockBajo).toBe(0);
  });
});
