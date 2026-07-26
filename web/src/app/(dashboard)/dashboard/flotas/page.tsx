"use client";

import * as React from "react";
import {
  Truck,
  Plus,
  Building2,
  Users,
  Percent,
  FileText,
  Phone,
  Mail,
  Download,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { useFleets } from "@/hooks/use-data";
import type { UIMappedFleet } from "@/lib/data-service";

/* ── Types ──────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface FleetRecord extends UIMappedFleet {
  // Extended from base type (extends UIMappedFleet)
}

/* ── Contract Type Colors ───────────────────── */

const contractColors: Record<string, "success" | "default" | "secondary" | "warning"> = {
  MENSUAL: "success",
  TRIMESTRAL: "default",
  SEMESTRAL: "secondary",
  ANUAL: "warning",
};

/* ── Stats Cards ────────────────────────────── */

function FleetStats({ fleets }: { fleets: FleetRecord[] }) {
  const total = fleets.length;
  const totalVehiculos = total * 8;
  const contratosMensual = fleets.filter((f) => f.contratoTipo === "MENSUAL").length;
  const descPromedio = Math.round(fleets.reduce((s, f) => s + f.descuentoPorcentaje, 0) / total);

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Flotas Activas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-amber-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{total}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Vehículos Aprox.</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">~{totalVehiculos}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">En flotas activas</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Contratos Mensuales</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-emerald-500">{contratosMensual}</p>
          <p className="text-xs text-muted-foreground mt-1">De {total} flotas</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Descuento Promedio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-violet-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{descPromedio}%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Columns ────────────────────────────────── */

const columns: Column<FleetRecord>[] = [
  {
    header: "Flota",
    accessor: "nombre",
    sortable: true,
    cell: (_, row) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Truck className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium">{row.nombre}</p>
          <p className="text-xs text-muted-foreground">{row.empresa}</p>
        </div>
      </div>
    ),
  },
  {
    header: "Contacto",
    accessor: "contacto",
    sortable: true,
    cell: (_, row) => (
      <div>
        <p className="text-sm font-medium">{row.contacto}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Phone className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">{row.telefono}</span>
        </div>
        {row.email && (
          <div className="flex items-center gap-1 mt-0.5">
            <Mail className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">{row.email}</span>
          </div>
        )}
      </div>
    ),
  },
  {
    header: "RUC",
    accessor: "ruc",
    sortable: true,
    hideOnMobile: true,
    className: "font-mono text-xs",
  },
  {
    header: "Contrato",
    accessor: "contratoTipo",
    sortable: true,
    cell: (_, row) => (
      <Badge variant={contractColors[row.contratoTipo] || "secondary"}>
        {row.contratoTipo}
      </Badge>
    ),
  },
  {
    header: "Descuento",
    accessor: "descuentoPorcentaje",
    sortable: true,
    align: "right",
    cell: (value) => (
      <span className="tabular-nums font-medium text-emerald-500">
        {value as number}%
      </span>
    ),
  },
  {
    header: "Registro",
    accessor: "createdAt",
    sortable: true,
    className: "text-xs",
    hideOnMobile: true,
  },
];

/* ── Main Page ──────────────────────────────── */

export default function FlotasPage() {
  const { data: fleets = [], isLoading: loading } = useFleets();
  const [search, setSearch] = React.useState("");
  const [contractFilter, setContractFilter] = React.useState<string>("");

  const filtered = React.useMemo(() => {
    let result = fleets;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.nombre.toLowerCase().includes(q) ||
          f.empresa.toLowerCase().includes(q) ||
          f.contacto.toLowerCase().includes(q) ||
          f.ruc.includes(q)
      );
    }
    if (contractFilter) {
      result = result.filter((f) => f.contratoTipo === contractFilter);
    }
    return result;
  }, [fleets, search, contractFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flotas Empresariales</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de flotas B2B, contratos y mantenimiento programado
          </p>
        </div>
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nueva Flota
        </Button>
      </div>

      {/* Stats */}
      {!loading && <FleetStats fleets={filtered} />}

      {/* Contract filter tabs */}
      {!loading && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por contrato">
          <Button
            variant={contractFilter === "" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setContractFilter("")}
            role="tab"
            aria-selected={contractFilter === ""}
          >
            Todas
          </Button>
          {["MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"].map((tipo) => (
            <Button
              key={tipo}
              variant={contractFilter === tipo ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setContractFilter(tipo)}
              role="tab"
              aria-selected={contractFilter === tipo}
            >
              {tipo}
            </Button>
          ))}
        </div>
      )}

      {/* Data Table */}
      <DataTable<FleetRecord>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={
          search || contractFilter
            ? "No se encontraron flotas con esos filtros"
            : "No hay flotas registradas. Agregue su primera flota."
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar flota, empresa o contacto…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
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
