"use client";

import * as React from "react";
import {
  Plus,
  DollarSign,
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
  Download,
  Banknote,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { fetchBankAccounts, fetchMovements, type UIMappedBankAccount, type UIMappedMovement } from "@/lib/data-service";

/* ── Types ──────────────────────────────────── */

type Tab = "cuentas" | "movimientos" | "cxc";

interface CUentaRecord extends UIMappedBankAccount {
  // Extended with UI-only fields
}

interface MovimientoRecord extends UIMappedMovement {
  tipoLabel?: string;
  tipoIcon?: React.ElementType;
}

interface CxcRecord {
  id: string;
  cliente: string;
  factura: string;
  total: number;
  saldo: number;
  vencimiento: string;
  diasVencido: number;
}

/* ── Mock Data ──────────────────────────────── */

const cuentasMock: CUentaRecord[] = [
  { id: "cta-1", codigo: "1.1.01.001", nombre: "Caja Chica", tipo: "CAJA", moneda: "PYG", saldoInicial: 2000000, saldoActual: 1850000, activo: true },
  { id: "cta-2", codigo: "1.1.01.002", nombre: "Banco Continental", tipo: "CORRIENTE", moneda: "PYG", saldoInicial: 25000000, saldoActual: 18750000, activo: true },
  { id: "cta-3", codigo: "1.1.01.003", nombre: "Paypy (Bco Itaú)", tipo: "CORRIENTE", moneda: "PYG", saldoInicial: 15000000, saldoActual: 22300000, activo: true },
  { id: "cta-4", codigo: "1.1.01.004", nombre: "Caja USD", tipo: "CAJA", moneda: "USD", saldoInicial: 1500, saldoActual: 1200, activo: true },
];

function getMockCuentas(): CUentaRecord[] {
  return cuentasMock;
}

const tiposMovimiento = ["INGRESO", "EGRESO", "TRANSFERENCIA"] as const;
const mediosPago = ["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "TARJETA_CREDITO", "TARJETA_DEBITO"];
const conceptos = [
  "Cobro factura FAC-001",
  "Pago proveedor Proauto S.A.",
  "Transferencia a caja chica",
  "Venta contado - Servicio",
  "Compra de repuestos",
  "Pago de servicios (AND E)",
  "Retiro socio",
  "Depósito cliente",
  "Pago a cuenta IPS",
  "Cobro factura FAC-015",
];

const iconosMovimiento: Record<string, React.ElementType> = {
  INGRESO: ArrowUpRight,
  EGRESO: ArrowDownLeft,
  TRANSFERENCIA: ArrowLeftRight,
};

const coloresMovimiento: Record<string, string> = {
  INGRESO: "text-emerald-600 dark:text-emerald-400",
  EGRESO: "text-red-600 dark:text-red-400",
  TRANSFERENCIA: "text-blue-600 dark:text-blue-400",
};

const badgeMovimiento: Record<string, "success" | "destructive" | "secondary"> = {
  INGRESO: "success",
  EGRESO: "destructive",
  TRANSFERENCIA: "secondary",
};

function getMockMovimientos(): MovimientoRecord[] {
  return Array.from({ length: 25 }, (_, i) => {
    const tipo = tiposMovimiento[i % 3];
    const monto = [850000, 450000, 1200000, 320000, 560000, 920000, 180000, 2500000, 750000, 480000][i % 10];
    const daysAgo = Math.floor(Math.random() * 60);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const conciliado = i % 5 !== 0;

    return {
      id: `mov-${String(i + 1).padStart(4, "0")}`,
      tipo: tipo as MovimientoRecord["tipo"],
      medioPago: mediosPago[i % mediosPago.length],
      cuentaNombre: cuentasMock[i % cuentasMock.length].nombre,
      monto,
      concepto: conceptos[i % conceptos.length],
      fecha: date.toLocaleDateString("es-PY"),
      conciliado,
    };
  });
}

function getMockCxc(): CxcRecord[] {
  const clientes = [
    "María González", "Pedro López", "Juan Pérez", "Lucía Fernández",
    "Carlos Ruiz", "Ana Martínez", "Roberto Sánchez",
  ];
  return Array.from({ length: 12 }, (_, i) => {
    const total = [450000, 850000, 1200000, 320000, 2100000, 560000][i % 6];
    const saldo = [0, total, total * 0.5, total, 0, total * 0.75][i % 6];
    const daysAgo = [30, 15, 5, 45, 60, 10, 25, 50, 20, 35, 55, 40][i];
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    return {
      id: `cxc-${String(i + 1).padStart(3, "0")}`,
      cliente: clientes[i % clientes.length],
      factura: `FAC-${String(100 + i).padStart(4, "0")}`,
      total,
      saldo,
      vencimiento: date.toLocaleDateString("es-PY"),
      diasVencido: daysAgo,
    };
  });
}

/* ── Stats Cards ────────────────────────────── */

function TreasuryStats({ cuentas, movimientos, cxc }: { cuentas: CUentaRecord[]; movimientos: MovimientoRecord[]; cxc: CxcRecord[] }) {
  const totalCuentas = cuentas.filter((c) => c.activo).length;
  const saldoTotalPYG = cuentas
    .filter((c) => c.moneda === "PYG" && c.activo)
    .reduce((sum, c) => sum + c.saldoActual, 0);
  const movimientosMes = movimientos.length;
  const saldoPendienteCxc = cxc.filter((c) => c.saldo > 0).reduce((sum, c) => sum + c.saldo, 0);

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Cuentas Activas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{totalCuentas}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Total (PYG)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold">₲ {(saldoTotalPYG / 1_000_000).toFixed(1)}M</p>
          </div>
          {cuentas.some((c) => c.moneda === "USD" && c.activo) && (
            <p className="text-xs text-muted-foreground mt-1">
              + ${cuentas.filter((c) => c.moneda === "USD" && c.activo).reduce((s, c) => s + c.saldoActual, 0).toLocaleString("es-PY")} USD
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{movimientosMes}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Registrados</p>
        </CardContent>
      </Card>
      <Card className={cn(saldoPendienteCxc > 0 && "border-amber-200 dark:border-amber-800")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            CxC Pendiente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", saldoPendienteCxc > 0 && "text-amber-500")}>
            ₲ {(saldoPendienteCxc / 1_000_000).toFixed(1)}M
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Columns: Cuentas ───────────────────────── */

const cuentasColumns: Column<CUentaRecord>[] = [
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

const movimientosColumns: Column<MovimientoRecord>[] = [
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

const cxcColumns: Column<CxcRecord>[] = [
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

/* ── Main Page ──────────────────────────────── */

export default function TesoreriaPage() {
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<Tab>("cuentas");
  const [cuentas, setCuentas] = React.useState<CUentaRecord[]>([]);
  const [movimientos, setMovimientos] = React.useState<MovimientoRecord[]>([]);
  const [cxc] = React.useState<CxcRecord[]>(() => getMockCxc());
  const [search, setSearch] = React.useState("");

  // Fetch from API with mock fallback
  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchBankAccounts(getMockCuentas),
      fetchMovements(getMockMovimientos),
    ]).then(([accounts, movements]) => {
      if (!cancelled) {
        setCuentas(accounts as CUentaRecord[]);
        setMovimientos(movements as MovimientoRecord[]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Filter data
  const filteredData = React.useMemo(() => {
    if (!search) {
      if (activeTab === "cuentas") return cuentas;
      if (activeTab === "movimientos") return movimientos;
      return cxc;
    }
    const q = search.toLowerCase();
    if (activeTab === "cuentas") {
      return cuentas.filter(
        (c) => c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q)
      );
    }
    if (activeTab === "movimientos") {
      return movimientos.filter(
        (m) => m.concepto.toLowerCase().includes(q) || m.cuentaNombre.toLowerCase().includes(q)
      );
    }
    return cxc.filter(
      (c) => c.cliente.toLowerCase().includes(q) || c.factura.toLowerCase().includes(q)
    );
  }, [cuentas, movimientos, cxc, activeTab, search]);

  // Calculate alerts
  const vencidasCritical = cxc.filter((c) => c.saldo > 0 && c.diasVencido > 30);
  const saldoBajo = cuentas.find((c) => c.activo && c.moneda === "PYG" && c.saldoActual < 5000000);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tesorería</h1>
          <p className="text-sm text-muted-foreground">
            Cuentas bancarias, movimientos y cuentas por cobrar
          </p>
        </div>

        {/* ⭐ PRIMARY CTA */}
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          {activeTab === "cuentas" ? "Nueva Cuenta" : activeTab === "movimientos" ? "Nuevo Movimiento" : "Registrar Cobro"}
        </Button>
      </div>

      {/* ── Alerts ──────────────────────────── */}
      {vencidasCritical.length > 0 && !loading && (
        <Alert variant="error">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Cuentas por cobrar vencidas</AlertTitle>
          <AlertDescription>
            {vencidasCritical.length} factura{vencidasCritical.length !== 1 ? "s" : ""} con más de 30 días de vencimiento.
            Total: ₲ {vencidasCritical.reduce((s, c) => s + c.saldo, 0).toLocaleString("es-PY")}
          </AlertDescription>
        </Alert>
      )}

      {saldoBajo && !loading && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Saldo bajo en &quot;{saldoBajo.nombre}&quot;</AlertTitle>
          <AlertDescription>
            Saldo actual: ₲ {saldoBajo.saldoActual.toLocaleString("es-PY")}. Considere transferir fondos para cubrir gastos operativos.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Stats ──────────────────────────── */}
      {!loading && <TreasuryStats cuentas={cuentas} movimientos={movimientos} cxc={cxc} />}

      {/* ── Tab Switcher ────────────────────── */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones de tesorería">
        {[
          { id: "cuentas" as Tab, label: "Cuentas Bancarias", icon: Building2 },
          { id: "movimientos" as Tab, label: "Movimientos", icon: DollarSign },
          { id: "cxc" as Tab, label: "CxC Pendientes", icon: AlertTriangle },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => { setActiveTab(tab.id); setSearch(""); }}
            className="gap-1.5"
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {tab.label}
            {tab.id === "cxc" && cxc.filter((c) => c.saldo > 0).length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {cxc.filter((c) => c.saldo > 0).length}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* ── Data Table ───────────────────────── */}
      {activeTab === "cuentas" && (
        <DataTable<CUentaRecord>
          columns={cuentasColumns}
          data={filteredData as CUentaRecord[]}
          rowKey="id"
          loading={loading}
          emptyMessage="No hay cuentas bancarias registradas"
          paginate
          pageSize={10}
          sortable
          searchPlaceholder="Buscar cuenta o código…"
          searchValue={search}
          onSearchChange={setSearch}
          className="shadow-sm"
          stickyHeader
          actions={
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Exportar
            </Button>
          }
        />
      )}

      {activeTab === "movimientos" && (
        <DataTable<MovimientoRecord>
          columns={movimientosColumns}
          data={filteredData as MovimientoRecord[]}
          rowKey="id"
          loading={loading}
          emptyMessage="No hay movimientos registrados"
          paginate
          pageSize={10}
          sortable
          searchPlaceholder="Buscar movimiento o cuenta…"
          searchValue={search}
          onSearchChange={setSearch}
          className="shadow-sm"
          stickyHeader
        />
      )}

      {activeTab === "cxc" && (
        <DataTable<CxcRecord>
          columns={cxcColumns}
          data={filteredData as CxcRecord[]}
          rowKey="id"
          loading={loading}
          emptyMessage="No hay cuentas por cobrar pendientes"
          paginate
          pageSize={10}
          sortable
          searchPlaceholder="Buscar cliente o factura…"
          searchValue={search}
          onSearchChange={setSearch}
          className="shadow-sm"
          stickyHeader
          onRowClick={(row) => {
            console.log("Register payment:", row.id);
          }}
        />
      )}
    </div>
  );
}
