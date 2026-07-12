"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { useAppointments } from "@/hooks/use-data";
import { NewAppointmentDialog } from "./new-appointment-dialog";
import { ScheduleStats, statusConfig } from "./stats";
import { columns } from "./columns";
import type { UIMappedAppointment as AppointmentRecord } from "@/lib/data-service";

export default function CalendarioPage() {
  const { data: appointments = [], isLoading: loading } = useAppointments();
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
        <NewAppointmentDialog />
      </div>

      {!loading && <ScheduleStats appointments={filtered} />}

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
    </div>
  );
}
