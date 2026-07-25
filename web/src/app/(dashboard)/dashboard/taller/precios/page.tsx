"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  Plus,
  Search,
  Calculator,
  Clock,
  Car,
  Fuel,
  Gauge,
  AlertTriangle,
  Edit3,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────── */

interface ServicePricingRule {
  id: string;
  servicioId: string;
  vehicleTypeId: string;
  fuelTypeId: string | null;
  mileageIntervalId: string | null;
  precioVentaPyg: string;
  precioCostoPyg: string;
  impuestoIvaPct: string;
  tiempoEstimadoMin: number;
  complejidad: string;
  activo: boolean;
  tenantSlug: string;
  createdAt: string;
  updatedAt: string;
}

interface VehicleType {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

interface FuelType {
  id: string;
  nombre: string;
  descripcion: string | null;
}

interface MileageInterval {
  id: string;
  kmDesde: number;
  kmHasta: number | null;
  nombre: string;
  orden: number;
}

interface ServicioCatalogo {
  id: string;
  nombre: string;
  codigo: string | null;
  categoria: string | null;
  precioEstimado: string | null;
}

const COMPLEJIDAD_COLORS: Record<string, string> = {
  BAJA: "bg-green-100 text-green-700 border-green-300",
  NORMAL: "bg-blue-100 text-blue-700 border-blue-300",
  ALTA: "bg-amber-100 text-amber-700 border-amber-300",
  CRITICA: "bg-red-100 text-red-700 border-red-300",
};

const DEFAULT_FORM = {
  servicioId: "",
  vehicleTypeId: "",
  fuelTypeId: "",
  mileageIntervalId: "",
  precioVentaPyg: 0,
  precioCostoPyg: 0,
  impuestoIvaPct: 10,
  tiempoEstimadoMin: 30,
  complejidad: "NORMAL",
};

/* ── Page Component ─────────────────────────── */

export default function PricingMatrixPage() {
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();
  const [search, setSearch] = React.useState("");
  const [servicioFilter, setServicioFilter] = React.useState("");
  const [vehicleFilter, setVehicleFilter] = React.useState("");

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ ...DEFAULT_FORM });

  // Resolve dialog
  const [resolveOpen, setResolveOpen] = React.useState(false);
  const [resolveForm, setResolveForm] = React.useState({ servicioId: "", vehicleTypeId: "", fuelTypeId: "", mileageIntervalId: "" });
  const [resolveResult, setResolveResult] = React.useState<ServicePricingRule | null>(null);
  const [resolveLoading, setResolveLoading] = React.useState(false);
  const [resolveAttempted, setResolveAttempted] = React.useState(false);

  // Reset resolver state when dialog opens
  React.useEffect(() => {
    if (resolveOpen) {
      setResolveAttempted(false);
      setResolveResult(null);
    }
  }, [resolveOpen]);

  // ── Fetch rules ──
  const { data: rules = [], isLoading } = useQuery<ServicePricingRule[]>({
    queryKey: ["pricing-rules", servicioFilter, vehicleFilter],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (servicioFilter) qs.set("servicioId", servicioFilter);
      if (vehicleFilter) qs.set("vehicleTypeId", vehicleFilter);
      qs.set("limit", "200");
      return api.request<ServicePricingRule[]>(`/workshop/pricing-rules?${qs.toString()}`);
    },
  });

  // ── Fetch reference data ──
  const { data: vehicleTypes = [] } = useQuery<VehicleType[]>({
    queryKey: ["vehicle-types"],
    queryFn: () => api.request<VehicleType[]>("/workshop/reference/vehicle-types"),
  });

  const { data: fuelTypes = [] } = useQuery<FuelType[]>({
    queryKey: ["fuel-types"],
    queryFn: () => api.request<FuelType[]>("/workshop/reference/fuel-types"),
  });

  const { data: mileageIntervals = [] } = useQuery<MileageInterval[]>({
    queryKey: ["mileage-intervals"],
    queryFn: () => api.request<MileageInterval[]>("/workshop/reference/mileage-intervals"),
  });

  const { data: servicios = [] } = useQuery<ServicioCatalogo[]>({
    queryKey: ["servicios-catalog"],
    queryFn: () => api.request<ServicioCatalogo[]>("/workshop/servicios?activo=true&limit=200"),
  });

  // ── Mutations ──
  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        servicioId: form.servicioId,
        vehicleTypeId: form.vehicleTypeId,
        ...(form.fuelTypeId ? { fuelTypeId: form.fuelTypeId } : {}),
        ...(form.mileageIntervalId ? { mileageIntervalId: form.mileageIntervalId } : {}),
        precioVentaPyg: form.precioVentaPyg,
        precioCostoPyg: form.precioCostoPyg,
        impuestoIvaPct: form.impuestoIvaPct,
        tiempoEstimadoMin: form.tiempoEstimadoMin,
        complejidad: form.complejidad,
      };
      if (editingId) {
        return api.request(`/workshop/pricing-rules/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      return api.request("/workshop/pricing-rules", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-rules"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm({ ...DEFAULT_FORM });
      t.success(editingId ? "Regla actualizada" : "Regla creada");
    },
    onError: (err: any) => t.error(err?.message || "Error al guardar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.request(`/workshop/pricing-rules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-rules"] });
      t.success("Regla eliminada");
    },
    onError: (err: any) => t.error(err?.message || "Error al eliminar"),
  });

  // ── Resolve price ──
  const handleResolve = async () => {
    if (!resolveForm.servicioId || !resolveForm.vehicleTypeId) return;
    setResolveLoading(true);
    setResolveResult(null);
    setResolveAttempted(true);
    try {
      const qs = new URLSearchParams({
        servicioId: resolveForm.servicioId,
        vehicleTypeId: resolveForm.vehicleTypeId,
      });
      if (resolveForm.fuelTypeId) qs.set("fuelTypeId", resolveForm.fuelTypeId);
      if (resolveForm.mileageIntervalId) qs.set("mileageIntervalId", resolveForm.mileageIntervalId);
      const result = await api.request<ServicePricingRule | null>(`/workshop/pricing-matrix?${qs.toString()}`);
      setResolveResult(result);
    } catch (err) {
      t.error("Error al consultar precio");
    } finally {
      setResolveLoading(false);
    }
  };

  const filtered = rules.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      const svc = servicios.find((s) => s.id === r.servicioId);
      const vh = vehicleTypes.find((v) => v.id === r.vehicleTypeId);
      if (!svc?.nombre.toLowerCase().includes(q) && !vh?.nombre.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const columns: Column<ServicePricingRule>[] = [
    {
      header: "Servicio",
      accessor: "servicioId",
      sortable: true,
      cell: (_, r) => {
        const svc = servicios.find((s) => s.id === r.servicioId);
        return <span className="font-medium text-sm">{svc?.nombre || r.servicioId.slice(0, 8)}</span>;
      },
    },
    {
      header: "Vehículo",
      accessor: "vehicleTypeId",
      cell: (_, r) => {
        const vt = vehicleTypes.find((v) => v.id === r.vehicleTypeId);
        return <Badge variant="outline" className="text-xs">{vt?.nombre || "—"}</Badge>;
      },
    },
    {
      header: "Precio Venta",
      accessor: "precioVentaPyg",
      sortable: true,
      align: "right",
      cell: (_, r) => <span className="font-mono font-medium">₲ {Number(r.precioVentaPyg).toLocaleString("es-PY")}</span>,
    },
    {
      header: "Costo",
      accessor: "precioCostoPyg",
      align: "right",
      hideOnMobile: true,
      cell: (_, r) => <span className="font-mono text-xs text-muted-foreground">₲ {Number(r.precioCostoPyg).toLocaleString("es-PY")}</span>,
    },
    {
      header: "Tiempo",
      accessor: "tiempoEstimadoMin",
      align: "center",
      hideOnMobile: true,
      cell: (_, r) => (
        <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> {r.tiempoEstimadoMin}min
        </span>
      ),
    },
    {
      header: "IVA",
      accessor: "impuestoIvaPct",
      align: "center",
      hideOnMobile: true,
      cell: (_, r) => <span className="text-xs">{r.impuestoIvaPct}%</span>,
    },
    {
      header: "Complejidad",
      accessor: "complejidad",
      cell: (_, r) => (
        <Badge className={cn("text-xs border", COMPLEJIDAD_COLORS[r.complejidad] || "")}>
          {r.complejidad}
        </Badge>
      ),
    },
    {
      header: "",
      accessor: "id",
      cell: (_, r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingId(r.id); setForm({
            servicioId: r.servicioId,
            vehicleTypeId: r.vehicleTypeId,
            fuelTypeId: r.fuelTypeId || "",
            mileageIntervalId: r.mileageIntervalId || "",
            precioVentaPyg: Number(r.precioVentaPyg),
            precioCostoPyg: Number(r.precioCostoPyg),
            impuestoIvaPct: Number(r.impuestoIvaPct),
            tiempoEstimadoMin: r.tiempoEstimadoMin,
            complejidad: r.complejidad,
          }); setDialogOpen(true); }}>
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => { if (confirm("¿Eliminar esta regla?")) deleteMut.mutate(r.id); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-blue-500" />
            Matriz de Precios
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión de precios por servicio × tipo de vehículo × combustible × kilometraje
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setResolveOpen(true)}>
            <Search className="h-4 w-4" />
            Consultar Precio
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setEditingId(null); setForm({ ...DEFAULT_FORM }); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            Nueva Regla
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Reglas activas</p><DollarSign className="h-4 w-4 text-blue-500" /></div>
          <p className="text-2xl font-bold mt-1">{rules.filter((r) => r.activo).length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Tipos vehículo</p><Car className="h-4 w-4 text-green-500" /></div>
          <p className="text-2xl font-bold mt-1">{vehicleTypes.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Tipos combustible</p><Fuel className="h-4 w-4 text-amber-500" /></div>
          <p className="text-2xl font-bold mt-1">{fuelTypes.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Intervalos km</p><Gauge className="h-4 w-4 text-purple-500" /></div>
          <p className="text-2xl font-bold mt-1">{mileageIntervals.length}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Buscar por servicio o vehículo..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      {/* DataTable */}
      <DataTable<ServicePricingRule>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={isLoading}
        emptyMessage="No hay reglas de precio configuradas. Creá la primera regla para comenzar."
        paginate
        pageSize={10}
        sortable
        className="shadow-sm"
      />

      {/* ── Create/Edit Dialog ──────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-blue-500" /> {editingId ? "Editar Regla" : "Nueva Regla de Precio"}</DialogTitle>
            <DialogDescription>Configurá el precio para un servicio según el tipo de vehículo</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Servicio" htmlFor="svc">
                <select id="svc" value={form.servicioId} onChange={(e) => setForm({ ...form, servicioId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" required>
                  <option value="">Seleccionar...</option>
                  {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </FormField>
              <FormField label="Tipo Vehículo" htmlFor="vh">
                <select id="vh" value={form.vehicleTypeId} onChange={(e) => setForm({ ...form, vehicleTypeId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" required>
                  <option value="">Seleccionar...</option>
                  {vehicleTypes.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Combustible (opcional)" htmlFor="fuel">
                <select id="fuel" value={form.fuelTypeId} onChange={(e) => setForm({ ...form, fuelTypeId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Todos</option>
                  {fuelTypes.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </FormField>
              <FormField label="Kilometraje (opcional)" htmlFor="km">
                <select id="km" value={form.mileageIntervalId} onChange={(e) => setForm({ ...form, mileageIntervalId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Todos</option>
                  {mileageIntervals.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Precio Venta (₲)" htmlFor="pv"><Input id="pv" type="number" min={0} value={form.precioVentaPyg || ""} onChange={(e) => setForm({ ...form, precioVentaPyg: Number(e.target.value) })} required /></FormField>
              <FormField label="Precio Costo (₲)" htmlFor="pc"><Input id="pc" type="number" min={0} value={form.precioCostoPyg || ""} onChange={(e) => setForm({ ...form, precioCostoPyg: Number(e.target.value) })} /></FormField>
              <FormField label="IVA %" htmlFor="iva"><Input id="iva" type="number" min={0} max={100} value={form.impuestoIvaPct || ""} onChange={(e) => setForm({ ...form, impuestoIvaPct: Number(e.target.value) })} /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Tiempo Estimado (min)" htmlFor="tiempo"><Input id="tiempo" type="number" min={0} value={form.tiempoEstimadoMin || ""} onChange={(e) => setForm({ ...form, tiempoEstimadoMin: Number(e.target.value) })} required /></FormField>
              <FormField label="Complejidad" htmlFor="comp">
                <select id="comp" value={form.complejidad} onChange={(e) => setForm({ ...form, complejidad: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="BAJA">Baja</option>
                  <option value="NORMAL">Normal</option>
                  <option value="ALTA">Alta</option>
                  <option value="CRITICA">Crítica</option>
                </select>
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!form.servicioId || !form.vehicleTypeId || saveMut.isPending} loading={saveMut.isPending}>
              {editingId ? "Guardar Cambios" : "Crear Regla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Resolve Dialog ──────────────────── */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-blue-500" /> Consultar Precio</DialogTitle>
            <DialogDescription>Seleccioná servicio y vehículo para ver el precio aplicable</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <FormField label="Servicio" htmlFor="rsvc">
              <select id="rsvc" value={resolveForm.servicioId} onChange={(e) => setResolveForm({ ...resolveForm, servicioId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="">Seleccionar...</option>
                {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </FormField>
            <FormField label="Tipo Vehículo" htmlFor="rvh">
              <select id="rvh" value={resolveForm.vehicleTypeId} onChange={(e) => setResolveForm({ ...resolveForm, vehicleTypeId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="">Seleccionar...</option>
                {vehicleTypes.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Combustible" htmlFor="rfuel">
                <select id="rfuel" value={resolveForm.fuelTypeId} onChange={(e) => setResolveForm({ ...resolveForm, fuelTypeId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Todos</option>
                  {fuelTypes.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </FormField>
              <FormField label="Kilometraje" htmlFor="rkm">
                <select id="rkm" value={resolveForm.mileageIntervalId} onChange={(e) => setResolveForm({ ...resolveForm, mileageIntervalId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Todos</option>
                  {mileageIntervals.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </FormField>
            </div>

            <Button onClick={handleResolve} loading={resolveLoading} disabled={!resolveForm.servicioId || !resolveForm.vehicleTypeId} className="w-full">
              <Search className="h-4 w-4 mr-1" /> Consultar Precio
            </Button>

            {resolveResult && (
              <Card className="bg-green-50 dark:bg-green-950 border-green-200">
                <CardContent className="pt-4 pb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Precio de Venta</span>
                    <span className="text-lg font-bold text-green-700">₲ {Number(resolveResult.precioVentaPyg).toLocaleString("es-PY")}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Tiempo estimado</span>
                    <span>{resolveResult.tiempoEstimadoMin} min</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>IVA</span>
                    <span>{resolveResult.impuestoIvaPct}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Complejidad</span>
                    <Badge className={cn("text-xs border", COMPLEJIDAD_COLORS[resolveResult.complejidad])}>{resolveResult.complejidad}</Badge>
                  </div>
                  {Number(resolveResult.precioCostoPyg) > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                      <span>Margen estimado</span>
                      <span className="font-medium text-green-600">
                        {((Number(resolveResult.precioVentaPyg) - Number(resolveResult.precioCostoPyg)) / Number(resolveResult.precioVentaPyg) * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {resolveAttempted && resolveResult === null && !resolveLoading && (
              <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200">
                <CardContent className="pt-4 pb-3 text-center text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4 mx-auto mb-1" />
                  No se encontró una regla de precio para esta combinación.
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ToastContainer}
    </div>
  );
}
