"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Check, X, Plus, RefreshCw } from "lucide-react";
import { api, type StockAdjustmentRequest, type InventoryItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

/* ── Constants ────────────────────────────────── */

const MOTIVOS_AJUSTE = [
  "Conteo cíclico",
  "Deterioro",
  "Robo/Pérdida",
  "Corrección de registro",
  "Otro",
];

/* ── Component ────────────────────────────────── */

/**
 * Ajustes de stock con aprobación — lista los pendientes y permite
 * aprobar/rechazar, además de crear nuevas solicitudes de ajuste.
 *
 * Consume: POST /inventory/adjustments, GET /inventory/adjustments/pending,
 * POST /inventory/adjustments/:id/{approve,reject} (T-47).
 */
export function AdjustmentsCard() {
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();

  // ── Create dialog state ──
  const [createOpen, setCreateOpen] = React.useState(false);
  const [formRepuestoId, setFormRepuestoId] = React.useState("");
  const [formCantidad, setFormCantidad] = React.useState(1);
  const [formMotivo, setFormMotivo] = React.useState(MOTIVOS_AJUSTE[0]);
  const [formObservaciones, setFormObservaciones] = React.useState("");

  // ── Reject dialog state ──
  const [rejectTarget, setRejectTarget] = React.useState<StockAdjustmentRequest | null>(null);
  const [rejectMotivo, setRejectMotivo] = React.useState("");

  const { data: pending = [], isLoading } = useQuery<StockAdjustmentRequest[]>({
    queryKey: ["adjustments-pending"],
    queryFn: () => api.listPendingAdjustments(),
  });

  const { data: repuestos = [] } = useQuery<InventoryItem[]>({
    queryKey: ["repuestos-lista"],
    queryFn: () => api.listInventory({ limit: 100 }).then((r) => r.items),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["adjustments-pending"] });
    qc.invalidateQueries({ queryKey: ["stock-movements"] });
    qc.invalidateQueries({ queryKey: ["inventory"] });
  };

  const approveMut = useMutation({
    mutationFn: (id: string) => api.approveAdjustment(id),
    onSuccess: () => {
      invalidate();
      t.success("Ajuste aprobado — stock actualizado");
    },
    onError: (err: any) => t.error(err?.message || "Error al aprobar el ajuste"),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      api.rejectAdjustment(id, motivo),
    onSuccess: () => {
      invalidate();
      setRejectTarget(null);
      setRejectMotivo("");
      t.success("Ajuste rechazado");
    },
    onError: (err: any) => t.error(err?.message || "Error al rechazar el ajuste"),
  });

  const createMut = useMutation({
    mutationFn: () =>
      api.createAdjustment({
        repuestoId: formRepuestoId,
        cantidad: formCantidad,
        motivo: formMotivo,
        ...(formObservaciones ? { observaciones: formObservaciones } : {}),
      }),
    onSuccess: (result) => {
      invalidate();
      setCreateOpen(false);
      setFormRepuestoId("");
      setFormCantidad(1);
      setFormMotivo(MOTIVOS_AJUSTE[0]);
      setFormObservaciones("");
      t.success(
        result.estado === "APROBADO"
          ? "Ajuste de baja cuantía aplicado directamente"
          : "Solicitud de ajuste creada — pendiente de aprobación",
      );
    },
    onError: (err: any) => t.error(err?.message || "Error al crear el ajuste"),
  });

  const columns: Column<StockAdjustmentRequest>[] = [
    {
      header: "Repuesto",
      accessor: "repuestoId",
      cell: (_, row) => (
        <span className="font-mono text-xs">{row.repuestoId.slice(0, 8)}</span>
      ),
    },
    {
      header: "Cantidad",
      accessor: "cantidad",
      align: "right",
      cell: (_, row) => (
        <span className="font-mono font-medium">{row.cantidad}</span>
      ),
    },
    {
      header: "Motivo",
      accessor: "motivo",
    },
    {
      header: "Solicitado por",
      accessor: "solicitadoPor",
      hideOnMobile: true,
      cell: (_, row) => (
        <span className="text-xs text-muted-foreground">{row.solicitadoPor}</span>
      ),
    },
    {
      header: "Fecha",
      accessor: "createdAt",
      hideOnMobile: true,
      cell: (_, row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString("es-PY", { dateStyle: "short" })}
        </span>
      ),
    },
    {
      header: "Acciones",
      accessor: "id",
      align: "right",
      cell: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-green-600 hover:text-green-700"
            onClick={() => approveMut.mutate(row.id)}
            disabled={approveMut.isPending}
          >
            <Check className="h-3.5 w-3.5" />
            Aprobar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-red-600 hover:text-red-700"
            onClick={() => {
              setRejectTarget(row);
              setRejectMotivo("");
            }}
          >
            <X className="h-3.5 w-3.5" />
            Rechazar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-amber-500" />
          Ajustes de Stock
          {pending.length > 0 && (
            <Badge variant="warning" className="ml-1">
              {pending.length} pendiente{pending.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => qc.invalidateQueries({ queryKey: ["adjustments-pending"] })}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo Ajuste
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable<StockAdjustmentRequest>
          columns={columns}
          data={pending}
          rowKey="id"
          loading={isLoading}
          emptyMessage="No hay ajustes pendientes de aprobación"
        />
      </CardContent>

      {/* ── Create Dialog ────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Solicitud de Ajuste</DialogTitle>
            <DialogDescription>
              Ajustes de baja cuantía se aplican directamente; el resto requiere aprobación.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <FormField label="Repuesto" htmlFor="ajuste-repuesto">
              <select
                id="ajuste-repuesto"
                value={formRepuestoId}
                onChange={(e) => setFormRepuestoId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                required
              >
                <option value="">Seleccionar repuesto...</option>
                {repuestos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.codigo} — {r.descripcion} (stock: {r.stockActual})
                  </option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Cantidad (±)" htmlFor="ajuste-cantidad">
                <Input
                  id="ajuste-cantidad"
                  type="number"
                  value={formCantidad}
                  onChange={(e) => setFormCantidad(Number(e.target.value))}
                  required
                />
              </FormField>
              <FormField label="Motivo" htmlFor="ajuste-motivo">
                <select
                  id="ajuste-motivo"
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {MOTIVOS_AJUSTE.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="Observaciones" htmlFor="ajuste-obs">
              <textarea
                id="ajuste-obs"
                value={formObservaciones}
                onChange={(e) => setFormObservaciones(e.target.value)}
                placeholder="Detalle del ajuste..."
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!formRepuestoId || formCantidad === 0 || createMut.isPending}
              loading={createMut.isPending}
            >
              Crear Solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Dialog ────────────────────── */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rechazar Ajuste</DialogTitle>
            <DialogDescription>
              La solicitud volverá al solicitante con el motivo indicado.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Motivo de rechazo" htmlFor="reject-motivo">
            <textarea
              id="reject-motivo"
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
              placeholder="Ej: Diferencia de conteo no justificada..."
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectTarget && rejectMut.mutate({ id: rejectTarget.id, motivo: rejectMotivo })
              }
              disabled={!rejectMotivo.trim() || rejectMut.isPending}
              loading={rejectMut.isPending}
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ToastContainer}
    </Card>
  );
}
