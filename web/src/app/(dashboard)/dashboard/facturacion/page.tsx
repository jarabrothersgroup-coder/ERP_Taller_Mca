"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  Search,
  Filter,
  FileText,
  Download,
  Printer,
  Ban,
} from "lucide-react";
import { useInvoices, queryKeys } from "@/hooks/use-data";
import { NewInvoiceDialog } from "./new-invoice-dialog";
import { InvoiceStats } from "./stats";
import type { UIMappedInvoice } from "@/lib/data-service";

/* ── Status config ───────────────────────────── */

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "default" }> = {
  PENDIENTE: { label: "Pendiente", variant: "warning" },
  PAGADA: { label: "Pagada", variant: "success" },
  VENCIDA: { label: "Vencida", variant: "destructive" },
  ANULADA: { label: "Anulada", variant: "secondary" },
  APROBADO_DNIT: { label: "Aprobada DNIT", variant: "success" },
  MANUAL_CONVERT_QUEUE: { label: "Manual", variant: "default" },
};

const tipoLabels: Record<string, string> = {
  ELECTRONICA: "Electrónica",
  MANUAL: "Manual",
};

/* ── Columns ──────────────────────────────────── */

const baseColumns: Column<UIMappedInvoice>[] = [
  { header: "Factura", accessor: "numero", sortable: true, className: "font-mono text-xs" },
  {
    header: "Cliente",
    accessor: "cliente",
    sortable: true,
    cell: (_val, row) => (
      <div>
        <p className="font-medium">{row.cliente}</p>
        <p className="text-xs text-muted-foreground">OT {row.ordenId}</p>
      </div>
    ),
  },
  {
    header: "Tipo",
    accessor: "tipo",
    sortable: true,
    hideOnMobile: true,
    cell: (_val, row) => (
      <Badge variant={row.tipo === "ELECTRONICA" ? "default" : "secondary"} className="font-normal">
        {tipoLabels[row.tipo]}
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
    sortKey: "estado",
    cell: (_val, row) => {
      const config = statusConfig[row.estado] ?? { label: row.estado, variant: "default" as const };
      return <Badge variant={config.variant}>{config.label}</Badge>;
    },
  },
  { header: "Emisión", accessor: "fechaEmision", sortable: true, hideOnMobile: true, className: "text-xs text-muted-foreground" },
  { header: "Vencimiento", accessor: "fechaVencimiento", sortable: true, align: "right", className: "text-xs" },
  {
    header: "",
    accessor: "id",
    className: "w-10",
    cell: (_val, row) => (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        title="Imprimir factura"
        onClick={async (e) => {
          e.stopPropagation();
          try {
            const { api } = await import("@/lib/api");
            const result = await api.printInvoice(row.id);
            // Send raw ESC/POS to browser print (or WebSocket printer)
            const blob = new Blob([result.payload], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Factura-${row.numero || row.id.slice(0, 8)}.bin`;
            a.click();
            URL.revokeObjectURL(url);
          } catch (err) {
            console.error("Error printing invoice:", err);
          }
        }}
      >
        <Printer className="h-3.5 w-3.5" />
      </Button>
    ),
  },
];

/* ── Page ─────────────────────────────────────── */

export default function FacturacionPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState("Todos");
  const [estadoFilter, setEstadoFilter] = useState("Todos");
  const [showFilters, setShowFilters] = useState(false);

  const { data: allInvoices = [], isLoading } = useInvoices();

  // ── Anular factura (POST /finance/invoices/:id/void) ──
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();
  const [voidTarget, setVoidTarget] = useState<UIMappedInvoice | null>(null);
  const [voidMotivo, setVoidMotivo] = useState("");
  const [voidSifenOk, setVoidSifenOk] = useState(false);

  const voidMut = useMutation({
    mutationFn: () =>
      api.request<{ success: boolean }>(`/finance/invoices/${voidTarget!.id}/void`, {
        method: "POST",
        body: JSON.stringify({
          motivo: voidMotivo,
          ...(voidTarget?.tipo === "ELECTRONICA" ? { sifenAnulado: voidSifenOk } : {}),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.invoices });
      setVoidTarget(null);
      setVoidMotivo("");
      setVoidSifenOk(false);
      t.success("Factura anulada y reverso contable generado");
    },
    onError: (err: any) => t.error(err?.message || "No se pudo anular la factura"),
  });

  const columns: Column<UIMappedInvoice>[] = [
    ...baseColumns,
    {
      header: "",
      accessor: "id",
      className: "w-10",
      cell: (_val, row) => (
        /* GET /reports/factura/:id — PDF de factura (T-63 S126) */
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Descargar PDF"
          onClick={(e) => {
            e.stopPropagation();
            api.downloadFile(`/reports/factura/${row.id}`).then((blob) => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `factura-${row.numero || row.id.slice(0, 8)}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
            });
          }}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      ),
    },
    {
      header: "",
      accessor: "id",
      className: "w-10",
      cell: (_val, row) =>
        row.estado === "ANULADA" || row.estadoPago === "PAGADA" ? null : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-red-600"
            title="Anular factura"
            onClick={(e) => {
              e.stopPropagation();
              setVoidTarget(row);
              setVoidMotivo("");
              setVoidSifenOk(false);
            }}
          >
            <Ban className="h-3.5 w-3.5" />
          </Button>
        ),
    },
  ];

  const filtered = allInvoices.filter((inv) => {
    const matchSearch =
      inv.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.numero.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = tipoFilter === "Todos" || tipoLabels[inv.tipo] === tipoFilter;
    const matchEstado = estadoFilter === "Todos" || (statusConfig[inv.estado]?.label ?? inv.estado) === estadoFilter;
    return matchSearch && matchTipo && matchEstado;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-500" aria-hidden="true" />
            Facturación
          </h1>
          <p className="text-sm text-muted-foreground">Emisión de facturas manuales y electrónicas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Exportar
          </Button>
          <NewInvoiceDialog />
        </div>
      </div>

      <InvoiceStats invoices={allInvoices} />

      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium">Facturas Recientes</h3>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Buscar por cliente o número..."
                  className="pl-8 h-8 text-xs w-56"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Buscar facturas"
                />
              </div>
              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
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
              <div className="w-px bg-border" />
              {["Todos", ...Object.values(statusConfig).map((s) => s.label)].map((estado) => (
                <Badge
                  key={estado}
                  variant={estadoFilter === estado ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setEstadoFilter(estado)}
                >
                  {estado}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={filtered}
            rowKey="id"
            pageSize={10}
            emptyMessage="No se encontraron facturas con los filtros aplicados."
          />
        </div>
      </div>

      {/* ── Anular Factura Dialog ─────────────── */}
      <Dialog open={!!voidTarget} onOpenChange={(open) => { if (!open) { setVoidTarget(null); setVoidMotivo(""); setVoidSifenOk(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="h-5 w-5" />
              Anular Factura {voidTarget?.numero}
            </DialogTitle>
            <DialogDescription>
              Se generará el asiento de reversión contable. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Motivo *</label>
              <textarea
                value={voidMotivo}
                onChange={(e) => setVoidMotivo(e.target.value)}
                placeholder="Motivo de la anulación (máx. 500 caracteres)…"
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {voidTarget?.tipo === "ELECTRONICA" && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={voidSifenOk}
                  onChange={(e) => setVoidSifenOk(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <span>
                  Confirmo que este DTE ya fue anulado ante la DNIT/SIFEN (sif-03)
                </span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              loading={voidMut.isPending}
              disabled={!voidMotivo.trim() || (voidTarget?.tipo === "ELECTRONICA" && !voidSifenOk)}
              onClick={() => voidMut.mutate()}
            >
              Anular Factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ToastContainer}
    </div>
  );
}
