"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, Plus, Trash2, Eye, PackagePlus } from "lucide-react";
import {
  api,
  type InitialLoadBatch,
  type InitialLoadBatchItem,
  type InitialLoadResult,
  type InventoryItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

/* ── Types ────────────────────────────────────── */

interface RepuestoRow {
  repuestoId: string;
  cantidad: number;
  valorEstimadoMercado: number;
}

/* ── Component ────────────────────────────────── */

/**
 * Carga Inicial de Inventario ("Puesta en Marcha") — ejecuta
 * POST /inventory/initial-load y lista los lotes con su detalle
 * (GET /inventory/initial-load/batches[/:batchId]) (T-47).
 */
export function InitialLoadCard() {
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();

  // ── Run dialog state ──
  const [runOpen, setRunOpen] = React.useState(false);
  const [rows, setRows] = React.useState<RepuestoRow[]>([
    { repuestoId: "", cantidad: 1, valorEstimadoMercado: 0 },
  ]);
  const [concepto, setConcepto] = React.useState("");
  const [fecha, setFecha] = React.useState("");
  const [result, setResult] = React.useState<InitialLoadResult | null>(null);

  // ── Detail dialog state ──
  const [detailBatch, setDetailBatch] = React.useState<string | null>(null);

  const { data: batches = [], isLoading } = useQuery<InitialLoadBatch[]>({
    queryKey: ["initial-load-batches"],
    queryFn: () => api.listInitialLoadBatches(20),
  });

  const { data: repuestos = [] } = useQuery<InventoryItem[]>({
    queryKey: ["repuestos-lista"],
    queryFn: () => api.listInventory({ limit: 100 }).then((r) => r.items),
  });

  const { data: batchItems = [], isLoading: loadingDetail } = useQuery<InitialLoadBatchItem[]>({
    queryKey: ["initial-load-batch", detailBatch],
    queryFn: () => api.getInitialLoadBatch(detailBatch!),
    enabled: !!detailBatch,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["initial-load-batches"] });
    qc.invalidateQueries({ queryKey: ["stock-movements"] });
    qc.invalidateQueries({ queryKey: ["inventory"] });
  };

  const runMut = useMutation({
    mutationFn: () =>
      api.initialLoad({
        repuestos: rows
          .filter((r) => r.repuestoId)
          .map((r) => ({
            repuestoId: r.repuestoId,
            cantidad: r.cantidad,
            ...(r.valorEstimadoMercado > 0
              ? { valorEstimadoMercado: r.valorEstimadoMercado }
              : {}),
          })),
        ...(concepto ? { concepto } : {}),
        ...(fecha ? { fecha } : {}),
      }),
    onSuccess: (res) => {
      invalidate();
      setRunOpen(false);
      setResult(res);
      t.success(`Carga inicial ejecutada — lote ${res.batchId}`);
    },
    onError: (err: any) => t.error(err?.message || "Error al ejecutar la carga inicial"),
  });

  const resetRunForm = () => {
    setRows([{ repuestoId: "", cantidad: 1, valorEstimadoMercado: 0 }]);
    setConcepto("");
    setFecha("");
  };

  const updateRow = (idx: number, patch: Partial<RepuestoRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const canSubmit =
    rows.some((r) => r.repuestoId && r.cantidad > 0) && !runMut.isPending;

  const batchColumns: Column<InitialLoadBatch>[] = [
    {
      header: "Lote",
      accessor: "batchId",
      cell: (_, row) => <span className="font-mono text-xs">{row.batchId}</span>,
    },
    {
      header: "Tipo",
      accessor: "tipo",
      cell: (_, row) => <Badge variant="secondary">{row.tipo}</Badge>,
    },
    {
      header: "Asiento",
      accessor: "asientoId",
      hideOnMobile: true,
      cell: (_, row) =>
        row.asientoId ? (
          <span className="font-mono text-xs">{row.asientoId.slice(0, 8)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
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
      header: "",
      accessor: "batchId",
      align: "right",
      cell: (_, row) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1"
          onClick={() => setDetailBatch(row.batchId)}
        >
          <Eye className="h-3.5 w-3.5" />
          Detalle
        </Button>
      ),
    },
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="h-4 w-4 text-blue-500" />
            Carga Inicial
          </CardTitle>
          <CardDescription className="mt-1">
            Puesta en marcha del inventario — genera asiento contable consolidado
          </CardDescription>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setRunOpen(true)}>
          <PackagePlus className="h-3.5 w-3.5" />
          Ejecutar Carga
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable<InitialLoadBatch>
          columns={batchColumns}
          data={batches}
          rowKey="batchId"
          loading={isLoading}
          emptyMessage="No hay lotes de carga inicial registrados"
          pageSize={5}
        />
      </CardContent>

      {/* ── Run Dialog ───────────────────────── */}
      <Dialog
        open={runOpen}
        onOpenChange={(open) => {
          setRunOpen(open);
          if (!open) resetRunForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ejecutar Carga Inicial</DialogTitle>
            <DialogDescription>
              Carga repuestos al inventario y genera el asiento de apertura (Debe inventario / Haber patrimonio).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_120px_32px] items-end gap-2">
                <FormField label={idx === 0 ? "Repuesto" : ""} htmlFor={`il-rep-${idx}`}>
                  <select
                    id={`il-rep-${idx}`}
                    value={row.repuestoId}
                    onChange={(e) => updateRow(idx, { repuestoId: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {repuestos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.codigo} — {r.descripcion}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label={idx === 0 ? "Cant." : ""} htmlFor={`il-cant-${idx}`}>
                  <Input
                    id={`il-cant-${idx}`}
                    type="number"
                    min={1}
                    value={row.cantidad}
                    onChange={(e) => updateRow(idx, { cantidad: Number(e.target.value) })}
                  />
                </FormField>
                <FormField label={idx === 0 ? "Valor unit. (₲)" : ""} htmlFor={`il-valor-${idx}`}>
                  <Input
                    id={`il-valor-${idx}`}
                    type="number"
                    min={0}
                    value={row.valorEstimadoMercado || ""}
                    onChange={(e) =>
                      updateRow(idx, { valorEstimadoMercado: Number(e.target.value) })
                    }
                  />
                </FormField>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={rows.length === 1}
                  aria-label="Quitar fila"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 justify-self-start"
              onClick={() =>
                setRows((prev) => [...prev, { repuestoId: "", cantidad: 1, valorEstimadoMercado: 0 }])
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar repuesto
            </Button>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Fecha de carga" htmlFor="il-fecha">
                <Input
                  id="il-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </FormField>
              <FormField label="Concepto" htmlFor="il-concepto">
                <Input
                  id="il-concepto"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  placeholder="Inventario inicial del taller"
                />
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => runMut.mutate()} disabled={!canSubmit} loading={runMut.isPending}>
              Ejecutar Carga
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Result Dialog ────────────────────── */}
      <Dialog open={!!result} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Carga Inicial Ejecutada</DialogTitle>
            <DialogDescription>Lote contabilizado correctamente.</DialogDescription>
          </DialogHeader>
          {result && (
            <dl className="grid grid-cols-2 gap-3 py-2 text-sm">
              <dt className="text-muted-foreground">Lote</dt>
              <dd className="font-mono text-right">{result.batchId}</dd>
              <dt className="text-muted-foreground">Repuestos cargados</dt>
              <dd className="text-right font-medium">{result.repuestosCargados}</dd>
              <dt className="text-muted-foreground">Herramientas cargadas</dt>
              <dd className="text-right font-medium">{result.herramientasCargadas}</dd>
              <dt className="text-muted-foreground">Valor total</dt>
              <dd className="text-right font-mono">
                ₲ {Number(result.valorTotalCargado).toLocaleString("es-PY")}
              </dd>
            </dl>
          )}
          <DialogFooter>
            <Button onClick={() => setResult(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Batch Detail Dialog ──────────────── */}
      <Dialog open={!!detailBatch} onOpenChange={(open) => !open && setDetailBatch(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{detailBatch}</DialogTitle>
            <DialogDescription>Detalle de items del lote de carga inicial.</DialogDescription>
          </DialogHeader>
          {loadingDetail ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Cargando detalle...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Tipo</th>
                  <th className="py-2 font-medium">Descripción</th>
                  <th className="py-2 font-medium text-right">Cant.</th>
                  <th className="py-2 font-medium text-right">Valor unit.</th>
                  <th className="py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {batchItems.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2">
                      <Badge variant="secondary" className="text-[10px]">{item.tipo}</Badge>
                    </td>
                    <td className="py-2">{item.itemDescripcion}</td>
                    <td className="py-2 text-right font-mono">{item.cantidad}</td>
                    <td className="py-2 text-right font-mono">
                      ₲ {Number(item.valorUnitario).toLocaleString("es-PY")}
                    </td>
                    <td className="py-2 text-right font-mono">
                      ₲ {Number(item.valorTotal).toLocaleString("es-PY")}
                    </td>
                  </tr>
                ))}
                {batchItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      Sin items para este lote
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailBatch(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ToastContainer}
    </Card>
  );
}
