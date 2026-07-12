"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { useWorkOrders } from "@/hooks/use-data";
import { queryKeys } from "@/hooks/use-data";
import { statusConfig } from "./status-config";
import { columns } from "./columns";
import { WorkshopStats } from "./stats";
import { NewOrderDialog } from "./new-order-dialog";
import { EditOrderDialog } from "./edit-order-dialog";
import type { WorkOrder } from "./types";

/* ── Main Page ──────────────────────────────── */

export default function WorkshopPage() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading: loading } = useWorkOrders();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [selectedOrder, setSelectedOrder] = React.useState<WorkOrder | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);

  // Filter data
  const filtered = React.useMemo(() => {
    let result = orders;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.client.toLowerCase().includes(q) ||
          o.vehicle.toLowerCase().includes(q) ||
          o.plate.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      result = result.filter((o) => o.status === statusFilter);
    }
    return result;
  }, [orders, search, statusFilter]);

  // Handle new order created — invalidate cache to refresh list
  const handleOrderCreated = () => {
    qc.invalidateQueries({ queryKey: queryKeys.workOrders });
  };

  // Handle row click — open edit dialog
  const handleRowClick = (row: WorkOrder) => {
    setSelectedOrder(row);
    setEditOpen(true);
  };

  // Get today orders count
  const todayOrders = orders.filter(
    (o) => o.createdAt === new Date().toLocaleDateString("es-PY")
  ).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Taller</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de órdenes de trabajo — {todayOrders} orden{todayOrders !== 1 ? "es" : ""} hoy
          </p>
        </div>

        <NewOrderDialog onCreated={handleOrderCreated} />
      </div>

      {/* ── Stats ──────────────────────────── */}
      {!loading && <WorkshopStats orders={filtered as unknown as WorkOrder[]} />}

      {/* ── Status filter tabs ──────────────── */}
      {!loading && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
          <Button
            variant={statusFilter === "" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter("")}
            role="tab"
            aria-selected={statusFilter === ""}
          >
            Todas
          </Button>
          {Object.entries(statusConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={statusFilter === key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(key)}
              className="gap-1.5"
              role="tab"
              aria-selected={statusFilter === key}
            >
              <config.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {config.label}
            </Button>
          ))}
        </div>
      )}

      {/* ── Data Table ───────────────────────── */}
      <DataTable<WorkOrder>
        columns={columns}
        data={filtered as unknown as WorkOrder[]}
        rowKey="id"
        loading={loading}
        emptyMessage={
          search || statusFilter
            ? "No se encontraron órdenes con esos filtros"
            : "No hay órdenes de trabajo. Cree su primera orden para comenzar."
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar OT, cliente, vehículo o matrícula…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
        onRowClick={handleRowClick}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Exportar
            </Button>
          </>
        }
      />

      {/* ── Edit Dialog ────────────────────── */}
      <EditOrderDialog
        order={selectedOrder}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
