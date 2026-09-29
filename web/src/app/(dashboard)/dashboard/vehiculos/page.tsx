"use client";

import * as React from "react";
import {
  Car,
  BatteryWarning,
  Gauge,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { useVehicles } from "@/hooks/use-data";
import { ErrorState } from "@/components/ui/error-state";
import { useErrorToast } from "@/hooks/use-error-toast";
import { NewVehicleDialog } from "./new-vehicle-dialog";
import { MaintenanceFichaDialog } from "./maintenance-ficha-dialog";

/* ── Types ──────────────────────────────────── */

interface VehicleRecord {
  id: string;
  plate: string | null;
  vin: string | null;
  brand: string;
  model: string;
  year: number | null;
  engineType: string;
  kilometraje: number | null;
  clientName: string;
  lastService: string;
  createdAt: string;
}

/* ── Engine Type Config ─────────────────────── */

const engineConfig: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "destructive"; icon: React.ElementType }> = {
  Nafta: { label: "Nafta", variant: "default", icon: Car },
  Diésel: { label: "Diésel", variant: "secondary", icon: Car },
  HEV: { label: "HEV Híbrido", variant: "warning", icon: BatteryWarning },
  BEV: { label: "BEV Eléctrico", variant: "destructive", icon: BatteryWarning },
};

/* ── Stats Cards ────────────────────────────── */

function VehicleStats({ vehicles }: { vehicles: VehicleRecord[] }) {
  const total = vehicles.length;
  const hevBev = vehicles.filter((v) => v.engineType === "HEV" || v.engineType === "BEV").length;
  const diesel = vehicles.filter((v) => v.engineType === "Diésel").length;
  const avgKm = vehicles.length
    ? Math.round(vehicles.reduce((acc, v) => acc + (v.kilometraje ?? 0), 0) / vehicles.length)
    : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Vehículos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{total}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">HEV / BEV</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <BatteryWarning className={cn("h-4 w-4", hevBev > 0 ? "text-orange-500" : "text-muted-foreground")} aria-hidden="true" />
            <p className="text-2xl font-bold">{hevBev}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Diésel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{diesel}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Km Promedio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-violet-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{avgKm.toLocaleString("es-PY")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Columns ────────────────────────────────── */

const columns: Column<VehicleRecord>[] = [
  {
    header: "Vehículo",
    accessor: "brand",
    sortable: true,
    cell: (_, row) => (
      <div>
        <p className="font-medium">{row.brand} {row.model}</p>
        <p className="text-xs text-muted-foreground">{row.year} · {row.plate}</p>
      </div>
    ),
  },
  {
    header: "VIN",
    accessor: "vin",
    hideOnMobile: true,
    className: "text-xs font-mono text-muted-foreground",
  },
  {
    header: "Motor",
    accessor: "engineType",
    sortable: true,
    cell: (_, row) => {
      const config = engineConfig[row.engineType];
      return (
        <Badge variant={config.variant} className="gap-1 font-normal">
          <config.icon className="h-3 w-3" aria-hidden="true" />
          {config.label}
        </Badge>
      );
    },
  },
  {
    header: "Kilometraje",
    accessor: "kilometraje",
    sortable: true,
    align: "right",
    cell: (value) => (
      <span className="tabular-nums text-sm">
        {(value as number)?.toLocaleString("es-PY") ?? "—"} km
      </span>
    ),
  },
  {
    header: "Cliente",
    accessor: "clientName",
    sortable: true,
    hideOnMobile: true,
  },
  {
    header: "Último Servicio",
    accessor: "lastService",
    sortable: true,
    align: "right",
    className: "text-xs",
  },
];

/* ── Main Page ──────────────────────────────── */

export default function VehiclesPage() {
  const [search, setSearch] = React.useState("");
  // T-54: la búsqueda viaja al backend con debounce (antes filtraba el array
  // completo en el cliente, así que la lista se truncaba en los primeros 100).
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data: rawVehicles = [],
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useVehicles({ search: debouncedSearch || undefined });
  // T-53: feedback visible al fallar la carga
  useErrorToast(isError, "los vehículos");
  // T-43: ficha de próximos mantenimientos al hacer click en una fila
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string | null>(null);

  // Map API data to local VehicleRecord shape
  const vehicles: VehicleRecord[] = React.useMemo(
    () =>
      (rawVehicles as unknown as Record<string, unknown>[]).map((v) => ({
        id: (v.id as string) || "",
        plate: (v.plate as string) ?? null,
        vin: (v.vin as string) ?? null,
        brand: (v.brand as string) || "",
        model: (v.model as string) || "",
        year: (v.year as number) ?? null,
        engineType: (v.engineType as string) || "Nafta",
        kilometraje: (v.kilometraje as number) ?? null,
        clientName: "",
        lastService: "",
        createdAt: v.createdAt
          ? new Date(v.createdAt as string).toLocaleDateString("es-PY")
          : "",
      })),
    [rawVehicles],
  );

  // T-54: el filtrado ocurre en el servidor; la lista ya llega filtrada
  const filtered = vehicles;

  if (isError) {
    return (
      <ErrorState
        title="No se pudo cargar los vehículos"
        message={error instanceof Error ? error.message : undefined}
        onRetry={refetch}
        className="min-h-[50vh] justify-center"
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vehículos</h1>
          <p className="text-sm text-muted-foreground">
            Registro de vehículos del taller — {vehicles.length} en total
          </p>
        </div>

        <NewVehicleDialog />
      </div>

      {/* ── Stats ──────────────────────────── */}
      {!loading && <VehicleStats vehicles={filtered} />}

      {/* ── Data Table ───────────────────────── */}
      <DataTable<VehicleRecord>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={
          search
            ? "No se encontraron vehículos con ese criterio de búsqueda"
            : "No hay vehículos registrados. Agregue su primer vehículo."
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar por marca, modelo, placa o VIN…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
        onRowClick={(row) => setSelectedVehicleId(row.id || null)}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar
          </Button>
        }
      />

      {/* T-43: ficha de próximos mantenimientos */}
      <MaintenanceFichaDialog
        vehicleId={selectedVehicleId}
        onClose={() => setSelectedVehicleId(null)}
      />
    </div>
  );
}
