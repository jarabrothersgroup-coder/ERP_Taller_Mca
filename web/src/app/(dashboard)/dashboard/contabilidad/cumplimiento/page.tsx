"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Scale,
  Calculator,
  AlertTriangle,
  Download,
  History,
  BadgeCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/* ─── Types ──────────────────────────────────── */

interface Form120Result {
  periodo: { anho: number; mes: number };
  periodoFiscalId: string;
  liquidacionId: string;
  ventas: {
    gravada10: string;
    iva10: string;
    gravada5: string;
    iva5: string;
    exenta: string;
    total: string;
  };
  compras: {
    gravada10: string;
    iva10: string;
    gravada5: string;
    iva5: string;
    otras: string;
    total: string;
  };
  ivaDebito: string;
  ivaCredito: string;
  ivaAPagar: string;
  saldoFavor: string;
  prorrateoIndice: string | null;
  saldoArrastre: string;
  alertas: string[];
}

interface LiquidacionIvaRow {
  id: string;
  periodoFiscalId: string;
  anho: number;
  mes: number;
  estado: string;
  ivaDebito: string;
  ivaCredito: string;
  ivaAPagar: string;
  saldoFavor: string;
  createdAt: string;
}

interface CuadraturaResumen {
  periodo: { anho: number; mes: number };
  totalAsientos: number;
  sumaDebe: string;
  sumaHaber: string;
  diferenciaGlobal: string;
  balanceado: boolean;
}

/** Workflow del Formulario 120 (espejo del backend). */
const TRANSICIONES: Record<string, string[]> = {
  BORRADOR: ["PRESENTADO"],
  PRESENTADO: ["PAGADO", "RECTIFICADO"],
  RECTIFICADO: ["PRESENTADO"],
  PAGADO: [],
};

const ESTADO_VARIANT: Record<string, "default" | "success" | "secondary" | "destructive"> = {
  BORRADOR: "secondary",
  PRESENTADO: "default",
  PAGADO: "success",
  RECTIFICADO: "destructive",
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function gs(n: string | number): string {
  return `₲${Number(n).toLocaleString("es-PY")}`;
}

/* ─── Page ───────────────────────────────────── */

export default function CumplimientoFiscalPage() {
  const { toast: t, ToastContainer } = useToast();
  const qc = useQueryClient();

  // Período por defecto: mes anterior (la DDJJ IVA se presenta el 10 del mes siguiente)
  const now = new Date();
  const [anho, setAnho] = React.useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
  const [mes, setMes] = React.useState(now.getMonth() === 0 ? 12 : now.getMonth());

  // ── Historial de liquidaciones ──
  const histQuery = useQuery<LiquidacionIvaRow[]>({
    queryKey: ["fiscal-form120-historial"],
    queryFn: () => api.request<LiquidacionIvaRow[]>("/finance/fiscal/form120?limit=12"),
  });

  /** Liquidación existente del período seleccionado (si ya fue calculada). */
  const periodoActual = (histQuery.data ?? []).find((l) => l.anho === anho && l.mes === mes);
  const estadoActual = periodoActual?.estado ?? null;

  // ── Cuadratura del período (checklist) ──
  const cuadQuery = useQuery<CuadraturaResumen>({
    queryKey: ["fiscal-cuadratura", anho, mes],
    queryFn: () => api.request<CuadraturaResumen>(`/finance/contabilidad/cuadratura/${anho}/${mes}`),
  });

  // ── Calcular liquidación ──
  const calcMut = useMutation({
    mutationFn: () =>
      api.request<Form120Result>("/finance/fiscal/form120/calcular", {
        method: "POST",
        body: JSON.stringify({ anho, mes }),
      }),
    onSuccess: (d) => {
      t.success(`F-120 ${d.periodo.anho}-${String(d.periodo.mes).padStart(2, "0")} liquidado — IVA a pagar ${gs(d.ivaAPagar)}`);
      void qc.invalidateQueries({ queryKey: ["fiscal-form120-historial"] });
    },
    onError: (err: unknown) => t.error(err instanceof Error ? err.message : "No se pudo calcular la liquidación"),
  });

  // ── Actualizar estado (workflow DDJJ) ──
  const estadoMut = useMutation({
    mutationFn: (nuevo: string) =>
      api.request<{ estado: string }>("/finance/fiscal/form120/estado", {
        method: "PATCH",
        body: JSON.stringify({ anho, mes, estado: nuevo }),
      }),
    onSuccess: (d) => {
      t.success(`Período ${anho}-${String(mes).padStart(2, "0")} → ${d.estado}`);
      void qc.invalidateQueries({ queryKey: ["fiscal-form120-historial"] });
    },
    onError: (err: unknown) => t.error(err instanceof Error ? err.message : "No se pudo actualizar el estado"),
  });

  // ── Export CSV ──
  const exportCsv = () => {
    const d = calcMut.data;
    if (!d) return;
    const rows: string[][] = [
      ["Rubro", "Concepto", "Monto"],
      ["1.1", "Ventas gravadas 10%", d.ventas.gravada10],
      ["1.2", "IVA Débito 10%", d.ventas.iva10],
      ["1.3", "Ventas gravadas 5%", d.ventas.gravada5],
      ["1.4", "IVA Débito 5%", d.ventas.iva5],
      ["1.5", "Ventas exentas", d.ventas.exenta],
      ["1.6", "Total ventas", d.ventas.total],
      ["2.1", "Compras gravadas 10%", d.compras.gravada10],
      ["2.2", "IVA Crédito 10%", d.compras.iva10],
      ["2.3", "Compras gravadas 5%", d.compras.gravada5],
      ["2.4", "IVA Crédito 5%", d.compras.iva5],
      ["2.5", "Otras compras", d.compras.otras],
      ["2.6", "Total compras", d.compras.total],
      ["3.1", "IVA Débito Fiscal", d.ivaDebito],
      ["3.2", "IVA Crédito Fiscal", d.ivaCredito],
      ["3.3", "IVA a pagar", d.ivaAPagar],
      ["3.4", "Saldo a favor", d.saldoFavor],
      ["3.5", "Saldo arrastre", d.saldoArrastre],
      ["3.6", "Prorrateo", d.prorrateoIndice ?? "N/A"],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `form120-${d.periodo.anho}-${String(d.periodo.mes).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const proximasTransiciones = estadoActual ? (TRANSICIONES[estadoActual] ?? []) : [];

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {ToastContainer}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-blue-500" />
          Cumplimiento Fiscal
        </h1>
        <p className="text-sm text-muted-foreground">
          Declaración jurada de IVA — Formulario 120 (DNIT). Workflow: BORRADOR → PRESENTADO → PAGADO / RECTIFICADO
        </p>
      </div>

      {/* ── Checklist previo ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Scale className="h-4 w-4" /> Checklist previo a la presentación
          </CardTitle>
          <CardDescription>
            Período {anho} · {MESES[(mes || 1) - 1]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <div className="flex items-center justify-between rounded border p-2.5">
              <span>Cuadratura de asientos</span>
              {cuadQuery.isLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : cuadQuery.isError ? (
                <Badge variant="destructive">Sin datos</Badge>
              ) : (
                <Badge variant={cuadQuery.data?.balanceado ? "success" : "destructive"}>
                  {cuadQuery.data?.balanceado ? "Balanceado" : "Con diferencias"}
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between rounded border p-2.5">
              <span>Liquidación calculada</span>
              <Badge variant={periodoActual ? "success" : "secondary"}>
                {periodoActual ? "Sí" : "Pendiente"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded border p-2.5">
              <span>Estado del período</span>
              <Badge variant={estadoActual ? (ESTADO_VARIANT[estadoActual] ?? "secondary") : "secondary"}>
                {estadoActual ?? "SIN CALCULAR"}
              </Badge>
            </div>
          </div>
          {cuadQuery.data && !cuadQuery.data.balanceado && (
            <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              La cuadratura tiene diferencias (Δ {gs(cuadQuery.data.diferenciaGlobal)}). Revise el
              Diagnóstico Contable antes de declarar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Liquidación F-120 ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Liquidación F-120 — IVA Mensual
          </CardTitle>
          <CardDescription>Débito fiscal − Crédito fiscal = resultado del período</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Año</label>
              <Input
                type="number"
                value={anho}
                onChange={(e) => setAnho(Number(e.target.value))}
                className="h-8 w-24 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Mes</label>
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="h-8 rounded border border-input bg-background px-2 text-xs"
                aria-label="Mes fiscal"
              >
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              className="h-8 text-xs"
              loading={calcMut.isPending}
              onClick={() => calcMut.mutate()}
            >
              Calcular liquidación
            </Button>
            {calcMut.data && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportCsv}>
                <Download className="h-3 w-3" /> Exportar CSV
              </Button>
            )}
            {proximasTransiciones.map((nuevo) => (
              <Button
                key={nuevo}
                size="sm"
                variant={nuevo === "PAGADO" ? "default" : "outline"}
                className="h-8 text-xs"
                loading={estadoMut.isPending && estadoMut.variables === nuevo}
                disabled={!periodoActual}
                onClick={() => estadoMut.mutate(nuevo)}
              >
                {nuevo === "PRESENTADO" && "Marcar presentado"}
                {nuevo === "PAGADO" && "Marcar pagado"}
                {nuevo === "RECTIFICADO" && "Rectificar"}
              </Button>
            ))}
          </div>

          {calcMut.isPending && <Skeleton className="h-32" />}

          {calcMut.data && (
            <div className="space-y-3">
              <div className="grid gap-2 text-xs sm:grid-cols-4">
                <div className="rounded border p-2">
                  <p className="text-muted-foreground">IVA Débito (Rubro 1)</p>
                  <p className="font-mono font-bold">{gs(calcMut.data.ivaDebito)}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-muted-foreground">IVA Crédito (Rubro 2)</p>
                  <p className="font-mono font-bold">{gs(calcMut.data.ivaCredito)}</p>
                </div>
                <div className="rounded border p-2 bg-blue-50 dark:bg-blue-950/30">
                  <p className="text-muted-foreground">IVA a pagar (Rubro 3)</p>
                  <p className="font-mono font-bold text-blue-700 dark:text-blue-300">{gs(calcMut.data.ivaAPagar)}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-muted-foreground">Saldo a favor</p>
                  <p className="font-mono font-bold">{gs(calcMut.data.saldoFavor)}</p>
                </div>
              </div>

              <div className="grid gap-2 text-xs sm:grid-cols-4">
                <div className="rounded border p-2">
                  <p className="text-muted-foreground">Ventas totales</p>
                  <p className="font-mono">{gs(calcMut.data.ventas.total)}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-muted-foreground">Compras totales</p>
                  <p className="font-mono">{gs(calcMut.data.compras.total)}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-muted-foreground">Saldo arrastre</p>
                  <p className="font-mono">{gs(calcMut.data.saldoArrastre)}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-muted-foreground">Prorrateo</p>
                  <p className="font-mono">
                    {calcMut.data.prorrateoIndice
                      ? `${(Number(calcMut.data.prorrateoIndice) * 100).toFixed(2)}%`
                      : "N/A"}
                  </p>
                </div>
              </div>

              {calcMut.data.alertas.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/20">
                  <p className="text-xs font-medium flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" /> Alertas de pre-auditoría
                  </p>
                  <ul className="list-disc pl-4 text-xs text-amber-700 dark:text-amber-300">
                    {calcMut.data.alertas.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {calcMut.isError && (
            <p className="text-sm text-red-600">
              {calcMut.error instanceof Error ? calcMut.error.message : "No se pudo calcular la liquidación"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Historial ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" /> Historial de liquidaciones
          </CardTitle>
          <CardDescription>Últimas 12 liquidaciones del Formulario 120</CardDescription>
        </CardHeader>
        <CardContent>
          {histQuery.isLoading ? (
            <Skeleton className="h-24" />
          ) : histQuery.isError ? (
            <p className="text-sm text-red-600">No se pudo cargar el historial</p>
          ) : (histQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin liquidaciones registradas. Calcule la primera arriba.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Período</th>
                    <th className="py-2 pr-3 font-medium text-right">IVA Débito</th>
                    <th className="py-2 pr-3 font-medium text-right">IVA Crédito</th>
                    <th className="py-2 pr-3 font-medium text-right">A pagar</th>
                    <th className="py-2 pr-3 font-medium text-right">Saldo a favor</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th className="py-2 font-medium">Calculado</th>
                  </tr>
                </thead>
                <tbody>
                  {(histQuery.data ?? []).map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono">
                        {l.anho}-{String(l.mes).padStart(2, "0")}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">{gs(l.ivaDebito)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{gs(l.ivaCredito)}</td>
                      <td className="py-2 pr-3 text-right font-mono font-bold">{gs(l.ivaAPagar)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{gs(l.saldoFavor)}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={ESTADO_VARIANT[l.estado] ?? "secondary"} className="text-[10px]">
                          {l.estado === "PRESENTADO" && <BadgeCheck className="mr-1 h-3 w-3 inline" />}
                          {l.estado}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(l.createdAt).toLocaleDateString("es-PY")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
