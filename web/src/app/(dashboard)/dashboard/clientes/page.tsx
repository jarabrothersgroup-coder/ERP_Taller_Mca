"use client";

import * as React from "react";
import {
  Users,
  Mail,
  Download,
  UserCheck,
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
import { ErrorState } from "@/components/ui/error-state";
import { useClientsPage } from "@/hooks/use-data";
import { useErrorToast } from "@/hooks/use-error-toast";
import { NewClientDialog } from "./new-client-dialog";

/* ── Types ──────────────────────────────────── */

interface ClientRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ruc: string | null;
  address: string | null;
  vehicleCount: number;
  totalOrders: number;
  lastVisit: string;
  createdAt: string;
}

/* ── Stats Cards ────────────────────────────── */

function ClientStats({ clients }: { clients: ClientRecord[] }) {
  const total = clients.length;
  const withVehicle = clients.filter((c) => c.vehicleCount > 0).length;
  const withEmail = clients.filter((c) => c.email).length;
  const activeThisMonth = clients.filter((c) => {
    const [day, month, year] = c.lastVisit.split("/").map(Number);
    const lastDate = new Date(year, month - 1, day);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return lastDate >= thirtyDaysAgo;
  }).length;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{total}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Con Vehículos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{withVehicle}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Con Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-violet-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{withEmail}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Activos (30d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-orange-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{activeThisMonth}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Columns ────────────────────────────────── */

const columns: Column<ClientRecord>[] = [
  {
    header: "Cliente",
    accessor: "name",
    sortable: true,
    cell: (_, row) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white text-xs font-bold">
          {row.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div>
          <p className="font-medium">{row.name}</p>
          {row.email && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" aria-hidden="true" />
              {row.email}
            </p>
          )}
        </div>
      </div>
    ),
  },
  {
    header: "Teléfono",
    accessor: "phone",
    sortable: true,
    hideOnMobile: true,
    cell: (value) => (
      <span className="text-xs font-mono">
        {value as string}
      </span>
    ),
  },
  {
    header: "RUC",
    accessor: "ruc",
    hideOnMobile: true,
    className: "text-xs font-mono text-muted-foreground",
  },
  {
    header: "Vehículos",
    accessor: "vehicleCount",
    sortable: true,
    align: "center",
    cell: (value) => (
      <Badge variant="secondary" className="font-normal">
        {value as number}
      </Badge>
    ),
  },
  {
    header: "Órdenes",
    accessor: "totalOrders",
    sortable: true,
    align: "center",
    hideOnMobile: true,
  },
  {
    header: "Última Visita",
    accessor: "lastVisit",
    sortable: true,
    align: "right",
    className: "text-xs",
  },
];

/* ── Main Page ──────────────────────────────── */

export default function ClientsPage() {
  const [search, setSearch] = React.useState("");
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

  const {
    data: clientsPage,
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useClientsPage({ search: debouncedSearch || undefined, page });
  useErrorToast(isError, "los clientes");

  // Un filtro nuevo puede dejar la página actual fuera de rango (p. ej. estaba
  // en 4 y el resultado tiene 1 página): se vuelve a la primera.
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const rawClients = clientsPage?.items ?? [];
  const totalItems = clientsPage?.total ?? 0;
  const totalPages = clientsPage?.totalPages ?? 1;

  // Map API data to local ClientRecord shape
  const clients: ClientRecord[] = React.useMemo(
    () =>
      (rawClients as unknown as Record<string, unknown>[]).map((c) => ({
        id: (c.id as string) || "",
        name: (c.name as string) || "",
        email: (c.email as string) ?? null,
        phone: (c.phone as string) ?? null,
        ruc: (c.ruc as string) ?? null,
        address: (c.address as string) ?? null,
        vehicleCount: 0,
        totalOrders: 0,
        lastVisit: c.createdAt
          ? new Date(c.createdAt as string).toLocaleDateString("es-PY")
          : "",
        createdAt: c.createdAt
          ? new Date(c.createdAt as string).toLocaleDateString("es-PY")
          : "",
      })),
    [rawClients],
  );

  // T-54: el filtrado ocurre en el servidor; la lista ya llega filtrada
  const filtered = clients;

  // Get counts for this month
  const thisMonthClients = clients.filter((c) => {
    const [day, month, year] = c.createdAt.split("/").map(Number);
    const created = new Date(year, month - 1, day);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return created >= monthStart;
  }).length;

  if (isError) {
    return (
      <ErrorState
        title="No se pudo cargar los clientes"
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
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {totalItems} cliente{totalItems !== 1 ? "s" : ""} registrados
            {thisMonthClients > 0 && ` · ${thisMonthClients} nuevo${thisMonthClients !== 1 ? "s" : ""} este mes`}
          </p>
        </div>

        {/* ⭐ PRIMARY CTA */}
        <NewClientDialog />
      </div>

      {/* ── Stats ──────────────────────────── */}
      {!loading && <ClientStats clients={filtered} />}

      {/* ── Data Table ───────────────────────── */}
      <DataTable<ClientRecord>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={
          search
            ? "No se encontraron clientes con ese criterio de búsqueda"
            : "No hay clientes registrados. Agregue su primer cliente para comenzar."
        }
        paginate
        pageSize={25}
        serverSide
        totalItems={totalItems}
        totalPages={totalPages}
        page={page - 1}
        onPageChange={(p) => setPage(p + 1)}
        sortable
        searchPlaceholder="Buscar por nombre, email, teléfono o RUC…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
        onRowClick={(row) => {
          console.log("Open client:", row.id);
        }}
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
  );
}
