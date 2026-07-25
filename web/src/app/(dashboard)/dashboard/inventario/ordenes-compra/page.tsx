"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Package, ShoppingCart, Plus, Send, Truck, Download, Search, AlertTriangle, CheckCircle2, Clock, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/* ── Types ──────────────────────────────────── */

interface PurchaseOrder {
  id: string;
  proveedor: string;
  fechaCreacion: string;
  fechaRecepcion: string | null;
  items: POItem[];
  total: number;
  estado: string; // PENDIENTE, GENERADO, COMPLETADA
  alertaReorden: boolean;
}

interface POItem {
  repuestoId: string;
  repuestoNombre?: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
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

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-700 border-amber-300",
  GENERADO: "bg-blue-100 text-blue-700 border-blue-300",
  COMPLETADA: "bg-green-100 text-green-700 border-green-300",
};

const ESTADO_ICONS: Record<string, React.ElementType> = {
  PENDIENTE: AlertTriangle,
  GENERADO: Truck,
  COMPLETADA: CheckCircle2,
};

/* ── Page Component ─────────────────────────── */

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();
  const [search, setSearch] = React.useState("");
  const [estadoFilter, setEstadoFilter] = React.useState("");

  // View pending alerts dialog
  const [alertsOpen, setAlertsOpen] = React.useState(false);

  // Fetch pending reorder alerts as purchase orders
  const { data: alertsData, isLoading } = useQuery<{ total: number; items: ReorderAlert[] }>({
    queryKey: ["reorder-alerts"],
    queryFn: () => api.request<{ total: number; items: ReorderAlert[] }>("/inventory/auto-po/pending"),
    refetchInterval: 10000,
  });

  // Transform alerts to display format
  const orders: PurchaseOrder[] = React.useMemo(() => {
    return (alertsData?.items || []).map((a: any) => ({
      id: a.id,
      proveedor: a.proveedor || "Sin proveedor",
      fechaCreacion: a.createdAt || new Date().toISOString(),
      fechaRecepcion: null,
      items: [{
        repuestoId: a.repuestoId,
        repuestoNombre: a.descripcion,
        cantidad: Math.max(a.puntoReorden - a.stockActual, 1),
        precioUnitario: Number(a.costoPromedio || 0),
        subtotal: Math.max(a.puntoReorden - a.stockActual, 1) * Number(a.costoPromedio || 0),
      }],
      total: Math.max(a.puntoReorden - a.stockActual, 1) * Number(a.costoPromedio || 0),
      estado: "PENDIENTE",
      alertaReorden: true,
    }));
  }, [alertsData]);

  // Generate purchase orders from pending alerts

  // Generate purchase orders from pending alerts
  const generatePOMut = useMutation({
    mutationFn: async () => {
      return api.request<{ generated: number; orders: any[] }>("/inventory/auto-po/generate", { method: "POST" });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["reorder-alerts"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      t.success(`${data.generated} orden(es) de compra generadas`);
    },
    onError: (err: any) => {
      t.error(err?.message || "Error al generar órdenes de compra");
    },
  });

  // Removed: create PO dialog (using auto-po/generate endpoint instead)

  const filtered = React.useMemo(() => {
    return orders.filter((o: PurchaseOrder) => {
      if (estadoFilter && o.estado !== estadoFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (o.proveedor || "").toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, estadoFilter, search]);

  const columns: Column<PurchaseOrder>[] = [
    {
      header: "ID",
      accessor: "id",
      sortable: true,
      cell: (_, row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}</span>,
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
      header: "Fecha",
      accessor: "fechaCreacion",
      sortable: true,
      hideOnMobile: true,
      cell: (_, row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.fechaCreacion).toLocaleDateString("es-PY")}
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
      accessor: "total",
      sortable: true,
      align: "right",
      cell: (_, row) => (
        <span className="font-medium">₲ {Number(row.total).toLocaleString("es-PY")}</span>
      ),
    },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      cell: (_, row) => {
        const Icon = ESTADO_ICONS[row.estado] || AlertTriangle;
        return (
          <Badge className={cn("text-xs border gap-1", ESTADO_COLORS[row.estado] || ESTADO_COLORS["PENDIENTE"])}>
            <Icon className="h-3 w-3" />
            {row.estado === "PENDIENTE" ? "Pendiente" :
             row.estado === "GENERADO" ? "Generado" :
             row.estado === "COMPLETADA" ? "Completada" : row.estado}
          </Badge>
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
            Gestión de compras de repuestos y productos
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
      <div className="flex flex-wrap gap-2" role="tablist">          {["", "PENDIENTE", "GENERADO", "COMPLETADA"].map((estado) => (
            <Button
              key={estado}
              variant={estadoFilter === estado ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setEstadoFilter(estado)}
              role="tab"
              aria-selected={estadoFilter === estado}
            >
              {estado === "" ? "Todas" :
               estado === "PENDIENTE" ? "Pendientes" :
               estado === "GENERADO" ? "Generadas" :
               estado === "COMPLETADA" ? "Completadas" : estado}
            </Button>
          ))}
      </div>

      {/* Data table */}
      <DataTable<PurchaseOrder>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={isLoading}
        emptyMessage="No hay órdenes de compra"
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar por proveedor o ID..."
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
      />

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
