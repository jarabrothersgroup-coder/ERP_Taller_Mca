"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
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
import { queryKeys } from "@/hooks/use-data";
import type { CUentaRecord } from "./columns";

const bancos = ["Sudameris", "Atlas", "Visión Banco", "Itaú", "Gnb Sudameris", "BNF", "Continental", "Regional", "Familiar", "Interfisa"];
const tiposCuenta = ["Corriente", "Ahorro", "Inversión"];

export function EditAccountDialog({
  cuenta,
  onClose,
}: {
  cuenta: CUentaRecord | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = React.useState({
    nombre: "",
    codigo: "",
    banco: "",
    tipoCuenta: "Corriente",
    activo: true,
    observaciones: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (cuenta) {
      setForm({
        nombre: cuenta.nombre,
        codigo: cuenta.codigo,
        banco: (cuenta as { banco?: string | null }).banco ?? "",
        tipoCuenta: (cuenta as { tipoCuenta?: string }).tipoCuenta ?? "Corriente",
        activo: cuenta.activo,
        observaciones: (cuenta as { observaciones?: string | null }).observaciones ?? "",
      });
      setErrors({});
    }
  }, [cuenta]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!cuenta) throw new Error("No hay cuenta seleccionada");
      return api.updateBankAccount(cuenta.id, {
        nombre: form.nombre,
        codigo: form.codigo,
        banco: form.banco || null,
        tipoCuenta: form.tipoCuenta,
        activo: form.activo,
        observaciones: form.observaciones || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.bankAccounts });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.nombre.trim()) next.nombre = "El nombre es obligatorio";
    if (!form.codigo.trim()) next.codigo = "El código es obligatorio";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    updateMutation.mutate();
  };

  const updateField = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
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
    <Dialog open={!!cuenta} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" aria-hidden="true" /> Editar Cuenta
            </DialogTitle>
            <DialogDescription>
              Modificá los datos de la cuenta bancaria.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <FormField label="Nombre" htmlFor="ea-nombre" required error={errors.nombre}>
              <Input
                id="ea-nombre"
                value={form.nombre}
                onChange={(e) => updateField("nombre", e.target.value)}
                hasError={!!errors.nombre}
              />
            </FormField>

            <FormField label="Código / Nro. Cuenta" htmlFor="ea-codigo" required error={errors.codigo}>
              <Input
                id="ea-codigo"
                value={form.codigo}
                onChange={(e) => updateField("codigo", e.target.value)}
                hasError={!!errors.codigo}
                className="font-mono"
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Banco" htmlFor="ea-banco">
                <Select
                  id="ea-banco"
                  value={form.banco}
                  onChange={(e) => updateField("banco", e.target.value)}
                  placeholder="Seleccionar…"
                >
                  <option value="">Sin banco</option>
                  {bancos.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Tipo de Cuenta" htmlFor="ea-tipo">
                <Select
                  id="ea-tipo"
                  value={form.tipoCuenta}
                  onChange={(e) => updateField("tipoCuenta", e.target.value)}
                >
                  {tiposCuenta.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label="Estado" htmlFor="ea-activo" helperText="Las cuentas inactivas no aparecen en transferencias">
              <Select
                id="ea-activo"
                value={form.activo ? "true" : "false"}
                onChange={(e) => updateField("activo", e.target.value === "true")}
              >
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </Select>
            </FormField>

            <FormField label="Observaciones" htmlFor="ea-obs" helperText="Opcional">
              <Textarea
                id="ea-obs"
                value={form.observaciones}
                onChange={(e) => updateField("observaciones", e.target.value)}
                rows={2}
              />
            </FormField>

            {updateMutation.isError && (
              <p className="text-sm text-destructive">
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : "Error al actualizar la cuenta"}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={updateMutation.isPending}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
