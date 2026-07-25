"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  Calculator,
  Users,
  DollarSign,
  Clock,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type {
  MechanicProfileRecord,
  PayrollSummaryRecord,
  CommissionRecordEntry,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useBreakEven, useWorkOrders } from "@/hooks/use-data";

/* ── Helpers ──────────────────────────────────── */

function formatGuarani(amount: number): string {
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  AYUDANTE: "Ayudante",
  MEDIO_OFICIAL: "Medio Oficial",
  OFICIAL: "Oficial",
  OFICIAL_CERTIFICADO: "Oficial Certificado",
};

/* ── Columns: Perfiles de Mecánicos ───────────── */

const profileColumns: Column<MechanicProfileRecord>[] = [
  {
    header: "Nombre",
    accessor: "nombre",
    cell: (_v, row) => row.nombre ?? row.profileId.slice(0, 8),
  },
  {
    header: "Categoría MTESS",
    accessor: "category",
    cell: (_v, row) => (
      <Badge variant="outline">
        {CATEGORY_LABELS[row.category] ?? row.category}
      </Badge>
    ),
  },
  {
    header: "Salario Base",
    accessor: "baseSalary",
    cell: (_v, row) => formatGuarani(row.baseSalary),
  },
  {
    header: "Comisión %",
    accessor: "commissionRate",
    cell: (_v, row) => `${row.commissionRate}%`,
  },
];

/* ── Columns: Historial Nómina ────────────────── */

const historyColumns: Column<PayrollSummaryRecord>[] = [
  {
    header: "Período",
    accessor: "month",
    cell: (_v, row) => `${String(row.month).padStart(2, "0")}/${row.year}`,
  },
  {
    header: "Gastos Fijos",
    accessor: "fixedExpensesTotal",
    cell: (_v, row) => formatGuarani(row.fixedExpensesTotal),
  },
  {
    header: "Base Nómina",
    accessor: "payrollBaseTotal",
    cell: (_v, row) => formatGuarani(row.payrollBaseTotal),
  },
  {
    header: "Ingresos Netos",
    accessor: "netLaborRevenue",
    cell: (_v, row) => formatGuarani(row.netLaborRevenue),
  },
  {
    header: "Break-Even",
    accessor: "breakevenPercentage",
    cell: (_v, row) => (
      <Badge variant={row.breakevenHit ? "success" : "warning"}>
        {row.breakevenPercentage}%
      </Badge>
    ),
  },
];

/* ── Columns: Comisiones ──────────────────────── */

const commissionColumns: Column<CommissionRecordEntry>[] = [
  {
    header: "Mecánico",
    accessor: "mechanicProfileId",
    cell: (_v, row) => row.mechanicProfileId.slice(0, 8),
  },
  {
    header: "Monto Mano de Obra",
    accessor: "laborAmount",
    cell: (_v, row) => formatGuarani(Number(row.laborAmount)),
  },
  {
    header: "Comisión",
    accessor: "commissionAmount",
    cell: (_v, row) => formatGuarani(Number(row.commissionAmount)),
  },
  {
    header: "Estado",
    accessor: "status",
    cell: (_v, row) => (
      <Badge variant={row.status === "PAID" ? "success" : "outline"}>
        {row.status}
      </Badge>
    ),
  },
];

/* ── Tab: Resumen ─────────────────────────────── */

function ResumenTab() {
  const { data: breakEven, isLoading: beLoading } = useBreakEven();
  const { data: orders = [], isLoading: ordersLoading } = useWorkOrders();
  const loading = beLoading || ordersLoading;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const completedOrders = orders.filter(
    (o) => o.status === "ready" || o.status === "completed",
  ).length;

  return (
    <div className="space-y-6">
      {/* Break-Even Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Break-Even del Taller
          </CardTitle>
          <CardDescription>
            Umbral de activación por margen de contribución
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold">
                  {breakEven?.percentage ?? 0}%
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatGuarani(breakEven?.currentRevenue ?? 0)} de{" "}
                  {formatGuarani(breakEven?.threshold ?? 0)}
                </p>
              </div>
              <Badge
                variant={
                  breakEven && breakEven.percentage >= 100
                    ? "success"
                    : "warning"
                }
              >
                {breakEven && breakEven.percentage >= 100
                  ? "Umbral alcanzado"
                  : "En progreso"}
              </Badge>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-500 transition-all duration-700"
                style={{
                  width: `${Math.min(breakEven?.percentage ?? 0, 100)}%`,
                }}
              />
            </div>
            {breakEven && breakEven.remaining > 0 && (
              <p className="text-xs text-muted-foreground">
                Faltan {formatGuarani(breakEven.remaining)} para liberar
                comisiones
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Órdenes Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-500" />
              <p className="text-2xl font-bold">{orders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Completadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <p className="text-2xl font-bold">{completedOrders}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Ingresos Netos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatGuarani(breakEven?.currentRevenue ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Umbral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatGuarani(breakEven?.threshold ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">
            Las comisiones se liberan automáticamente cuando la facturación neta
            supera gastos fijos + salarios base.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Tab: Personal ────────────────────────────── */

function PersonalTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MechanicProfileRecord | null>(
    null,
  );
  const [form, setForm] = React.useState({
    profileId: "",
    category: "OFICIAL",
    baseSalary: 0,
    commissionRate: 10,
  });

  const { data: profiles = [], isLoading } = useQuery<
    MechanicProfileRecord[],
    Error
  >({
    queryKey: ["mechanic-profiles"],
    queryFn: () => api.listMechanicProfiles(),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.createMechanicProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mechanic-profiles"] });
      toast.success("Perfil creado");
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; body: Partial<typeof form> }) =>
      api.updateMechanicProfile(data.id, data.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mechanic-profiles"] });
      toast.success("Perfil actualizado");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openNew() {
    setEditing(null);
    setForm({
      profileId: "",
      category: "OFICIAL",
      baseSalary: 0,
      commissionRate: 10,
    });
    setDialogOpen(true);
  }

  function openEdit(row: MechanicProfileRecord) {
    setEditing(row);
    setForm({
      profileId: row.profileId,
      category: row.category,
      baseSalary: row.baseSalary,
      commissionRate: Number(row.commissionRate),
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        body: {
          category: form.category,
          baseSalary: form.baseSalary,
          commissionRate: form.commissionRate,
        },
      });
    } else {
      createMutation.mutate(form);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Perfiles de mecánicos según categorías MTESS 2026 (Ley 1034/83)
        </p>
        <Button className="gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nuevo Perfil
        </Button>
      </div>

      {isLoading ? (
        <div className="h-48 rounded-md bg-muted animate-pulse" />
      ) : (
        <DataTable
          columns={profileColumns}
          data={profiles}
          rowKey="id"
        />
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Perfil" : "Nuevo Perfil de Mecánico"}
            </DialogTitle>
            <DialogDescription>
              Categorías MTESS 2026: Ayudante ₲3.253.717 / Medio Oficial
              ₲3.470.295 / Oficial ₲3.773.989 / Oficial Certificado ₲4.800.000
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editing && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Profile ID</label>
                <Input
                  placeholder="UUID del profile"
                  value={form.profileId}
                  onChange={(e) =>
                    setForm({ ...form, profileId: e.target.value })
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoría MTESS</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
              >
                <option value="AYUDANTE">AYUDANTE — ₲3.253.717</option>
                <option value="MEDIO_OFICIAL">
                  MEDIO OFICIAL — ₲3.470.295
                </option>
                <option value="OFICIAL">OFICIAL — ₲3.773.989</option>
                <option value="OFICIAL_CERTIFICADO">
                  OFICIAL CERTIFICADO — ₲4.800.000
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Salario Base (₲)</label>
              <Input
                type="number"
                value={form.baseSalary}
                onChange={(e) =>
                  setForm({ ...form, baseSalary: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Comisión (%)</label>
              <Input
                type="number"
                step="0.5"
                value={form.commissionRate}
                onChange={(e) =>
                  setForm({ ...form, commissionRate: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? "Guardar Cambios" : "Crear Perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Tab: Nómina Mensual ──────────────────────── */

function NominaMensualTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = React.useState(now.getMonth() + 1);
  const [year, setYear] = React.useState(now.getFullYear());

  const { data: breakEven } = useBreakEven();

  // Payroll history
  const { data: history = [], isLoading: historyLoading } = useQuery<
    PayrollSummaryRecord[],
    Error
  >({
    queryKey: ["payroll-history"],
    queryFn: () => api.listPayrollHistory(),
  });

  // Commissions for selected period
  const { data: commissions = [], isLoading: commissionsLoading } = useQuery<
    CommissionRecordEntry[],
    Error
  >({
    queryKey: ["payroll-commissions", month, year],
    queryFn: () => api.listCommissions(month, year),
  });

  // Calculate payroll mutation
  const calcMutation = useMutation({
    mutationFn: (data: { month: number; year: number }) =>
      api.calculatePayroll({ anho: data.year, mes: data.month }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-history"] });
      qc.invalidateQueries({ queryKey: ["payroll-commissions"] });
      toast.success("Nómina calculada correctamente");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const totalCommissions = commissions.reduce(
    (sum, c) => sum + Number(c.commissionAmount),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Mes:</label>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {String(i + 1).padStart(2, "0")} —{" "}
                [
                {new Date(2000, i).toLocaleString("es-PY", { month: "long" })}
                ]
              </option>
            ))}
          </select>
          <label className="text-sm font-medium">Año:</label>
          <Input
            type="number"
            className="w-24"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <Button
          className="gap-2"
          onClick={() => calcMutation.mutate({ month, year })}
          disabled={calcMutation.isPending}
        >
          <Calculator className="h-4 w-4" />
          {calcMutation.isPending ? "Calculando..." : "Calcular Nómina"}
        </Button>
      </div>

      {/* Period KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Break-Even %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {breakEven?.percentage ?? 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Ingresos Netos (Mes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatGuarani(breakEven?.currentRevenue ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Comisiones a Pagar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {formatGuarani(totalCommissions)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Commissions Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Comisiones del Período
          </CardTitle>
          <CardDescription>
            Comisiones calculadas para {String(month).padStart(2, "0")}/{year}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {commissionsLoading ? (
            <div className="h-32 rounded-md bg-muted animate-pulse" />
          ) : commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay comisiones calculadas para este período. Presione
              &quot;Calcular Nómina&quot; para generar.
            </p>
          ) : (
            <DataTable
              columns={commissionColumns}
              data={commissions}
              rowKey="id"
            />
          )}
        </CardContent>
      </Card>

      {/* Payroll History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Historial de Nómina
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="h-32 rounded-md bg-muted animate-pulse" />
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin registros de nómina aún.
            </p>
          ) : (
            <DataTable
              columns={historyColumns}
              data={history}
              rowKey="id"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Page ─────────────────────────────────────── */

export default function NominaPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nómina</h1>
        <p className="text-sm text-muted-foreground">
          Break-even, comisiones y gestión de personal del taller
        </p>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="nomina">Nómina Mensual</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <ResumenTab />
        </TabsContent>

        <TabsContent value="personal">
          <PersonalTab />
        </TabsContent>

        <TabsContent value="nomina">
          <NominaMensualTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
