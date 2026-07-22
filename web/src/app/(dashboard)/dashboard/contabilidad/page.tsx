"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Download,
  Layers,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  BookOpen,
  BarChart3,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { useAccounts } from "@/hooks/use-data";
import { NewAccountDialog } from "./new-account-dialog";
import type { UIMappedAccount } from "@/lib/data-service";

/* ── Types ──────────────────────────────────── */

interface AccountRecord {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  nivel: number;
  aceptaMovimientos: boolean;
  activo: boolean;
  saldoInicial: string;
  moneda: string;
  descripcion?: string;
}

/* ── Type Config ────────────────────────────── */

const tipoConfig: Record<string, { label: string; color: string }> = {
  ACTIVO: { label: "Activo", color: "text-blue-500" },
  PASIVO: { label: "Pasivo", color: "text-amber-500" },
  PATRIMONIO: { label: "Patrimonio", color: "text-emerald-500" },
  INGRESO: { label: "Ingreso", color: "text-green-500" },
  GASTO: { label: "Gasto", color: "text-red-500" },
  COSTO: { label: "Costo", color: "text-purple-500" },
  ORDEN: { label: "Orden", color: "text-gray-500" },
};

const tipoVariants: Record<string, "default" | "secondary" | "warning" | "success" | "destructive"> = {
  ACTIVO: "default",
  PASIVO: "warning",
  PATRIMONIO: "success",
  INGRESO: "success",
  GASTO: "destructive",
  COSTO: "secondary",
  ORDEN: "secondary",
};

/* ── Stats Cards ────────────────────────────── */

function AccountStats({ accounts }: { accounts: AccountRecord[] }) {
  const total = accounts.length;
  const activas = accounts.filter((a) => a.activo).length;
  const conMovimiento = accounts.filter((a) => a.aceptaMovimientos).length;
  const cuentasDeBalance = accounts.filter((a) => ["ACTIVO", "PASIVO", "PATRIMONIO"].includes(a.tipo)).length;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Cuentas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{total}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Activas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{activas}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Con Movimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-violet-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{conMovimiento}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-orange-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{cuentasDeBalance}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Columns ────────────────────────────────── */

const columns: Column<AccountRecord>[] = [
  {
    header: "Código",
    accessor: "codigo",
    sortable: true,
    className: "font-mono text-xs font-medium",
  },
  {
    header: "Nombre",
    accessor: "nombre",
    sortable: true,
    cell: (_, row) => (
      <div>
        <p className={cn("font-medium", row.nivel === 1 && "font-bold text-sm")}>
          {"—".repeat(row.nivel - 1)} {row.nombre}
        </p>
        {row.descripcion && (
          <p className="text-xs text-muted-foreground">{row.descripcion}</p>
        )}
      </div>
    ),
  },
  {
    header: "Tipo",
    accessor: "tipo",
    sortable: true,
    cell: (_, row) => {
      const config = tipoConfig[row.tipo];
      return (
        <Badge variant={tipoVariants[row.tipo]} className="font-normal">
          {config.label}
        </Badge>
      );
    },
  },
  {
    header: "Nivel",
    accessor: "nivel",
    sortable: true,
    align: "center",
  },
  {
    header: "Saldo Inicial",
    accessor: "saldoInicial",
    sortable: true,
    align: "right",
    cell: (value) => (
      <span className="tabular-nums font-mono text-xs">
        ₲ {Number(value).toLocaleString("es-PY")}
      </span>
    ),
  },
  {
    header: "Estado",
    accessor: "activo",
    sortable: true,
    align: "center",
    cell: (_, row) => (
      <Badge variant={row.activo ? "success" : "secondary"} className="font-normal">
        {row.activo ? "Activa" : "Inactiva"}
      </Badge>
    ),
  },
];

/* ── Sub-navigation tabs ────────────────────── */

const CONTABILIDAD_SUB_PAGES = [
  {
    href: "/dashboard/contabilidad",
    label: "Plan de Cuentas",
    icon: BookOpen,
  },
  {
    href: "/dashboard/contabilidad/integracion",
    label: "Integración",
    icon: Activity,
  },
  {
    href: "/dashboard/contabilidad/flujo-efectivo",
    label: "Flujo Efectivo",
    icon: BarChart3,
  },
  {
    href: "/dashboard/contabilidad/evolucion-patrimonio",
    label: "Patrimonio",
    icon: Landmark,
  },
];

function PageTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b border-border mb-6">
      {CONTABILIDAD_SUB_PAGES.map((page) => {
        const isActive = pathname === page.href;
        return (
          <Link
            key={page.href}
            href={page.href}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-150 relative",
              isActive
                ? "text-foreground bg-background border-x border-t border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <page.icon className="h-4 w-4" aria-hidden="true" />
            <span>{page.label}</span>
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-full"
                aria-hidden="true"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function ContabilidadPage() {
  const { data: accounts = [], isLoading: loading } = useAccounts();
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        a.nombre.toLowerCase().includes(q) ||
        a.codigo.toLowerCase().includes(q) ||
        a.tipo.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contabilidad</h1>
          <p className="text-sm text-muted-foreground">
            Plan de Cuentas — {accounts.length} cuentas registradas
          </p>
        </div>
        <NewAccountDialog />
      </div>

      <PageTabs />

      {!loading && <AccountStats accounts={filtered} />}

      <DataTable<AccountRecord>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={
          search
            ? "No se encontraron cuentas con ese criterio"
            : "No hay cuentas contables. Agregue la primera cuenta del plan."
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar por código, nombre o tipo…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
        onRowClick={(row) => console.log("Open account:", row.id)}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar
          </Button>
        }
      />
    </div>
  );
}
