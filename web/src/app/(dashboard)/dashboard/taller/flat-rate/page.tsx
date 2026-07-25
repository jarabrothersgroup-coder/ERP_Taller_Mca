"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Clock,
  PlayCircle,
  StopCircle,
  User,
  BarChart3,
  Gauge,
  DollarSign,
  Timer,
  TrendingUp,
  RefreshCw,
  Search,
  UserCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Column } from "@/components/ui/data-table";

interface ServicioItem {
  id: string;
  descripcion: string;
  duracionEstimada: number | null;
  horaInicioReal: string | null;
  horaFinReal: string | null;
  duracionReal: number | null;
  tecnicoId: string | null;
  ordenTrabajoId: string;
}

interface TechnicianEfficiency {
  tecnicoId: string;
  serviciosCompletados: number;
  duracionEstimadaTotal: number;
  duracionRealTotal: number;
  eficienciaPromedio: number;
}

interface BayProfitability {
  bayNumber: number;
  ordenesCompletadas: number;
  ingresoTotal: number;
  horasActivas: number;
  ingresoPorHora: number;
}

export default function FlatRatePage() {
  const { toast: t, ToastContainer } = useToast();
  const [activeTab, setActiveTab] = React.useState<"clock" | "technician" | "bay">("clock");
  const [ordenId, setOrdenId] = React.useState("");
  const [tecnicoId, setTecnicoId] = React.useState("");
  const [selectedTech, setSelectedTech] = React.useState("");
  const [selectedBay, setSelectedBay] = React.useState("1");
  const [clockInDialog, setClockInDialog] = React.useState<{ servicioId: string } | null>(null);
  const [clockInTecnicoId, setClockInTecnicoId] = React.useState("");

  const { data: servicios = [], isLoading: loadingServicios, refetch: refetchServicios } = useQuery({
    queryKey: ["orden-servicios", ordenId],
    queryFn: () => api.request<ServicioItem[]>(`/workshop/ordenes/${ordenId}/servicios`),
    enabled: ordenId.length > 0,
  });

  const clockInMut = useMutation({
    mutationFn: (params: { servicioId: string; tecnicoId: string }) =>
      api.request(`/workshop/servicios/${params.servicioId}/clock-in`, {
        method: "POST",
        body: JSON.stringify({ tecnicoId: params.tecnicoId }),
      }),
    onSuccess: () => {
      t.success("Clock-in registrado");
      refetchServicios();
    },
    onError: (err: Error) => t.error(err.message),
  });

  const clockOutMut = useMutation({
    mutationFn: (servicioId: string) =>
      api.request(`/workshop/servicios/${servicioId}/clock-out`, { method: "POST" }),
    onSuccess: () => {
      t.success("Clock-out registrado");
      refetchServicios();
    },
    onError: (err: Error) => t.error(err.message),
  });

  const { data: techEfficiency, isLoading: loadingTech } = useQuery({
    queryKey: ["technician-efficiency", selectedTech],
    queryFn: () => api.request<TechnicianEfficiency>(`/workshop/flat-rate/technician/${selectedTech}`),
    enabled: selectedTech.length > 0,
  });

  const { data: bayProfitability, isLoading: loadingBay } = useQuery({
    queryKey: ["bay-profitability", selectedBay],
    queryFn: () => api.request<BayProfitability>(`/workshop/flat-rate/bay/${selectedBay}`),
    enabled: selectedBay.length > 0,
  });

  const handleClockIn = (servicioId: string) => {
    if (tecnicoId) {
      clockInMut.mutate({ servicioId, tecnicoId });
    } else {
      setClockInDialog({ servicioId });
      setClockInTecnicoId("");
    }
  };

  const columns: Column<ServicioItem>[] = [
    {
      header: "Servicio",
      accessor: "descripcion",
      cell: (_, row) => (
        <div>
          <p className="font-medium">{row.descripcion}</p>
          <p className="text-xs text-muted-foreground">OT: {row.ordenTrabajoId.substring(0, 8)}</p>
        </div>
      ),
    },
    {
      header: "Estimado",
      accessor: "duracionEstimada",
      className: "text-center",
      cell: (_, row) => (
        <span className="font-mono text-sm">{row.duracionEstimada ? `${row.duracionEstimada} min` : "—"}</span>
      ),
    },
    {
      header: "Estado",
      accessor: (row: ServicioItem) => (row.horaFinReal ? "Completado" : row.horaInicioReal ? "En Progreso" : "Pendiente"),
      cell: (_, row) => {
        if (row.horaFinReal) return <Badge variant="success">Completado</Badge>;
        if (row.horaInicioReal) return <Badge variant="default">En Progreso</Badge>;
        return <Badge variant="secondary">Pendiente</Badge>;
      },
    },
    {
      header: "Acción",
      accessor: "id",
      className: "text-right",
      cell: (_, row) => (
        <div className="flex justify-end gap-2">
          {!row.horaInicioReal && (            <Button size="sm" variant="default" className="gap-1" onClick={() => handleClockIn(row.id)} disabled={clockInMut.isPending}>
              <PlayCircle className="h-3.5 w-3.5" />
              {clockInMut.isPending ? "Registrando..." : "Clock In"}
            </Button>
          )}
          {row.horaInicioReal && !row.horaFinReal && (
            <Button size="sm" variant="outline" className="gap-1 border-amber-500/50 text-amber-500" onClick={() => clockOutMut.mutate(row.id)} disabled={clockOutMut.isPending}>
              <StopCircle className="h-3.5 w-3.5" />
              Clock Out
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Timer className="h-6 w-6 text-blue-500" />
          Flat Rate — Tiempos por Servicio
        </h1>
        <p className="text-sm text-muted-foreground">Registro de tiempos reales vs estimados por técnico y bahía</p>
      </div>

      <div className="flex gap-2 border-b pb-2" role="tablist">
        {[
          { key: "clock", label: "Clock In/Out", icon: Clock },
          { key: "technician", label: "Eficiencia Técnico", icon: User },
          { key: "bay", label: "Rentabilidad Bahía", icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all",
              activeTab === tab.key ? "bg-background text-foreground border-b-2 border-blue-500" : "text-muted-foreground hover:text-foreground",
            )}
            role="tab"
            aria-selected={activeTab === tab.key}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "clock" && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 max-w-sm">
              <label className="text-xs text-muted-foreground mb-1 block">ID de Orden de Trabajo</label>
              <Input placeholder="UUID de la OT..." value={ordenId} onChange={(e) => setOrdenId(e.target.value)} />
            </div>
            <div className="flex-1 max-w-sm">
              <label className="text-xs text-muted-foreground mb-1 block">ID del Técnico (opcional)</label>
              <Input placeholder="UUID del técnico..." value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetchServicios()} title="Refrescar">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {loadingServicios ? (
            <div className="text-center py-8 text-muted-foreground">Cargando servicios...</div>
          ) : servicios.length > 0 ? (
            <DataTable columns={columns} data={servicios} rowKey="id" paginate pageSize={10} />
          ) : ordenId ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No se encontraron servicios para esta OT</p>
              <p className="text-xs mt-1">Verificá que el ID sea correcto</p>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <PlayCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Ingresá un ID de Orden de Trabajo para comenzar</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "technician" && (
        <div className="space-y-4">
          <div className="flex-1 max-w-sm">
            <label className="text-xs text-muted-foreground mb-1 block">ID del Técnico</label>
            <Input placeholder="UUID del técnico..." value={selectedTech} onChange={(e) => setSelectedTech(e.target.value)} />
          </div>

          {loadingTech ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : techEfficiency ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-blue-500" /> Eficiencia Promedio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={cn("text-3xl font-bold", techEfficiency.eficienciaPromedio >= 100 ? "text-emerald-500" : "text-amber-500")}>
                    {techEfficiency.eficienciaPromedio}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {techEfficiency.eficienciaPromedio >= 100 ? "Supera el tiempo estimado" : "Por debajo del tiempo estimado"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Timer className="h-4 w-4 text-blue-500" /> Servicios</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{techEfficiency.serviciosCompletados}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-500" /> Tiempo Total</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-lg font-bold">{Math.round(techEfficiency.duracionRealTotal / 60)}h</p>
                  <p className="text-xs text-muted-foreground">Estimado: {Math.round(techEfficiency.duracionEstimadaTotal / 60)}h</p>
                </CardContent>
              </Card>
            </div>
          ) : selectedTech ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hay datos para este técnico</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Ingresá un ID de técnico para ver su eficiencia</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "bay" && (
        <div className="space-y-4">
          <div className="flex-1 max-w-sm">
            <label className="text-xs text-muted-foreground mb-1 block">Número de Bahía</label>
            <Input type="number" min={1} max={10} placeholder="1-10" value={selectedBay} onChange={(e) => setSelectedBay(e.target.value)} />
          </div>

          {loadingBay ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : bayProfitability ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><BarChart3 className="h-4 w-4 text-blue-500" /> Bahía #{bayProfitability.bayNumber}</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{bayProfitability.ordenesCompletadas}</p><p className="text-xs text-muted-foreground mt-1">Órdenes completadas</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500" /> Ingreso Total</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-emerald-500">Gs. {Number(bayProfitability.ingresoTotal).toLocaleString("es-PY")}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Gauge className="h-4 w-4 text-blue-500" /> Ingreso / Hora</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">Gs. {bayProfitability.ingresoPorHora.toLocaleString("es-PY") || "—"}</p></CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Ingresá un número de bahía para ver su rentabilidad</p>
            </div>
          )}
        </div>
      )}

      {/* Clock-in Dialog (when no técnico ID pre-set) */}
      <Dialog open={!!clockInDialog} onOpenChange={(open) => !open && setClockInDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-500" />
              Clock In — ID del Técnico
            </DialogTitle>
            <DialogDescription>
              Ingresá el UUID del técnico que va a realizar este servicio
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="UUID del técnico..."
              value={clockInTecnicoId}
              onChange={(e) => setClockInTecnicoId(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockInDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (clockInDialog && clockInTecnicoId) {
                  clockInMut.mutate({ servicioId: clockInDialog.servicioId, tecnicoId: clockInTecnicoId });
                  setClockInDialog(null);
                }
              }}
              disabled={!clockInTecnicoId || clockInMut.isPending}
            >
              {clockInMut.isPending ? "Registrando..." : "Iniciar Clock In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ToastContainer}
    </div>
  );
}
