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

  const getSessionHeader = () => {
    const s = getSession();
    return s ? { "X-Portal-Session": s } : {};
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
          <p className="text-destructive">{error}</p>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            ¡Hola, {clientName || summary.client.name}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Resumen de tus vehículos y servicios en el taller
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push("/portal/perfil")} className="gap-1.5 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Perfil</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2.5">
              <Car className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.stats.totalVehicles}</p>
              <p className="text-xs text-muted-foreground">Vehículos registrados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-2.5">
              <Wrench className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeOrders.length}</p>
              <p className="text-xs text-muted-foreground">Órdenes activas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2.5">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{readyOrders.length}</p>
              <p className="text-xs text-muted-foreground">Listos para retirar</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active orders */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-amber-500" />
            Órdenes Activas
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => router.push("/portal/ordenes")} className="gap-1 text-xs">
            Ver todas <ChevronRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {activeOrders.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="mx-auto h-8 w-8 text-green-400 mb-2" />
              <p className="text-sm text-muted-foreground">No tenés órdenes activas en este momento</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeOrders.slice(0, 5).map((order: any) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => router.push(`/portal/ordenes/${order.id}`)}
                  className="w-full text-left flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-muted p-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">OT #{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{order.description || "Sin descripción"}</p>
                    </div>
                  </div>
                  <Badge className={cn("text-xs border", STATUS_COLORS[order.status] || "bg-muted")}>
                    {STATUS_LABELS[order.status] || order.status}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => router.push("/portal/booking")}
          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors text-left"
        >
          <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2.5">
            <Calendar className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Agendar Cita</p>
            <p className="text-xs text-muted-foreground">Reservá un turno en el taller</p>
          </div>
          <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={() => router.push("/portal/ordenes")}
          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors text-left"
        >
          <div className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 p-2.5">
            <FileText className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Historial de Órdenes</p>
            <p className="text-xs text-muted-foreground">Consultá el detalle de todas tus órdenes</p>
          </div>
          <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={() => router.push("/portal/facturas")}
          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors text-left"
        >
          <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-2.5">
            <FileText className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Facturas</p>
            <p className="text-xs text-muted-foreground">Consultá y descargá tus facturas</p>
          </div>
          <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
