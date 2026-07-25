"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { statusConfig } from "./stats";
import { EditAppointmentDialog } from "./edit-appointment-dialog";
import type { UIMappedAppointment as AppointmentRecord } from "@/lib/data-service";

interface WeekViewProps {
  appointments: AppointmentRecord[];
  onRefresh: () => void;
}

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const ESTADO_BG: Record<string, string> = {
  RESERVADO: "bg-amber-500/20 border-amber-500/40",
  CONFIRMADO: "bg-emerald-500/20 border-emerald-500/40",
  PROCESADO_EN_ERP: "bg-blue-500/20 border-blue-500/40",
  AUSENTE: "bg-gray-500/20 border-gray-500/40",
  CANCELADO: "bg-red-500/20 border-red-500/40",
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getAppointmentsForDate(appts: AppointmentRecord[], date: Date): AppointmentRecord[] {
  return appts.filter((a) => {
    const aptDate = new Date(a.fechaTurno + "T12:00:00");
    return aptDate.toDateString() === date.toDateString();
  });
}

export function WeekView({ appointments, onRefresh }: WeekViewProps) {
  const { toast: t, ToastContainer } = useToast();
  const [weekStart, setWeekStart] = React.useState(() => getWeekStart(new Date()));
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = React.useState<AppointmentRecord | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);

  const updateMut = useMutation({
    mutationFn: (params: { id: string; fechaTurno: string }) =>
      api.request(`/scheduling/appointments/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fechaTurno: params.fechaTurno }),
      }),
    onSuccess: () => {
      t.success("Turno movido correctamente");
      onRefresh();
    },
    onError: (err: Error) => t.error(err.message),
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date();

  const goPrevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const goNextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const goToday = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    if (!draggedId) return;
    const newDateStr = formatDate(targetDate);
    updateMut.mutate({ id: draggedId, fechaTurno: newDateStr });
    setDraggedId(null);
  };

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-blue-500" />
          <span className="text-sm font-medium">
            {weekStart.getDate()} {weekStart.toLocaleDateString("es-PY", { month: "long" })} —{" "}
            {weekEnd.getDate()} {weekEnd.toLocaleDateString("es-PY", { month: "long", year: "numeric" })}
          </span>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={goPrevWeek} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button variant="secondary" size="sm" onClick={goToday}>
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={goNextWeek} className="gap-1">
            Siguiente <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats mini-bar */}
      <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
        <span>📅 {appointments.length} turnos</span>
        <span className="text-emerald-500">
          ✅ {appointments.filter((a) => a.estado === "CONFIRMADO").length} confirmados
        </span>
        <span className="text-amber-500">
          ⏳ {appointments.filter((a) => a.estado === "RESERVADO").length} pendientes
        </span>
      </div>

      {/* Week header */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const isToday = day.toDateString() === today.toDateString();
          return (
            <div
              key={i}
              className={cn(
                "text-center py-2 text-sm font-semibold rounded-lg",
                isToday ? "text-blue-500 bg-blue-500/10" : "text-muted-foreground",
              )}
            >
              <span className="block">{DAY_LABELS[i]}</span>
              <span className={cn("block text-lg", isToday && "text-blue-500")}>{day.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 min-h-[300px]">
        {days.map((day, i) => {
          const isToday = day.toDateString() === today.toDateString();
          const dayAppts = getAppointmentsForDate(appointments, day);

          return (
            <div
              key={i}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, day)}
              className={cn(
                "rounded-xl p-2 min-h-[200px] border transition-colors",
                isToday ? "border-blue-500/50 bg-blue-500/5" : "border-border bg-card/50",
              )}
            >
              <div className="space-y-1.5">
                {dayAppts.map((apt) => (
                  <div
                    key={apt.id}
                    draggable
                    onClick={() => { setEditingAppointment(apt); setEditDialogOpen(true); }}
                    onDragStart={(e) => handleDragStart(e, apt.id)}
                    className={cn(
                      "border rounded-lg px-2.5 py-1.5 text-xs cursor-pointer active:cursor-grabbing hover:opacity-80 transition-all select-none",
                      ESTADO_BG[apt.estado] || "bg-blue-500/20 border-blue-500/40",
                    )}
                    title={`${apt.clienteNombre} — ${apt.vehiculoMarca} ${apt.vehiculoModelo} (${apt.horaTurno})`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {apt.horaTurno}
                      </span>
                      <Badge
                        variant={statusConfig[apt.estado]?.variant || "secondary"}
                        className="text-[9px] px-1 py-0 h-4"
                      >
                        {statusConfig[apt.estado]?.label || apt.estado}
                      </Badge>
                    </div>
                    <div className="text-foreground mt-0.5 truncate font-medium flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground shrink-0" />
                      {apt.clienteNombre}
                    </div>
                    <div className="text-muted-foreground text-[10px] truncate flex items-center gap-1">
                      <Car className="h-3 w-3 shrink-0" />
                      {apt.vehiculoMarca} {apt.vehiculoModelo} — {apt.vehiculoChapa}
                    </div>
                  </div>
                ))}
              </div>
              {dayAppts.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 text-center pt-4">Sin turnos</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground pt-2 border-t">
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1">
            <span className={cn(
              "w-2.5 h-2.5 rounded-full",
              key === "RESERVADO" ? "bg-amber-500" :
              key === "CONFIRMADO" ? "bg-emerald-500" :
              key === "PROCESADO_EN_ERP" ? "bg-blue-500" :
              key === "AUSENTE" ? "bg-gray-500" :
              "bg-red-500"
            )} />
            {cfg.label}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground/60">
          Arrastrá un turno para cambiar su fecha
        </span>
      </div>

      {ToastContainer}

      <EditAppointmentDialog
        appointment={editingAppointment}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUpdated={onRefresh}
      />
    </div>
  );
}
