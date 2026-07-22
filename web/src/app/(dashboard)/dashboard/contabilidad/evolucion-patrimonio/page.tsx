"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CheckCircle2,
  XCircle,
  PiggyBank,
  Shield,
  ScrollText,
  BarChart4,
  ArrowUpRight,
  ArrowDownRight,
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
import { DataTable, type Column } from "@/components/ui/data-table";
import { SkeletonCard } from "@/components/ui/skeleton";
import { api, type EquityStatement, type EquityAccountGroup, type EquityLine } from "@/lib/api";

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

/* ── Equity Group Card ───────────────────────── */

function EquityGroupCard({
  group,
  icon: Icon,
  color,
  bg,
}: {
  group: EquityAccountGroup;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  const columns: Column<EquityLine>[] = [
    {
      header: "Concepto",
      accessor: "concepto",
      sortable: true,
      cell: (_, row) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{row.cuentaCodigo}</span>
          <span className="font-medium">{row.concepto}</span>
        </div>
      ),
    },
    {
      header: "Saldo Inicial",
      accessor: "saldoInicial",
      align: "right",
      cell: (_, row) => (
        <span className="tabular-nums font-mono text-xs">{currency(row.saldoInicial)}</span>
      ),
    },
    {
      header: "Incrementos",
      accessor: (row) => row.movimientos.incrementos,
      align: "right",
      cell: (_, row) => (
        <span className="tabular-nums font-mono text-xs text-emerald-500">
          +{currency(row.movimientos.incrementos)}
        </span>
      ),
    },
    {
      header: "Decrementos",
      accessor: (row) => row.movimientos.decrementos,
      align: "right",
      cell: (_, row) => (
        <span className="tabular-nums font-mono text-xs text-red-500">
          -{currency(row.movimientos.decrementos)}
        </span>
      ),
    },
    {
      header: "Variación",
      accessor: "cambioNeto",
      align: "right",
      cell: (_, row) => (
        <span className={`tabular-nums font-mono text-xs font-medium ${row.cambioNeto >= 0 ? "text-emerald-500" : "text-red-500"}`}>
          {row.cambioNeto >= 0 ? "+" : ""}{currency(row.cambioNeto)}
        </span>
      ),
    },
    {
      header: "Saldo Final",
      accessor: "saldoFinal",
      align: "right",
      cell: (_, row) => (
        <span className="tabular-nums font-mono text-xs font-bold">{currency(row.saldoFinal)}</span>
      ),
    },
  ];

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`rounded-lg p-2 ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">{group.tipoLabel}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {group.lineas.length} cuenta(s) patrimonial(es)
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Saldo Final</p>
            <p className="text-lg font-bold">{currency(group.totalFinal)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {group.lineas.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin cuentas en esta categoría</p>
        ) : (
          <DataTable<EquityLine>
            columns={columns}
            data={group.lineas}
            rowKey="cuentaCodigo"
            paginate={false}
            sortable
          />
        )}
      </CardContent>
    </Card>
  );
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

/* ── Loading State ──────────────────────────── */

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-label="Cargando evolución del patrimonio">
      <div className="h-8 w-72 skeleton-pulse rounded-md" />
      <div className="mt-2 h-4 w-56 skeleton-pulse rounded-md" />
      <div className="grid gap-4 sm:grid-cols-3">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function EvolucionPatrimonioPage() {
  const [selectedPeriod, setSelectedPeriod] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [acumulado, setAcumulado] = React.useState(false);

  const anho = parseInt(selectedPeriod.split("-")[0]!, 10);
  const mes = parseInt(selectedPeriod.split("-")[1]!, 10);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<EquityStatement, Error>({
    queryKey: ["equity-statement", anho, mes, acumulado],
    queryFn: () => api.getEquityStatement(anho, mes, acumulado),
    enabled: !!anho && !!mes,
  });

  if (isLoading) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Evolución del Patrimonio</h1>
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
          <h1 className="text-2xl font-bold tracking-tight">Evolución del Patrimonio</h1>
          <p className="text-sm text-muted-foreground">
            Cambios en el patrimonio neto del período
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

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Patrimonio Inicial"
          value={currency(data.totalPatrimonioInicial)}
          subtitle="Al inicio del período"
          icon={PiggyBank}
          color="text-blue-500"
          bg="bg-blue-500/10"
        />
        <StatCard
          title="Patrimonio Final"
          value={currency(data.totalPatrimonioFinal)}
          subtitle="Al cierre del período"
          icon={BarChart4}
          color="text-emerald-500"
          bg="bg-emerald-500/10"
        />
        <StatCard
          title="Variación"
          value={currency(data.variacionPeriodo)}
          subtitle={data.variacionPeriodo >= 0 ? "Aumento patrimonial" : "Disminución patrimonial"}
          icon={data.variacionPeriodo >= 0 ? TrendingUp : TrendingDown}
          color={data.variacionPeriodo >= 0 ? "text-emerald-500" : "text-red-500"}
          bg={data.variacionPeriodo >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
        />
        <StatCard
          title="Resultado del Ejercicio"
          value={currency(data.resultadoEjercicio)}
          subtitle={data.resultadoEjercicio >= 0 ? "Utilidad del período" : "Pérdida del período"}
          icon={ScrollText}
          color={data.resultadoEjercicio >= 0 ? "text-emerald-500" : "text-red-500"}
          bg={data.resultadoEjercicio >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
        />
      </div>

      {/* Equity Group Cards */}
      <div className="grid gap-6">
        <EquityGroupCard
          group={data.capital}
          icon={PiggyBank}
          color="text-blue-500"
          bg="bg-blue-500/10"
        />
        <EquityGroupCard
          group={data.reservas}
          icon={Shield}
          color="text-amber-500"
          bg="bg-amber-500/10"
        />
        <EquityGroupCard
          group={data.resultados}
          icon={ScrollText}
          color="text-purple-500"
          bg="bg-purple-500/10"
        />
      </div>

      {/* Total Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumen Patrimonial</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 px-3 rounded-md bg-blue-500/5">
              <span className="text-sm font-medium">Capital Social</span>
              <span className="text-sm font-bold tabular-nums">{currency(data.capital.totalFinal)}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 rounded-md bg-amber-500/5">
              <span className="text-sm font-medium">Reservas</span>
              <span className="text-sm font-bold tabular-nums">{currency(data.reservas.totalFinal)}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 rounded-md bg-purple-500/5">
              <span className="text-sm font-medium">Resultados Acumulados</span>
              <span className="text-sm font-bold tabular-nums">{currency(data.resultados.totalFinal)}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 rounded-md bg-emerald-500/10">
              <span className="text-sm font-medium">Resultado del Ejercicio</span>
              <span className={`text-sm font-bold tabular-nums ${data.resultadoEjercicio >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {currency(data.resultadoEjercicio)}
              </span>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                <span className="text-sm font-semibold">Total Patrimonio Neto</span>
                <span className="text-base font-bold tabular-nums">{currency(data.totalPatrimonioFinal)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-1 px-3 text-xs text-muted-foreground">
              <span>Patrimonio Inicial: {currency(data.totalPatrimonioInicial)}</span>
              <span>Variación: <span className={data.variacionPeriodo >= 0 ? "text-emerald-500" : "text-red-500"}>{data.variacionPeriodo >= 0 ? "+" : ""}{currency(data.variacionPeriodo)}</span></span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
