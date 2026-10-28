"use client";

import * as React from "react";
import { Search, Plus, Pencil, Trash2, X, Check, Loader2, Wrench, Clock } from "lucide-react";
import { api, type ServicioCatalogo, type ServicioCatalogoInput } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

/* ── Constantes ───────────────────────────────── */

/** Mínimo de caracteres para disparar la búsqueda (requisito: 3). */
export const MIN_SEARCH_LENGTH = 3;

/**
 * Catálogo de referencia. El combobox **filtra en el cliente** porque el
 * catálogo es chico/medio (≈100 activos por taller). Si superara este umbral,
 * conviene delegar al servidor con `api.listServiciosCatalogo({ search })`.
 */
export const CLIENT_FILTER_THRESHOLD = 300;

/** Categorías sugeridas (el campo es libre: se puede escribir una nueva). */
export const SERVICIO_CATEGORIAS = [
  "Mecánica General",
  "Mecánica Preventiva",
  "Electrónica",
  "Eléctrica",
  "Transmisión",
  "Tren Delantero y Frenos",
  "Asistencia ADAS",
  "Vehículos Eléctricos (BEV)",
  "EV/HEV Especializado",
  "Emergencias y Asistencia",
  "Especialidad Alta Performance",
] as const;

/* ── Utilidades ───────────────────────────────── */

/** Formatea un monto en guaraníes (₲) sin decimales. */
export function formatGs(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₲ ${Math.round(n).toLocaleString("es-PY")}`;
}

/**
 * Normaliza texto para comparar sin acentos ni mayúsculas, de modo que
 * "mecanica" encuentre "Mecánica".
 */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtra el catálogo por término de búsqueda. Con menos de
 * `MIN_SEARCH_LENGTH` letras devuelve todo (no se busca todavía).
 *
 * Busca en nombre, código, categoría y descripción — así "man" encuentra
 * "Mantenimiento preventivo" tanto por nombre como por categoría.
 */
export function filterServicios(
  servicios: ServicioCatalogo[],
  term: string,
): ServicioCatalogo[] {
  const q = normalize(term);
  if (q.length < MIN_SEARCH_LENGTH) return servicios;
  return servicios.filter((s) =>
    [s.nombre, s.codigo, s.categoria, s.descripcion]
      .filter(Boolean)
      .some((field) => normalize(String(field)).includes(q)),
  );
}

/** Valida los campos del formulario del catálogo. Devuelve el 1er error o null. */
export function validateServicioForm(form: {
  nombre: string;
  precioEstimado: string;
  duracionEstimada: string;
}): string | null {
  if (!form.nombre.trim()) return "El nombre del servicio es obligatorio";
  if (form.precioEstimado !== "" && Number(form.precioEstimado) < 0) {
    return "El precio unitario no puede ser negativo";
  }
  if (form.duracionEstimada !== "" && Number(form.duracionEstimada) < 0) {
    return "La duración estimada no puede ser negativa";
  }
  return null;
}

/* ── Tipos ────────────────────────────────────── */

interface ServicioFormState {
  nombre: string;
  codigo: string;
  categoria: string;
  precioEstimado: string;
  duracionEstimada: string;
  descripcionTecnica: string;
}

const EMPTY_FORM: ServicioFormState = {
  nombre: "",
  codigo: "",
  categoria: "",
  precioEstimado: "",
  duracionEstimada: "",
  descripcionTecnica: "",
};

function toForm(s: ServicioCatalogo): ServicioFormState {
  return {
    nombre: s.nombre ?? "",
    codigo: s.codigo ?? "",
    categoria: s.categoria ?? "",
    precioEstimado: s.precioEstimado != null ? String(Number(s.precioEstimado)) : "",
    duracionEstimada: s.duracionEstimada != null ? String(s.duracionEstimada) : "",
    descripcionTecnica: s.descripcionTecnica ?? "",
  };
}

export interface ServicioComboboxProps {
  /** Valor seleccionado (id del servicio) — controlado. */
  value: string | null;
  /** Callback al elegir un servicio del catálogo (null = limpiar). */
  onSelect: (servicio: ServicioCatalogo | null) => void;
  /** Término de búsqueda visible (controlado por el padre). */
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  /** Se llama tras crear/editar/eliminar para refrescar la lista del padre. */
  onCatalogChanged?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Combobox de servicios con búsqueda incremental y CRUD embebido.
 *
 * — **Búsqueda**: desde 3 caracteres, filtrando en cliente sobre el catálogo
 *   ya cargado (sin recargar la página ni round-trips por tecla).
 * — **CRUD embebido**: alta, edición y baja (soft-delete) del catálogo sin
 *   salir del Hub. Edita código, nombre, categoría, precio estimado, duración
 *   y descripción técnica.
 * — **Precio histórico**: la OT guarda un snapshot del nombre y precio al
 *   agregar la línea; editar el catálogo no cambia OTs existentes.
 */
export function ServicioCombobox({
  value,
  onSelect,
  searchTerm,
  onSearchTermChange,
  onCatalogChanged,
  disabled = false,
  className,
}: ServicioComboboxProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<ServicioCatalogo[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [editing, setEditing] = React.useState<ServicioCatalogo | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState<ServicioFormState>(EMPTY_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const rootRef = React.useRef<HTMLDivElement>(null);

  /* Carga inicial del catálogo activo (se filtra en cliente). */
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.listServiciosCatalogo({ activo: true, limit: CLIENT_FILTER_THRESHOLD });
      setItems(rows);
    } catch {
      toast.error("No se pudo cargar el catálogo de servicios");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    load();
  }, [load]);

  /* Cerrar al hacer click fuera. */
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(null);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = React.useMemo(
    () => filterServicios(items, searchTerm),
    [items, searchTerm],
  );

  const selected = React.useMemo(
    () => items.find((s) => s.id === value) ?? null,
    [items, value],
  );

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setFormError(null);
    setForm({ ...EMPTY_FORM, nombre: searchTerm.trim() });
  };

  const startEdit = (s: ServicioCatalogo) => {
    setEditing(s);
    setCreating(false);
    setFormError(null);
    setForm(toForm(s));
  };

  const cancelForm = () => {
    setCreating(false);
    setEditing(null);
    setFormError(null);
  };

  const buildPayload = (): ServicioCatalogoInput => ({
    nombre: form.nombre.trim(),
    codigo: form.codigo.trim() || undefined,
    categoria: form.categoria.trim() || undefined,
    descripcionTecnica: form.descripcionTecnica.trim() || undefined,
    precioEstimado: form.precioEstimado === "" ? undefined : Number(form.precioEstimado),
    duracionEstimada: form.duracionEstimada === "" ? undefined : Number(form.duracionEstimada),
  });

  const submitForm = async () => {
    const error = validateServicioForm(form);
    if (error) {
      setFormError(error);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        const updated = await api.updateServicioCatalogo(editing.id, buildPayload());
        toast.success(`Servicio "${updated.nombre}" actualizado`);
        // Si se editó el servicio ya elegido, refrescamos la selección con el
        // nuevo snapshot visible (las OT ya creadas conservan el precio viejo).
        if (updated.id === value) onSelect(updated);
      } else {
        const created = await api.createServicioCatalogo(buildPayload());
        toast.success(`Servicio "${created.nombre}" creado`);
        onSelect(created);
      }
      cancelForm();
      await load();
      onCatalogChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el servicio";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: ServicioCatalogo) => {
    if (!window.confirm(`¿Dar de baja el servicio "${s.nombre}" del catálogo?`)) return;
    try {
      await api.deleteServicioCatalogo(s.id);
      toast.success(`Servicio "${s.nombre}" dado de baja`);
      if (s.id === value) onSelect(null);
      await load();
      onCatalogChanged?.();
    } catch {
      toast.error("No se pudo dar de baja el servicio");
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {/* Input de búsqueda */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={searchTerm}
          onChange={(e) => {
            onSearchTermChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar servicio (mín. 3 letras)…"
          disabled={disabled}
          className="pl-8 pr-8 h-9 text-sm"
          aria-label="Buscar servicio del catálogo"
          aria-expanded={open}
          aria-haspopup="listbox"
          role="combobox"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              onSearchTermChange("");
              onSelect(null);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Servicio elegido */}
      {selected && !open && (
        <div className="mt-1.5 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs">
          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-medium truncate">{selected.nombre}</span>
          {selected.codigo && (
            <span className="text-muted-foreground shrink-0">{selected.codigo}</span>
          )}
          <span className="ml-auto font-semibold shrink-0">{formatGs(selected.precioEstimado)}</span>
        </div>
      )}

      {/* Panel desplegable */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-80 overflow-hidden flex flex-col">
          {/* Formulario de alta/edición */}
          {(creating || editing) && (
            <div className="p-3 border-b bg-muted/40 space-y-2">
              <p className="text-xs font-semibold">
                {editing ? `Editar: ${editing.nombre}` : "Nuevo servicio"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-[11px]">Nombre *</Label>
                  <Input
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Mantenimiento preventivo"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Código</Label>
                  <Input
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="ADA-SCY-002"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Categoría</Label>
                  <Input
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Mecánica General"
                    list="servicio-categorias"
                  />
                  <datalist id="servicio-categorias">
                    {SERVICIO_CATEGORIAS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Precio est. (₲)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.precioEstimado}
                    onChange={(e) => setForm({ ...form, precioEstimado: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="350000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Duración (min)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.duracionEstimada}
                    onChange={(e) => setForm({ ...form, duracionEstimada: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="60"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[11px]">Descripción técnica</Label>
                  <Textarea
                    value={form.descripcionTecnica}
                    onChange={(e) => setForm({ ...form, descripcionTecnica: e.target.value })}
                    rows={2}
                    className="text-xs"
                    placeholder="Detalle técnico del trabajo…"
                  />
                </div>
              </div>
              {formError && <p className="text-[11px] text-destructive">{formError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={submitForm} disabled={saving} className="h-7 text-xs">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  <span className="ml-1">{editing ? "Guardar" : "Crear"}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={cancelForm}
                  disabled={saving}
                  className="h-7 text-xs"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Lista */}
          <div className="overflow-y-auto" role="listbox">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando catálogo…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">
                {searchTerm.trim().length > 0 && searchTerm.trim().length < MIN_SEARCH_LENGTH
                  ? `Escribí al menos ${MIN_SEARCH_LENGTH} letras para buscar`
                  : "Sin resultados en el catálogo"}
              </div>
            ) : (
              filtered.map((s) => (
                <div
                  key={s.id}
                  role="option"
                  aria-selected={s.id === value}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-accent",
                    s.id === value && "bg-accent",
                  )}
                  onClick={() => {
                    onSelect(s);
                    setOpen(false);
                    onSearchTermChange(s.nombre);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate">{s.nombre}</span>
                      {s.codigo && (
                        <span className="text-[10px] text-muted-foreground shrink-0">{s.codigo}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {s.categoria && <span className="truncate">{s.categoria}</span>}
                      {s.duracionEstimada != null && (
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Clock className="h-2.5 w-2.5" />
                          {s.duracionEstimada} min
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-semibold shrink-0">{formatGs(s.precioEstimado)}</span>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(s);
                    }}
                    aria-label={`Editar ${s.nombre}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(s);
                    }}
                    aria-label={`Dar de baja ${s.nombre}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Pie: crear */}
          {!creating && !editing && (
            <button
              type="button"
              onClick={startCreate}
              className="flex items-center gap-1.5 border-t px-3 py-2 text-xs font-medium text-primary hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" />
              Crear servicio{searchTerm.trim() ? ` "${searchTerm.trim()}"` : ""}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Ícono reexportado para encabezados del Hub. */
export { Wrench };
