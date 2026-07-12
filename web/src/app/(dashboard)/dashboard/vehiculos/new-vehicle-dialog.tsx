"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { queryKeys } from "@/hooks/use-data";

interface VehicleForm {
  plate: string;
  vin: string;
  brand: string;
  model: string;
  year: string;
  engineType: string;
  kilometraje: string;
}

const engineTypes = ["Nafta", "Diesel", "Híbrido", "Eléctrico", "GNC"];

export function NewVehicleDialog({ onCreated }: { onCreated?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<VehicleForm>({
    plate: "",
    vin: "",
    brand: "",
    model: "",
    year: "",
    engineType: "Nafta",
    kilometraje: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof VehicleForm, string>>>({});

  const createMutation = useMutation({
    mutationFn: async (data: VehicleForm) => {
      const res = await fetch("/workshop/vehiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": "demo" },
        body: JSON.stringify({
          plate: data.plate.toUpperCase(),
          vin: data.vin || null,
          brand: data.brand,
          model: data.model,
          year: data.year ? Number(data.year) : null,
          engineType: data.engineType,
          kilometraje: data.kilometraje ? Number(data.kilometraje) : null,
        }),
      });
      if (!res.ok) throw new Error("Error creando vehículo");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vehicles });
      setForm({ plate: "", vin: "", brand: "", model: "", year: "", engineType: "Nafta", kilometraje: "" });
      setErrors({});
      setOpen(false);
      onCreated?.();
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof VehicleForm, string>> = {};
    if (!form.plate.trim()) newErrors.plate = "La matrícula es obligatoria";
    if (!form.brand.trim()) newErrors.brand = "La marca es obligatoria";
    if (!form.model.trim()) newErrors.model = "El modelo es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate(form);
  };

  const updateField = <K extends keyof VehicleForm>(field: K, value: VehicleForm[K]) => {
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
          Nuevo Vehículo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo Vehículo</DialogTitle>
            <DialogDescription>
              Registrá un nuevo vehículo en el sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Matrícula" htmlFor="v-plate" required error={errors.plate}>
                <Input
                  id="v-plate"
                  placeholder="ABC 1234"
                  value={form.plate}
                  onChange={(e) => updateField("plate", e.target.value)}
                  hasError={!!errors.plate}
                  className="uppercase"
                />
              </FormField>

              <FormField label="VIN" htmlFor="v-vin" helperText="17 caracteres">
                <Input
                  id="v-vin"
                  placeholder="1HGBH41JXMN109186"
                  value={form.vin}
                  onChange={(e) => updateField("vin", e.target.value.toUpperCase())}
                  maxLength={17}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Marca" htmlFor="v-brand" required error={errors.brand}>
                <Input
                  id="v-brand"
                  placeholder="Toyota"
                  value={form.brand}
                  onChange={(e) => updateField("brand", e.target.value)}
                  hasError={!!errors.brand}
                />
              </FormField>

              <FormField label="Modelo" htmlFor="v-model" required error={errors.model}>
                <Input
                  id="v-model"
                  placeholder="Corolla"
                  value={form.model}
                  onChange={(e) => updateField("model", e.target.value)}
                  hasError={!!errors.model}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Año" htmlFor="v-year">
                <Input
                  id="v-year"
                  type="number"
                  placeholder="2024"
                  value={form.year}
                  onChange={(e) => updateField("year", e.target.value)}
                  min={1900}
                  max={2030}
                />
              </FormField>

              <FormField label="Motor" htmlFor="v-engine">
                <Select
                  id="v-engine"
                  value={form.engineType}
                  onChange={(e) => updateField("engineType", e.target.value)}
                >
                  {engineTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Kilometraje" htmlFor="v-km">
                <Input
                  id="v-km"
                  type="number"
                  placeholder="0"
                  value={form.kilometraje}
                  onChange={(e) => updateField("kilometraje", e.target.value)}
                />
              </FormField>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={createMutation.isPending}>
              {createMutation.isPending ? "Creando…" : "Crear Vehículo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
