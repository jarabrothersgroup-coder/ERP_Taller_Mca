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
import { getTenantSlug } from "@/lib/api";

interface BankAccountForm {
  nombre: string;
  codigo: string;
  banco: string;
  tipoCuenta: string;
  moneda: string;
  saldoInicial: string;
  observaciones: string;
}

const bancos = ["Sudameris", "Atlas", "Visión Banco", "Itaú", "Gnb Sudameris", "BNF", "Continental", "Regional", "Familiar", "Interfisa"];
const tiposCuenta = ["Corriente", "Ahorro", "Inversión"];

export function NewBankAccountDialog({ onCreated }: { onCreated?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<BankAccountForm>({
    nombre: "",
    codigo: "",
    banco: "",
    tipoCuenta: "Corriente",
    moneda: "PYG",
    saldoInicial: "0",
    observaciones: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof BankAccountForm, string>>>({});

  const createMutation = useMutation({
    mutationFn: async (data: BankAccountForm) => {
      const res = await fetch("/finance/treasury/cuentas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": getTenantSlug() },
        body: JSON.stringify({
          nombre: data.nombre,
          codigo: data.codigo,
          banco: data.banco || null,
          tipoCuenta: data.tipoCuenta,
          moneda: data.moneda,
          saldoInicial: Number(data.saldoInicial) || 0,
          observaciones: data.observaciones || null,
        }),
      });
      if (!res.ok) throw new Error("Error creando cuenta bancaria");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.bankAccounts });
      setForm({ nombre: "", codigo: "", banco: "", tipoCuenta: "Corriente", moneda: "PYG", saldoInicial: "0", observaciones: "" });
      setErrors({});
      setOpen(false);
      onCreated?.();
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof BankAccountForm, string>> = {};
    if (!form.nombre.trim()) newErrors.nombre = "El nombre es obligatorio";
    if (!form.codigo.trim()) newErrors.codigo = "El código es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate(form);
  };

  const updateField = <K extends keyof BankAccountForm>(field: K, value: BankAccountForm[K]) => {
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
            <DialogTitle>Nueva Cuenta Bancaria</DialogTitle>
            <DialogDescription>
              Registrá una cuenta bancaria del taller.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <FormField label="Nombre" htmlFor="ba-nombre" required error={errors.nombre}>
              <Input
                id="ba-nombre"
                placeholder="Cuenta Corriente Principal"
                value={form.nombre}
                onChange={(e) => updateField("nombre", e.target.value)}
                hasError={!!errors.nombre}
              />
            </FormField>

            <FormField label="Código / Nro. Cuenta" htmlFor="ba-codigo" required error={errors.codigo}>
              <Input
                id="ba-codigo"
                placeholder="001-12345678-0"
                value={form.codigo}
                onChange={(e) => updateField("codigo", e.target.value)}
                hasError={!!errors.codigo}
                className="font-mono"
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Banco" htmlFor="ba-banco">
                <Select
                  id="ba-banco"
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

              <FormField label="Tipo de Cuenta" htmlFor="ba-tipo">
                <Select
                  id="ba-tipo"
                  value={form.tipoCuenta}
                  onChange={(e) => updateField("tipoCuenta", e.target.value)}
                >
                  {tiposCuenta.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Moneda" htmlFor="ba-moneda">
                <Select
                  id="ba-moneda"
                  value={form.moneda}
                  onChange={(e) => updateField("moneda", e.target.value)}
                >
                  <option value="PYG">Guaraní (PYG)</option>
                  <option value="USD">Dólar (USD)</option>
                </Select>
              </FormField>

              <FormField label="Saldo Inicial (₲)" htmlFor="ba-saldo">
                <Input
                  id="ba-saldo"
                  type="number"
                  placeholder="0"
                  value={form.saldoInicial}
                  onChange={(e) => updateField("saldoInicial", e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Observaciones" htmlFor="ba-obs" helperText="Opcional">
              <Textarea
                id="ba-obs"
                placeholder="Notas sobre la cuenta…"
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
              {createMutation.isPending ? "Creando…" : "Crear Cuenta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
