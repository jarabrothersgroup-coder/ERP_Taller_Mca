"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Layers,
  TrendingUp,
  Clock,
  Box,
  ShoppingCart,
  Receipt,
  Wallet,
  Users,
  Settings,
  Wrench,
  FileSpreadsheet,
  Warehouse,
  CreditCard,
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
import { SkeletonCard } from "@/components/ui/skeleton";
import { api, type IntegracionDashboard, type IntegracionDashboardModulo } from "@/lib/api";

/* ── Constants ──────────────────────────────── */

const MODULE_ICONS: Record<string, React.ElementType> = {
  COMPRAS: ShoppingCart,
  SIFEN: Receipt,
  TESORERIA: Wallet,
  NOMINA: Users,
  INVENTARIO: Box,
  WORKSHOP: Wrench,
};

const MODULE_COLORS: Record<string, string> = {
  COMPRAS: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  SIFEN: "bg-green-500/10 text-green-500 border-green-500/20",
  TESORERIA: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  NOMINA: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  INVENTARIO: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  WORKSHOP: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

const MODULE_NAMES: Record<string, string> = {
  COMPRAS: "Compras",
  SIFEN: "Facturación Electrónica",
  TESORERIA: "Tesorería",
  NOMINA: "Nómina",
  INVENTARIO: "Inventario",
  WORKSHOP: "Taller",
};

/* ── Stats Overview ─────────────────────────── */

function StatCards({ data }: { data: IntegracionDashboard }) {
  const stats = [
    {
      title: "Módulos Registrados",
      value: String(data.modulosRegistrados ?? 0),
      subtitle: "Configuradores activos",
      icon: Settings,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Mappings Definidos",
      value: String(data.totalMappings ?? 0),
      subtitle: "Reglas contables automáticas",
      icon: Layers,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Asientos Automáticos",
      value: String(data.totalAsientosAutomaticos ?? 0),
      subtitle: "Generados sin intervención",
      icon: TrendingUp,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      title: "Eventos de Auditoría",
      value: String(Array.isArray(data.auditReciente) ? data.auditReciente.length : 0),
      subtitle: "Registros recientes",
      icon: Activity,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => (
        <Card
          key={stat.title}
          className="animate-fade-in-up transition-all duration-300 hover:shadow-md"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`rounded-lg p-2 ${stat.bg}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Module Cards Grid ──────────────────────── */

function ModuleCard({
  mod,
  asientosCount,
}: {
  mod: IntegracionDashboardModulo;
  asientosCount: number;
}) {
  const Icon = MODULE_ICONS[mod.codigo] || Settings;
  const colorClass = MODULE_COLORS[mod.codigo] || "bg-gray-500/10 text-gray-500 border-gray-500/20";
  const moduleName = MODULE_NAMES[mod.codigo] || mod.nombre || mod.codigo;

  return (
    <Card className="animate-fade-in-up transition-all duration-200 hover:shadow-md hover:border-foreground/20 group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2.5 border ${colorClass} transition-transform group-hover:scale-110`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{moduleName}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                v{mod.version || "1.0.0"}
              </CardDescription>
            </div>
          </div>
          {mod.activo !== false ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Activo
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <XCircle className="h-3 w-3" aria-hidden="true" />
              Inactivo
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mappings
            </p>
            <p className="text-lg font-bold mt-0.5">{mod.mappings ?? 0}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Asientos
            </p>
            <p className="text-lg font-bold mt-0.5">{asientosCount}</p>
          </div>
        </div>
        {mod.mappings === 0 && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-amber-500 bg-amber-500/10 rounded-md px-2.5 py-1.5">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Sin mappings configurados — ejecute seed</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Mappings Table ─────────────────────────── */

interface MappingRow {
  modulo: string;
  cantidad: number;
  configurado: boolean;
}

const mappingColumns: Column<MappingRow>[] = [
  {
    header: "Módulo",
    accessor: "modulo",
    sortable: true,
    cell: (_, row) => (
      <div className="flex items-center gap-2">
        {(() => {
          const Icon = MODULE_ICONS[row.modulo] || Settings;
          return <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
        })()}
        <span className="font-medium">{MODULE_NAMES[row.modulo] || row.modulo}</span>
      </div>
    ),
  },
  {
    header: "Cantidad",
    accessor: "cantidad",
    sortable: true,
    align: "right",
    cell: (_, row) => (
      <span className="tabular-nums font-mono font-medium">{row.cantidad}</span>
    ),
  },
  {
    header: "Estado",
    accessor: "configurado",
    align: "center",
    cell: (_, row) =>
      row.configurado ? (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Configurado
        </Badge>
      ) : (
        <Badge variant="warning" className="gap-1">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          Pendiente
        </Badge>
      ),
  },
];

/* ── Asientos Table ─────────────────────────── */

interface AsientoRow {
  modulo: string;
  cantidad: number;
}

const asientoColumns: Column<AsientoRow>[] = [
  {
    header: "Módulo Origen",
    accessor: "modulo",
    sortable: true,
    cell: (_, row) => (
      <div className="flex items-center gap-2">
        {(() => {
          const Icon = MODULE_ICONS[row.modulo] || Settings;
          return <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
        })()}
        <span>{MODULE_NAMES[row.modulo] || row.modulo}</span>
      </div>
    ),
  },
  {
    header: "Asientos Generados",
    accessor: "cantidad",
    sortable: true,
    align: "right",
    cell: (_, row) => (
      <span className="tabular-nums font-mono font-bold text-lg">
        {String(row.cantidad).padStart(2, "0")}
      </span>
    ),
  },
];

/* ── Audit Table ────────────────────────────── */

interface AuditRow {
  fecha: string;
  accion: string;
  entidad: string;
  usuario: string;
}

const auditColumns: Column<AuditRow>[] = [
  {
    header: "Fecha",
    accessor: "fecha",
    sortable: true,
    cell: (_, row) => (
      <span className="text-xs tabular-nums">{row.fecha || "—"}</span>
    ),
  },
  {
    header: "Acción",
    accessor: "accion",
    sortable: true,
    cell: (_, row) => (
      <span className="font-medium text-xs">{row.accion || "—"}</span>
    ),
  },
  {
    header: "Entidad",
    accessor: "entidad",
    cell: (_, row) => (
      <span className="text-xs text-muted-foreground">{row.entidad || "—"}</span>
    ),
  },
  {
    header: "Usuario",
    accessor: "usuario",
    cell: (_, row) => (
      <span className="text-xs text-muted-foreground">{row.usuario || "—"}</span>
    ),
  },
];

/* ── Loading State ──────────────────────────── */

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Cargando dashboard de integración">
      <div>
        <div className="h-8 w-72 skeleton-pulse rounded-md" />
        <div className="mt-2 h-4 w-56 skeleton-pulse rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function IntegracionPage() {
  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<IntegracionDashboard, Error>({
    queryKey: ["integracion-dashboard"],
    queryFn: () => api.getIntegracionDashboard(),
    refetchInterval: 30_000, // Auto-refresh every 30s
  });

  const mappingsData = React.useMemo<MappingRow[]>(() => {
    if (!dashboardData?.mappingsPorModulo) return [];
    return Object.entries(dashboardData.mappingsPorModulo).map(([mod, count]) => ({
      modulo: mod,
      cantidad: count,
      configurado: count > 0,
    }));
  }, [dashboardData]);

  const asientosData = React.useMemo<AsientoRow[]>(() => {
    if (!dashboardData?.asientosPorModulo) return [];
    return Object.entries(dashboardData.asientosPorModulo).map(([mod, count]) => ({
      modulo: mod,
      cantidad: count,
    }));
  }, [dashboardData]);

  const auditData = React.useMemo<AuditRow[]>(() => {
    if (!Array.isArray(dashboardData?.auditReciente)) return [];
    return dashboardData.auditReciente.slice(0, 10).map((a) => ({
      fecha: a.createdAt
        ? new Date(a.createdAt).toLocaleDateString("es-PY")
        : "—",
      accion: a.accion || a.action || "",
      entidad: a.entidad || a.entity || "",
      usuario: a.usuario || a.user || a.usuarioEmail || "",
    }));
  }, [dashboardData]);

  const asientosPorModulo = dashboardData?.asientosPorModulo ?? {};

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Integración Contable</h1>
            <p className="text-sm text-muted-foreground">
              Estado de los configuradores automáticos
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Reintentar
          </Button>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <XCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
            <div className="text-center">
              <p className="text-lg font-semibold">Error al cargar integración</p>
              <p className="text-sm text-muted-foreground mt-1">
                {error?.message || "No se pudo conectar con el servidor de contabilidad"}
              </p>
            </div>
            <Button onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dashboardData) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integración Contable</h1>
          <p className="text-sm text-muted-foreground">
            Monitoreo de configuradores automáticos y reglas de asignación contable
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="gap-1.5"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {isRefetching ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>

      {/* Status Banner */}
      {dashboardData.totalMappings === 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" aria-hidden="true" />
            <p className="text-sm text-amber-600 dark:text-amber-400">
              No hay mappings contables configurados. Ejecute el seed de contabilidad o el auto-configure para establecer las reglas por defecto.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Balance Check */}
      {dashboardData.totalAsientosAutomaticos > 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex items-center gap-3 py-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" aria-hidden="true" />
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              El motor contable ha generado <strong>{dashboardData.totalAsientosAutomaticos}</strong> asientos automáticos a través de{" "}
              <strong>{dashboardData.modulosRegistrados}</strong> configuradores modulares.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <StatCards data={dashboardData} />

      {/* Module Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Configuradores por Módulo</h2>
          <Badge variant="outline" className="text-xs">
            {dashboardData.modulosRegistrados ?? 0} módulos
          </Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(dashboardData.modulos ?? []).map((mod, i) => (
            <div key={mod.codigo} style={{ animationDelay: `${i * 80}ms` }}>
              <ModuleCard mod={mod} asientosCount={asientosPorModulo[mod.codigo] ?? 0} />
            </div>
          ))}
        </div>
      </div>

      {/* Mappings Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" aria-hidden="true" />
                Mappings por Módulo
              </CardTitle>
              <CardDescription>
                Reglas de asignación Debe/Haber configuradas por módulo
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable<MappingRow>
            columns={mappingColumns}
            data={mappingsData}
            rowKey="modulo"
            emptyMessage="No hay mappings configurados"
            paginate={false}
            sortable
          />
        </CardContent>
      </Card>

      {/* Asientos Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                Asientos Generados por Módulo
              </CardTitle>
              <CardDescription>
                Total de asientos contables creados automáticamente por cada módulo
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable<AsientoRow>
            columns={asientoColumns}
            data={asientosData}
            rowKey="modulo"
            emptyMessage="No se han generado asientos automáticos aún"
            paginate={false}
            sortable
          />
        </CardContent>
      </Card>

      {/* Audit Trail */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" aria-hidden="true" />
                Auditoría Reciente
              </CardTitle>
              <CardDescription>
                Últimas acciones registradas en el sistema contable (inmutabilidad)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Hash chain inmutabilidad: cada asiento está vinculado criptográficamente al anterior</span>
          </div>
          <DataTable<AuditRow>
            columns={auditColumns}
            data={auditData}
            rowKey="fecha"
            emptyMessage="No hay eventos de auditoría recientes"
            paginate={false}
            sortable
          />
        </CardContent>
      </Card>

      {/* ── Sprint 84-85: Nuevas Features ──────────── */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight mb-2">Nuevas Features — Sprint 84-85</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Módulos implementados recientemente con integración contable automática
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Nota de Crédito SIFEN */}
          <Card className="transition-all duration-200 hover:shadow-md hover:border-green-500/30 group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg p-2.5 border bg-red-500/10 text-red-500 border-red-500/20 transition-transform group-hover:scale-110">
                    <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Nota de Crédito SIFEN</CardTitle>
                    <CardDescription className="text-xs mt-0.5">P0-1</CardDescription>
                  </div>
                </div>
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Completo
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                NC electrónica con validación DTE original, firma digital X.509, envío DNIT y
                asiento contable de reversión automático.
              </p>
            </CardContent>
          </Card>

          {/* Multi-almacén */}
          <Card className="transition-all duration-200 hover:shadow-md hover:border-blue-500/30 group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg p-2.5 border bg-cyan-500/10 text-cyan-500 border-cyan-500/20 transition-transform group-hover:scale-110">
                    <Warehouse className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Multi-almacén</CardTitle>
                    <CardDescription className="text-xs mt-0.5">P0-3</CardDescription>
                  </div>
                </div>
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Migration 0010
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Gestión multi-almacén con transferencias atómicas, tabla
                transferencias_almacen, índices compuestos y trigger contable.
              </p>
            </CardContent>
          </Card>

          {/* Pagos Online */}
          <Card className="transition-all duration-200 hover:shadow-md hover:border-purple-500/30 group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg p-2.5 border bg-purple-500/10 text-purple-500 border-purple-500/20 transition-transform group-hover:scale-110">
                    <CreditCard className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Pagos Online</CardTitle>
                    <CardDescription className="text-xs mt-0.5">P1-5</CardDescription>
                  </div>
                </div>
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Stripe + PagosPy
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Payment links Stripe + PagosPy con webhook público (sin auth) y
                registro automático de pagos en tesorería.
              </p>
            </CardContent>
          </Card>

          {/* Asignación Inteligente */}
          <Card className="transition-all duration-200 hover:shadow-md hover:border-orange-500/30 group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg p-2.5 border bg-orange-500/10 text-orange-500 border-orange-500/20 transition-transform group-hover:scale-110">
                    <UserCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Asignación Mecánicos</CardTitle>
                    <CardDescription className="text-xs mt-0.5">P1-4</CardDescription>
                  </div>
                </div>
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Scoring
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Algoritmo de asignación por carga laboral, certificaciones HV y eficiencia
                histórica con endpoint REST.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
