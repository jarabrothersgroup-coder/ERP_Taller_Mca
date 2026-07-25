"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Wrench, Search, ChevronRight, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

function getSession(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("portal_session");
}

export default function PortalOrdenesPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/portal/login");
      return;
    }

    const fetchOrders = async () => {
      try {
        const data = await api.request<any[]>("/portal/orders", {
          headers: { "X-Portal-Session": session },
        });
        setOrders(data || []);
      } catch (err: any) {
        if (err?.status === 401) {
          localStorage.removeItem("portal_session");
          router.push("/portal/login");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [router]);

  const filtered = search
    ? orders.filter(
        (o) =>
          (o.id || "").toLowerCase().includes(search.toLowerCase()) ||
          (o.description || "").toLowerCase().includes(search.toLowerCase()),
      )
    : orders;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/portal/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Órdenes de Trabajo</h1>
          <p className="text-xs text-muted-foreground">Historial completo de servicios</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por ID o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                {search ? "No se encontraron órdenes" : "No hay órdenes registradas"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((order: any) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => router.push(`/portal/ordenes/${order.id}`)}
                  className="w-full text-left flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-full bg-muted p-2 shrink-0">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        OT #{order.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.description || "Sin descripción"} ·{" "}
                        {new Date(order.createdAt).toLocaleDateString("es-PY")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={cn("text-xs border", STATUS_COLORS[order.status] || "bg-muted")}>
                      {STATUS_LABELS[order.status] || order.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
