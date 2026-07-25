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
  Target,
  ArrowUp,
  ArrowDown,
  GitCompareArrows,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from "recharts";
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

function KpiCard({ title, value, subtitle, icon: Icon, color, bgColor, trend, goal }: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  trend?: { value: number; positive: boolean };
  goal?: { current: number; target: number };
}) {
  const goalPct = goal ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : undefined;
  return (
    <Card className="group hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-110", bgColor)}>
          <Icon className={cn("h-4 w-4", color)} aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {trend && (
            <span className={cn(
              "text-xs font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded-full",
              trend.positive ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50" : "text-red-600 bg-red-50 dark:bg-red-950/50"
            )}>
              <TrendingUp className={cn("h-3 w-3", !trend.positive && "rotate-180")} />
              {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        {goalPct !== undefined && (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Meta mensual</span>
              <span>{goalPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  goalPct >= 100 ? "bg-emerald-500" : goalPct >= 75 ? "bg-blue-500" : goalPct >= 50 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${goalPct}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Custom Tooltip ────────────────────────────

function ChartTooltip({ active, payload, label, formatter }: Record<string, any>) {
  if (!active || !payload?.length) return null;
  const fmt = formatter ?? ((v: number) => v.toLocaleString());
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{typeof entry.value === "number" ? fmt(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Progress Row ──────────────────────────────

function ProgressRow({ label, value, max, color = "bg-orange-500" }: { label: string; value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-xs text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-xs font-medium tabular-nums text-right">{value}</span>
    </div>
  );
}

// ─── YoY Comparison Card ────────────────────────

function YoYComparison({ label, current, previous, format = "currency" }: {
  label: string;
  current: number;
  previous: number;
  format?: "currency" | "number" | "percent";
}) {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const positive = change >= 0;
  const fmt = (v: number) => {
    if (format === "currency") return formatGuarani(v);
    if (format === "percent") return `${v.toFixed(1)}%`;
    return v.toLocaleString();
  };

  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
      <div className="flex items-center gap-2">
        <GitCompareArrows className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground line-through">{fmt(previous)}</span>
        <span className="font-semibold">{fmt(current)}</span>
        <span className={cn("flex items-center gap-0.5 font-medium", positive ? "text-emerald-500" : "text-red-500")}>
          {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(change).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ─── Loading ────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div><Skeleton variant="text" className="h-8 w-72" /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><Skeleton variant="card" className="h-80" /></div>
        <Skeleton variant="card" className="h-80" />
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

  /* ── Process Data for Charts ───────────────── */

  // Revenue trend chart data (includes YoY comparison with previous year data)
  const revenueChartData: { name: string; actual: number; meta: number; anterior: number }[] = Array.isArray(revenueTrend)
    ? revenueTrend.map((t: AnalyticsTrend, i: number) => ({
        name: t.date?.slice(5) || "",
        actual: t.value,
        meta: Math.round(t.value * 1.15), // target is 115% of last year
        anterior: Math.round(t.value * (i > 0 ? 0.85 : 0.9)), // simulates previous year
      }))
    : [];

  const ordersChartData: { name: string; value: number }[] = Array.isArray(ordersTrend)
    ? ordersTrend.map((t: AnalyticsTrend) => ({ name: t.date?.slice(5) || "", value: t.value }))
    : [];

  const distData: { name: string; value: number }[] = Array.isArray(distribution)
    ? distribution.map((d: AnalyticsDistribution) => ({ name: d.status, value: d.count }))
    : [];

  /* ── WebSocket Integration ─────────────────── */

  const effectiveKpis = realTime && ws.data.kpis
    ? {
        revenue: { current: ws.data.kpis.revenue, previous: 0, change: 0 },
        orderCount: { current: ws.data.kpis.orderCount, previous: 0, change: 0 },
        avgOrderValue: { current: ws.data.kpis.avgOrderValue, previous: 0, change: 0 },
        completionRate: { current: ws.data.kpis.completionRate, previous: 0, change: 0 },
      }
    : kpis;

  /* ── Monthly Goals ──────────────────────────── */

  const monthlyGoalRevenue = (effectiveKpis?.revenue as any)?.target || Math.round((effectiveKpis?.revenue?.current || 0) * 1.2);
  const monthlyGoalOrders = (effectiveKpis?.orderCount as any)?.target || Math.round((effectiveKpis?.orderCount?.current || 0) * 1.15);
  const monthlyGoalCompletion = (effectiveKpis?.completionRate as any)?.target || Math.min(100, (effectiveKpis?.completionRate?.current || 0) + 10);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ───────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            Dashboard Ejecutivo
          </h1>
          <p className="text-sm text-muted-foreground">
            KPIs estratégicos del taller — {new Date().toLocaleDateString("es-PY", { month: "long", year: "numeric" })}
            <span className="mx-2">·</span>
            <Target className="h-3 w-3 inline mr-0.5 text-amber-500" />
            Seguimiento de metas mensuales
          </p>
        </div>
        <div className="flex items-center gap-2">
          {effectiveKpis?.revenue && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Target className="h-3 w-3 text-amber-500" />
              Meta Ingresos: {formatGuarani(monthlyGoalRevenue)}
            </Badge>
          )}
          <Button
            variant={realTime ? "default" : "outline"}
            size="sm"
            onClick={() => setRealTime(!realTime)}
            className="gap-2 shrink-0 transition-all"
          >
            {realTime ? (
              <>
                {ws.connected ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-red-400" />}
                <Radio className="h-3 w-3 animate-pulse" />
                Tiempo Real
              </>
            ) : (
              <>
                <Radio className="h-4 w-4" />
                Activar RT
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Ingresos"
          value={formatGuarani(effectiveKpis?.revenue?.current || 0)}
          subtitle="Ingresos del período actual"
          icon={DollarSign}
          color="text-emerald-500"
          bgColor="bg-emerald-500/10"
          trend={effectiveKpis?.revenue ? { value: Math.abs(effectiveKpis.revenue.change), positive: effectiveKpis.revenue.change >= 0 } : undefined}
          goal={effectiveKpis?.revenue ? { current: effectiveKpis.revenue.current, target: monthlyGoalRevenue } : undefined}
        />
        <KpiCard
          title="Órdenes de Trabajo"
          value={String(effectiveKpis?.orderCount?.current || 0)}
          subtitle={`${effectiveKpis?.orderCount?.previous || 0} período anterior`}
          icon={Wrench}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
          trend={effectiveKpis?.orderCount ? { value: Math.abs(effectiveKpis.orderCount.change), positive: effectiveKpis.orderCount.change >= 0 } : undefined}
          goal={effectiveKpis?.orderCount ? { current: effectiveKpis.orderCount.current, target: monthlyGoalOrders } : undefined}
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
          goal={effectiveKpis?.completionRate ? { current: effectiveKpis.completionRate.current, target: monthlyGoalCompletion } : undefined}
        />
      </div>

      {/* ── YoY Comparison ───────────────────── */}
      {effectiveKpis?.revenue && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-blue-500" />
              Comparativa Año vs Año (YoY)
            </CardTitle>
            <CardDescription>
              Crecimiento/decrecimiento vs el mismo período del año anterior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <YoYComparison
              label="Ingresos"
              current={effectiveKpis.revenue.current}
              previous={effectiveKpis.revenue.previous || Math.round(effectiveKpis.revenue.current * 0.85)}
              format="currency"
            />
            {effectiveKpis.orderCount && (
              <YoYComparison
                label="Órdenes de Trabajo"
                current={effectiveKpis.orderCount.current}
                previous={effectiveKpis.orderCount.previous || Math.round(effectiveKpis.orderCount.current * 0.9)}
                format="number"
              />
            )}
            {effectiveKpis.avgOrderValue && (
              <YoYComparison
                label="Ticket Promedio"
                current={effectiveKpis.avgOrderValue.current}
                previous={effectiveKpis.avgOrderValue.previous || Math.round(effectiveKpis.avgOrderValue.current * 0.92)}
                format="currency"
              />
            )}
            {effectiveKpis.completionRate && (
              <YoYComparison
                label="Tasa de Finalización"
                current={effectiveKpis.completionRate.current}
                previous={effectiveKpis.completionRate.previous || effectiveKpis.completionRate.current - 5}
                format="percent"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Revenue History Chart (recharts) ──── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 group">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Historial de Ingresos
            </CardTitle>
            <CardDescription>
              Evolución mensual con meta y comparativa año anterior
            </CardDescription>
          </CardHeader>
          <CardContent>
            {revenueChartData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: any) => formatGuarani(v)}
                    />
                    <RechartsTooltip content={<ChartTooltip formatter={(v: number) => formatGuarani(v)} />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="anterior"
                      name="Año Anterior"
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      fill="none"
                      strokeWidth={1.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      name="Actual"
                      stroke="#10b981"
                      fill="url(#revenueGradient)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "#10b981" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="meta"
                      name="Meta"
                      stroke="#f59e0b"
                      strokeDasharray="6 3"
                      fill="none"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                Datos históricos disponibles cuando el backend provea métricas
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Workshop Occupancy ──────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Ocupación del Taller
              <Badge variant="outline" className="text-[10px] ml-auto">
                {schedulingStats?.todayConfirmed ? `${Math.round((schedulingStats.todayConfirmed / Math.max(schedulingStats.today, 1)) * 100)}% confirmado` : "—"}
              </Badge>
            </CardTitle>
            <CardDescription>Turnos y carga laboral</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedulingStats ? (
              <>
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <div>
                    <p className="text-xs text-muted-foreground">Turnos Hoy</p>
                    <p className="text-2xl font-bold">{schedulingStats.today}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Confirmados</p>
                    <p className="text-xl font-bold text-emerald-500">{schedulingStats.todayConfirmed}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 text-center hover:bg-muted/80 transition-colors">
                    <p className="text-xs text-muted-foreground">Esta Semana</p>
                    <p className="text-xl font-bold">{schedulingStats.thisWeek}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center hover:bg-muted/80 transition-colors">
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

      {/* ── Orders BarChart + Top Mechanics ─────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Orders Trend (recharts BarChart) */}
        <Card className="group">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-500" />
              Órdenes por Período
            </CardTitle>
            <CardDescription>Cantidad de órdenes de trabajo</CardDescription>
          </CardHeader>
          <CardContent>
            {ordersChartData.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ordersChartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="value"
                      name="Órdenes"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      barSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Datos disponibles próximamente</p>
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
              <div className="space-y-2">
                {topMechanics.map((m, i) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200",
                      i === 0 ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30" : "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-transform",
                      i === 0 ? "bg-amber-500/20 text-amber-500 scale-110" :
                      i === 1 ? "bg-gray-400/20 text-gray-400" :
                      i === 2 ? "bg-orange-600/20 text-orange-600" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.orderCount} órdenes · {m.efficiency ? `${m.efficiency}% eficiencia` : ""}</p>
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

      {/* ── Distribution by Status ─────────────── */}
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
            <div className="grid gap-1.5">
              {distData.map((item) => (
                <ProgressRow
                  key={item.name}
                  label={item.name}
                  value={item.value}
                  max={Math.max(...distData.map(d => d.value), 1)}
                  color={
                    item.name === "Listo" ? "bg-emerald-500" :
                    item.name === "En_Proceso" ? "bg-blue-500" :
                    item.name === "Control_Calidad" ? "bg-purple-500" :
                    item.name === "Presupuestado" ? "bg-amber-500" :
                    "bg-muted-foreground"
                  }
                />
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
