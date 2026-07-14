"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useThinkcarImports, useThinkcarHealth, useThinkcarStats } from "@/hooks/use-data";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Scan, Upload, Activity, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

function HealthDot({ healthy }: { healthy: boolean }) {
  return healthy ? (
    <CheckCircle className="h-4 w-4 text-emerald-500" />
  ) : (
    <XCircle className="h-4 w-4 text-red-500" />
  );
}

export default function ThinkcarPage() {
  const { data: imports = [], isLoading: importsLoading } = useThinkcarImports();
  const { data: health, isLoading: healthLoading } = useThinkcarHealth();
  const { data: stats, isLoading: statsLoading } = useThinkcarStats();
  const loading = importsLoading || healthLoading || statsLoading;

  const qc = useQueryClient();
  const [feedback, setFeedback] = React.useState<{ type: "ok" | "error"; msg: string } | null>(null);

  const usbMutation = useMutation({
    mutationFn: () => api.ingestThinkcarUsb(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["thinkcar-imports"] });
      qc.invalidateQueries({ queryKey: ["thinkcar-stats"] });
      qc.invalidateQueries({ queryKey: ["thinkcar-health"] });
      setFeedback({ type: "ok", msg: "Importación desde USB iniciada" });
    },
    onError: () => setFeedback({ type: "error", msg: "No se pudo importar desde USB" }),
  });

  const btMutation = useMutation({
    mutationFn: () => api.ingestThinkcarBluetooth(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["thinkcar-imports"] });
      qc.invalidateQueries({ queryKey: ["thinkcar-stats"] });
      qc.invalidateQueries({ queryKey: ["thinkcar-health"] });
      setFeedback({ type: "ok", msg: res.message ?? "Escaneo Bluetooth completado" });
    },
    onError: () => setFeedback({ type: "error", msg: "No se pudo conectar por Bluetooth" }),
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Thinkcar Diagnóstico</h1>
          <p className="text-sm text-muted-foreground">Importación de diagnósticos OBD2</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => usbMutation.mutate()}
              loading={usbMutation.isPending}
            >
              <Upload className="h-4 w-4" /> Importar
            </Button>
            <Button
              className="gap-2"
              onClick={() => btMutation.mutate()}
              loading={btMutation.isPending}
            >
              <Scan className="h-4 w-4" /> Conectar
            </Button>
          </div>
          {feedback && (
            <p className={feedback.type === "ok" ? "text-xs text-emerald-600" : "text-xs text-destructive"}>
              {feedback.msg}
            </p>
          )}
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <HealthDot healthy={health.usb.isHealthy} /> USB
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {health.usb.consecutiveFailures > 0 ? `${health.usb.consecutiveFailures} fallos` : "Operativo"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <HealthDot healthy={health.email.isHealthy} /> Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {health.email.consecutiveFailures > 0 ? `${health.email.consecutiveFailures} fallos` : "Operativo"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <HealthDot healthy={health.bluetooth.isHealthy} /> Bluetooth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {health.bluetooth.consecutiveFailures > 0 ? `${health.bluetooth.consecutiveFailures} fallos` : "Operativo"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Importaciones</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.totalImports}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pendientes Revisión</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.pendingReview}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Códigos DTC</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.dtcCount}</p></CardContent>
          </Card>
        </div>
      )}

      {/* Imports List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importaciones Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {imports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay importaciones registradas</p>
          ) : (
            <div className="space-y-2">
              {imports.map((imp) => (
                <div key={imp.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{imp.fileName}</p>
                    <p className="text-xs text-muted-foreground">{imp.source} — {new Date(imp.createdAt).toLocaleDateString("es-PY")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={imp.status === "COMPLETED" ? "success" : "secondary"}>{imp.status}</Badge>
                    <span className="text-xs text-muted-foreground">{imp.dtcCount} DTCs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
