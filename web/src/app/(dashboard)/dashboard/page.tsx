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
} from "lucide-react";

/* ── Types ──────────────────────────────────── */
interface Stat {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface Order {
  id: string;
  client: string;
  vehicle: string;
  status: string;
  statusVariant: "warning" | "secondary" | "success";
  technician: string;
  deadline: string;
}

interface AlertItem {
  type: "warning" | "info" | "success";
  message: string;
}

/* ── Data ───────────────────────────────────── */
const stats: Stat[] = [
  {
    title: "Órdenes Activas",
    value: "12",
    change: "+3 hoy",
    icon: Wrench,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    title: "Clientes Totales",
    value: "248",
    change: "+12 este mes",
    icon: Users,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Facturación Mes",
    value: "₲ 45.2M",
    change: "+18% vs mes anterior",
    icon: DollarSign,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    title: "Tasa Finalización",
    value: "87%",
    change: "+5% esta semana",
    icon: TrendingUp,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
];

const recentOrders: Order[] = [
  {
    id: "OT-001",
    client: "María González",
    vehicle: "Toyota Corolla 2022",
    status: "En Progreso",
    statusVariant: "warning",
    technician: "Carlos M.",
    deadline: "Hoy 17:00",
  },
  {
    id: "OT-002",
    client: "Pedro López",
    vehicle: "Hyundai Tucson 2023",
    status: "Presupuestado",
    statusVariant: "secondary",
    technician: "Ana R.",
    deadline: "Mañana",
  },
  {
    id: "OT-003",
    client: "Juan Pérez",
    vehicle: "Kia Sportage 2021",
    status: "Listo",
    statusVariant: "success",
    technician: "Luis M.",
    deadline: "Retirado",
  },
  {
    id: "OT-004",
    client: "Lucía Fernández",
    vehicle: "VW Gol 2020",
    status: "Control Calidad",
    statusVariant: "warning",
    technician: "Carlos M.",
    deadline: "Hoy 15:00",
  },
];

const alerts: AlertItem[] = [
  {
    type: "warning",
    message: "Stock bajo: Frenos Delanteros (3 unidades)",
  },
  {
    type: "info",
    message: "CxC vencida: Factura #156 — ₲ 2.3M pendiente",
  },
  {
    type: "success",
    message: "Backup automático completado hace 2 horas",
  },
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

/* ── Loading Skeleton ───────────────────────── */
function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Cargando panel de control">
      {/* Header skeleton */}
      <div>
        <Skeleton variant="text" className="h-8 w-64" />
        <Skeleton variant="text" className="mt-2 h-4 w-48" />
      </div>

      {/* CTA skeleton */}
      <Skeleton variant="rect" className="h-10 w-52" />

      {/* Stats skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Content area skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <Skeleton variant="card" className="h-64" />
        </div>
        <Skeleton variant="card" className="h-64" />
      </div>
    </div>
  );
}

/* ── Stats Grid ─────────────────────────────── */
function StatsGrid({ items }: { items: Stat[] }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      role="region"
      aria-label="Indicadores clave"
    >
      {items.map((stat, i) => (
        <Card
          key={stat.title}
          className="animate-fade-in-up"
          style={{ animationDelay: `${i * 60}ms` }}
        >
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
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" aria-hidden="true" />
              {stat.change}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Recent Orders ──────────────────────────── */
function RecentOrdersList({ orders }: { orders: Order[] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Órdenes Recientes</CardTitle>
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
        <div className="space-y-3" role="list" aria-label="Órdenes de trabajo">
          {orders.map((order, i) => (
            <div
              key={order.id}
              role="listitem"
              className="group flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 hover:border-foreground/20 transition-all duration-150 cursor-pointer active:scale-[0.99]"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  /* Navigate to order detail */
                }
              }}
              aria-label={`${order.id}: ${order.client} — ${order.vehicle}. Estado: ${order.status}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted group-hover:bg-background transition-colors">
                  <Car className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{order.id}</span>
                    <Badge variant={order.statusVariant} className="text-[10px]">
                      {order.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.client} — {order.vehicle}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">
                  Técnico: {order.technician}
                </p>
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
        <CardTitle>Alertas</CardTitle>
        <CardDescription>Notificaciones pendientes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3" role="list" aria-label="Alertas y notificaciones">
          {items.map((alert, i) => {
            const AlertIcon = alertIcons[alert.type];
            const colorClass = alertColors[alert.type];
            return (
              <Alert
                key={i}
                variant={
                  alert.type === "warning"
                    ? "warning"
                    : alert.type === "info"
                      ? "info"
                      : "success"
                }
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
  const [loading] = React.useState(false);

  /* Today's formatted date */
  const today = React.useMemo(
    () =>
      new Date().toLocaleDateString("es-PY", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    []
  );

  if (loading) return <DashboardSkeleton />;

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

        {/* ⭐ PRIMARY CTA — único botón dominante */}
        <Button
          size="lg"
          className="gap-2 shadow-md hover:shadow-lg transition-shadow"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nueva Orden de Trabajo
        </Button>
      </div>

      {/* ── Stats ─────────────────────────── */}
      <StatsGrid items={stats} />

      {/* ── Main Content Grid ──────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <RecentOrdersList orders={recentOrders} />
        <AlertsPanel items={alerts} />
      </div>
    </div>
  );
}
