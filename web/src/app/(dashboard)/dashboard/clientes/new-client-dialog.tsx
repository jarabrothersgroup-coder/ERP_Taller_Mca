"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface ClientForm {
  name: string;
  email: string;
  phone: string;
  ruc: string;
  address: string;
  notes: string;
}

export function NewClientDialog({ onCreated }: { onCreated?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<ClientForm>({
    name: "",
    email: "",
    phone: "",
    ruc: "",
    address: "",
    notes: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof ClientForm, string>>>({});

  const createMutation = useMutation({
    mutationFn: (data: ClientForm) =>
      api.createClient({
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        ruc: data.ruc || undefined,
        address: data.address || undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients });
      setForm({ name: "", email: "", phone: "", ruc: "", address: "", notes: "" });
      setErrors({});
      setOpen(false);
      onCreated?.();
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ClientForm, string>> = {};
    if (!form.name.trim()) newErrors.name = "El nombre es obligatorio";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Email inválido";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate(form);
  };

  const updateField = <K extends keyof ClientForm>(field: K, value: ClientForm[K]) => {
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
          Nuevo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Registrá un nuevo cliente en el sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <FormField label="Nombre completo" htmlFor="c-name" required error={errors.name}>
              <Input
                id="c-name"
                placeholder="Nombre del cliente"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                hasError={!!errors.name}
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Email" htmlFor="c-email" error={errors.email}>
                <Input
                  id="c-email"
                  type="email"
                  placeholder="cliente@email.com"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  hasError={!!errors.email}
                />
              </FormField>

              <FormField label="Teléfono" htmlFor="c-phone">
                <Input
                  id="c-phone"
                  placeholder="0991 234567"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="RUC" htmlFor="c-ruc" helperText="Formato: 1234567-8">
              <Input
                id="c-ruc"
                placeholder="1234567-8"
                value={form.ruc}
                onChange={(e) => updateField("ruc", e.target.value)}
              />
            </FormField>

            <FormField label="Dirección" htmlFor="c-address">
              <Input
                id="c-address"
                placeholder="Dirección completa"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
              />
            </FormField>

            <FormField label="Notas" htmlFor="c-notes" helperText="Opcional">
              <Textarea
                id="c-notes"
                placeholder="Observaciones sobre el cliente…"
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
              {createMutation.isPending ? "Creando…" : "Crear Cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
