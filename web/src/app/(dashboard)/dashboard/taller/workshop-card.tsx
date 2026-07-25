"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Clock, Wrench } from "lucide-react";
import { statusConfig, statusColors } from "./status-config";
import type { WorkOrder } from "./types";

interface WorkshopCardProps {
  order: WorkOrder;
  onClick: (order: WorkOrder) => void;
  onAdvance?: (order: WorkOrder) => void;
}

/* ── Mobile OT Card ──────────────────────────── */
export function WorkshopCard({ order, onClick, onAdvance }: WorkshopCardProps) {
  const config = statusConfig[order.status];

  return (
    <Card
      className="cursor-pointer active:scale-[0.98] transition-transform shadow-sm"
      onClick={() => onClick(order)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: OT ID + Status */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-medium text-muted-foreground">
            {order.id}
          </span>
          <Badge variant={statusColors[order.status]} className="text-xs">
            <config.icon className="h-3 w-3 mr-1" aria-hidden="true" />
            {config.label}
          </Badge>
        </div>

        {/* Client + Vehicle */}
        <div>
          <p className="font-medium text-sm">{order.client}</p>
          <p className="text-xs text-muted-foreground">
            {order.vehicle} · {order.plate}
          </p>
        </div>

        {/* Footer: Cost + Deadline + Advance */}
        <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="tabular-nums font-medium">
              ₲ {Number(order.estimatedCost).toLocaleString("es-PY")}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {order.deadline}
            </span>
          </div>

          {onAdvance && order.status !== "completed" && order.status !== "cancelled" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 gap-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAdvance(order);
              }}
            >
              Avanzar
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
