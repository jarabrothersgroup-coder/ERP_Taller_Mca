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
  ArrowLeft,
  User,
  Mail,
  Phone,
  Car,
  Shield,
  AlertCircle,
} from "lucide-react";

/* ── Helpers ──────────────────────────────────── */

function getSession(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("portal_session");
}

/* ── Types ──────────────────────────────────── */

interface PortalSummary {
  client: { id: string; name: string; email: string | null; phone: string | null };
  vehicles: { id: string; brand: string; model: string; plate: string | null; year: number | null; hvAlert: boolean }[];
  recentOrders: any[];
  stats: { totalVehicles: number; totalOrders: number };
}

/* ── Page ─────────────────────────────────────── */

export default function PortalPerfilPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
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

  const { client, vehicles } = summary;

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/portal/dashboard")} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <h1 className="text-xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-sm text-muted-foreground">Información de tu cuenta y vehículos</p>
      </div>

      {/* Client info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Datos Personales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{client.name}</span>
          </div>
          {client.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{client.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">ID: {client.id.slice(0, 8)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Car className="h-4 w-4" />
            Mis Vehículos ({vehicles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenés vehículos registrados</p>
          ) : (
            <div className="space-y-2">
              {vehicles.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {v.brand} {v.model}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {v.plate || "Sin chapa"} {v.year ? `· ${v.year}` : ""}
                    </p>
                  </div>
                  {v.hvAlert && (
                    <Badge variant="destructive" className="text-xs">HV</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Resumen de Actividad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-2xl font-bold">{summary.stats.totalOrders}</p>
              <p className="text-xs text-muted-foreground">Órdenes totales</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-2xl font-bold">{summary.stats.totalVehicles}</p>
              <p className="text-xs text-muted-foreground">Vehículos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
