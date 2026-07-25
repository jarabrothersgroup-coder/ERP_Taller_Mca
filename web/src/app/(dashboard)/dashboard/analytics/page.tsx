"use client";

import * as React from "react";
import {
  TrendingUp, TrendingDown, Minus, Users, Wrench, DollarSign, Percent,
  Clock, Award, Download, RefreshCw, BarChart3, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkshopAnalytics } from "@/hooks/use-data";
import type { AnalyticsKpis } from "@/lib/api";

/* ── Helpers ──────────────────────────────────── */

function formatGuanira(n: number): string {
  if (n >= 1_000_000_000) return `₲ ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₲ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₲ ${(n / 1_000).toFixed(0)}K`;
  return `₲ ${n.toLocaleString("es-PY")}`;
}

function getDefaultRange() {
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  return { from, to };
}

/* ── KPI Cards ──────────────────────────────── */

const KPI_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  Ingresos: { icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  "Órdenes de Trabajo": { icon: Wrench, color: "text-blue-500", bg: "bg-blue-500/10" },
  "Ticket Promedio": { icon: BarChart3, color: "text-orange-500", bg: "bg-orange-500/10" },
  "Tasa de Finalización": { icon: Percent, color: "text-violet-500", bg: "bg-violet-500/10" },
};

function TrendIcon({ trend }: { trend?: string }) {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function AnalyticsKPIs({ kpis }: { kpis: AnalyticsKpis[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => {
        const config = KPI_CONFIG[kpi.label] || { icon: Activity, color: "text-gray-500", bg: "bg-gray-500/10" };
        const Icon = config.icon;
        const displayValue =
          kpi.unit === "Gs."
            ? formatGuanira(kpi.value)
            : kpi.unit === "%"
              ? `${kpi.value}%`
              : kpi.value.toLocaleString("es-PY");

        return (
          <Card key={kpi.label}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", config.bg)}>
                <Icon className={cn("h-4 w-4", config.color)} aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{displayValue}</p>
                {kpi.change !== undefined && kpi.change !== 0 && (
                  <Badge variant={kpi.change > 0 ? "default" : "destructive"} className="text-xs gap-1">
                    <TrendIcon trend={kpi.trend} />
                    {kpi.change > 0 ? "+" : ""}{kpi.change}%
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpi.unit === "Gs." ? "Últimos 30 días" : kpi.unit === "%" ? "vs total OTs" : "vs período anterior"}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ── CSS Bar Chart ───────────────────────────── */

function BarChart({ data, label, valueKey = "value", maxBars = 14 }: {
  data: Array<{ date: string; value: number }>;
  label: string;
  valueKey?: string;
  maxBars?: number;
}) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />{label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground py-8">Sin datos para este período</p>
        </CardContent>
      </Card>
    );
  }

  const sliced = data.slice(-maxBars);
  const maxVal = Math.max(...sliced.map((d) => d.value), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />{label}
        </CardTitle>
        <CardDescription>Últimos {sliced.length} días con actividad</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-40">
          {sliced.map((d, i) => {
            const pct = Math.max(4, (d.value / maxVal) * 100);
            const dateLabel = new Date(d.date).toLocaleDateString("es-PY", { day: "2-digit", month: "short" });
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                  {formatGuanira(d.value)}
                </span>
                <div
                  className="w-full rounded-t bg-blue-500 dark:bg-blue-400 transition-all duration-300 hover:bg-blue-600 dark:hover:bg-blue-300 min-h-[4px]"
                  style={{ height: `${pct}%` }}
                  title={`${dateLabel}: ${formatGuanira(d.value)}`}
                />
                <span className="text-[9px] text-muted-foreground leading-none">{dateLabel}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Status Distribution ─────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  Presupuestado: "bg-yellow-500",
  Aprobado: "bg-blue-500",
  En_Proceso: "bg-indigo-500",
  Control_Calidad: "bg-purple-500",
  Listo: "bg-emerald-500",
  Completado: "bg-emerald-600",
  Cancelado: "bg-red-500",
  pending: "bg-gray-400",
  budgeted: "bg-yellow-500",
  in_progress: "bg-indigo-500",
  quality: "bg-purple-500",
  ready: "bg-emerald-500",
  completed: "bg-emerald-600",
  cancelled: "bg-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  Presupuestado: "Presupuestado",
  Aprobado: "Aprobado",
  En_Proceso: "En Proceso",
  Control_Calidad: "Control Calidad",
  Listo: "Listo",
  Completado: "Completado",
  Cancelado: "Cancelado",
  pending: "Pendiente",
  budgeted: "Presupuestado",
  in_progress: "En Progreso",
  quality: "Control Calidad",
  ready: "Listo",
  completed: "Completado",
  cancelled: "Cancelado",
};

function StatusDistribution({ distribution }: {
  distribution: Array<{ status: string; count: number; percentage: number }>;
}) {
  if (distribution.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" aria-hidden="true" />Distribución de OTs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground py-8">Sin datos de distribución</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" aria-hidden="true" />Distribución de OTs
        </CardTitle>
        <CardDescription>Porcentaje de órdenes por estado</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stacked bar */}
        <div className="flex h-6 rounded-full overflow-hidden">
          {distribution.map((d) => (
            <div
              key={d.status}
              className={cn("transition-all duration-500", STATUS_COLORS[d.status] || "bg-gray-400")}
              style={{ width: `${d.percentage}%` }}
              title={`${STATUS_LABELS[d.status] || d.status}: ${d.count} (${d.percentage}%)`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {distribution.map((d) => (
            <div key={d.status} className="flex items-center gap-1.5">
              <div className={cn("h-2.5 w-2.5 rounded-full", STATUS_COLORS[d.status] || "bg-gray-400")} />
              <span className="text-xs text-muted-foreground">
                {STATUS_LABELS[d.status] || d.status}: {d.count} ({d.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Mechanics Leaderboard ───────────────────── */

function MechanicsLeaderboard({ mechanics }: {
  mechanics: Array<{ name: string; otCount: number; revenue: number }>;
}) {
  if (mechanics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" aria-hidden="true" />Top Mecánicos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground py-8">
            Rankings disponibles cuando el backend tenga asignaciones de mecánicos
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxOTs = Math.max(...mechanics.map((m) => m.otCount), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4" aria-hidden="true" />Top Mecánicos
        </CardTitle>
        <CardDescription>Por cantidad de OTs completadas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {mechanics.map((m, i) => (
          <div key={m.name} className="flex items-center gap-3">
            <div className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0",
              i === 0 ? "bg-amber-500/10 text-amber-600" : i === 1 ? "bg-gray-400/10 text-gray-500" : i === 2 ? "bg-orange-700/10 text-orange-700" : "bg-muted text-muted-foreground",
            )}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${(m.otCount / maxOTs) * 100}%` }} />
                </div>
                <span className="text-xs tabular-nums">{m.otCount} OTs</span>
              </div>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground shrink-0">{formatGuanira(m.revenue)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── Date Range Picker ───────────────────────── */

function DateRangePicker({ from, to, onChange }: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const presets = [
    { label: "7 días", days: 7 },
    { label: "30 días", days: 30 },
    { label: "90 días", days: 90 },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => {
        const pFrom = new Date(Date.now() - p.days * 86400000).toISOString().split("T")[0];
        const isActive = from === pFrom;
        return (
          <Button
            key={p.days}
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onChange(pFrom, to)}
          >
            {p.label}
          </Button>
        );
      })}
      <input
        type="date"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
        className="border rounded px-2 py-1 text-xs"
      />
      <span className="text-xs text-muted-foreground">a</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
        className="border rounded px-2 py-1 text-xs"
      />
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function AnalyticsPage() {
  const [range, setRange] = React.useState(getDefaultRange);
  const { kpis, revenueTrend, otTrend, distribution, mechanics, isLoading } = useWorkshopAnalytics(range.from, range.to);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><div className="h-8 w-20 bg-muted rounded animate-pulse mt-2" /></CardContent></Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><div className="h-40 bg-muted rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Métricas del taller en tiempo real</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRange(getDefaultRange())}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Hoy
          </Button>
        </div>
      </div>

      {/* Date range */}
      <DateRangePicker from={range.from} to={range.to} onChange={(f, t) => setRange({ from: f, to: t })} />

      {/* KPIs */}
      <AnalyticsKPIs kpis={kpis} />

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        <BarChart data={revenueTrend} label="Ingresos Diarios" />
        <BarChart data={otTrend} label="OTs Creadas por Día" />
      </div>

      {/* Status distribution + Mechanics */}
      <div className="grid gap-4 md:grid-cols-2">
        <StatusDistribution distribution={distribution} />
        <MechanicsLeaderboard mechanics={mechanics} />
      </div>
    </div>
  );
}
