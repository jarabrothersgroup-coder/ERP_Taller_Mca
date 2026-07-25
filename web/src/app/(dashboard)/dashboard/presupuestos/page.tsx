"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePresupuestoAlertas } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ArrowLeft,
  Send,
  Wrench,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Helpers ──────────────────────────────────── */

function formatGuarani(amount: number): string {
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

const estadoConfig: Record<string, { label: string; variant: "default" | "secondary" | "success" | "destructive"; icon: React.ElementType }> = {
  borrador: { label: "Borrador", variant: "secondary", icon: Clock },
  aprobado: { label: "Aprobado", variant: "success", icon: CheckCircle2 },
  cerrado: { label: "Cerrado", variant: "secondary", icon: XCircle },
};

/* ── Page ─────────────────────────────────────── */

export default function PresupuestosPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: alertas = [] } = usePresupuestoAlertas();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // List presupuestos
  const { data: presupuestos = [], isLoading } = useQuery<any[]>({
    queryKey: ["presupuestos"],
    queryFn: () => api.listPresupuestos(),
  });

  // Detail presupuesto (when selected)
  const { data: detalle, isLoading: detLoading } = useQuery<{
    presupuesto: any;
    items: any[];
  }>({
    queryKey: ["presupuesto-detail", selectedId],
    queryFn: () => api.request(`/finance/presupuestos/${selectedId}`),
    enabled: !!selectedId,
  });

  // Approve mutation
  const aprobarMutation = useMutation({
    mutationFn: ({ id, accion }: { id: string; accion: "APROBAR" | "RECHAZAR" }) =>
      api.aprobarPresupuesto(id, { accion, metodoAprobacion: "PRESENCIAL" }),
    onSuccess: (result, variables) => {
      qc.invalidateQueries({ queryKey: ["presupuestos"] });
      qc.invalidateQueries({ queryKey: ["presupuesto-detail", variables.id] });
      if (variables.accion === "APROBAR" && result.ordenTrabajoId) {
        toast.success(`OT #${result.ordenTrabajoId.slice(0, 8)} creada desde presupuesto`);
      } else {
        toast.success(variables.accion === "APROBAR" ? "Presupuesto aprobado" : "Presupuesto rechazado");
      }
    },
    onError: (err: Error) => {
      toast.error(err?.message || "Error al procesar");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  // ── Detail view ─────────────────────────────
  if (selectedId) {
    const p = detalle?.presupuesto;
    const items = detalle?.items || [];
    const estado = p?.estado || "borrador";
    const cfg = estadoConfig[estado] || estadoConfig.borrador;
    const Icon = cfg.icon;

    return (
      <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Presupuestos
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Presupuesto {p?.periodo || "..."}</h1>
                <Badge variant={cfg.variant}>
                  <Icon className="h-3 w-3 mr-1" />
                  {cfg.label}
                </Badge>
              </div>
              {p?.descripcion && <p className="text-sm text-muted-foreground mt-1">{p.descripcion}</p>}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {estado === "borrador" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={aprobarMutation.isPending}
                    onClick={() => {
                      if (confirm("¿Rechazar este presupuesto?")) {
                        aprobarMutation.mutate({ id: selectedId, accion: "RECHAZAR" });
                      }
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Rechazar
                  </Button>
                  <Button
                    size="sm"
                    disabled={aprobarMutation.isPending}
                    onClick={() => aprobarMutation.mutate({ id: selectedId, accion: "APROBAR" })}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {aprobarMutation.isPending ? "Procesando..." : "Aprobar y Crear OT"}
                  </Button>
                </>
              )}
              {p?.ordenTrabajoId && (
                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/taller/${p.ordenTrabajoId}`)}>
                  <Wrench className="h-4 w-4 mr-1" /> Ver OT
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Resumen Financiero</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Presupuestado:</span>
                <span className="font-medium">{formatGuarani(Number(p?.montoPresupuestado || 0))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Real:</span>
                <span className="font-medium">{formatGuarani(Number(p?.montoReal || 0))}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min((Number(p?.montoReal || 0) / Math.max(Number(p?.montoPresupuestado || 1), 1)) * 100, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Detalles</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado:</span>
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
              </div>
              {p?.fechaAprobacion && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aprobado:</span>
                  <span>{new Date(p.fechaAprobacion).toLocaleDateString("es-PY")}</span>
                </div>
              )}
              {p?.metodoAprobacion && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Método:</span>
                  <span>{p.metodoAprobacion}</span>
                </div>
              )}
              {p?.ordenTrabajoId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">OT Generada:</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs p-0" onClick={() => router.push(`/dashboard/taller/${p.ordenTrabajoId}`)}>
                    #{p.ordenTrabajoId.slice(0, 8)} <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Items */}
        {items.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Ítems del Presupuesto</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">{item.categoria}</p>
                      <p className="text-xs text-muted-foreground">Centro: {item.centroCostoId}</p>
                    </div>
                    <span className="font-medium">{formatGuarani(Number(item.montoPresupuestado))}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {detLoading && <Skeleton className="h-32" />}
      </div>
    );
  }

  // ── List view ───────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Presupuestos</h1>
          <p className="text-sm text-muted-foreground">Planificación y control por centro de costo</p>
        </div>
      </div>

      {/* Alerts */}
      {alertas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas de Desvío
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertas.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{a.categoria}</p>
                    <p className="text-xs text-muted-foreground">Centro: {a.centroCostoId}</p>
                  </div>
                  <Badge variant={a.severidad === "CRITICO" ? "destructive" : "secondary"}>
                    {a.desvioPorcentaje > 0 ? "+" : ""}{a.desvioPorcentaje.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Presupuestos List */}
      {presupuestos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay presupuestos registrados</p>
            <p className="text-xs text-muted-foreground mt-1">Creá un presupuesto para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {presupuestos.map((p) => {
            const cfg = estadoConfig[p.estado] || estadoConfig.borrador;
            const Icon = cfg.icon;
            const pct = Number(p.montoPresupuestado) > 0
              ? (Number(p.montoReal) / Number(p.montoPresupuestado)) * 100
              : 0;

            return (
              <Card
                key={p.id}
                className="hover:border-foreground/20 transition-colors cursor-pointer"
                onClick={() => setSelectedId(p.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{p.periodo}</CardTitle>
                    <Badge variant={cfg.variant}>
                      <Icon className="h-3 w-3 mr-1" />
                      {cfg.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Presupuestado:</span>
                      <span className="font-medium">{formatGuarani(Number(p.montoPresupuestado))}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Real:</span>
                      <span className="font-medium">{formatGuarani(Number(p.montoReal))}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct > 120 ? "bg-red-500" : pct > 100 ? "bg-amber-500" : "bg-blue-500"
                        )}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    {p.ordenTrabajoId && (
                      <div className="flex items-center gap-1 text-xs text-blue-600">
                        <Wrench className="h-3 w-3" />
                        OT #{p.ordenTrabajoId.slice(0, 8)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
