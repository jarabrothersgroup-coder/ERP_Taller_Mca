"use client";

import * as React from "react";
import { Send, Plus } from "lucide-react";
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
import { queryKeys } from "@/hooks/use-data";

interface SendForm {
  phone: string;
  template: string;
  message: string;
}

export function SendMessageDialog({ onSent }: { onSent?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<SendForm>({
    phone: "",
    template: "",
    message: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof SendForm, string>>>({});

  // Fetch available templates when dialog opens
  const { data: templates = [] } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: () => api.listWhatsAppTemplates(),
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: async (data: SendForm) => {
      return api.sendWhatsAppMessage({ phone: data.phone, message: data.message });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.whatsappMessages });
      setForm({ phone: "", template: "", message: "" });
      setErrors({});
      setOpen(false);
      onSent?.();
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof SendForm, string>> = {};
    if (!form.phone.trim()) newErrors.phone = "El teléfono es obligatorio";
    if (!form.message.trim()) newErrors.message = "El mensaje es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    sendMutation.mutate(form);
  };

  const updateField = <K extends keyof SendForm>(field: K, value: SendForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleTemplateChange = (key: string) => {
    const tpl = templates.find((t) => t.key === key);
    setForm((prev) => ({
      ...prev,
      template: key,
      message: tpl ? tpl.body : prev.message,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nuevo Mensaje
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo Mensaje de WhatsApp</DialogTitle>
            <DialogDescription>
              Enviá un mensaje directo a un cliente mediante la instancia conectada.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <FormField label="Teléfono" htmlFor="wa-phone" required error={errors.phone}>
              <Input
                id="wa-phone"
                placeholder="+595 981 234 567"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                hasError={!!errors.phone}
              />
            </FormField>

            <FormField label="Plantilla" htmlFor="wa-template">
              <Select
                id="wa-template"
                value={form.template}
                onChange={(e) => handleTemplateChange(e.target.value)}
                placeholder="Seleccionar plantilla…"
              >
                <option value="">Sin plantilla (texto libre)</option>
                {templates.map((t) => (
                  <option key={t.key} value={t.key}>{t.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Mensaje" htmlFor="wa-message" required error={errors.message}>
              <Textarea
                id="wa-message"
                placeholder="Escribí tu mensaje…"
                value={form.message}
                onChange={(e) => updateField("message", e.target.value)}
                hasError={!!errors.message}
                rows={5}
              />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={sendMutation.isPending}>
              {sendMutation.isPending ? "Enviando…" : "Enviar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
