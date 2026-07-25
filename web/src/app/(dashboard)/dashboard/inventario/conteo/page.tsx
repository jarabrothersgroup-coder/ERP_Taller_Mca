"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Warehouse,
  Package,
  Loader2,
  ArrowRight,
  Save,
  X,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CycleCount {
  id: string;
  almacenId: string;
  estado: "ABIERTO" | "EN_PROGRESO" | "COMPLETADO" | "AJUSTADO";
  observaciones: string | null;
  tenantSlug: string;
  fechaInicio: string;
  fechaFin: string | null;
  createdAt: string;
  items?: CycleCountItem[];
}

interface CycleCountItem {
  id: string;
  repuestoId: string;
  stockSistema: number;
  stockReal: number;
  diferencia: number;
  ajustado: boolean;
  observaciones: string | null;
  repuesto?: { codigo: string; descripcion: string };
}

interface Stats {
  total: number;
  abiertos: number;
  enProgreso: number;
  completados: number;
  ajustados: number;
  totalItems: number;
  pendingAdjustments: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ABIERTO: { label: "Abierto", color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950" },
  EN_PROGRESO: { label: "En Progreso", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950" },
  COMPLETADO: { label: "Completado", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950" },
  AJUSTADO: { label: "Ajustado", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950" },
};

export default function CycleCountPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [almacenId, setAlmacenId] = React.useState("");
  const [observaciones, setObservaciones] = React.useState("");
  const [countingValue, setCountingValue] = React.useState<Record<string, number>>({});

  // Fetch data
  const { data: counts = [], isLoading } = useQuery<CycleCount[]>({
    queryKey: ["cycle-counts"],
    queryFn: () => api.request("/inventory/cycle-counts"),
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["cycle-counts-stats"],
    queryFn: () => api.request("/inventory/cycle-counts/stats"),
  });

  const { data: almacenes = [] } = useQuery<any[]>({
    queryKey: ["almacenes"],
    queryFn: () => api.request("/inventory/almacenes"),
  });

  const { data: detail } = useQuery<CycleCount>({
    queryKey: ["cycle-count-detail", detailId],
    queryFn: () => api.request(`/inventory/cycle-counts/${detailId}`),
    enabled: !!detailId,
  });

  // Mutations
  const createMut = useMutation({
    mutationFn: () =>
      api.request("/inventory/cycle-counts", {
        method: "POST",
        body: JSON.stringify({ almacenId, observaciones: observaciones || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycle-counts"] });
      qc.invalidateQueries({ queryKey: ["cycle-counts-stats"] });
      setCreateOpen(false);
      setAlmacenId("");
      setObservaciones("");
    },
  });

  const startMut = useMutation({
    mutationFn: (id: string) =>
      api.request(`/inventory/cycle-counts/${id}/start`, {
        method: "POST",
        body: JSON.stringify({ autoPopulate: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycle-counts"] });
      qc.invalidateQueries({ queryKey: ["cycle-count-detail"] });
    },
  });

  const recordMut = useMutation({
    mutationFn: ({ countId, itemId, stockReal }: { countId: string; itemId: string; stockReal: number }) =>
      api.request(`/inventory/cycle-counts/${countId}/items`, {
        method: "POST",
        body: JSON.stringify({ itemId, stockReal }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycle-count-detail"] });
      qc.invalidateQueries({ queryKey: ["cycle-counts"] });
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) =>
      api.request(`/inventory/cycle-counts/${id}/complete`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycle-counts"] });
      qc.invalidateQueries({ queryKey: ["cycle-count-detail"] });
      qc.invalidateQueries({ queryKey: ["cycle-counts-stats"] });
    },
  });

  const adjustMut = useMutation({
    mutationFn: (id: string) =>
      api.request(`/inventory/cycle-counts/${id}/adjust`, {
        method: "POST",
        body: JSON.stringify({ generateAsiento: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycle-counts"] });
      qc.invalidateQueries({ queryKey: ["cycle-count-detail"] });
      qc.invalidateQueries({ queryKey: ["cycle-counts-stats"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api.request(`/inventory/cycle-counts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycle-counts"] });
      qc.invalidateQueries({ queryKey: ["cycle-counts-stats"] });
    },
  });

  const pendingAdjustments = (detail?.items || []).filter(
    (i) => !i.ajustado && i.diferencia !== 0,
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-blue-500" />
            Conteo Cíclico
          </h1>
          <p className="text-sm text-muted-foreground">
            Toma de inventario físico con ajuste automático de stock
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Nuevo Conteo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-5">
        {[
          { label: "Totales", value: stats?.total ?? 0, icon: ClipboardCheck, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Abiertos", value: stats?.abiertos ?? 0, icon: Plus, color: "text-yellow-500", bg: "bg-yellow-500/10" },
          { label: "En Progreso", value: stats?.enProgreso ?? 0, icon: Play, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Completados", value: stats?.completados ?? 0, icon: CheckCircle2, color: "text-purple-500", bg: "bg-purple-500/10" },
          { label: "Ajustados", value: stats?.ajustados ?? 0, icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", s.bg)}>
                <s.icon className={cn("h-4 w-4", s.color)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending adjustments alert */}
      {(stats?.pendingAdjustments ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Hay <strong>{stats!.pendingAdjustments}</strong> ítem
              {stats!.pendingAdjustments > 1 ? "s" : ""} con diferencias pendientes de ajustar.
              Complete el ajuste para actualizar el stock real.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Main content: List or Detail */}
      {detailId && detail ? (
        /* ── Detail View ── */
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setDetailId(null)} className="gap-1">
            <ArrowRight className="h-4 w-4 rotate-180" /> Volver
          </Button>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-blue-500" />
                  Conteo #{detail.id.slice(0, 8)}
                  <Badge className={cn(STATUS_CONFIG[detail.estado]?.bg, STATUS_CONFIG[detail.estado]?.color)}>
                    {STATUS_CONFIG[detail.estado]?.label}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {detail.estado === "ABIERTO" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => startMut.mutate(detail.id)} loading={startMut.isPending}>
                        <Play className="h-3.5 w-3.5 mr-1" /> Iniciar Conteo
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-500" onClick={() => {
                        if (confirm("¿Eliminar este conteo?")) deleteMut.mutate(detail.id);
                      }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {detail.estado === "EN_PROGRESO" && (
                    <Button size="sm" onClick={() => completeMut.mutate(detail.id)} loading={completeMut.isPending}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Completar Conteo
                    </Button>
                  )}
                  {detail.estado === "COMPLETADO" && pendingAdjustments.length > 0 && (
                    <Button size="sm" onClick={() => {
                      if (confirm(`¿Aplicar ajustes a ${pendingAdjustments.length} ítem(s)? Esto modificará el stock real.`)) {
                        adjustMut.mutate(detail.id);
                      }
                    }} loading={adjustMut.isPending}>
                      <Save className="h-3.5 w-3.5 mr-1" /> Aplicar Ajustes ({pendingAdjustments.length})
                    </Button>
                  )}
                </div>
              </CardTitle>
              <CardDescription>
                Almacén ID: {detail.almacenId.slice(0, 8)} · Iniciado: {new Date(detail.fechaInicio).toLocaleDateString("es-PY")}
                {detail.fechaFin && ` · Finalizado: ${new Date(detail.fechaFin).toLocaleDateString("es-PY")}`}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Items table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Items ({detail.items?.length || 0})</CardTitle>
              {detail.estado === "EN_PROGRESO" && (
                <CardDescription>Registre el stock real para cada ítem</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {detail.items?.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg border text-sm",
                      item.diferencia !== 0 && !item.ajustado && "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20",
                      item.ajustado && "border-green-200 bg-green-50/50 dark:bg-green-950/20",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.repuesto?.descripcion || item.repuestoId.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">Cód: {item.repuesto?.codigo || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Sistema: <strong>{item.stockSistema}</strong></span>
                      {detail.estado === "EN_PROGRESO" ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            className="w-16 h-7 text-xs"
                            value={countingValue[item.id] ?? item.stockReal}
                            onChange={(e) => setCountingValue((v) => ({ ...v, [item.id]: Number(e.target.value) }))}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            disabled={
                              (countingValue[item.id] ?? item.stockReal) === item.stockReal ||
                              recordMut.isPending
                            }
                            onClick={() =>
                              recordMut.mutate({
                                countId: detail.id,
                                itemId: item.id,
                                stockReal: countingValue[item.id] ?? item.stockReal,
                              })
                            }
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className={item.diferencia !== 0 ? "font-bold" : ""}>
                          Real: <strong>{item.stockReal}</strong>
                        </span>
                      )}
                      {item.diferencia !== 0 && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-mono",
                            item.diferencia > 0 ? "text-emerald-600 border-emerald-300" : "text-red-600 border-red-300",
                          )}
                        >
                          {item.diferencia > 0 ? "+" : ""}{item.diferencia}
                        </Badge>
                      )}
                      {item.ajustado && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin items en este conteo</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ── List View ── */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Historial de Conteos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : counts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <ClipboardCheck className="h-8 w-8 mx-auto opacity-30 mb-2" />
                <p>No hay conteos cíclicos registrados</p>
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)} className="mt-3">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Crear Primer Conteo
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {counts.map((count) => {
                  const cfg = STATUS_CONFIG[count.estado] || { label: count.estado, color: "text-muted-foreground", bg: "bg-muted" };
                  return (
                    <button
                      key={count.id}
                      type="button"
                      onClick={() => setDetailId(count.id)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", cfg.bg)}>
                          <ClipboardCheck className={cn("h-4 w-4", cfg.color)} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">Conteo #{count.id.slice(0, 8)}</span>
                            <Badge className={cn(cfg.bg, cfg.color, "text-[10px]")}>{cfg.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Almacén: {count.almacenId.slice(0, 8)} · {new Date(count.createdAt).toLocaleDateString("es-PY")}
                          </p>
                        </div>
                      </div>
                      <ChevronRightIcon />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Conteo Cíclico</DialogTitle>
            <DialogDescription>Seleccione el almacén a inventariar</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Almacén" htmlFor="almacen" required>
              <select
                id="almacen"
                value={almacenId}
                onChange={(e) => setAlmacenId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Seleccionar almacén…</option>
                {(almacenes as any[]).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.nombre || a.id.slice(0, 8)}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Observaciones" htmlFor="obs">
              <Textarea
                id="obs"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                placeholder="Motivo del conteo, alcance, etc."
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              disabled={!almacenId || createMut.isPending}
              loading={createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              Crear Conteo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
