/**
 * OtSearchSelect — filtro de búsqueda de OT (página de Asignación Inteligente).
 *
 * Reemplaza el ingreso a mano del UUID: busca en el backend y deja elegir la
 * OT del listado. Verifica que:
 *  - consuma el envelope paginado `{ items }` de `listWorkOrders`
 *  - excluya las OT ya entregadas (Finalizado_Retirado)
 *  - propague el término de búsqueda (debounced)
 *  - al elegir una OT avise con el id y con la OT completa
 *
 * @module web/tests/components/ot-search-select
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

import {
  OtSearchSelect,
  looksLikeUuid,
  shortOtId,
  type OtSearchSelectProps,
} from "@/components/taller/ot-search-select";

// ─── Mocks ─────────────────────────────────────

const { mockListWorkOrders } = vi.hoisted(() => ({ mockListWorkOrders: vi.fn() }));

vi.mock("@/lib/api", () => ({
  api: { listWorkOrders: mockListWorkOrders },
}));

// ─── Helpers ───────────────────────────────────

const OT_ID = "fbc0771d-9c1e-4e90-9365-4c3e5795e192";

function makeOt(overrides: Record<string, unknown> = {}) {
  return {
    id: OT_ID,
    vehicleId: "v-1",
    clientId: "c-1",
    description: "Cambio de pastilla de freno de mano",
    status: "Presupuestado",
    hvAlert: false,
    hvLockoutSigned: false,
    dtcCodes: null,
    createdAt: "2026-10-16T10:00:00.000Z",
    updatedAt: "2026-10-16T10:00:00.000Z",
    assignedTo: null,
    vehiculo: "Kia Sportage SL",
    plate: "AAYB904",
    cliente: "Blanca Carolina Sanabria Rojas",
    ...overrides,
  };
}

function page(items: unknown[], total = items.length) {
  return { items, total, page: 1, limit: 8, totalPages: total > 0 ? 1 : 0 };
}

function renderSelect(props: Partial<OtSearchSelectProps> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const onChange = vi.fn();
  const onSelectOt = vi.fn();
  const utils = render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(OtSearchSelect, { value: "", onChange, onSelectOt, ...props }),
    ),
  );
  return { ...utils, onChange, onSelectOt };
}

// ─── Tests ─────────────────────────────────────

describe("OtSearchSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListWorkOrders.mockResolvedValue(page([]));
  });

  it("lista las OT del envelope `{ items }` y las deja elegir", async () => {
    mockListWorkOrders.mockResolvedValue(page([makeOt()]));

    const { onChange, onSelectOt } = renderSelect();
    fireEvent.focus(screen.getByRole("combobox"));

    const option = await screen.findByRole("option", { name: /#fbc0771d/ });
    expect(option).toHaveTextContent("Kia Sportage SL");
    expect(option).toHaveTextContent("AAYB904");
    expect(option).toHaveTextContent("Blanca Carolina Sanabria Rojas");
    expect(option).toHaveTextContent("Presupuestado");

    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith(OT_ID);
    expect(onSelectOt).toHaveBeenCalledWith(expect.objectContaining({ id: OT_ID, hvAlert: false }));
  });

  it("consume el envelope paginado y excluye las OT ya entregadas", async () => {
    renderSelect();
    fireEvent.focus(screen.getByRole("combobox"));

    await waitFor(() => expect(mockListWorkOrders).toHaveBeenCalled());

    expect(mockListWorkOrders).toHaveBeenCalledWith(
      expect.objectContaining({ excludeStatus: "Finalizado_Retirado", limit: 8 }),
    );
  });

  it("propaga el término buscado (debounced) al backend", async () => {
    renderSelect();
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "fbc0771d" } });

    await waitFor(() =>
      expect(mockListWorkOrders).toHaveBeenCalledWith(
        expect.objectContaining({ search: "fbc0771d" }),
      ),
    );
  });

  it("muestra el estado vacío cuando no hay coincidencias", async () => {
    mockListWorkOrders.mockResolvedValue(page([]));

    renderSelect();
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzzz" } });

    expect(await screen.findByText(/Sin órdenes para/i)).toBeInTheDocument();
  });

  it("permite usar un UUID a mano cuando la búsqueda no encuentra nada", async () => {
    mockListWorkOrders.mockResolvedValue(page([]));

    const { onChange } = renderSelect();
    const input = screen.getByRole("combobox");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: OT_ID } });

    const fallback = await screen.findByRole("option", { name: /Usar el ID/i });
    fireEvent.click(fallback);

    expect(onChange).toHaveBeenCalledWith(OT_ID);
  });

  it("muestra la OT fijada cuando llega un value por props", () => {
    renderSelect({ value: OT_ID });

    expect(screen.getByText("#fbc0771d")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Quitar OT seleccionada/i })).toBeInTheDocument();
  });

  it("al quitar la OT avisa con cadena vacía", () => {
    const { onChange } = renderSelect({ value: OT_ID });

    fireEvent.click(screen.getByRole("button", { name: /Quitar OT seleccionada/i }));

    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("helpers", () => {
  it("shortOtId usa el mismo formato que el Hub (#8 primeros del uuid)", () => {
    expect(shortOtId(OT_ID)).toBe("#fbc0771d");
  });

  it("looksLikeUuid solo acepta un UUID completo", () => {
    expect(looksLikeUuid(OT_ID)).toBe(true);
    expect(looksLikeUuid("  " + OT_ID + "  ")).toBe(true);
    expect(looksLikeUuid("fbc0771d")).toBe(false);
    expect(looksLikeUuid("")).toBe(false);
  });
});
