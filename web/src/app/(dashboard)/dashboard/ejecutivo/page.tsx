"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  DollarSign,
  Wrench,
  Percent,
  BarChart3,
  Award,
  Star,
  Calendar,
  Radio,
  Wifi,
  WifiOff,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { useFinancialWebSocket } from "@/hooks/use-financial-ws";
import type { AnalyticsKpis, AnalyticsTrend, TopMechanic, AnalyticsDistribution } from "@/lib/api";

function formatGuarani(amount: number): string {
  if (amount >= 1_000_000) return `₲ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₲ ${(amount / 1_000).toFixed(0)}K`;
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

// ─── KPI Card ─────────────────────────────────

function KpiCard({ title, value, subtitle, icon: Icon, color, bgColor, trend }: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", bgColor)}>
          <Icon className={cn("h-4 w-4", color)} aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <p className="text-2xl font-bold">{value}</p>
          {trend && (
            <span className={cn("text-xs font-medium flex items-center gap-0.5", trend.positive ? "text-emerald-500" : "text-red-500")}>
              <TrendingUp className={cn("h-3 w-3", !trend.positive && "rotate-180")} />
              {trend.value}%
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

// ─── Bar Chart ─────────────────────────────────

function SimpleBarChart({ data, valueLabel, barColor = "from-blue-500 to-blue-400", height = 32 }: {
  data: { label: string; value: number }[];
  valueLabel?: string;
  barColor?: string;
  height?: number;
}) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end justify-between gap-1.5" style={{ height: `${height * 4}px` }}>
      {data.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{item.value.toLocaleString()}</span>
          <div
            className="w-full rounded-md bg-gradient-to-t transition-all duration-500 min-h-[3px]"
            style={{
              height: `${Math.max(3, (item.value / maxVal) * 100)}%`,
              background: `linear-gradient(to top, ${barColor.split(" ")[0].replace("from-", "")}, ${barColor.split(" ")[1]?.replace("to-", "") || barColor.split(" ")[0].replace("from-", "")})`,
            }}
          />
          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Progress Bar ──────────────────────────────

function ProgressRow({ label, value, max, color = "bg-orange-500" }: { label: string; value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-xs text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-xs font-medium tabular-nums text-right">{pct}%</span>
    </div>
  );
}

// ─── Loading ────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div><Skeleton variant="text" className="h-8 w-64" /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><Skeleton variant="card" className="h-72" /></div>
        <Skeleton variant="card" className="h-72" />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────

export default function EjecutivoPage() {
  const [realTime, setRealTime] = React.useState(false);
  const ws = useFinancialWebSocket(["kpis", "cashflow", "invoices"], realTime);

  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ["ejecutivo-kpis"],
    queryFn: () => api.getAnalyticsKpis(),
  });

  const { data: revenueTrend, isLoading: loadingRevenue } = useQuery({
    queryKey: ["ejecutivo-revenue-trend"],
    queryFn: () => api.getAnalyticsTrends("revenue"),
  });

  const { data: ordersTrend, isLoading: loadingOrders } = useQuery({
    queryKey: ["ejecutivo-orders-trend"],
    queryFn: () => api.getAnalyticsTrends("ots"),
  });

  const { data: topMechanics, isLoading: loadingMechs } = useQuery({
    queryKey: ["ejecutivo-top-mechanics"],
    queryFn: () => api.getTopMechanics(),
  });

  const { data: distribution, isLoading: loadingDist } = useQuery({
    queryKey: ["ejecutivo-distribution"],
    queryFn: () => api.getAnalyticsDistribution(),
  });

  // Scheduling stats for occupancy
  const { data: schedulingStats } = useQuery({
    queryKey: ["ejecutivo-scheduling-stats"],
    queryFn: () => api.request<{ today: number; todayConfirmed: number; thisWeek: number; totalActive: number }>("/scheduling/stats"),
  });

  const loading = loadingKpis || loadingRevenue || loadingOrders || loadingMechs || loadingDist;

  if (loading) return <DashboardSkeleton />;

  const revenueChartData: { label: string; value: number }[] = Array.isArray(revenueTrend)
    ? revenueTrend.map((t: AnalyticsTrend) => ({ label: t.date?.slice(5) || "", value: t.value }))
    : [];

  const ordersChartData: { label: string; value: number }[] = Array.isArray(ordersTrend)
    ? ordersTrend.map((t: AnalyticsTrend) => ({ label: t.date?.slice(5) || "", value: t.value }))
    : [];

  const distData: { label: string; value: number }[] = Array.isArray(distribution)
    ? distribution.map((d: AnalyticsDistribution) => ({ label: d.status, value: d.count }))
    : [];

  // Use WebSocket data when real-time is enabled and available
  const effectiveKpis = realTime && ws.data.kpis
    ? {
        revenue: { current: ws.data.kpis.revenue, previous: 0, change: 0 },
        orderCount: { current: ws.data.kpis.orderCount, previous: 0, change: 0 },
        avgOrderValue: { current: ws.data.kpis.avgOrderValue, previous: 0, change: 0 },
        completionRate: { current: ws.data.kpis.completionRate, previous: 0, change: 0 },
      }
    : kpis;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            Dashboard Ejecutivo
          </h1>
          <p className="text-sm text-muted-foreground">
            KPIs estratégicos del taller — {new Date().toLocaleDateString("es-PY", { month: "long", year: "numeric" })}
          </p>
        </div>
        <Button
          variant={realTime ? "default" : "outline"}
          size="sm"
          onClick={() => setRealTime(!realTime)}
          className="gap-2 shrink-0"
        >
          {realTime ? (
            <>
              {ws.connected ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-red-400" />}
              <Radio className="h-3 w-3 animate-pulse" />
              Real-time
            </>
          ) : (
            <>
              <Radio className="h-4 w-4" />
              Activar Real-time
            </>
          )}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Ingresos"
          value={formatGuarani(effectiveKpis?.revenue?.current || 0)}
          subtitle="Ingresos del período actual"
          icon={DollarSign}
          color="text-emerald-500"
          bgColor="bg-emerald-500/10"
          trend={effectiveKpis?.revenue ? { value: Math.abs(effectiveKpis.revenue.change), positive: effectiveKpis.revenue.change >= 0 } : undefined}
        />
        <KpiCard
          title="Órdenes de Trabajo"
          value={String(effectiveKpis?.orderCount?.current || 0)}
          subtitle={`${effectiveKpis?.orderCount?.previous || 0} período anterior`}
          icon={Wrench}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
          trend={effectiveKpis?.orderCount ? { value: Math.abs(effectiveKpis.orderCount.change), positive: effectiveKpis.orderCount.change >= 0 } : undefined}
        />
        <KpiCard
          title="Ticket Promedio"
          value={formatGuarani(effectiveKpis?.avgOrderValue?.current || 0)}
          subtitle="Valor promedio por OT"
          icon={TrendingUp}
          color="text-violet-500"
          bgColor="bg-violet-500/10"
          trend={effectiveKpis?.avgOrderValue ? { value: Math.abs(effectiveKpis.avgOrderValue.change), positive: effectiveKpis.avgOrderValue.change >= 0 } : undefined}
        />
        <KpiCard
          title="Tasa Finalización"
          value={`${effectiveKpis?.completionRate?.current || 0}%`}
          subtitle="Órdenes completadas vs total"
          icon={Percent}
          color="text-orange-500"
          bgColor="bg-orange-500/10"
          trend={effectiveKpis?.completionRate ? { value: Math.abs(effectiveKpis.completionRate.change), positive: effectiveKpis.completionRate.change >= 0 } : undefined}
        />
      </div>

      {/* Trends + Occupancy */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Tendencia de Ingresos
            </CardTitle>
            <CardDescription>Evolución de ingresos en el período</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueChartData.length > 0 ? (
              <SimpleBarChart data={revenueChartData} barColor="from-emerald-500 to-emerald-400" height={40} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Datos de tendencia disponibles cuando el backend provea métricas históricas</p>
            )}
          </CardContent>
        </Card>

        {/* Workshop Occupancy */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Ocupación del Taller
            </CardTitle>
            <CardDescription>Turnos y carga laboral</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedulingStats ? (
              <>
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <div>
                    <p className="text-xs text-muted-foreground">Turnos Hoy</p>
                    <p className="text-xl font-bold">{schedulingStats.today}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Confirmados</p>
                    <p className="text-lg font-bold text-emerald-500">{schedulingStats.todayConfirmed}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">Esta Semana</p>
                    <p className="text-xl font-bold">{schedulingStats.thisWeek}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">Activos</p>
                    <p className="text-xl font-bold">{schedulingStats.totalActive}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No hay datos de ocupación disponibles</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders Trend + Top Mechanics */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Orders Trend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-500" />
              Órdenes por Período
            </CardTitle>
            <CardDescription>Cantidad de órdenes de trabajo</CardDescription>
          </CardHeader>
          <CardContent>
            {ordersChartData.length > 0 ? (
              <SimpleBarChart data={ordersChartData} barColor="from-blue-500 to-blue-400" height={32} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Datos disponibles próximamente</p>
            )}
          </CardContent>
        </Card>

        {/* Top Mechanics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              Top Mecánicos
            </CardTitle>
            <CardDescription>Por cantidad de órdenes completadas</CardDescription>
          </CardHeader>
          <CardContent>
            {Array.isArray(topMechanics) && topMechanics.length > 0 ? (
              <div className="space-y-3">
                {topMechanics.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      i === 0 ? "bg-amber-500/20 text-amber-500" :
                      i === 1 ? "bg-gray-400/20 text-gray-400" :
                      i === 2 ? "bg-orange-600/20 text-orange-600" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.orderCount} órdenes</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      <span className="text-sm font-medium">{m.avgRating?.toFixed(1) || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-2">
                <Award className="h-8 w-8 opacity-30" />
                <p>No hay datos de mecánicos disponibles</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders by Status Distribution */}
      {distData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon />
              Distribución por Estado
            </CardTitle>
            <CardDescription>Órdenes de trabajo agrupadas por estado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {distData.map((item) => (
                <ProgressRow key={item.label} label={item.label} value={item.value} max={Math.max(...distData.map(d => d.value), 1)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PieChartIcon() {
  return (
    <svg className="h-4 w-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  );
}
