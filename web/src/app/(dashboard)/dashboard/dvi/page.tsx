"use client";

import * as React from "react";
import { useDVIInspections } from "@/hooks/use-data";
import { DVICreateDialog } from "./dvi-create-dialog";
import type { DVIInspection } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  Camera,
  ImagePlus,
  ArrowLeftRight,
  Search,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  CheckCircle2,
  AlertTriangle,
  Activity,
} from "lucide-react";

/* ─── Types ──────────────────────────────────── */

interface DVIItem {
  id: string;
  tipo: string;
  descripcion: string;
  gravedad: "LEVE" | "MODERADO" | "SEVERO";
  fotoBefore?: string;
  fotoAfter?: string;
  reparado: boolean;
}

interface DVIIPhoto {
  id: string;
  url: string;
  tipo: string;
  label: string;
  createdAt: string;
}

type DVIInspectionExtended = DVIInspection & { fotos?: DVIIPhoto[] };

/* ─── Helpers ──────────────────────────────────── */

const statusVariant: Record<string, "default" | "secondary" | "warning" | "success" | "destructive"> = {
  COMPLETADA: "success",
  EN_PROGRESO: "warning",
  PENDIENTE: "secondary",
  CANCELADA: "destructive",
};

const gravedadColors: Record<string, string> = {
  LEVE: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400",
  MODERADO: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400",
  SEVERO: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400",
};

/* ─── Before/After Comparison Component ─────────── */

function BeforeAfterSlider({ before, after, label }: { before?: string; after?: string; label: string }) {
  const [sliderPos, setSliderPos] = React.useState(50);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  React.useEffect(() => {
    const handleUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleUp);
    return () => window.removeEventListener("mouseup", handleUp);
  }, []);

  if (!before && !after) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowLeftRight className="h-3 w-3" />
        <span>{label}</span>
        <span className="text-[10px] text-emerald-500">Antes</span>
        <span className="text-[10px] text-blue-500">Después</span>
      </div>
      {/* Touch support for tablets/workshops */}
      <div
        ref={containerRef}
        className="relative w-full h-40 rounded-lg overflow-hidden bg-muted cursor-ew-resize select-none touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={(e) => {
          setIsDragging(true);
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
            setSliderPos((x / rect.width) * 100);
          }
        }}
        onTouchMove={(e) => {
          if (!isDragging || !containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
          setSliderPos((x / rect.width) * 100);
        }}
        onTouchEnd={() => setIsDragging(false)}
        role="slider"
        aria-label={`Comparación before/after: ${label}`}
        aria-valuenow={sliderPos}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setSliderPos((p) => Math.min(100, p + 5));
          if (e.key === "ArrowLeft") setSliderPos((p) => Math.max(0, p - 5));
        }}
      >
        {/* "After" layer (shown on right side) */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/20 flex items-center justify-center"
          style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
        >
          {after ? (
            <img src={after} alt={`Después - ${label}`} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-blue-400">
              <Camera className="h-6 w-6" />
              <span className="text-[10px]">Sin foto después</span>
            </div>
          )}
          <span className="absolute top-2 right-2 text-[10px] font-medium bg-blue-500/80 text-white px-1.5 py-0.5 rounded">
            Después
          </span>
        </div>

        {/* "Before" layer (shown on left side) */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/20 flex items-center justify-center"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          {before ? (
            <img src={before} alt={`Antes - ${label}`} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-emerald-400">
              <Camera className="h-6 w-6" />
              <span className="text-[10px]">Sin foto antes</span>
            </div>
          )}
          <span className="absolute top-2 left-2 text-[10px] font-medium bg-emerald-500/80 text-white px-1.5 py-0.5 rounded">
            Antes
          </span>
        </div>

        {/* Slider handle */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10 cursor-ew-resize"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-md border flex items-center justify-center">
            <ArrowLeftRight className="h-3.5 w-3.5 text-gray-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────── */

const DVI_STORAGE_KEY = "dvi_compare_state";

/**
 * Load previously saved comparison state from localStorage.
 * Fixes C-08: Canvas DVI sin auto-save — now persists compare state.
 */
function loadSavedState(): { inspectionId: string | null; compareIndex: number } {
  if (typeof window === "undefined") return { inspectionId: null, compareIndex: 0 };
  try {
    const saved = localStorage.getItem(DVI_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        inspectionId: parsed.inspectionId ?? null,
        compareIndex: parsed.compareIndex ?? 0,
      };
    }
  } catch { /* ignore parse errors */ }
  return { inspectionId: null, compareIndex: 0 };
}

/**
 * Save current comparison state to localStorage.
 */
function saveCompareState(inspectionId: string | null, compareIndex: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DVI_STORAGE_KEY, JSON.stringify({ inspectionId, compareIndex, savedAt: Date.now() }));
  } catch { /* ignore storage errors */ }
}

/**
 * Clear saved comparison state.
 */
function clearSavedState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DVI_STORAGE_KEY);
  } catch { /* ignore */ }
}

export default function DVIPage() {
  const { data: rawInspections = [], isLoading } = useDVIInspections();
  const inspections = rawInspections as unknown as DVIInspection[];
  const [search, setSearch] = React.useState("");
  const [selectedInspection, setSelectedInspection] = React.useState<DVIInspection | null>(null);
  const [viewMode, setViewMode] = React.useState<"grid" | "compare">("grid");
  const [compareIndex, setCompareIndex] = React.useState(0);

  // ── Restore saved state on mount (C-08 auto-save) ──
  React.useEffect(() => {
    if (!isLoading && inspections.length > 0) {
      const saved = loadSavedState();
      if (saved.inspectionId) {
        const match = inspections.find((i) => i.id === saved.inspectionId);
        if (match) {
          setSelectedInspection(match);
          setViewMode("compare");
          setCompareIndex(saved.compareIndex);
        }
      }
    }
  }, [isLoading, inspections]);

  // ── Save state when view mode changes (C-08 auto-save) ──
  React.useEffect(() => {
    if (viewMode === "compare" && selectedInspection) {
      saveCompareState(selectedInspection.id, compareIndex);
    } else if (viewMode === "grid") {
      clearSavedState();
    }
  }, [viewMode, selectedInspection?.id, compareIndex]);

  // Filter
  const filtered = inspections.filter((insp) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      insp.id.toLowerCase().includes(q) ||
      insp.vehicleId.toLowerCase().includes(q) ||
      insp.status.toLowerCase().includes(q)
    );
  });    const handleOpenCompare = (insp: DVIInspection) => {
    setSelectedInspection(insp);
    setViewMode("compare");
    setCompareIndex(0);
  };

  const selectedExtended = selectedInspection as DVIInspectionExtended | null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-blue-500" />
            Inspección Vehicular (DVI)
          </h1>
          <p className="text-sm text-muted-foreground">
            Inspecciones digitales con comparación before/after y score de salud
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar inspecciones..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <DVICreateDialog />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {search ? "No se encontraron inspecciones con ese filtro" : "No hay inspecciones registradas"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Creá una inspección para comenzar</p>
          </CardContent>
        </Card>
      ) : viewMode === "compare" && selectedInspection ? (
        /* ── Detailed Comparison View ─────────── */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => { setViewMode("grid"); setSelectedInspection(null); clearSavedState(); }} className="gap-1.5">
                <ChevronLeft className="h-4 w-4" />
                Volver
              </Button>
              <div>
                <h2 className="text-lg font-bold">DVI-{selectedInspection.id.slice(0, 8)}</h2>
                <p className="text-xs text-muted-foreground">
                  Vehículo: {selectedInspection.vehicleId.slice(0, 8)} — {selectedInspection.status}
                </p>
              </div>
            </div>
            <Badge className={cn("text-sm px-3 py-1.5", selectedInspection.healthScore >= 70 ? "bg-green-100 text-green-700" : selectedInspection.healthScore >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
              Score: {selectedInspection.healthScore}%
            </Badge>
          </div>

          {/* Items with before/after comparison */}
          <div className="space-y-4">              {(selectedInspection.items || []).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No hay ítems registrados en esta inspección. Agregá fotos y descripciones.
                </CardContent>
              </Card>
            ) : (
              (selectedInspection.items || []).map((item: unknown, idx: number) => {
                const dviItem = item as DVIItem;
                return (
                  <Card key={dviItem.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm flex items-center gap-2">
                            {dviItem.reparado ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                            {dviItem.descripcion || dviItem.tipo}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            Tipo: {dviItem.tipo} — {idx + 1} de {(selectedInspection.items || []).length}
                          </CardDescription>
                        </div>
                        <Badge className={cn("text-[10px] border", gravedadColors[dviItem.gravedad] || "")}>
                          {dviItem.gravedad}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <BeforeAfterSlider
                        before={dviItem.fotoBefore}
                        after={dviItem.fotoAfter}
                        label={`${dviItem.tipo} — ${dviItem.descripcion || "Sin descripción"}`}
                      />
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[10px] text-muted-foreground">
                          {dviItem.reparado ? "✅ Reparado" : "⏳ Pendiente de reparación"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Gallery of photos */}
          {selectedExtended?.fotos && selectedExtended.fotos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ImagePlus className="h-4 w-4" />
                  Galería de Fotos ({selectedExtended.fotos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {selectedExtended.fotos.map((foto: DVIIPhoto) => (
                    <div key={foto.id} className="group relative aspect-square rounded-lg overflow-hidden bg-muted">
                      <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                        <Camera className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <ZoomIn className="h-5 w-5 text-white" />
                      </div>
                      <span className="absolute bottom-1 left-1 text-[8px] bg-black/60 text-white px-1 py-0.5 rounded">
                        {foto.label || foto.tipo}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* ── Grid View ────────────────────────── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((insp) => {
            const items = (insp as any).items || [];
            const hasBeforeAfter = items.some((i: DVIItem) => i.fotoBefore || i.fotoAfter);
            const severityCounts = { LEVE: 0, MODERADO: 0, SEVERO: 0 };
            items.forEach((i: DVIItem) => {
              if (severityCounts[i.gravedad] !== undefined) severityCounts[i.gravedad]++;
            });

            return (
              <Card
                key={insp.id}
                className={cn(
                  "transition-all duration-200 cursor-pointer",
                  "hover:shadow-md hover:border-foreground/20 hover:-translate-y-0.5",
                )}
                onClick={() => handleOpenCompare(insp)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">DVI-{insp.id.slice(0, 8)}</CardTitle>
                    <Badge variant={statusVariant[insp.status] ?? "secondary"} className="text-[10px]">
                      {insp.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Vehículo: {insp.vehicleId.slice(0, 8)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Health Score */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground uppercase">Health Score</span>
                        <span className={cn(
                          "text-xs font-bold",
                          insp.healthScore >= 70 ? "text-emerald-500" :
                          insp.healthScore >= 40 ? "text-amber-500" : "text-red-500",
                        )}>
                          {insp.healthScore}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            insp.healthScore >= 70 ? "bg-emerald-500" :
                            insp.healthScore >= 40 ? "bg-amber-500" : "bg-red-500",
                          )}
                          style={{ width: `${insp.healthScore}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Severity badges */}
                  {items.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {severityCounts.SEVERO > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 border border-red-300">
                          {severityCounts.SEVERO} severo{severityCounts.SEVERO > 1 ? "s" : ""}
                        </span>
                      )}
                      {severityCounts.MODERADO > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-300">
                          {severityCounts.MODERADO} moderado{severityCounts.MODERADO > 1 ? "s" : ""}
                        </span>
                      )}
                      {severityCounts.LEVE > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-300">
                          {severityCounts.LEVE} leve{severityCounts.LEVE > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {hasBeforeAfter && (
                      <span className="flex items-center gap-0.5 text-blue-500">
                        <ArrowLeftRight className="h-3 w-3" />
                        Before/After
                      </span>
                    )}
                    <span>{new Date(insp.createdAt).toLocaleDateString("es-PY")}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
