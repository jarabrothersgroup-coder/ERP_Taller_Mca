"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Car,
  Wrench,
  FileText,
  LogOut,
  User,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  MessageSquare,
  ArrowRight,
  Star,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Helper to get session from localStorage ── */

function getSession(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("portal_session");
}

function getClientName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("portal_client_name") || "";
}

/* ── Types ──────────────────────────────────── */

interface PortalSummary {
  client: { id: string; name: string; email: string | null; phone: string | null };
  vehicles: any[];
  recentOrders: any[];
  stats: { totalVehicles: number; totalOrders: number };
}

const STATUS_LABELS: Record<string, string> = {
  Presupuestado: "Presupuestado",
  Aprobado: "Aprobado",
  En_Proceso: "En reparación",
  Control_Calidad: "Control de calidad",
  Listo: "Listo para entrega",
};

const STATUS_COLORS: Record<string, string> = {
  Presupuestado: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Aprobado: "bg-blue-100 text-blue-800 border-blue-300",
  En_Proceso: "bg-indigo-100 text-indigo-800 border-indigo-300",
  Control_Calidad: "bg-purple-100 text-purple-800 border-purple-300",
  Listo: "bg-green-100 text-green-800 border-green-300",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  Presupuestado: Clock,
  Aprobado: CheckCircle2,
  En_Proceso: Wrench,
  Control_Calidad: Shield,
  Listo: Sparkles,
};

/* ── Page Component ─────────────────────────── */

export default function PortalDashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    setClientName(getClientName());
    const session = getSession();
    if (!session) {
      router.push("/portal/login");
      return;
    }

    const fetchSummary = async () => {
      try {
        const data = await api.request<PortalSummary>("/portal/summary", {
          headers: { "X-Portal-Session": session },
        });
        setSummary(data);
      } catch (err: any) {
        if (err?.status === 401) {
          localStorage.removeItem("portal_session");
          router.push("/portal/login");
          return;
        }
        setError(err?.message || "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("portal_session");
    localStorage.removeItem("portal_client_name");
    localStorage.removeItem("portal_client_email");
    router.push("/portal/login");
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="py-12 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
          <p className="text-destructive font-medium">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const activeOrders = summary.recentOrders.filter(
    (o: any) => o.status !== "Listo" && o.status !== "Finalizado" && o.status !== "ANULADO",
  );
  const readyOrders = summary.recentOrders.filter(
    (o: any) => o.status === "Listo",
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero CTA Section — enhanced with urgency */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 p-6 sm:p-8 text-white shadow-xl shadow-orange-500/20">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-orange-800/30 blur-2xl" />
        
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                ¡Hola, {clientName || summary.client.name}! 👋
              </h1>
              <p className="text-orange-100 mt-1 text-sm sm:text-base">
                {activeOrders.length > 0
                  ? `Tenés ${activeOrders.length} orden${activeOrders.length > 1 ? "es" : ""} activa${activeOrders.length > 1 ? "s" : ""} en el taller`
                  : "¿Necesitás servicio para tu vehículo?"}
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Button
                onClick={() => router.push("/portal/booking")}
                className="bg-white text-orange-600 hover:bg-orange-50 font-semibold shadow-lg gap-2 active:scale-[0.98] transition-transform"
                size="lg"
              >
                <Calendar className="h-5 w-5" />
                Agendar Turno
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-white/20">
            <div className="flex items-center gap-1.5 text-xs text-orange-100">
              <Clock className="h-3.5 w-3.5" />
              <span>Turnos en 24h</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-orange-100">
              <Shield className="h-3.5 w-3.5" />
              <span>Garantía en servicios</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-orange-100">
              <Star className="h-3.5 w-3.5" />
              <span>Técnicos certificados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions — enhanced with hover effects */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => router.push("/portal/booking")}
          className="group flex items-center gap-3 p-4 rounded-xl border bg-card hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all duration-200 text-left hover:shadow-md hover:shadow-orange-500/5"
        >
          <div className="rounded-xl bg-orange-100 dark:bg-orange-900/30 p-2.5 group-hover:scale-110 transition-transform">
            <Calendar className="h-5 w-5 text-orange-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Agendar Cita</p>
            <p className="text-[11px] text-muted-foreground">Reservá un turno</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
        </button>
        
        <button
          type="button"
          onClick={() => router.push("/portal/servicios")}
          className="group flex items-center gap-3 p-4 rounded-xl border bg-card hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all duration-200 text-left hover:shadow-md hover:shadow-blue-500/5"
        >
          <div className="rounded-xl bg-blue-100 dark:bg-blue-900/30 p-2.5 group-hover:scale-110 transition-transform">
            <Wrench className="h-5 w-5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Ver Servicios</p>
            <p className="text-[11px] text-muted-foreground">Catálogo completo</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
        </button>
        
        <button
          type="button"
          onClick={() => router.push("/portal/ordenes")}
          className="group flex items-center gap-3 p-4 rounded-xl border bg-card hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all duration-200 text-left hover:shadow-md hover:shadow-emerald-500/5"
        >
          <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/30 p-2.5 group-hover:scale-110 transition-transform">
            <FileText className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Mis Órdenes</p>
            <p className="text-[11px] text-muted-foreground">{summary.stats.totalOrders} órdenes</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
        </button>
        
        <button
          type="button"
          onClick={() => router.push("/portal/perfil")}
          className="group flex items-center gap-3 p-4 rounded-xl border bg-card hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all duration-200 text-left hover:shadow-md hover:shadow-purple-500/5"
        >
          <div className="rounded-xl bg-purple-100 dark:bg-purple-900/30 p-2.5 group-hover:scale-110 transition-transform">
            <User className="h-5 w-5 text-purple-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Mi Perfil</p>
            <p className="text-[11px] text-muted-foreground">{summary.stats.totalVehicles} vehículos</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>

      {/* Ready for pickup alert — enhanced */}
      {readyOrders.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-800 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2 shrink-0">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                ¡Vehículo{readyOrders.length > 1 ? "s" : ""} listo{readyOrders.length > 1 ? "s" : ""} para retirar!
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Tenés {readyOrders.length} orden{readyOrders.length > 1 ? "es" : ""} esperándote en el taller
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-green-300 text-green-700 hover:bg-green-100 shrink-0 gap-1"
              onClick={() => router.push("/portal/ordenes")}
            >
              Ver
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Active orders */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-amber-500" />
            Órdenes Activas
          </CardTitle>
          {activeOrders.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => router.push("/portal/ordenes")} className="gap-1 text-xs">
              Ver todas <ChevronRight className="h-3 w-3" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {activeOrders.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Todo al día</p>
              <p className="text-xs text-muted-foreground/70 mt-1">No tenés órdenes activas</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-2"
                onClick={() => router.push("/portal/booking")}
              >
                <Calendar className="h-4 w-4" />
                Agendar un turno
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {activeOrders.slice(0, 5).map((order: any) => {
                const StatusIcon = STATUS_ICONS[order.status] || Clock;
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => router.push(`/portal/ordenes/${order.id}`)}
                    className="w-full text-left flex items-center justify-between p-3 rounded-xl border hover:bg-accent/50 hover:border-border/80 hover:shadow-sm transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="rounded-full bg-muted p-2.5 shrink-0 group-hover:scale-105 transition-transform">
                        <StatusIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">OT #{order.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground truncate">{order.description || "Sin descripción"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Badge className={cn("text-xs border", STATUS_COLORS[order.status] || "bg-muted")}>
                        {STATUS_LABELS[order.status] || order.status}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logout */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-muted-foreground hover:text-destructive">
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
