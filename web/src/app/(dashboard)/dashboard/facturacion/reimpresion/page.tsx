"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Search,
  Filter,
  Printer,
  RotateCcw,
  History,
  FileText,
  X,
  Copy,
  Settings,
} from "lucide-react";
import Link from "next/link";

/* ── Types ────────────────────────────────────── */

interface InvoiceForReprint {
  id: string;
  numero: string;
  cliente: string;
  tipo: string;
  total: number;
  estado: string;
  fechaEmision: string;
  printCount: number;
}

interface PrintJob {
  id: string;
  protocolo: string;
  impresora: string;
  copias: number;
  estado: string;
  error: string | null;
  createdAt: string;
}

/* ── Status config ─────────────────────────────── */

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "default" }> = {
  PENDIENTE: { label: "Pendiente", variant: "warning" },
  PAGADA: { label: "Pagada", variant: "success" },
  VENCIDA: { label: "Vencida", variant: "destructive" },
  ANULADA: { label: "Anulada", variant: "secondary" },
};

const tipoLabels: Record<string, string> = {
  ELECTRONICA: "Electrónica",
  MANUAL: "Manual",
};

const protocolOptions = [
  { value: "ESCPOS", label: "ESC/POS", description: "Térmica 80/58mm" },
  { value: "PDF", label: "PDF", description: "HP LaserJet / CUPS" },
  { value: "PCL", label: "PCL5e", description: "HP LaserJet P1150" },
  { value: "ZPL", label: "ZPL", description: "Zebra" },
];

/* ── Page ──────────────────────────────────────── */

export default function ReimpresionPage() {
  const [invoices, setInvoices] = useState<InvoiceForReprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState("Todos");
  const [showFilters, setShowFilters] = useState(false);
  const [printHistory, setPrintHistory] = useState<PrintJob[] | null>(null);
  const [historyInvoiceId, setHistoryInvoiceId] = useState<string | null>(null);
  const [printing, setPrinting] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState("ESCPOS");
  const [copias, setCopias] = useState(1);
  const [showPrintDialog, setShowPrintDialog] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (tipoFilter !== "Todos") params.set("tipo", tipoFilter);
      const res = await fetch(`/api/label-printing/reimpresiones?${params}`);
      const data = await res.json();
      setInvoices(data.data || []);
    } catch (err) {
      console.error("Error fetching invoices:", err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, tipoFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleReprint = async (invoiceId: string, protocol: string = protocolo, numCopias: number = copias) => {
    setPrinting(invoiceId);
    try {
      const res = await fetch(`/api/label-printing/reimpresiones/${invoiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolo: protocol, copias: numCopias }),
      });
      const data = await res.json();
      // Download the print payload
      const blob = new Blob([data.payload], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Factura-${data.factura?.numero || invoiceId.slice(0, 8)}.${protocol === "PCL" ? "pcl" : protocol === "PDF" ? "html" : "bin"}`;
      a.click();
      URL.revokeObjectURL(url);
      // Refresh list to update print count
      fetchInvoices();
    } catch (err) {
      console.error("Error reprinting invoice:", err);
    } finally {
      setPrinting(null);
      setShowPrintDialog(null);
    }
  };

  const handleShowHistory = async (invoiceId: string) => {
    setHistoryInvoiceId(invoiceId);
    try {
      const res = await fetch(`/api/label-printing/reimpresiones/${invoiceId}`);
      const data = await res.json();
      setPrintHistory(data.printHistory || []);
    } catch (err) {
      console.error("Error fetching print history:", err);
      setPrintHistory([]);
    }
  };

  /* ── Columns ──────────────────────────────────── */

  const columns = [
    {
      header: "Factura",
      accessor: "numero" as const,
      sortable: true,
      className: "font-mono text-xs",
    },
    {
      header: "Cliente",
      accessor: "cliente" as const,
      sortable: true,
      cell: (val: unknown) => (
        <span className="font-medium">{(val as string) || "—"}</span>
      ),
    },
    {
      header: "Tipo",
      accessor: "tipo" as const,
      sortable: true,
      hideOnMobile: true,
      cell: (val: unknown) => (
        <Badge variant={val === "ELECTRONICA" ? "default" : "secondary"} className="font-normal">
          {tipoLabels[val as string] || (val as string)}
        </Badge>
      ),
    },
    {
      header: "Total",
      accessor: "total" as const,
      sortable: true,
      align: "right" as const,
      cell: (val: unknown) => (
        <span className="tabular-nums font-medium">₲ {Number(val).toLocaleString("es-PY")}</span>
      ),
    },
    {
      header: "Estado",
      accessor: "estado" as const,
      sortable: true,
      cell: (val: unknown) => {
        const s = val as string;
        const cfg = statusConfig[s] ?? { label: s, variant: "default" as const };
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      header: "Fecha",
      accessor: "fechaEmision" as const,
      sortable: true,
      hideOnMobile: true,
      className: "text-xs text-muted-foreground",
    },
    {
      header: "Impresiones",
      accessor: "printCount" as const,
      sortable: true,
      align: "center" as const,
      cell: (val: unknown) => (
        <Badge variant={(val as number) > 0 ? "default" : "outline"} className="text-xs">
          {val as number}x
        </Badge>
      ),
    },
    {
      header: "Acciones",
      accessor: "id" as const,
      className: "w-32",
      cell: (_val: unknown, row: InvoiceForReprint) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Reimprimir"
            disabled={printing === row.id}
            onClick={async (e) => {
              e.stopPropagation();
              setShowPrintDialog(row.id);
            }}
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Historial de impresión"
            onClick={async (e) => {
              e.stopPropagation();
              handleShowHistory(row.id);
            }}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/facturacion">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <RotateCcw className="h-6 w-6 text-blue-500" />
              Reimpresión de Facturas
            </h1>
            <p className="text-sm text-muted-foreground">
              Buscar y reimprimir facturas — ESC/POS, PDF, PCL5e (HP LaserJet P1150)
            </p>
          </div>
        </div>
      </div>

      {/* Global Print Settings */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Impresión rápida:</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Protocolo:</label>
              <select
                className="flex h-8 rounded-md border bg-background px-2 py-1 text-xs"
                value={protocolo}
                onChange={(e) => setProtocolo(e.target.value)}
              >
                {protocolOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.description}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Copias:</label>
              <Input
                type="number"
                min={1}
                max={99}
                value={copias}
                onChange={(e) => setCopias(parseInt(e.target.value) || 1)}
                className="h-8 w-16 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium">Facturas Emitidas</h3>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente o número..."
                  className="pl-8 h-8 text-xs w-56"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-3.5 w-3.5 mr-1" />
                Filtros
              </Button>
            </div>
          </div>
          {showFilters && (
            <div className="flex gap-2 pt-2 flex-wrap">
              {[{ value: "Todos", label: "Todos" }, { value: "ELECTRONICA", label: "Electrónica" }, { value: "MANUAL", label: "Manual" }].map(({ value, label }) => (
                <Badge
                  key={value}
                  variant={tipoFilter === value ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setTipoFilter(value)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="p-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No se encontraron facturas para reimprimir</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {columns.map((col) => (
                      <th
                        key={col.accessor}
                        className={`text-left p-2 text-xs font-medium text-muted-foreground ${col.className || ""} ${col.align === "right" ? "text-right" : ""} ${col.align === "center" ? "text-center" : ""}`}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b hover:bg-muted/50">
                      {columns.map((col) => (
                        <td
                          key={col.accessor}
                          className={`p-2 ${col.className || ""} ${col.align === "right" ? "text-right" : ""} ${col.align === "center" ? "text-center" : ""}`}
                        >
                          {col.cell
                            ? col.cell(inv[col.accessor], inv)
                            : String(inv[col.accessor] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Print Dialog Modal */}
      {showPrintDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Configurar Reimpresión
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowPrintDialog(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Protocolo de Impresión</label>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm mt-1"
                  value={protocolo}
                  onChange={(e) => setProtocolo(e.target.value)}
                >
                  {protocolOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — {opt.description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Número de Copias</label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={copias}
                  onChange={(e) => setCopias(parseInt(e.target.value) || 1)}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowPrintDialog(null)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => handleReprint(showPrintDialog, protocolo, copias)}
                  disabled={printing === showPrintDialog}
                >
                  {printing === showPrintDialog ? (
                    "Imprimiendo..."
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Reimprimir {copias > 1 ? `(${copias} copias)` : ""}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Print History Modal */}
      {historyInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Historial de Impresión
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => {
                  setHistoryInvoiceId(null);
                  setPrintHistory(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="overflow-auto flex-1">
              {printHistory === null ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Cargando...
                </div>
              ) : printHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Sin registros de impresión
                </div>
              ) : (
                <div className="space-y-2">
                  {printHistory.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {job.protocolo} — {job.impresora || "default"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(job.createdAt).toLocaleString("es-PY")} · {job.copias} copia{job.copias > 1 ? "s" : ""}
                        </div>
                      </div>
                      <Badge variant={job.estado === "COMPLETADO" ? "success" : job.estado === "ERROR" ? "destructive" : "default"}>
                        {job.estado}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <div className="p-4 border-t">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  setShowPrintDialog(historyInvoiceId);
                  setHistoryInvoiceId(null);
                }}
              >
                <Printer className="h-4 w-4" />
                Reimprimir Ahora
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
