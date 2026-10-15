"use client";

/**
 * Panel de Control — vista según el rol del perfil autenticado (FB-2 · ADM-04).
 *
 * Antes esta ruta redirigía siempre a `/dashboard/ejecutivo`, así que gerente,
 * mecánico y vendedor veían el mismo tablero financiero. Ahora consume
 * `GET /config/dashboard/role` (el backend resuelve la vista desde
 * `request.profile.role`) y renderiza el panel que corresponde:
 *
 *  - admin    → consolidado multi-sucursal + eficiencia promedio + detalle
 *  - manager  → KPIs de su sucursal (o consolidado si no se acota)
 *  - mechanic → sus OTs activas + carga del taller
 *  - user     → stats base del taller
 *
 * `GET /config/dashboard/consolidated` se consume en la vista admin para el
 * agregado de eficiencia promedio (dato que `/role` no expone).
 *
 * @module app/(dashboard)/dashboard
 */

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarCheck,
  ClipboardList,
  DollarSign,
  Gauge,
  UserCog,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/session-provider";
import { useConsolidatedDashboard, useRoleDashboard } from "@/hooks/use-data";
import { useErrorToast } from "@/hooks/use-error-toast";
import type { BranchKpi, RoleDashboard } from "@/lib/api";
import { cn } from "@/lib/utils";

/* ── Helpers ─────────────────────────────────── */

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  mechanic: "Mecánico",
  user: "Usuario",
};

const VIEW_SUBTITLE: Record<RoleDashboard["view"], string> = {
  admin: "Vista consolidada de todas las sucursales.",
  manager: "KPIs de tu sucursal y del equipo.",
  mechanic: "Tus órdenes activas y la carga del taller.",
  user: "Resumen operativo del taller.",
};

function formatGuanira(n: number): string {
  if (n >= 1_000_000_000) return `₲ ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₲ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₲ ${(n / 1_000).toFixed(0)}K`;
  return `₲ ${n.toLocaleString("es-PY")}`;
}

function firstName(fullName?: string): string {
  return fullName?.trim().split(/\s+/)[0] ?? "";
}

/* ── Presentational pieces ───────────────────── */

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone?: "primary" | "emerald" | "amber" | "violet";
  hint?: string;
}

const TONE: Record<NonNullable<StatCardProps["tone"]>, { text: string; bg: string }> = {
  primary: { text: "text-blue-500", bg: "bg-blue-500/10" },
  emerald: { text: "text-emerald-500", bg: "bg-emerald-500/10" },
  amber: { text: "text-amber-500", bg: "bg-amber-500/10" },
  violet: { text: "text-violet-500", bg: "bg-violet-500/10" },
};

function StatCard({ label, value, icon: Icon, tone = "primary", hint }: StatCardProps) {
  const { text, bg } = TONE[tone];
  return (
    <Card data-testid="stat-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", bg)}>
          <Icon className={cn("h-4 w-4", text)} aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function BranchTable({ branches }: { branches: BranchKpi[] }) {
  if (branches.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No hay sucursales activas para mostrar.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="branch-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Sucursal</th>
            <th className="py-2 pr-4 text-right font-medium">OTs activas</th>
            <th className="py-2 pr-4 text-right font-medium">Completadas (mes)</th>
            <th className="py-2 pr-4 text-right font-medium">Ingreso (mes)</th>
            <th className="py-2 text-right font-medium">Stock bajo</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((b) => (
            <tr key={b.sucursalId} className="border-b last:border-0">
              <td className="py-2 pr-4 font-medium">{b.sucursalNombre}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{b.otActivas}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{b.otCompletadasMes}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{formatGuanira(b.ingresoMes)}</td>
              <td className="py-2 text-right tabular-nums">
                {b.stockBajo > 0 ? (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    {b.stockBajo}
                  </span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BranchCard({ branch }: { branch: BranchKpi }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="OTs activas" value={branch.otActivas} icon={Wrench} tone="primary" />
      <StatCard
        label="Completadas (mes)"
        value={branch.otCompletadasMes}
        icon={CalendarCheck}
        tone="emerald"
      />
      <StatCard
        label="Ingreso (mes)"
        value={formatGuanira(branch.ingresoMes)}
        icon={DollarSign}
        tone="violet"
        hint={branch.sucursalNombre}
      />
      <StatCard
        label="Stock bajo"
        value={branch.stockBajo}
        icon={AlertTriangle}
        tone="amber"
      />
    </div>
  );
}

function ViewBadge({ view }: { view: RoleDashboard["view"] }) {
  return (
    <Badge variant="secondary" data-testid="role-view-badge">
      {ROLE_LABEL[view] ?? view}
    </Badge>
  );
}

/* ── Admin view ──────────────────────────────── */

function AdminView({ data }: { data: RoleDashboard }) {
  const { data: consolidated } = useConsolidatedDashboard(true);
  const branches = data.branches ?? [];
  const eficiencia = consolidated?.eficienciaPromedio ?? null;

  return (
    <div className="space-y-6" data-testid="view-admin">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="OTs activas" value={data.otActivas} icon={Wrench} tone="primary" />
        <StatCard
          label="Completadas (mes)"
          value={data.totalOTCompletadasMes ?? 0}
          icon={CalendarCheck}
          tone="emerald"
        />
        <StatCard
          label="Ingreso (mes)"
          value={formatGuanira(data.totalIngresoMes ?? 0)}
          icon={DollarSign}
          tone="violet"
        />
        <StatCard
          label="Sucursales activas"
          value={data.totalSucursales ?? branches.length}
          icon={Building2}
          tone="amber"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Eficiencia promedio</CardTitle>
          <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">
            {eficiencia === null ? "—" : `${eficiencia}%`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Promedio de eficiencia de mecánicos entre sucursales.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle por sucursal</CardTitle>
        </CardHeader>
        <CardContent>
          <BranchTable branches={branches} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Manager view ────────────────────────────── */

function ManagerView({ data }: { data: RoleDashboard }) {
  if (data.branch) {
    return (
      <div className="space-y-6" data-testid="view-manager">
        <BranchCard branch={data.branch} />
      </div>
    );
  }

  const branches = data.branches ?? [];
  return (
    <div className="space-y-6" data-testid="view-manager">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total OTs" value={data.totalOTs} icon={ClipboardList} tone="primary" />
        <StatCard label="OTs activas" value={data.otActivas} icon={Wrench} tone="emerald" />
        <StatCard
          label="Ingreso (mes)"
          value={formatGuanira(data.totalIngresoMes ?? 0)}
          icon={DollarSign}
          tone="violet"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sucursales</CardTitle>
        </CardHeader>
        <CardContent>
          <BranchTable branches={branches} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Mechanic view ───────────────────────────── */

function MechanicView({ data }: { data: RoleDashboard }) {
  return (
    <div className="space-y-6" data-testid="view-mechanic">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Mis OTs activas"
          value={data.myActiveOTs ?? 0}
          icon={UserCog}
          tone="primary"
          hint="Asignadas a ti"
        />
        <StatCard label="OTs activas del taller" value={data.otActivas} icon={Wrench} tone="emerald" />
        <StatCard label="Total OTs" value={data.totalOTs} icon={ClipboardList} tone="violet" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard/hub">
            <Activity className="mr-2 h-4 w-4" aria-hidden="true" />
            Ir al Hub de Operaciones
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/taller/asignacion">Ver asignación de OT</Link>
        </Button>
      </div>
    </div>
  );
}

/* ── User view ───────────────────────────────── */

function UserView({ data }: { data: RoleDashboard }) {
  return (
    <div className="space-y-6" data-testid="view-user">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Total OTs" value={data.totalOTs} icon={ClipboardList} tone="primary" />
        <StatCard label="OTs activas" value={data.otActivas} icon={Wrench} tone="emerald" />
      </div>

      <Button asChild>
        <Link href="/dashboard/hub">
          <Activity className="mr-2 h-4 w-4" aria-hidden="true" />
          Ir al Hub de Operaciones
        </Link>
      </Button>
    </div>
  );
}

/* ── Page ────────────────────────────────────── */

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useRoleDashboard();
  useErrorToast(isError, "el panel de control");

  // Mientras carga no hay `view`; usamos el rol local sólo para el encabezado.
  const role = data?.view ?? user?.role ?? "user";
  const subtitle = VIEW_SUBTITLE[data?.view ?? "user"];

  return (
    <div className="space-y-6" data-testid="role-panel">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hola{user?.fullName ? `, ${firstName(user.fullName)}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <ViewBadge view={role as RoleDashboard["view"]} />
      </header>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Cargando panel">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <ErrorState
          title="No se pudo cargar el panel"
          message={error?.message}
          onRetry={() => refetch()}
        />
      ) : data ? (
        <>
          {data.view === "admin" && <AdminView data={data} />}
          {data.view === "manager" && <ManagerView data={data} />}
          {data.view === "mechanic" && <MechanicView data={data} />}
          {data.view === "user" && <UserView data={data} />}
        </>
      ) : null}
    </div>
  );
}
