import * as React from "react";
import { Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Column } from "@/components/ui/data-table";
import { statusConfig, serviceTypeLabels, serviceTypeVariants } from "./stats";
import type { UIMappedAppointment as AppointmentRecord } from "@/lib/data-service";

export const columns: Column<AppointmentRecord>[] = [
  {
    header: "Cliente",
    accessor: "clienteNombre",
    sortable: true,
    cell: (_, row) => {
      const initials = row.clienteNombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
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
  { header: "Fecha", accessor: "fechaTurno", sortable: true, hideOnMobile: true, className: "text-xs" },
  { header: "Hora", accessor: "horaTurno", sortable: true, className: "font-mono text-xs" },
  {
    header: "Tipo",
    accessor: "tipoServicio",
    sortable: true,
    hideOnMobile: true,
    cell: (_, row) => (
      <Badge variant={serviceTypeVariants[row.tipoServicio]}>{serviceTypeLabels[row.tipoServicio]}</Badge>
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
