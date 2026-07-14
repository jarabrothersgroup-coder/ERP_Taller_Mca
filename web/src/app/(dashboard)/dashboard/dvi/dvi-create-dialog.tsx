"use client";

import * as React from "react";
import { Plus, ClipboardCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useWorkOrders } from "@/hooks/use-data";

interface CreateForm {
  ordenTrabajoId: string;
  inspector: string;
  observaciones: string;
}

export function DVICreateDialog({ onCreated }: { onCreated?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<CreateForm>({
    ordenTrabajoId: "",
    inspector: "",
    observaciones: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof CreateForm, string>>>({});

  // Fetch available work orders when dialog opens
  const { data: workOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["work-orders", "all"],
    queryFn: () => api.listWorkOrders({ limit: 100 }),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateForm) => {
      return api.createDVIInspection({
        ordenTrabajoId: data.ordenTrabajoId,
        inspector: data.inspector || undefined,
        observaciones: data.observaciones || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dvi-inspections"] });
      setForm({ ordenTrabajoId: "", inspector: "", observaciones: "" });
      setErrors({});
      setOpen(false);
      onCreated?.();
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CreateForm, string>> = {};
    if (!form.ordenTrabajoId) newErrors.ordenTrabajoId = "Seleccioná una orden de trabajo";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate(form);
  };

  const updateField = <K extends keyof CreateForm>(field: K, value: CreateForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const orderOptions = workOrders.map((o) => ({
    value: o.id,
    label: [o.vehiculo, o.cliente, o.plate].filter(Boolean).join(" — ") || o.id,
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva Inspección
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva Inspección Vehicular (DVI)</DialogTitle>
            <DialogDescription>
              Creá una inspección digital vinculada a una orden de trabajo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <FormField label="Orden de Trabajo" htmlFor="dvi-orden" required error={errors.ordenTrabajoId}>
              <Select
                id="dvi-orden"
                value={form.ordenTrabajoId}
                onChange={(e) => updateField("ordenTrabajoId", e.target.value)}
                placeholder={ordersLoading ? "Cargando órdenes…" : "Seleccionar orden…"}
                options={orderOptions}
                disabled={ordersLoading}
                hasError={!!errors.ordenTrabajoId}
              />
            </FormField>

            <FormField label="Inspector" htmlFor="dvi-inspector">
              <Input
                id="dvi-inspector"
                placeholder="Nombre del inspector"
                value={form.inspector}
                onChange={(e) => updateField("inspector", e.target.value)}
              />
            </FormField>

            <FormField label="Observaciones" htmlFor="dvi-obs">
              <Textarea
                id="dvi-obs"
                placeholder="Notas iniciales de la inspección…"
                value={form.observaciones}
                onChange={(e) => updateField("observaciones", e.target.value)}
                rows={4}
              />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={createMutation.isPending}>
              {createMutation.isPending ? "Creando…" : "Crear Inspección"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
