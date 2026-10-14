"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorState } from "@/components/ui/error-state";
import { useErrorToast } from "@/hooks/use-error-toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Package,
  ShoppingCart,
  Send,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Eye,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/* ── Types ──────────────────────────────────── */

/** Item de `GET /inventory/purchase-orders` (PurchaseOrderItemDTO). */
interface ServerPOItem {
  id: string;
  repuestoId: string;
  cantidad: number;
  cantidadRecibida: number;
  costoUnitario: string;
  subtotal: string;
  codigo?: string | null;
  descripcion?: string | null;
}

/** Fila de `GET /inventory/purchase-orders` (PurchaseOrderDTO). */
interface ServerPO {
  id: string;
  numero: string;
  proveedor: string;
  estado: string;
  fechaEmision: string;
  fechaEsperada: string | null;
  fechaRecepcion: string | null;
  totalOc: number;
  notas: string | null;
  createdAt: string;
  items: ServerPOItem[];
}

interface ReorderAlert {
  id: string;
  repuestoId: string;
  codigo: string;
  descripcion: string;
  stockActual: number;
  puntoReorden: number;
  proveedor: string | null;
  costoPromedio: string | null;
}

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  PENDIENTE_APROB: "Pend. aprobación",
  APROBADA: "Aprobada",
  ENVIADA: "Enviada",
  RECIBIDA_PARCIAL: "Recibida parcial",
  RECIBIDA: "Recibida",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

const ESTADO_COLORS: Record<string, string> = {
  BORRADOR: "bg-muted text-muted-foreground border-border",
  PENDIENTE_APROB: "bg-amber-100 text-amber-700 border-amber-300",
  APROBADA: "bg-blue-100 text-blue-700 border-blue-300",
  ENVIADA: "bg-blue-100 text-blue-700 border-blue-300",
  RECIBIDA_PARCIAL: "bg-cyan-100 text-cyan-700 border-cyan-300",
  RECIBIDA: "bg-green-100 text-green-700 border-green-300",
  COMPLETADA: "bg-green-100 text-green-700 border-green-300",
  CANCELADA: "bg-red-100 text-red-700 border-red-300",
};

const CLOSED_STATES = new Set(["RECIBIDA", "COMPLETADA", "CANCELADA"]);
const FILTER_STATES = ["", "BORRADOR", "ENVIADA", "RECIBIDA_PARCIAL", "RECIBIDA", "CANCELADA"];

function hasPendingItems(po: ServerPO): boolean {
  return po.items.some((i) => i.cantidad > i.cantidadRecibida);
}

/* ── Page Component ─────────────────────────── */

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();
  const [search, setSearch] = React.useState("");
  const [estadoFilter, setEstadoFilter] = React.useState("");
  const [alertsOpen, setAlertsOpen] = React.useState(false);

  // Detalle de una OC (GET /inventory/purchase-orders/:id)
  const [selectedPoId, setSelectedPoId] = React.useState<string | null>(null);

  // Órdenes reales del servidor
  const {
    data: poData,
    isLoading: posLoading,
    isError: posError,
    error: posErr,
    refetch: refetchPos,
  } = useQuery<{ total: number; items: ServerPO[] }>({
    queryKey: ["purchase-orders"],
    queryFn: () => api.request<{ total: number; items: ServerPO[] }>("/inventory/purchase-orders"),
  });

  // Detalle seleccionado (refetch on demand)
  const { data: detail, isLoading: detailLoading } = useQuery<ServerPO>({
    queryKey: ["purchase-orders", selectedPoId],
    queryFn: () => api.request<ServerPO>(`/inventory/purchase-orders/${selectedPoId}`),
    enabled: !!selectedPoId,
    retry: 1,
  });

  // Alertas de reorden (auto-PO)
  const {
    data: alertsData,
    isLoading: alertsLoading,
    isError: alertsError,
    error: alertsErr,
    refetch: refetchAlerts,
  } = useQuery<{ total: number; items: ReorderAlert[] }>({
    queryKey: ["reorder-alerts"],
    queryFn: () => api.request<{ total: number; items: ReorderAlert[] }>("/inventory/auto-po/pending"),
    refetchInterval: 10000,
  });

  const isLoading = posLoading || alertsLoading;
  const isError = posError || alertsError;

  // T-53: feedback visible al fallar la carga
  useErrorToast(isError, "las órdenes de compra");

  if (isError) {
    return (
      <ErrorState
        title="No se pudo cargar las órdenes de compra"
        message={
          (posErr instanceof Error ? posErr.message : undefined) ??
          (alertsErr instanceof Error ? alertsErr.message : undefined)
        }
        onRetry={() => {
          if (posError) refetchPos();
          if (alertsError) refetchAlerts();
        }}
        className="min-h-[50vh] justify-center"
      />
    );
  }

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    qc.invalidateQueries({ queryKey: ["reorder-alerts"] });
    qc.invalidateQueries({ queryKey: ["stock-movements"] });
    qc.invalidateQueries({ queryKey: ["inventory"] });
  };

  // Generar OCs desde alertas de reorden
  const generatePOMut = useMutation({
    mutationFn: () =>
      api.request<{ generated: number; orders: ServerPO[] }>("/inventory/auto-po/generate", {
        method: "POST",
      }),
    onSuccess: (data) => {
      invalidateAll();
      t.success(`${data.generated} orden(es) de compra generadas`);
    },
    onError: (err: any) => {
      t.error(err?.message || "Error al generar órdenes de compra");
    },
  });

  // Recepcionar una OC completa (recibe el pendiente de cada item)
  const receiveMut = useMutation({
    mutationFn: (po: ServerPO) =>
      api.request(`/inventory/purchase-orders/${po.id}/receive`, {
        method: "POST",
        body: JSON.stringify({
          items: po.items
            .filter((i) => i.cantidad > i.cantidadRecibida)
            .map((i) => ({ itemId: i.id, cantidadRecibida: i.cantidad - i.cantidadRecibida })),
        }),
      }),
    onSuccess: () => {
      invalidateAll();
      setSelectedPoId(null);
      t.success("OC recepcionada — stock y asiento actualizados");
    },
    onError: (err: any) => t.error(err?.message || "No se pudo recepcionar la OC"),
  });

  // Cancelar OC (soft)
  const cancelMut = useMutation({
    mutationFn: (poId: string) =>
      api.request(`/inventory/purchase-orders/${poId}/cancel`, { method: "POST" }),
    onSuccess: () => {
      invalidateAll();
      setSelectedPoId(null);
      t.success("OC cancelada");
    },
    onError: (err: any) => t.error(err?.message || "No se pudo cancelar la OC"),
  });

  // Borrar OC (solo BORRADOR sin recepciones)
  const deleteMut = useMutation({
    mutationFn: (poId: string) =>
      api.request(`/inventory/purchase-orders/${poId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateAll();
      t.success("OC eliminada");
    },
    onError: (err: any) => t.error(err?.message || "No se pudo eliminar la OC"),
  });

  const filtered = React.useMemo(() => {
    return (poData?.items || []).filter((o: ServerPO) => {
      if (estadoFilter && o.estado !== estadoFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (o.proveedor || "").toLowerCase().includes(q) ||
          o.numero.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [poData, estadoFilter, search]);

  const columns: Column<ServerPO>[] = [
    {
      header: "Número",
      accessor: "numero",
      sortable: true,
      cell: (_, row) => <span className="font-mono text-xs">{row.numero}</span>,
    },
    {
      header: "Proveedor",
      accessor: "proveedor",
      sortable: true,
      cell: (_, row) => (
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.proveedor}</span>
        </div>
      ),
    },
    {
      header: "Emisión",
      accessor: "fechaEmision",
      sortable: true,
      hideOnMobile: true,
      cell: (_, row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.fechaEmision).toLocaleDateString("es-PY")}
        </span>
      ),
    },
    {
      header: "Items",
      accessor: "items",
      align: "center",
      cell: (_, row) => <span className="font-mono text-xs">{row.items?.length || 0}</span>,
    },
    {
      header: "Total",
      accessor: "totalOc",
      sortable: true,
      align: "right",
      cell: (_, row) => (
        <span className="font-medium">₲ {Number(row.totalOc).toLocaleString("es-PY")}</span>
      ),
    },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      cell: (_, row) => (
        <Badge className={cn("text-xs border gap-1", ESTADO_COLORS[row.estado] || ESTADO_COLORS.BORRADOR)}>
          {ESTADO_LABELS[row.estado] || row.estado}
        </Badge>
      ),
    },
    {
      header: "",
      accessor: "id",
      align: "right",
      cell: (_, row) => {
        const closed = CLOSED_STATES.has(row.estado);
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="Ver detalle"
              onClick={() => setSelectedPoId(row.id)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {!closed && hasPendingItems(row) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-emerald-600"
                title="Recepcionar (pendientes)"
                onClick={() => {
                  if (confirm(`¿Recepcionar la OC ${row.numero}? Se recibirá el pendiente de cada item.`))
                    receiveMut.mutate(row);
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {!closed && row.estado !== "CANCELADA" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-amber-600"
                title="Cancelar OC"
                onClick={() => {
                  if (confirm(`¿Cancelar la OC ${row.numero}?`)) cancelMut.mutate(row.id);
                }}
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            {row.estado === "BORRADOR" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-500"
                title="Eliminar borrador"
                onClick={() => {
                  if (confirm(`¿Eliminar la OC ${row.numero} (borrador)?`)) deleteMut.mutate(row.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-indigo-500" />
            Órdenes de Compra
          </h1>
          <p className="text-sm text-muted-foreground">
            {poData?.total ?? 0} orden{poData?.total === 1 ? "" : "es"} · compras de repuestos y productos
          </p>
        </div>
        <div className="flex gap-2">
          {alertsData && alertsData.total > 0 && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 text-amber-600 border-amber-300" onClick={() => setAlertsOpen(true)}>
                <AlertTriangle className="h-4 w-4" />
                {alertsData.total} alerta{alertsData.total > 1 ? "s" : ""}
              </Button>
              <Button variant="default" size="sm" className="gap-1.5" onClick={() => generatePOMut.mutate()} loading={generatePOMut.isPending}>
                <Send className="h-4 w-4" />
                Generar Órdenes
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2" role="tablist">
        {FILTER_STATES.map((estado) => (
          <Button
            key={estado}
            variant={estadoFilter === estado ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setEstadoFilter(estado)}
            role="tab"
            aria-selected={estadoFilter === estado}
          >
            {estado === "" ? "Todas" : ESTADO_LABELS[estado] || estado}
          </Button>
        ))}
      </div>

      {/* Data table */}
      <DataTable<ServerPO>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={isLoading}
        emptyMessage="No hay órdenes de compra — generá órdenes desde las alertas de reorden"
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar por número, proveedor..."
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
      />

      {/* ── Detail Dialog ─────────────────────── */}
      <Dialog open={!!selectedPoId} onOpenChange={(open) => !open && setSelectedPoId(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-500" />
              {detail ? `OC ${detail.numero}` : "Detalle de la OC"}
            </DialogTitle>
            <DialogDescription>
              {detail ? `${detail.proveedor} · ${ESTADO_LABELS[detail.estado] || detail.estado}` : "Cargando…"}
            </DialogDescription>
          </DialogHeader>

          {detailLoading && <p className="text-sm text-muted-foreground py-4">Cargando detalle…</p>}

          {detail && !detailLoading && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Emisión: {new Date(detail.fechaEmision).toLocaleDateString("es-PY")}</span>
                {detail.fechaEsperada && (
                  <span>Esperada: {new Date(detail.fechaEsperada).toLocaleDateString("es-PY")}</span>
                )}
                {detail.fechaRecepcion && (
                  <span>Recepción: {new Date(detail.fechaRecepcion).toLocaleDateString("es-PY")}</span>
                )}
              </div>

              <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
                {detail.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {item.descripcion || item.codigo || item.repuestoId.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pedidas: {item.cantidad} · Recibidas: {item.cantidadRecibida}
                      </p>
                    </div>
                    <span className="font-mono text-xs shrink-0 ml-3">
                      ₲ {Number(item.subtotal).toLocaleString("es-PY")}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-sm font-medium">
                <span>Total</span>
                <span>₲ {Number(detail.totalOc).toLocaleString("es-PY")}</span>
              </div>

              {detail.notas && (
                <p className="text-xs text-muted-foreground">{detail.notas}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPoId(null)}>
              Cerrar
            </Button>
            {detail && !CLOSED_STATES.has(detail.estado) && hasPendingItems(detail) && (
              <Button onClick={() => receiveMut.mutate(detail)} loading={receiveMut.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Recepcionar
              </Button>
            )}
            {detail && !CLOSED_STATES.has(detail.estado) && (
              <Button
                variant="outline"
                className="text-amber-600"
                onClick={() => {
                  if (confirm(`¿Cancelar la OC ${detail.numero}?`)) cancelMut.mutate(detail.id);
                }}
                loading={cancelMut.isPending}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Alerts Dialog ────────────────────── */}
      <Dialog open={alertsOpen} onOpenChange={setAlertsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Alertas de Reorden ({alertsData?.total || 0})
            </DialogTitle>
            <DialogDescription>
              Estos repuestos están por debajo de su punto de reorden.
              Usá el botón "Generar Órdenes" para crear las órdenes de compra automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {(alertsData?.items || []).map((alerta) => (
              <div
                key={alerta.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div>
                  <p className="text-sm font-medium">{alerta.codigo} — {alerta.descripcion}</p>
                  <p className="text-xs text-muted-foreground">
                    Stock: {alerta.stockActual} · Mínimo: {alerta.puntoReorden} · Proveedor: {alerta.proveedor || "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlertsOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={() => { generatePOMut.mutate(); setAlertsOpen(false); }} loading={generatePOMut.isPending}>
              <Send className="h-4 w-4 mr-1" />
              Generar Órdenes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ToastContainer}
    </div>
  );
}
