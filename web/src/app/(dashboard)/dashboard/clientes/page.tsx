"use client";

import * as React from "react";
import {
  Plus,
  Users,
  Phone,
  Mail,
  MapPin,
  FileText,
  Download,
  Search,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";

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

/* ── Mock Data ──────────────────────────────── */

const cities = [
  "Asunción", "San Lorenzo", "Capiatá", "Luque", "Fernando de la Mora",
  "Coronel Oviedo", "Ciudad del Este", "Encarnación", "Hernandarias", "Villarrica",
];

function generateMockClients(): ClientRecord[] {
  const firstNames = [
    "Juan Carlos", "María Fernanda", "Roberto", "Ana Lucía", "Pedro Enrique",
    "Lucía Valentina", "Fernando Daniel", "Carolina Belén", "Miguel Ángel",
    "Patricia Soledad", "Raúl Eduardo", "Gladys Mabel", "Hugo Alfredo",
    "Sandra Milagros", "Oscar Daniel", "Carlos Alberto", "Mirta Nidia",
    "Raquel Elizabeth", "Jorge Luis", "Silvia Patricia",
  ];
  const lastNames = [
    "Martínez", "González", "Ávila", "Ferreira", "Benítez", "Romero",
    "Gómez", "López", "Rojas", "Cabrera", "Torres", "Acosta", "Velázquez",
    "Espinoza", "Medina", "Pereira", "Jara", "Paredes", "Achá", "Aquino",
  ];

  return firstNames.map((first, i) => {
    const last = lastNames[i % lastNames.length];
    const city = cities[i % cities.length];
    const daysAgo = Math.floor(Math.random() * 365);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const lastVisitDate = new Date(date);
    lastVisitDate.setDate(lastVisitDate.getDate() + Math.floor(Math.random() * 60));

    return {
      id: `CLI-${String(100 + i).padStart(3, "0")}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase().replace(/\s/g, "")}.${last.toLowerCase()}@gmail.com`,
      phone: `+595${String(981 + Math.floor(Math.random() * 18)).slice(0, 3)}${String(100000 + Math.floor(Math.random() * 900000)).slice(0, 6)}`,
      ruc: `${String(1000000 + Math.floor(Math.random() * 9000000)).slice(0, 7)}-${Math.floor(Math.random() * 9)}`,
      address: `Av. ${["Mariscal López", "San Martín", "Defensores del Chaco", "Artigas", "Brasil"][i % 5]} ${1000 + i * 100}, ${city}`,
      vehicleCount: Math.floor(Math.random() * 4) + 1,
      totalOrders: Math.floor(Math.random() * 15) + 1,
      lastVisit: lastVisitDate.toLocaleDateString("es-PY"),
      createdAt: date.toLocaleDateString("es-PY"),
    };
  });
}

const mockClients = generateMockClients();

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
  const [loading, setLoading] = React.useState(true);
  const [clients, setClients] = React.useState<ClientRecord[]>([]);
  const [search, setSearch] = React.useState("");

  // Simulate loading with mock data
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setClients(mockClients);
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Filter data
  const filtered = React.useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.ruc?.includes(q)
    );
  }, [clients, search]);

  // Get counts for this month
  const thisMonthClients = clients.filter((c) => {
    const [day, month, year] = c.createdAt.split("/").map(Number);
    const created = new Date(year, month - 1, day);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return created >= monthStart;
  }).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} cliente{clients.length !== 1 ? "s" : ""} registrados
            {thisMonthClients > 0 && ` · ${thisMonthClients} nuevo${thisMonthClients !== 1 ? "s" : ""} este mes`}
          </p>
        </div>

        {/* ⭐ PRIMARY CTA */}
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nuevo Cliente
        </Button>
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
        pageSize={10}
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
