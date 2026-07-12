"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditLog } from "@/hooks/use-data";

interface ActivityEntry {
  id: string;
  accion: string;
  entidad: string;
  descripcion: string;
  createdAt: string;
}

const actionIcons: Record<string, string> = {
  CREAR: "➕",
  MODIFICAR: "✏️",
  ANULAR: "🚫",
  PAGAR: "💰",
  EMITIR: "📄",
};

export function RecentActivity() {
  const { data: rawActivities = [], isLoading: loading } = useAuditLog();
  const activities = (rawActivities as unknown as ActivityEntry[]).slice(0, 6);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton variant="circle" className="h-8 w-8 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton variant="text" className="h-4 w-3/4" />
              <Skeleton variant="text" className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((act) => (
        <div
          key={act.id}
          className="flex items-start gap-3 rounded-lg border border-border/50 p-3 hover:bg-accent/30 transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm shrink-0">
            {actionIcons[act.accion] || "📋"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm">{act.descripcion}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{act.createdAt}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
