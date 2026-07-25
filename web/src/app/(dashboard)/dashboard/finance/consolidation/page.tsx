"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  Users,
  BarChart3,
  DollarSign,
  TrendingUp,
  Activity,
  Trash2,
  UserPlus,
  UserMinus,
  RefreshCw,
  Landmark,
  PiggyBank,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────── */

interface TenantGroup {
  id: string;
  name: string;
  description?: string;
  ownerTenantSlug: string;
  isActive: boolean;
  memberCount: number;
}

interface TenantGroupMember {
  id: string;
  groupId: string;
  tenantSlug: string;
  roleInGroup: string;
  tenantName?: string;
  joinedAt: string;
  isActive: boolean;
}

interface ConsolidatedBalance {
  groupId: string;
  groupName: string;
  periodo: { anho: number; mes: number };
  totalActivo: number;
  totalPasivo: number;
  totalPatrimonio: number;
  diferencia: number;
  balanceado: boolean;
  tenants: Array<{
    tenantSlug: string;
    tenantName: string;
    totalActivo: number;
    totalPasivo: number;
    totalPatrimonio: number;
  }>;
}

interface ConsolidatedPnL {
  groupId: string;
  groupName: string;
  periodo: { anho: number; mes: number };
  totalIngresos: number;
  totalCostos: number;
  totalGastos: number;
  utilidadBruta: number;
  utilidadNeta: number;
  tenants: Array<{
    tenantSlug: string;
    tenantName: string;
    totalIngresos: number;
    totalCostos: number;
    totalGastos: number;
    utilidadNeta: number;
  }>;
}

/* ─── Helpers ──────────────────────────────────── */

function formatGuarani(amount: number): string {
  if (amount >= 1_000_000_000) return `₲ ${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `₲ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₲ ${(amount / 1_000).toFixed(0)}K`;
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

function getCurrentPeriod() {
  const now = new Date();
  return { anho: now.getFullYear(), mes: now.getMonth() + 1 };
}

/* ─── Main Page ───────────────────────────────── */

export default function ConsolidationPage() {
  const qc = useQueryClient();
  const { toast, ToastContainer } = useToast();
  const [selectedGroup, setSelectedGroup] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [showAddMember, setShowAddMember] = React.useState(false);
  const [showReports, setShowReports] = React.useState(false);
  const [reportType, setReportType] = React.useState<"balance" | "pnl">("balance");
  const [period, setPeriod] = React.useState(getCurrentPeriod);

  // Form states
  const [groupName, setGroupName] = React.useState("");
  const [groupDesc, setGroupDesc] = React.useState("");
  const [memberSlug, setMemberSlug] = React.useState("");
  const [memberRole, setMemberRole] = React.useState("MEMBER");

  // ─── Queries ─────────────────────────────────

  const { data: groups = [], isLoading } = useQuery<TenantGroup[]>({
    queryKey: ["tenant-groups"],
    queryFn: () => api.request<TenantGroup[]>("/finance/contabilidad/grupos"),
  });

  const { data: members = [], isLoading: loadingMembers } = useQuery<TenantGroupMember[]>({
    queryKey: ["tenant-group-members", selectedGroup],
    queryFn: () => api.request<TenantGroupMember[]>(`/finance/contabilidad/grupos/${selectedGroup}/miembros`),
    enabled: !!selectedGroup,
  });

  const { data: balance, isLoading: loadingBalance } = useQuery<ConsolidatedBalance>({
    queryKey: ["consolidated-balance", selectedGroup, period.anho, period.mes],
    queryFn: () =>
      api.request<ConsolidatedBalance>(
        `/finance/contabilidad/consolidado/balance/${selectedGroup}/${period.anho}/${period.mes}`,
      ),
    enabled: !!selectedGroup && showReports && reportType === "balance",
  });

  const { data: pnl, isLoading: loadingPnl } = useQuery<ConsolidatedPnL>({
    queryKey: ["consolidated-pnl", selectedGroup, period.anho, period.mes],
    queryFn: () =>
      api.request<ConsolidatedPnL>(
        `/finance/contabilidad/consolidado/pnl/${selectedGroup}/${period.anho}/${period.mes}`,
      ),
    enabled: !!selectedGroup && showReports && reportType === "pnl",
  });

  // ─── Mutations ───────────────────────────────

  const createGroup = useMutation({
    mutationFn: () =>
      api.request<TenantGroup>("/finance/contabilidad/grupos", {
        method: "POST",
        body: JSON.stringify({ name: groupName, description: groupDesc || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-groups"] });
      setShowCreate(false);
      setGroupName("");
      setGroupDesc("");
      toast.success("Grupo creado correctamente");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addMember = useMutation({
    mutationFn: () =>
      api.request(`/finance/contabilidad/grupos/${selectedGroup}/miembros`, {
        method: "POST",
        body: JSON.stringify({ tenantSlug: memberSlug, roleInGroup: memberRole }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-group-members", selectedGroup] });
      setShowAddMember(false);
      setMemberSlug("");
      toast.success("Miembro agregado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: (tenantSlug: string) =>
      api.request(`/finance/contabilidad/grupos/${selectedGroup}/miembros/${tenantSlug}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-group-members", selectedGroup] });
      toast.success("Miembro removido");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateGroup = useMutation({
    mutationFn: () =>
      api.request(`/finance/contabilidad/grupos/${selectedGroup}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-groups"] });
      setSelectedGroup(null);
      setShowReports(false);
      toast.success("Grupo desactivado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── Loading ─────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const selectedGroupData = groups.find((g) => g.id === selectedGroup);

  // ─── Detail View ─────────────────────────────

  if (selectedGroup && selectedGroupData) {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedGroup(null); setShowReports(false); }} className="mb-2">
              ← Volver a Grupos
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{selectedGroupData.name}</h1>
              <Badge variant={selectedGroupData.isActive ? "default" : "secondary"}>
                {selectedGroupData.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            {selectedGroupData.description && (
              <p className="text-sm text-muted-foreground mt-1">{selectedGroupData.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddMember(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Agregar Miembro
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowReports(!showReports); setReportType("balance"); }} className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> Reportes Consolidados
            </Button>
            <Button variant="destructive" size="sm" onClick={() => { if (confirm("¿Desactivar este grupo?")) deactivateGroup.mutate(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Members + Reports grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Members */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Miembros ({members.length})
              </CardTitle>
              <CardDescription>Talleres que forman parte del grupo</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMembers ? (
                <Skeleton className="h-32" />
              ) : members.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No hay miembros aún. Agregá talleres al grupo.
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border p-3 text-sm group hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{m.tenantName || m.tenantSlug}</p>
                          <Badge variant="outline" className="text-[10px]">{m.roleInGroup}</Badge>
                        </div>
                      </div>
                      {m.roleInGroup !== "OWNER" && (
                        <button
                          onClick={() => { if (confirm("¿Remover este miembro?")) removeMember.mutate(m.tenantSlug); }}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Consolidated Reports */}
          {showReports && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-emerald-500" />
                  Reportes Consolidados
                </CardTitle>
                <CardDescription>Estados financieros sumando todos los talleres del grupo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Period + Type selector */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 bg-muted rounded-lg p-1">
                    <button
                      onClick={() => setReportType("balance")}
                      className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", reportType === "balance" ? "bg-background shadow-sm" : "hover:text-foreground text-muted-foreground")}
                    >
                      Balance General
                    </button>
                    <button
                      onClick={() => setReportType("pnl")}
                      className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", reportType === "pnl" ? "bg-background shadow-sm" : "hover:text-foreground text-muted-foreground")}
                    >
                      Estado de Resultados
                    </button>
                  </div>
                  <Input type="number" className="w-20 h-8 text-xs" min={2020} max={2100} value={period.anho} onChange={(e) => setPeriod({ ...period, anho: parseInt(e.target.value) || 2026 })} />
                  <span className="text-xs text-muted-foreground">/</span>
                  <Input type="number" className="w-16 h-8 text-xs" min={1} max={12} value={period.mes} onChange={(e) => setPeriod({ ...period, mes: parseInt(e.target.value) || 1 })} />
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => { qc.invalidateQueries({ queryKey: ["consolidated-balance"] }); qc.invalidateQueries({ queryKey: ["consolidated-pnl"] }); }}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Balance */}
                {reportType === "balance" && (
                  loadingBalance ? <Skeleton className="h-48" /> : balance ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Activo</CardTitle></CardHeader>
                          <CardContent><p className="text-xl font-bold text-emerald-500">{formatGuarani(balance.totalActivo)}</p></CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Pasivo</CardTitle></CardHeader>
                          <CardContent><p className="text-xl font-bold text-red-500">{formatGuarani(balance.totalPasivo)}</p></CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Patrimonio Neto</CardTitle></CardHeader>
                          <CardContent><p className="text-xl font-bold text-blue-500">{formatGuarani(balance.totalPatrimonio)}</p></CardContent>
                        </Card>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Balance:</span>
                        <Badge variant={balance.balanceado ? "success" : "destructive"}>
                          {balance.balanceado ? "✅ Cuadrado" : `⚠️ Diferencia: ${formatGuarani(balance.diferencia)}`}
                        </Badge>
                      </div>
                      {/* Per-tenant breakdown */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Desglose por taller:</p>
                        {balance.tenants.map((t) => (
                          <div key={t.tenantSlug} className="flex items-center justify-between rounded border p-2 text-xs">
                            <span className="font-medium">{t.tenantName}</span>
                            <div className="flex gap-4">
                              <span>Activo: {formatGuarani(t.totalActivo)}</span>
                              <span>Pasivo: {formatGuarani(t.totalPasivo)}</span>
                              <span>Patrimonio: {formatGuarani(t.totalPatrimonio)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center py-6 text-sm text-muted-foreground">Sin datos de balance para este período</p>
                  )
                )}

                {/* P&L */}
                {reportType === "pnl" && (
                  loadingPnl ? <Skeleton className="h-48" /> : pnl ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ingresos</CardTitle></CardHeader>
                          <CardContent><p className="text-xl font-bold text-emerald-500">{formatGuarani(pnl.totalIngresos)}</p></CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Costos</CardTitle></CardHeader>
                          <CardContent><p className="text-xl font-bold text-orange-500">{formatGuarani(pnl.totalCostos)}</p></CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Utilidad Neta</CardTitle></CardHeader>
                          <CardContent><p className={cn("text-xl font-bold", pnl.utilidadNeta >= 0 ? "text-emerald-500" : "text-red-500")}>{formatGuarani(pnl.utilidadNeta)}</p></CardContent>
                        </Card>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="text-muted-foreground">Gastos: <span className="font-medium">{formatGuarani(pnl.totalGastos)}</span></span>
                        <span className="text-muted-foreground">Utilidad Bruta: <span className="font-medium">{formatGuarani(pnl.utilidadBruta)}</span></span>
                      </div>
                      {/* Per-tenant breakdown */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Desglose por taller:</p>
                        {pnl.tenants.map((t) => (
                          <div key={t.tenantSlug} className="flex items-center justify-between rounded border p-2 text-xs">
                            <span className="font-medium">{t.tenantName}</span>
                            <div className="flex gap-4">
                              <span>Ingresos: {formatGuarani(t.totalIngresos)}</span>
                              <span>Costos: {formatGuarani(t.totalCostos)}</span>
                              <span className={t.utilidadNeta >= 0 ? "text-emerald-500" : "text-red-500"}>Neto: {formatGuarani(t.utilidadNeta)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center py-6 text-sm text-muted-foreground">Sin datos de P&L para este período</p>
                  )
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Add Member Dialog ────────────────── */}
        <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Agregar Miembro</DialogTitle>
              <DialogDescription>Agregá un taller al grupo consolidado</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tenant Slug</label>
                <Input value={memberSlug} onChange={(e) => setMemberSlug(e.target.value)} placeholder="Ej: taller-mca" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rol</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="MEMBER">Miembro</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VIEWER">Solo Vista</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddMember(false)}>Cancelar</Button>
              <Button onClick={() => addMember.mutate()} disabled={!memberSlug || addMember.isPending}>
                {addMember.isPending ? "Agregando..." : "Agregar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── List View ───────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-500" />
            Consolidación Multi-Tenant
          </h1>
          <p className="text-sm text-muted-foreground">
            Agrupá talleres para ver estados financieros consolidados
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Nuevo Grupo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Building2 className="h-3 w-3" /> Grupos Activos
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{groups.filter((g) => g.isActive).length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-3 w-3" /> Total Miembros
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{groups.reduce((s, g) => s + g.memberCount, 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <PiggyBank className="h-3 w-3" /> Dueños
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{new Set(groups.map((g) => g.ownerTenantSlug)).size}</p></CardContent>
        </Card>
      </div>

      {/* Groups list */}
      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay grupos de consolidación</p>
            <p className="text-xs text-muted-foreground mt-1">Creá un grupo para comenzar a consolidar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.id} className="hover:border-foreground/20 transition-colors cursor-pointer" onClick={() => setSelectedGroup(g.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{g.name}</CardTitle>
                  <Badge variant={g.isActive ? "default" : "secondary"}>{g.isActive ? "Activo" : "Inactivo"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{g.memberCount} miembros</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                {g.description && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">{g.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create Group Dialog ────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo Grupo</DialogTitle>
            <DialogDescription>Creá un grupo de talleres para consolidación financiera</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre del Grupo</label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ej: Grupo MCA Talleres" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción (opcional)</label>
              <Input value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} placeholder="Ej: Sucursales del grupo MCA" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={() => createGroup.mutate()} disabled={!groupName || createGroup.isPending}>
              {createGroup.isPending ? "Creando..." : "Crear Grupo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ToastContainer}
    </div>
  );
}
