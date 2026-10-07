/**
 * D1 — Regresión del modo `serverSide` del DataTable.
 *
 * Sin el flag `serverSide`, el DataTable recorta con `slice()` la página que
 * ya vino paginada del servidor y recalcula `totalPages` con
 * `Math.ceil(totalItems / pageSize)`, dejando inaccesibles las páginas
 * avanzadas (registros 101+ con el patrón T-54). Estos asserts fijan el
 * comportamiento del modo serverSide sobre el DOM renderizado:
 *
 *  1. La página recibida se renderiza COMPLETA (no se slicea).
 *  2. El resumen "X — Y de Z registros" usa `totalItems` del backend.
 *  3. La navegación salta a cualquier página con `onPageChange`.
 *  4. Contraste: sin `serverSide` la misma entrada SÍ se recorta (guard de la
 *     diferencia de comportamiento que el flag existe para expresar).
 *
 * @module web/tests/components/data-table-server-side
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable, type Column } from "@/components/ui/data-table";

interface Row {
  id: string;
  name: string;
}

const columns: Column<Row>[] = [{ header: "Nombre", accessor: "name" }];

function makeRows(count: number, offset = 0): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `r-${offset + i + 1}`,
    name: `Fila ${offset + i + 1}`,
  }));
}

describe("DataTable · modo serverSide (D1)", () => {
  it("renderiza la página completa sin recortarla: 25 filas de 100", () => {
    render(
      <DataTable<Row>
        columns={columns}
        data={makeRows(25)}
        rowKey="id"
        paginate
        pageSize={25}
        serverSide
        totalItems={100}
        totalPages={4}
        page={0}
        onPageChange={() => {}}
      />,
    );

    // Las 25 filas de la página están en el DOM: un slice() client-side
    // dejaría fuera a "Fila 25".
    expect(screen.getByText("Fila 1")).toBeInTheDocument();
    expect(screen.getByText("Fila 25")).toBeInTheDocument();

    // El resumen usa totalItems del backend, no data.length.
    expect(screen.getByText(/registros/)).toHaveTextContent("1 — 25 de 100 registros");
  });

  it("salta a la página 4 pedida por el usuario (onPageChange con índice base 0)", () => {
    const onPageChange = vi.fn();
    render(
      <DataTable<Row>
        columns={columns}
        data={makeRows(25)}
        rowKey="id"
        paginate
        pageSize={25}
        serverSide
        totalItems={100}
        totalPages={4}
        page={0}
        onPageChange={onPageChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Página 4" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("renderiza la página 2 tal cual llega (26–50) con su resumen", () => {
    render(
      <DataTable<Row>
        columns={columns}
        data={makeRows(25, 25)}
        rowKey="id"
        paginate
        pageSize={25}
        serverSide
        totalItems={100}
        totalPages={4}
        page={1}
        onPageChange={() => {}}
      />,
    );

    expect(screen.getByText("Fila 26")).toBeInTheDocument();
    expect(screen.getByText("Fila 50")).toBeInTheDocument();
    expect(screen.getByText(/registros/)).toHaveTextContent("26 — 50 de 100 registros");
    // "Página anterior" habilitada, "Página siguiente" habilitada (hay página 3).
    expect(screen.getByRole("button", { name: "Página anterior" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Página siguiente" })).not.toBeDisabled();
  });

  it("contraste: sin serverSide la MISMA entrada se recorta a pageSize (guard de regresión)", () => {
    render(
      <DataTable<Row>
        columns={columns}
        data={makeRows(25)}
        rowKey="id"
        paginate
        pageSize={10}
        totalItems={100}
        totalPages={4}
        page={0}
        onPageChange={() => {}}
      />,
    );

    // Modo cliente: slice(0, 10) — la fila 25 no existe aunque el totalItems
    // externo (100) siga usándose en el resumen (ese prop no distingue modos;
    // la diferencia de comportamiento es el slice, no el conteo).
    expect(screen.getByText("Fila 10")).toBeInTheDocument();
    expect(screen.queryByText("Fila 25")).not.toBeInTheDocument();
    expect(screen.getByText(/registros/)).toHaveTextContent("1 — 10 de 100 registros");
  });
});
