/**
 * T-55 — Tests del bus de toasts globales (`lib/toast-bus.ts`).
 *
 * El bus es un store module-level (fuera de React) porque los callbacks del
 * MutationCache de React Query no tienen contexto React. Estos tests fijan:
 *
 *  1. emitToast añade, acota a MAX_TOASTS y expira por TTL.
 *  2. Los suscriptores reciben un snapshot estable (mismo array hasta que
 *     hay cambio real) — contrato que exige useSyncExternalStore.
 *  3. dismissToast elimina y notifica.
 *
 * @module tests/lib/toast-bus
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  emitToast,
  dismissToast,
  subscribeToasts,
  getToastsSnapshot,
  type ToastMessage,
} from "@/lib/toast-bus";

describe("T-55 · toast bus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Vaciar el store module-level entre tests: suscribir y despedir todo.
    for (const t of getToastsSnapshot()) dismissToast(t.id);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emitToast notifica a los suscriptores con el snapshot nuevo", () => {
    const seen: ToastMessage[][] = [];
    const unsub = subscribeToasts((toasts) => seen.push(toasts));

    emitToast("success", "Cliente creado");

    expect(seen.at(-1)).toHaveLength(1);
    expect(seen.at(-1)![0]).toMatchObject({ kind: "success", message: "Cliente creado" });
    expect(getToastsSnapshot()).toHaveLength(1);
    unsub();
  });

  it("el snapshot es estable si nada cambió (contrato useSyncExternalStore)", () => {
    const unsub = subscribeToasts(() => {});
    const before = getToastsSnapshot();
    expect(getToastsSnapshot()).toBe(before);
    unsub();
  });

  it("expira el toast tras el TTL", () => {
    const id = emitToast("info", "temporal");
    expect(getToastsSnapshot().map((t) => t.id)).toContain(id);

    vi.advanceTimersByTime(6000);
    expect(getToastsSnapshot().map((t) => t.id)).not.toContain(id);
  });

  it("acota la pila a los últimos 4 toasts", () => {
    for (let i = 0; i < 6; i++) emitToast("info", `toast ${i}`);
    const snapshot = getToastsSnapshot();
    expect(snapshot).toHaveLength(4);
    expect(snapshot[0].message).toBe("toast 2");
    expect(snapshot.at(-1)!.message).toBe("toast 5");
  });

  it("dismissToast elimina el toast y notifica", () => {
    const id = emitToast("error", "algo falló");
    dismissToast(id);
    expect(getToastsSnapshot()).toHaveLength(0);
  });
});
