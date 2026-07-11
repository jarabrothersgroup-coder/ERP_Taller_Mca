"use client";

import * as React from "react";
import {
  Plus,
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
import { fetchVehicles, type UIMappedVehicle } from "@/lib/data-service";

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

/* ── Mock Data ──────────────────────────────── */

const brands = ["Toyota", "Volkswagen", "Hyundai", "Kia", "Chevrolet", "Ford", "Nissan", "Suzuki", "Honda", "Mitsubishi"];
const models: Record<string, string[]> = {
  Toyota: ["Corolla", "Hilux", "RAV4", "Yaris", "Fortuner"],
  Volkswagen: ["Amarok", "Gol", "T-Cross", "Taos", "Vento"],
  Hyundai: ["Tucson", "Creta", "HB20", "Santa Fe", "Elantra"],
  Kia: ["Sportage", "Seltos", "Rio", "Cerato", "Sorento"],
  Chevrolet: ["Onix", "Tracker", "S10", "Cruze", "Spin"],
  Ford: ["Ranger", "Territory", "Ecosport", "Focus", "Maverick"],
  Nissan: ["Frontier", "Sentra", "Kicks", "Versa", "X-Trail"],
  Suzuki: ["Swift", "Vitara", "Jimny", "Baleno", "Ertiga"],
  Honda: ["CR-V", "Civic", "HR-V", "City", "Fit"],
  Mitsubishi: ["L200", "Montero Sport", "ASX", "Outlander", "Eclipse Cross"],
};
const engineTypes = ["Nafta", "Diésel", "HEV", "BEV"];
const plates = ["ABC", "CDE", "FGH", "IJK", "LMN", "OPQ", "RST", "UVW", "XYZ", "BCD"];

function generateMockVehicles(): VehicleRecord[] {
  return Array.from({ length: 24 }, (_, i) => {
    const brand = brands[i % brands.length];
    const modelList = models[brand];
    const model = modelList[i % modelList.length];
    const engineType = engineTypes[i % engineTypes.length];
    const year = [2020, 2021, 2022, 2023, 2024, 2025][i % 6];
    const daysAgo = Math.floor(Math.random() * 365);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const serviceDate = new Date(date);
    serviceDate.setDate(serviceDate.getDate() + Math.floor(Math.random() * 60));

    return {
      id: `VEH-${String(100 + i).padStart(3, "0")}`,
      plate: `${plates[i % plates.length]} ${String(100 + i * 7).slice(0, 3)}`,
      vin: `8AGDF${String(Math.floor(Math.random() * 1000000000)).padStart(11, "0")}`,
      brand,
      model,
      year,
      engineType,
      kilometraje: Math.floor(Math.random() * 80000) + 5000,
      clientName: `Cliente ${i + 1}`,
      lastService: serviceDate.toLocaleDateString("es-PY"),
      createdAt: date.toLocaleDateString("es-PY"),
    };
  });
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
  const [loading, setLoading] = React.useState(true);
  const [vehicles, setVehicles] = React.useState<VehicleRecord[]>([]);
  const [search, setSearch] = React.useState("");

  // Fetch with mock fallback
  React.useEffect(() => {
    const mock = generateMockVehicles();
    let cancelled = false;
    fetchVehicles(() => mock as unknown as UIMappedVehicle[]).then((data) => {
      if (!cancelled) {
        setVehicles(data as unknown as VehicleRecord[]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Filter
  const filtered = React.useMemo(() => {
    if (!search) return vehicles;
    const q = search.toLowerCase();
    return vehicles.filter(
      (v) =>
        v.brand.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.plate?.toLowerCase().includes(q) ||
        v.vin?.toLowerCase().includes(q)
    );
  }, [vehicles, search]);

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

        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nuevo Vehículo
        </Button>
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
        onRowClick={(row) => console.log("Open vehicle:", row.id)}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar
          </Button>
        }
      />
    </div>
  );
}
