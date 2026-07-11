"use client";

import * as React from "react";
import {
  Calendar,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserRound,
  Car,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { fetchAppointments, type UIMappedAppointment } from "@/lib/data-service";

/* ── Types ──────────────────────────────────── */

interface AppointmentRecord extends UIMappedAppointment {
  // Extended from base type
}

/* ── Status Configuration ───────────────────── */

const statusConfig: Record<string, { label: string; variant: "secondary" | "default" | "warning" | "success" | "destructive"; icon: React.ElementType }> = {
  RESERVADO: { label: "Reservado", variant: "secondary", icon: Clock },
  CONFIRMADO: { label: "Confirmado", variant: "success", icon: CheckCircle2 },
  PROCESADO_EN_ERP: { label: "En ERP", variant: "default", icon: Calendar },
  AUSENTE: { label: "Ausente", variant: "destructive", icon: XCircle },
  CANCELADO: { label: "Cancelado", variant: "warning", icon: AlertTriangle },
};

const serviceTypeLabels: Record<string, string> = {
  RAPIDO: "Rápido",
  PESADO: "Pesado",
};

const serviceTypeVariants: Record<string, "secondary" | "default"> = {
  RAPIDO: "secondary",
  PESADO: "default",
};

/* ── Mock Data ──────────────────────────────── */

const clientNames = [
  "María González", "Pedro López", "Juan Pérez", "Lucía Fernández",
  "Carlos Ruiz", "Ana Martínez", "Roberto Sánchez", "Laura Gómez",
  "Sofía Medina", "Diego Acosta", "Valentina Ortiz", "Facundo Benítez",
];

const marcas = ["Toyota", "Hyundai", "Kia", "Volkswagen", "Chevrolet", "Nissan", "Ford", "Suzuki"];
const modelos = ["Corolla", "Tucson", "Sportage", "Gol", "Onix", "Frontier", "Ranger", "Swift"];

function getMockAppointments(): AppointmentRecord[] {
  return Array.from({ length: 20 }, (_, i) => {
    const statuses: AppointmentRecord["estado"][] = [
      "RESERVADO", "CONFIRMADO", "CONFIRMADO", "RESERVADO",
      "PROCESADO_EN_ERP", "AUSENTE", "CANCELADO", "CONFIRMADO",
      "RESERVADO", "CONFIRMADO", "RESERVADO", "PROCESADO_EN_ERP",
      "CONFIRMADO", "CANCELADO", "CONFIRMADO", "RESERVADO",
      "CONFIRMADO", "RESERVADO", "AUSENTE", "CONFIRMADO",
    ];
    const date = new Date();
    date.setDate(date.getDate() + Math.floor(Math.random() * 30) - 5);
    const hours = 7 + Math.floor(Math.random() * 9);
    const minutes = [0, 15, 30, 45][Math.floor(Math.random() * 4)];

    return {
      id: `appt-${String(i + 1).padStart(3, "0")}`,
      clienteNombre: clientNames[i % clientNames.length],
      clientePhone: `+595 981 ${String(100000 + i).slice(0, 6)}`,
      clienteEmail: i % 3 === 0 ? `${clientNames[i % clientNames.length].toLowerCase().replace(" ", ".")}@gmail.com` : null,
      vehiculoChapa: `ABC ${String(100 + i).slice(0, 3)}`,
      vehiculoMarca: marcas[i % marcas.length],
      vehiculoModelo: modelos[i % modelos.length],
      fechaTurno: date.toLocaleDateString("es-PY"),
      horaTurno: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      tipoServicio: i % 3 === 0 ? "PESADO" : "RAPIDO",
      estado: statuses[i % statuses.length],
      createdAt: date.toLocaleDateString("es-PY"),
    };
  });
}

/* ── Stats Cards ────────────────────────────── */

function ScheduleStats({ appointments }: { appointments: AppointmentRecord[] }) {
  const reservados = appointments.filter((a) => a.estado === "RESERVADO").length;
  const confirmados = appointments.filter((a) => a.estado === "CONFIRMADO").length;
  const ausentes = appointments.filter((a) => a.estado === "AUSENTE").length;
  const enErp = appointments.filter((a) => a.estado === "PROCESADO_EN_ERP").length;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Reservados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{reservados}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Pendientes de confirmación</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Confirmados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{confirmados}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Listos para atender</p>
        </CardContent>
      </Card>
      <Card className={cn(enErp > 0 && "border-blue-200 dark:border-blue-800")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">En ERP</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-blue-500">{enErp}</p>
          <p className="text-xs text-muted-foreground mt-1">Procesados como OT</p>
        </CardContent>
      </Card>
      <Card className={cn(ausentes > 0 && "border-destructive/30")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
            Ausentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", ausentes > 0 && "text-destructive")}>
            {ausentes}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Columns ────────────────────────────────── */

const columns: Column<AppointmentRecord>[] = [
  {
    header: "Cliente",
    accessor: "clienteNombre",
    sortable: true,
    cell: (_, row) => {
      const initials = row.clienteNombre
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-bold shrink-0">
            {initials}
          </div>
          <div>
            <p className="font-medium">{row.clienteNombre}</p>
            <p className="text-xs text-muted-foreground">{row.clientePhone}</p>
          </div>
        </div>
      );
    },
  },
  {
    header: "Vehículo",
    accessor: (row) => `${row.vehiculoMarca} ${row.vehiculoModelo}`,
    sortable: true,
    sortKey: "vehiculoMarca",
    cell: (_, row) => (
      <div className="flex items-center gap-2">
        <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium text-sm">{row.vehiculoMarca} {row.vehiculoModelo}</p>
          <p className="text-xs text-muted-foreground font-mono">{row.vehiculoChapa}</p>
        </div>
      </div>
    ),
  },
  {
    header: "Fecha",
    accessor: "fechaTurno",
    sortable: true,
    hideOnMobile: true,
    className: "text-xs",
  },
  {
    header: "Hora",
    accessor: "horaTurno",
    sortable: true,
    className: "font-mono text-xs",
  },
  {
    header: "Tipo",
    accessor: "tipoServicio",
    sortable: true,
    hideOnMobile: true,
    cell: (_, row) => (
      <Badge variant={serviceTypeVariants[row.tipoServicio]}>
        {serviceTypeLabels[row.tipoServicio]}
      </Badge>
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
];

/* ── Main Page ──────────────────────────────── */

export default function CalendarioPage() {
  const [loading, setLoading] = React.useState(true);
  const [appointments, setAppointments] = React.useState<AppointmentRecord[]>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");

  // Fetch from API with mock fallback
  React.useEffect(() => {
    let cancelled = false;
    fetchAppointments(getMockAppointments).then((data) => {
      if (!cancelled) {
        setAppointments(data as AppointmentRecord[]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Filter data
  const filtered = React.useMemo(() => {
    let result = appointments;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.clienteNombre.toLowerCase().includes(q) ||
          a.vehiculoChapa.toLowerCase().includes(q) ||
          a.vehiculoMarca.toLowerCase().includes(q) ||
          a.clientePhone.includes(q)
      );
    }
    if (statusFilter) {
      result = result.filter((a) => a.estado === statusFilter);
    }
    return result;
  }, [appointments, search, statusFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendario</h1>
          <p className="text-sm text-muted-foreground">
            Agenda de citas y turnos del taller — {new Date().toLocaleDateString("es-PY", { month: "long", year: "numeric" })}
          </p>
        </div>

        {/* ⭐ PRIMARY CTA */}
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nuevo Turno
        </Button>
      </div>

      {/* ── Stats ──────────────────────────── */}
      {!loading && <ScheduleStats appointments={filtered} />}

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
            Todos
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
      <DataTable<AppointmentRecord>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={
          search || statusFilter
            ? "No se encontraron turnos con esos filtros"
            : "No hay turnos agendados. Cree su primer turno para comenzar."
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar cliente, chapa o teléfono…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
        onRowClick={(row) => {
          console.log("Open appointment:", row.id);
        }}
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
