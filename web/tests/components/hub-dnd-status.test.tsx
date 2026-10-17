/**
 * Hub de Operaciones — resolución del drag & drop de estados.
 *
 * Regresión: el handler de `onDragEnd` comparaba el estado backend destino
 * ("En_Proceso") contra las keys UI de `STATUS_FLOW` ("in_progress"), así que
 * `.includes()` era siempre `false` y arrastrar una OT nunca cambiaba su
 * estado. `resolveDropTarget` centraliza esa decisión y es lo que se testea.
 *
 * @module web/tests/components/hub-dnd-status
 */

import { describe, it, expect } from "vitest";
import { resolveDropTarget } from "@/components/hub/hub-sidebar";

const ot = (id: string, status: string) => ({ id, status });

describe("resolveDropTarget — drag & drop del Kanban", () => {
  it("arrastrar de Presupuestado a la columna 'in_progress' devuelve En_Proceso", () => {
    const result = resolveDropTarget("in_progress", "ot-1", [ot("ot-1", "Presupuestado")]);
    expect(result).toEqual({ ordenId: "ot-1", targetStatus: "En_Proceso" });
  });

  it("mapea cada columna UI a su estado backend", () => {
    const ordenes = [ot("ot-1", "En_Proceso")];
    expect(resolveDropTarget("quality", "ot-1", ordenes)?.targetStatus).toBe("Control_Calidad");
    expect(resolveDropTarget("ready", "ot-1", ordenes)?.targetStatus).toBe("Listo");
    expect(resolveDropTarget("budgeted", "ot-1", ordenes)?.targetStatus).toBe("Presupuestado");
    expect(resolveDropTarget("in_progress", "ot-1", [ot("ot-1", "Presupuestado")])?.targetStatus).toBe("En_Proceso");
  });

  it("permite retroceder en el flujo (Listo → Presupuestado)", () => {
    const result = resolveDropTarget("budgeted", "ot-1", [ot("ot-1", "Listo")]);
    expect(result).toEqual({ ordenId: "ot-1", targetStatus: "Presupuestado" });
  });

  it("no hace nada si se suelta en la misma columna (no-op)", () => {
    expect(resolveDropTarget("budgeted", "ot-1", [ot("ot-1", "Presupuestado")])).toBeNull();
    expect(resolveDropTarget("in_progress", "ot-1", [ot("ot-1", "En_Proceso")])).toBeNull();
  });

  it("ignora drops que no caen en una columna (p. ej. sobre otra tarjeta)", () => {
    const result = resolveDropTarget("ot-99", "ot-1", [ot("ot-1", "Presupuestado")]);
    expect(result).toBeNull();
  });

  it("ignora drops de una OT que no está en el tablero", () => {
    const result = resolveDropTarget("ready", "ot-desconocida", [ot("ot-1", "Presupuestado")]);
    expect(result).toBeNull();
  });
});
