import { Star } from "lucide-react";
import { type Column } from "@/components/ui/data-table";

export interface TopService {
  id: string;
  nombre: string;
  cantidad: number;
  ingresos: number;
  popularidad: number;
}

export interface TopClient {
  id: string;
  nombre: string;
  vehiculos: number;
  ordenes: number;
  ingresos: number;
  ultimaVisita: string;
}

export const topServicesColumns: Column<TopService>[] = [
  {
    header: "#",
    accessor: "id",
    className: "text-xs text-muted-foreground w-8",
  },
  {
    header: "Servicio",
    accessor: "nombre",
    sortable: true,
    cell: (_, row) => (
      <div className="flex items-center gap-2">
        <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden="true" />
        <span className="font-medium">{row.nombre}</span>
      </div>
    ),
  },
  { header: "Cantidad", accessor: "cantidad", sortable: true, align: "right" },
  {
    header: "Ingresos",
    accessor: "ingresos",
    sortable: true,
    align: "right",
    cell: (value) => (
      <span className="tabular-nums font-medium">₲ {Number(value).toLocaleString("es-PY")}</span>
    ),
  },
  {
    header: "Popularidad",
    accessor: "popularidad",
    sortable: true,
    cell: (value) => (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-orange-500" style={{ width: `${value}%` }} />
        </div>
        <span className="text-xs tabular-nums w-8 text-right">{value as number}%</span>
      </div>
    ),
  },
];

export const topClientsColumns: Column<TopClient>[] = [
  {
    header: "#",
    accessor: "id",
    className: "text-xs text-muted-foreground w-8",
  },
  {
    header: "Cliente",
    accessor: "nombre",
    sortable: true,
    cell: (_, row) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold">
          {row.nombre.charAt(0)}
        </div>
        <span className="font-medium">{row.nombre}</span>
      </div>
    ),
  },
  { header: "Vehículos", accessor: "vehiculos", sortable: true, align: "right", hideOnMobile: true },
  { header: "Órdenes", accessor: "ordenes", sortable: true, align: "right" },
  {
    header: "Ingresos",
    accessor: "ingresos",
    sortable: true,
    align: "right",
    cell: (value) => (
      <span className="tabular-nums font-medium">₲ {Number(value).toLocaleString("es-PY")}</span>
    ),
  },
  { header: "Última Visita", accessor: "ultimaVisita", className: "text-xs", hideOnMobile: true },
];
