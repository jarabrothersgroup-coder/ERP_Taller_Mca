"use client";

import * as React from "react";
import { useBreakEven, useWorkOrders } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Users, Calculator } from "lucide-react";

function formatGuarani(amount: number): string {
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

export default function NominaPage() {
  const { data: breakEven, isLoading: beLoading } = useBreakEven();
  const { data: orders = [], isLoading: ordersLoading } = useWorkOrders();
  const loading = beLoading || ordersLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const completedOrders = orders.filter((o) => o.status === "ready" || o.status === "completed").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nómina</h1>
          <p className="text-sm text-muted-foreground">Break-even, comisiones y gestión de personal</p>
        </div>
        <Button className="gap-2"><Calculator className="h-4 w-4" /> Calcular Nómina</Button>
      </div>

      {/* Break-Even Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Break-Even del Taller
          </CardTitle>
          <CardDescription>Umbral de activación por margen de contribución</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold">{breakEven?.percentage ?? 0}%</p>
                <p className="text-sm text-muted-foreground">
                  {formatGuarani(breakEven?.currentRevenue ?? 0)} de {formatGuarani(breakEven?.threshold ?? 0)}
                </p>
              </div>
              <Badge variant={breakEven && breakEven.percentage >= 100 ? "success" : "warning"}>
                {breakEven && breakEven.percentage >= 100 ? "Umbral alcanzado" : "En progreso"}
              </Badge>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-500 transition-all duration-700"
                style={{ width: `${Math.min(breakEven?.percentage ?? 0, 100)}%` }}
              />
            </div>
            {breakEven && breakEven.remaining > 0 && (
              <p className="text-xs text-muted-foreground">
                Faltan {formatGuarani(breakEven.remaining)} para liberar comisiones
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Órdenes Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-500" />
              <p className="text-2xl font-bold">{orders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Completadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <p className="text-2xl font-bold">{completedOrders}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ingresos Netos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatGuarani(breakEven?.currentRevenue ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Umbral</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatGuarani(breakEven?.threshold ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">
            Las comisiones se liberan automáticamente cuando la facturación neta supera gastos fijos + salarios base.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
