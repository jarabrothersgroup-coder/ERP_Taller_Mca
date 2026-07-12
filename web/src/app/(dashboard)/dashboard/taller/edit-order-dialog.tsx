"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
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
import { statusConfig, technicians } from "./status-config";
import type { WorkOrder, OrderStatus } from "./types";

interface EditOrderDialogProps {
  order: WorkOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditOrderDialog({ order, open, onOpenChange }: EditOrderDialogProps) {
  const qc = useQueryClient();
  const [status, setStatus] = React.useState<OrderStatus>("pending");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (order) {
      setStatus(order.status);
      setNotes(order.notes || "");
    }
  }, [order]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      // Map UI status to backend status
      const statusMap: Record<string, string> = {
        pending: "Pendiente",
        budgeted: "Presupuestado",
        in_progress: "En_Proceso",
        quality: "Control_Calidad",
        ready: "Listo",
        completed: "Finalizado",
        cancelled: "Cancelado",
      };
      return api.updateWorkOrderStatus(id, statusMap[newStatus] || newStatus);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workOrders });
      onOpenChange(false);
    },
  });

  if (!order) return null;

  const handleSave = () => {
    updateMutation.mutate({ id: order.id, newStatus: status });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Orden {order.id}
            <Badge variant={statusConfig[order.status].variant}>
              {statusConfig[order.status].label}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {order.client} — {order.vehicle} ({order.plate})
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <FormField label="Estado" htmlFor="status">
            <Select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
            >
              {Object.entries(statusConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Técnico" htmlFor="technician-edit">
            <Select
              id="technician-edit"
              value={order.technician}
              disabled
            >
              <option value={order.technician}>{order.technician}</option>
            </Select>
          </FormField>

          <FormField label="Notas" htmlFor="notes-edit" helperText="Observaciones de la orden">
            <Textarea
              id="notes-edit"
              placeholder="Agregar notas o instrucciones…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </FormField>

          <div className="rounded-lg border p-3 bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Detalle</p>
            <p className="text-sm">{order.service}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Costo estimado: ₲ {order.estimatedCost.toLocaleString("es-PY")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cerrar</Button>
          </DialogClose>
          <Button onClick={handleSave} loading={updateMutation.isPending}>
            {updateMutation.isPending ? "Guardando…" : "Guardar Cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
