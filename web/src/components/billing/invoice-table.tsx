"use client";

import * as React from "react";
import { Download, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import type { BillingInvoice } from "@/hooks/use-billing";

export type { BillingInvoice } from "@/hooks/use-billing";

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary"; icon: React.ElementType }> = {
  paid: { label: "Pagada", variant: "success", icon: CheckCircle2 },
  pending: { label: "Pendiente", variant: "warning", icon: Clock },
  failed: { label: "Fallida", variant: "destructive", icon: XCircle },
  open: { label: "Abierta", variant: "secondary", icon: Clock },
};

const columns: Column<BillingInvoice>[] = [
  {
    header: "Factura",
    accessor: "stripeInvoiceId",
    cell: (val) => (
      <span className="font-mono text-xs">{val ? String(val).slice(0, 12) + "..." : "—"}</span>
    ),
  },
  {
    header: "Período",
    accessor: "periodLabel",
    cell: (val) => <span className="text-sm">{val ? String(val) : "—"}</span>,
  },
  {
    header: "Monto",
    accessor: "amountPyg",
    sortable: true,
    align: "right",
    cell: (val) => (
      <span className="tabular-nums font-medium">₲ {Number(val).toLocaleString("es-PY")}</span>
    ),
  },
  {
    header: "Estado",
    accessor: "status",
    sortable: true,
    cell: (val) => {
      const config = statusConfig[String(val)] || { label: String(val), variant: "secondary" as const, icon: Clock };
      return (
        <Badge variant={config.variant} className="gap-1">
          <config.icon className="h-3 w-3" aria-hidden="true" />
          {config.label}
        </Badge>
      );
    },
  },
  {
    header: "Pagada",
    accessor: "paidAt",
    cell: (val) => {
      if (!val) return <span className="text-xs text-muted-foreground">—</span>;
      return <span className="text-xs">{new Date(val as string).toLocaleDateString("es-PY")}</span>;
    },
  },
];

export function InvoiceTable({ invoices }: { invoices: BillingInvoice[] }) {
  return (
    <DataTable
      columns={columns}
      data={invoices}
      rowKey="id"
      pageSize={10}
      emptyMessage="No hay facturas de suscripción."
      actions={
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Exportar
        </Button>
      }
    />
  );
}
