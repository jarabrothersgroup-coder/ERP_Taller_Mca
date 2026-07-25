"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Activity,
  Download,
  RefreshCw,
  AlertTriangle,
  Shield,
  Plus,
  Search,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

/* ── Types ──────────────────────────────────── */

interface SifenDashboardData {
  summary: Record<string, number>;
  totalDocumentos: number;
  recentActivity: SifenLogEntry[];
  pendingDocuments: SifenPendingDoc[];
  consultadoEn: string;
}

interface SifenLogEntry {
  id: string;
  documentoId: string;
  operacion: string;
  codigoResultado: string;
  cdc: string | null;
  exitoso: boolean;
  mensajeError: string | null;
  createdAt: string;
}

interface SifenPendingDoc {
  id: string;
  dteTipo: string;
  serie: string;
  numero: string;
  fechaEnvio: string | null;
  ageHours: number | null;
}

interface FiscalDocument {
  id: string;
  dteTipo: string;
  serie: string;
  numero: string;
  cdc: string | null;
  estado: string;
  totalDocumento: string;
  receptorRazonSocial: string;
  fechaEmision: string;
  condicionVenta: string;
  moneda: string;
}

interface ContingenciaStatus {
  sifenDisponible: boolean;
  enCola: number;
  ultimoReenvio: string | null;
}

/* ── Helpers ────────────────────────────────── */

const ESTADO_COLORS: Record<string, string> = {
  BORRADOR: "bg-gray-100 text-gray-700 border-gray-300",
  FIRMADO: "bg-blue-100 text-blue-700 border-blue-300",
  ENVIADO: "bg-amber-100 text-amber-700 border-amber-300",
  APROBADO: "bg-green-100 text-green-700 border-green-300",
  RECHAZADO: "bg-red-100 text-red-700 border-red-300",
  ANULADO: "bg-purple-100 text-purple-700 border-purple-300",
  CONTINGENCIA: "bg-orange-100 text-orange-700 border-orange-300",
};

const ESTADO_ICONS: Record<string, React.ElementType> = {
  BORRADOR: Clock,
  FIRMADO: FileText,
  ENVIADO: Send,
  APROBADO: CheckCircle2,
  RECHAZADO: AlertCircle,
  ANULADO: Shield,
  CONTINGENCIA: AlertTriangle,
};

/* ── Main Page ──────────────────────────────── */

export default function SifenDashboardPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();
  const [activeTab, setActiveTab] = React.useState<"dashboard" | "documentos" | "contingencia">("dashboard");
  const [estadoFilter, setEstadoFilter] = React.useState("");

  // Emitir DTE dialog
  const [emitirOpen, setEmitirOpen] = React.useState(false);
  const [emitForm, setEmitForm] = React.useState({
    ordenTrabajoId: "",
    clienteId: "",
    condicionVenta: "CONTADO",
    items: [{ descripcion: "", cantidad: 1, precioUnitario: "", iva: 10, subtotal: "" }],
  });

  // Nota credito dialog
  const [ncOpen, setNcOpen] = React.useState(false);
  const [ncForm, setNcForm] = React.useState({ cdcOriginal: "", motivo: "", monto: "" });
  const ncFormRef = React.useRef(ncForm);
  ncFormRef.current = ncForm;
  const resetNcForm = React.useCallback(() => {
    setNcForm({ cdcOriginal: "", motivo: "", monto: "" });
  }, []);

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashLoading } = useQuery<SifenDashboardData>({
    queryKey: ["sifen-dashboard"],
    queryFn: () => api.request<SifenDashboardData>("/finance/sifen/dashboard"),
  });

  // Fetch documents list
  const { data: docsData, isLoading: docsLoading } = useQuery<{ items: FiscalDocument[]; total: number }>({
    queryKey: ["sifen-documentos", estadoFilter],
    queryFn: () => api.request<{ items: FiscalDocument[]; total: number }>(
      `/finance/sifen/documentos${estadoFilter ? `?estado=${estadoFilter}` : ""}`
    ),
  });

  // Fetch contingency status
  const { data: contingencia } = useQuery<ContingenciaStatus>({
    queryKey: ["sifen-contingencia"],
    queryFn: () => api.request<ContingenciaStatus>("/finance/sifen/contingencia/status"),
    refetchInterval: activeTab === "contingencia" ? 30000 : false,
  });

  const documents = docsData?.items || [];
  const summary = dashboard?.summary || {};
  const totalDocs = dashboard?.totalDocumentos || 0;
  const aprobados = summary["APROBADO"] || 0;
  const rechazados = summary["RECHAZADO"] || 0;
  const pendientes = (dashboard?.pendingDocuments || []).length;

  // Contingencia mutations
  const reenviarContingenciaMut = useMutation({
    mutationFn: () => api.request("/finance/sifen/contingencia/reenviar", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sifen-contingencia"] });
      qc.invalidateQueries({ queryKey: ["sifen-dashboard"] });
      t.success("Contingencia reenviada");
    },
    onError: (err: any) => t.error(err?.message || "Error al reenviar contingencia"),
  });

  // Nota credito mutation
  const emitirNcMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { cdcOriginal: ncFormRef.current.cdcOriginal, motivo: ncFormRef.current.motivo };
      if (ncFormRef.current.monto) {
        body.monto = Number(ncFormRef.current.monto);
      }
      return api.request("/finance/sifen/nota-credito", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sifen-dashboard"] });
      qc.invalidateQueries({ queryKey: ["sifen-documentos"] });
      setNcOpen(false);
      resetNcForm();
      t.success("Nota de crédito emitida");
    },
    onError: (err: any) => t.error(err?.message || "Error al emitir nota de crédito"),
  });

  const docsColumns: Column<FiscalDocument>[] = [
    {
      header: "Tipo",
      accessor: "dteTipo",
      cell: (_, row) => (
        <Badge variant="outline" className="text-xs font-mono">
          {row.dteTipo === "FACTURA" ? "FACT" : row.dteTipo === "NOTA_CREDITO" ? "NC" : row.dteTipo}
        </Badge>
      ),
    },
    {
      header: "Número",
      accessor: "serie",
      cell: (_, row) => <span className="font-mono text-xs">{row.serie}-{row.numero}</span>,
    },
    {
      header: "Cliente",
      accessor: "receptorRazonSocial",
      cell: (_, row) => <span className="text-sm">{row.receptorRazonSocial}</span>,
    },
    {
      header: "Total",
      accessor: "totalDocumento",
      align: "right",
      cell: (_, row) => (
        <span className="font-medium">₲ {Number(row.totalDocumento).toLocaleString("es-PY")}</span>
      ),
    },
    {
      header: "CDC",
      accessor: "cdc",
      cell: (_, row) => (
        <span className="text-[10px] font-mono text-muted-foreground max-w-[100px] truncate block">
          {row.cdc || "—"}
        </span>
      ),
    },
    {
      header: "Estado",
      accessor: "estado",
      cell: (_, row) => {
        const Icon = ESTADO_ICONS[row.estado] || Clock;
        return (
          <Badge className={cn("text-xs border gap-1", ESTADO_COLORS[row.estado] || "")}>
            <Icon className="h-3 w-3" />
            {row.estado}
          </Badge>
        );
      },
    },
    {
      header: "Fecha",
      accessor: "fechaEmision",
      hideOnMobile: true,
      cell: (_, row) => (
        <span className="text-xs text-muted-foreground">
          {row.fechaEmision ? new Date(row.fechaEmision).toLocaleDateString("es-PY") : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-500" />
            SIFEN — Facturación Electrónica
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitoreo de documentos electrónicos y contingencia DNIT
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setNcOpen(true)}>
            <Plus className="h-4 w-4" />
            Nota de Crédito
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setEmitirOpen(true)}>
            <Send className="h-4 w-4" />
            Emitir DTE
          </Button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Estado DNIT:</span>
          {contingencia?.sifenDisponible ? (
            <Badge variant="success" className="text-xs">Online</Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">Offline</Badge>
          )}
        </div>
        {contingencia && contingencia.enCola > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-amber-600 text-xs font-medium">
              {contingencia.enCola} documento{contingencia.enCola > 1 ? "s" : ""} en cola de contingencia
            </span>
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Documentos</p>
              <FileText className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold mt-1">{totalDocs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Aprobados</p>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{aprobados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Rechazados</p>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{rechazados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Pendientes</p>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-600">{pendientes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" role="tablist">
        {[
          { key: "dashboard" as const, label: "Dashboard", icon: Activity },
          { key: "documentos" as const, label: "Documentos", icon: FileText },
          { key: "contingencia" as const, label: "Contingencia", icon: Shield },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5",
              activeTab === tab.key
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            role="tab"
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* TAB: Dashboard */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === "dashboard" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Documentos por estado */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Documentos por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(summary).map(([estado, count]) => {
                  if (count === 0) return null;
                  const Icon = ESTADO_ICONS[estado] || Clock;
                  return (
                    <div key={estado} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{estado}</span>
                      </div>
                      <span className="font-bold">{Number(count).toLocaleString("es-PY")}</span>
                    </div>
                  );
                })}
                {Object.values(summary).every((c) => c === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin documentos</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actividad Reciente */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.recentActivity && dashboard.recentActivity.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {dashboard.recentActivity.map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-xs p-2 rounded-lg border">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          log.exitoso ? "bg-green-500" : "bg-red-500"
                        )} />
                        <span className="font-medium">{log.operacion}</span>
                        <span className="text-muted-foreground truncate">
                          {log.cdc ? log.cdc.slice(0, 12) + "..." : log.mensajeError?.slice(0, 30) || ""}
                        </span>
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString("es-PY")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Sin actividad reciente</p>
              )}
            </CardContent>
          </Card>

          {/* Documentos Pendientes */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Documentos Pendientes ({pendientes})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.pendingDocuments && dashboard.pendingDocuments.length > 0 ? (
                <div className="space-y-2">
                  {dashboard.pendingDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">{doc.dteTipo} {doc.serie}-{doc.numero}</p>
                        <p className="text-xs text-muted-foreground">
                          Enviado: {doc.fechaEnvio ? new Date(doc.fechaEnvio).toLocaleString("es-PY") : "—"} 
                          {doc.ageHours !== null && ` · ${doc.ageHours}h sin respuesta`}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="text-xs">
                        Consultar
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No hay documentos pendientes</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: Documentos */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === "documentos" && (
        <>
          {/* Estado filter */}
          <div className="flex flex-wrap gap-2" role="tablist">
            {["", "BORRADOR", "FIRMADO", "ENVIADO", "APROBADO", "RECHAZADO", "ANULADO"].map((est) => (
              <Button
                key={est}
                variant={estadoFilter === est ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setEstadoFilter(est)}
                role="tab"
              >
                {est || "Todos"}
              </Button>
            ))}
          </div>

          <DataTable<FiscalDocument>
            columns={docsColumns}
            data={documents}
            rowKey="id"
            loading={docsLoading}
            emptyMessage="No se encontraron documentos fiscales"
            paginate
            pageSize={10}
            sortable
            className="shadow-sm"
          />
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: Contingencia */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === "contingencia" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Estado del Servicio DNIT
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-sm">Disponibilidad</span>
                {contingencia?.sifenDisponible ? (
                  <Badge variant="success" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Online
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Offline
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-sm">Documentos en cola</span>
                <span className="font-bold">{contingencia?.enCola || 0}</span>
              </div>
              {contingencia?.ultimoReenvio && (
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="text-sm">Último reenvío</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(contingencia.ultimoReenvio).toLocaleString("es-PY")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full gap-2"
                variant="outline"
                onClick={() => reenviarContingenciaMut.mutate()}
                loading={reenviarContingenciaMut.isPending}
                disabled={!contingencia?.enCola || contingencia.enCola === 0}
              >
                <RefreshCw className="h-4 w-4" />
                Reenviar Documentos en Contingencia
              </Button>
              <Button
                className="w-full gap-2"
                variant="outline"
                onClick={() => window.open("/finance/sifen/health", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Probar Conexión DNIT
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Emitir DTE Dialog ────────────────── */}
      <Dialog open={emitirOpen} onOpenChange={setEmitirOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              Emitir DTE Electrónico
            </DialogTitle>
            <DialogDescription>
              Emití una factura electrónica SIFEN. Todos los campos son obligatorios.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 text-sm text-muted-foreground">
            <p>La emisión de DTE desde esta interfaz requiere integración con el módulo de Taller y Facturación.</p>
            <p>Usá el botón "Emitir Factura" desde la orden de trabajo correspondiente en la sección Taller.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmitirOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Nota de Crédito Dialog ──────────── */}
      <Dialog open={ncOpen} onOpenChange={(open) => { setNcOpen(open); if (!open) resetNcForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-orange-500" />
              Emitir Nota de Crédito
            </DialogTitle>
            <DialogDescription>
              Generá una nota de crédito electrónica para anular parcial o totalmente una factura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FormField label="CDC de Factura Original" htmlFor="sifen-nc-cdc" required>
              <div className="relative">
                <Input
                  id="sifen-nc-cdc"
                  value={ncForm.cdcOriginal}
                  onChange={(e) => setNcForm({ ...ncForm, cdcOriginal: e.target.value.toUpperCase() })}
                  placeholder="Código de Control de 44 caracteres"
                  maxLength={44}
                  minLength={44}
                  required
                  className="font-mono text-xs pr-16"
                />
                {ncForm.cdcOriginal.length === 44 && (
                  <Badge variant="success" className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px]">✓</Badge>
                )}
              </div>
              {ncForm.cdcOriginal.length > 0 && ncForm.cdcOriginal.length < 44 && (
                <p className="text-xs text-amber-500 mt-1">{ncForm.cdcOriginal.length}/44 caracteres</p>
              )}
            </FormField>
            <FormField label="Motivo" htmlFor="sifen-nc-motivo" required>
              <textarea
                id="sifen-nc-motivo"
                value={ncForm.motivo}
                onChange={(e) => setNcForm({ ...ncForm, motivo: e.target.value })}
                placeholder="Describí el motivo de la nota de crédito..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                required
              />
            </FormField>
            <FormField label="Monto (₲, opcional)" htmlFor="sifen-nc-monto"
              helperText="Si se omite, se replica el total del DTE original"
            >
              <Input
                id="sifen-nc-monto"
                type="number"
                min={0}
                value={ncForm.monto}
                onChange={(e) => setNcForm({ ...ncForm, monto: e.target.value })}
                placeholder="Dejar vacío para usar total original"
              />
            </FormField>
            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/5 p-3 rounded-lg border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Usá la página dedicada para funciones avanzadas como verificar CDC antes de emitir</span>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setNcOpen(false); resetNcForm(); }}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setNcOpen(false); router.push("/dashboard/contabilidad/nota-credito"); }}
            >
              Ir a NC Completa
            </Button>
            <Button
              onClick={() => emitirNcMut.mutate()}
              disabled={ncForm.cdcOriginal.length !== 44 || !ncForm.motivo || emitirNcMut.isPending}
              loading={emitirNcMut.isPending}
            >
              {emitirNcMut.isPending ? "Emitiendo..." : "Emitir NC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ToastContainer}
    </div>
  );
}
