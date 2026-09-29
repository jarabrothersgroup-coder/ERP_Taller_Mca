"use client";

/**
 * Ficha de próximos mantenimientos (T-43 · SRV-03).
 *
 * Se abre desde la fila de un vehículo en /dashboard/vehiculos y muestra:
 *   - el odómetro real del vehículo,
 *   - los mantenimientos programados (generados al completar una OT o
 *     creados a mano) con su objetivo de km/fecha,
 *   - acciones: marcar REALIZADO/CANCELADO, eliminar (manager+) y crear
 *     un mantenimiento manual.
 */

import * as React from "react";
import { Wrench, Gauge, Check, X, Trash2, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api, type Mantenimiento } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Props {
  vehicleId: string | null;
  onClose: () => void;
}

const ESTADO_CONFIG: Record<
  Mantenimiento["estado"],
  { label: string; variant: "default" | "secondary" | "success" }
> = {
  PENDIENTE: { label: "Pendiente", variant: "secondary" },
  REALIZADO: { label: "Realizado", variant: "success" },
  CANCELADO: { label: "Cancelado", variant: "default" },
};

function objetivo(m: Mantenimiento): string {
  const partes: string[] = [];
  if (m.kmObjetivo !== null) partes.push(`${m.kmObjetivo.toLocaleString("es-PY")} km`);
  if (m.fechaObjetivo) {
    partes.push(
      new Date(`${m.fechaObjetivo}T12:00:00`).toLocaleDateString("es-PY"),
    );
  }
  return partes.join(" · ") || "—";
}

export function MaintenanceFichaDialog({ vehicleId, onClose }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState({ servicio: "", kmObjetivo: "", fechaObjetivo: "" });

  const { data: ficha, isLoading } = useQuery({
    queryKey: ["maintenance-ficha", vehicleId],
    queryFn: () => api.getVehicleMaintenance(vehicleId!),
    enabled: !!vehicleId,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["maintenance-ficha", vehicleId] });

  const updateMut = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: Mantenimiento["estado"] }) =>
      api.updateMantenimiento(id, { estado }),
    onSuccess: (_data, vars) => {
      invalidate();
      toast.success(
        vars.estado === "REALIZADO"
          ? "Mantenimiento marcado como realizado"
          : "Mantenimiento cancelado",
      );
    },
    onError: (err: Error) => toast.error(err.message || "Error al actualizar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteMantenimiento(id),
    onSuccess: () => {
      invalidate();
      toast.success("Mantenimiento eliminado");
    },
    onError: (err: Error) => toast.error(err.message || "Error al eliminar"),
  });

  const createMut = useMutation({
    mutationFn: () =>
      api.createMantenimiento({
        vehiculoId: vehicleId!,
        servicio: form.servicio.trim(),
        kmObjetivo: form.kmObjetivo ? Number(form.kmObjetivo) : undefined,
        fechaObjetivo: form.fechaObjetivo || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setForm({ servicio: "", kmObjetivo: "", fechaObjetivo: "" });
      setShowCreate(false);
      toast.success("Mantenimiento programado");
    },
    onError: (err: Error) => toast.error(err.message || "Error al programar"),
  });

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.servicio.trim()) {
      toast.error("El servicio es obligatorio");
      return;
    }
    if (!form.kmObjetivo && !form.fechaObjetivo) {
      toast.error("Indique un km y/o una fecha objetivo");
      return;
    }
    createMut.mutate();
  };

  const items = ficha?.items ?? [];
  const pendientes = items.filter((m) => m.estado === "PENDIENTE");

  return (
    <Dialog open={!!vehicleId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4" aria-hidden="true" />
            Próximos mantenimientos
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Cargando ficha…"
              : `Odómetro actual: ${
                  ficha?.kilometraje !== null && ficha?.kilometraje !== undefined
                    ? `${ficha.kilometraje.toLocaleString("es-PY")} km`
                    : "sin registrar"
                } · ${pendientes.length} pendiente(s)`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto py-2">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}

          {!isLoading && items.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Gauge
                className="mx-auto h-6 w-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm text-muted-foreground">
                Sin mantenimientos programados. Al completar una OT con servicios
                se genera automáticamente la ficha.
              </p>
            </div>
          )}

          {!isLoading &&
            items.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{m.servicio}</p>
                    <Badge variant={ESTADO_CONFIG[m.estado].variant}>
                      {ESTADO_CONFIG[m.estado].label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {objetivo(m)}
                    {m.origen === "OT_COMPLETADA" ? " · generado por OT" : ""}
                    {m.recordatorioEnviado ? " · recordatorio enviado" : ""}
                  </p>
                </div>

                {m.estado === "PENDIENTE" && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Marcar realizado"
                      title="Marcar realizado"
                      onClick={() => updateMut.mutate({ id: m.id, estado: "REALIZADO" })}
                      disabled={updateMut.isPending}
                    >
                      <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Cancelar"
                      title="Cancelar"
                      onClick={() => updateMut.mutate({ id: m.id, estado: "CANCELADO" })}
                      disabled={updateMut.isPending}
                    >
                      <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Eliminar"
                      title="Eliminar (requiere permiso de gerente)"
                      onClick={() => deleteMut.mutate(m.id)}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
        </div>

        {showCreate ? (
          <form onSubmit={submitCreate} className="grid gap-3 border-t pt-3">
            <FormField label="Servicio" htmlFor="m-servicio" required>
              <Input
                id="m-servicio"
                placeholder="Cambio de aceite"
                value={form.servicio}
                onChange={(e) => setForm((p) => ({ ...p, servicio: e.target.value }))}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Km objetivo" htmlFor="m-km">
                <Input
                  id="m-km"
                  type="number"
                  min={0}
                  placeholder="45000"
                  value={form.kmObjetivo}
                  onChange={(e) => setForm((p) => ({ ...p, kmObjetivo: e.target.value }))}
                />
              </FormField>
              <FormField label="Fecha objetivo" htmlFor="m-fecha">
                <Input
                  id="m-fecha"
                  type="date"
                  value={form.fechaObjetivo}
                  onChange={(e) => setForm((p) => ({ ...p, fechaObjetivo: e.target.value }))}
                />
              </FormField>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" loading={createMut.isPending}>
                Programar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex justify-end border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Programar mantenimiento
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
