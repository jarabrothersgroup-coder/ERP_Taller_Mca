"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
  PiggyBank,
  Banknote,
  HandCoins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/ui/skeleton";
import { api, type CashFlowStatement, type CashFlowSection, type CashFlowLine } from "@/lib/api";

/* ── Helpers ────────────────────────────────── */

const currency = (v: number) =>
  `₲ ${v.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function getMonthOptions() {
  const now = new Date();
  const opts: { value: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-PY", { month: "long", year: "numeric" }),
    });
  }
  return opts;
}

/* ── Stat Card ──────────────────────────────── */

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  bg,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  subtitle?: string;
}) {
  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`rounded-lg p-2 ${bg}`}>
          <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

/* ── Section Detail ─────────────────────────── */

function SectionCard({ section, icon: Icon, color }: {
  section: CashFlowSection;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
            <CardTitle className="text-base">{section.titulo}</CardTitle>
          </div>
          <span className={`text-lg font-bold ${section.total >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {currency(section.total)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {section.lineas.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin movimientos en este período</p>
        ) : (
          <div className="space-y-1">
            {section.lineas.map((linea, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {linea.monto >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-500 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">{linea.concepto}</span>
                  {linea.cuentaCodigo && (
                    <Badge variant="outline" className="text-[10px] font-mono ml-1 shrink-0">
                      {linea.cuentaCodigo}
                    </Badge>
                  )}
                </div>
                <span className={`tabular-nums font-mono text-xs font-medium shrink-0 ml-4 ${
                  linea.monto >= 0 ? "text-emerald-500" : "text-red-500"
                }`}>
                  {linea.monto >= 0 ? "+" : ""}{currency(linea.monto)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Loading State ──────────────────────────── */

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-label="Cargando flujo de efectivo">
      <div className="h-8 w-72 skeleton-pulse rounded-md" />
      <div className="mt-2 h-4 w-56 skeleton-pulse rounded-md" />
      <div className="grid gap-4 sm:grid-cols-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function FlujoEfectivoPage() {
  const [selectedPeriod, setSelectedPeriod] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [acumulado, setAcumulado] = React.useState(false);

  const anho = parseInt(selectedPeriod.split("-")[0]!, 10);
  const mes = parseInt(selectedPeriod.split("-")[1]!, 10);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<CashFlowStatement, Error>({
    queryKey: ["cash-flow", anho, mes, acumulado],
    queryFn: () => api.getCashFlowStatement(anho, mes, acumulado),
    enabled: !!anho && !!mes,
  });

  if (isLoading) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Estado de Flujo de Efectivo</h1>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <XCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
            <div className="text-center">
              <p className="text-lg font-semibold">Error al cargar</p>
              <p className="text-sm text-muted-foreground mt-1">{error?.message}</p>
            </div>
            <Button onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return <PageSkeleton />;

  const monthOpts = getMonthOptions();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estado de Flujo de Efectivo</h1>
          <p className="text-sm text-muted-foreground">
            Método indirecto — variación del efectivo en el período
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={acumulado ? "default" : "outline"}
            size="sm"
            onClick={() => setAcumulado(true)}
            className="text-xs"
          >
            Acumulado
          </Button>
          <Button
            variant={!acumulado ? "default" : "outline"}
            size="sm"
            onClick={() => setAcumulado(false)}
            className="text-xs"
          >
            Mensual
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap gap-2">
        {monthOpts.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedPeriod(opt.value)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
              selectedPeriod === opt.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Verification Banner */}
      {data.verificado !== undefined && (
        <Card className={data.verificado ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/50 bg-amber-500/5"}>
          <CardContent className="flex items-center gap-3 py-3">
            {data.verificado ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" aria-hidden="true" />
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  Flujo de efectivo verificado: la variación neta coincide con el cambio en saldos de caja.
                </p>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" aria-hidden="true" />
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Diferencia detectada: la variación neta no coincide con el cambio en saldos de caja.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Saldo Inicial"
          value={currency(data.saldoInicial)}
          subtitle="Efectivo al inicio del período"
          icon={PiggyBank}
          color="text-blue-500"
          bg="bg-blue-500/10"
        />
        <StatCard
          title="Saldo Final"
          value={currency(data.saldoFinal)}
          subtitle="Efectivo al cierre del período"
          icon={Banknote}
          color="text-emerald-500"
          bg="bg-emerald-500/10"
        />
        <StatCard
          title="Variación Neta"
          value={currency(data.variacionNeta)}
          subtitle={data.variacionNeta >= 0 ? "Aumento de efectivo" : "Disminución de efectivo"}
          icon={BarChart3}
          color={data.variacionNeta >= 0 ? "text-emerald-500" : "text-red-500"}
          bg={data.variacionNeta >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
        />
        <StatCard
          title="Actividades Operativas"
          value={currency(data.operativas.total)}
          subtitle="Flujo neto de operaciones"
          icon={HandCoins}
          color={data.operativas.total >= 0 ? "text-emerald-500" : "text-red-500"}
          bg={data.operativas.total >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
        />
      </div>

      {/* Section Details */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          section={data.operativas}
          icon={TrendingUp}
          color="text-blue-500"
        />
        <SectionCard
          section={data.inversion}
          icon={TrendingDown}
          color="text-purple-500"
        />
        <SectionCard
          section={data.financiamiento}
          icon={DollarSign}
          color="text-amber-500"
        />
      </div>

      {/* Total Movement Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumen de Variación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 px-3 rounded-md bg-blue-500/5">
              <span className="text-sm font-medium">Actividades Operativas</span>
              <span className={`text-sm font-bold tabular-nums ${data.operativas.total >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {currency(data.operativas.total)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 rounded-md bg-purple-500/5">
              <span className="text-sm font-medium">Actividades de Inversión</span>
              <span className={`text-sm font-bold tabular-nums ${data.inversion.total >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {currency(data.inversion.total)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 rounded-md bg-amber-500/5">
              <span className="text-sm font-medium">Actividades de Financiamiento</span>
              <span className={`text-sm font-bold tabular-nums ${data.financiamiento.total >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {currency(data.financiamiento.total)}
              </span>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                <span className="text-sm font-semibold">Variación Neta del Período</span>
                <span className={`text-base font-bold tabular-nums ${data.variacionNeta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {currency(data.variacionNeta)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30 mt-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Saldo Inicial:</span>
                <span className="font-medium text-foreground">{currency(data.saldoInicial)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Saldo Final:</span>
                <span className="font-medium text-foreground">{currency(data.saldoFinal)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
