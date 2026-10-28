/**
 * QuickCreateModal (Hub de Operaciones) — regresión de forma de datos.
 *
 * `GET /workshop/clientes` y `GET /workshop/vehiculos` devuelven un envelope
 * paginado `{ items, total, page, limit, totalPages }`, NO un array. El modal
 * trataba la respuesta como array y llamaba `.slice(0, 5)` sobre el objeto,
 * provocando "B.slice is not a function" al abrir "Nueva OT Rápida".
 *
 * @module web/tests/components/hub-quick-create-modal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

import { QuickCreateModal } from "@/components/hub/quick-create-modal";

// ─── Mocks ─────────────────────────────────────

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock("@/lib/api", () => ({
  api: {
    request: mockRequest,
    createClient: vi.fn(),
    createVehicle: vi.fn(),
    createWorkOrder: vi.fn(),
    listServiciosCatalogo: vi.fn().mockResolvedValue([]),
    getServicioCatalogo: vi.fn(),
    createServicioCatalogo: vi.fn(),
    updateServicioCatalogo: vi.fn(),
    deleteServicioCatalogo: vi.fn(),
    listOrdenServicios: vi.fn(),
    createOrdenServicio: vi.fn(),
    updateOrdenServicio: vi.fn(),
    deleteOrdenServicio: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}));

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(QuickCreateModal, {
        open: true,
        onOpenChange: vi.fn(),
        onCreated: vi.fn(),
      }),
    ),
  );
}

// ─── Tests ─────────────────────────────────────

describe("QuickCreateModal — envelope paginado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no revienta con `{ items }` y lista los clientes existentes", async () => {
    mockRequest.mockResolvedValue({
      items: [
        { id: "c1", name: "Juan Pérez", phone: "0981123456" },
        { id: "c2", name: "Ana Gómez", phone: null },
      ],
      total: 2,
      page: 1,
      limit: 50,
      totalPages: 1,
    });

    renderModal();

    expect(await screen.findByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
  });

  it("tolera un array pelado (compatibilidad con mocks/entornos degradados)", async () => {
    mockRequest.mockResolvedValue([{ id: "c1", name: "Cliente Uno" }]);

    renderModal();

    expect(await screen.findByText("Cliente Uno")).toBeInTheDocument();
  });

  it("un envelope vacío renderiza sin listar clientes", async () => {
    mockRequest.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    });

    renderModal();

    expect(await screen.findByText(/Clientes existentes/i)).toBeInTheDocument();
    expect(screen.getByText("Paso 1: Cliente")).toBeInTheDocument();
  });
});
