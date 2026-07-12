"use client";

import * as React from "react";
import { usePresupuestos, usePresupuestoAlertas } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Plus, AlertTriangle, CheckCircle } from "lucide-react";

function formatGuarani(amount: number): string {
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

const estadoVariant: Record<string, "default" | "secondary" | "warning" | "success" | "destructive"> = {
  BORRADOR: "secondary",
  ACTIVO: "default",
  CERRADO: "success",
  RECHAZADO: "destructive",
};

export default function PresupuestosPage() {
  const { data: presupuestos = [], isLoading: presLoading } = usePresupuestos();
  const { data: alertas = [], isLoading: alertLoading } = usePresupuestoAlertas();
  const loading = presLoading || alertLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Presupuestos</h1>
          <p className="text-sm text-muted-foreground">Planificación y control por centro de costo</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Nuevo Presupuesto</Button>
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
                  <Badge variant={a.severidad === "CRITICO" ? "destructive" : "warning"}>
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
          {presupuestos.map((p) => (
            <Card key={p.id} className="hover:border-foreground/20 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{p.periodo}</CardTitle>
                  <Badge variant={estadoVariant[p.estado] ?? "secondary"}>{p.estado}</Badge>
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
                      className="h-full rounded-full bg-orange-500 transition-all"
                      style={{ width: `${Math.min((Number(p.montoReal) / Number(p.montoPresupuestado)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
