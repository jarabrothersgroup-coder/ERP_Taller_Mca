"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Brain,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Car,
  Search,
  Gauge,
  Calendar,
  DollarSign,
  Shield,
  Zap,
  Activity,
  BarChart3,
  FileText,
  RefreshCw,
  Sparkles,
} from "lucide-react";

/* ─── Types ──────────────────────────────────── */

interface MlPredictedService {
  codigoServicio: string;
  nombreServicio: string;
  probabilidad: number;
  kmEstimado: number;
  diasEstimados: number;
  prioridad: "ALTA" | "MEDIA" | "BAJA";
  costoEstimado: number;
  descripcion: string;
}

interface MlVehiclePrediction {
  vehiculoId: string;
  vehiculo: string;
  placa: string;
  marca: string;
  modelo: string;
  anho: number | null;
  tipoMotor: string;
  kmActual: number;
  kmPorMes: number;
  edadVehiculoMeses: number;
  serviciosRecientes: string[];
  dtcsFrecuentes: string[];
  scoreRiesgo: number;
  serviciosPredichos: MlPredictedService[];
  recomendacion: string;
}

interface MlTrainingData {
  totalVehiculos: number;
  totalOTsAnalizadas: number;
  patronesEncontrados: number;
  serviciosMasComunes: Array<{ servicio: string; frecuencia: number }>;
  dtcsMasComunes: Array<{ dtc: string; frecuencia: number }>;
}

/* ─── Helpers ──────────────────────────────────── */

function formatGuarani(amount: number): string {
  if (amount >= 1_000_000) return `₲ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₲ ${(amount / 1_000).toLocaleString("es-PY")}`;
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

function formatKm(km: number): string {
  return `${km.toLocaleString("es-PY")} km`;
}

function riskColor(score: number): string {
  if (score >= 70) return "text-red-500";
  if (score >= 40) return "text-amber-500";
  return "text-emerald-500";
}

function riskBg(score: number): string {
  if (score >= 70) return "bg-red-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-emerald-500";
}

function priorityBadge(p: string) {
  const map: Record<string, { label: string; cls: string }> = {
    ALTA: { label: "Alta", cls: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400" },
    MEDIA: { label: "Media", cls: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400" },
    BAJA: { label: "Baja", cls: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400" },
  };
  const m = map[p] || { label: p, cls: "bg-gray-100 text-gray-700" };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", m.cls)}>{m.label}</span>;
}

/* ─── Main Page ────────────────────────────────── */

export default function PredictiveMLPage() {
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();
  const [vehicleId, setVehicleId] = React.useState("");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeTab, setActiveTab] = React.useState("predictions");

  // Fetch vehicle prediction
  const predQuery = useQuery<MlVehiclePrediction>({
    queryKey: ["predictive-ml", vehicleId],
    queryFn: () => api.request(`/workshop/predictions/ml/${vehicleId}`),
    enabled: vehicleId.length > 0,
    retry: false,
  });

  // Fetch all high-risk predictions
  const allPredQuery = useQuery<{ total: number; items: MlVehiclePrediction[] }>({
    queryKey: ["predictive-ml-all"],
    queryFn: () => api.request("/workshop/predictions/ml?umbral=40"),
  });

  // Fetch training data
  const trainingQuery = useQuery<MlTrainingData>({
    queryKey: ["predictive-ml-training"],
    queryFn: () => api.request("/workshop/predictions/ml/training-data"),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setVehicleId(searchTerm.trim());
    }
  };

  // Refresh all query groups
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["predictive-ml"] });
    qc.invalidateQueries({ queryKey: ["predictive-ml-all"] });
    qc.invalidateQueries({ queryKey: ["predictive-ml-training"] });
  };

  const isLoading = predQuery.isLoading;
  const prediction = predQuery.data;
  const allPredictions = allPredQuery.data?.items || [];
  const training = trainingQuery.data;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {ToastContainer}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-violet-500" />
            Mantenimiento Predictivo ML
          </h1>
          <p className="text-sm text-muted-foreground">
            Predicción de servicios basada en machine learning — datos históricos, DTCs y kilometraje
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshAll}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refrescar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="predictions" className="gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Por Vehículo
          </TabsTrigger>
          <TabsTrigger value="fleet" className="gap-1.5">
            <Car className="h-3.5 w-3.5" />
            Flota
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Estadísticas ML
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════ */}
        {/* TAB 1: Single Vehicle Prediction */}
        {/* ════════════════════════════════════════ */}
        <TabsContent value="predictions" className="space-y-6 mt-6">
          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
                    ID del Vehículo
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="UUID del vehículo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={!searchTerm.trim() || isLoading}>
                  {isLoading ? "Analizando..." : "Analizar"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Results */}
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          )}

          {predQuery.error && (
            <Card className="border-destructive/50">
              <CardContent className="py-4 flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />
                {(predQuery.error as any)?.message || "Vehículo no encontrado. Verificá el ID."}
              </CardContent>
            </Card>
          )}

          {prediction && vehicleId && (
            <>
              {/* Score de Riesgo */}
              <Card className="overflow-hidden">
                <div className={cn("h-1.5 w-full", riskBg(prediction.scoreRiesgo))} />
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <div className="flex flex-col items-center">
                      <div className="relative flex items-center justify-center">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                          <circle
                            cx="18" cy="18" r="15.5" fill="none"
                            stroke={prediction.scoreRiesgo >= 70 ? "#ef4444" : prediction.scoreRiesgo >= 40 ? "#f59e0b" : "#10b981"}
                            strokeWidth="3"
                            strokeDasharray={`${prediction.scoreRiesgo}, 100`}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>
                        <span className={cn("absolute text-2xl font-bold", riskColor(prediction.scoreRiesgo))}>
                          {prediction.scoreRiesgo}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Riesgo</span>
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Car className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-semibold text-lg">{prediction.vehiculo}</p>
                          <p className="text-xs text-muted-foreground">
                            {prediction.placa} · {prediction.anho || "Año desconocido"} · {prediction.tipoMotor}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">KM Actuales</p>
                          <p className="text-sm font-bold">{formatKm(prediction.kmActual)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">KM/mes</p>
                          <p className="text-sm font-bold">{prediction.kmPorMes.toLocaleString()}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">Edad</p>
                          <p className="text-sm font-bold">
                            {Math.floor(prediction.edadVehiculoMeses / 12)}a {prediction.edadVehiculoMeses % 12}m
                          </p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">DTCs</p>
                          <p className="text-sm font-bold">{prediction.dtcsFrecuentes.length}</p>
                        </div>
                      </div>
                    </div>

                    <Badge className={cn(
                      "text-xs px-3 py-1.5 shrink-0",
                      prediction.scoreRiesgo >= 70 ? "bg-red-100 text-red-700 border-red-300" :
                      prediction.scoreRiesgo >= 40 ? "bg-amber-100 text-amber-700 border-amber-300" :
                      "bg-emerald-100 text-emerald-700 border-emerald-300"
                    )}>
                      {prediction.scoreRiesgo >= 70 ? "⚠️ Riesgo Alto" :
                       prediction.scoreRiesgo >= 40 ? "⚠️ Riesgo Medio" : "✅ Riesgo Bajo"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Recomendación */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    Recomendación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{prediction.recomendacion}</p>
                </CardContent>
              </Card>

              {/* Servicios Predichos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    Servicios Predichos ({prediction.serviciosPredichos.length})
                  </CardTitle>
                  <CardDescription>
                    Basado en modelo de regresión logística con pesos ML sobre datos históricos del taller
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {prediction.serviciosPredichos.map((svc) => (
                      <div key={svc.codigoServicio} className="rounded-lg border p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{svc.nombreServicio}</p>
                              {priorityBadge(svc.prioridad)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{svc.descripcion}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold">{Math.round(svc.probabilidad * 100)}%</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Probabilidad</p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <Progress
                            value={svc.probabilidad * 100}
                            className={cn(
                              "h-2",
                              svc.prioridad === "ALTA" ? "bg-red-100 [&>div]:bg-red-500" :
                              svc.prioridad === "MEDIA" ? "bg-amber-100 [&>div]:bg-amber-500" :
                              "bg-emerald-100 [&>div]:bg-emerald-500"
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-3 mt-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {svc.diasEstimados > 0 ? `${svc.diasEstimados} días` : "Urgente"}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Gauge className="h-3 w-3" />
                            {formatKm(svc.kmEstimado)}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <DollarSign className="h-3 w-3" />
                            {formatGuarani(svc.costoEstimado)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Servicios Recientes & DTCs */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Servicios Recientes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {prediction.serviciosRecientes.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {prediction.serviciosRecientes.map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin servicios recientes registrados</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      DTCs Frecuentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {prediction.dtcsFrecuentes.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {prediction.dtcsFrecuentes.map((dtc) => (
                          <code key={dtc} className="px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/30 text-red-600 text-xs font-mono">{dtc}</code>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin DTCs registrados</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {!vehicleId && (
            <Card>
              <CardContent className="py-12 text-center">
                <Brain className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Ingresá un ID de vehículo</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  El modelo ML analizará OT anteriores, DTCs y kilometraje para predecir servicios necesarios
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════ */}
        {/* TAB 2: Fleet Overview */}
        {/* ════════════════════════════════════════ */}
        <TabsContent value="fleet" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-violet-500" />
                Vehículos con Riesgo Alto/Medio ({allPredictions.length})
              </CardTitle>
              <CardDescription>
                Vehículos con score de riesgo ≥ 40, ordenados por criticidad
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allPredQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : allPredictions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No se encontraron vehículos con riesgo alto/medio</p>
                  <p className="text-xs mt-1">Los vehículos aparecerán aquí cuando tengan un score ≥ 40</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allPredictions.map((pred) => (
                    <div key={pred.vehiculoId} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                        pred.scoreRiesgo >= 70 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                      )}>
                        {pred.scoreRiesgo}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{pred.vehiculo}</p>
                        <p className="text-xs text-muted-foreground">{pred.placa} · {pred.marca} {pred.modelo}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{pred.serviciosPredichos.length} servicios</p>
                        <div className="flex gap-0.5 mt-1 justify-end">
                          {pred.serviciosPredichos.filter((s) => s.prioridad === "ALTA").length > 0 && (
                            <span className="w-2 h-2 rounded-full bg-red-500" title="Prioridad alta" />
                          )}
                          {pred.serviciosPredichos.filter((s) => s.prioridad === "MEDIA").length > 0 && (
                            <span className="w-2 h-2 rounded-full bg-amber-500" title="Prioridad media" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════ */}
        {/* TAB 3: ML Statistics */}
        {/* ════════════════════════════════════════ */}
        <TabsContent value="stats" className="space-y-6 mt-6">
          {trainingQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : training ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Vehículos</p>
                      <Car className="h-4 w-4 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold mt-1">{training.totalVehiculos}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">OTs Analizadas</p>
                      <FileText className="h-4 w-4 text-violet-500" />
                    </div>
                    <p className="text-2xl font-bold mt-1">{training.totalOTsAnalizadas}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Patrones ML</p>
                      <Brain className="h-4 w-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-bold mt-1">{training.patronesEncontrados}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Servicios más comunes */}
              {training.serviciosMasComunes.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-blue-500" />
                      Servicios Más Comunes (Top 10)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {training.serviciosMasComunes.map((s, i) => {
                        const maxFreq = Math.max(...training.serviciosMasComunes.map((x) => x.frecuencia));
                        return (
                          <div key={s.servicio} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-5 text-right font-mono">{i + 1}</span>
                            <span className="text-sm flex-1 truncate">{s.servicio}</span>
                            <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-500"
                                style={{ width: `${(s.frecuencia / maxFreq) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-muted-foreground w-12 text-right">{s.frecuencia}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Service profiles */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Perfiles de Servicio ML ({training.patronesEncontrados})
                  </CardTitle>
                  <CardDescription>
                    Cada perfil tiene pesos ML para km, edad del vehículo y DTCs relacionados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    El modelo de regresión logística analiza {training.totalVehiculos} vehículos y{" "}
                    {training.totalOTsAnalizadas} órdenes de trabajo para predecir servicios con
                    probabilidades basadas en patrones históricos del taller.
                  </p>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Brain className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No hay datos de entrenamiento disponibles</p>
                <p className="text-xs text-muted-foreground/60 mt-1">El modelo ML necesita datos históricos de servicio para generar predicciones</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
