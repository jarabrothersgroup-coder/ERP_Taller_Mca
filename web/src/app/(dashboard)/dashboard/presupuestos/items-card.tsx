"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { api, type PresupuestoItem, type CentroCosto } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

function formatGuarani(amount: number): string {
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

interface ItemForm {
  centroCostoId: string;
  categoria: string;
  montoPresupuestado: string;
  notas: string;
}

const emptyForm: ItemForm = {
  centroCostoId: "",
  categoria: "",
  montoPresupuestado: "",
  notas: "",
};

/* ── Create/Edit Item Dialog ────────────────────── */

function ItemDialog({
  presupuestoId,
  item,
  open,
  onOpenChange,
}: {
  presupuestoId: string;
  item: PresupuestoItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!item;
  const [form, setForm] = React.useState<ItemForm>(emptyForm);
  const [errors, setErrors] = React.useState<Partial<Record<keyof ItemForm, string>>>({});

  const { data: centros = [] } = useQuery<CentroCosto[], Error>({
    queryKey: ["centros-costo"],
    queryFn: () => api.listCentrosCosto(),
    enabled: open,
  });

  React.useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        centroCostoId: item.centroCostoId,
        categoria: item.categoria,
        montoPresupuestado: String(item.montoPresupuestado),
        notas: item.notas ?? "",
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [open, item]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const monto = Number(form.montoPresupuestado);
      if (isEdit && item) {
        return api.updatePresupuestoItem(item.id, {
          montoPresupuestado: monto,
          notas: form.notas || undefined,
        });
      }
      return api.createPresupuestoItem(presupuestoId, {
        centroCostoId: form.centroCostoId,
        categoria: form.categoria,
        montoPresupuestado: monto,
        notas: form.notas || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presupuesto-detail", presupuestoId] });
      qc.invalidateQueries({ queryKey: ["presupuestos"] });
      toast.success(isEdit ? "Ítem actualizado" : "Ítem agregado");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al guardar el ítem");
    },
  });

  const updateField = <K extends keyof ItemForm>(field: K, value: ItemForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<keyof ItemForm, string>> = {};
    if (!isEdit && !form.centroCostoId) next.centroCostoId = "Seleccioná un centro de costo";
    if (!form.categoria.trim()) next.categoria = "La categoría es obligatoria";
    if (!form.montoPresupuestado || Number(form.montoPresupuestado) <= 0) {
      next.montoPresupuestado = "Ingresá un monto mayor a 0";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar Ítem" : "Agregar Ítem"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Modificá el monto o las notas del ítem."
                : "Agregá una línea presupuestaria a este presupuesto."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <FormField label="Centro de Costo" htmlFor="it-centro" required={!isEdit} error={errors.centroCostoId}>
              <select
                id="it-centro"
                value={form.centroCostoId}
                onChange={(e) => updateField("centroCostoId", e.target.value)}
                disabled={isEdit}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Seleccionar…</option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Categoría" htmlFor="it-categoria" required error={errors.categoria}>
              <Input
                id="it-categoria"
                value={form.categoria}
                onChange={(e) => updateField("categoria", e.target.value)}
                hasError={!!errors.categoria}
                placeholder="Ej: Mano de obra, Repuestos…"
              />
            </FormField>

            <FormField label="Monto Presupuestado" htmlFor="it-monto" required error={errors.montoPresupuestado}>
              <Input
                id="it-monto"
                type="number"
                min="0"
                value={form.montoPresupuestado}
                onChange={(e) => updateField("montoPresupuestado", e.target.value)}
                hasError={!!errors.montoPresupuestado}
                className="tabular-nums"
                placeholder="0"
              />
            </FormField>

            <FormField label="Notas" htmlFor="it-notas" helperText="Opcional">
              <Textarea
                id="it-notas"
                value={form.notas}
                onChange={(e) => updateField("notas", e.target.value)}
                rows={2}
              />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={saveMutation.isPending}>
              {isEdit ? "Guardar Cambios" : "Agregar Ítem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Delete Item Dialog ─────────────────────────── */

function DeleteItemDialog({
  presupuestoId,
  item,
  onOpenChange,
}: {
  presupuestoId: string;
  item: PresupuestoItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!item) throw new Error("No hay ítem seleccionado");
      return api.deletePresupuestoItem(item.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presupuesto-detail", presupuestoId] });
      qc.invalidateQueries({ queryKey: ["presupuestos"] });
      toast.success("Ítem eliminado");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el ítem");
    },
  });

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar Ítem</DialogTitle>
          <DialogDescription>
            ¿Seguro que querés eliminar el ítem &quot;{item?.categoria}&quot;? Esta acción no se
            puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Items Card ─────────────────────────────────── */

export function PresupuestoItemsCard({
  presupuestoId,
  items,
  estado,
}: {
  presupuestoId: string;
  items: PresupuestoItem[];
  estado: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PresupuestoItem | null>(null);
  const [deleting, setDeleting] = React.useState<PresupuestoItem | null>(null);

  const cerrado = estado === "cerrado";

  const refreshMutation = useMutation({
    mutationFn: () => api.refreshPresupuesto(presupuestoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presupuesto-detail", presupuestoId] });
      qc.invalidateQueries({ queryKey: ["presupuestos"] });
      toast.success("Montos reales actualizados");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al recalcular montos reales");
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (item: PresupuestoItem) => {
    setEditing(item);
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm">Ítems del Presupuesto</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={refreshMutation.isPending}
              loading={refreshMutation.isPending}
              onClick={() => refreshMutation.mutate()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Recalcular Real
            </Button>
            <Button size="sm" className="gap-1.5" disabled={cerrado} onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Agregar Ítem
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No hay ítems en este presupuesto.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{item.categoria}</p>
                  <p className="text-xs text-muted-foreground">Centro: {item.centroCostoId}</p>
                  {item.notas && <p className="text-xs text-muted-foreground">{item.notas}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium tabular-nums">
                    {formatGuarani(Number(item.montoPresupuestado))}
                  </span>
                  {!cerrado && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 h-7"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 h-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleting(item)}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" /> Eliminar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ItemDialog
        presupuestoId={presupuestoId}
        item={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      <DeleteItemDialog
        presupuestoId={presupuestoId}
        item={deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
      />
    </Card>
  );
}
