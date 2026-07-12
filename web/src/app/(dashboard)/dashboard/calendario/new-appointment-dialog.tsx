"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { queryKeys, useClients, useVehicles } from "@/hooks/use-data";

interface AppointmentForm {
  clienteId: string;
  vehiculoId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tipoServicio: string;
  estado: string;
  notas: string;
}

const tiposServicio = [
  "Service General",
  "Cambio de Aceite",
  "Frenos",
  "Diagnóstico DTC",
  "Revisión Eléctrica",
  "Mantenimiento Preventivo",
  "Reparación Motor",
  "Suspensión",
  "Climatización",
  "Otro",
];

export function NewAppointmentDialog({ onCreated }: { onCreated?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const { data: clientes = [] } = useClients();
  const { data: vehiculos = [] } = useVehicles();
  const [form, setForm] = React.useState<AppointmentForm>({
    clienteId: "",
    vehiculoId: "",
    fecha: new Date().toISOString().split("T")[0],
    horaInicio: "08:00",
    horaFin: "09:00",
    tipoServicio: "Service General",
    estado: "PROGRAMADO",
    notas: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof AppointmentForm, string>>>({});

  const createMutation = useMutation({
    mutationFn: async (data: AppointmentForm) => {
      const res = await fetch("/workshop/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": "demo" },
        body: JSON.stringify({
          clienteId: data.clienteId || null,
          vehiculoId: data.vehiculoId || null,
          fecha: data.fecha,
          horaInicio: data.horaInicio,
          horaFin: data.horaFin,
          tipoServicio: data.tipoServicio,
          estado: data.estado,
          notas: data.notas || null,
        }),
      });
      if (!res.ok) throw new Error("Error creando turno");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.appointments });
      setForm({
        clienteId: "", vehiculoId: "",
        fecha: new Date().toISOString().split("T")[0],
        horaInicio: "08:00", horaFin: "09:00",
        tipoServicio: "Service General", estado: "PROGRAMADO", notas: "",
      });
      setErrors({});
      setOpen(false);
      onCreated?.();
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof AppointmentForm, string>> = {};
    if (!form.fecha) newErrors.fecha = "La fecha es obligatoria";
    if (!form.horaInicio) newErrors.horaInicio = "La hora de inicio es obligatoria";
    if (!form.tipoServicio.trim()) newErrors.tipoServicio = "El tipo de servicio es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate(form);
  };

  const updateField = <K extends keyof AppointmentForm>(field: K, value: AppointmentForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nuevo Turno
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo Turno</DialogTitle>
            <DialogDescription>
              Agendá un turno para un cliente en el taller.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <FormField label="Cliente" htmlFor="ap-cliente">
              <Select
                id="ap-cliente"
                value={form.clienteId}
                onChange={(e) => updateField("clienteId", e.target.value)}
                placeholder="Seleccionar cliente…"
              >
                <option value="">Sin cliente asignado</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Vehículo" htmlFor="ap-vehiculo">
              <Select
                id="ap-vehiculo"
                value={form.vehiculoId}
                onChange={(e) => updateField("vehiculoId", e.target.value)}
                placeholder="Seleccionar vehículo…"
              >
                <option value="">Sin vehículo asignado</option>
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} — {v.plate ?? "S/PLACA"}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Fecha" htmlFor="ap-fecha" required error={errors.fecha}>
              <Input
                id="ap-fecha"
                type="date"
                value={form.fecha}
                onChange={(e) => updateField("fecha", e.target.value)}
                hasError={!!errors.fecha}
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Hora Inicio" htmlFor="ap-hora-inicio" required error={errors.horaInicio}>
                <Input
                  id="ap-hora-inicio"
                  type="time"
                  value={form.horaInicio}
                  onChange={(e) => updateField("horaInicio", e.target.value)}
                  hasError={!!errors.horaInicio}
                />
              </FormField>

              <FormField label="Hora Fin" htmlFor="ap-hora-fin">
                <Input
                  id="ap-hora-fin"
                  type="time"
                  value={form.horaFin}
                  onChange={(e) => updateField("horaFin", e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Tipo de Servicio" htmlFor="ap-servicio" required error={errors.tipoServicio}>
              <Select
                id="ap-servicio"
                value={form.tipoServicio}
                onChange={(e) => updateField("tipoServicio", e.target.value)}
                hasError={!!errors.tipoServicio}
              >
                {tiposServicio.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Notas" htmlFor="ap-notas" helperText="Opcional">
              <Textarea
                id="ap-notas"
                placeholder="Observaciones del turno…"
                value={form.notas}
                onChange={(e) => updateField("notas", e.target.value)}
                rows={2}
              />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={createMutation.isPending}>
              {createMutation.isPending ? "Agendando…" : "Agendar Turno"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
