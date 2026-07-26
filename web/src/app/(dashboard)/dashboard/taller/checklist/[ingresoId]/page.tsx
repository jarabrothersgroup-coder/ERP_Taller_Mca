"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Car,
  CircleDot,
  Fuel,
  Wrench,
  PenTool,
  Trash2,
  Save,
  AlertTriangle,
  Camera,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/* ── Types ──────────────────────────────────── */

type PanelEstado = "BUENO" | "RAYADO" | "ABOLLADO" | "ROTO" | "ABOLLADO_RAYADO";

interface PanelState {
  estado: PanelEstado;
  fotoUrl?: string;
  observaciones?: string;
}

interface RecepcionChecklist {
  panels: Record<string, PanelState>;
  neumaticos: Record<string, string>;
  nivelCombustibleExacto: number;
  kilometrajeFoto: boolean;
  accesorios: {
    gato: boolean;
    triangulos: boolean;
    extintor: boolean;
    ruedaRepuesto: boolean;
    herramientas: boolean;
    manual: boolean;
    radioCodigo?: string;
    otros: string[];
  };
  observacionesCliente?: string;
  firmaCliente?: string;
  firmaClienteNombre?: string;
}

const PANELS = [
  { key: "capot", label: "Capot", x: 200, y: 60, w: 120, h: 40 },
  { key: "paragolpesDel", label: "Paragolpes Del.", x: 190, y: 20, w: 140, h: 30 },
  { key: "paragolpesTras", label: "Paragolpes Tras.", x: 190, y: 260, w: 140, h: 30 },
  { key: "puertaDelIzq", label: "Puerta Del. Izq.", x: 110, y: 90, w: 70, h: 70 },
  { key: "puertaDelDer", label: "Puerta Del. Der.", x: 340, y: 90, w: 70, h: 70 },
  { key: "puertaTrasIzq", label: "Puerta Tras. Izq.", x: 110, y: 170, w: 70, h: 70 },
  { key: "puertaTrasDer", label: "Puerta Tras. Der.", x: 340, y: 170, w: 70, h: 70 },
  { key: "techo", label: "Techo", x: 200, y: 120, w: 120, h: 70 },
  { key: "maletero", label: "Maletero", x: 200, y: 200, w: 120, h: 50 },
  { key: "espejoIzq", label: "Espejo Izq.", x: 80, y: 100, w: 25, h: 30 },
  { key: "espejoDer", label: "Espejo Der.", x: 415, y: 100, w: 25, h: 30 },
];

const ESTADO_COLORS: Record<PanelEstado, { fill: string; stroke: string; text: string }> = {
  BUENO: { fill: "#dcfce7", stroke: "#16a34a", text: "Bueno" },
  RAYADO: { fill: "#fef9c3", stroke: "#ca8a04", text: "Rayado" },
  ABOLLADO: { fill: "#ffedd5", stroke: "#ea580c", text: "Abollado" },
  ROTO: { fill: "#fee2e2", stroke: "#dc2626", text: "Roto" },
  ABOLLADO_RAYADO: { fill: "#fed7aa", stroke: "#c2410c", text: "Abollado + Rayado" },
};

const ESTADOS_LIST: PanelEstado[] = ["BUENO", "RAYADO", "ABOLLADO", "ROTO", "ABOLLADO_RAYADO"];

/* ── Default State ──────────────────────────── */

function getDefaultChecklist(): RecepcionChecklist {
  const panels: Record<string, PanelState> = {};
  PANELS.forEach((p) => {
    panels[p.key] = { estado: "BUENO" };
  });
  return {
    panels,
    neumaticos: { delIzq: "", delDer: "", trasIzq: "", trasDer: "", repuesto: "" },
    nivelCombustibleExacto: 0.5,
    kilometrajeFoto: false,
    accesorios: {
      gato: false,
      triangulos: false,
      extintor: false,
      ruedaRepuesto: false,
      herramientas: false,
      manual: false,
      radioCodigo: "",
      otros: [],
    },
    observacionesCliente: "",
  };
}

/* ── Fuel Gauge Component ───────────────────── */

function FuelGauge({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = Math.round(value * 100);
  const color = pct > 60 ? "text-green-500" : pct > 30 ? "text-yellow-500" : "text-red-500";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fuel className={cn("h-5 w-5", color)} />
          <span className="text-sm font-medium">Combustible: {pct}%</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {pct <= 10 ? "Vacío" : pct <= 30 ? "Bajo" : pct <= 60 ? "Medio" : pct <= 90 ? "Bueno" : "Lleno"}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-3 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

/* ── Signature Canvas Component ─────────────── */

function SignatureCanvas({ onSave }: { onSave: (data: string) => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [hasDrawn, setHasDrawn] = React.useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    setIsDrawing(true);
    setHasDrawn(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasDrawn) {
      onSave(canvas.toDataURL("image/png"));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSave("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Firma del Cliente</label>
        <Button type="button" variant="ghost" size="sm" onClick={clearCanvas} className="h-7 text-xs">
          <Trash2 className="h-3 w-3 mr-1" /> Limpiar
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={160}
        className="w-full border-2 border-dashed rounded-lg bg-white dark:bg-gray-900 touch-none cursor-crosshair min-h-[120px]"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <p className="text-xs text-muted-foreground text-center">Firme con el mouse o dedo en el área superior</p>
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function ChecklistPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();
  const ingresoId = params?.ingresoId as string;
  if (!ingresoId) return null;

  const [step, setStep] = React.useState(0); // 0=Exterior, 1=Detalles, 2=Firma
  const [checklist, setChecklist] = React.useState<RecepcionChecklist>(getDefaultChecklist());
  const [selectedPanel, setSelectedPanel] = React.useState<string | null>(null);
  const [clienteNombre, setClienteNombre] = React.useState("");

  // G-01: Photo gallery
  const [fotos, setFotos] = React.useState<Array<{ name: string; path: string; size: number }>>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load existing checklist
  const { data: existing } = useQuery<RecepcionChecklist>({
    queryKey: ["checklist", ingresoId],
    queryFn: () => api.request(`/workshop/ingresos/${ingresoId}/checklist`),
    retry: false,
  });

  React.useEffect(() => {
    if (existing) {
      setChecklist(existing);
      if (existing.firmaClienteNombre) setClienteNombre(existing.firmaClienteNombre);
    }
  }, [existing]);

  // G-01: Load existing photos
  React.useEffect(() => {
    if (!ingresoId) return;
    api.request(`/workshop/ingresos/${ingresoId}/fotos`).then((data: any) => setFotos(Array.isArray(data) ? data : [])).catch(() => {});
  }, [ingresoId]);

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !ingresoId) return;
    const formData = new FormData();
    formData.append("file", file);
    await fetch(`/workshop/ingresos/${ingresoId}/fotos`, {
      method: "POST",
      headers: { "X-Tenant-Slug": "demo" },
      body: formData,
    });
    const data = await api.request(`/workshop/ingresos/${ingresoId}/fotos`);
    setFotos(Array.isArray(data) ? data : []);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deletePhoto = async (photoName: string) => {
    if (!ingresoId) return;
    const photoId = photoName.split(".")[0];
    await api.request(`/workshop/ingresos/${ingresoId}/fotos/${photoId}`, { method: "DELETE" });
    setFotos((prev) => prev.filter((f) => f.name !== photoName));
  };

  // Save mutation
  const saveMut = useMutation({
    mutationFn: async () => {
      return api.request(`/workshop/ingresos/${ingresoId}/checklist`, {
        method: "POST",
        body: JSON.stringify({
          ...checklist,
          firmaClienteNombre: clienteNombre || undefined,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist", ingresoId] });
      t.success("Checklist guardado correctamente");
      router.back();
    },
    onError: (err: any) => {
      t.error(err?.message || "Error al guardar checklist");
    },
  });

  const updatePanel = (key: string, estado: PanelEstado) => {
    setChecklist((prev) => ({
      ...prev,
      panels: { ...prev.panels, [key]: { ...prev.panels[key], estado } },
    }));
    setSelectedPanel(null);
  };

  const updateAccesorio = (key: keyof RecepcionChecklist["accesorios"], value: boolean) => {
    setChecklist((prev) => ({
      ...prev,
      accesorios: { ...prev.accesorios, [key]: value },
    }));
  };

  const panelStates = Object.values(checklist.panels);
  const buenosCount = panelStates.filter((p) => p.estado === "BUENO").length;
  const problemasCount = panelStates.filter((p) => p.estado !== "BUENO").length;

  const steps = [
    { label: "Exterior", icon: Car },
    { label: "Detalles", icon: Wrench },
    { label: "Firma", icon: PenTool },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              Checklist de Recepción
            </h1>
            <p className="text-sm text-muted-foreground">
              Documente el estado del vehículo al momento de ingreso
            </p>
          </div>
          {existing && (
            <Badge className="bg-green-100 text-green-800 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Ya completado
            </Badge>
          )}
        </div>
      </div>

      {/* Progress Steps — larger touch targets on mobile */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <button
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all min-h-[44px]",
                step === i
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : step > i
                    ? "bg-green-50 text-green-600 dark:bg-green-900/20"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {step > i ? <CheckCircle2 className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-1 rounded-full", step > i ? "bg-green-300" : "bg-muted")} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* STEP 0: Exterior del Vehículo */}
      {/* ═══════════════════════════════════════ */}
      {step === 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Estado del Exterior — Toca un panel para marcar</span>
                <div className="flex gap-2 text-xs">
                  <Badge className="bg-green-100 text-green-700">{buenosCount} OK</Badge>
                  {problemasCount > 0 && (
                    <Badge className="bg-amber-100 text-amber-700">{problemasCount} con daño</Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Car SVG */}
              <div className="flex justify-center">
                <svg viewBox="0 0 520 310" className="w-full max-w-md">
                  {/* Car body outline */}
                  <rect x={100} y={40} width={340} height={240} rx={30} ry={30}
                    fill="none" stroke="#d1d5db" strokeWidth={2} />

                  {/* Clickable panels */}
                  {PANELS.map((panel) => {
                    const state = checklist.panels[panel.key];
                    const colors = ESTADO_COLORS[state?.estado || "BUENO"];
                    const isSelected = selectedPanel === panel.key;
                    return (
                      <g key={panel.key}>
                        <rect
                          x={panel.x}
                          y={panel.y}
                          width={panel.w}
                          height={panel.h}
                          rx={6}
                          fill={colors.fill}
                          stroke={isSelected ? "#2563eb" : colors.stroke}
                          strokeWidth={isSelected ? 3 : 1.5}
                          className="cursor-pointer transition-all hover:opacity-80"
                          onClick={() => setSelectedPanel(isSelected ? null : panel.key)}
                        />
                        <text
                          x={panel.x + panel.w / 2}
                          y={panel.y + panel.h / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="pointer-events-none"
                          fontSize={9}
                          fill="#374151"
                          fontWeight={500}
                        >
                          {panel.label}
                        </text>
                        {state?.estado !== "BUENO" && (
                          <circle
                            cx={panel.x + panel.w - 6}
                            cy={panel.y + 6}
                            r={5}
                            fill={colors.stroke}
                            className="pointer-events-none"
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Wheels */}
                  <rect x={70} y={80} width={25} height={50} rx={5} fill="#374151" />
                  <rect x={425} y={80} width={25} height={50} rx={5} fill="#374151" />
                  <rect x={70} y={190} width={25} height={50} rx={5} fill="#374151" />
                  <rect x={425} y={190} width={25} height={50} rx={5} fill="#374151" />
                </svg>
              </div>

              {/* Panel selector dropdown */}
              {selectedPanel && (
                <div className="mt-4 p-4 border rounded-lg bg-accent/30 space-y-3">
                  <p className="text-sm font-medium">
                    Panel: {PANELS.find((p) => p.key === selectedPanel)?.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ESTADOS_LIST.map((estado) => {
                      const colors = ESTADO_COLORS[estado];
                      return (
                        <button
                          key={estado}
                          onClick={() => updatePanel(selectedPanel, estado)}
                          className={cn(
                            "px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                            checklist.panels[selectedPanel]?.estado === estado
                              ? "ring-2 ring-blue-500"
                              : "hover:ring-1 hover:ring-gray-300"
                          )}
                          style={{ backgroundColor: colors.fill, borderColor: colors.stroke }}
                        >
                          {colors.text}
                        </button>
                      );
                    })}
                  </div>
                  <FormField label="Observaciones del panel" htmlFor="panelObs">
                    <Input
                      id="panelObs"
                      value={checklist.panels[selectedPanel]?.observaciones || ""}
                      onChange={(e) =>
                        setChecklist((prev) => ({
                          ...prev,
                          panels: {
                            ...prev.panels,
                            [selectedPanel]: {
                              ...prev.panels[selectedPanel],
                              observaciones: e.target.value,
                            },
                          },
                        }))
                      }
                      placeholder="Ej: Rayón pequeño en la esquina..."
                    />
                  </FormField>
                </div>
              )}

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-3 justify-center">
                {ESTADOS_LIST.map((estado) => {
                  const colors = ESTADO_COLORS[estado];
                  return (
                    <div key={estado} className="flex items-center gap-1.5 text-xs">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.fill, border: `1px solid ${colors.stroke}` }} />
                      <span>{colors.text}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => setStep(1)}>
              Siguiente: Detalles <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* STEP 1: Neumáticos, Combustible, Accesorios */}
      {/* ═══════════════════════════════════════ */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Neumáticos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CircleDot className="h-4 w-4" /> Estado de Neumáticos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(checklist.neumaticos).map(([key, val]) => {
                  const labels: Record<string, string> = {
                    delIzq: "Delantero Izquierdo",
                    delDer: "Delantero Derecho",
                    trasIzq: "Trasero Izquierdo",
                    trasDer: "Trasero Derecho",
                    repuesto: "Repuesto",
                  };
                  return (
                    <FormField key={key} label={labels[key] || key} htmlFor={`neu-${key}`}>
                      <Input
                        id={`neu-${key}`}
                        value={val}
                        onChange={(e) =>
                          setChecklist((prev) => ({
                            ...prev,
                            neumaticos: { ...prev.neumaticos, [key]: e.target.value },
                          }))
                        }
                        placeholder="Ej: 32 PSI, Buen estado"
                      />
                    </FormField>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Combustible */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Fuel className="h-4 w-4" /> Nivel de Combustible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FuelGauge
                value={checklist.nivelCombustibleExacto}
                onChange={(v) => setChecklist((prev) => ({ ...prev, nivelCombustibleExacto: v }))}
              />
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="km-foto"
                  checked={checklist.kilometrajeFoto}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, kilometrajeFoto: e.target.checked }))}
                  className="h-4 w-4"
                />
                <label htmlFor="km-foto" className="text-sm text-muted-foreground">
                  Se tomó foto del tablero (kilometraje)
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Accesorios */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4" /> Accesorios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { key: "gato", label: "Gato" },
                  { key: "triangulos", label: "Triángulos" },
                  { key: "extintor", label: "Extintor" },
                  { key: "ruedaRepuesto", label: "Rueda Repuesto" },
                  { key: "herramientas", label: "Herramientas" },
                  { key: "manual", label: "Manual" },
                ].map((item) => (
                  <label
                    key={item.key}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                      checklist.accesorios[item.key as keyof typeof checklist.accesorios]
                        ? "bg-green-50 border-green-300 dark:bg-green-900/20"
                        : "bg-background hover:bg-accent/30"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checklist.accesorios[item.key as keyof typeof checklist.accesorios] as boolean}
                      onChange={(e) => updateAccesorio(item.key as any, e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{item.label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Código de Radio (opcional)" htmlFor="radio-codigo">
                  <Input
                    id="radio-codigo"
                    value={checklist.accesorios.radioCodigo || ""}
                    onChange={(e) =>
                      setChecklist((prev) => ({
                        ...prev,
                        accesorios: { ...prev.accesorios, radioCodigo: e.target.value },
                      }))
                    }
                    placeholder="Ej: 1234"
                  />
                </FormField>
              </div>
              <div className="mt-4">
                <FormField label="Observaciones del Cliente" htmlFor="obs-cliente">
                  <Textarea
                    id="obs-cliente"
                    value={checklist.observacionesCliente || ""}
                    onChange={(e) => setChecklist((prev) => ({ ...prev, observacionesCliente: e.target.value }))}
                    placeholder="Notas adicionales del cliente sobre el vehículo..."
                    rows={3}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Exterior
            </Button>
            <Button onClick={() => setStep(2)}>
              Siguiente: Firma <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* STEP 2: Firma del Cliente */}
      {/* ═══════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <PenTool className="h-4 w-4" /> Conformidad del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-300">Importante</p>
                  <p className="text-amber-700 dark:text-amber-400">
                    El cliente debe firmar para confirmar que el estado documentado del vehículo es correcto.
                    Esta firma protege al taller de disputas por daños preexistentes.
                  </p>
                </div>
              </div>

              <FormField label="Nombre del Cliente" htmlFor="cliente-nombre">
                <Input
                  id="cliente-nombre"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Nombre completo del cliente"
                />
              </FormField>

              <SignatureCanvas
                onSave={(data) =>
                  setChecklist((prev) => ({ ...prev, firmaCliente: data }))
                }
              />

              {/* Summary */}
              <div className="border rounded-lg p-4 space-y-2 bg-accent/20">
                <p className="text-sm font-medium">Resumen del Checklist:</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>Paneles con daño: {problemasCount}</div>
                  <div>Combustible: {Math.round(checklist.nivelCombustibleExacto * 100)}%</div>
                  <div>Accesorios: {Object.values(checklist.accesorios).filter((v) => typeof v === "boolean" && v).length} de 6</div>
                  <div>Firma: {checklist.firmaCliente ? "Capturada" : "Pendiente"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Detalles
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={!clienteNombre.trim() || !checklist.firmaCliente || saveMut.isPending}
              loading={saveMut.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4 mr-1" />
              Guardar Checklist
            </Button>
          </div>
        </div>
      )}

      {ToastContainer}

      {/* G-01: Photo Gallery */}
      <div className="space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Fotos del Vehículo
          </h3>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={uploadPhoto}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4 mr-1" /> Agregar Foto
            </Button>
          </div>
        </div>
        {fotos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay fotos registradas para este ingreso.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {fotos.map((foto, idx) => (
              <div key={idx} className="relative group rounded-lg border overflow-hidden">
                <img
                  src={`/uploads/${foto.path}`}
                  alt={foto.name}
                  className="w-full h-32 object-cover"
                />
                <div className="absolute top-1 right-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deletePhoto(foto.name)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="px-2 py-1 text-xs text-muted-foreground truncate">{foto.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
