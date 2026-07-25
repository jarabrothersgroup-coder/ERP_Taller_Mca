"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Plus,
  Star,
  Phone,
  Mail,
  MapPin,
  Package,
  Wrench,
  Building2,
  Trash2,
  Pencil,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────── */

interface Proveedor {
  id: string;
  nombre: string;
  ruc: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  tipo: string;
  especialidades: string | null;
  calificacion: number | null;
  notas: string | null;
  activo: boolean;
  tenantSlug: string;
  createdAt: string;
}

const TIPO_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  REPUESTOS: { label: "Repuestos", color: "bg-blue-100 text-blue-700 border-blue-300", icon: Package },
  SERVICIOS: { label: "Servicios", color: "bg-purple-100 text-purple-700 border-purple-300", icon: Wrench },
  AMBOS: { label: "Ambos", color: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: Building2 },
};

const EMPTY_FORM = {
  nombre: "",
  ruc: "",
  telefono: "",
  email: "",
  direccion: "",
  tipo: "AMBOS",
  calificacion: 3,
  notas: "",
};

/* ── Main Page ──────────────────────────────── */

export default function ProveedoresPage() {
  const qc = useQueryClient();
  const { toast, ToastContainer } = useToast();
  const [search, setSearch] = React.useState("");
  const [tipoFilter, setTipoFilter] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);

  // ── Fetch proveedores ──
  const { data: proveedores = [], isLoading } = useQuery<Proveedor[]>({
    queryKey: ["proveedores"],
    queryFn: () => api.request<Proveedor[]>("/workshop/proveedores"),
  });

  // ── Filtered ──
  const filtered = React.useMemo(() => {
    let result = proveedores;
    if (tipoFilter) result = result.filter((p) => p.tipo === tipoFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.ruc && p.ruc.includes(q)) ||
          (p.email && p.email.toLowerCase().includes(q))
      );
    }
    return result;
  }, [proveedores, search, tipoFilter]);

  // ── Stats ──
  const total = proveedores.length;
  const activos = proveedores.filter((p) => p.activo).length;

  // ── Mutations ──
  const createMut = useMutation({
    mutationFn: () =>
      api.request("/workshop/proveedores", {
        method: "POST",
        body: JSON.stringify({ ...form, calificacion: Number(form.calificacion) || null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proveedores"] });
      closeDialog();
      toast.success("Proveedor creado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      api.request(`/workshop/proveedores/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, calificacion: Number(form.calificacion) || null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proveedores"] });
      closeDialog();
      toast.success("Proveedor actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api.request(`/workshop/proveedores/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proveedores"] });
      toast.success("Proveedor eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function openEdit(p: Proveedor) {
    setEditingId(p.id);
    setForm({
      nombre: p.nombre,
      ruc: p.ruc ?? "",
      telefono: p.telefono ?? "",
      email: p.email ?? "",
      direccion: p.direccion ?? "",
      tipo: p.tipo,
      calificacion: p.calificacion ?? 3,
      notas: p.notas ?? "",
    });
    setDialogOpen(true);
  }

  // ── Columns ──
  const columns: Column<Proveedor>[] = [
    {
      header: "Nombre",
      accessor: "nombre",
      sortable: true,
      cell: (_, row) => {
        const cfg = TIPO_CONFIG[row.tipo] || TIPO_CONFIG.AMBOS;
        const Icon = cfg.icon;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white text-xs font-bold">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">{row.nombre}</p>
              {row.ruc && (
                <p className="text-xs text-muted-foreground font-mono">RUC: {row.ruc}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "Tipo",
      accessor: "tipo",
      sortable: true,
      cell: (_, row) => {
        const cfg = TIPO_CONFIG[row.tipo] || TIPO_CONFIG.AMBOS;
        return <Badge className={cn("text-xs border", cfg.color)}>{cfg.label}</Badge>;
      },
    },
    {
      header: "Calificación",
      accessor: "calificacion",
      sortable: true,
      align: "center",
      cell: (_, row) =>
        row.calificacion ? (
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-3.5 w-3.5",
                  i < row.calificacion! ? "fill-amber-400 text-amber-400" : "text-gray-200"
                )}
              />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      header: "Contacto",
      accessor: "telefono",
      hideOnMobile: true,
      cell: (_, row) => (
        <div className="text-xs space-y-0.5">
          {row.telefono && (
            <p className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-muted-foreground" />
              {row.telefono}
            </p>
          )}
          {row.email && (
            <p className="flex items-center gap-1">
              <Mail className="h-3 w-3 text-muted-foreground" />
              {row.email}
            </p>
          )}
          {row.direccion && (
            <p className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              {row.direccion}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Estado",
      accessor: "activo",
      sortable: true,
      cell: (_, row) => (
        <Badge variant={row.activo ? "success" : "secondary"} className="text-xs">
          {row.activo ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      header: "",
      accessor: "id",
      className: "text-right",
      cell: (_, row) => (
        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(row)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-red-500 hover:text-red-700"
            onClick={() => {
              if (confirm(`¿Eliminar proveedor "${row.nombre}"?`)) deleteMut.mutate(row.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-orange-500" />
            Proveedores
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} proveedor{total !== 1 ? "es" : ""} · {activos} activos
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setEditingId(null);
            setForm(EMPTY_FORM);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nuevo Proveedor
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{activos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inactivos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">{total - activos}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tipo filter tabs ── */}
      <div className="flex flex-wrap gap-2" role="tablist">
        <Button variant={tipoFilter === "" ? "secondary" : "ghost"} size="sm" onClick={() => setTipoFilter("")}>
          Todos
        </Button>
        {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
          <Button
            key={key}
            variant={tipoFilter === key ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTipoFilter(key)}
            className="gap-1.5"
          >
            <cfg.icon className="h-3.5 w-3.5" />
            {cfg.label}
          </Button>
        ))}
      </div>

      {/* ── Data Table ── */}
      <DataTable<Proveedor>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={isLoading}
        emptyMessage={
          search || tipoFilter
            ? "No se encontraron proveedores"
            : "No hay proveedores registrados. Agregue el primero para comenzar."
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar por nombre, RUC o email…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
      />

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-orange-500" />
              {editingId ? "Editar Proveedor" : "Nuevo Proveedor"}
            </DialogTitle>
            <DialogDescription>
              {editingId ? "Actualice los datos del proveedor" : "Complete los datos del nuevo proveedor"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <FormField label="Nombre" htmlFor="pv-nombre" required>
              <Input
                id="pv-nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Taller de Pintura El Chero"
                required
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="RUC" htmlFor="pv-ruc">
                <Input
                  id="pv-ruc"
                  value={form.ruc}
                  onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                  placeholder="4051234567"
                />
              </FormField>
              <FormField label="Tipo" htmlFor="pv-tipo">
                <select
                  id="pv-tipo"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="AMBOS">Ambos</option>
                  <option value="REPUESTOS">Repuestos</option>
                  <option value="SERVICIOS">Servicios</option>
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Teléfono" htmlFor="pv-phone">
                <Input
                  id="pv-phone"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="+595 981 234567"
                />
              </FormField>
              <FormField label="Email" htmlFor="pv-email">
                <Input
                  id="pv-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contacto@proveedor.com"
                />
              </FormField>
            </div>
            <FormField label="Dirección" htmlFor="pv-dir">
              <Input
                id="pv-dir"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Av. Mariscal López 1234, Asunción"
              />
            </FormField>
            <FormField label="Calificación" htmlFor="pv-cal">
              <div className="flex items-center gap-2">
                <select
                  id="pv-cal"
                  value={form.calificacion}
                  onChange={(e) => setForm({ ...form, calificacion: Number(e.target.value) })}
                  className="flex h-9 w-20 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-4 w-4",
                        i < form.calificacion ? "fill-amber-400 text-amber-400" : "text-gray-200"
                      )}
                    />
                  ))}
                </div>
              </div>
            </FormField>
            <FormField label="Notas" htmlFor="pv-notes">
              <Textarea
                id="pv-notes"
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Especialidades, horarios, condiciones..."
                rows={3}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button
              onClick={() => (editingId ? updateMut.mutate() : createMut.mutate())}
              disabled={!form.nombre || createMut.isPending || updateMut.isPending}
              loading={createMut.isPending || updateMut.isPending}
            >
              {editingId ? "Guardar Cambios" : "Crear Proveedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ToastContainer}
    </div>
  );
}
