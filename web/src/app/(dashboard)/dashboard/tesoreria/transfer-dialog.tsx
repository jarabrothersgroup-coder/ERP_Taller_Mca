"use client";

import * as React from "react";
import { ArrowLeftRight, Plus } from "lucide-react";
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
import { api } from "@/lib/api";
import { queryKeys } from "@/hooks/use-data";
import type { CUentaRecord } from "./columns";

interface TransferForm {
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  monto: string;
  concepto: string;
}

export function TransferDialog({ cuentas }: { cuentas: CUentaRecord[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<TransferForm>({
    cuentaOrigenId: "",
    cuentaDestinoId: "",
    monto: "",
    concepto: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof TransferForm, string>>>({});

  const activas = React.useMemo(() => cuentas.filter((c) => c.activo), [cuentas]);

  const transferMutation = useMutation({
    mutationFn: () =>
      api.transferir({
        cuentaOrigenId: form.cuentaOrigenId,
        cuentaDestinoId: form.cuentaDestinoId,
        monto: form.monto,
        concepto: form.concepto,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.bankAccounts });
      qc.invalidateQueries({ queryKey: queryKeys.movements });
      setForm({ cuentaOrigenId: "", cuentaDestinoId: "", monto: "", concepto: "" });
      setErrors({});
      setOpen(false);
    },
  });

  const validate = (): boolean => {
    const next: Partial<Record<keyof TransferForm, string>> = {};
    if (!form.cuentaOrigenId) next.cuentaOrigenId = "Seleccioná la cuenta de origen";
    if (!form.cuentaDestinoId) next.cuentaDestinoId = "Seleccioná la cuenta de destino";
    if (form.cuentaOrigenId && form.cuentaOrigenId === form.cuentaDestinoId) {
      next.cuentaDestinoId = "La cuenta de destino debe ser distinta al origen";
    }
    if (!form.monto || Number(form.monto) <= 0) next.monto = "Ingresá un monto mayor a 0";
    if (!form.concepto.trim()) next.concepto = "El concepto es obligatorio";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    transferMutation.mutate();
  };

  const updateField = <K extends keyof TransferForm>(field: K, value: TransferForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const errMsg = transferMutation.error instanceof Error
    ? transferMutation.error.message
    : "Error al transferir";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          Transferir
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Transferencia entre Cuentas</DialogTitle>
            <DialogDescription>
              Transfiere fondos entre dos cuentas del taller (registra egreso + ingreso).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {activas.length < 2 && (
              <p className="text-sm text-muted-foreground">
                Se necesitan al menos 2 cuentas activas para transferir.
              </p>
            )}

            <FormField label="Cuenta Origen" htmlFor="tr-origen" required error={errors.cuentaOrigenId}>
              <Select
                id="tr-origen"
                value={form.cuentaOrigenId}
                onChange={(e) => updateField("cuentaOrigenId", e.target.value)}
                placeholder="Seleccionar…"
              >
                {activas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Cuenta Destino" htmlFor="tr-destino" required error={errors.cuentaDestinoId}>
              <Select
                id="tr-destino"
                value={form.cuentaDestinoId}
                onChange={(e) => updateField("cuentaDestinoId", e.target.value)}
                placeholder="Seleccionar…"
              >
                {activas
                  .filter((c) => c.id !== form.cuentaOrigenId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
                  ))}
              </Select>
            </FormField>

            <FormField label="Monto" htmlFor="tr-monto" required error={errors.monto}>
              <Input
                id="tr-monto"
                type="number"
                min="0"
                placeholder="0"
                value={form.monto}
                onChange={(e) => updateField("monto", e.target.value)}
                hasError={!!errors.monto}
                className="tabular-nums"
              />
            </FormField>

            <FormField label="Concepto" htmlFor="tr-concepto" required error={errors.concepto}>
              <Input
                id="tr-concepto"
                placeholder="Ej: Fondo a caja chica…"
                value={form.concepto}
                onChange={(e) => updateField("concepto", e.target.value)}
                hasError={!!errors.concepto}
              />
            </FormField>

            {transferMutation.isError && (
              <p className="text-sm text-destructive">{errMsg}</p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              type="submit"
              loading={transferMutation.isPending}
              disabled={activas.length < 2 || transferMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Transferir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
