import { type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import type { WorkOrder } from "./types";
import { statusConfig, statusColors } from "./status-config";

export const columns: Column<WorkOrder>[] = [
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
