import * as React from "react";
import { Phone, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Column } from "@/components/ui/data-table";
import { statusConfig } from "./stats";
import type { UIMappedWhatsAppMessage as WAMessageRecord } from "@/lib/data-service";

export const columns: Column<WAMessageRecord>[] = [
  {
    header: "Cliente",
    accessor: "clienteName",
    sortable: true,
    cell: (_, row) => (
      <div>
        <p className="font-medium">{row.clienteName}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Phone className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">{row.phoneNumber}</span>
        </div>
      </div>
    ),
  },
  {
    header: "Plantilla",
    accessor: "template",
    sortable: true,
    hideOnMobile: true,
    cell: (_, row) => (
      <Badge variant="secondary" className="font-mono text-[10px]">
        {row.template === "CUSTOM" ? "Personalizado" : row.template}
      </Badge>
    ),
  },
  {
    header: "Mensaje",
    accessor: "messageText",
    className: "max-w-xs",
    cell: (value) => (
      <p className="text-xs text-muted-foreground truncate">{value as string}</p>
    ),
  },
  {
    header: "Estado",
    accessor: "status",
    sortable: true,
    sortKey: "status",
    cell: (_, row) => {
      const config = statusConfig[row.status];
      return (
        <Badge variant={config.variant} className="gap-1">
          <config.icon className="h-3 w-3" aria-hidden="true" />
          {config.label}
        </Badge>
      );
    },
  },
  {
    header: "Adjunto",
    accessor: "hasAttachment",
    cell: (_, row) =>
      row.hasAttachment ? (
        <div className="flex items-center gap-1">
          <FileText className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
          <span className="text-xs text-orange-500">PDF</span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    header: "Envío",
    accessor: "sentAt",
    sortable: true,
    className: "text-xs",
  },
];
