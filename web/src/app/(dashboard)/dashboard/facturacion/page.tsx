"use client";

import * as React from "react";
import {
  Plus,
  DollarSign,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { fetchInvoices, type UIMappedInvoice } from "@/lib/data-service";

/* ── Types ──────────────────────────────────── */

type InvoiceStatus = "PENDIENTE" | "PAGADA" | "VENCIDA" | "ANULADA" | "APROBADO_DNIT" | "MANUAL_CONVERT_QUEUE";
type InvoiceType = "MANUAL" | "ELECTRONICA";

interface InvoiceRecord {
  id: string;
  numero: string;
  cliente: string;
  ordenId: string;
  tipo: InvoiceType;
  total: number;
  estado: InvoiceStatus;
  estadoPago: string;
  fechaEmision: string;
  fechaVencimiento: string;
  sifenStatus: string;
}

/* ── Mock Data Factory ──────────────────────── */

const clients = [
  "María González", "Pedro López", "Juan Pérez", "Lucía Fernández",
  "Carlos Ruiz", "Ana Martínez", "Roberto Sánchez", "Laura Gómez",
  "Sofía Medina", "Diego Acosta",
];

function getMockInvoices(): InvoiceRecord[] {
  return Array.from({ length: 32 }, (_, i) => {
    const statuses: InvoiceStatus[] = [
      "PENDIENTE", "PAGADA", "VENCIDA", "APROBADO_DNIT",
      "MANUAL_CONVERT_QUEUE", "PENDIENTE", "PAGADA", "ANULADA",
    ];
    const types: InvoiceType[] = ["ELECTRONICA", "MANUAL", "ELECTRONICA", "ELECTRONICA"];
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dueDate = new Date(date);
    dueDate.setDate(dueDate.getDate() + 30);

    const totalAmount = [450000, 850000, 1250000, 320000, 2100000, 560000, 980000, 1750000][i % 8];

    return {
      id: `FAC-${String(100 + i).padStart(4, "0")}`,
      numero: `001-001-${String(1000000 + i).slice(0, 7)}`,
      cliente: clients[i % clients.length],
      ordenId: `OT-${String(100 + i).padStart(3, "0")}`,
      tipo: types[i % types.length],
      total: totalAmount,
      estado: statuses[i % statuses.length],
      estadoPago: statuses[i % statuses.length] === "PAGADA" ? "PAGADA" : "PENDIENTE",
      fechaEmision: date.toLocaleDateString("es-PY"),
      fechaVencimiento: dueDate.toLocaleDateString("es-PY"),
      sifenStatus: statuses[i % statuses.length],
    };
  });
}

/* ── Status Config ──────────────────────────── */

const statusConfig: Record<InvoiceStatus, {
  label: string;
  variant: "success" | "warning" | "destructive" | "secondary" | "default";
  icon: React.ElementType;
}> = {
  PENDIENTE: { label: "Pendiente", variant: "warning", icon: Clock },
  PAGADA: { label: "Pagada", variant: "success", icon: CheckCircle2 },
  VENCIDA: { label: "Vencida", variant: "destructive", icon: AlertTriangle },
  ANULADA: { label: "Anulada", variant: "secondary", icon: XCircle },
  APROBADO_DNIT: { label: "Aprobada DNIT", variant: "success", icon: CheckCircle2 },
  MANUAL_CONVERT_QUEUE: { label: "Manual", variant: "default", icon: FileText },
};

const tipoColors: Record<InvoiceType, "secondary" | "default"> = {
  ELECTRONICA: "default",
  MANUAL: "secondary",
};

const tipoLabels: Record<InvoiceType, string> = {
  ELECTRONICA: "Electrónica",
  MANUAL: "Manual",
};

/* ── Stats Cards ────────────────────────────── */

function InvoiceStats({ invoices }: { invoices: InvoiceRecord[] }) {
  const totalEmitidas = invoices.length;
  const totalPendiente = invoices
    .filter((i) => i.estadoPago === "PENDIENTE" && i.estado !== "ANULADA")
    .reduce((sum, i) => sum + i.total, 0);
  const vencidas = invoices.filter((i) => i.estado === "VENCIDA").length;
  const emitidasEsteMes = invoices.filter((i) => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const invDate = new Date(i.fechaEmision.split("/").reverse().join("-"));
    return invDate >= monthStart;
  }).length;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Facturas Emitidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{totalEmitidas}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {emitidasEsteMes} este mes
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Por Cobrar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">₲ {(totalPendiente / 1_000_000).toFixed(1)}M</p>
        </CardContent>
      </Card>
      <Card className={cn(vencidas > 0 && "border-destructive/30")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
            Vencidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", vencidas > 0 && "text-destructive")}>
            {vencidas}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Electrónicas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold">
              {invoices.filter((i) => i.tipo === "ELECTRONICA").length}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Columns ────────────────────────────────── */

const columns: Column<InvoiceRecord>[] = [
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
    cell: (_, row) => (
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
    cell: (_, row) => (
      <Badge variant={tipoColors[row.tipo]} className="font-normal">
        {tipoLabels[row.tipo]}
      </Badge>
    ),
  },
  {
    header: "Total",
    accessor: "total",
    sortable: true,
    align: "right",
    cell: (value) => (
      <span className="tabular-nums font-medium">
        ₲ {Number(value).toLocaleString("es-PY")}
      </span>
    ),
  },
  {
    header: "Estado",
    accessor: "estado",
    sortable: true,
    sortKey: "estado",
    cell: (_, row) => {
      const config = statusConfig[row.estado];
      return (
        <Badge variant={config.variant} className="gap-1">
          <config.icon className="h-3 w-3" aria-hidden="true" />
          {config.label}
        </Badge>
      );
    },
  },
  {
    header: "Emisión",
    accessor: "fechaEmision",
    sortable: true,
    hideOnMobile: true,
    className: "text-xs text-muted-foreground",
  },
  {
    header: "Vencimiento",
    accessor: "fechaVencimiento",
    sortable: true,
    align: "right",
    className: "text-xs",
    cell: (_, row) => {
      const isOverdue = row.estado === "VENCIDA";
      return (
        <span className={cn(isOverdue && "text-destructive font-medium")}>
          {row.fechaVencimiento}
        </span>
      );
    },
  },
];

/* ── Main Page ──────────────────────────────── */

export default function InvoicePage() {
  const [loading, setLoading] = React.useState(true);
  const [invoices, setInvoices] = React.useState<InvoiceRecord[]>([]);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("");

  // Fetch from API with mock fallback
  React.useEffect(() => {
    let cancelled = false;
    fetchInvoices(getMockInvoices as unknown as () => UIMappedInvoice[]).then((data) => {
      if (!cancelled) {
        setInvoices(data as unknown as InvoiceRecord[]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Filter data
  const filtered = React.useMemo(() => {
    let result = invoices;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.cliente.toLowerCase().includes(q) ||
          inv.numero.toLowerCase().includes(q) ||
          inv.ordenId.toLowerCase().includes(q)
      );
    }
    if (typeFilter) {
      result = result.filter((inv) => inv.tipo === typeFilter);
    }
    return result;
  }, [invoices, search, typeFilter]);

  // Get overdue count
  const overdueInvoices = invoices.filter((i) => i.estado === "VENCIDA");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturación</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de facturas electrónicas y manuales — SIFEN
          </p>
        </div>

        {/* ⭐ PRIMARY CTA */}
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nueva Factura
        </Button>
      </div>

      {/* ── Overdue Alerts ──────────────────── */}
      {overdueInvoices.length > 0 && !loading && (
        <Alert variant="error">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Facturas vencidas</AlertTitle>
          <AlertDescription>
            {overdueInvoices.length} factura{overdueInvoices.length !== 1 ? "s" : ""} con pago vencido.
            Total pendiente: ₲{" "}
            {overdueInvoices
              .reduce((sum, i) => sum + i.total, 0)
              .toLocaleString("es-PY")}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Stats ──────────────────────────── */}
      {!loading && <InvoiceStats invoices={filtered} />}

      {/* ── Type filter tabs ────────────────── */}
      {!loading && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por tipo">
          <Button
            variant={typeFilter === "" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTypeFilter("")}
            role="tab"
            aria-selected={typeFilter === ""}
          >
            Todas
          </Button>
          <Button
            variant={typeFilter === "ELECTRONICA" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTypeFilter("ELECTRONICA")}
            role="tab"
            aria-selected={typeFilter === "ELECTRONICA"}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Electrónicas
          </Button>
          <Button
            variant={typeFilter === "MANUAL" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTypeFilter("MANUAL")}
            role="tab"
            aria-selected={typeFilter === "MANUAL"}
          >
            <FileText className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Manuales
          </Button>
        </div>
      )}

      {/* ── Data Table ───────────────────────── */}
      <DataTable<InvoiceRecord>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={
          search || typeFilter
            ? "No se encontraron facturas con esos filtros"
            : "No hay facturas registradas. Emita su primera factura para comenzar."
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar factura, cliente u OT…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
        onRowClick={(row) => {
          console.log("Open invoice:", row.id);
        }}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Exportar
            </Button>
          </>
        }
      />
    </div>
  );
}
