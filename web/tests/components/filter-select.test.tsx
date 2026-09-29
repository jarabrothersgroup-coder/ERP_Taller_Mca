/**
 * T-54 — FilterSelect: select de filtro unificado con opciones dinámicas.
 *
 * Criterios:
 *  - label accesible (aria-label) y opción "Todos" (allLabel → value "")
 *  - estado de carga: deshabilitado con texto "Cargando…"
 *  - estado vacío: deshabilitado con emptyText, sin opciones fantasma
 *
 * @module web/tests/components/filter-select
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";

import { FilterSelect } from "@/components/ui/filter-select";

vi.mock("lucide-react", () => ({
  ChevronDown: () => null,
}));

const OPTIONS = [
  { value: "a1", label: "Caja Chica" },
  { value: "a2", label: "Banco Nacional" },
];

describe("T-54 — FilterSelect", () => {
  it("renderiza opciones + opción Todos y notifica el cambio", () => {
    const onChange = vi.fn();
    render(
      <FilterSelect
        label="Cuenta"
        value=""
        onChange={onChange}
        options={OPTIONS}
        allLabel="Todas las cuentas"
      />,
    );

    const select = screen.getByLabelText("Cuenta");
    expect(select).not.toBeDisabled();
    expect(screen.getByRole("option", { name: "Todas las cuentas" })).toHaveValue("");
    expect(screen.getByRole("option", { name: "Caja Chica" })).toHaveValue("a1");

    fireEvent.change(select, { target: { value: "a2" } });
    expect(onChange).toHaveBeenCalledWith("a2");
  });

  it("sin allLabel no añade la opción Todos", () => {
    render(
      <FilterSelect label="Cuenta" value="a1" onChange={() => {}} options={OPTIONS} />,
    );
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("estado de carga: deshabilitado con texto Cargando…", () => {
    render(
      <FilterSelect
        label="Cuenta"
        value=""
        onChange={() => {}}
        options={[]}
        allLabel="Todas"
        isLoading
      />,
    );
    const select = screen.getByLabelText("Cuenta");
    expect(select).toBeDisabled();
    expect(screen.getByRole("option", { name: "Cargando…" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Todas" })).not.toBeInTheDocument();
  });

  it("estado vacío: deshabilitado con emptyText, sin opciones fantasma", () => {
    render(
      <FilterSelect
        label="Técnico"
        value=""
        onChange={() => {}}
        options={[]}
        allLabel="Todos los técnicos"
        emptyText="Sin técnicos activos"
      />,
    );
    const select = screen.getByLabelText("Técnico");
    expect(select).toBeDisabled();
    expect(screen.getByRole("option", { name: "Sin técnicos activos" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Todos los técnicos" })).not.toBeInTheDocument();
  });
});
