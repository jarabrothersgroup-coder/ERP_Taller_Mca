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
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { useWorkOrders, useClients, useInvoices } from "@/hooks/use-data";
import type { UIMappedWorkOrder, UIMappedAuditEntry } from "@/lib/data-service";

/* ── Types ──────────────────────────────────── */

interface Stat {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface AlertItem {
  type: "warning" | "info" | "success";
  message: string;
}

/* ── Derived Data Helpers ──────────────────── */

function formatGuarani(amount: number): string {
  if (amount >= 1_000_000) return `₲ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₲ ${(amount / 1_000).toFixed(0)}K`;
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

function getStatusVariant(status: string): "warning" | "secondary" | "success" | "destructive" {
  const map: Record<string, "warning" | "secondary" | "success" | "destructive"> = {
    in_progress: "warning",
    quality: "warning",
    budgeted: "secondary",
    ready: "success",
    completed: "success",
    cancelled: "destructive",
  };
  return map[status] ?? "secondary";
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    in_progress: "En Progreso",
    quality: "Control Calidad",
    budgeted: "Presupuestado",
    ready: "Listo",
    completed: "Completada",
    cancelled: "Cancelada",
    pending: "Pendiente",
  };
  return map[status] ?? status;
}

function getDayName(date: Date): string {
  return date.toLocaleDateString("es-PY", { weekday: "short" });
}

function computeWeeklyData(orders: UIMappedWorkOrder[]): { day: string; orders: number }[] {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  const counts: Record<string, number> = {};
  days.forEach((d) => (counts[d] = 0));

  orders.forEach((o) => {
    const created = new Date(o.createdAt);
    const diffDays = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < 7) {
      const d = getDayName(created);
      if (counts[d] !== undefined) counts[d]++;
    }
  });

  // Show last 7 days ending today
  const result: { day: string; orders: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const name = getDayName(d);
    result.push({ day: i === 0 ? "Hoy" : name, orders: counts[name] ?? 0 });
  }
  return result;
}

const alertIcons: Record<AlertItem["type"], React.ElementType> = {
  warning: AlertTriangle,
  info: DollarSign,
  success: CheckCircle,
};

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

function WeeklyChart({ data }: { data: { day: string; orders: number }[] }) {
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);

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

function RecentOrdersList({ orders }: { orders: UIMappedWorkOrder[] }) {
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
          {orders.slice(0, 8).map((order) => (
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
                    <Badge variant={getStatusVariant(order.status)} className="text-[10px]">
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {order.client} — {order.vehicle}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-xs text-muted-foreground">{order.plate}</p>
                <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {order.createdAt}
                </p>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay órdenes de trabajo registradas
            </p>
          )}
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
  const today = React.useMemo(
    () => new Date().toLocaleDateString("es-PY", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    []
  );

  const { data: orders = [], isLoading: ordersLoading } = useWorkOrders();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices();
  const loading = ordersLoading || clientsLoading || invoicesLoading;

  const stats = React.useMemo<Stat[]>(() => {
    const active = orders.filter(
      (o) => o.status === "in_progress" || o.status === "quality" || o.status === "budgeted"
    ).length;
    const completed = orders.filter((o) => o.status === "ready" || o.status === "completed").length;
    const completionRate = orders.length > 0 ? Math.round((completed / orders.length) * 100) : 0;

    const totalFacturacion = invoices.reduce((sum, inv) => sum + Number(inv.total ?? 0), 0);

    return [
      {
        title: "Órdenes Activas",
        value: String(active),
        subtitle: `${active} en progreso`,
        icon: Wrench,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
      },
      {
        title: "Clientes Totales",
        value: String(clients.length),
        subtitle: `${clients.length} registrados`,
        icon: Users,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
      },
      {
        title: "Facturación Mes",
        value: formatGuarani(totalFacturacion),
        subtitle: `${invoices.length} facturas emitidas`,
        icon: DollarSign,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
      },
      {
        title: "Tasa Finalización",
        value: `${completionRate}%`,
        subtitle: `${completed} completadas`,
        icon: TrendingUp,
        color: "text-violet-500",
        bgColor: "bg-violet-500/10",
      },
    ];
  }, [orders, clients, invoices]);

  const weeklyData = React.useMemo(() => computeWeeklyData(orders), [orders]);

  const alerts = React.useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = [];
    const pendingInvoices = invoices.filter((inv) => inv.estadoPago === "PENDIENTE");
    if (pendingInvoices.length > 0) {
      const total = pendingInvoices.reduce((s, inv) => s + Number(inv.total ?? 0), 0);
      items.push({ type: "info", message: `${pendingInvoices.length} facturas pendientes — ${formatGuarani(total)}` });
    }
    const completedCount = orders.filter((o) => o.status === "ready" || o.status === "completed").length;
    const rate = orders.length > 0 ? Math.round((completedCount / orders.length) * 100) : 0;
    if (orders.length > 0 && rate < 50) {
      items.push({ type: "warning", message: `Tasa de finalización baja: ${rate}%` });
    }
    if (items.length === 0) {
      items.push({ type: "success", message: "Todo funciona correctamente" });
    }
    return items;
  }, [invoices, orders]);

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
          <RecentOrdersList orders={orders} />
        </div>
        <AlertsPanel items={alerts} />
      </div>
    </div>
  );
}
