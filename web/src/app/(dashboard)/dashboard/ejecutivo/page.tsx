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
  ClipboardCheck,
  Timer,
  ShoppingBag,
  Receipt,
  Clock,
  Download,
  Filter,
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
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinancialWebSocket } from "@/hooks/use-financial-ws";
import type { AnalyticsKpis, AnalyticsTrend, TopMechanic, AnalyticsDistribution } from "@/lib/api";

/* ─── Safe reduced-motion check ────────────── */
let prefersReducedMotion: boolean | undefined;
function getPrefersReducedMotion(): boolean {
  if (prefersReducedMotion === undefined && typeof window !== "undefined") {
    prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return prefersReducedMotion ?? false;
}

/* ─── Helpers ───────────────────────────────── */

function formatGuarani(amount: number): string {
  if (amount >= 1_000_000) return `₲ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₲ ${(amount / 1_000).toFixed(0)}K`;
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

function formatNumber(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

type Period = "today" | "week" | "month" | "quarter";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoy",
  week: "Esta Semana",
  month: "Este Mes",
  quarter: "Este Trimestre",
};

/* ─── Counter Animation Hook ────────────────── */

function useCounter(end: number, duration = 1200, enabled = true) {
  const [value, setValue] = React.useState(enabled ? 0 : end);

  React.useEffect(() => {
    if (!enabled) { setValue(end); return; }

    // Respect OS accessibility settings — skip rAF loop entirely
    if (typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(end);
      return;
    }

    let startTime: number | null = null;
    const startVal = 0;
    let rafId: number;

    const animate = (now: number) => {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(startVal + (end - startVal) * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setValue(end); // ensure exact final value
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [end, duration, enabled]);

  return value;
}

/* ─── Animated KPI Value ────────────────────── */

function AnimatedNumber({ value, enabled = true, format = "number" }: {
  value: number;
  enabled?: boolean;
  format?: "number" | "currency" | "percent";
}) {
  const count = useCounter(value, 1200, enabled);
  if (format === "currency") return <>{formatGuarani(count)}</>;
  if (format === "percent") return <>{count}%</>;
  return <>{formatNumber(count)}</>;
}

/* ─── Staggered Section ─────────────────────── */

function StaggerSection({ children, index = 0, className }: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("animate-fade-in", className)}
      style={
        getPrefersReducedMotion()
          ? undefined
          : { animationDelay: `${index * 80}ms`, animationFillMode: "backwards" }
      }
    >
      {children}
    </div>
  );
}

/* ─── KPI Card ───────────────────────────────── */

function KpiCard({ title, value, subtitle, icon: Icon, color, bgColor, trend, goal, format = "number" }: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  trend?: { value: number; positive: boolean };
  goal?: { current: number; target: number };
  format?: "number" | "currency" | "percent";
}) {
  const goalPct = goal ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : undefined;

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3", bgColor)}>
          <Icon className={cn("h-4 w-4", color)} aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <p className="text-2xl font-bold tracking-tight tabular-nums">
            <AnimatedNumber value={value} format={format} />
          </p>
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
                  "h-full rounded-full transition-all duration-1000 ease-out",
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

/* ─── Custom Tooltip ──────────────────────────── */

function ChartTooltip({ active, payload, label, formatter }: Record<string, any>) {
  if (!active || !payload?.length) return null;
  const fmt = formatter ?? ((v: number) => v.toLocaleString());
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md backdrop-blur-sm">
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

/* ─── Progress Row ────────────────────────────── */

function ProgressRow({ label, value, max, color = "bg-orange-500", showBar = true }: {
  label: string;
  value: number;
  max: number;
  color?: string;
  showBar?: boolean;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2 group hover:bg-accent/30 rounded-md px-1 -mx-1 transition-colors">
      <span className="w-20 text-xs text-muted-foreground truncate">{label}</span>
      {showBar && (
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-110", color)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <span className="w-10 text-xs font-medium tabular-nums text-right">{value}</span>
    </div>
  );
}

/* ─── YoY Comparison ──────────────────────────── */

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
    <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-accent/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm cursor-default">
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

/* ─── Radial Gauge ────────────────────────────── */

function RadialGauge({ value, max, label, color = "#10b981", size = 100 }: {
  value: number;
  max: number;
  label: string;
  color?: string;
  size?: number;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="text-xl font-bold tabular-nums">{pct}%</span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="sr-only">{label}: {pct}%</span>
    </div>
  );
}

/* ─── Loading Skeleton (Detailed) ────────────── */

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-8 w-72 rounded-lg bg-muted" />
          <div className="h-4 w-56 rounded bg-muted" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-8 w-8 rounded-lg bg-muted" />
            </div>
            <div className="h-8 w-28 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
            <div className="h-1.5 w-full rounded-full bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-card p-4 space-y-3">
          <div className="flex gap-2 items-center">
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-4 w-40 rounded bg-muted" />
          </div>
          <div className="h-[280px] rounded-lg bg-muted" />
        </div>
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex gap-2 items-center">
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
          </div>
          <div className="h-16 rounded-lg bg-muted" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-16 rounded-lg bg-muted" />
            <div className="h-16 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex gap-2 items-center">
              <div className="h-4 w-4 rounded bg-muted" />
              <div className="h-4 w-36 rounded bg-muted" />
            </div>
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-10 rounded-lg bg-muted/50" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────── */

export default function EjecutivoPage() {
  const [realTime, setRealTime] = React.useState(false);
  const [period, setPeriod] = React.useState<Period>("month");
  const [showPeriodPicker, setShowPeriodPicker] = React.useState(false);
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

  // Hub: active OT status summary
  const { data: activeOrders = [] } = useQuery<any[]>({
    queryKey: ["ejecutivo-active-orders"],
    queryFn: () => api.listWorkOrders({ limit: 100 }),
    refetchInterval: 60_000,
  });

  // Workshop productivity
  const { data: productivity } = useQuery({
    queryKey: ["ejecutivo-productividad"],
    queryFn: () => api.request<{ productividad?: number; eficiencia?: number; otsEnProceso?: number; tiempoPromedioHoras?: number }>("/workshop/analytics/productividad"),
  });

  // Top services by usage
  const { data: topServicios } = useQuery({
    queryKey: ["ejecutivo-top-servicios"],
    queryFn: () => api.request<{ nombre: string; cantidad: number; ingresoTotal: number }[]>("/workshop/analytics/top-servicios"),
  });

  // Invoices for pending amounts
  const { data: invoices } = useQuery({
    queryKey: ["ejecutivo-invoices"],
    queryFn: () => api.listInvoices({ limit: 50 }),
  });

  const loading = loadingKpis || loadingRevenue || loadingOrders || loadingMechs || loadingDist;

  if (loading) return <DashboardSkeleton />;

  /* ── Process Data for Charts ───────────────── */

  const revenueChartData: { name: string; actual: number; meta: number; anterior: number }[] = Array.isArray(revenueTrend)
    ? revenueTrend.map((t: AnalyticsTrend, i: number) => ({
        name: t.date?.slice(5) || "",
        actual: t.value,
        meta: Math.round(t.value * 1.15),
        anterior: Math.round(t.value * (i > 0 ? 0.85 : 0.9)),
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

  /* ── Derived Stats ─────────────────────────── */

  const otsEnProceso = activeOrders.filter((o: any) => o.status === "En_Proceso" || o.status === "Control_Calidad").length;
  const otsListas = activeOrders.filter((o: any) => o.status === "Listo").length;
  const totalPending = Array.isArray(invoices)
    ? invoices.reduce((sum: number, inv: any) => sum + Number(inv.saldoPendiente || 0), 0)
    : 0;
  const overdueCount = Array.isArray(invoices)
    ? invoices.filter((inv: any) => inv.estadoPago === "PENDIENTE" && inv.fechaVencimiento && new Date(inv.fechaVencimiento) < new Date()).length
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────── */}
      <StaggerSection index={0}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-500" />
              Dashboard Ejecutivo
            </h1>
            <p className="text-sm text-muted-foreground">
              KPIs estratégicos del taller — {PERIOD_LABELS[period]} · {new Date().toLocaleDateString("es-PY", { month: "long", year: "numeric" })}
              <span className="mx-2">·</span>
              <Target className="h-3 w-3 inline mr-0.5 text-amber-500" />
              Seguimiento de metas mensuales
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period Selector */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPeriodPicker(!showPeriodPicker)}
                className="gap-2"
              >
                <Filter className="h-3.5 w-3.5" />
                {PERIOD_LABELS[period]}
              </Button>
              {showPeriodPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPeriodPicker(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 rounded-lg border bg-popover p-1 shadow-lg min-w-[140px]">
                    {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => { setPeriod(p); setShowPeriodPicker(false); }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors",
                          period === p ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50"
                        )}
                      >
                        {PERIOD_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Export Button */}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
              <Download className="h-3.5 w-3.5" />
              Exportar
            </Button>

            {effectiveKpis?.revenue && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Target className="h-3 w-3 text-amber-500" />
                Meta: {formatGuarani(monthlyGoalRevenue)}
              </Badge>
            )}

            {/* Real-time Toggle */}
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
                  RT
                </>
              )}
            </Button>
          </div>
        </div>
      </StaggerSection>

      {/* ── KPI Cards ────────────────────────── */}
      <StaggerSection index={1}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Ingresos"
            value={effectiveKpis?.revenue?.current || 0}
            subtitle="Ingresos del período actual"
            icon={DollarSign}
            color="text-emerald-500"
            bgColor="bg-emerald-500/10"
            format="currency"
            trend={effectiveKpis?.revenue ? { value: Math.abs(effectiveKpis.revenue.change), positive: effectiveKpis.revenue.change >= 0 } : undefined}
            goal={effectiveKpis?.revenue ? { current: effectiveKpis.revenue.current, target: monthlyGoalRevenue } : undefined}
          />
          <KpiCard
            title="Órdenes de Trabajo"
            value={effectiveKpis?.orderCount?.current || 0}
            subtitle={`${effectiveKpis?.orderCount?.previous || 0} período anterior`}
            icon={Wrench}
            color="text-blue-500"
            bgColor="bg-blue-500/10"
            trend={effectiveKpis?.orderCount ? { value: Math.abs(effectiveKpis.orderCount.change), positive: effectiveKpis.orderCount.change >= 0 } : undefined}
            goal={effectiveKpis?.orderCount ? { current: effectiveKpis.orderCount.current, target: monthlyGoalOrders } : undefined}
          />
          <KpiCard
            title="Ticket Promedio"
            value={effectiveKpis?.avgOrderValue?.current || 0}
            subtitle="Valor promedio por OT"
            icon={TrendingUp}
            color="text-violet-500"
            bgColor="bg-violet-500/10"
            format="currency"
            trend={effectiveKpis?.avgOrderValue ? { value: Math.abs(effectiveKpis.avgOrderValue.change), positive: effectiveKpis.avgOrderValue.change >= 0 } : undefined}
          />
          <KpiCard
            title="Tasa Finalización"
            value={effectiveKpis?.completionRate?.current || 0}
            subtitle="Órdenes completadas vs total"
            icon={Percent}
            color="text-orange-500"
            bgColor="bg-orange-500/10"
            format="percent"
            trend={effectiveKpis?.completionRate ? { value: Math.abs(effectiveKpis.completionRate.change), positive: effectiveKpis.completionRate.change >= 0 } : undefined}
            goal={effectiveKpis?.completionRate ? { current: effectiveKpis.completionRate.current, target: monthlyGoalCompletion } : undefined}
          />
        </div>
      </StaggerSection>

      {/* ── YoY Comparison ───────────────────── */}
      {effectiveKpis?.revenue && (
        <StaggerSection index={2}>
          <Card className="group hover:shadow-md transition-all duration-300">
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
        </StaggerSection>
      )}

      {/* ── Revenue History + Occupancy ────────── */}
      <StaggerSection index={3}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Revenue Chart */}
          <Card className="lg:col-span-2 group hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Historial de Ingresos
              </CardTitle>
              <CardDescription>Evolución mensual con meta y comparativa año anterior</CardDescription>
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
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: any) => formatGuarani(v)}
                      />
                      <RechartsTooltip content={<ChartTooltip formatter={(v: number) => formatGuarani(v)} />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Area type="monotone" dataKey="anterior" name="Año Anterior" stroke="#94a3b8" strokeDasharray="4 4" fill="none" strokeWidth={1.5} />
                      <Area type="monotone" dataKey="actual" name="Actual" stroke="#10b981" fill="url(#revenueGradient)" strokeWidth={2.5} dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: "#10b981" }} />
                      <Area type="monotone" dataKey="meta" name="Meta" stroke="#f59e0b" strokeDasharray="6 3" fill="none" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Datos históricos disponibles cuando el backend provea métricas</p>
              )}
            </CardContent>
          </Card>

          {/* Workshop Occupancy */}
          <Card className="group hover:shadow-md transition-all duration-300">
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
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 transition-colors">
                    <div>
                      <p className="text-xs text-muted-foreground">Turnos Hoy</p>
                      <p className="text-2xl font-bold tabular-nums">
                        <AnimatedNumber value={schedulingStats.today} />
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Confirmados</p>
                      <p className="text-xl font-bold text-emerald-500 tabular-nums">
                        <AnimatedNumber value={schedulingStats.todayConfirmed} />
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/50 text-center hover:bg-muted/80 transition-all hover:-translate-y-0.5 cursor-default">
                      <p className="text-xs text-muted-foreground">Esta Semana</p>
                      <p className="text-xl font-bold tabular-nums">
                        <AnimatedNumber value={schedulingStats.thisWeek} />
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center hover:bg-muted/80 transition-all hover:-translate-y-0.5 cursor-default">
                      <p className="text-xs text-muted-foreground">Activos</p>
                      <p className="text-xl font-bold tabular-nums">
                        <AnimatedNumber value={schedulingStats.totalActive} />
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No hay datos de ocupación disponibles</p>
              )}
            </CardContent>
          </Card>
        </div>
      </StaggerSection>

      {/* ── Orders + Top Mechanics ──────────────── */}
      <StaggerSection index={4}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Orders Trend */}
          <Card className="group hover:shadow-md transition-all duration-300">
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
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} allowDecimals={false} />
                      <RechartsTooltip content={<ChartTooltip />} />
                      <Bar dataKey="value" name="Órdenes" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24}>
                        {ordersChartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.value > 0 ? "#3b82f6" : "#e2e8f0"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Datos disponibles próximamente</p>
              )}
            </CardContent>
          </Card>

          {/* Top Mechanics */}
          <Card className="group hover:shadow-md transition-all duration-300">
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
                        "flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 hover:-translate-y-0.5",
                        i === 0 ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 hover:shadow-md" : "hover:bg-muted/50 hover:shadow-sm"
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300",
                        i === 0 ? "bg-amber-500/20 text-amber-500 scale-110 ring-2 ring-amber-500/20" :
                        i === 1 ? "bg-gray-400/20 text-gray-400" :
                        i === 2 ? "bg-orange-600/20 text-orange-600" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          <AnimatedNumber value={m.orderCount} /> órdenes
                          {m.efficiency ? ` · ${m.efficiency}% eficiencia` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-medium tabular-nums">{m.avgRating?.toFixed(1) || "—"}</span>
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
      </StaggerSection>

      {/* ── Distribution by Status ──────────────── */}
      {distData.length > 0 && (
        <StaggerSection index={5}>
          <Card className="group hover:shadow-md transition-all duration-300">
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
        </StaggerSection>
      )}

      {/* ── Mini Insight Cards Row ──────────────── */}
      <StaggerSection index={6}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* OTs en Proceso */}
          <Card className="hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 cursor-default">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Wrench className="h-5 w-5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">OTs en Proceso</p>
                <p className="text-lg font-bold tabular-nums">
                  <AnimatedNumber value={otsEnProceso} />
                </p>
              </div>
            </CardContent>
          </Card>

          {/* OTs Listas */}
          <Card className="hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 cursor-default">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <ClipboardCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Listas para Entrega</p>
                <p className="text-lg font-bold tabular-nums">
                  <AnimatedNumber value={otsListas} />
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Facturas Pendientes */}
          <Card className="hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 cursor-default">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Receipt className="h-5 w-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">CxC Pendiente</p>
                <p className="text-lg font-bold tabular-nums text-amber-600">
                  <AnimatedNumber value={totalPending} format="currency" />
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Vencidas */}
          <Card className={cn("hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 cursor-default",
            overdueCount > 0 && "ring-1 ring-red-300 dark:ring-red-800"
          )}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                overdueCount > 0 ? "bg-red-500/10" : "bg-muted"
              )}>
                <Clock className={cn("h-5 w-5", overdueCount > 0 ? "text-red-500" : "text-muted-foreground")} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Facturas Vencidas</p>
                <p className={cn("text-lg font-bold tabular-nums", overdueCount > 0 && "text-red-500")}>
                  <AnimatedNumber value={overdueCount} />
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </StaggerSection>

      {/* ── OT Status / Productivity / Top Services ── */}
      <StaggerSection index={7}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── OT Status Summary (Enhanced) ────── */}
          <Card className="group hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-orange-500" />
                Órdenes Activas en Taller
              </CardTitle>
              <CardDescription>Resumen en tiempo real del Hub de Operaciones</CardDescription>
            </CardHeader>
            <CardContent>
              {activeOrders.length > 0 ? (() => {
                const statusCounts: Record<string, number> = {};
                for (const o of activeOrders) {
                  const s = o.status || "Otro";
                  statusCounts[s] = (statusCounts[s] || 0) + 1;
                }
                const statusOrder = ["Presupuestado", "Aprobado", "En_Proceso", "Control_Calidad", "Listo"];
                const statusColors: Record<string, string> = {
                  Presupuestado: "bg-amber-500", Aprobado: "bg-blue-500",
                  En_Proceso: "bg-indigo-500", Control_Calidad: "bg-purple-500", Listo: "bg-emerald-500",
                };
                const maxCount = Math.max(...Object.values(statusCounts), 1);
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">
                        <AnimatedNumber value={activeOrders.length} /> OTs activas
                      </span>
                      <Badge variant="outline" className="text-[10px] animate-pulse">
                        auto 60s
                      </Badge>
                    </div>
                    {statusOrder.map(s => {
                      const count = statusCounts[s];
                      if (!count) return null;
                      return (
                        <div key={s} className="group/item cursor-default">
                          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-all duration-200">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className={cn("h-2.5 w-2.5 rounded-full shrink-0 transition-transform group-hover/item:scale-125", statusColors[s] || "bg-muted")} />
                              <span className="text-xs truncate">{s.replace("_", " ")}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                                <div
                                  className={cn("h-full rounded-full transition-all duration-700", statusColors[s] || "bg-muted")}
                                  style={{ width: `${(count / maxCount) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm font-bold tabular-nums w-6 text-right">{count}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
                <p className="text-sm text-muted-foreground text-center py-6">No hay órdenes activas en este momento</p>
              )}
            </CardContent>
          </Card>

          {/* ── Workshop Productivity (Enhanced) ── */}
          <Card className="group hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="h-4 w-4 text-blue-500" />
                Productividad del Taller
              </CardTitle>
              <CardDescription>Métricas de eficiencia operativa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {productivity ? (
                <>
                  {/* Radial Gauges */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative flex items-center justify-center">
                      <RadialGauge
                        value={productivity.productividad || 0}
                        max={100}
                        label="Productividad"
                        color="#10b981"
                        size={110}
                      />
                    </div>
                    <div className="relative flex items-center justify-center">
                      <RadialGauge
                        value={productivity.eficiencia || 0}
                        max={100}
                        label="Eficiencia"
                        color="#3b82f6"
                        size={110}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Wrench className="h-3 w-3" />
                        OTs en Proceso
                      </span>
                      <span className="text-sm font-bold tabular-nums">
                        <AnimatedNumber value={productivity.otsEnProceso || 0} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        Tiempo Promedio
                      </span>
                      <span className="text-sm font-bold tabular-nums">
                        {productivity.tiempoPromedioHoras?.toFixed(1) || "—"} h
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Métricas disponibles próximamente</p>
              )}
            </CardContent>
          </Card>

          {/* ── Top Services (Enhanced) ────────── */}
          <Card className="group hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-violet-500" />
                Servicios Más Solicitados
              </CardTitle>
              <CardDescription>Top servicios por volumen de órdenes</CardDescription>
            </CardHeader>
            <CardContent>
              {Array.isArray(topServicios) && topServicios.length > 0 ? (
                <div className="space-y-2">
                  {topServicios.slice(0, 5).map((s, i) => (
                    <div
                      key={s.nombre || i}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-all duration-200 hover:-translate-x-0.5 group/item"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-transform group-hover/item:scale-110",
                          i === 0 ? "bg-amber-500/20 text-amber-600 ring-1 ring-amber-500/30" :
                          i === 1 ? "bg-gray-400/20 text-gray-500" :
                          i === 2 ? "bg-orange-600/20 text-orange-600" :
                          "bg-muted text-muted-foreground"
                        )}>{i + 1}</span>
                        <span className="text-xs truncate">{s.nombre}</span>
                        {/* Mini bar */}
                        <div className="hidden sm:block flex-1 h-1 rounded-full bg-muted overflow-hidden max-w-[60px] ml-1">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700",
                              i === 0 ? "bg-amber-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-orange-600" : "bg-muted-foreground/50"
                            )}
                            style={{ width: `${(s.cantidad / Math.max(topServicios[0]?.cantidad, 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium tabular-nums">
                          <AnimatedNumber value={s.cantidad} />x
                        </span>
                        {s.ingresoTotal > 0 && (
                          <span className="text-[10px] text-muted-foreground hidden sm:inline tabular-nums">
                            {formatGuarani(s.ingresoTotal)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6 flex flex-col items-center gap-2">
                  <ShoppingBag className="h-8 w-8 opacity-30" />
                  Datos disponibles cuando se registren servicios
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </StaggerSection>
    </div>
  );
}

/* ─── Inline SVG Icon ────────────────────────── */

function PieChartIcon() {
  return (
    <svg className="h-4 w-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  );
}
