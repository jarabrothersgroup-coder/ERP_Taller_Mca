"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Plus,
  Copy,
  Search,
  FileText,
  Receipt,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

/* ── Types ──────────────────────────────────── */

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
  xmlOriginal?: string;
  xmlFirmado?: string;
}

interface EmitResult {
  success: boolean;
  notaDocumentoId?: string;
  cdcNota?: string;
  error?: string;
  message?: string;
}

/* ── Helpers ────────────────────────────────── */

const ESTADO_COLORS: Record<string, string> = {
  BORRADOR: "bg-gray-100 text-gray-700 border-gray-300",
  FIRMADO: "bg-blue-100 text-blue-700 border-blue-300",
  ENVIADO: "bg-amber-100 text-amber-700 border-amber-300",
  APROBADO: "bg-green-100 text-green-700 border-green-300",
  RECHAZADO: "bg-red-100 text-red-700 border-red-300",
  ANULADO: "bg-purple-100 text-purple-700 border-purple-300",
};

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for non-HTTPS or older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

function formatGuarani(amount: string | number): string {
  return `₲ ${Number(amount).toLocaleString("es-PY")}`;
}

/* ── Main Page ──────────────────────────────── */

export default function NotaCreditoPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { toast: t, ToastContainer } = useToast();
  const [activeTab, setActiveTab] = React.useState<"emitir" | "historial">("emitir");

  // ── Emit form state ──
  const [cdcOriginal, setCdcOriginal] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const [monto, setMonto] = React.useState("");
  const [result, setResult] = React.useState<EmitResult | null>(null);

  // ── History state ──
  const [estadoFilter, setEstadoFilter] = React.useState("");
  const [cdcSearch, setCdcSearch] = React.useState("");

  // ── Detail dialog ──
  const [detailDoc, setDetailDoc] = React.useState<FiscalDocument | null>(null);

  // ── Emit mutation ──
  const emitNC = useMutation({
    mutationFn: async () => {
      const res = await api.request<EmitResult>("/finance/sifen/nota-credito", {
        method: "POST",
        body: JSON.stringify({
          cdcOriginal,
          motivo,
          monto: monto ? Number(monto) : undefined,
        }),
      });
      return res;
    },
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["sifen", "notas-credito"] });
      qc.invalidateQueries({ queryKey: ["sifen-documentos"] });
      if (data.success) {
        t.success("Nota de crédito emitida exitosamente");
      }
    },
    onError: (err: Error) => {
      setResult({ success: false, error: err.message });
      t.error(err.message || "Error al emitir NC");
    },
  });

  // ── Fetch credit notes history ──
  const { data: ncData, isLoading: ncLoading } = useQuery<{ items: FiscalDocument[]; total: number }>({
    queryKey: ["sifen", "notas-credito", estadoFilter],
    queryFn: () =>
      api.request<{ items: FiscalDocument[]; total: number }>(
        `/finance/sifen/documentos?dteTipo=NOTA_CREDITO${estadoFilter ? `&estado=${estadoFilter}` : ""}&limit=50`
      ),
    refetchInterval: activeTab === "historial" ? 30000 : false,
  });

  const creditNotes = ncData?.items || [];

  // ── Fetch original invoice lookup (SIFEN SOAP consulta) ──
  const [lookupResult, setLookupResult] = React.useState<{ text: string; isError: boolean } | null>(null);
  const lookupInvoice = useMutation({
    mutationFn: async (cdc: string) => {
      return api.request<{
        codigoResultado: string;
        cdc: string | null;
        numeroTransaccion: string | null;
        mensajeError: string | null;
      }>(`/finance/sifen/consultar?cdc=${cdc}`);
    },
    onSuccess: (data) => {
      if (data.cdc) {
        setLookupResult({ text: `✓ Factura verificada — CDC: ${data.cdc}`, isError: false });
      } else {
        setLookupResult({ text: data.mensajeError || "Factura no encontrada en DNIT", isError: true });
      }
    },
    onError: (err: Error) => {
      setLookupResult({ text: err.message || "Error al consultar CDC", isError: true });
    },
  });

  const resetForm = () => {
    setCdcOriginal("");
    setMotivo("");
    setMonto("");
    setResult(null);
  };

  // ── Table columns ──
  const columns: Column<FiscalDocument>[] = [
    {
      header: "Número",
      accessor: "serie",
      cell: (_, row) => (
        <span className="font-mono text-sm font-medium">{row.serie}-{row.numero}</span>
      ),
    },
    {
      header: "CDC",
      accessor: "cdc",
      cell: (_, row) => (
        <div className="flex items-center gap-1.5 max-w-[160px]">
          <span className="text-[10px] font-mono text-muted-foreground truncate block">
            {row.cdc || "—"}
          </span>
          {row.cdc && (
            <button
              onClick={() => { copyToClipboard(row.cdc!); t.success("CDC copiado"); }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title="Copiar CDC"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
      ),
    },
    {
      header: "Cliente",
      accessor: "receptorRazonSocial",
      cell: (_, row) => (
        <span className="text-sm truncate max-w-[120px] block">{row.receptorRazonSocial}</span>
      ),
    },
    {
      header: "Total",
      accessor: "totalDocumento",
      align: "right",
      cell: (_, row) => (
        <span className="font-medium text-sm">{formatGuarani(row.totalDocumento)}</span>
      ),
    },
    {
      header: "Estado",
      accessor: "estado",
      cell: (_, row) => (
        <Badge className={cn("text-xs border", ESTADO_COLORS[row.estado] || "")}>
          {row.estado}
        </Badge>
      ),
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
    {
      header: "",
      accessor: "id",
      cell: (_, row) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setDetailDoc(row)}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Detalle
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/finance/sifen")} className="h-7 text-xs gap-1">
              <ArrowLeft className="h-3 w-3" />
              SIFEN
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-orange-500" />
            Notas de Crédito Electrónicas
          </h1>
          <p className="text-sm text-muted-foreground">
            Emisión y gestión de notas de crédito SIFEN con reversión contable automática
          </p>
        </div>
        <Badge variant="outline" className="text-xs gap-1.5">
          <FileText className="h-3 w-3" />
          SIFEN V150
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" role="tablist">
        <button
          onClick={() => setActiveTab("emitir")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5",
            activeTab === "emitir"
              ? "border-orange-500 text-orange-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          role="tab"
          aria-selected={activeTab === "emitir"}
        >
          <Plus className="h-4 w-4" />
          Emitir NC
        </button>
        <button
          onClick={() => setActiveTab("historial")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5",
            activeTab === "historial"
              ? "border-orange-500 text-orange-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          role="tab"
          aria-selected={activeTab === "historial"}
        >
          <History className="h-4 w-4" />
          Historial ({creditNotes.length})
        </button>
      </div>

      {/* ════════════════════════════════════════ */}
      {/* TAB: Emitir NC */}
      {/* ════════════════════════════════════════ */}
      {activeTab === "emitir" && (
        <>
          {/* Result card */}
          {result && (
            <Card className={result.success ? "border-emerald-500/50" : "border-destructive/50"}>
              <CardContent className="flex items-start gap-4 py-4">
                {result.success ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">
                    {result.success ? "NC Emitida Exitosamente" : "Error al emitir NC"}
                  </p>
                  {result.success ? (
                    <div className="mt-2 text-sm text-muted-foreground space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Documento ID:</span>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{result.notaDocumentoId}</code>
                        <button
                          onClick={() => { copyToClipboard(result.notaDocumentoId!); t.success("ID copiado"); }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      {result.cdcNota && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">CDC:</span>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{result.cdcNota}</code>
                          <button
                            onClick={() => { copyToClipboard(result.cdcNota!); t.success("CDC copiado"); }}
                            className="text-muted-foreground hover:text-foreground shrink-0"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      {result.message && (
                        <p className="text-xs text-emerald-600">{result.message}</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-destructive">{result.error}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    {result.success && (
                      <Button variant="outline" size="sm" onClick={() => setActiveTab("historial")}>
                        <History className="h-3.5 w-3.5 mr-1" />
                        Ver Historial
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={resetForm}>
                      {result.success ? "Emitir Otra NC" : "Reintentar"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Emit form */}
          {!result && (
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2.5 border bg-red-500/10 text-red-500 border-red-500/20">
                      <Receipt className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Datos de la Nota de Crédito</CardTitle>
                      <CardDescription>
                        Ingrese el CDC del DTE original a notar y el motivo de la NC
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!cdcOriginal || cdcOriginal.length !== 44) {
                        t.error("El CDC debe tener exactamente 44 caracteres");
                        return;
                      }
                      if (!motivo.trim()) {
                        t.error("Debe ingresar un motivo para la NC");
                        return;
                      }
                      emitNC.mutate();
                    }}
                    className="space-y-5"
                  >
                    <FormField
                      label="CDC del DTE Original"
                      htmlFor="cdc"
                      required
                      helperText="Código de Control de 44 dígitos del documento a notar"
                    >
                      <div className="relative">
                        <Input
                          id="cdc"
                          placeholder="00000000000000000000000000000000000000000000"
                          value={cdcOriginal}
                          onChange={(e) => setCdcOriginal(e.target.value.toUpperCase())}
                          required
                          minLength={44}
                          maxLength={44}
                          className="font-mono text-sm pr-20"
                        />
                        {cdcOriginal.length === 44 && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <Badge variant="success" className="text-[10px]">✓ Válido</Badge>
                          </div>
                        )}
                      </div>
                      {cdcOriginal.length > 0 && cdcOriginal.length < 44 && (
                        <p className="text-xs text-amber-500 mt-1">
                          {cdcOriginal.length}/44 caracteres
                        </p>
                      )}
                    </FormField>

                    {/* Optional: verify CDC */}
                    {cdcOriginal.length === 44 && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1 h-7"
                          onClick={() => {
                            setLookupResult(null);
                            lookupInvoice.mutate(cdcOriginal);
                          }}
                          loading={lookupInvoice.isPending}
                        >
                          <Search className="h-3 w-3" />
                          Verificar CDC
                        </Button>
                        {lookupInvoice.isPending && (
                          <span className="text-xs text-muted-foreground animate-pulse">Consultando DNIT...</span>
                        )}
                        {lookupResult && !lookupInvoice.isPending && (
                          <span className={cn(
                            "text-xs",
                            lookupResult.isError ? "text-amber-600" : "text-green-600"
                          )}>
                            {lookupResult.text}
                          </span>
                        )}
                      </div>
                    )}

                    <FormField label="Motivo de la NC" htmlFor="motivo" required>
                      <Textarea
                        id="motivo"
                        placeholder="Ej: Anulación por error en facturación, descuento otorgado, devolución de mercadería..."
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        required
                        rows={3}
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground mt-1 text-right">{motivo.length}/500</p>
                    </FormField>

                    <FormField
                      label="Monto (opcional)"
                      htmlFor="monto"
                      helperText="Si se omite, se replica el total del DTE original. Para NC parciales, especifique el monto."
                    >
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₲</span>
                        <Input
                          id="monto"
                          type="number"
                          min={0}
                          placeholder="Dejar vacío para usar el total original"
                          value={monto}
                          onChange={(e) => setMonto(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </FormField>

                    <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                          Acción irreversible
                        </p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
                          La nota de crédito generará un asiento contable de reversión y se enviará a DNIT.
                          Esta operación no se puede deshacer.
                        </p>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full gap-2"
                      disabled={cdcOriginal.length !== 44 || !motivo.trim() || emitNC.isPending}
                      loading={emitNC.isPending}
                    >
                      {emitNC.isPending ? "Emitiendo NC..." : "Emitir Nota de Crédito"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Sidebar info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Información
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">¿Qué es una NC?</p>
                    <p className="text-xs text-muted-foreground">
                      Una Nota de Crédito electrónica anula total o parcialmente un DTE (factura) ya emitido.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Casos de uso</p>
                    <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                      <li>Error en el monto facturado</li>
                      <li>Devolución de mercadería</li>
                      <li>Descuento otorgado post-facturación</li>
                      <li>Anulación de la operación</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      La NC se envía automáticamente a DNIT y genera un asiento contable de reversión.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════ */}
      {/* TAB: Historial */}
      {/* ════════════════════════════════════════ */}
      {activeTab === "historial" && (
        <div className="space-y-4">
          {/* Stats */}
          {creditNotes.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Total NC Emitidas</p>
                    <Receipt className="h-4 w-4 text-orange-500" />
                  </div>
                  <p className="text-2xl font-bold mt-1">{ncData?.total || creditNotes.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Aprobadas</p>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-2xl font-bold mt-1 text-green-600">
                    {creditNotes.filter((n) => n.estado === "APROBADO").length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Pendientes/Rechazadas</p>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="text-2xl font-bold mt-1 text-amber-600">
                    {creditNotes.filter((n) => n.estado !== "APROBADO" && n.estado !== "ANULADO").length}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* CDC search */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por CDC..."
                value={cdcSearch}
                onChange={(e) => setCdcSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["sifen", "notas-credito"] })}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refrescar
            </Button>
          </div>

          {/* Estado filter */}
          <div className="flex flex-wrap gap-2" role="tablist">
            {["", "BORRADOR", "FIRMADO", "ENVIADO", "APROBADO", "RECHAZADO", "ANULADO"].map((est) => (
              <Button
                key={est}
                variant={estadoFilter === est ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setEstadoFilter(est)}
                role="tab"
                aria-selected={estadoFilter === est}
              >
                {est || "Todas"}
              </Button>
            ))}
          </div>

          {/* Data table */}
          <DataTable<FiscalDocument>
            columns={columns}
            data={cdcSearch ? creditNotes.filter((n) => n.cdc?.includes(cdcSearch.toUpperCase())) : creditNotes}
            rowKey="id"
            loading={ncLoading}
            emptyMessage="No se encontraron notas de crédito emitidas"
            paginate
            pageSize={10}
            sortable
            className="shadow-sm"
          />

          {/* ── Detail Dialog ──────────────────── */}
          <Dialog open={!!detailDoc} onOpenChange={(open) => !open && setDetailDoc(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-orange-500" />
                  Detalle de NC — {detailDoc?.serie}-{detailDoc?.numero}
                </DialogTitle>
                <DialogDescription>
                  Información detallada de la nota de crédito
                </DialogDescription>
              </DialogHeader>
              {detailDoc && (
                <div className="space-y-3 py-2">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="font-medium">{detailDoc.dteTipo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Estado</p>
                      <Badge className={cn("text-xs mt-0.5", ESTADO_COLORS[detailDoc.estado])}>{detailDoc.estado}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Número</p>
                      <p className="font-mono text-sm">{detailDoc.serie}-{detailDoc.numero}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-medium">{formatGuarani(detailDoc.totalDocumento)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Cliente</p>
                      <p className="font-medium">{detailDoc.receptorRazonSocial}</p>
                    </div>
                    {detailDoc.cdc && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">CDC</p>
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{detailDoc.cdc}</code>
                          <button
                            onClick={() => { copyToClipboard(detailDoc.cdc!); t.success("CDC copiado"); }}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Condición</p>
                      <p className="text-sm">{detailDoc.condicionVenta || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Moneda</p>
                      <p className="text-sm">{detailDoc.moneda || "PYG"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Fecha Emisión</p>
                      <p className="text-sm">
                        {detailDoc.fechaEmision
                          ? new Date(detailDoc.fechaEmision).toLocaleString("es-PY")
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailDoc(null)}>Cerrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {ToastContainer}
    </div>
  );
}
