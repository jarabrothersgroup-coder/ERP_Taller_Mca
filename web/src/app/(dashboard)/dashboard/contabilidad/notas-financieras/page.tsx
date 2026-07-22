"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScrollText,
  RefreshCw,
  XCircle,
  Printer,
  ChevronDown,
  ChevronRight,
  FileText,
  Building2,
  CalendarDays,
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
import { Separator } from "@/components/ui/separator";
import { SkeletonCard } from "@/components/ui/skeleton";
import { api, type FinancialNotesReport } from "@/lib/api";

/* ── Helpers ────────────────────────────────── */

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

/* ── Note Card ──────────────────────────────── */

function NoteCard({ note, expanded: defaultExpanded }: {
  note: FinancialNotesReport["notas"][0];
  expanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded ?? note.numero <= 2);

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left"
        aria-expanded={isExpanded}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10 text-orange-500 text-sm font-bold">
                {String(note.numero).padStart(2, "0")}
              </div>
              <div>
                <CardTitle className="text-base">{note.titulo}</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Nota {note.numero} a los Estados Financieros
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {note.detalle && note.detalle.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {note.detalle.length} ítems
                </Badge>
              )}
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
          </div>
        </CardHeader>
      </button>

      {isExpanded && (
        <CardContent className="pt-0 animate-slide-down">
          <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-line leading-relaxed">
            {note.contenido}
          </div>

          {note.detalle && note.detalle.length > 0 && (
            <div className="mt-4 rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    {Object.keys(note.detalle[0]!).map((key) => (
                      <th key={key} className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wider">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {note.detalle.map((row, i) => (
                    <tr key={i} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-3 py-2 font-mono tabular-nums">
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/* ── Loading State ──────────────────────────── */

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-label="Cargando notas financieras">
      <div className="h-8 w-72 skeleton-pulse rounded-md" />
      <div className="mt-2 h-4 w-56 skeleton-pulse rounded-md" />
      <div className="space-y-3">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function NotasFinancierasPage() {
  const [selectedPeriod, setSelectedPeriod] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [acumulado, setAcumulado] = React.useState(false);

  const anho = parseInt(selectedPeriod.split("-")[0]!, 10);
  const mes = parseInt(selectedPeriod.split("-")[1]!, 10);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<FinancialNotesReport, Error>({
    queryKey: ["financial-notes", anho, mes, acumulado],
    queryFn: () => api.getFinancialNotes(anho, mes, acumulado),
    enabled: !!anho && !!mes,
  });

  const handlePrint = React.useCallback(() => {
    window.print();
  }, []);

  if (isLoading) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Notas a los Estados Financieros</h1>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notas a los Estados Financieros</h1>
          <p className="text-sm text-muted-foreground">
            Notas explicativas generadas automáticamente — {data.notas.length} notas
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
            onClick={handlePrint}
            className="gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Imprimir
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
      <div className="flex flex-wrap gap-2 print:hidden">
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

      {/* Company Header (visible in print) */}
      <div className="hidden print:block text-center mb-8">
        <h2 className="text-xl font-bold">{data.empresa.nombre}</h2>
        <p className="text-sm text-muted-foreground">RUC: {data.empresa.ruc}</p>
        <p className="text-sm text-muted-foreground">Régimen: {data.empresa.regimenFiscal}</p>
        <Separator className="my-4" />
      </div>

      {/* Summary Header Card */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="flex flex-wrap items-center gap-6 py-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm">{data.empresa.nombre}</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm">RUC: {data.empresa.ruc}</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm">
              Período: {data.tipo === "ACUMULADO" ? "Enero - " : ""}{getMonthOptions().find(o => o.value === selectedPeriod)?.label ?? selectedPeriod}
            </span>
          </div>
          <Badge variant="outline" className="ml-auto">
            {data.tipo}
          </Badge>
        </CardContent>
      </Card>

      {/* Notes List */}
      <div className="space-y-3">
        {data.notas.map((note) => (
          <NoteCard key={note.numero} note={note} />
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border print:mt-8">
        <p>Generado automáticamente por AutomotiveOS ERP — {new Date(data.generadoEn).toLocaleString("es-PY")}</p>
        <p className="mt-1">Este documento es una representación resumida de los estados financieros completos.</p>
      </div>
    </div>
  );
}
