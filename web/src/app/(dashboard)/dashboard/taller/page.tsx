"use client";

import * as React from "react";
import { Download, Trash2, ListChecks, Save } from "lucide-react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useWorkOrdersPage } from "@/hooks/use-data";
import { queryKeys } from "@/hooks/use-data";
import { ErrorState } from "@/components/ui/error-state";
import { useErrorToast } from "@/hooks/use-error-toast";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { statusConfig } from "./status-config";
import { columns } from "./columns";
import { WorkshopStats } from "./stats";
import { WorkshopKpiCards } from "./kpi-cards";
import { NewOrderDialog } from "./new-order-dialog";
import { EditOrderDialog } from "./edit-order-dialog";
import { WorkshopCard } from "./workshop-card";
import type { WorkOrder, OrderStatus } from "./types";

/* ── Filter Presets (T-63 S126) ────────────── */

interface FilterPreset {
  id: string;
  name: string;
  entity: string;
  filters: { field: string; operator: string; value: unknown }[];
}

interface QuickFilter {
  key: string;
  label?: string;
  field?: string;
  operator?: string;
  value?: unknown;
}

/* ── Main Page ──────────────────────────────── */

export default function WorkshopPage() {
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [selectedOrder, setSelectedOrder] = React.useState<WorkOrder | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);

  // ── Selección múltiple para operaciones batch ──
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [batchStatus, setBatchStatus] = React.useState("Listo");

  // ── Filter presets (T-63 S126) ──
  const [presetName, setPresetName] = React.useState("");
  const { data: presetsData, refetch: refetchPresets } = useQuery<{ presets: FilterPreset[]; total: number }>({
    queryKey: ["presets", "ordenes"],
    queryFn: () => api.request("/presets?entity=ordenes") as any,
  });
  const { data: quickData } = useQuery<{ quickFilters: QuickFilter[] }>({
    queryKey: ["presets", "quick", "ordenes"],
    queryFn: () => api.request("/presets/quick/ordenes") as any,
  });
  const createPresetMut = useMutation({
    mutationFn: () =>
      api.request("/presets", {
        method: "POST",
        body: JSON.stringify({
          name: presetName,
          entity: "ordenes",
          filters: [{ field: "estado", operator: "=", value: statusFilter || "Todas" }],
        }),
      }),
    onSuccess: () => {
      t.success("Preset guardado");
      setPresetName("");
      refetchPresets();
    },
    onError: (err: any) => t.error(err?.message || "No se pudo guardar el preset"),
  });
  const deletePresetMut = useMutation({
    mutationFn: (id: string) => api.request(`/presets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      t.success("Preset eliminado");
      refetchPresets();
    },
    onError: (err: any) => t.error(err?.message || "No se pudo eliminar el preset"),
  });

  const batchStatusMut = useMutation({
    mutationFn: () =>
      api.request<{ ok: boolean; updated: number }>("/workshop/ordenes/batch/status", {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds, status: batchStatus }),
      }),
    onSuccess: (d) => {
      t.success(`${d.updated} orden(es) pasaron a ${batchStatus}`);
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: queryKeys.workOrders });
    },
    onError: (err: any) => t.error(err?.message || "No se pudo aplicar el estado en lote"),
  });

  const batchDeleteMut = useMutation({
    mutationFn: () =>
      api.request<{ ok: boolean; deleted: number }>("/workshop/ordenes/batch/delete", {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds }),
      }),
    onSuccess: (d) => {
      t.success(`${d.deleted} orden(es) archivadas`);
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: queryKeys.workOrders });
    },
    onError: (err: any) => t.error(err?.message || "No se pudo archivar la selección"),
  });

  // T-54: la búsqueda viaja al backend con debounce (antes filtraba el array
  // completo en el cliente, así que la lista se truncaba en los primeros 100).
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // D1: `page` en el estado (base 1) para que la tabla salte de página real,
  // no de una paginación client-side sobre los primeros 100 registros.
  const [page, setPage] = React.useState(1);
  // Un filtro nuevo (búsqueda o estado) puede dejar la página fuera de rango.
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const {
    data: ordersPage,
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useWorkOrdersPage({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    page,
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
  // (limitada a la página actual de 25 filas — D1).
  const orders = ordersPage?.items ?? [];
  const totalItems = ordersPage?.total ?? 0;
  const totalPages = ordersPage?.totalPages ?? 1;
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

  // Columna de selección + columnas base (para operaciones batch)
  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };
  const tableColumns: Column<WorkOrder>[] = [
    {
      header: "",
      accessor: "id",
      className: "w-8",
      cell: (_, row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={(e) => { e.stopPropagation(); toggleSelected(row.id, e.target.checked); }}
          onClick={(e) => e.stopPropagation()}
          className="rounded"
          aria-label={`Seleccionar OT ${row.id.slice(0, 8)}`}
        />
      ),
    },
    ...columns,
  ];

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

      {/* ── KPIs del servidor (analytics) ───── */}
      <WorkshopKpiCards />

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

      {/* ── Filter presets (T-63 S126) ──────── */}
      <div className="flex flex-wrap items-center gap-2 border rounded-lg p-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {(quickData?.quickFilters || []).slice(0, 3).map((qf) => (
          <Button
            key={qf.key}
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setStatusFilter(qf.value === "Todas" ? "" : String(qf.value ?? ""))}
          >
            {qf.label || qf.key}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Nombre del preset…"
            className="h-7 w-40 rounded border bg-background px-2 text-xs"
          />
          <Button
            variant="outline" size="sm" className="h-7 gap-1"
            onClick={() => createPresetMut.mutate()}
            disabled={!presetName || createPresetMut.isPending}
          >
            <Save className="h-3 w-3" aria-hidden="true" /> Guardar
          </Button>
        </div>
        {(presetsData?.presets || []).map((p) => (
          <div key={p.id} className="flex items-center gap-1 rounded border px-2 py-0.5 text-xs">
            <button
              className="hover:underline"
              onClick={() => {
                const estado = p.filters.find((f) => f.field === "estado")?.value;
                setStatusFilter(estado && estado !== "Todas" ? String(estado) : "");
              }}
            >
              {p.name}
            </button>
            <button className="text-muted-foreground hover:text-red-600" onClick={() => deletePresetMut.mutate(p.id)} aria-label={`Eliminar preset ${p.name}`}>
              <Trash2 className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {/* ── Barra de acciones batch (selección múltiple) ── */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent/40 px-3 py-2 text-sm">
          <ListChecks className="h-4 w-4 text-blue-600" aria-hidden="true" />
          <span className="font-medium">{selectedIds.length} orden{selectedIds.length !== 1 ? "es" : ""} seleccionada{selectedIds.length !== 1 ? "s" : ""}</span>
          <select
            value={batchStatus}
            onChange={(e) => setBatchStatus(e.target.value)}
            className="h-8 rounded border border-input bg-background px-2 text-xs"
            aria-label="Estado a aplicar"
          >
            {Object.keys(statusConfig).map((k) => (
              <option key={k} value={k}>{statusConfig[k].label}</option>
            ))}
          </select>
          <Button size="sm" className="h-7 text-xs" loading={batchStatusMut.isPending} onClick={() => batchStatusMut.mutate()}>
            Aplicar estado
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs gap-1"
            loading={batchDeleteMut.isPending}
            onClick={() => {
              if (confirm(`¿Archivar ${selectedIds.length} orden(es)? (pasa a "Listo")`)) batchDeleteMut.mutate();
            }}
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" /> Archivar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds([])}>
            Limpiar
          </Button>
        </div>
      )}

      {/* ── Desktop: Data Table / Mobile: Cards ──── */}
      <div className="hidden md:block">
        <DataTable<WorkOrder>
          columns={tableColumns}
          data={filtered as unknown as WorkOrder[]}
          rowKey="id"
          loading={loading}
          emptyMessage={
            search || statusFilter
              ? "No se encontraron órdenes con esos filtros"
              : "No hay órdenes de trabajo. Cree su primera orden para comenzar."
          }
          paginate
          pageSize={25}
          serverSide
          totalItems={totalItems}
          totalPages={totalPages}
          page={page - 1}
          onPageChange={(p) => setPage(p + 1)}
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
      {ToastContainer}
    </div>
  );
}
