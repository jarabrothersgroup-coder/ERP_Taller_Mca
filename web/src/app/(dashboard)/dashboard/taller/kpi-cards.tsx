"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

/** Shape de los endpoints `GET /analytics/kpis/*`. */
interface Kpi {
  label: string;
  value: number;
  unit: string;
  change?: number;
  trend?: "up" | "down" | "flat";
}

const KPI_ENDPOINTS = [
  { path: "/analytics/kpis/revenue", fallbackLabel: "Ingresos" },
  { path: "/analytics/kpis/ots", fallbackLabel: "Órdenes" },
  { path: "/analytics/kpis/avg-value", fallbackLabel: "Ticket Promedio" },
  { path: "/analytics/kpis/completion", fallbackLabel: "% Finalizadas" },
] as const;

function formatValue(value: number, unit: string): string {
  if (unit === "Gs.") return `₲ ${value.toLocaleString("es-PY")}`;
  if (unit === "%") return `${value}%`;
  return unit ? `${value} ${unit}` : String(value);
}

function KpiCard({ path, fallbackLabel }: { path: string; fallbackLabel: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["taller-kpi", path],
    queryFn: () => api.request<Kpi>(path),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const kpi = isError ? null : data;
  const trend = kpi?.trend ?? "flat";
  const change = kpi?.change;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs font-medium text-muted-foreground">
          {kpi?.label || fallbackLabel}
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-xl font-bold tabular-nums">
            {kpi ? formatValue(kpi.value, kpi.unit) : "—"}
          </p>
          {kpi && change !== undefined && Math.abs(change) >= 0.1 && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                trend === "up" && "text-emerald-500",
                trend === "down" && "text-red-500",
                trend === "flat" && "text-muted-foreground",
              )}
            >
              {trend === "up" ? (
                <TrendingUp className="h-3 w-3" aria-hidden="true" />
              ) : trend === "down" ? (
                <TrendingDown className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Minus className="h-3 w-3" aria-hidden="true" />
              )}
              {change > 0 ? "+" : ""}
              {change}%
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {kpi ? "Últimos 30 días" : "No disponible"}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Tarjetas de KPI del taller servidas por los endpoints dedicados
 * `GET /analytics/kpis/*` (cada widget consume sólo el valor que muestra).
 */
export function WorkshopKpiCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {KPI_ENDPOINTS.map((kpi) => (
        <KpiCard key={kpi.path} path={kpi.path} fallbackLabel={kpi.fallbackLabel} />
      ))}
    </div>
  );
}
