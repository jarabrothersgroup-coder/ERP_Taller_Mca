"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useThinkcarImports, useThinkcarHealth, useThinkcarStats } from "@/hooks/use-data";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Scan,
  Upload,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Brain,
  Info,
  Wrench,
  BookOpen,
  Sparkles,
  RefreshCw,
  MessageSquare,
} from "lucide-react";

/* ─── Types ──────────────────────────────────── */

interface DtcLookupResult {
  code: string;
  description: string;
  system: string;
  severity: string;
  possibleCauses: string[];
  recommendedActions: string[];
}

/* ─── Helpers ──────────────────────────────────── */

function HealthDot({ healthy }: { healthy: boolean }) {
  return healthy ? (
    <CheckCircle className="h-4 w-4 text-emerald-500" />
  ) : (
    <XCircle className="h-4 w-4 text-red-500" />
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  ALTA: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400",
  MEDIA: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400",
  BAJA: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400",
  CRITICAL: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400",
};

const SYSTEM_LABELS: Record<string, string> = {
  P: "Powertrain",
  C: "Chassis",
  B: "Body",
  U: "Network",
};

const SEVERITY_LABELS: Record<string, string> = {
  HIGH: "Alta",
  MEDIUM: "Media", 
  LOW: "Baja",
  CRITICAL: "Crítica",
};

/* ─── Main Page ────────────────────────────────── */

export default function ThinkcarPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [dtcCode, setDtcCode] = React.useState("");
  const [dtcSearch, setDtcSearch] = React.useState("");

  const { data: imports = [], isLoading: importsLoading } = useThinkcarImports();
  const { data: health, isLoading: healthLoading } = useThinkcarHealth();
  const { data: stats, isLoading: statsLoading } = useThinkcarStats();
  const loading = importsLoading || healthLoading || statsLoading;

  const [feedback, setFeedback] = React.useState<{ type: "ok" | "error"; msg: string } | null>(null);

  // DTC Lookup
  const dtcLookupQuery = useQuery<DtcLookupResult>({
    queryKey: ["dtc-lookup", dtcSearch],
    queryFn: () => api.lookupDtc(dtcSearch),
    enabled: dtcSearch.length >= 4,
    retry: false,
  });

  // USB Import
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

  // Bluetooth
  const btMutation = useMutation({
    mutationFn: () => api.ingestThinkcarBluetooth(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["thinkcar-imports"] });
      qc.invalidateQueries({ queryKey: ["thinkcar-stats"] });
      qc.invalidateQueries({ queryKey: ["thinkcar-health"] });
      setFeedback({ type: "ok", msg: (res as any)?.message ?? "Escaneo Bluetooth completado" });
    },
    onError: () => setFeedback({ type: "error", msg: "No se pudo conectar por Bluetooth" }),
  });

  const handleDtcSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = dtcCode.trim().toUpperCase();
    if (clean.length >= 4) {
      setDtcSearch(clean);
    }
  };

  const dtcResult = dtcLookupQuery.data;

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
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scan className="h-6 w-6 text-blue-500" />
            Thinkcar Diagnóstico OBD2
          </h1>
          <p className="text-sm text-muted-foreground">
            Importación de diagnósticos y asistente DTC con IA
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => usbMutation.mutate()} loading={usbMutation.isPending}>
              <Upload className="h-3.5 w-3.5" /> Importar USB
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => btMutation.mutate()} loading={btMutation.isPending}>
              <Scan className="h-3.5 w-3.5" /> Escanear BT
            </Button>
          </div>
          {feedback && (
            <p className={feedback.type === "ok" ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{feedback.msg}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="dtc" className="gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            DTC Assistant
          </TabsTrigger>
          <TabsTrigger value="imports" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Importaciones
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════ */}
        {/* TAB: Dashboard */}
        {/* ════════════════════════════════════════ */}
        <TabsContent value="dashboard" className="space-y-6 mt-6">
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
                    {health.usb.consecutiveFailures > 0 ? `${health.usb.consecutiveFailures} fallos consecutivos` : "✅ Operativo"}
                  </p>
                  {health.usb.lastSuccessAt && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      Último éxito: {new Date(health.usb.lastSuccessAt).toLocaleDateString("es-PY")}
                    </p>
                  )}
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
                    {health.email.consecutiveFailures > 0 ? `${health.email.consecutiveFailures} fallos consecutivos` : "✅ Operativo"}
                  </p>
                  {health.email.lastSuccessAt && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      Último éxito: {new Date(health.email.lastSuccessAt).toLocaleDateString("es-PY")}
                    </p>
                  )}
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
                    {health.bluetooth.consecutiveFailures > 0 ? `${health.bluetooth.consecutiveFailures} fallos consecutivos` : "✅ Operativo"}
                  </p>
                  {health.bluetooth.lastSuccessAt && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      Último éxito: {new Date(health.bluetooth.lastSuccessAt).toLocaleDateString("es-PY")}
                    </p>
                  )}
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
                <CardContent>
                  <p className="text-2xl font-bold">{stats.pendingReview}</p>
                  {stats.pendingReview > 0 && (
                    <p className="text-xs text-amber-500 mt-1">Requieren vinculación manual</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Códigos DTC</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{stats.dtcCount}</p></CardContent>
              </Card>
            </div>
          )}

          {/* Quick lookup inline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-500" />
                DTC Lookup Rápido
              </CardTitle>
              <CardDescription>Buscá un código de diagnóstico OBD2 al instante</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDtcSearch} className="flex gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={dtcCode}
                    onChange={(e) => setDtcCode(e.target.value.toUpperCase())}
                    placeholder="Ej: P0301, C0035..."
                    className="pl-9 font-mono uppercase"
                  />
                </div>
                <Button type="submit" disabled={dtcCode.trim().length < 4}>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Buscar
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════ */}
        {/* TAB: DTC Assistant */}
        {/* ════════════════════════════════════════ */}
        <TabsContent value="dtc" className="space-y-6 mt-6">
          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleDtcSearch} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                    <Brain className="h-4 w-4 text-violet-500" />
                    Asistente IA — Buscar Código DTC
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Ingresá un código de diagnóstico OBD2 (Ej: P0301, C0035, B1000, U0100)
                  </p>
                  <div className="flex gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={dtcCode}
                        onChange={(e) => setDtcCode(e.target.value.toUpperCase())}
                        placeholder="Código DTC..."
                        className="pl-9 font-mono uppercase text-lg"
                      />
                    </div>
                    <Button type="submit" disabled={dtcCode.trim().length < 4} size="lg" className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      Analizar
                    </Button>
                  </div>
                </div>
                {/* Quick examples */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-muted-foreground mr-1">Ejemplos:</span>
                  {["P0301", "P0171", "C0035", "U0100", "P0420", "P0562"].map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => { setDtcCode(code); setDtcSearch(code); }}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted hover:bg-accent text-muted-foreground transition-colors"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Result */}
          {dtcLookupQuery.isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {dtcLookupQuery.error && (
            <Card className="border-destructive/50">
              <CardContent className="py-4 flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />
                Código no encontrado en la base de datos. Verificá el formato (Ej: P0301).
              </CardContent>
            </Card>
          )}

          {dtcResult && (
            <div className="space-y-4">
              {/* Header */}
              <Card className="overflow-hidden">
                <div className={cn(
                  "h-2 w-full",
                  dtcResult.severity === "HIGH" || dtcResult.severity === "CRITICAL" ? "bg-red-500" :
                  dtcResult.severity === "MEDIUM" ? "bg-amber-500" : "bg-emerald-500"
                )} />
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <code className="text-2xl font-bold font-mono">{dtcResult.code}</code>
                        <Badge className={cn("text-xs", SEVERITY_COLORS[dtcResult.severity] || "")}>
                          {SEVERITY_LABELS[dtcResult.severity] || dtcResult.severity}
                        </Badge>
                      </div>
                      <p className="text-lg mt-2">{dtcResult.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {SYSTEM_LABELS[dtcResult.code.charAt(0)] || "General"} ({dtcResult.code.charAt(0)})
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Causes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Posibles Causas ({dtcResult.possibleCauses.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {dtcResult.possibleCauses.map((cause, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        {cause}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-blue-500" />
                    Acciones Recomendadas ({dtcResult.recommendedActions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {dtcResult.recommendedActions.map((action, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* System Info */}
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5" />
                    Sistema: {SYSTEM_LABELS[dtcResult.code.charAt(0)] || "Desconocido"} ({dtcResult.system}) · Severidad: {dtcResult.severity}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!dtcSearch && (
            <Card>
              <CardContent className="py-12 text-center">
                <Brain className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Buscá un código DTC</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  El asistente te mostrará la descripción, causas y acciones recomendadas
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════ */}
        {/* TAB: Importaciones */}
        {/* ════════════════════════════════════════ */}
        <TabsContent value="imports" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Importaciones Recientes</CardTitle>
                <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["thinkcar-imports"] })} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refrescar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {imports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay importaciones registradas. Conectá un dispositivo Thinkcar o importá un archivo.</p>
              ) : (
                <div className="space-y-2">
                  {imports.map((imp) => (
                    <div key={imp.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{imp.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {imp.source} · {new Date(imp.createdAt).toLocaleDateString("es-PY", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant={imp.status === "COMPLETED" ? "success" : imp.status === "PENDING" ? "warning" : "secondary"} className="text-[10px]">
                          {imp.status === "COMPLETED" ? "Completado" : imp.status === "PENDING" ? "Pendiente" : imp.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">{imp.dtcCount} DTCs</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
