"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, ClipboardCheck } from "lucide-react";
import { STATUS_FLOW, type KanbanOT, timeAgo } from "./types";

interface HubSidebarProps {
  ordenes: KanbanOT[];
  selectedId: string | null;
  onSelect: (ot: KanbanOT) => void;
}

export function HubSidebar({ ordenes, selectedId, onSelect }: HubSidebarProps) {
  const grouped = React.useMemo(() => {
    const groups: Record<string, KanbanOT[]> = {};
    for (const s of STATUS_FLOW) groups[s.key] = [];
    for (const ot of ordenes) {
      if (groups[ot.status]) groups[ot.status].push(ot);
      else groups.Presupuestado.push(ot);
    }
    return groups;
  }, [ordenes]);

  const counts = React.useMemo(() => {
    return STATUS_FLOW.map(s => ({ ...s, count: (grouped[s.key] || []).length }));
  }, [grouped]);

  return (
    <div className="space-y-3">
      {/* Status summary chips */}
      <div className="flex flex-wrap gap-1.5">
        {counts.map(s => {
          const first = grouped[s.key]?.[0];
          return (
            <button
              key={s.key}
              onClick={() => { if (first) onSelect(first); }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border",
                s.count > 0
                  ? `${s.bg} ${s.color} ${s.border} hover:shadow-sm`
                  : "text-muted-foreground/50 border-muted bg-muted/30"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
              {s.count}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* OT List grouped by status */}
      <div className="space-y-2">
        {STATUS_FLOW.map(s => {
          const items = grouped[s.key] || [];
          if (items.length === 0) return null;
          return (
            <div key={s.key}>
              <h4 className={cn("text-[11px] font-semibold uppercase tracking-wider px-1 mb-1", s.color)}>
                {s.label} · {items.length}
              </h4>
              <div className="space-y-1">
                {items.map(ot => (
                  <button
                    key={ot.id}
                    onClick={() => onSelect(ot)}
                    className={cn(
                      "w-full text-left rounded-lg border p-2.5 transition-all duration-150 group",
                      selectedId === ot.id
                        ? `${s.bg} ${s.border} shadow-sm ring-1 ring-offset-1 ${s.color.replace("text-", "ring-")}`
                        : "border-transparent hover:bg-accent/50 hover:border-border"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)} />
                          <span className="text-xs font-mono font-medium truncate">OT #{ot.id.slice(0, 8)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {ot.vehicleName || "Sin vehículo"} · {ot.plate || "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 truncate">{ot.clientName || "Sin cliente"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-[10px] tabular-nums text-muted-foreground/60">{timeAgo(ot.createdAt)}</span>
                        {ot.hvAlert && <AlertTriangle className="h-3 w-3 text-red-500" />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {ordenes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay órdenes activas</p>
          <p className="text-xs">Crea una nueva desde el botón superior</p>
        </div>
      )}
    </div>
  );
}
