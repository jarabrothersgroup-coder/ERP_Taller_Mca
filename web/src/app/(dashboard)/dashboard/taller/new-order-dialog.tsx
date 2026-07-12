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
import { api } from "@/lib/api";
import { queryKeys } from "@/hooks/use-data";
import type { NewOrderForm } from "./types";
import { technicians } from "./status-config";

export function NewOrderDialog({ onCreated }: { onCreated: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<NewOrderForm>({
    client: "",
    vehicle: "",
    plate: "",
    service: "",
    technician: "",
    notes: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof NewOrderForm, string>>>({});

  const createMutation = useMutation({
    mutationFn: async (data: NewOrderForm) => {
      // Create client first
      const client = await api.createClient({ name: data.client });
      // Create vehicle
      const vehicleRes = await fetch("/workshop/vehiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": "demo" },
        body: JSON.stringify({
          plate: data.plate.toUpperCase(),
          brand: data.vehicle.split(" ")[0] || "Sin marca",
          model: data.vehicle,
          clientId: client.id,
        }),
      });
      const vehicle = await vehicleRes.json();
      // Create work order
      const orderRes = await fetch("/workshop/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": "demo" },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          clientId: client.id,
          description: data.service,
          status: "Presupuestado",
        }),
      });
      return orderRes.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workOrders });
      qc.invalidateQueries({ queryKey: queryKeys.clients });
      qc.invalidateQueries({ queryKey: queryKeys.vehicles });
      setForm({ client: "", vehicle: "", plate: "", service: "", technician: "", notes: "" });
      setErrors({});
      setOpen(false);
      onCreated();
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof NewOrderForm, string>> = {};
    if (!form.client.trim()) newErrors.client = "El cliente es obligatorio";
    if (!form.vehicle.trim()) newErrors.vehicle = "El vehículo es obligatorio";
    if (!form.plate.trim()) newErrors.plate = "La matrícula es obligatoria";
    if (!form.service.trim()) newErrors.service = "El servicio es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate(form);
  };

  const updateField = <K extends keyof NewOrderForm>(field: K, value: NewOrderForm[K]) => {
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
          Nueva Orden de Trabajo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva Orden de Trabajo</DialogTitle>
            <DialogDescription>
              Completá los datos para crear una nueva orden en el taller.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Cliente" htmlFor="client" required error={errors.client}>
                <Input
                  id="client"
                  placeholder="Nombre del cliente"
                  value={form.client}
                  onChange={(e) => updateField("client", e.target.value)}
                  hasError={!!errors.client}
                />
              </FormField>

              <FormField label="Matrícula" htmlFor="plate" required error={errors.plate}>
                <Input
                  id="plate"
                  placeholder="ABC 1234"
                  value={form.plate}
                  onChange={(e) => updateField("plate", e.target.value)}
                  hasError={!!errors.plate}
                  className="uppercase"
                />
              </FormField>
            </div>

            <FormField label="Vehículo" htmlFor="vehicle" required error={errors.vehicle}>
              <Input
                id="vehicle"
                placeholder="Marca, modelo y año"
                value={form.vehicle}
                onChange={(e) => updateField("vehicle", e.target.value)}
                hasError={!!errors.vehicle}
              />
            </FormField>

            <FormField label="Servicio a realizar" htmlFor="service" required error={errors.service}>
              <Textarea
                id="service"
                placeholder="Descripción del servicio solicitado"
                value={form.service}
                onChange={(e) => updateField("service", e.target.value)}
                hasError={!!errors.service}
                rows={2}
              />
            </FormField>

            <FormField label="Técnico asignado" htmlFor="technician">
              <Select
                id="technician"
                value={form.technician}
                onChange={(e) => updateField("technician", e.target.value)}
                placeholder="Seleccionar técnico…"
              >
                <option value="">Sin asignar</option>
                {technicians.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Notas adicionales" htmlFor="notes" helperText="Opcional">
              <Textarea
                id="notes"
                placeholder="Observaciones, instrucciones especiales…"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={2}
              />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={createMutation.isPending}>
              {createMutation.isPending ? "Creando…" : "Crear Orden"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
