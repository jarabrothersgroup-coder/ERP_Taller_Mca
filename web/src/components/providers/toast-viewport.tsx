"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import {
  subscribeToasts,
  getToastsSnapshot,
  getToastsServerSnapshot,
  dismissToast,
  type ToastMessage,
} from "@/lib/toast-bus";

/**
 * T-55 — Viewport de toasts globales, montado una vez en el layout raíz.
 *
 * Lee del bus module-level (`lib/toast-bus.ts`) vía `useSyncExternalStore`:
 * renderiza aunque el emisor ya se haya desmontado. Estilos idénticos al
 * ToastContainer de `use-toast.tsx` para no tener dos lenguajes visuales.
 *
 * @module components/providers/toast-viewport
 */

const KIND_STYLES: Record<ToastMessage["kind"], string> = {
  success:
    "bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  error:
    "bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  info: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
};

const KIND_ICON: Record<ToastMessage["kind"], string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

export function ToastViewport() {
  // FIX (T-62) — el tercer argumento es `getServerSnapshot`: este componente se
  // renderiza en SSR (layout raíz) y React lo exige. Sin él, toda página
  // devuelve 500 en build de producción. Ver `lib/toast-bus.ts`.
  const toasts = useSyncExternalStore(
    subscribeToasts,
    getToastsSnapshot,
    getToastsServerSnapshot,
  );

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium",
            KIND_STYLES[t.kind],
          ].join(" ")}
        >
          <span aria-hidden="true">{KIND_ICON[t.kind]}</span>
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismissToast(t.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-xs"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
