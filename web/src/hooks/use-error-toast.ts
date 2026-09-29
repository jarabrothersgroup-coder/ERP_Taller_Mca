"use client";

import * as React from "react";
import { useToast } from "@/hooks/use-toast";

/**
 * T-53 — toast de error una sola vez cuando una query pasa a `isError`.
 *
 * El detalle visual (mensaje + botón Reintentar) vive en `<ErrorState/>`;
 * este hook garantiza además feedback visible en el momento del fallo,
 * sin repetir el toast en cada re-render mientras el error persiste.
 *
 * Uso:
 * ```tsx
 * const { data, isLoading, isError, refetch } = useClients();
 * useErrorToast(isError, "clientes");
 * if (isError) return <ErrorState onRetry={refetch} />;
 * ```
 */
export function useErrorToast(isError: boolean, label: string): void {
  const { toast } = useToast();

  React.useEffect(() => {
    if (isError) {
      toast.error(`No se pudo cargar ${label}`);
    }
  }, [isError, label]);
}
