import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { statusColors, statusLabels } from "./stats";
import type { UIMappedInventoryItem as InventoryItem } from "@/lib/data-service";

export const columns: Column<InventoryItem>[] = [
  { header: "Código", accessor: "code", sortable: true, className: "font-mono text-xs" },
  {
    header: "Producto",
    accessor: "name",
    sortable: true,
    cell: (_, row) => (
      <div>
        <p className="font-medium">{row.name}</p>
        <p className="text-xs text-muted-foreground">{row.brand}</p>
      </div>
    ),
  },
  {
    header: "Categoría",
    accessor: "category",
    sortable: true,
    hideOnMobile: true,
    cell: (_, row) => (
      <Badge variant="secondary" className="font-normal">{row.category}</Badge>
    ),
  },
  {
    header: "Stock",
    accessor: "stock",
    sortable: true,
    align: "right",
    cell: (value, row) => (
      <div className="flex items-center justify-end gap-2">
        <span className={cn("font-medium tabular-nums", row.status === "critical" && "text-destructive", row.status === "low" && "text-amber-500")}>
          {row.stock}
        </span>
        {row.stock <= row.minStock && (
          <AlertTriangle className={cn("h-3.5 w-3.5", row.status === "critical" ? "text-destructive" : "text-amber-500")} aria-hidden="true" />
        )}
      </div>
    ),
  },
  { header: "Stock Mín.", accessor: "minStock", sortable: true, align: "right", hideOnMobile: true },
  {
    header: "Precio",
    accessor: "price",
    sortable: true,
    align: "right",
    cell: (value) => <span className="tabular-nums">₲ {Number(value).toLocaleString("es-PY")}</span>,
  },
  { header: "Ubicación", accessor: "location", hideOnMobile: true, className: "text-xs text-muted-foreground" },
  {
    header: "Estado",
    accessor: "status",
    sortable: true,
    sortKey: "status",
    cell: (_, row) => <Badge variant={statusColors[row.status]}>{statusLabels[row.status]}</Badge>,
  },
];
