"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Wrench, Clock, CheckCircle2, AlertCircle, User, Car } from "lucide-react";
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

const STATUS_ICONS: Record<string, React.ElementType> = {
  Presupuestado: Clock,
  Aprobado: CheckCircle2,
  En_Proceso: Wrench,
  Control_Calidad: AlertCircle,
  Listo: CheckCircle2,
};

const STATUS_STEPS = ["Presupuestado", "Aprobado", "En_Proceso", "Control_Calidad", "Listo"];

function getSession(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("portal_session");
}

export default function PortalOrdenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/portal/login");
      return;
    }

    const fetchOrder = async () => {
      try {
        // Fetch single order detail via portal endpoint
        const data = await api.request<any>(`/portal/orders/${id}`, {
          headers: { "X-Portal-Session": session },
        });
        if (data) {
          setOrder(data);
        }
      } catch (err: any) {
        if (err?.status === 401) {
          localStorage.removeItem("portal_session");
          router.push("/portal/login");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id, router]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Orden no encontrada</p>
        <Button variant="outline" onClick={() => router.push("/portal/ordenes")} className="mt-4">
          Volver
        </Button>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.indexOf(order.status);
  const StatusIcon = STATUS_ICONS[order.status] || Wrench;

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => router.push("/portal/ordenes")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver a órdenes
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground font-mono">OT #{order.id.slice(0, 8)}</p>
              <h1 className="text-lg font-bold mt-1">{order.description || "Servicio de taller"}</h1>
            </div>
            <Badge className={cn("text-xs border gap-1", STATUS_COLORS[order.status] || "bg-muted")}>
              <StatusIcon className="h-3 w-3" />
              {STATUS_LABELS[order.status] || order.status}
            </Badge>
          </div>

          {order.vehiculo && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Car className="h-4 w-4" />
              <span>{order.vehiculo}</span>
              {order.plate && <span>· {order.plate}</span>}
            </div>
          )}
          {order.cliente && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{order.cliente}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Progreso del Servicio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {STATUS_STEPS.map((step, index) => {
              const StepIcon = STATUS_ICONS[step] || Clock;
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div key={step} className="flex gap-3 pb-4 last:pb-0">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border-2 shrink-0",
                        isCompleted
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-muted border-muted-foreground/20 text-muted-foreground/40",
                        isCurrent && "ring-2 ring-orange-500/30 ring-offset-2",
                      )}
                    >
                      <StepIcon className="h-3.5 w-3.5" />
                    </div>
                    {index < STATUS_STEPS.length - 1 && (
                      <div
                        className={cn(
                          "w-0.5 h-6 mt-1",
                          index < currentStepIndex ? "bg-orange-500" : "bg-muted-foreground/10",
                        )}
                      />
                    )}
                  </div>
                  <div className="pt-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isCompleted ? "text-foreground" : "text-muted-foreground/50",
                      )}
                    >
                      {STATUS_LABELS[step]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Info card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Detalles</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Creada</span>
            <span>{new Date(order.createdAt).toLocaleDateString("es-PY", { dateStyle: "long" })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Última actualización</span>
            <span>{new Date(order.updatedAt).toLocaleDateString("es-PY", { dateStyle: "long" })}</span>
          </div>
          {order.totalCost && (
            <div className="flex justify-between font-medium border-t pt-2 mt-2">
              <span>Total estimado</span>
              <span>₲ {Number(order.totalCost).toLocaleString("es-PY")}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
