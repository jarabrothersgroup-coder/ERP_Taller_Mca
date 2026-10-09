"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  Play,
  TrendingUp,
  TrendingDown,
  Layers,
  Calculator,
  Percent,
  Landmark,
  Lock,
  Undo2,
  Merge,
  FileDiff,
  ArrowRightLeft,
  History,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DevengarGastosDialog,
  RevaluoDialog,
  RefundirDialog,
  ReversarDialog,
  NotaCreditoDebitoDialog,
  TipoCambioDialog,
} from "./cierre-dialogs";

/* ── Types ────────────────────────────────────── */

interface OpLogEntry {
  id: number;
  label: string;
  ok: boolean;
  message: string;
  at: Date;
}

/* ── Helpers ──────────────────────────────────── */

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function resultMessage(res: {
  success?: boolean;
  message?: string;
  asientoId?: string;
  asiento?: { id: string };
}): string {
  return (
    res.message ||
    (res.asientoId ? `Asiento ${res.asientoId.slice(0, 8)}` : "") ||
    (res.asiento?.id ? `Asiento ${res.asiento.id.slice(0, 8)}` : "OK")
  );
}

/* ── Page ─────────────────────────────────────── */

/**
 * Cierre Contable — operaciones de período (apertura, devengamiento,
 * centralización, depreciación, FX, reserva legal, cierre) y operaciones
 * avanzadas (revaluo, refundición, reversión, notas, tipos de cambio).
 * Conecta las ~14 rutas POST /finance/contabilidad/* del balde T-47.
 */
export default function CierreContablePage() {
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();

  const now = new Date();
  const [anho, setAnho] = React.useState(now.getFullYear());
  const [mes, setMes] = React.useState(now.getMonth() + 1);
  const [usarAcumulados, setUsarAcumulados] = React.useState(true);
  const [hastaMes, setHastaMes] = React.useState(now.getMonth() + 1);

  const [log, setLog] = React.useState<OpLogEntry[]>([]);
  const logId = React.useRef(0);

  const pushLog = (label: string, ok: boolean, message: string) => {
    logId.current += 1;
    setLog((prev) => [{ id: logId.current, label, ok, message, at: new Date() }, ...prev].slice(0, 12));
  };

  // Dialog visibility
  const [devengarGastosOpen, setDevengarGastosOpen] = React.useState(false);
  const [revaluoOpen, setRevaluoOpen] = React.useState(false);
  const [refundirOpen, setRefundirOpen] = React.useState(false);
  const [reversarOpen, setReversarOpen] = React.useState(false);
  const [notaOpen, setNotaOpen] = React.useState(false);
  const [tipoCambioOpen, setTipoCambioOpen] = React.useState(false);

  const { data: reservaSaldo } = useQuery<{ saldo: number | string }>({
    queryKey: ["reserva-legal-saldo"],
    queryFn: () => api.getReservaLegalSaldo(),
  });

  const { data: tipoCambioActual } = useQuery({
    queryKey: ["tipo-cambio-actual", "USD"],
    queryFn: () => api.getTipoCambioActual("USD"),
  });

  const onOpSuccess = () => {
    qc.invalidateQueries({ queryKey: ["reserva-legal-saldo"] });
    qc.invalidateQueries({ queryKey: ["tipo-cambio-actual"] });
    qc.invalidateQueries({ queryKey: ["asientos"] });
  };

  /** Helper: mutation de operación de período con log + toast. */
  const usePeriodOp = <T extends object>(label: string, fn: () => Promise<T>) =>
    useMutation({
      mutationFn: fn,
      onSuccess: (res) => {
        const r = res as { success?: boolean; message?: string; asientoId?: string };
        pushLog(label, r.success !== false, resultMessage(r));
        if (r.success === false) t.error(`${label}: ${resultMessage(r)}`);
        else t.success(`${label}: ${resultMessage(r)}`);
        onOpSuccess();
      },
      onError: (err: any) => {
        const msg = err?.message || "Error de red";
        pushLog(label, false, msg);
        t.error(`${label}: ${msg}`);
      },
    });

  const aperturaMut = usePeriodOp("Apertura", () =>
    api.contabilidadApertura({ anho, mes, usarSaldosAcumulados: usarAcumulados }),
  );
  const devengarIngresosMut = usePeriodOp("Devengar ingresos", () =>
    api.contabilidadDevengarIngresos(anho, mes),
  );
  const revertirDevMut = usePeriodOp("Revertir devengamiento", () =>
    api.contabilidadRevertirDevengamiento(anho, mes),
  );
  const centralizarVentasMut = usePeriodOp("Centralizar ventas", () =>
    api.contabilidadCentralizarVentas(anho, mes),
  );
  const centralizarComprasMut = usePeriodOp("Centralizar compras", () =>
    api.contabilidadCentralizarCompras(anho, mes),
  );
  const centralizacionEjecutarMut = usePeriodOp("Centralización completa", () =>
    api.contabilidadCentralizacionEjecutar(anho, mes),
  );
  const depreciacionMut = usePeriodOp("Depreciación", () =>
    api.contabilidadCalcularDepreciacion(anho, mes),
  );
  const diferenciaCambioMut = usePeriodOp("Diferencia de cambio", () =>
    api.contabilidadCalcularDiferenciaCambio(anho, mes),
  );
  const reservaLegalMut = usePeriodOp("Reserva legal", () =>
    api.contabilidadReservaLegal(anho),
  );

  const cerrarPeriodoMut = useMutation({
    mutationFn: () => api.contabilidadCerrarPeriodo(hastaMes),
    onSuccess: (res) => {
      pushLog("Cerrar período", true, `Cerrado hasta mes ${res.cerradoHastaMes}`);
      t.success(`Período cerrado hasta mes ${res.cerradoHastaMes}`);
    },
    onError: (err: any) => {
      const msg = err?.message || "Error al cerrar el período";
      pushLog("Cerrar período", false, msg);
      t.error(msg);
    },
  });

  const periodoLabel = `${MESES[mes - 1]} ${anho}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + period selector */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-orange-500" />
            Cierre Contable
          </h1>
          <p className="text-sm text-muted-foreground">
            Operaciones de período — {periodoLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Año" htmlFor="cierre-anho">
            <Input
              id="cierre-anho"
              type="number"
              min={2020}
              max={2100}
              className="w-24"
              value={anho}
              onChange={(e) => setAnho(Number(e.target.value))}
            />
          </FormField>
          <FormField label="Mes" htmlFor="cierre-mes">
            <select
              id="cierre-mes"
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="flex h-9 w-36 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </FormField>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={usarAcumulados}
              onChange={(e) => setUsarAcumulados(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Saldos acumulados
          </label>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Flujo mensual ─────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Play className="h-4 w-4 text-blue-500" />
              Flujo Mensual
            </CardTitle>
            <CardDescription>Orden sugerido: devengar → centralizar → depreciar → FX → cerrar</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <OpRow
              icon={<TrendingUp className="h-3.5 w-3.5 text-green-500" />}
              label="Devengar ingresos"
              desc="Ingresos devengados del período"
              loading={devengarIngresosMut.isPending}
              onClick={() => devengarIngresosMut.mutate()}
            />
            <OpRow
              icon={<TrendingDown className="h-3.5 w-3.5 text-amber-500" />}
              label="Devengar gastos"
              desc="Gastos devengados (detalle manual)"
              onClick={() => setDevengarGastosOpen(true)}
            />
            <OpRow
              icon={<Undo2 className="h-3.5 w-3.5 text-muted-foreground" />}
              label="Revertir devengamiento"
              desc="Anula los devengamientos del período"
              loading={revertirDevMut.isPending}
              onClick={() => revertirDevMut.mutate()}
            />
            <OpRow
              icon={<Layers className="h-3.5 w-3.5 text-blue-500" />}
              label="Centralizar ventas"
              desc="Ventas del período → libro mayor"
              loading={centralizarVentasMut.isPending}
              onClick={() => centralizarVentasMut.mutate()}
            />
            <OpRow
              icon={<Layers className="h-3.5 w-3.5 text-purple-500" />}
              label="Centralizar compras"
              desc="Compras del período → libro mayor"
              loading={centralizarComprasMut.isPending}
              onClick={() => centralizarComprasMut.mutate()}
            />
            <OpRow
              icon={<Layers className="h-3.5 w-3.5 text-orange-500" />}
              label="Centralización completa"
              desc="Ventas + compras en un solo paso"
              loading={centralizacionEjecutarMut.isPending}
              onClick={() => centralizacionEjecutarMut.mutate()}
            />
            <OpRow
              icon={<Calculator className="h-3.5 w-3.5 text-cyan-500" />}
              label="Calcular depreciación"
              desc="Depreciación mensual de activos fijos"
              loading={depreciacionMut.isPending}
              onClick={() => depreciacionMut.mutate()}
            />
            <OpRow
              icon={<Percent className="h-3.5 w-3.5 text-amber-500" />}
              label="Diferencia de cambio"
              desc="Ajuste por tipo de cambio multimoneda"
              loading={diferenciaCambioMut.isPending}
              onClick={() => diferenciaCambioMut.mutate()}
            />
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {/* ── Apertura y reserva ───────────── */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Landmark className="h-4 w-4 text-emerald-500" />
                Apertura y Patrimonio
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <OpRow
                icon={<Play className="h-3.5 w-3.5 text-emerald-500" />}
                label="Asiento de apertura"
                desc={`Apertura de ${periodoLabel}`}
                loading={aperturaMut.isPending}
                onClick={() => aperturaMut.mutate()}
              />
              <OpRow
                icon={<Landmark className="h-3.5 w-3.5 text-emerald-500" />}
                label="Constituir reserva legal"
                desc={`Reserva legal del año ${anho}`}
                loading={reservaLegalMut.isPending}
                onClick={() => reservaLegalMut.mutate()}
                right={
                  reservaSaldo ? (
                    <Badge variant="secondary" className="font-mono">
                      ₲ {Number(reservaSaldo.saldo).toLocaleString("es-PY")}
                    </Badge>
                  ) : null
                }
              />
            </CardContent>
          </Card>

          {/* ── Cierre ──────────────────────── */}
          <Card className="shadow-sm border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-destructive" />
                Cierre de Período
              </CardTitle>
              <CardDescription>
                Bloquea asientos hasta el mes indicado. Requiere rol administrador.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <FormField label="Cerrar hasta mes" htmlFor="cerrar-hasta">
                <select
                  id="cerrar-hasta"
                  value={hastaMes}
                  onChange={(e) => setHastaMes(Number(e.target.value))}
                  className="flex h-9 w-36 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </FormField>
              <Button
                variant="destructive"
                className="gap-1.5"
                loading={cerrarPeriodoMut.isPending}
                onClick={() => cerrarPeriodoMut.mutate()}
              >
                <Lock className="h-3.5 w-3.5" />
                Cerrar hasta {MESES[hastaMes - 1]}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Operaciones avanzadas ─────────────── */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-muted-foreground" />
            Operaciones Avanzadas
          </CardTitle>
          <CardDescription>
            Revaluo, refundición, reversión, notas contables y tipo de cambio
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Button variant="outline" className="justify-start gap-2" onClick={() => setRevaluoOpen(true)}>
            <TrendingUp className="h-4 w-4 text-cyan-500" />
            Revaluo de activo
          </Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => setRefundirOpen(true)}>
            <Merge className="h-4 w-4 text-purple-500" />
            Refundir asientos
          </Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => setReversarOpen(true)}>
            <Undo2 className="h-4 w-4 text-destructive" />
            Reversar operación
          </Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => setNotaOpen(true)}>
            <FileDiff className="h-4 w-4 text-amber-500" />
            Nota crédito / débito
          </Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => setTipoCambioOpen(true)}>
            <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
            Registrar tipo de cambio
          </Button>
          <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm">
            <span className="text-muted-foreground">USD actual</span>
            <span className="font-mono">
              {tipoCambioActual ? `₲ ${Number(tipoCambioActual.venta).toLocaleString("es-PY")}` : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Log de operaciones ────────────────── */}
      {log.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              Últimas operaciones de esta sesión
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1">
            {log.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-1.5 text-sm",
                  entry.ok ? "border-border" : "border-destructive/40 bg-destructive/5",
                )}
              >
                {!entry.ok && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                <span className="font-medium">{entry.label}</span>
                <span className={cn("flex-1 truncate", entry.ok ? "text-muted-foreground" : "text-destructive")}>
                  {entry.message}
                </span>
                <span className="text-xs text-muted-foreground">
                  {entry.at.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Dialogs ──────────────────────────── */}
      <DevengarGastosDialog
        open={devengarGastosOpen}
        onOpenChange={setDevengarGastosOpen}
        onSuccess={() => {
          pushLog("Devengar gastos", true, "Gastos devengados");
          onOpSuccess();
        }}
      />
      <RevaluoDialog
        open={revaluoOpen}
        onOpenChange={setRevaluoOpen}
        onSuccess={() => {
          pushLog("Revaluo", true, "Activo revaluado");
          onOpSuccess();
        }}
      />
      <RefundirDialog
        open={refundirOpen}
        onOpenChange={setRefundirOpen}
        onSuccess={() => {
          pushLog("Refundir asientos", true, "Asientos refundidos");
          onOpSuccess();
        }}
      />
      <ReversarDialog
        open={reversarOpen}
        onOpenChange={setReversarOpen}
        onSuccess={() => {
          pushLog("Reversar", true, "Operación reversada");
          onOpSuccess();
        }}
      />
      <NotaCreditoDebitoDialog
        open={notaOpen}
        onOpenChange={setNotaOpen}
        onSuccess={() => {
          pushLog("Nota crédito/débito", true, "Nota contabilizada");
          onOpSuccess();
        }}
      />
      <TipoCambioDialog
        open={tipoCambioOpen}
        onOpenChange={setTipoCambioOpen}
        onSuccess={() => {
          pushLog("Tipo de cambio", true, "Cotización registrada");
          onOpSuccess();
        }}
      />
      {ToastContainer}
    </div>
  );
}

/* ── Op Row ───────────────────────────────────── */

function OpRow({
  icon,
  label,
  desc,
  onClick,
  loading,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
  loading?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{desc}</span>
      </span>
      {right}
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      )}
    </button>
  );
}
