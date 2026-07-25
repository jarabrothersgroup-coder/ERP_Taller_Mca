"use client";

import * as React from "react";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  useSensor, useSensors, PointerSensor, TouchSensor, closestCenter,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertTriangle, ClipboardCheck } from "lucide-react";
import { STATUS_FLOW, type KanbanOT, timeAgo, getStatusConfig, formatCurrency } from "./types";

interface HubSidebarProps {
  ordenes: KanbanOT[];
  selectedId: string | null;
  onSelect: (ot: KanbanOT) => void;
  onStatusChange: (ordenId: string, newStatus: string) => void;
}

export function HubSidebar({ ordenes, selectedId, onSelect, onStatusChange }: HubSidebarProps) {
  const [activeDraggingId, setActiveDraggingId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const activeDraggingOT = activeDraggingId ? ordenes.find(o => o.id === activeDraggingId) : null;

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

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveDraggingId(String(event.active.id));
  }, []);

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    setActiveDraggingId(null);
    const { active, over } = event;
    if (!over || !active) return;
    const ordenId = String(active.id);
    const targetStatus = String(over.id);
    const ot = ordenes.find(o => o.id === ordenId);
    if (!ot || ot.status === targetStatus) return;
    // Only allow valid forward/backward moves within the flow
    const validStatuses = STATUS_FLOW.map(s => s.key);
    if (!validStatuses.includes(targetStatus)) return;
    onStatusChange(ordenId, targetStatus);
  }, [ordenes, onStatusChange]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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

        {/* OT List grouped by status as Droppable columns */}
        <div className="space-y-2">
          {STATUS_FLOW.map(s => {
            const items = grouped[s.key] || [];
            return (
              <DroppableColumn key={s.key} statusKey={s.key} config={s}>
                <h4 className={cn("text-[11px] font-semibold uppercase tracking-wider px-1 mb-1", s.color)}>
                  {s.label} · {items.length}
                </h4>
                <div className="space-y-1">
                  {items.map(ot => (
                    <DraggableOTCard
                      key={ot.id}
                      ot={ot}
                      isSelected={selectedId === ot.id}
                      statusConfig={s}
                      onClick={() => onSelect(ot)}
                    />
                  ))}
                </div>
                {items.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/40 text-center py-3 border border-dashed border-muted-foreground/20 rounded-md mx-1">
                    Arrastrá OT aquí
                  </p>
                )}
              </DroppableColumn>
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

      {/* Drag Overlay */}
      <DragOverlay>
        {activeDraggingOT ? (
          <div className="rounded-lg border bg-card p-3 shadow-xl -rotate-2 opacity-90 space-y-2 w-64">
            <div className="flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", getStatusConfig(activeDraggingOT.status).dot)} />
              <span className="text-xs font-mono font-medium">OT #{activeDraggingOT.id.slice(0, 8)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{activeDraggingOT.vehicleName || "Sin vehículo"} · {activeDraggingOT.plate || "—"}</p>
            <p className="text-xs font-semibold">{formatCurrency(activeDraggingOT.totalCost)}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ── Droppable Column ────────────────────────── */

function DroppableColumn({ statusKey, config, children }: { statusKey: string; config: typeof STATUS_FLOW[0]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: statusKey });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border p-2 transition-all duration-150",
        isOver && "bg-accent/30 ring-2 ring-primary/30 scale-[1.01] shadow-md",
        config.border, config.bg,
      )}
    >
      {children}
    </div>
  );
}

/* ── Draggable OT Card ──────────────────────── */

function DraggableOTCard({ ot, isSelected, statusConfig, onClick }: { ot: KanbanOT; isSelected: boolean; statusConfig: typeof STATUS_FLOW[0]; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ot.id,
    data: { status: ot.status },
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : 'auto' as any,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "rounded-lg border p-2.5 transition-all duration-150 group cursor-grab active:cursor-grabbing",
        isSelected
          ? `${statusConfig.bg} ${statusConfig.border} shadow-sm ring-1 ring-offset-1 ${statusConfig.color.replace("text-", "ring-")}`
          : "bg-card border-transparent hover:bg-accent/50 hover:border-border"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <GripVertical className="h-3 w-3 text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusConfig.dot)} />
            <span className="text-xs font-mono font-medium truncate">OT #{ot.id.slice(0, 8)}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{ot.vehicleName || "Sin vehículo"} · {ot.plate || "—"}</p>
          <p className="text-[10px] text-muted-foreground/60 truncate">{ot.clientName || "Sin cliente"}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-[10px] tabular-nums text-muted-foreground/60">{timeAgo(ot.createdAt)}</span>
          {ot.totalCost && <span className="text-[10px] font-medium">{formatCurrency(ot.totalCost)}</span>}
          {ot.hvAlert && <AlertTriangle className="h-3 w-3 text-red-500" />}
        </div>
      </div>
    </div>
  );
}
