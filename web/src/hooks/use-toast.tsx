"use client";

import * as React from "react";
import { useState, useCallback } from "react";

/* ── Toast Types ────────────────────────────── */

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export interface ToastActions {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

/* ── Hook ───────────────────────────────────── */

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastItem["type"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ToastContainer = toasts.length > 0 ? (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium",
            t.type === "success" ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800" :
            t.type === "error" ? "bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800" :
            "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
          ].join(" ")}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-xs"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  ) : null;

  return {
    toast: {
      success: (message: string) => addToast(message, "success"),
      error: (message: string) => addToast(message, "error"),
      info: (message: string) => addToast(message, "info"),
    } as ToastActions,
    ToastContainer,
  };
}
