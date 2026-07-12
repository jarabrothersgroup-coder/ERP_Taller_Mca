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
import { queryKeys } from "@/hooks/use-data";

interface AccountForm {
  codigo: string;
  nombre: string;
  tipo: string;
  nivel: string;
  aceptaMovimientos: boolean;
  moneda: string;
  descripcion: string;
}

const tipos = ["ACTIVO", "PASIVO", "PATRIMONIO", "INGRESO", "GASTO", "COSTO"];

export function NewAccountDialog({ onCreated }: { onCreated?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<AccountForm>({
    codigo: "",
    nombre: "",
    tipo: "ACTIVO",
    nivel: "3",
    aceptaMovimientos: true,
    moneda: "PYG",
    descripcion: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof AccountForm, string>>>({});

  const createMutation = useMutation({
    mutationFn: async (data: AccountForm) => {
      const res = await fetch("/finance/accounting/cuentas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": "demo" },
        body: JSON.stringify({
          codigo: data.codigo,
          nombre: data.nombre,
          tipo: data.tipo,
          nivel: Number(data.nivel),
          aceptaMovimientos: data.aceptaMovimientos,
          moneda: data.moneda,
          descripcion: data.descripcion || null,
        }),
      });
      if (!res.ok) throw new Error("Error creando cuenta");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      setForm({ codigo: "", nombre: "", tipo: "ACTIVO", nivel: "3", aceptaMovimientos: true, moneda: "PYG", descripcion: "" });
      setErrors({});
      setOpen(false);
      onCreated?.();
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof AccountForm, string>> = {};
    if (!form.codigo.trim()) newErrors.codigo = "El código es obligatorio";
    if (!form.nombre.trim()) newErrors.nombre = "El nombre es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate(form);
  };

  const updateField = <K extends keyof AccountForm>(field: K, value: AccountForm[K]) => {
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
          Nueva Cuenta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva Cuenta Contable</DialogTitle>
            <DialogDescription>
              Agregá una cuenta al plan de cuentas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Código" htmlFor="a-codigo" required error={errors.codigo}>
                <Input
                  id="a-codigo"
                  placeholder="1.1.01"
                  value={form.codigo}
                  onChange={(e) => updateField("codigo", e.target.value)}
                  hasError={!!errors.codigo}
                  className="font-mono"
                />
              </FormField>

              <FormField label="Nivel" htmlFor="a-nivel">
                <Select
                  id="a-nivel"
                  value={form.nivel}
                  onChange={(e) => updateField("nivel", e.target.value)}
                >
                  <option value="1">1 — Raíz</option>
                  <option value="2">2 — Subgrupo</option>
                  <option value="3">3 — Cuenta</option>
                </Select>
              </FormField>
            </div>

            <FormField label="Nombre" htmlFor="a-nombre" required error={errors.nombre}>
              <Input
                id="a-nombre"
                placeholder="Nombre de la cuenta"
                value={form.nombre}
                onChange={(e) => updateField("nombre", e.target.value)}
                hasError={!!errors.nombre}
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Tipo" htmlFor="a-tipo">
                <Select
                  id="a-tipo"
                  value={form.tipo}
                  onChange={(e) => updateField("tipo", e.target.value)}
                >
                  {tipos.map((t) => (
                    <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Moneda" htmlFor="a-moneda">
                <Select
                  id="a-moneda"
                  value={form.moneda}
                  onChange={(e) => updateField("moneda", e.target.value)}
                >
                  <option value="PYG">Guaraní (PYG)</option>
                  <option value="USD">Dólar (USD)</option>
                </Select>
              </FormField>
            </div>

            <FormField label="Descripción" htmlFor="a-descripcion" helperText="Opcional">
              <Textarea
                id="a-descripcion"
                placeholder="Descripción de la cuenta…"
                value={form.descripcion}
                onChange={(e) => updateField("descripcion", e.target.value)}
                rows={2}
              />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={createMutation.isPending}>
              {createMutation.isPending ? "Creando…" : "Crear Cuenta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
