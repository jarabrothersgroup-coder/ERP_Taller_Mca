"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  ArrowLeftRight,
  Warehouse,
  MapPin,
  User,
  Phone,
  History,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────── */

interface Almacen {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  responsable: string | null;
  telefono: string | null;
  activo: boolean;
}

interface Repuesto {
  id: string;
  codigo: string;
  descripcion: string;
  stockActual: number;
}

interface Transferencia {
  id: string;
  repuestoId: string;
  repuestoNombre?: string;
  cantidad: number;
  almacenOrigenId: string | null;
  almacenDestinoId: string;
  almacenOrigenNombre?: string;
  almacenDestinoNombre?: string;
  motivo: string | null;
  estado: string;
  createdAt: string;
}

/* ── Page Component ─────────────────────────── */

export default function AlmacenesPage() {
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ codigo: "", nombre: "", direccion: "", responsable: "", telefono: "" });

  // Transfer dialog state
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [transferForm, setTransferForm] = React.useState({
    repuestoId: "",
    almacenOrigenId: "",
    almacenDestinoId: "",
    cantidad: 1,
    motivo: "",
  });
  const [activeTab, setActiveTab] = React.useState<"almacenes" | "transferencias">("almacenes");

  // ── Fetch almacenes ──
  const { data: almacenes = [], isLoading } = useQuery<Almacen[]>({
    queryKey: ["almacenes"],
    queryFn: () => api.request<Almacen[]>("/inventory/almacenes"),
  });

  // ── Fetch repuestos for selector ──
  const { data: repuestos = [] } = useQuery<Repuesto[]>({
    queryKey: ["repuestos-selector"],
    queryFn: () => api.request<any>("/inventory/repuestos?limit=200").then((r: any) => r.items || r || []),
  });

  // ── Fetch transferencias (paralelo, sin esperar almacenes/repuestos) ──
  const { data: transferencias = [], isLoading: transLoading } = useQuery<Transferencia[]>({
    queryKey: ["transferencias"],
    queryFn: async () => {
      const data = await api.request<any[]>("/inventory/stock-movements?tipo=TRANSFERENCIA&limit=50");
      return (data || []).map((t: any) => ({
        ...t,
        almacenOrigenNombre: almacenes.find((a) => a.id === t.almacenOrigen)?.nombre || t.almacenOrigen?.slice(0, 8) || "Stock general",
        almacenDestinoNombre: almacenes.find((a) => a.id === t.almacenDestino)?.nombre || t.almacenDestino?.slice(0, 8) || "—",
        repuestoNombre: repuestos.find((r) => r.id === t.repuestoId)?.descripcion || t.repuestoId?.slice(0, 8),
      }));
    },
  });

  // ── Create almacén mutation ──
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
      t.success("Almacén creado");
    },
    onError: (err: any) => t.error(err?.message || "Error al crear almacén"),
  });

  // ── Transferir stock mutation ──
  const transferMut = useMutation({
    mutationFn: async () => {
      return api.request("/inventory/almacenes/transferir", {
        method: "POST",
        body: JSON.stringify({
          repuestoId: transferForm.repuestoId,
          cantidad: transferForm.cantidad,
          almacenDestinoId: transferForm.almacenDestinoId,
          almacenOrigenId: transferForm.almacenOrigenId || undefined,
          motivo: transferForm.motivo || "Transferencia entre almacenes",
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["almacenes"] });
      qc.invalidateQueries({ queryKey: ["transferencias"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["repuestos-selector"] });
      setTransferOpen(false);
      setTransferForm({ repuestoId: "", almacenOrigenId: "", almacenDestinoId: "", cantidad: 1, motivo: "" });
      t.success("Transferencia realizada");
    },
    onError: (err: any) => t.error(err?.message || "Error al transferir"),
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

  const transferColumns: Column<Transferencia>[] = [
    {
      header: "Fecha",
      accessor: "createdAt",
      sortable: true,
      cell: (_, row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString("es-PY", { dateStyle: "short" })}
        </span>
      ),
    },
    {
      header: "Repuesto",
      accessor: "repuestoNombre",
      cell: (_, row) => <span className="text-sm font-medium">{row.repuestoNombre || row.repuestoId.slice(0, 8)}</span>,
    },
    {
      header: "Cantidad",
      accessor: "cantidad",
      align: "right",
      cell: (_, row) => <span className="font-mono font-medium text-blue-600">{row.cantidad}</span>,
    },
    {
      header: "Origen",
      accessor: "almacenOrigenNombre",
      cell: (_, row) => (
        <div className="flex items-center gap-1">
          <Warehouse className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs">{row.almacenOrigenNombre || "Stock general"}</span>
        </div>
      ),
    },
    {
      header: "Destino",
      accessor: "almacenDestinoNombre",
      cell: (_, row) => (
        <div className="flex items-center gap-1">
          <Truck className="h-3 w-3 text-blue-500" />
          <span className="text-xs">{row.almacenDestinoNombre}</span>
        </div>
      ),
    },
    {
      header: "Estado",
      accessor: "estado",
      cell: (_, row) => (
        <Badge variant={row.estado === "COMPLETADA" ? "success" : "secondary"} className="text-xs">
          {row.estado === "COMPLETADA" ? "Completada" : row.estado}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-blue-500" />
            Almacenes
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión de múltiples ubicaciones de inventario y transferencias
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight className="h-4 w-4 text-blue-500" />
            Transferir Stock
          </Button>
          <Button size="sm" className="gap-2 shadow-md" onClick={() => setOpen(!open)}>
            <Plus className="h-4 w-4" /> Nuevo Almacén
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" role="tablist">
        <button
          onClick={() => setActiveTab("almacenes")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5",
            activeTab === "almacenes" ? "border-blue-500 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          role="tab"
        >
          <Warehouse className="h-4 w-4" />
          Almacenes
        </button>
        <button
          onClick={() => setActiveTab("transferencias")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5",
            activeTab === "transferencias" ? "border-blue-500 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          role="tab"
        >
          <History className="h-4 w-4" />
          Transferencias
        </button>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* TAB: Almacenes */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === "almacenes" && (
        <>
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
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: Transferencias */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === "transferencias" && (
        <DataTable<Transferencia>
          columns={transferColumns}
          data={transferencias}
          rowKey="id"
          loading={transLoading}
          emptyMessage="No hay transferencias entre almacenes registradas"
          paginate
          pageSize={10}
          sortable
          className="shadow-sm"
        />
      )}

      {/* ── Transfer Dialog ──────────────────── */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-blue-500" />
              Transferir Stock entre Almacenes
            </DialogTitle>
            <DialogDescription>
              Mové stock de un almacén a otro. La operación es atómica y genera asiento contable automático.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <FormField label="Repuesto" htmlFor="t-repuesto">
              <select
                id="t-repuesto"
                value={transferForm.repuestoId}
                onChange={(e) => setTransferForm({ ...transferForm, repuestoId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                required
              >
                <option value="">Seleccionar repuesto...</option>
                {repuestos.map((r: Repuesto) => (
                  <option key={r.id} value={r.id}>
                    {r.codigo} — {r.descripcion} (stock: {r.stockActual})
                  </option>
                ))}
              </select>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Almacén Origen" htmlFor="t-origen">
                <select
                  id="t-origen"
                  value={transferForm.almacenOrigenId}
                  onChange={(e) => setTransferForm({ ...transferForm, almacenOrigenId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">Stock general</option>
                  {almacenes.filter((a) => a.id !== transferForm.almacenDestinoId).map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre} ({a.codigo})</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Almacén Destino" htmlFor="t-destino">
                <select
                  id="t-destino"
                  value={transferForm.almacenDestinoId}
                  onChange={(e) => setTransferForm({ ...transferForm, almacenDestinoId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {almacenes.filter((a) => a.id !== transferForm.almacenOrigenId).map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre} ({a.codigo})</option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Cantidad" htmlFor="t-cantidad">
                <Input
                  id="t-cantidad"
                  type="number"
                  min={1}
                  value={transferForm.cantidad}
                  onChange={(e) => setTransferForm({ ...transferForm, cantidad: Number(e.target.value) })}
                  required
                />
              </FormField>
              <FormField label="Motivo (opcional)" htmlFor="t-motivo">
                <Input
                  id="t-motivo"
                  value={transferForm.motivo}
                  onChange={(e) => setTransferForm({ ...transferForm, motivo: e.target.value })}
                  placeholder="Ej: Reabastecimiento"
                />
              </FormField>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setTransferOpen(false); setTransferForm({ repuestoId: "", almacenOrigenId: "", almacenDestinoId: "", cantidad: 1, motivo: "" }); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => transferMut.mutate()}
              disabled={!transferForm.repuestoId || !transferForm.almacenDestinoId || transferForm.cantidad < 1 || transferMut.isPending}
              loading={transferMut.isPending}
            >
              <ArrowLeftRight className="h-4 w-4 mr-1" />
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ToastContainer}
    </div>
  );
}
