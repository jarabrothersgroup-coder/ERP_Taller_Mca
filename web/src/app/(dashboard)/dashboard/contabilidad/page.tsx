"use client";

import * as React from "react";
import {
  Plus,
  FileText,
  Download,
  Layers,
  DollarSign,
  TrendingUp,
  TrendingDown,
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
import { fetchAccounts, type UIMappedAccount } from "@/lib/data-service";

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

/* ── Mock Data ──────────────────────────────── */

function getMockAccounts(): AccountRecord[] {
  const accounts = [
    // Nivel 1: Raíces
    { codigo: "1", nombre: "ACTIVO", tipo: "ACTIVO", nivel: 1, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "2", nombre: "PASIVO", tipo: "PASIVO", nivel: 1, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "3", nombre: "PATRIMONIO", tipo: "PATRIMONIO", nivel: 1, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "4", nombre: "INGRESOS", tipo: "INGRESO", nivel: 1, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "5", nombre: "COSTOS", tipo: "COSTO", nivel: 1, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "6", nombre: "GASTOS", tipo: "GASTO", nivel: 1, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    // Nivel 2: Subgrupos
    { codigo: "1.1", nombre: "Activo Corriente", tipo: "ACTIVO", nivel: 2, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "1.2", nombre: "Activo No Corriente", tipo: "ACTIVO", nivel: 2, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "2.1", nombre: "Pasivo Corriente", tipo: "PASIVO", nivel: 2, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "2.2", nombre: "Pasivo No Corriente", tipo: "PASIVO", nivel: 2, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "4.1", nombre: "Ingresos Operacionales", tipo: "INGRESO", nivel: 2, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "4.2", nombre: "Ingresos No Operacionales", tipo: "INGRESO", nivel: 2, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "6.1", nombre: "Gastos Administrativos", tipo: "GASTO", nivel: 2, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "6.2", nombre: "Gastos de Ventas", tipo: "GASTO", nivel: 2, aceptaMovimientos: false, activo: true, saldoInicial: "0", moneda: "PYG" },
    // Nivel 3: Cuentas contables
    { codigo: "1.1.01", nombre: "Caja y Bancos", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "15000000", moneda: "PYG" },
    { codigo: "1.1.02", nombre: "Cuentas por Cobrar", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "8500000", moneda: "PYG" },
    { codigo: "1.1.03", nombre: "Inventarios", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "12000000", moneda: "PYG" },
    { codigo: "1.2.01", nombre: "Propiedades, Planta y Equipo", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "45000000", moneda: "PYG" },
    { codigo: "1.2.02", nombre: "Depreciación Acumulada", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "-8500000", moneda: "PYG" },
    { codigo: "2.1.01", nombre: "Cuentas por Pagar", tipo: "PASIVO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "5500000", moneda: "PYG" },
    { codigo: "2.1.02", nombre: "IVA por Pagar", tipo: "PASIVO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "3200000", moneda: "PYG" },
    { codigo: "2.1.03", nombre: "Salarios por Pagar", tipo: "PASIVO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "2800000", moneda: "PYG" },
    { codigo: "3.1.01", nombre: "Capital Social", tipo: "PATRIMONIO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "50000000", moneda: "PYG" },
    { codigo: "3.1.02", nombre: "Reserva Legal", tipo: "PATRIMONIO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "5000000", moneda: "PYG" },
    { codigo: "3.1.03", nombre: "Resultados Acumulados", tipo: "PATRIMONIO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "12500000", moneda: "PYG" },
    { codigo: "4.1.01", nombre: "Venta de Servicios", tipo: "INGRESO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "4.1.02", nombre: "Venta de Repuestos", tipo: "INGRESO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "5.1.01", nombre: "Costo de Servicios", tipo: "COSTO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "5.1.02", nombre: "Costo de Repuestos", tipo: "COSTO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "6.1.01", nombre: "Sueldos y Salarios", tipo: "GASTO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "6.1.02", nombre: "Servicios Básicos", tipo: "GASTO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "6.1.03", nombre: "Alquileres", tipo: "GASTO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "6.1.04", nombre: "Depreciación", tipo: "GASTO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "0", moneda: "PYG" },
    { codigo: "6.1.05", nombre: "Impuestos y Tasas", tipo: "GASTO", nivel: 3, aceptaMovimientos: true, activo: true, saldoInicial: "0", moneda: "PYG" },
  ];
  return accounts.map((a, i) => ({
    id: `ACC-${String(100 + i).padStart(3, "0")}`,
    ...a,
  }));
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

/* ── Main Page ──────────────────────────────── */

export default function ContabilidadPage() {
  const [loading, setLoading] = React.useState(true);
  const [accounts, setAccounts] = React.useState<AccountRecord[]>([]);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    fetchAccounts(getMockAccounts as unknown as () => UIMappedAccount[]).then((data) => {
      if (!cancelled) {
        setAccounts(data as unknown as AccountRecord[]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

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
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nueva Cuenta
        </Button>
      </div>

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
