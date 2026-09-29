"use client";

/**
 * T-55 — Bus de toasts global para mutaciones.
 *
 * Los callbacks de `MutationCache` de React Query corren FUERA del contexto
 * React (no pueden usar hooks ni contextos): por eso el bus es un store
 * module-level y no un contexto. El `<ToastViewport/>` montado en el layout
 * raíz es el único suscriptor con estado React.
 *
 * Complementa (no reemplaza) al `useToast` de instancia de `use-toast.tsx`:
 * los toasts emitidos vía `emitToast` sobreviven al unmount del componente
 * que disparó la mutación (un `setTimeout` de una página que cambió de
 * pantalla hoy pierde su toast).
 *
 * @module lib/toast-bus
 */

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = (toasts: ToastMessage[]) => void;

/** Store module-level — vivo fuera de React, sobrevive a unmounts. */
let toasts: ToastMessage[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

const MAX_TOASTS = 4;
const TOAST_TTL_MS = 5000;

function emit() {
  const snapshot = [...toasts];
  for (const listener of listeners) listener(snapshot);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/**
 * Emite un toast global. Devuelve el id para poder cerrarlo manualmente.
 * @param kind - success | error | info
 * @param message - texto visible (ya localizado por el emisor)
 */
export function emitToast(kind: ToastKind, message: string): number {
  const id = nextId++;
  toasts = [...toasts, { id, kind, message }].slice(-MAX_TOASTS);
  emit();
  setTimeout(() => dismissToast(id), TOAST_TTL_MS);
  return id;
}

/**
 * Suscripción estilo useSyncExternalStore. `getSnapshot` devuelve el array
 * congelado del último emit — estable entre renders salvo cambio real.
 */
export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToastsSnapshot(): ToastMessage[] {
  return toasts;
}
