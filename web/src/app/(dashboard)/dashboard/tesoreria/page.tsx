"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  DollarSign,
  Building2,
  AlertTriangle,
  Download,
  CheckCircle2,
  Clock,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
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
          { id: "conciliacion" as Tab, label: "Conciliación", icon: Landmark },
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

      {/* ── Tab: Conciliación Bancaria ──────────── */}
      {activeTab === "conciliacion" && (
        <ConciliacionTab cuentas={cuentas} />
      )}
    </div>
  );
}

/* ── Conciliación Tab Component ──────────────── */

interface ConciliacionRow {
  id: string;
  cuentaId: string;
  saldoBancario: number;
  saldoLibros: number | null;
  diferencia: number | null;
  estado: string;
  fechaConciliacion: string;
  saldoFinal: number | null;
  observaciones: string | null;
  createdAt: string;
}

function ConciliacionTab({ cuentas }: { cuentas: CUentaRecord[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedCuentaId, setSelectedCuentaId] = React.useState("");
  const [showNewDialog, setShowNewDialog] = React.useState(false);
  const [showCloseDialog, setShowCloseDialog] = React.useState(false);
  const [closingId, setClosingId] = React.useState<string | null>(null);

  // Form: nueva conciliación
  const [formBancario, setFormBancario] = React.useState("");
  const [formFecha, setFormFecha] = React.useState(new Date().toISOString().split("T")[0]);
  const [formObs, setFormObs] = React.useState("");

  // Form: cerrar conciliación
  const [formSaldoFinal, setFormSaldoFinal] = React.useState("");

  // Fetch conciliaciones
  const { data: conciliaciones = [], isLoading } = useQuery<ConciliacionRow[]>({
    queryKey: ["conciliaciones", selectedCuentaId],
    queryFn: () => api.listConciliaciones(selectedCuentaId),
    enabled: !!selectedCuentaId,
  });

  // Crear conciliación
  const createMut = useMutation({
    mutationFn: () =>
      api.startConciliacion({
        cuentaId: selectedCuentaId,
        saldoBancario: Number(formBancario),
        fechaConciliacion: formFecha,
        observaciones: formObs || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conciliaciones", selectedCuentaId] });
      toast.success("Conciliación iniciada");
      setShowNewDialog(false);
      setFormBancario("");
      setFormObs("");
    },
    onError: (err: any) => toast.error(err?.message || "Error al crear conciliación"),
  });

  // Cerrar conciliación
  const closeMut = useMutation({
    mutationFn: ({ id, saldoFinal }: { id: string; saldoFinal: number }) =>
      api.cerrarConciliacion(id, { saldoFinal }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conciliaciones", selectedCuentaId] });
      toast.success("Conciliación cerrada");
      setShowCloseDialog(false);
      setClosingId(null);
      setFormSaldoFinal("");
    },
    onError: (err: any) => toast.error(err?.message || "Error al cerrar conciliación"),
  });

  const formatG = (n: number) => `₲ ${n.toLocaleString("es-PY")}`;

  const conciliacionesColumns: Column<ConciliacionRow>[] = [
    {
      header: "Fecha",
      accessor: "fechaConciliacion",
      sortable: true,
      cell: (v) => new Date(v as string).toLocaleDateString("es-PY"),
    },
    {
      header: "Saldo Bancario",
      accessor: "saldoBancario",
      sortable: true,
      align: "right",
      cell: (v) => <span className="tabular-nums font-medium">{formatG(Number(v))}</span>,
    },
    {
      header: "Saldo Libros",
      accessor: "saldoLibros",
      sortable: true,
      align: "right",
      cell: (v) => v != null ? <span className="tabular-nums">{formatG(Number(v))}</span> : <span className="text-muted-foreground">—</span>,
    },
    {
      header: "Diferencia",
      accessor: "diferencia",
      sortable: true,
      align: "right",
      cell: (v) => {
        const d = Number(v ?? 0);
        return (
          <span className={cn("tabular-nums font-medium", d === 0 ? "text-emerald-500" : "text-amber-500")}>
            {v != null ? formatG(d) : "—"}
          </span>
        );
      },
    },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      cell: (v) => (
        <Badge variant={(v as string) === "CERRADA" ? "success" : "warning"}>
          {(v as string) === "CERRADA" ? (
            <><CheckCircle2 className="h-3 w-3 mr-1" /> Cerrada</>
          ) : (
            <><Clock className="h-3 w-3 mr-1" /> Abierta</>
          )}
        </Badge>
      ),
    },
    {
      header: "Acciones",
      accessor: "id",
      cell: (_, row) =>
        row.estado === "ABIERTA" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setClosingId(row.id); setShowCloseDialog(true); }}
          >
            Cerrar
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Conciliación mensual por cuenta bancaria</p>
        </div>
        <div className="flex gap-2">
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={selectedCuentaId}
            onChange={(e) => setSelectedCuentaId(e.target.value)}
          >
            <option value="">Seleccionar cuenta…</option>
            {cuentas.filter((c) => c.activo).map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
            ))}
          </select>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!selectedCuentaId}
            onClick={() => setShowNewDialog(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Nueva Conciliación
          </Button>
        </div>
      </div>

      {!selectedCuentaId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Landmark className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Seleccioná una cuenta bancaria para ver sus conciliaciones</p>
          </CardContent>
        </Card>
      )}

      {selectedCuentaId && (
        <DataTable<ConciliacionRow>
          columns={conciliacionesColumns}
          data={conciliaciones}
          rowKey="id"
          loading={isLoading}
          emptyMessage="No hay conciliaciones para esta cuenta"
          paginate
          pageSize={10}
          sortable
        />
      )}

      {/* ── Dialog: Nueva Conciliación ──────────── */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Conciliación Bancaria</DialogTitle>
            <DialogDescription>Registrá el saldo según el extracto bancario</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Saldo según Banco (Extracto)</label>
              <Input
                type="number"
                placeholder="0"
                value={formBancario}
                onChange={(e) => setFormBancario(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha de Conciliación</label>
              <Input
                type="date"
                value={formFecha}
                onChange={(e) => setFormFecha(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observaciones</label>
              <Input
                placeholder="Opcional…"
                value={formObs}
                onChange={(e) => setFormObs(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!formBancario || createMut.isPending}
              loading={createMut.isPending}
            >
              Iniciar Conciliación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Cerrar Conciliación ─────────── */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar Conciliación</DialogTitle>
            <DialogDescription>Ingresá el saldo final conciliado</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Saldo Final Conciliado</label>
              <Input
                type="number"
                placeholder="0"
                value={formSaldoFinal}
                onChange={(e) => setFormSaldoFinal(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (closingId && formSaldoFinal) {
                  closeMut.mutate({ id: closingId, saldoFinal: Number(formSaldoFinal) });
                }
              }}
              disabled={!formSaldoFinal || closeMut.isPending}
              loading={closeMut.isPending}
            >
              Cerrar Conciliación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
