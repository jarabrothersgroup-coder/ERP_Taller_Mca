import {
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import type { UIMappedBankAccount, UIMappedMovement } from "@/lib/data-service";

/* ── Types ──────────────────────────────────── */

export type Tab = "cuentas" | "movimientos" | "cxc";

export interface CUentaRecord extends UIMappedBankAccount {
  // Extended with UI-only fields
}

export interface MovimientoRecord extends UIMappedMovement {
  tipoLabel?: string;
  tipoIcon?: React.ElementType;
}

export interface CxcRecord {
  id: string;
  cliente: string;
  factura: string;
  total: number;
  saldo: number;
  vencimiento: string;
  diasVencido: number;
}

/* ── Movement Config ────────────────────────── */

export const iconosMovimiento: Record<string, React.ElementType> = {
  INGRESO: ArrowUpRight,
  EGRESO: ArrowDownLeft,
  TRANSFERENCIA: ArrowLeftRight,
};

export const coloresMovimiento: Record<string, string> = {
  INGRESO: "text-emerald-600 dark:text-emerald-400",
  EGRESO: "text-red-600 dark:text-red-400",
  TRANSFERENCIA: "text-blue-600 dark:text-blue-400",
};

export const badgeMovimiento: Record<string, "success" | "destructive" | "secondary"> = {
  INGRESO: "success",
  EGRESO: "destructive",
  TRANSFERENCIA: "secondary",
};

/* ── Columns: Cuentas ───────────────────────── */

export const cuentasColumns: Column<CUentaRecord>[] = [
  {
    header: "Código",
    accessor: "codigo",
    sortable: true,
    className: "font-mono text-xs",
  },
  {
    header: "Cuenta",
    accessor: "nombre",
    sortable: true,
    cell: (_, row) => (
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md",
          row.tipo === "CAJA" ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
        )}>
          <Building2 className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="font-medium">{row.nombre}</p>
          <p className="text-xs text-muted-foreground">{row.tipo}</p>
        </div>
      </div>
    ),
  },
  {
    header: "Moneda",
    accessor: "moneda",
    sortable: true,
    hideOnMobile: true,
    cell: (value) => (
      <Badge variant="secondary" className="font-mono text-xs">
        {value as string}
      </Badge>
    ),
  },
  {
    header: "Saldo Actual",
    accessor: "saldoActual",
    sortable: true,
    align: "right",
    cell: (value, row) => (
      <span className={cn(
        "tabular-nums font-medium",
        row.moneda === "USD" && "text-xs"
      )}>
        {row.moneda === "USD" ? "$" : "₲"} {Number(value).toLocaleString("es-PY")}
      </span>
    ),
  },
  {
    header: "Estado",
    accessor: "activo",
    sortable: true,
    cell: (_, row) => (
      <Badge variant={row.activo ? "success" : "secondary"}>
        {row.activo ? "Activa" : "Inactiva"}
      </Badge>
    ),
  },
];

/* ── Columns: Movimientos ───────────────────── */

export const movimientosColumns: Column<MovimientoRecord>[] = [
  {
    header: "Tipo",
    accessor: "tipo",
    sortable: true,
    cell: (_, row) => {
      const Icon = iconosMovimiento[row.tipo];
      return (
        <Badge variant={badgeMovimiento[row.tipo]} className="gap-1">
          <Icon className="h-3 w-3" aria-hidden="true" />
          {row.tipo === "INGRESO" ? "Ingreso" : row.tipo === "EGRESO" ? "Egreso" : "Transf."}
        </Badge>
      );
    },
  },
  {
    header: "Fecha",
    accessor: "fecha",
    sortable: true,
    className: "text-xs",
  },
  {
    header: "Concepto",
    accessor: "concepto",
    sortable: true,
    cell: (_, row) => (
      <div>
        <p className="font-medium">{row.concepto}</p>
        <p className="text-xs text-muted-foreground">{row.cuentaNombre}</p>
      </div>
    ),
  },
  {
    header: "Monto",
    accessor: "monto",
    sortable: true,
    align: "right",
    cell: (value, row) => (
      <span className={cn(
        "tabular-nums font-medium",
        coloresMovimiento[row.tipo]
      )}>
        {row.tipo === "INGRESO" ? "+" : row.tipo === "EGRESO" ? "-" : "⟷"} ₲{Number(value).toLocaleString("es-PY")}
      </span>
    ),
  },
  {
    header: "Medio",
    accessor: "medioPago",
    sortable: true,
    hideOnMobile: true,
    cell: (value) => (
      <span className="text-xs text-muted-foreground">
        {(value as string).replace(/_/g, " ")}
      </span>
    ),
  },
  {
    header: "Conciliado",
    accessor: "conciliado",
    sortable: true,
    cell: (_, row) => (
      row.conciliado ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )
    ),
  },
];

/* ── Columns: CxC ───────────────────────────── */

export const cxcColumns: Column<CxcRecord>[] = [
  {
    header: "Cliente",
    accessor: "cliente",
    sortable: true,
  },
  {
    header: "Factura",
    accessor: "factura",
    sortable: true,
    className: "font-mono text-xs",
  },
  {
    header: "Total",
    accessor: "total",
    sortable: true,
    align: "right",
    cell: (value) => (
      <span className="tabular-nums">₲ {Number(value).toLocaleString("es-PY")}</span>
    ),
  },
  {
    header: "Saldo",
    accessor: "saldo",
    sortable: true,
    align: "right",
    cell: (value) => (
      <span className={cn(
        "tabular-nums font-medium",
        Number(value) > 0 ? "text-amber-500" : "text-emerald-500"
      )}>
        ₲ {Number(value).toLocaleString("es-PY")}
      </span>
    ),
  },
  {
    header: "Vencimiento",
    accessor: "vencimiento",
    className: "text-xs",
  },
  {
    header: "Días",
    accessor: "diasVencido",
    sortable: true,
    align: "right",
    cell: (value) => (
      <Badge variant={Number(value) > 30 ? "destructive" : Number(value) > 15 ? "warning" : "secondary"}>
        {Number(value)}d
      </Badge>
    ),
  },
];
