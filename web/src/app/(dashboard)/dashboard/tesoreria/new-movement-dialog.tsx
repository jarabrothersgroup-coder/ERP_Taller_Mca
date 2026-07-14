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
import { queryKeys, useBankAccounts } from "@/hooks/use-data";
import { getTenantSlug } from "@/lib/api";

interface MovementForm {
  cuentaId: string;
  tipo: string;
  monto: string;
  concepto: string;
  fecha: string;
  observaciones: string;
}

const tipos = [
  { value: "INGRESO", label: "Ingreso" },
  { value: "EGRESO", label: "Egreso" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
];

export function NewMovementDialog({ onCreated }: { onCreated?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const { data: cuentas = [] } = useBankAccounts();
  const [form, setForm] = React.useState<MovementForm>({
    cuentaId: "",
    tipo: "INGRESO",
    monto: "",
    concepto: "",
    fecha: new Date().toISOString().split("T")[0],
    observaciones: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof MovementForm, string>>>({});

  const createMutation = useMutation({
    mutationFn: async (data: MovementForm) => {
      const res = await fetch("/finance/treasury/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": getTenantSlug() },
        body: JSON.stringify({
          cuentaId: data.cuentaId,
          tipo: data.tipo,
          monto: Number(data.monto),
          concepto: data.concepto,
          fecha: data.fecha,
          observaciones: data.observaciones || null,
        }),
      });
      if (!res.ok) throw new Error("Error creando movimiento");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.movements });
      qc.invalidateQueries({ queryKey: queryKeys.bankAccounts });
      setForm({ cuentaId: "", tipo: "INGRESO", monto: "", concepto: "", fecha: new Date().toISOString().split("T")[0], observaciones: "" });
      setErrors({});
      setOpen(false);
      onCreated?.();
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof MovementForm, string>> = {};
    if (!form.cuentaId) newErrors.cuentaId = "Seleccioná una cuenta";
    if (!form.monto || Number(form.monto) <= 0) newErrors.monto = "Ingresá un monto válido";
    if (!form.concepto.trim()) newErrors.concepto = "El concepto es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate(form);
  };

  const updateField = <K extends keyof MovementForm>(field: K, value: MovementForm[K]) => {
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
          Nuevo Movimiento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo Movimiento</DialogTitle>
            <DialogDescription>
              Registrá un movimiento bancario (ingreso, egreso o transferencia).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <FormField label="Cuenta Bancaria" htmlFor="m-cuenta" required error={errors.cuentaId}>
              <Select
                id="m-cuenta"
                value={form.cuentaId}
                onChange={(e) => updateField("cuentaId", e.target.value)}
                hasError={!!errors.cuentaId}
                placeholder="Seleccionar cuenta…"
              >
                <option value="" disabled>Seleccionar cuenta…</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} — ₲ {c.saldoActual.toLocaleString("es-PY")}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Tipo" htmlFor="m-tipo">
                <Select
                  id="m-tipo"
                  value={form.tipo}
                  onChange={(e) => updateField("tipo", e.target.value)}
                >
                  {tipos.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Monto (₲)" htmlFor="m-monto" required error={errors.monto}>
                <Input
                  id="m-monto"
                  type="number"
                  placeholder="0"
                  value={form.monto}
                  onChange={(e) => updateField("monto", e.target.value)}
                  hasError={!!errors.monto}
                />
              </FormField>
            </div>

            <FormField label="Concepto" htmlFor="m-concepto" required error={errors.concepto}>
              <Input
                id="m-concepto"
                placeholder="Descripción del movimiento"
                value={form.concepto}
                onChange={(e) => updateField("concepto", e.target.value)}
                hasError={!!errors.concepto}
              />
            </FormField>

            <FormField label="Fecha" htmlFor="m-fecha">
              <Input
                id="m-fecha"
                type="date"
                value={form.fecha}
                onChange={(e) => updateField("fecha", e.target.value)}
              />
            </FormField>

            <FormField label="Observaciones" htmlFor="m-obs" helperText="Opcional">
              <Textarea
                id="m-obs"
                placeholder="Notas adicionales…"
                value={form.observaciones}
                onChange={(e) => updateField("observaciones", e.target.value)}
                rows={2}
              />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={createMutation.isPending}>
              {createMutation.isPending ? "Registrando…" : "Registrar Movimiento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
