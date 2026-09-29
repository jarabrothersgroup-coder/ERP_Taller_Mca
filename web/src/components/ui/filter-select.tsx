"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  /** Etiqueta accesible (aria-label) y visible junto al select */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Opciones dinámicas (de una query, catálogo, etc.) */
  options: FilterOption[];
  /**
   * Texto de la opción "sin filtro" con value "". Si se omite, no se añade
   * (útil cuando el filtro exige una selección).
   */
  allLabel?: string;
  /** La query que alimenta las opciones está cargando */
  isLoading?: boolean;
  /** Texto cuando options está vacío y no está cargando */
  emptyText?: string;
  /** Ocultar la etiqueta visible (queda solo como aria-label) */
  hideLabel?: boolean;
  className?: string;
  disabled?: boolean;
}

/**
 * T-54 — Select de filtro unificado con soporte de opciones dinámicas.
 *
 * Sustituye a los `<select>` nativos sueltos de las páginas de filtro:
 *  - label accesible siempre presente (aria-label)
 *  - opción "Todos" (`allLabel`) que representa "sin filtro" (value "")
 *  - estado de carga: deshabilitado con texto "Cargando…"
 *  - estado vacío: deshabilitado con `emptyText` en lugar de opciones fantasma
 *
 * Los selects de FORMULARIO siguen usando el `Select` base — este componente
 * es solo para filtrar datos de una vista.
 *
 * Uso:
 * ```tsx
 * const { data: tecnicos = [], isLoading } = useTechnicians();
 * <FilterSelect
 *   label="Técnico"
 *   value={tecnicoFilter}
 *   onChange={setTecnicoFilter}
 *   options={tecnicos.map((t) => ({ value: t.id, label: t.nombre }))}
 *   allLabel="Todos los técnicos"
 *   isLoading={isLoading}
 *   emptyText="Sin técnicos activos"
 * />
 * ```
 */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  isLoading = false,
  emptyText = "Sin opciones",
  hideLabel = false,
  className,
  disabled = false,
}: FilterSelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  const resolvedOptions: FilterOption[] = React.useMemo(() => {
    const base = allLabel !== undefined ? [{ value: "", label: allLabel }] : [];
    return [...base, ...options];
  }, [allLabel, options]);

  const isEmpty = !isLoading && options.length === 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {!hideLabel && (
        <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {label}
        </label>
      )}
      <Select
        value={value}
        onChange={handleChange}
        disabled={disabled || isLoading || isEmpty}
        aria-label={label}
        className="h-8 w-auto min-w-[10rem] text-xs"
        options={
          isLoading
            ? [{ value, label: "Cargando…" }]
            : isEmpty
              ? [{ value: "", label: emptyText }]
              : resolvedOptions
        }
      />
    </div>
  );
}
