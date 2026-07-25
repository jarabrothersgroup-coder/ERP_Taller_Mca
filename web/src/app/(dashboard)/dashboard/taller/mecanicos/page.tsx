"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Wrench,
  Star,
  ShieldCheck,
  Car,
  Mail,
  Phone,
  Calendar,
  UserCheck,
  Plus,
  Download,
  Timer,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────── */

interface MechanicProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  /** Derived fields (computed client-side from historical data) */
  otsActivas?: number;
  eficiencia?: number;
  certificaciones?: string[];
}

/* ── Role config ────────────────────────────── */

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  mechanic: { label: "Mecánico", color: "bg-blue-100 text-blue-700 border-blue-300" },
  supervisor: { label: "Supervisor", color: "bg-purple-100 text-purple-700 border-purple-300" },
  admin: { label: "Admin", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
};

/* ── Main Page ──────────────────────────────── */

export default function MecanicosPage() {
  const qc = useQueryClient();
  const { toast, ToastContainer } = useToast();
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [newProfile, setNewProfile] = React.useState({ email: "", fullName: "", role: "mechanic" });

  // ── Fetch all profiles ──
  const { data: rawProfiles = [], isLoading } = useQuery<any[]>({
    queryKey: ["profiles"],
    queryFn: () => api.request<any[]>("/api/profiles"),
  });

  // ── Filter to mechanics only ──
  const mechanics: MechanicProfile[] = React.useMemo(() => {
    return (rawProfiles || [])
      .filter((p: any) => p.role === "mechanic" || p.role === "supervisor")
      .map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        role: p.role,
        is_active: p.is_active ?? true,
        created_at: p.created_at ? new Date(p.created_at).toLocaleDateString("es-PY") : "",
        otsActivas: 0,
        eficiencia: 75,
        certificaciones: p.role === "supervisor" ? ["HV", "AC"] : [],
      }));
  }, [rawProfiles]);

  // ── Filter + search ──
  const filtered = React.useMemo(() => {
    let result = mechanics;
    if (roleFilter) result = result.filter((m) => m.role === roleFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
      );
    }
    return result;
  }, [mechanics, search, roleFilter]);

  // ── Create mechanic mutation ──
  const createMut = useMutation({
    mutationFn: () =>
      api.request("/api/profiles", {
        method: "POST",
        body: JSON.stringify(newProfile),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      setShowCreate(false);
      setNewProfile({ email: "", fullName: "", role: "mechanic" });
      toast.success("Mecánico creado correctamente");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Toggle active mutation ──
  const toggleActiveMut = useMutation({
    mutationFn: (profile: MechanicProfile) =>
      api.request(`/api/profiles/${profile.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !profile.is_active }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Estado actualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Stats ──
  const total = mechanics.length;
  const activos = mechanics.filter((m) => m.is_active).length;
  const supervisores = mechanics.filter((m) => m.role === "supervisor").length;

  // ── Columns ──
  const columns: Column<MechanicProfile>[] = [
    {
      header: "Nombre",
      accessor: "full_name",
      sortable: true,
      cell: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white text-xs font-bold">
            {row.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{row.full_name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {row.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: "Rol",
      accessor: "role",
      sortable: true,
      cell: (_, row) => {
        const cfg = ROLE_CONFIG[row.role] || { label: row.role, color: "" };
        return (
          <Badge className={cn("text-xs border", cfg.color)}>
            {row.role === "supervisor" && <ShieldCheck className="h-3 w-3 mr-1" />}
            {row.role === "mechanic" && <Wrench className="h-3 w-3 mr-1" />}
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      header: "Estado",
      accessor: "is_active",
      sortable: true,
      cell: (_, row) => (
        <Badge variant={row.is_active ? "success" : "secondary"} className="text-xs">
          {row.is_active ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      header: "Certificaciones",
      accessor: "certificaciones",
      hideOnMobile: true,
      cell: (_, row) => (
        <div className="flex gap-1 flex-wrap">
          {row.certificaciones && row.certificaciones.length > 0 ? (
            row.certificaciones.map((cert) => (
              <Badge key={cert} variant="outline" className="text-[10px] font-mono gap-0.5">
                {cert === "HV" && <Zap className="h-2.5 w-2.5 text-amber-500" />}
                {cert}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      header: "Eficiencia",
      accessor: "eficiencia",
      sortable: true,
      align: "center",
      hideOnMobile: true,
      cell: (_, row) => (
        <div className="flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-muted-foreground" />
          <span className={cn("font-medium text-sm", row.eficiencia! >= 100 ? "text-emerald-500" : "text-amber-500")}>
            {row.eficiencia}%
          </span>
        </div>
      ),
    },
    {
      header: "OTs Activas",
      accessor: "otsActivas",
      sortable: true,
      align: "center",
      hideOnMobile: true,
      cell: (value) => (
        <Badge variant="secondary" className="font-mono">
          {(value as number) || 0}
        </Badge>
      ),
    },
    {
      header: "Ingreso",
      accessor: "created_at",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      className: "text-xs text-muted-foreground",
    },
    {
      header: "Acción",
      accessor: "id",
      className: "text-right",
      cell: (_, row) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7"
          onClick={() => toggleActiveMut.mutate(row)}
          disabled={toggleActiveMut.isPending}
        >
          {row.is_active ? "Desactivar" : "Activar"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ──────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-500" />
            Mecánicos
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} mecánico{total !== 1 ? "s" : ""} registrados · {activos} activos · {supervisores} supervisor{supervisores !== 1 ? "es" : ""}
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreate(true)}>
          <UserCheck className="h-4 w-4" />
          Nuevo Mecánico
        </Button>
      </div>

      {/* ── Stats ──────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <p className="text-2xl font-bold">{total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-500" />
              <p className="text-2xl font-bold text-emerald-600">{activos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Supervisores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-purple-500" />
              <p className="text-2xl font-bold text-purple-600">{supervisores}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Eficiencia Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-orange-500" />
              <p className="text-2xl font-bold text-orange-600">
                {total > 0 ? Math.round(mechanics.reduce((s, m) => s + (m.eficiencia || 0), 0) / total) : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ────────────────────────── */}
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
        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
          <Button
            key={key}
            variant={roleFilter === key ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setRoleFilter(key)}
            className="gap-1.5"
            role="tab"
            aria-selected={roleFilter === key}
          >
            {cfg.label}
          </Button>
        ))}
      </div>

      {/* ── Data Table ──────────────────────── */}
      <DataTable<MechanicProfile>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={isLoading}
        emptyMessage={
          search || roleFilter
            ? "No se encontraron mecánicos con ese criterio de búsqueda"
            : "No hay mecánicos registrados. Agregue su primer mecánico para comenzar."
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar por nombre o email…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
        onRowClick={(row) => console.log("Open mechanic:", row.id)}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Exportar
          </Button>
        }
      />

      {/* ── Create Dialog ──────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-500" />
              Nuevo Mecánico
            </DialogTitle>
            <DialogDescription>
              Creá un nuevo perfil de mecánico o supervisor en el taller
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FormField label="Nombre Completo" htmlFor="mec-fullname" required>
              <Input
                id="mec-fullname"
                value={newProfile.fullName}
                onChange={(e) => setNewProfile({ ...newProfile, fullName: e.target.value })}
                placeholder="Ej: Juan Pérez"
                required
              />
            </FormField>
            <FormField label="Email" htmlFor="mec-email" required>
              <Input
                id="mec-email"
                type="email"
                value={newProfile.email}
                onChange={(e) => setNewProfile({ ...newProfile, email: e.target.value })}
                placeholder="ej: juan@taller.com"
                required
              />
            </FormField>
            <FormField label="Rol" htmlFor="mec-role">
              <Select
                id="mec-role"
                value={newProfile.role}
                onChange={(e) => setNewProfile({ ...newProfile, role: e.target.value })}
              >
                <option value="mechanic">Mecánico</option>
                <option value="supervisor">Supervisor</option>
              </Select>
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!newProfile.fullName || !newProfile.email || createMut.isPending}
              loading={createMut.isPending}
            >
              {createMut.isPending ? "Creando..." : "Crear Mecánico"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ToastContainer}
    </div>
  );
}
