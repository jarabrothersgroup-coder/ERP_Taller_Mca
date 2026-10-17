"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Loader2, Check, Hash, Car } from "lucide-react";
import { api, type WorkOrder } from "@/lib/api";
import { getStatusLabel, toUiStatus } from "@/lib/status";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Filas que se piden al backend por búsqueda. */
const SEARCH_LIMIT = 8;
/** Espera antes de consultar, para no pegarle al backend en cada tecla. */
const DEBOUNCE_MS = 300;
/** Estados terminales que no se asignan a un mecánico. */
const EXCLUDE_STATUS = "Finalizado_Retirado";

/** ¿`q` parece un UUID completo? Habilita usar el id a mano como último recurso. */
export function looksLikeUuid(q: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q.trim());
}

/** Número de OT corto — mismo formato que el Hub (`#fbc0771d`). */
export function shortOtId(id: string): string {
  return `#${id.slice(0, 8)}`;
}

export interface OtSearchSelectProps {
  /** Id de la OT seleccionada (`""` = ninguna). */
  value: string;
  onChange: (ordenId: string) => void;
  /** Se dispara al elegir una OT del listado (permite autocompletar otros campos). */
  onSelectOt?: (ot: WorkOrder) => void;
  /** `id` del input, para asociarlo al `<label>` de la página. */
  inputId?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Filtro de búsqueda de Órdenes de Trabajo.
 *
 * Reemplaza el ingreso a mano del UUID de la OT: busca en el backend por
 * id de OT, patente, cliente o descripción (debounced) y devuelve las
 * coincidencias para elegir una. La OT elegida queda fijada en `value`.
 *
 * Se excluyen las OTs `Finalizado_Retirado` (ya entregadas, no se asignan).
 */
export function OtSearchSelect({
  value,
  onChange,
  onSelectOt,
  inputId = "ot-search",
  placeholder = "Buscar por #ID, patente o cliente…",
  className,
}: OtSearchSelectProps) {
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const [selected, setSelected] = React.useState<WorkOrder | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);

  // Debounce del término de búsqueda.
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["ot-search", debounced],
    queryFn: () =>
      api.listWorkOrders({
        search: debounced || undefined,
        excludeStatus: EXCLUDE_STATUS,
        limit: SEARCH_LIMIT,
      }),
    staleTime: 30_000,
  });

  // `listWorkOrders` devuelve el sobre paginado { items, ... } — no un array.
  const items: WorkOrder[] = data?.items ?? [];
  // Si el texto es un UUID completo y no hubo coincidencias, se ofrece usarlo tal cual.
  const showUuidFallback = debounced.length > 0 && items.length === 0 && looksLikeUuid(debounced);
  const optionCount = items.length + (showUuidFallback ? 1 : 0);

  React.useEffect(() => {
    setHighlight(0);
  }, [debounced, open]);

  // Cerrar el panel al hacer click afuera.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Si el valor se limpia desde afuera, soltar la OT mostrada.
  React.useEffect(() => {
    if (!value) setSelected(null);
  }, [value]);

  const pick = (ot: WorkOrder) => {
    setSelected(ot);
    setQuery("");
    setOpen(false);
    onChange(ot.id);
    onSelectOt?.(ot);
  };

  const useRawId = () => {
    setSelected(null);
    setQuery("");
    setOpen(false);
    onChange(debounced);
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    onChange("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || optionCount === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % optionCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + optionCount) % optionCount);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight < items.length) pick(items[highlight]);
      else if (showUuidFallback) useRawId();
    }
  };

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      {/* OT elegida */}
      {value ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="font-mono text-xs font-semibold">{shortOtId(value)}</span>
              {selected && (
                <Badge variant="secondary" className="text-[10px]">
                  {getStatusLabel(toUiStatus(selected.status))}
                </Badge>
              )}
            </div>
            {selected && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {selected.vehiculo || "Sin vehículo"} · {selected.plate || "—"}
                {selected.cliente ? ` · ${selected.cliente}` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label="Quitar OT seleccionada"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* Campo de búsqueda */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${inputId}-listbox`}
          aria-autocomplete="list"
          autoComplete="off"
          className="pl-9 pr-9"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Resultados */}
      {open && (
        <div
          id={`${inputId}-listbox`}
          role="listbox"
          aria-label="Órdenes de trabajo"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg"
        >
          {items.map((ot, i) => (
            <button
              key={ot.id}
              type="button"
              role="option"
              aria-selected={ot.id === value}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(ot)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-border/50 px-3 py-2 text-left transition-colors last:border-0",
                i === highlight ? "bg-accent/60" : "hover:bg-accent/40",
              )}
            >
              <span className="shrink-0 font-mono text-xs font-semibold">{shortOtId(ot.id)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <Car className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs font-medium">{ot.vehiculo || "Sin vehículo"}</span>
                  {ot.plate && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{ot.plate}</span>}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {ot.cliente || "Sin cliente"}
                  {ot.description ? ` · ${ot.description}` : ""}
                </span>
              </span>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {getStatusLabel(toUiStatus(ot.status))}
              </Badge>
            </button>
          ))}

          {showUuidFallback && (
            <button
              type="button"
              role="option"
              aria-selected={false}
              onMouseEnter={() => setHighlight(items.length)}
              onClick={useRawId}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                highlight === items.length ? "bg-accent/60" : "hover:bg-accent/40",
              )}
            >
              <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">
                Usar el ID <span className="font-mono font-medium">{shortOtId(debounced)}</span>
                <span className="ml-1 text-muted-foreground">(sin coincidencias en el taller)</span>
              </span>
            </button>
          )}

          {optionCount === 0 && !isFetching && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {debounced
                ? <>Sin órdenes para <span className="font-medium">«{debounced}»</span></>
                : "No hay órdenes activas para asignar"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
