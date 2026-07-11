"use client";

import * as React from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  Wrench,
  DollarSign,
  Percent,
  Clock,
  Star,
  Award,
  Download,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { fetchAnalyticsDashboard, type UIMappedAnalyticsData } from "@/lib/data-service";

/* ── Types ──────────────────────────────────── */

interface TopService {
  id: string;
  nombre: string;
  cantidad: number;
  ingresos: number;
  popularidad: number; // percentage 0-100
}

interface TopClient {
  id: string;
  nombre: string;
  vehiculos: number;
  ordenes: number;
  ingresos: number;
  ultimaVisita: string;
}

interface ProductividadData {
  mes: string;
  ordenesAtendidas: number;
  horasTrabajadas: number;
  eficiencia: number; // percentage
  ingresosPorMecanico: number;
}

/* ── Mock Data ──────────────────────────────── */

function getMockAnalytics(): UIMappedAnalyticsData {
  return {
    totalIngresos: 28650000,
    totalOrdenes: 42,
    ordenesCompletadas: 28,
    productividad: 76,
    clientesAtendidos: 24,
    margenBruto: 58.3,
    ticketPromedio: 682143,
    mesActual: new Date().toLocaleDateString("es-PY", { month: "long", year: "numeric" }),
  };
}

const topServiciosMock: TopService[] = [
  { id: "svc-1", nombre: "Cambio de Aceite + Filtros", cantidad: 28, ingresos: 2380000, popularidad: 100 },
  { id: "svc-2", nombre: "Revisión de Frenos", cantidad: 22, ingresos: 3740000, popularidad: 79 },
  { id: "svc-3", nombre: "Alineación y Balanceo", cantidad: 18, ingresos: 1440000, popularidad: 64 },
  { id: "svc-4", nombre: "Diagnóstico Motor", cantidad: 15, ingresos: 2250000, popularidad: 54 },
  { id: "svc-5", nombre: "Cambio de Embrague", cantidad: 8, ingresos: 4800000, popularidad: 29 },
  { id: "svc-6", nombre: "Servicio de A/C", cantidad: 12, ingresos: 1800000, popularidad: 43 },
  { id: "svc-7", nombre: "Distribución (Correa + Bomba)", cantidad: 6, ingresos: 3900000, popularidad: 21 },
  { id: "svc-8", nombre: "Suspensión", cantidad: 9, ingresos: 2700000, popularidad: 32 },
];

const topClientesMock: TopClient[] = [
  { id: "cli-1", nombre: "Flota Gómez S.A.", vehiculos: 8, ordenes: 15, ingresos: 5200000, ultimaVisita: "05/07/2026" },
  { id: "cli-2", nombre: "Transporte Norte", vehiculos: 12, ordenes: 22, ingresos: 8900000, ultimaVisita: "03/07/2026" },
  { id: "cli-3", nombre: "María González", vehiculos: 2, ordenes: 6, ingresos: 1850000, ultimaVisita: "28/06/2026" },
  { id: "cli-4", nombre: "Taller Mecánico Ortiz", vehiculos: 5, ordenes: 11, ingresos: 3400000, ultimaVisita: "25/06/2026" },
  { id: "cli-5", nombre: "Pedro López", vehiculos: 3, ordenes: 8, ingresos: 2100000, ultimaVisita: "20/06/2026" },
  { id: "cli-6", nombre: "Taxi Express", vehiculos: 15, ordenes: 28, ingresos: 10500000, ultimaVisita: "18/06/2026" },
  { id: "cli-7", nombre: "Lucía Fernández", vehiculos: 1, ordenes: 4, ingresos: 920000, ultimaVisita: "15/06/2026" },
  { id: "cli-8", nombre: "Distribuidora del Sur", vehiculos: 6, ordenes: 9, ingresos: 4100000, ultimaVisita: "12/06/2026" },
];

const productividadMock: ProductividadData[] = [
  { mes: "Ene", ordenesAtendidas: 22, horasTrabajadas: 320, eficiencia: 68, ingresosPorMecanico: 3400000 },
  { mes: "Feb", ordenesAtendidas: 25, horasTrabajadas: 340, eficiencia: 72, ingresosPorMecanico: 3800000 },
  { mes: "Mar", ordenesAtendidas: 28, horasTrabajadas: 360, eficiencia: 75, ingresosPorMecanico: 4100000 },
  { mes: "Abr", ordenesAtendidas: 30, horasTrabajadas: 380, eficiencia: 78, ingresosPorMecanico: 4500000 },
  { mes: "May", ordenesAtendidas: 35, horasTrabajadas: 400, eficiencia: 82, ingresosPorMecanico: 5200000 },
  { mes: "Jun", ordenesAtendidas: 38, horasTrabajadas: 420, eficiencia: 85, ingresosPorMecanico: 5800000 },
  { mes: "Jul", ordenesAtendidas: 42, horasTrabajadas: 440, eficiencia: 76, ingresosPorMecanico: 6200000 },
];

/* ── KPI Cards ──────────────────────────────── */

function AnalyticsKPIs({ data }: { data: UIMappedAnalyticsData }) {
  const kpis = [
    {
      title: "Ingresos del Mes",
      value: `₲ ${(data.totalIngresos / 1_000_000).toFixed(1)}M`,
      subtitle: `${data.ticketPromedio.toLocaleString("es-PY")} / ticket`,
      icon: DollarSign,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Órdenes de Trabajo",
      value: data.totalOrdenes.toString(),
      subtitle: `${data.ordenesCompletadas} completadas (${Math.round((data.ordenesCompletadas / data.totalOrdenes) * 100)}%)`,
      icon: Wrench,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Productividad",
      value: `${data.productividad}%`,
      subtitle: `${data.clientesAtendidos} clientes atendidos`,
      icon: TrendingUp,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Margen Bruto",
      value: `${data.margenBruto}%`,
      subtitle: "Rentabilidad sobre ingresos",
      icon: Percent,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {kpi.title}
            </CardTitle>
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
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-xs font-medium tabular-nums text-right">{pct}%</span>
    </div>
  );
}

/* ── Top Services ───────────────────────────── */

const topServicesColumns: Column<TopService>[] = [
  {
    header: "#",
    accessor: (row) => String(topServiciosMock.indexOf(row) + 1),
    className: "text-xs text-muted-foreground w-8",
  },
  {
    header: "Servicio",
    accessor: "nombre",
    sortable: true,
    cell: (_, row) => (
      <div className="flex items-center gap-2">
        <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden="true" />
        <span className="font-medium">{row.nombre}</span>
      </div>
    ),
  },
  {
    header: "Cantidad",
    accessor: "cantidad",
    sortable: true,
    align: "right",
  },
  {
    header: "Ingresos",
    accessor: "ingresos",
    sortable: true,
    align: "right",
    cell: (value) => (
      <span className="tabular-nums font-medium">
        ₲ {Number(value).toLocaleString("es-PY")}
      </span>
    ),
  },
  {
    header: "Popularidad",
    accessor: "popularidad",
    sortable: true,
    cell: (value) => (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-orange-500"
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="text-xs tabular-nums w-8 text-right">{value as number}%</span>
      </div>
    ),
  },
];

/* ── Top Clients ────────────────────────────── */

const topClientsColumns: Column<TopClient>[] = [
  {
    header: "#",
    accessor: (row) => String(topClientesMock.indexOf(row) + 1),
    className: "text-xs text-muted-foreground w-8",
  },
  {
    header: "Cliente",
    accessor: "nombre",
    sortable: true,
    cell: (_, row) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">
          {row.nombre.charAt(0)}
        </div>
        <span className="font-medium">{row.nombre}</span>
      </div>
    ),
  },
  {
    header: "Vehículos",
    accessor: "vehiculos",
    sortable: true,
    align: "right",
    hideOnMobile: true,
  },
  {
    header: "Órdenes",
    accessor: "ordenes",
    sortable: true,
    align: "right",
  },
  {
    header: "Ingresos",
    accessor: "ingresos",
    sortable: true,
    align: "right",
    cell: (value) => (
      <span className="tabular-nums font-medium">
        ₲ {Number(value).toLocaleString("es-PY")}
      </span>
    ),
  },
  {
    header: "Última Visita",
    accessor: "ultimaVisita",
    className: "text-xs",
    hideOnMobile: true,
  },
];

/* ── Main Page ──────────────────────────────── */

export default function AnalyticsPage() {
  const [loading, setLoading] = React.useState(true);
  const [analytics, setAnalytics] = React.useState<UIMappedAnalyticsData | null>(null);
  const [activeTab, setActiveTab] = React.useState<"servicios" | "clientes">("servicios");

  // Fetch from API with mock fallback
  React.useEffect(() => {
    let cancelled = false;
    fetchAnalyticsDashboard(getMockAnalytics).then((data) => {
      if (!cancelled) {
        setAnalytics(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse mt-2" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="h-8 w-20 bg-muted rounded animate-pulse mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const topServices = topServiciosMock;
  const topClients = topClientesMock;
  const productividad = productividadMock;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Reportes y métricas del taller — {analytics.mesActual}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────── */}
      <AnalyticsKPIs data={analytics} />

      {/* ── Productividad Mensual ───────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" aria-hidden="true" />
            Productividad Mensual
          </CardTitle>
          <CardDescription>
            Órdenes atendidas, horas trabajadas y eficiencia del taller
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Eficiencia trend */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Eficiencia del Taller</h4>
              {productividad.map((p) => (
                <ProgressBar
                  key={p.mes}
                  label={p.mes}
                  value={p.eficiencia}
                  max={100}
                  color={
                    p.eficiencia >= 80
                      ? "bg-emerald-500"
                      : p.eficiencia >= 70
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }
                />
              ))}
            </div>

            {/* Summary stats */}
            <div className="grid gap-3">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Promedio Eficiencia</p>
                <p className="text-2xl font-bold text-emerald-500">
                  {Math.round(productividad.reduce((s, p) => s + p.eficiencia, 0) / productividad.length)}%
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Total Horas Trabajadas (7 meses)</p>
                <p className="text-2xl font-bold">
                  {productividad.reduce((s, p) => s + p.horasTrabajadas, 0).toLocaleString("es-PY")}h
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Peak de Órdenes</p>
                <p className="text-2xl font-bold">
                  {Math.max(...productividad.map((p) => p.ordenesAtendidas))} / mes
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Top Rankings ────────────────────── */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Rankings">
        {[
          { id: "servicios" as const, label: "Servicios Más Vendidos", icon: Award },
          { id: "clientes" as const, label: "Mejores Clientes", icon: Users },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="gap-1.5"
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* ── Top Services Table ──────────────── */}
      {activeTab === "servicios" && (
        <DataTable<TopService>
          columns={topServicesColumns}
          data={topServices}
          rowKey="id"
          emptyMessage="No hay servicios registrados"
          paginate
          pageSize={8}
          sortable
          className="shadow-sm"
          stickyHeader
        />
      )}

      {/* ── Top Clients Table ───────────────── */}
      {activeTab === "clientes" && (
        <DataTable<TopClient>
          columns={topClientsColumns}
          data={topClients}
          rowKey="id"
          emptyMessage="No hay clientes registrados"
          paginate
          pageSize={8}
          sortable
          className="shadow-sm"
          stickyHeader
        />
      )}
    </div>
  );
}
