"use client";

import { useState } from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { emitToast } from "@/lib/toast-bus";
import { ToastViewport } from "@/components/providers/toast-viewport";

/**
 * T-55 — Red global de feedback para mutaciones.
 *
 * El `MutationCache` intercepta TODAS las `useMutation` de la app:
 *
 *  - onError → toast de error con el mensaje del backend, SALVO que la
 *    mutación defina su propio `onError` (36 ficheros ya lo hacen: sin
 *    esto habría doble toast).
 *  - onSuccess → toast de éxito solo si la mutación declara
 *    `meta: { successMessage: "…" }`: un mensaje genérico ("Guardado")
 *    para 200 mutaciones distintas no informa nada.
 *
 * El mensaje de error viene de `lib/api.ts`, que ya prefiere el `message`
 * humano del backend sobre el nombre de la clase de error.
 *
 * Offline-first: con el navegador sin red el mensaje es explícito en vez
 * del crítico inglés "Failed to fetch".
 *
 * @module components/providers/query-provider
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // Respeto al manejador local: si la mutación ya muestra su
            // error, no duplicar el toast.
            if (mutation.options.onError) return;
            const offline =
              typeof navigator !== "undefined" && navigator.onLine === false;
            const message = offline
              ? "Sin conexión con el servidor"
              : error instanceof Error && error.message
                ? error.message
                : "Error inesperado";
            emitToast("error", message);
          },
          onSuccess: (_data, _variables, _context, mutation) => {
            const meta = mutation.meta as { successMessage?: string } | undefined;
            const success = meta?.successMessage;
            if (typeof success === "string") emitToast("success", success);
          },
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastViewport />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
