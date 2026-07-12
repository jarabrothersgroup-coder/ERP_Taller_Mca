"use client";

import * as React from "react";
import {
  Plus,
  DollarSign,
  Building2,
  AlertTriangle,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useBankAccounts, useMovements } from "@/hooks/use-data";
import { NewBankAccountDialog } from "./new-account-dialog";
import { NewMovementDialog } from "./new-movement-dialog";
import { type CUentaRecord, type MovimientoRecord, type CxcRecord, cuentasColumns, movimientosColumns, cxcColumns } from "./columns";
import { TreasuryStats } from "./stats";
import type { Tab } from "./columns";

/* ── Main Page ──────────────────────────────── */

export default function TesoreriaPage() {
  const { data: cuentas = [], isLoading: cuentasLoading } = useBankAccounts();
  const { data: movimientos = [], isLoading: movimientosLoading } = useMovements();
  const loading = cuentasLoading || movimientosLoading;
  const [activeTab, setActiveTab] = React.useState<Tab>("cuentas");
  const cxc: CxcRecord[] = [];
  const [search, setSearch] = React.useState("");

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

        {activeTab === "cuentas" && <NewBankAccountDialog />}
        {activeTab === "movimientos" && <NewMovementDialog />}
        {activeTab === "cxc" && (
          <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
            <Plus className="h-5 w-5" aria-hidden="true" />
            Registrar Cobro
          </Button>
        )}
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
