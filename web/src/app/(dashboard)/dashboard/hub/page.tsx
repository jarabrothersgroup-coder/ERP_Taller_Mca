"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Zap } from "lucide-react";
import { HubSidebar } from "@/components/hub/hub-sidebar";
import { OTDetailPanel } from "@/components/hub/ot-detail-panel";
import { QuickCreateModal } from "@/components/hub/quick-create-modal";
import type { KanbanOT } from "@/components/hub/types";

export default function OperationsHubPage() {
  const [selectedOT, setSelectedOT] = React.useState<KanbanOT | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [mobilePanel, setMobilePanel] = React.useState<"list" | "detail">("list");

  const { data: ordenes = [], isLoading, refetch } = useQuery<KanbanOT[]>({
    queryKey: ["hub-active-orders"],
    queryFn: async () => {
      const [ots, allVehicles, allClients] = await Promise.all([
        api.listWorkOrders({ limit: 100 }),
        api.request<any[]>("/workshop/vehiculos?limit=200").catch(() => []),
        api.request<any[]>("/workshop/clientes?limit=200").catch(() => []),
      ]);
      const vehicleMap = new Map(allVehicles.map((v: any) => [v.id, v]));
      const clientMap = new Map(allClients.map((c: any) => [c.id, c]));
      return ots.map((ot: any) => {
        const v = vehicleMap.get(ot.vehicleId);
        const c = clientMap.get(ot.clientId);
        return { ...ot, vehicleName: v ? `${v.brand || ""} ${v.model || ""}`.trim() : "", plate: v?.plate || "", clientName: c?.name || "", clientPhone: c?.phone || "", clientEmail: c?.email || "" } as KanbanOT;
      });
    },
    refetchInterval: 30_000,
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

      <div className="flex-1 flex gap-4 min-h-0">
        <div className={cn("flex flex-col w-full lg:w-80 xl:w-96 shrink-0 overflow-y-auto", mobilePanel === "detail" && "hidden lg:flex")}>
          <Card className="flex-1 border-0 shadow-sm bg-card">
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Órdenes Activas</span>
                <Badge variant="outline" className="text-[10px]">{stats.total} total</Badge>
              </CardTitle>
              <CardDescription className="text-[10px]">Seleccioná una OT para ver sus detalles y acciones</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {isLoading ? (
                <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}</div>
              ) : (
                <HubSidebar ordenes={ordenes} selectedId={selectedOT?.id || null} onSelect={handleSelectOT} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className={cn("flex-1 min-w-0", mobilePanel === "list" && "hidden lg:block")}>
          <Card className="h-full border-0 shadow-sm bg-card">
            <CardContent className="p-4 h-full">
              <OTDetailPanel orden={selectedOT} onClose={() => { setSelectedOT(null); setMobilePanel("list"); }} onRefresh={() => refetch()} />
            </CardContent>
          </Card>
        </div>
      </div>

      <QuickCreateModal open={createOpen} onOpenChange={setCreateOpen} onCreated={() => refetch()} />
    </div>
  );
}
