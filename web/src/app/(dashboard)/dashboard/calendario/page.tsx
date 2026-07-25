"use client";

import * as React from "react";
import { Download, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { useAppointments } from "@/hooks/use-data";
import { NewAppointmentDialog } from "./new-appointment-dialog";
import { ScheduleStats, statusConfig } from "./stats";
import { columns } from "./columns";
import { WeekView } from "./week-view";
import type { UIMappedAppointment as AppointmentRecord } from "@/lib/data-service";

type ViewMode = "table" | "week";

export default function CalendarioPage() {
  const { data: appointments = [], isLoading: loading, refetch } = useAppointments();
  const [viewMode, setViewMode] = React.useState<ViewMode>("week");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendario</h1>
          <p className="text-sm text-muted-foreground">
            Agenda de citas y turnos del taller — {new Date().toLocaleDateString("es-PY", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "week" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="rounded-none gap-1"
            >
              <LayoutGrid className="h-4 w-4" />
              Semana
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="rounded-none gap-1"
            >
              <List className="h-4 w-4" />
              Lista
            </Button>
          </div>
          <NewAppointmentDialog onCreated={() => refetch()} />
        </div>
      </div>

      {!loading && <ScheduleStats appointments={filtered} />}

      {viewMode === "week" ? (
        <WeekView appointments={filtered} onRefresh={() => refetch()} />
      ) : (
        <>
          {!loading && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
              <Button variant={statusFilter === "" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("")} role="tab" aria-selected={statusFilter === ""}>
                Todos
              </Button>
              {Object.entries(statusConfig).map(([key, config]) => (
                <Button key={key} variant={statusFilter === key ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter(key)} className="gap-1.5" role="tab" aria-selected={statusFilter === key}>
                  <config.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {config.label}
                </Button>
              ))}
            </div>
          )}

          <DataTable<AppointmentRecord>
            columns={columns}
            data={filtered}
            rowKey="id"
            loading={loading}
            emptyMessage={search || statusFilter ? "No se encontraron turnos con esos filtros" : "No hay turnos agendados. Cree su primer turno para comenzar."}
            paginate
            pageSize={10}
            sortable
            searchPlaceholder="Buscar cliente, chapa o teléfono…"
            searchValue={search}
            onSearchChange={setSearch}
            className="shadow-sm"
            stickyHeader
            onRowClick={(row) => console.log("Open appointment:", row.id)}
            actions={<Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" aria-hidden="true" />Exportar</Button>}
          />
        </>
      )}
    </div>
  );
}
