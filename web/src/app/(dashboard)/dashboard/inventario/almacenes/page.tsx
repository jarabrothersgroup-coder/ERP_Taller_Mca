"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { api, getTenantSlug } from "@/lib/api";
import { Plus, Warehouse, MapPin, User, Phone } from "lucide-react";

interface Almacen {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  responsable: string | null;
  telefono: string | null;
  activo: boolean;
}

export default function AlmacenesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ codigo: "", nombre: "", direccion: "", responsable: "", telefono: "" });

  const { data: almacenes = [], isLoading } = useQuery<Almacen[]>({
    queryKey: ["almacenes"],
    queryFn: () => api.request<Almacen[]>("/inventory/almacenes"),
  });

  const createMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      return api.request<Almacen>("/inventory/almacenes", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["almacenes"] });
      setForm({ codigo: "", nombre: "", direccion: "", responsable: "", telefono: "" });
      setOpen(false);
    },
  });

  const columns: Column<Almacen>[] = [
    { header: "Código", accessor: "codigo", sortable: true, className: "font-mono text-xs font-medium" },
    {
      header: "Nombre",
      accessor: "nombre",
      sortable: true,
      cell: (_, row) => (
        <div className="flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">{row.nombre}</span>
        </div>
      ),
    },
    {
      header: "Dirección",
      accessor: "direccion",
      cell: (_, row) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" aria-hidden="true" />
          <span>{row.direccion || "—"}</span>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      header: "Responsable",
      accessor: "responsable",
      cell: (_, row) => (
        <div className="flex items-center gap-1.5 text-xs">
          <User className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <span>{row.responsable || "—"}</span>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      header: "Teléfono",
      accessor: "telefono",
      cell: (_, row) => (
        <div className="flex items-center gap-1.5 text-xs">
          <Phone className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <span>{row.telefono || "—"}</span>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      header: "Estado",
      accessor: "activo",
      align: "center",
      cell: (_, row) => (
        <Badge variant={row.activo ? "success" : "secondary"}>
          {row.activo ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Almacenes</h1>
          <p className="text-sm text-muted-foreground">Gestión de múltiples ubicaciones de inventario</p>
        </div>
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow" onClick={() => setOpen(!open)}>
          <Plus className="h-5 w-5" aria-hidden="true" /> Nuevo Almacén
        </Button>
      </div>

      {open && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">Nuevo Almacén</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Input placeholder="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
              <Input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              <Input placeholder="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
              <Input placeholder="Responsable" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
              <div className="flex gap-2">
                <Input placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                <Button type="submit" loading={createMutation.isPending}>Crear</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <DataTable<Almacen>
        columns={columns}
        data={almacenes}
        rowKey="id"
        loading={isLoading}
        emptyMessage="No hay almacenes registrados. Cree el primer almacén para comenzar."
        paginate
        pageSize={10}
        sortable
      />
    </div>
  );
}
