"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  ArrowLeft,
  Search,
  Filter,
  Printer,
  RotateCcw,
  History,
  FileText,
  X,
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

  const handleReprint = async (invoiceId: string) => {
    setPrinting(invoiceId);
    try {
      const res = await fetch(`/api/label-printing/reimpresiones/${invoiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolo: "ESCPOS", copias: 1 }),
      });
      const data = await res.json();
      // Download the print payload
      const blob = new Blob([data.payload], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Factura-${data.factura?.numero || invoiceId.slice(0, 8)}.bin`;
      a.click();
      URL.revokeObjectURL(url);
      // Refresh list to update print count
      fetchInvoices();
    } catch (err) {
      console.error("Error reprinting invoice:", err);
    } finally {
      setPrinting(null);
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

  const columns: Column<InvoiceForReprint>[] = [
    {
      header: "Factura",
      accessor: "numero",
      sortable: true,
      className: "font-mono text-xs",
    },
    {
      header: "Cliente",
      accessor: "cliente",
      sortable: true,
      cell: (val: unknown) => (
        <span className="font-medium">{(val as string) || "—"}</span>
      ),
    },
    {
      header: "Tipo",
      accessor: "tipo",
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
      accessor: "total",
      sortable: true,
      align: "right",
      cell: (val) => (
        <span className="tabular-nums font-medium">₲ {Number(val).toLocaleString("es-PY")}</span>
      ),
    },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      cell: (val: unknown) => {
        const s = val as string;
        const cfg = statusConfig[s] ?? { label: s, variant: "default" as const };
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      header: "Fecha",
      accessor: "fechaEmision",
      sortable: true,
      hideOnMobile: true,
      className: "text-xs text-muted-foreground",
    },
    {
      header: "Impresiones",
      accessor: "printCount",
      sortable: true,
      align: "center",
      cell: (val: unknown) => (
        <Badge variant={(val as number) > 0 ? "default" : "outline"} className="text-xs">
          {val as number}x
        </Badge>
      ),
    },
    {
      header: "Acciones",
      accessor: "id",
      className: "w-24",
      cell: (_val, row) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Reimprimir"
            disabled={printing === row.id}
            onClick={async (e) => {
              e.stopPropagation();
              handleReprint(row.id);
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
              Buscar y reimprimir facturas emitidas
            </p>
          </div>
        </div>
      </div>

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
              {["Todos", "Electrónica", "Manual"].map((tipo) => (
                <Badge
                  key={tipo}
                  variant={tipoFilter === tipo ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setTipoFilter(tipo)}
                >
                  {tipo}
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
            <DataTable
              columns={columns}
              data={invoices}
              rowKey="id"
              pageSize={10}
              emptyMessage="No se encontraron facturas."
            />
          )}
        </div>
      </div>

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
                onClick={() => handleReprint(historyInvoiceId)}
                disabled={printing === historyInvoiceId}
              >
                <Printer className="h-4 w-4" />
                {printing === historyInvoiceId ? "Imprimiendo..." : "Reimprimir Ahora"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
