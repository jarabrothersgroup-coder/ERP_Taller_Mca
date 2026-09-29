"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tecnico } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/error-state";
import { FilterSelect } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LayoutDashboard, Zap, Filter } from "lucide-react";
import { HubSidebar } from "@/components/hub/hub-sidebar";
import { OTDetailPanel } from "@/components/hub/ot-detail-panel";
import { QuickCreateModal } from "@/components/hub/quick-create-modal";
import { TERMINAL_STATUS, toBackendStatus, type KanbanOT } from "@/components/hub/types";
import { useHubBoardSse } from "@/hooks/use-hub-board-sse";

export default function OperationsHubPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedOT, setSelectedOT] = React.useState<KanbanOT | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [mobilePanel, setMobilePanel] = React.useState<"list" | "detail">("list");
  const [tecnicoFilter, setTecnicoFilter] = React.useState<string>("");

  // Real-time board invalidation (SSE pings → refetch; no fixed polling)
  useHubBoardSse(true);

  // Aggregated board: open OTs (pre-joined) + technicians in ONE request —
  // replaces the 3-request fan-out + client-side join of Sprint 96.
  // refetchInterval kept as a slow fallback in case SSE is blocked by a proxy.
  const { data: board, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["hub-board"],
    queryFn: () => api.getHubBoard({ excludeStatus: TERMINAL_STATUS }),
    refetchInterval: 120_000,
    // v5: numeric Infinity is not a valid staleTime — use a large finite value
    staleTime: 30_000,
  });

  const allOrdenes = React.useMemo(
    () =>
      ((board?.ordenes ?? []) as KanbanOT[]).map((o) => ({
        ...o,
        vehicleName: o.vehiculo ?? "",
        clientName: o.cliente ?? "",
      })),
    [board],
  );
  const tecnicos = board?.tecnicos ?? [];

  // Filter by assigned technician (assignedTo now comes from the API —
  // Sprint 101; OTs without an assignee only show under "Todos")
  const ordenes = React.useMemo(() => {
    if (!tecnicoFilter) return allOrdenes;
    return allOrdenes.filter(ot => ot.assignedTo === tecnicoFilter);
  }, [allOrdenes, tecnicoFilter]);

  // Status change mutation (drag & drop)
  const changeStatus = useMutation({
    mutationFn: ({ ordenId, newStatus }: { ordenId: string; newStatus: string }) =>
      api.updateWorkOrderStatus(ordenId, newStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hub-board"] });
      qc.invalidateQueries({ queryKey: ["hub-orden-detail"] });
      toast.success("Estado de OT actualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const stats = React.useMemo(() => ({
    total: ordenes.length,
    enProceso: ordenes.filter(o => o.status === "En_Proceso").length,
    listos: ordenes.filter(o => o.status === "Listo").length,
    presupuestados: ordenes.filter(o => o.status === "Presupuestado").length,
  }), [ordenes]);

  const handleSelectOT = (ot: KanbanOT) => {
    setSelectedOT(ot);
    setMobilePanel("detail");
    // T-52: sin auto-asignación — seleccionar una OT nunca asigna técnicos.
    // La asignación es una acción explícita en el panel de detalle.
  };

  const handleStatusChange = (ordenId: string, newStatus: string) => {
    changeStatus.mutate({ ordenId, newStatus });
  };

  const handleRetirar = (ordenId: string) => {
    changeStatus.mutate({ ordenId, newStatus: toBackendStatus(TERMINAL_STATUS) });
  };

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-orange-500" />
            Hub de Operaciones
          </h1>
          <p className="text-xs text-muted-foreground">
            Flujo de trabajo centralizado · {new Date().toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <span className="px-2 py-1 rounded-full bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 border border-yellow-200 dark:border-yellow-800/30">📋 {stats.presupuestados} presup.</span>
            <span className="px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 border border-indigo-200 dark:border-indigo-800/30">🔧 {stats.enProceso} en proceso</span>
            <span className="px-2 py-1 rounded-full bg-green-50 dark:bg-green-950/30 text-green-600 border border-green-200 dark:border-green-800/30">✅ {stats.listos} listos</span>
          </div>
          <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-all" onClick={() => setCreateOpen(true)}>
            <Zap className="h-4 w-4" /><span className="hidden sm:inline">Nueva OT Rápida</span><span className="sm:hidden">Nueva OT</span>
          </Button>
        </div>
      </div>

      {/* Technician filter bar (T-54: FilterSelect unificado) */}
      <div className="flex items-center gap-2 shrink-0">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <FilterSelect
          label="Técnico"
          value={tecnicoFilter}
          onChange={setTecnicoFilter}
          options={tecnicos.map((t: Tecnico) => ({ value: t.id, label: t.nombre }))}
          allLabel="Todos los técnicos"
          emptyText="Sin técnicos activos"
        />
        {tecnicoFilter && (
          <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={() => setTecnicoFilter("")}>
            Limpiar
          </Button>
        )}
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {ordenes.length} de {allOrdenes.length} órdenes
        </span>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className={cn("flex flex-col w-full lg:w-80 xl:w-96 shrink-0 overflow-y-auto", mobilePanel === "detail" && "hidden lg:flex")}>
          <Card className="flex-1 border-0 shadow-sm bg-card">
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Órdenes Activas</span>
                <Badge variant="outline" className="text-[10px]">{stats.total} total</Badge>
              </CardTitle>
              <CardDescription className="text-[10px]">Arrastrá OTs entre estados o seleccioná para ver detalles</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {isLoading ? (
                <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}</div>
              ) : isError ? (
                <ErrorState
                  compact
                  title="No se pudieron cargar las OTs"
                  message={error instanceof Error ? error.message : undefined}
                  onRetry={() => refetch()}
                />
              ) : ordenes.length === 0 ? (
                <EmptyState
                  compact
                  title={allOrdenes.length === 0 ? "Sin órdenes abiertas" : "Sin órdenes para este técnico"}
                  message={
                    allOrdenes.length === 0
                      ? "Creá una OT rápida para empezar a trabajar."
                      : `Ninguna OT abierta está asignada a ${tecnicos.find(t => t.id === tecnicoFilter)?.nombre ?? "ese técnico"}.`
                  }
                  action={
                    allOrdenes.length > 0 && tecnicoFilter ? (
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={() => setTecnicoFilter("")}>
                        Limpiar filtro
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <HubSidebar
                  ordenes={ordenes}
                  selectedId={selectedOT?.id || null}
                  onSelect={handleSelectOT}
                  onStatusChange={handleStatusChange}
                  onRetirar={handleRetirar}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className={cn("flex-1 min-w-0", mobilePanel === "list" && "hidden lg:block")}>
          <Card className="h-full border-0 shadow-sm bg-card">
            <CardContent className="p-4 h-full">
              <OTDetailPanel
                orden={selectedOT}
                tecnicos={tecnicos}
                onAssigned={() => qc.invalidateQueries({ queryKey: ["hub-board"] })}
                onClose={() => { setSelectedOT(null); setMobilePanel("list"); }}
                onRefresh={() => refetch()}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <QuickCreateModal open={createOpen} onOpenChange={setCreateOpen} onCreated={() => refetch()} />
    </div>
  );
}
