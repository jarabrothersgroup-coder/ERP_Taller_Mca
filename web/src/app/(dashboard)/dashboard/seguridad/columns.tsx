import * as React from "react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { actionConfig, entityColors } from "./stats";
import type { UIMappedAuditEntry as AuditRecord } from "@/lib/data-service";

export const columns: Column<AuditRecord>[] = [
  {
    header: "Usuario",
    accessor: "usuario",
    sortable: true,
    cell: (_, row) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
          {row.usuario.charAt(0)}
        </div>
        <span className="font-medium text-sm">{row.usuario}</span>
      </div>
    ),
  },
  {
    header: "Acción",
    accessor: "accion",
    sortable: true,
    sortKey: "accion",
    cell: (_, row) => {
      const config = actionConfig[row.accion] || { label: row.accion, variant: "secondary" as const, icon: FileText };
      return (
        <Badge variant={config.variant} className="gap-1">
          <config.icon className="h-3 w-3" aria-hidden="true" />
          {config.label}
        </Badge>
      );
    },
  },
  {
    header: "Entidad",
    accessor: "entidad",
    sortable: true,
    cell: (_, row) => (
      <Badge variant="secondary" className={cn("font-normal", entityColors[row.entidad] || "")}>
        {row.entidad}
      </Badge>
    ),
  },
  {
    header: "Descripción",
    accessor: "descripcion",
    sortable: true,
    cell: (_, row) => (
      <div>
        <p className="text-sm">{row.descripcion}</p>
        <p className="text-xs text-muted-foreground font-mono">{row.entidadId}</p>
      </div>
    ),
  },
  {
    header: "Cambios",
    accessor: "valorAnterior",
    hideOnMobile: true,
    cell: (_, row) =>
      row.valorAnterior ? (
        <div className="text-xs">
          <span className="text-destructive line-through">{row.valorAnterior}</span>
          <span className="mx-1 text-muted-foreground">→</span>
          <span className="text-emerald-500">{row.valorNuevo}</span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    header: "Fecha",
    accessor: "createdAt",
    sortable: true,
    className: "text-xs",
    hideOnMobile: true,
  },
];
