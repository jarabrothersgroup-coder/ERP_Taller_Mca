"use client";

import * as React from "react";
import {
  TrendingUp, Users, Wrench, DollarSign, Percent, Clock, Award,
  Download, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/hooks/use-data";
import { topServicesColumns, topClientsColumns } from "./columns";
import type { UIMappedAnalyticsData } from "@/lib/data-service";

/* ── KPI Cards ──────────────────────────────── */

function AnalyticsKPIs({ data }: { data: UIMappedAnalyticsData }) {
  const kpis = [
    { title: "Ingresos del Mes", value: `₲ ${(data.totalIngresos / 1_000_000).toFixed(1)}M`, subtitle: `${data.ticketPromedio.toLocaleString("es-PY")} / ticket`, icon: DollarSign, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    { title: "Órdenes de Trabajo", value: data.totalOrdenes.toString(), subtitle: `${data.ordenesCompletadas} completadas (${Math.round((data.ordenesCompletadas / data.totalOrdenes) * 100)}%)`, icon: Wrench, color: "text-blue-500", bgColor: "bg-blue-500/10" },
    { title: "Productividad", value: `${data.productividad}%`, subtitle: `${data.clientesAtendidos} clientes atendidos`, icon: TrendingUp, color: "text-orange-500", bgColor: "bg-orange-500/10" },
    { title: "Margen Bruto", value: `${data.margenBruto}%`, subtitle: "Rentabilidad sobre ingresos", icon: Percent, color: "text-violet-500", bgColor: "bg-violet-500/10" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", kpi.bgColor)}>
              <kpi.icon className={cn("h-4 w-4", kpi.color)} aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Progress Bar ───────────────────────────── */

function ProgressBar({ value, max, label, color = "bg-orange-500" }: { value: number; max: number; label: string; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-xs font-medium tabular-nums text-right">{pct}%</span>
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function AnalyticsPage() {
  const { data: analytics = null, isLoading: loading } = useAnalytics();
  const [activeTab, setActiveTab] = React.useState<"servicios" | "clientes">("servicios");

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><div className="h-8 w-20 bg-muted rounded animate-pulse mt-2" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Reportes y métricas del taller — {analytics.mesActual}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Actualizar</Button>
          <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" aria-hidden="true" />Exportar</Button>
        </div>
      </div>

      <AnalyticsKPIs data={analytics} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" aria-hidden="true" />Productividad Mensual</CardTitle>
          <CardDescription>Órdenes atendidas, horas trabajadas y eficiencia del taller</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Datos de productividad disponibles cuando el backend provea métricas históricas.
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Rankings">
        {[{ id: "servicios" as const, label: "Servicios Más Vendidos", icon: Award }, { id: "clientes" as const, label: "Mejores Clientes", icon: Users }].map((tab) => (
          <Button key={tab.id} variant={activeTab === tab.id ? "secondary" : "ghost"} size="sm" onClick={() => setActiveTab(tab.id)} className="gap-1.5" role="tab" aria-selected={activeTab === tab.id}>
            <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />{tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "servicios" && <DataTable columns={topServicesColumns} data={[]} rowKey="id" emptyMessage="No hay datos de servicios disponibles" paginate pageSize={8} sortable className="shadow-sm" stickyHeader />}
      {activeTab === "clientes" && <DataTable columns={topClientsColumns} data={[]} rowKey="id" emptyMessage="No hay datos de clientes disponibles" paginate pageSize={8} sortable className="shadow-sm" stickyHeader />}
    </div>
  );
}
