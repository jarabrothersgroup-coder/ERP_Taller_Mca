"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import {
  Plus,
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

/* ── Types ──────────────────────────────────── */

type OrderStatus = "pending" | "budgeted" | "in_progress" | "quality" | "ready" | "completed" | "cancelled";

interface WorkOrder {
  id: string;
  client: string;
  vehicle: string;
  plate: string;
  year: number;
  service: string;
  status: OrderStatus;
  technician: string;
  deadline: string;
  estimatedCost: number;
  createdAt: string;
  notes?: string;
}

interface NewOrderForm {
  client: string;
  vehicle: string;
  plate: string;
  service: string;
  technician: string;
  notes: string;
}

/* ── Status Config ──────────────────────────── */

const statusConfig: Record<OrderStatus, { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "default"; icon: React.ElementType }> = {
  pending: { label: "Pendiente", variant: "secondary", icon: Clock },
  budgeted: { label: "Presupuestado", variant: "default", icon: Wrench },
  in_progress: { label: "En Progreso", variant: "warning", icon: Wrench },
  quality: { label: "Control Calidad", variant: "warning", icon: AlertTriangle },
  ready: { label: "Listo", variant: "success", icon: CheckCircle2 },
  completed: { label: "Completado", variant: "success", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", variant: "destructive", icon: X },
};

/* ── Mock Data ──────────────────────────────── */

const technicians = ["Carlos M.", "Ana R.", "Luis M.", "Pedro G.", "Sofía L."];

const mockOrders: WorkOrder[] = Array.from({ length: 35 }, (_, i) => {
  const statuses: OrderStatus[] = ["pending", "budgeted", "in_progress", "quality", "ready", "completed"];
  const status = statuses[i % statuses.length];
  const clients = ["María González", "Pedro López", "Juan Pérez", "Lucía Fernández", "Carlos Ruiz", "Ana Martínez", "Roberto Sánchez", "Laura Gómez"];
  const vehicles = ["Toyota Corolla", "Hyundai Tucson", "Kia Sportage", "VW Gol", "Chevrolet Onix", "Ford Ranger", "Nissan Frontier", "Suzuki Swift"];
  const services = ["Cambio de Aceite + Filtros", "Revisión de Frenos", "Alineación y Balanceo", "Diagnóstico Motor", "Cambio de Embrague", "Servicio de A/C", "Distribución", "Suspensión"];
  const daysAgo = Math.floor(Math.random() * 30);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return {
    id: `OT-${String(100 + i).padStart(3, "0")}`,
    client: clients[i % clients.length],
    vehicle: vehicles[i % vehicles.length],
    plate: `ABC ${String(100 + i).slice(0, 3)}`,
    year: [2020, 2021, 2022, 2023, 2024][i % 5],
    service: services[i % services.length],
    status,
    technician: technicians[i % technicians.length],
    deadline: daysAgo < 1 ? "Hoy" : daysAgo < 2 ? "Mañana" : `${daysAgo} días`,
    estimatedCost: [450000, 850000, 120000, 250000, 1800000, 350000, 650000, 420000][i % 8],
    createdAt: date.toLocaleDateString("es-PY"),
    notes: i % 4 === 0 ? "Cliente solicita presupuesto antes de autorizar" : undefined,
  };
});

/* ── Stats Cards ────────────────────────────── */

function WorkshopStats({ orders }: { orders: WorkOrder[] }) {
  const active = orders.filter((o) => o.status === "in_progress" || o.status === "quality").length;
  const pending = orders.filter((o) => o.status === "pending" || o.status === "budgeted").length;
  const completed = orders.filter((o) => o.status === "completed" || o.status === "ready").length;
  const totalCost = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((acc, o) => acc + o.estimatedCost, 0);

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">En Progreso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{active}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{pending}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Completadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{completed}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Fact. Estimada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold">₲ {(totalCost / 1_000_000).toFixed(1)}M</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── New Order Dialog ───────────────────────── */

function NewOrderDialog({ onCreated }: { onCreated: (order: WorkOrder) => void }) {
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState<NewOrderForm>({
    client: "",
    vehicle: "",
    plate: "",
    service: "",
    technician: "",
    notes: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof NewOrderForm, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof NewOrderForm, string>> = {};
    if (!form.client.trim()) newErrors.client = "El cliente es obligatorio";
    if (!form.vehicle.trim()) newErrors.vehicle = "El vehículo es obligatorio";
    if (!form.plate.trim()) newErrors.plate = "La matrícula es obligatoria";
    if (!form.service.trim()) newErrors.service = "El servicio es obligatorio";
    if (!form.technician) newErrors.technician = "Seleccioná un técnico";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1200));

    const newOrder: WorkOrder = {
      id: `OT-${String(100 + mockOrders.length + 1).padStart(3, "0")}`,
      client: form.client,
      vehicle: form.vehicle,
      plate: form.plate.toUpperCase(),
      year: 2024,
      service: form.service,
      status: "pending",
      technician: form.technician,
      deadline: "Pendiente",
      estimatedCost: 0,
      createdAt: new Date().toLocaleDateString("es-PY"),
      notes: form.notes || undefined,
    };

    onCreated(newOrder);
    setForm({ client: "", vehicle: "", plate: "", service: "", technician: "", notes: "" });
    setErrors({});
    setSubmitting(false);
    setOpen(false);
  };

  const updateField = <K extends keyof NewOrderForm>(field: K, value: NewOrderForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nueva Orden de Trabajo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva Orden de Trabajo</DialogTitle>
            <DialogDescription>
              Completá los datos para crear una nueva orden en el taller.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Cliente" htmlFor="client" required error={errors.client}>
                <Input
                  id="client"
                  placeholder="Nombre del cliente"
                  value={form.client}
                  onChange={(e) => updateField("client", e.target.value)}
                  hasError={!!errors.client}
                />
              </FormField>

              <FormField label="Matrícula" htmlFor="plate" required error={errors.plate}>
                <Input
                  id="plate"
                  placeholder="ABC 1234"
                  value={form.plate}
                  onChange={(e) => updateField("plate", e.target.value)}
                  hasError={!!errors.plate}
                  className="uppercase"
                />
              </FormField>
            </div>

            <FormField label="Vehículo" htmlFor="vehicle" required error={errors.vehicle}>
              <Input
                id="vehicle"
                placeholder="Marca, modelo y año"
                value={form.vehicle}
                onChange={(e) => updateField("vehicle", e.target.value)}
                hasError={!!errors.vehicle}
              />
            </FormField>

            <FormField label="Servicio a realizar" htmlFor="service" required error={errors.service}>
              <Textarea
                id="service"
                placeholder="Descripción del servicio solicitado"
                value={form.service}
                onChange={(e) => updateField("service", e.target.value)}
                hasError={!!errors.service}
                rows={2}
              />
            </FormField>

            <FormField label="Técnico asignado" htmlFor="technician" required error={errors.technician}>
              <Select
                id="technician"
                value={form.technician}
                onChange={(e) => updateField("technician", e.target.value)}
                hasError={!!errors.technician}
                placeholder="Seleccionar técnico…"
              >
                <option value="" disabled>Seleccionar técnico…</option>
                {technicians.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Notas adicionales" htmlFor="notes" helperText="Opcional">
              <Textarea
                id="notes"
                placeholder="Observaciones, instrucciones especiales…"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={2}
              />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={submitting}>
              {submitting ? "Creando…" : "Crear Orden"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Columns ────────────────────────────────── */

const statusColors: Record<OrderStatus, "secondary" | "warning" | "success" | "destructive" | "default"> = {
  pending: "secondary",
  budgeted: "default",
  in_progress: "warning",
  quality: "warning",
  ready: "success",
  completed: "success",
  cancelled: "destructive",
};

const columns: Column<WorkOrder>[] = [
  {
    header: "OT",
    accessor: "id",
    sortable: true,
    className: "font-mono text-xs font-medium",
  },
  {
    header: "Cliente",
    accessor: "client",
    sortable: true,
    cell: (_, row) => (
      <div>
        <p className="font-medium">{row.client}</p>
        <p className="text-xs text-muted-foreground">{row.vehicle}</p>
      </div>
    ),
  },
  {
    header: "Matrícula",
    accessor: "plate",
    hideOnMobile: true,
    className: "text-xs text-muted-foreground",
  },
  {
    header: "Servicio",
    accessor: "service",
    sortable: true,
    hideOnMobile: true,
  },
  {
    header: "Estado",
    accessor: "status",
    sortable: true,
    sortKey: "status",
    cell: (_, row) => {
      const config = statusConfig[row.status];
      return (
        <Badge variant={statusColors[row.status]}>
          {config.label}
        </Badge>
      );
    },
  },
  {
    header: "Técnico",
    accessor: "technician",
    sortable: true,
    hideOnMobile: true,
  },
  {
    header: "Costo Est.",
    accessor: "estimatedCost",
    sortable: true,
    align: "right",
    cell: (value) => (
      <span className="tabular-nums">
        ₲ {Number(value).toLocaleString("es-PY")}
      </span>
    ),
  },
  {
    header: "Venc.",
    accessor: "deadline",
    sortable: true,
    align: "right",
    className: "text-xs",
  },
];

/* ── Main Page ──────────────────────────────── */

export default function WorkshopPage() {
  const [loading, setLoading] = React.useState(true);
  const [orders, setOrders] = React.useState<WorkOrder[]>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");

  // Simulate loading
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setOrders(mockOrders);
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Filter data
  const filtered = React.useMemo(() => {
    let result = orders;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.client.toLowerCase().includes(q) ||
          o.vehicle.toLowerCase().includes(q) ||
          o.plate.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      result = result.filter((o) => o.status === statusFilter);
    }
    return result;
  }, [orders, search, statusFilter]);

  // Handle new order created
  const handleOrderCreated = (order: WorkOrder) => {
    setOrders((prev) => [order, ...prev]);
  };

  // Get today orders count
  const todayOrders = orders.filter(
    (o) => o.createdAt === new Date().toLocaleDateString("es-PY")
  ).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Taller</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de órdenes de trabajo — {todayOrders} orden{todayOrders !== 1 ? "es" : ""} hoy
          </p>
        </div>

        {/* ⭐ PRIMARY CTA */}
        <NewOrderDialog onCreated={handleOrderCreated} />
      </div>

      {/* ── Stats ──────────────────────────── */}
      {!loading && <WorkshopStats orders={filtered} />}

      {/* ── Status filter tabs ──────────────── */}
      {!loading && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
          <Button
            variant={statusFilter === "" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter("")}
            role="tab"
            aria-selected={statusFilter === ""}
          >
            Todas
          </Button>
          {Object.entries(statusConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={statusFilter === key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(key)}
              className="gap-1.5"
              role="tab"
              aria-selected={statusFilter === key}
            >
              <config.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {config.label}
            </Button>
          ))}
        </div>
      )}

      {/* ── Data Table ───────────────────────── */}
      <DataTable<WorkOrder>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={
          search || statusFilter
            ? "No se encontraron órdenes con esos filtros"
            : "No hay órdenes de trabajo. Cree su primera orden para comenzar."
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar OT, cliente, vehículo o matrícula…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
        onRowClick={(row) => {
          // In the future: navigate to order detail
          console.log("Open order:", row.id);
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
