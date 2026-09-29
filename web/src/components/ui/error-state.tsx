"use client";

import { AlertTriangle, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** Título del error (opcional) */
  title?: string;
  /** Mensaje legible — se muestra el del error si se omite */
  message?: string;
  /** Callback de reintento (refetch de React Query) */
  onRetry?: () => void;
  /** Clase extra para ajustar el contenedor al espacio disponible */
  className?: string;
  /** Variante compacta para columnas/paneles laterales */
  compact?: boolean;
}

/**
 * Estado de error de carga de datos — sustituye al skeleton cuando una
 * query falla, para que ninguna página quede en carga silenciosa eterna.
 *
 * Uso:
 * ```tsx
 * const { data, isLoading, isError, error, refetch } = useClients();
 * if (isError) return <ErrorState message={error.message} onRetry={refetch} />;
 * ```
 */
function ErrorState({
  title = "No se pudieron cargar los datos",
  message,
  onRetry,
  className,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 p-4 py-6" : "gap-3 p-8 py-12",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-destructive/10",
          compact ? "h-9 w-9" : "h-12 w-12"
        )}
      >
        <AlertTriangle
          className={cn("text-destructive", compact ? "h-4 w-4" : "h-6 w-6")}
          aria-hidden="true"
        />
      </div>
      <p className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>{title}</p>
      {message && (
        <p className="text-xs text-muted-foreground max-w-sm break-words">{message}</p>
      )}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reintentar
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  message?: string;
  /** Acción opcional (botón) */
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

/**
 * Estado vacío de una lista/columna — distingue "no hay datos" de "cargando"
 * y de "falló", para que el usuario sepa qué esperar.
 */
function EmptyState({
  title = "Sin resultados",
  message,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1.5 p-4 py-6" : "gap-2 p-8 py-12",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-muted",
          compact ? "h-9 w-9" : "h-12 w-12"
        )}
      >
        <Inbox
          className={cn("text-muted-foreground", compact ? "h-4 w-4" : "h-6 w-6")}
          aria-hidden="true"
        />
      </div>
      <p className={cn("font-medium text-muted-foreground", compact ? "text-xs" : "text-sm")}>
        {title}
      </p>
      {message && <p className="text-xs text-muted-foreground/70 max-w-sm">{message}</p>}
      {action}
    </div>
  );
}

export { ErrorState, EmptyState };
