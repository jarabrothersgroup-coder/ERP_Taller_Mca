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
import { api } from "@/lib/api";
import { queryKeys } from "@/hooks/use-data";
import { useWorkOrders } from "@/hooks/use-data";

interface InvoiceForm {
  ordenId: string;
  tipoFacturacion: "MANUAL" | "ELECTRONICA";
  numeroFacturaManual: string;
}

export function NewInvoiceDialog({ onCreated }: { onCreated?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const { data: orders = [] } = useWorkOrders();
  const [form, setForm] = React.useState<InvoiceForm>({
    ordenId: "",
    tipoFacturacion: "ELECTRONICA",
    numeroFacturaManual: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof InvoiceForm, string>>>({});

  // Filter orders that are ready to invoice
  const billableOrders = orders.filter(
    (o) => o.status === "ready" || o.status === "completed" || o.status === "budgeted"
  );

  const createMutation = useMutation({
    mutationFn: (data: InvoiceForm) =>
      api.issueInvoice({
        ordenId: data.ordenId,
        tipoFacturacion: data.tipoFacturacion,
        numeroFacturaManual: data.tipoFacturacion === "MANUAL" ? data.numeroFacturaManual : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.invoices });
      setForm({ ordenId: "", tipoFacturacion: "ELECTRONICA", numeroFacturaManual: "" });
      setErrors({});
      setOpen(false);
      onCreated?.();
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof InvoiceForm, string>> = {};
    if (!form.ordenId) newErrors.ordenId = "Seleccioná una orden de trabajo";
    if (form.tipoFacturacion === "MANUAL" && !form.numeroFacturaManual.trim()) {
      newErrors.numeroFacturaManual = "Ingresá el número de factura";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Nueva Factura
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva Factura</DialogTitle>
            <DialogDescription>
              Emití una factura para una orden de trabajo completada.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <FormField label="Orden de Trabajo" htmlFor="i-orden" required error={errors.ordenId}>
              <Select
                id="i-orden"
                value={form.ordenId}
                onChange={(e) => setForm((p) => ({ ...p, ordenId: e.target.value }))}
                hasError={!!errors.ordenId}
                placeholder="Seleccionar orden…"
              >
                <option value="" disabled>Seleccionar orden…</option>
                {billableOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} — {o.client} ({o.vehicle})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Tipo de Facturación" htmlFor="i-tipo">
              <Select
                id="i-tipo"
                value={form.tipoFacturacion}
                onChange={(e) => setForm((p) => ({ ...p, tipoFacturacion: e.target.value as InvoiceForm["tipoFacturacion"] }))}
              >
                <option value="ELECTRONICA">Electrónica (SIFEN)</option>
                <option value="MANUAL">Manual</option>
              </Select>
            </FormField>

            {form.tipoFacturacion === "MANUAL" && (
              <FormField label="Nº Factura Manual" htmlFor="i-numero" required error={errors.numeroFacturaManual}>
                <Input
                  id="i-numero"
                  placeholder="001-001-0001234"
                  value={form.numeroFacturaManual}
                  onChange={(e) => setForm((p) => ({ ...p, numeroFacturaManual: e.target.value }))}
                  hasError={!!errors.numeroFacturaManual}
                />
              </FormField>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={createMutation.isPending}>
              {createMutation.isPending ? "Emitiendo…" : "Emitir Factura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
