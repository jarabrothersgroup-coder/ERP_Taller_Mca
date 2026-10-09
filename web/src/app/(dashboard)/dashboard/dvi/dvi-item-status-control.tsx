"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export type DVIItemEstado = "OK" | "REQUIERE_ATENCION" | "CRITICO";

const ESTADOS: Array<{
  value: DVIItemEstado;
  label: string;
  icon: typeof CheckCircle2;
  activeClass: string;
}> = [
  {
    value: "OK",
    label: "OK",
    icon: CheckCircle2,
    activeClass:
      "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-600 hover:text-white",
  },
  {
    value: "REQUIERE_ATENCION",
    label: "Requiere atención",
    icon: AlertTriangle,
    activeClass:
      "bg-amber-500 border-amber-500 text-white hover:bg-amber-500 hover:text-white",
  },
  {
    value: "CRITICO",
    label: "Crítico",
    icon: XCircle,
    activeClass:
      "bg-red-600 border-red-600 text-white hover:bg-red-600 hover:text-white",
  },
];

interface DVIItemStatusControlProps {
  itemId: string;
  /** Current item status; unknown values render with no active option */
  estado: string;
}

/**
 * T-47 item 4 — Semáforo de estado por ítem del DVI.
 *
 * Three-state control (OK / REQUIERE_ATENCION / CRITICO) that PATCHes
 * /dvi/items/:itemId/status and refreshes the DVI inspections query.
 */
export function DVIItemStatusControl({ itemId, estado }: DVIItemStatusControlProps) {
  const qc = useQueryClient();
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const statusMutation = useMutation({
    mutationFn: (next: DVIItemEstado) => api.updateDVIItemStatus(itemId, next),
    onSuccess: () => {
      setFeedback(null);
      qc.invalidateQueries({ queryKey: ["dvi-inspections"] });
      qc.invalidateQueries({ queryKey: ["dvi-detail"] });
    },
    onError: (err) => {
      setFeedback(
        err instanceof Error ? err.message : "Error al actualizar el estado del ítem",
      );
    },
  });

  return (
    <div className="space-y-1.5">
      <div role="group" aria-label="Estado del ítem" className="flex flex-wrap gap-1.5">
        {ESTADOS.map(({ value, label, icon: Icon, activeClass }) => {
          const isActive = estado === value;
          return (
            <Button
              key={value}
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={isActive}
              disabled={statusMutation.isPending}
              onClick={() => {
                if (!isActive) statusMutation.mutate(value);
              }}
              className={cn(
                "gap-1.5 text-xs h-8 px-2.5",
                isActive && activeClass,
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </Button>
          );
        })}
      </div>
      {feedback && (
        <p role="alert" className="text-xs text-destructive">
          {feedback}
        </p>
      )}
    </div>
  );
}
