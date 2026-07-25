"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Package,
  Clock,
  DollarSign,
  Wrench,
  Tag,
  AlertCircle,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────

interface ServicioCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
  descripcionTecnica: string | null;
  categoria: string | null;
  categoriaId: string | null;
  codigo: string | null;
  thinkcarModulo: string | null;
  precioEstimado: string | null;
  duracionEstimada: number | null;
  activo: boolean;
  tenantSlug: string;
  createdAt: string;
  updatedAt: string;
}

interface ServicioFormData {
  nombre: string;
  descripcion: string;
  descripcionTecnica: string;
  categoria: string;
  codigo: string;
  precioEstimado: number | null;
  duracionEstimada: number | null;
  activo: boolean;
}

// ─── Categories ─────────────────────────────────

const SERVICIO_CATEGORIAS = [
  "MECANICA",
  "ELECTRICA",
  "ELECTRONICA",
  "CHAPA",
  "PINTURA",
  "SUSPENSION",
  "DIRECCION",
  "FRENOS",
  "TRANSMISION",
  "MOTOR",
  "DIAGNOSTICO",
  "MANTENIMIENTO",
  "AIRE_ACONDICIONADO",
  "HERRERIA",
  "LUBRICENTRO",
  "HIGIENICO",
  "OTROS",
];

const CATEGORIA_LABELS: Record<string, string> = {
  MECANICA: "Mecánica General",
  ELECTRICA: "Eléctrica",
  ELECTRONICA: "Electrónica",
  CHAPA: "Chapa y Desabolladura",
  PINTURA: "Pintura",
  SUSPENSION: "Suspensión",
  DIRECCION: "Dirección",
  FRENOS: "Frenos",
  TRANSMISION: "Transmisión",
  MOTOR: "Motor",
  DIAGNOSTICO: "Diagnóstico",
  MANTENIMIENTO: "Mantenimiento",
  AIRE_ACONDICIONADO: "Aire Acondicionado",
  HERRERIA: "Herrería",
  LUBRICENTRO: "Lubricentro",
  HIGIENICO: "Higiénico",
  OTROS: "Otros",
};

// ─── Format Helpers ─────────────────────────────

function formatPrecio(val: string | null): string {
  if (!val) return "—";
  const num = Number(val);
  if (isNaN(num)) return val;
  return `₲ ${num.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`;
}

function formatDuracion(min: number | null): string {
  if (!min && min !== 0) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Empty Form State ───────────────────────────

const EMPTY_FORM: ServicioFormData = {
  nombre: "",
  descripcion: "",
  descripcionTecnica: "",
  categoria: "",
  codigo: "",
  precioEstimado: null,
  duracionEstimada: null,
  activo: true,
};

// ═══════════════════════════════════════════════
// Page Component
// ═══════════════════════════════════════════════

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<ServicioCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("TODAS");
  const [showInactivos, setShowInactivos] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServicioFormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Toast
  const { toast, ToastContainer } = useToast();

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // ── Load servicios ─────────────────────────────
  const loadServicios = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (categoriaFilter !== "TODAS") qs.set("categoria", categoriaFilter);
      qs.set("limit", "200");
      const data = await api.request<ServicioCatalogo[]>(
        `/workshop/servicios?${qs.toString()}`,
      );
      setServicios(data ?? []);
    } catch (err) {
      console.error("Error loading servicios:", err);
      toast.error("Error al cargar servicios");
      setServicios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServicios();
  }, [categoriaFilter]);

  // ── Filtered list ──────────────────────────────
  const filtered = servicios.filter((s) => {
    if (!showInactivos && !s.activo) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.nombre.toLowerCase().includes(q) ||
      (s.descripcion ?? "").toLowerCase().includes(q) ||
      (s.codigo ?? "").toLowerCase().includes(q) ||
      (s.categoria ?? "").toLowerCase().includes(q)
    );
  });

  // ── Open create dialog ─────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  // ── Open edit dialog ───────────────────────────
  const openEdit = (s: ServicioCatalogo) => {
    setEditingId(s.id);
    setForm({
      nombre: s.nombre,
      descripcion: s.descripcion ?? "",
      descripcionTecnica: s.descripcionTecnica ?? "",
      categoria: s.categoria ?? "",
      codigo: s.codigo ?? "",
      precioEstimado: s.precioEstimado ? Number(s.precioEstimado) : null,
      duracionEstimada: s.duracionEstimada,
      activo: s.activo,
    });
    setDialogOpen(true);
  };

  // ── Save (create or update) ────────────────────
  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre del servicio es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.request(`/workshop/servicios/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...form,
            precioEstimado: form.precioEstimado ?? undefined,
            duracionEstimada: form.duracionEstimada ?? undefined,
          }),
        });
        toast.success("Servicio actualizado");
      } else {
        await api.request("/workshop/servicios", {
          method: "POST",
          body: JSON.stringify({
            nombre: form.nombre,
            descripcion: form.descripcion || undefined,
            descripcionTecnica: form.descripcionTecnica || undefined,
            categoria: form.categoria || undefined,
            codigo: form.codigo || undefined,
            precioEstimado: form.precioEstimado ?? undefined,
            duracionEstimada: form.duracionEstimada ?? undefined,
          }),
        });
        toast.success("Servicio creado");
      }
      setDialogOpen(false);
      loadServicios();
    } catch (err) {
      console.error("Error saving servicio:", err);
      toast.error("Error al guardar servicio");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete (soft) ──────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await api.request(`/workshop/servicios/${id}`, { method: "DELETE" });
      toast.success("Servicio desactivado");
      setDeleteConfirm(false);
      setDeletingId(null);
      loadServicios();
    } catch (err) {
      console.error("Error deleting servicio:", err);
      toast.error("Error al desactivar servicio");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6 text-orange-500" />
            Catálogo de Servicios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona los servicios que ofrece tu taller — precios, duración y descripciones técnicas
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Servicio
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar servicios..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value)}
              className="w-[200px]"
              placeholder="Categoría"
              options={[
                { value: "TODAS", label: "Todas las categorías" },
                ...SERVICIO_CATEGORIAS.map((cat) => ({
                  value: cat,
                  label: CATEGORIA_LABELS[cat] ?? cat,
                })),
              ]}
            />
            <Button
              variant={showInactivos ? "default" : "outline"}
              onClick={() => setShowInactivos(!showInactivos)}
              className="gap-2"
            >
              {showInactivos ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {showInactivos ? "Mostrando inactivos" : "Solo activos"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total servicios</p>
              <Package className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold mt-1">{servicios.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Activos</p>
              <Check className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold mt-1">
              {servicios.filter((s) => s.activo).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Categorías</p>
              <Tag className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold mt-1">
              {new Set(servicios.map((s) => s.categoria).filter(Boolean)).size}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Precio promedio</p>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-lg font-bold mt-1">
              {(() => {
                const prices = servicios
                  .filter((s) => s.precioEstimado)
                  .map((s) => Number(s.precioEstimado))
                  .filter((n) => !isNaN(n) && n > 0);
                if (prices.length === 0) return "—";
                const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                return `₲ ${Math.round(avg).toLocaleString("es-PY")}`;
              })()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Servicios
            <Badge variant="secondary" className="ml-2">
              {filtered.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            {showInactivos
              ? "Mostrando todos los servicios"
              : `Mostrando ${filtered.length} servicios activos`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">No hay servicios</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {search
                  ? "Intenta con otro término de búsqueda"
                  : "Crea tu primer servicio para empezar"}
              </p>
              {!search && (
                <Button variant="outline" className="mt-4 gap-2" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Nuevo Servicio
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Código
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Nombre
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                      Categoría
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                      Duración
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                      Precio Est.
                    </th>
                    <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Estado
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((servicio) => (
                    <tr
                      key={servicio.id}
                      className={cn(
                        "group transition-colors hover:bg-muted/50",
                        !servicio.activo && "opacity-60",
                      )}
                    >
                      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                        {servicio.codigo ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{servicio.nombre}</p>
                          {servicio.descripcion && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1">
                              {servicio.descripcion}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {servicio.categoria ? (
                          <Badge variant="outline" className="text-xs">
                            {CATEGORIA_LABELS[servicio.categoria] ?? servicio.categoria}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm hidden sm:table-cell">
                        {servicio.duracionEstimada != null ? (
                          <span className="flex items-center justify-end gap-1.5 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDuracion(servicio.duracionEstimada)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium hidden sm:table-cell">
                        {formatPrecio(servicio.precioEstimado)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={servicio.activo ? "default" : "secondary"}
                          className={cn(
                            "text-xs",
                            !servicio.activo && "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                          )}
                        >
                          {servicio.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(servicio)}
                            title="Editar"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          {servicio.activo && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={() => {
                                setDeletingId(servicio.id);
                                setDeleteConfirm(true);
                              }}
                              title="Desactivar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {ToastContainer}

      {/* ── Create/Edit Dialog ──────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-orange-500" />
              {editingId ? "Editar Servicio" : "Nuevo Servicio"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Actualiza los datos del servicio del catálogo"
                : "Agrega un nuevo servicio al catálogo del taller"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Nombre */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                Nombre <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Cambio de aceite y filtro"
              />
            </div>

            {/* Código + Categoría */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Código</label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="Ej: SRV-001"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Categoría</label>
                <Select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  placeholder="Seleccionar..."
                  options={SERVICIO_CATEGORIAS.map((cat) => ({
                    value: cat,
                    label: CATEGORIA_LABELS[cat] ?? cat,
                  }))}
                />
              </div>
            </div>

            {/* Precio + Duración */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Precio Estimado (₲)</label>
                <Input
                  type="number"
                  min={0}
                  value={form.precioEstimado ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      precioEstimado: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Ej: 150000"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Duración (minutos)</label>
                <Input
                  type="number"
                  min={0}
                  value={form.duracionEstimada ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      duracionEstimada: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Ej: 45"
                />
              </div>
            </div>

            {/* Descripción */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Breve descripción del servicio..."
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Descripción Técnica */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Descripción Técnica</label>
              <textarea
                value={form.descripcionTecnica}
                onChange={(e) => setForm({ ...form, descripcionTecnica: e.target.value })}
                placeholder="Detalle técnico para el mecánico..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.nombre.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Guardar Cambios" : "Crear Servicio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ──────────── */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Desactivar Servicio
            </DialogTitle>
            <DialogDescription>
              El servicio quedará inactivo y no aparecerá en las opciones de nuevas órdenes de
              trabajo. Los servicios ya registrados en órdenes activas no se verán afectados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
