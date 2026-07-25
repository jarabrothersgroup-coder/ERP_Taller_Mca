"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { statusConfig } from "./stats";
import type { UIMappedAppointment as AppointmentRecord } from "@/lib/data-service";

interface EditAppointmentDialogProps {
  appointment: AppointmentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const estadoOptions = Object.entries(statusConfig).map(([key, cfg]) => ({
  value: key,
  label: cfg.label,
}));

export function EditAppointmentDialog({ appointment, open, onOpenChange, onUpdated }: EditAppointmentDialogProps) {
  const { toast: t } = useToast();
  const [estado, setEstado] = React.useState("");
  const [fechaTurno, setFechaTurno] = React.useState("");
  const [horaTurno, setHoraTurno] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (appointment && open) {
      setEstado(appointment.estado || "");
      setFechaTurno(appointment.fechaTurno || "");
      setHoraTurno(appointment.horaTurno || "");
      setNotas("");
    }
  }, [appointment, open]);

  const handleChangeEstado = async () => {
    if (!appointment || !estado || estado === appointment.estado) return;
    setSaving(true);
    try {
      await api.request(`/scheduling/appointments/${appointment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      });
      t.success(`Estado cambiado a ${statusConfig[estado]?.label || estado}`);
      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      t.error(err.message || "Error cambiando estado");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDate = async () => {
    if (!appointment) return;
    setSaving(true);
    try {
      await api.request(`/scheduling/appointments/${appointment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fechaTurno, horaTurno }),
      });
      t.success("Fecha/hora actualizadas");
      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      t.error(err.message || "Error actualizando fecha");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!appointment || !notas.trim()) return;
    setSaving(true);
    try {
      await api.request(`/scheduling/appointments/${appointment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ notas }),
      });
      t.success("Notas guardadas");
      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      t.error(err.message || "Error guardando notas");
    } finally {
      setSaving(false);
    }
  };

  if (!appointment) return null;

  const canChangeEstado = estado !== appointment.estado;
  const canUpdateDate = fechaTurno !== appointment.fechaTurno || horaTurno !== appointment.horaTurno;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Turno</DialogTitle>
          <DialogDescription>
            {appointment.clienteNombre} — {appointment.vehiculoMarca} {appointment.vehiculoModelo}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {/* Estado */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block font-medium">Estado</label>
            <div className="flex gap-2">
              <Select value={estado} onChange={(e) => setEstado(e.target.value)} className="flex-1">
                {estadoOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
              <Button size="sm" onClick={handleChangeEstado} disabled={!canChangeEstado || saving}>
                {saving ? "..." : "Aplicar"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Actual: <strong>{statusConfig[appointment.estado]?.label || appointment.estado}</strong>
            </p>
          </div>

          {/* Fecha y Hora */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block font-medium">Fecha y Hora</label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={fechaTurno} onChange={(e) => setFechaTurno(e.target.value)} />
              <Input type="time" value={horaTurno} onChange={(e) => setHoraTurno(e.target.value)} />
            </div>
            {canUpdateDate && (
              <Button size="sm" className="mt-2" onClick={handleUpdateDate} disabled={saving}>
                {saving ? "..." : "Actualizar Fecha/Hora"}
              </Button>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block font-medium">Agregar Nota</label>
            <Textarea
              placeholder="Nota para este turno..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
            />
            {notas.trim() && (
              <Button size="sm" className="mt-2" onClick={handleSaveNotes} disabled={saving}>
                {saving ? "..." : "Guardar Nota"}
              </Button>
            )}
          </div>

          {/* Info */}
          <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p><strong>Cliente:</strong> {appointment.clienteNombre} — {appointment.clientePhone}</p>
            <p><strong>Vehículo:</strong> {appointment.vehiculoMarca} {appointment.vehiculoModelo} — {appointment.vehiculoChapa}</p>
            <p><strong>Servicio:</strong> {appointment.tipoServicio}</p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
