"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { useWorkOrders } from "@/hooks/use-data";
import { queryKeys } from "@/hooks/use-data";
import { ErrorState } from "@/components/ui/error-state";
import { useErrorToast } from "@/hooks/use-error-toast";
import { statusConfig } from "./status-config";
import { columns } from "./columns";
import { WorkshopStats } from "./stats";
import { NewOrderDialog } from "./new-order-dialog";
import { EditOrderDialog } from "./edit-order-dialog";
import { WorkshopCard } from "./workshop-card";
import type { WorkOrder, OrderStatus } from "./types";

/* ── Main Page ──────────────────────────────── */

export default function WorkshopPage() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [selectedOrder, setSelectedOrder] = React.useState<WorkOrder | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);

  // T-54: la búsqueda viaja al backend con debounce (antes filtraba el array
  // completo en el cliente, así que la lista se truncaba en los primeros 100).
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data: orders = [],
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useWorkOrders({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  });
  // T-53: feedback visible al fallar la carga
  useErrorToast(isError, "las órdenes de trabajo");

  if (isError) {
    return (
      <ErrorState
        title="No se pudo cargar las órdenes de trabajo"
        message={error instanceof Error ? error.message : undefined}
        onRetry={refetch}
        className="min-h-[50vh] justify-center"
      />
    );
  }

  // T-54: el filtrado ocurre en el servidor; la lista ya llega filtrada
  const filtered = orders;

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

      {/* ── Desktop: Data Table / Mobile: Cards ──── */}
      <div className="hidden md:block">
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
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            {search || statusFilter
              ? "No se encontraron órdenes con esos filtros"
              : "No hay órdenes de trabajo"}
          </p>
        ) : (
          filtered.map((order) => (
            <WorkshopCard
              key={order.id}
              order={order}
              onClick={handleRowClick}
            />
          ))
        )}
      </div>

      {/* ── Edit Dialog ────────────────────── */}
      <EditOrderDialog
        order={selectedOrder}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
