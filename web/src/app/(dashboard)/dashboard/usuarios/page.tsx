"use client";

import * as React from "react";
import {
  Plus,
  Users,
  UserCog,
  Wrench,
  Shield,
  User,
  CheckCircle2,
  XCircle,
  Download,
  Mail,
  Phone,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { fetchUsers, type UIMappedUser } from "@/lib/data-service";

/* ── Types ──────────────────────────────────── */

interface UserRecord extends UIMappedUser {
  // Extended from base type
}

/* ── Role Configuration ─────────────────────── */

const roleConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  admin: { label: "Administrador", icon: Shield, color: "text-orange-500", bgColor: "bg-orange-500/10 border-orange-200 dark:border-orange-800" },
  manager: { label: "Gerente", icon: UserCog, color: "text-blue-500", bgColor: "bg-blue-500/10 border-blue-200 dark:border-blue-800" },
  mechanic: { label: "Mecánico", icon: Wrench, color: "text-emerald-500", bgColor: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-800" },
  user: { label: "Usuario", icon: User, color: "text-muted-foreground", bgColor: "bg-muted/50" },
};

/* ── Mock Data ──────────────────────────────── */

function getMockUsers(): UserRecord[] {
  return [
    { id: "usr-001", name: "Juan Ángel Jara", email: "jaraju01@gmail.com", role: "admin", activo: true, createdAt: "01/01/2025" },
    { id: "usr-002", name: "María Elena López", email: "maria.lopez@taller.com", role: "manager", activo: true, createdAt: "15/02/2025" },
    { id: "usr-003", name: "Carlos Martínez", email: "carlos.m@taller.com", role: "mechanic", activo: true, createdAt: "01/03/2025" },
    { id: "usr-004", name: "Ana Rodríguez", email: "ana.r@taller.com", role: "mechanic", activo: true, createdAt: "01/03/2025" },
    { id: "usr-005", name: "Luis González", email: "luis.g@taller.com", role: "mechanic", activo: true, createdAt: "15/03/2025" },
    { id: "usr-006", name: "Pedro Sánchez", email: "pedro.s@taller.com", role: "mechanic", activo: false, createdAt: "01/04/2025" },
    { id: "usr-007", name: "Sofía Fernández", email: "sofia.f@taller.com", role: "user", activo: true, createdAt: "01/05/2025" },
    { id: "usr-008", name: "Roberto Ayala", email: "roberto.a@taller.com", role: "manager", activo: true, createdAt: "15/05/2025" },
    { id: "usr-009", name: "Laura Benítez", email: "laura.b@taller.com", role: "user", activo: true, createdAt: "01/06/2025" },
    { id: "usr-010", name: "Diego Rivas", email: "diego.r@taller.com", role: "mechanic", activo: true, createdAt: "01/06/2025" },
    { id: "usr-011", name: "Camila Torres", email: "camila.t@taller.com", role: "mechanic", activo: true, createdAt: "15/06/2025" },
    { id: "usr-012", name: "Fernando Duarte", email: "fernando.d@taller.com", role: "admin", activo: true, createdAt: "20/06/2025" },
  ];
}

/* ── Stats Cards ────────────────────────────── */

function UserStats({ users }: { users: UserRecord[] }) {
  const total = users.length;
  const admins = users.filter((u) => u.role === "admin").length;
  const mechanics = users.filter((u) => u.role === "mechanic").length;
  const active = users.filter((u) => u.activo).length;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Usuarios</CardTitle>
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
          <CardTitle className="text-sm font-medium text-muted-foreground">Administradores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{admins}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Mecánicos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{mechanics}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            Activos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-emerald-500">{active}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {total - active} inactivo{(total - active) !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Columns ────────────────────────────────── */

const columns: Column<UserRecord>[] = [
  {
    header: "Usuario",
    accessor: "name",
    sortable: true,
    cell: (_, row) => {
      const initials = row.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      const role = roleConfig[row.role];

      return (
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold shrink-0",
            role.bgColor,
            role.color
          )}>
            {initials}
          </div>
          <div>
            <p className="font-medium">{row.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Mail className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">{row.email}</span>
            </div>
          </div>
        </div>
      );
    },
  },
  {
    header: "Rol",
    accessor: "role",
    sortable: true,
    sortKey: "role",
    cell: (_, row) => {
      const role = roleConfig[row.role] ?? roleConfig.user;
      return (
        <Badge variant="secondary" className={cn("gap-1.5 border", role.bgColor.split(" ")[2] || "")}>
          <role.icon className={cn("h-3 w-3", role.color)} aria-hidden="true" />
          <span className={role.color}>{role.label}</span>
        </Badge>
      );
    },
  },
  {
    header: "Estado",
    accessor: "activo",
    sortable: true,
    cell: (_, row) => (
      <div className="flex items-center gap-1.5">
        {row.activo ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            <span className="text-sm text-emerald-600 dark:text-emerald-400">Activo</span>
          </>
        ) : (
          <>
            <XCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm text-muted-foreground">Inactivo</span>
          </>
        )}
      </div>
    ),
  },
  {
    header: "Registro",
    accessor: "createdAt",
    sortable: true,
    className: "text-xs text-muted-foreground",
    hideOnMobile: true,
  },
];

/* ── Main Page ──────────────────────────────── */

export default function UsuariosPage() {
  const [loading, setLoading] = React.useState(true);
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("");

  // Fetch from API with mock fallback
  React.useEffect(() => {
    let cancelled = false;
    fetchUsers(getMockUsers).then((data) => {
      if (!cancelled) {
        setUsers(data as UserRecord[]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Filter data
  const filtered = React.useMemo(() => {
    let result = users;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }
    if (roleFilter) {
      result = result.filter((u) => u.role === roleFilter);
    }
    return result;
  }, [users, search, roleFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de usuarios, roles y permisos del taller
          </p>
        </div>

        {/* ⭐ PRIMARY CTA */}
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nuevo Usuario
        </Button>
      </div>

      {/* ── Stats ──────────────────────────── */}
      {!loading && <UserStats users={filtered} />}

      {/* ── Role filter tabs ────────────────── */}
      {!loading && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por rol">
          <Button
            variant={roleFilter === "" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setRoleFilter("")}
            role="tab"
            aria-selected={roleFilter === ""}
          >
            Todos
          </Button>
          {Object.entries(roleConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={roleFilter === key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setRoleFilter(key)}
              className="gap-1.5"
              role="tab"
              aria-selected={roleFilter === key}
            >
              <config.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {config.label}
            </Button>
          ))}
        </div>
      )}

      {/* ── Data Table ───────────────────────── */}
      <DataTable<UserRecord>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={
          search || roleFilter
            ? "No se encontraron usuarios con esos filtros"
            : "No hay usuarios registrados. Agregue su primer usuario para comenzar."
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar usuario o email…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
        onRowClick={(row) => {
          console.log("Edit user:", row.id);
        }}
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
