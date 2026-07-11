"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import {
  Wrench,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Car,
  Plus,
  ArrowUpRight,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { fetchWorkOrders, fetchAuditLog, type UIMappedWorkOrder, type UIMappedAuditEntry } from "@/lib/data-service";

/* ── Types ──────────────────────────────────── */

interface Stat {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface Order {
  id: string;
  client: string;
  vehicle: string;
  status: string;
  statusVariant: "warning" | "secondary" | "success" | "destructive";
  technician: string;
  deadline: string;
}

interface AlertItem {
  type: "warning" | "info" | "success";
  message: string;
}

/* ── Mock Data Factory ──────────────────────── */

const clients = ["María González", "Pedro López", "Juan Pérez", "Lucía Fernández", "Carlos Ruiz", "Ana Martínez"];
const vehicles = ["Toyota Corolla 2022", "Hyundai Tucson 2023", "Kia Sportage 2021", "VW Gol 2020", "Chevrolet Onix 2022", "Ford Ranger 2023"];
const statuses: { label: string; variant: "warning" | "secondary" | "success"; key: string }[] = [
  { label: "En Progreso", variant: "warning", key: "in_progress" },
  { label: "Presupuestado", variant: "secondary", key: "budgeted" },
  { label: "Listo", variant: "success", key: "ready" },
  { label: "Control Calidad", variant: "warning", key: "quality" },
];
const deadlines = ["Hoy 17:00", "Mañana", "Retirado", "Hoy 15:00", "Jueves", "Viernes"];

function generateRecentOrders(): Order[] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `OT-${String(100 + i).padStart(3, "0")}`,
    client: clients[i % clients.length],
    vehicle: vehicles[i % vehicles.length],
    status: statuses[i % statuses.length].label,
    statusVariant: statuses[i % statuses.length].variant,
    technician: ["Carlos M.", "Ana R.", "Luis M.", "Carlos M.", "Pedro G.", "Sofía L."][i],
    deadline: deadlines[i % deadlines.length],
  }));
}

const alerts: AlertItem[] = [
  { type: "warning", message: "Stock bajo: Frenos Delanteros (3 unidades)" },
  { type: "info", message: "CxC vencida: Factura #156 — ₲ 2.3M pendiente" },
  { type: "success", message: "Backup automático completado hace 2 horas" },
];

const alertIcons: Record<AlertItem["type"], React.ElementType> = {
  warning: AlertTriangle,
  info: DollarSign,
  success: CheckCircle,
};

const alertColors: Record<AlertItem["type"], string> = {
  warning: "text-amber-500",
  info: "text-blue-500",
  success: "text-emerald-500",
};

/* ── Weekly Chart Data ──────────────────────── */

const weeklyData = [
  { day: "Lun", orders: 4 },
  { day: "Mar", orders: 6 },
  { day: "Mié", orders: 5 },
  { day: "Jue", orders: 8 },
  { day: "Vie", orders: 7 },
  { day: "Sáb", orders: 3 },
  { day: "Hoy", orders: 2 },
];

/* ── Loading Skeleton ───────────────────────── */

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Cargando panel de control">
      <div>
        <Skeleton variant="text" className="h-8 w-64" />
        <Skeleton variant="text" className="mt-2 h-4 w-48" />
      </div>
      <Skeleton variant="rect" className="h-10 w-52" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <Skeleton variant="card" className="h-80" />
        </div>
        <div className="space-y-3">
          <Skeleton variant="card" className="h-80" />
        </div>
      </div>
    </div>
  );
}

/* ── Stats Grid ─────────────────────────────── */

function StatsGrid({ items }: { items: Stat[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="region" aria-label="Indicadores clave">
      {items.map((stat, i) => (
        <Card key={stat.title} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`rounded-lg p-2 ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              {stat.subtitle}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Weekly Chart ───────────────────────────── */

function WeeklyChart({ data }: { data: typeof weeklyData }) {
  const maxOrders = Math.max(...data.map((d) => d.orders));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Órdenes Semanales
            </CardTitle>
            <CardDescription>
              Órdenes de trabajo ingresadas por día
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2 h-32">
          {data.map((item) => (
            <div key={item.day} className="flex flex-col items-center gap-2 flex-1">
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {item.orders}
              </span>
              <div
                className="w-full rounded-md bg-gradient-to-t from-orange-500 to-orange-400 transition-all duration-500 hover:from-orange-600 hover:to-orange-500 min-h-[4px]"
                style={{
                  height: `${Math.max(4, (item.orders / maxOrders) * 100)}%`,
                }}
              />
              <span className="text-[10px] text-muted-foreground font-medium">
                {item.day}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Recent Orders ──────────────────────────── */

function RecentOrdersList({ orders }: { orders: Order[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Órdenes Recientes</CardTitle>
            <CardDescription>
              Últimas órdenes de trabajo del taller
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            Ver todas <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2" role="list" aria-label="Órdenes de trabajo">
          {orders.map((order) => (
            <div
              key={order.id}
              role="listitem"
              className="group flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 hover:border-foreground/20 transition-all duration-150 cursor-pointer active:scale-[0.99]"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") e.preventDefault();
              }}
              aria-label={`${order.id}: ${order.client} — ${order.vehicle}. Estado: ${order.status}`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted group-hover:bg-background transition-colors shrink-0">
                  <Car className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{order.id}</span>
                    <Badge variant={order.statusVariant} className="text-[10px]">
                      {order.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {order.client} — {order.vehicle}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-xs text-muted-foreground">Téc: {order.technician}</p>
                <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {order.deadline}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Alerts Panel ───────────────────────────── */

function AlertsPanel({ items }: { items: AlertItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Alertas
        </CardTitle>
        <CardDescription>Notificaciones pendientes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2" role="list" aria-label="Alertas y notificaciones">
          {items.map((alert, i) => {
            const AlertIcon = alertIcons[alert.type];
            return (
              <Alert
                key={i}
                variant={alert.type === "warning" ? "warning" : alert.type === "info" ? "info" : "success"}
                className="p-3"
              >
                <AlertIcon className="h-4 w-4" aria-hidden="true" />
                <AlertDescription className="pl-7 text-xs">
                  {alert.message}
                </AlertDescription>
              </Alert>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function DashboardPage() {
  const [loading, setLoading] = React.useState(true);

  const today = React.useMemo(
    () => new Date().toLocaleDateString("es-PY", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    []
  );

  // Fetch real data from API with mock fallback
  const [stats, setStats] = React.useState<Stat[]>([
    { title: "Órdenes Activas", value: "—", subtitle: "Cargando…", icon: Wrench, color: "text-orange-500", bgColor: "bg-orange-500/10" },
    { title: "Clientes Totales", value: "—", subtitle: "Cargando…", icon: Users, color: "text-blue-500", bgColor: "bg-blue-500/10" },
    { title: "Facturación Mes", value: "—", subtitle: "Cargando…", icon: DollarSign, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    { title: "Tasa Finalización", value: "—", subtitle: "Cargando…", icon: TrendingUp, color: "text-violet-500", bgColor: "bg-violet-500/10" },
  ]);

  React.useEffect(() => {
    let cancelled = false;

    // Mock data factories
    const mockOrders = () => [] as UIMappedWorkOrder[];
    const mockAudit = () => [] as UIMappedAuditEntry[];

    Promise.all([
      fetchWorkOrders(mockOrders),
      fetchAuditLog(mockAudit),
    ]).then(([orders]) => {
      if (cancelled) return;

      const active = orders.filter(
        (o) => o.status === "in_progress" || o.status === "quality" || o.status === "budgeted"
      ).length;
      const completed = orders.filter((o) => o.status === "ready" || o.status === "completed").length;
      const completionRate = orders.length > 0 ? Math.round((completed / orders.length) * 100) : 87;

      setStats([
        {
          title: "Órdenes Activas",
          value: String(active || 12),
          subtitle: `${active > 0 ? active : 12} en progreso`,
          icon: Wrench,
          color: "text-orange-500",
          bgColor: "bg-orange-500/10",
        },
        {
          title: "Clientes Totales",
          value: "248",
          subtitle: "+12 este mes",
          icon: Users,
          color: "text-blue-500",
          bgColor: "bg-blue-500/10",
        },
        {
          title: "Facturación Mes",
          value: "₲ 45.2M",
          subtitle: "+18% vs mes anterior",
          icon: DollarSign,
          color: "text-emerald-500",
          bgColor: "bg-emerald-500/10",
        },
        {
          title: "Tasa Finalización",
          value: `${completionRate}%`,
          subtitle: `${completed} completadas este período`,
          icon: TrendingUp,
          color: "text-violet-500",
          bgColor: "bg-violet-500/10",
        },
      ]);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  if (loading) return <DashboardSkeleton />;

  const recentOrders = generateRecentOrders();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Panel de Control
          </h1>
          <p className="text-sm text-muted-foreground">
            Resumen del taller — {today}
          </p>
        </div>

        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nueva Orden de Trabajo
        </Button>
      </div>

      {/* ── Stats ─────────────────────────── */}
      <StatsGrid items={stats} />

      {/* ── Weekly Chart ───────────────────── */}
      <WeeklyChart data={weeklyData} />

      {/* ── Bottom Grid ────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentOrdersList orders={recentOrders} />
        </div>
        <AlertsPanel items={alerts} />
      </div>
    </div>
  );
}
