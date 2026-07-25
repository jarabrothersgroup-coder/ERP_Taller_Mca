"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import {
  Search,
  Car,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  Fuel,
  Gauge,
  RotateCcw,
  ChevronRight,
  PenLine,
  QrCode,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────── */

type PanelKey = "capot" | "paragolpesDel" | "paragolpesTras" | "puertaDelIzq" | "puertaDelDer" | "puertaTrasIzq" | "puertaTrasDer" | "maletero" | "techo" | "espejoIzq" | "espejoDer";

type PanelEstado = "BUENO" | "RAYADO" | "ABOLLADO" | "ROTO" | "ABOLLADO_RAYADO";

interface PanelState {
  estado: PanelEstado;
  observaciones?: string;
}

const PANEL_LABELS: Record<PanelKey, string> = {
  capot: "Capot",
  paragolpesDel: "Paragolpes Delantero",
  paragolpesTras: "Paragolpes Trasero",
  puertaDelIzq: "Puerta Delantera Izquierda",
  puertaDelDer: "Puerta Delantera Derecha",
  puertaTrasIzq: "Puerta Trasera Izquierda",
  puertaTrasDer: "Puerta Trasera Derecha",
  maletero: "Maletero",
  techo: "Techo",
  espejoIzq: "Espejo Izquierdo",
  espejoDer: "Espejo Derecho",
};

const PANEL_ESTADOS: { value: PanelEstado; label: string; color: string }[] = [
  { value: "BUENO", label: "Bueno", color: "bg-green-100 text-green-800 border-green-300" },
  { value: "RAYADO", label: "Rayado", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "ABOLLADO", label: "Abollado", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { value: "ROTO", label: "Roto", color: "bg-red-100 text-red-800 border-red-300" },
  { value: "ABOLLADO_RAYADO", label: "Abollado + Rayado", color: "bg-red-100 text-red-800 border-red-300" },
];

/* ── Signature Pad Component ────────────────── */

function SignaturePad({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative border rounded-lg overflow-hidden bg-white">
        {!value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <PenLine className="h-6 w-6 text-muted-foreground/30" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      {value && (
        <Button variant="ghost" size="sm" onClick={clear} className="text-xs">
          <RotateCcw className="h-3 w-3 mr-1" /> Limpiar
        </Button>
      )}
    </div>
  );
}

/* ── Panel Selector Component ───────────────── */

function PanelSelector({ panels, onChange }: { panels: Record<PanelKey, PanelState>; onChange: (key: PanelKey, state: PanelState) => void }) {
  const panelKeys = Object.keys(PANEL_LABELS) as PanelKey[];
  const damagedCount = panelKeys.filter((k) => panels[k]?.estado !== "BUENO").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Estado Exterior por Panel</p>
        {damagedCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {damagedCount} daño{damagedCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      <div className="grid gap-2">
        {panelKeys.map((key) => (
          <div key={key} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent/50 transition-colors">
            <span className="text-xs font-medium w-40">{PANEL_LABELS[key]}</span>
            <div className="flex gap-1 flex-wrap">
              {PANEL_ESTADOS.map((estado) => (
                <button
                  key={estado.value}
                  type="button"
                  onClick={() => onChange(key, { ...panels[key], estado: estado.value })}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all",
                    panels[key]?.estado === estado.value
                      ? estado.color + " ring-1 ring-offset-1"
                      : "bg-transparent text-muted-foreground border-transparent hover:border-muted-foreground/20"
                  )}
                >
                  {estado.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function RecepcionPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = React.useState(1); // 1=vehículo, 2=checklist, 3=firma, 4=resumen
  
  // Step 1: vehicle selection
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = React.useState<string | null>(null);
  const [selectedPlate, setSelectedPlate] = React.useState("");
  const [selectedVehicleName, setSelectedVehicleName] = React.useState("");
  const [selectedClientName, setSelectedClientName] = React.useState("");
  const [kilometraje, setKilometraje] = React.useState<number>(0);
  const [descripcionTrabajo, setDescripcionTrabajo] = React.useState("");
  const [crearOrden, setCrearOrden] = React.useState(true);
  
  // Step 2: checklist
  const [panels, setPanels] = React.useState<Record<PanelKey, PanelState>>(() => {
    const initial = {} as Record<PanelKey, PanelState>;
    (Object.keys(PANEL_LABELS) as PanelKey[]).forEach((k) => { initial[k] = { estado: "BUENO" }; });
    return initial;
  });
  const [neumaticos, setNeumaticos] = React.useState({ delIzq: "", delDer: "", trasIzq: "", trasDer: "", repuesto: "" });
  const [nivelCombustible, setNivelCombustible] = React.useState(0.5);
  const [accesorios, setAccesorios] = React.useState({
    gato: false, triangulos: false, extintor: false,
    ruedaRepuesto: false, herramientas: false, manual: false,
  });
  const [observacionesCliente, setObservacionesCliente] = React.useState("");
  
  // Step 3: f signature
  const [firmaCliente, setFirmaCliente] = React.useState("");
  const [firmaNombre, setFirmaNombre] = React.useState("");
  
  // Result
  const [ingresoId, setIngresoId] = React.useState<string | null>(null);
  const [ordenId, setOrdenId] = React.useState<string | null>(null);

  // G-01: Photo capture state
  const [fotos, setFotos] = React.useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch vehicles for search
  const { data: vehicles = [], isLoading: vLoading } = useQuery({
    queryKey: ["vehicles-search"],
    queryFn: () => api.listVehicles({ limit: 50 }),
  });

  // Filter vehicles by search
  const filteredVehicles = React.useMemo(() => {
    if (!searchTerm) return vehicles;
    const q = searchTerm.toLowerCase();
    return (vehicles as any[]).filter((v: any) =>
      (v.plate?.toLowerCase().includes(q)) ||
      (v.brand?.toLowerCase().includes(q)) ||
      (v.model?.toLowerCase().includes(q)) ||
      (v.clientName?.toLowerCase().includes(q))
    );
  }, [vehicles, searchTerm]);

  // Create ingreso mutation
  const createIngresoMut = useMutation({
    mutationFn: () => api.createIngreso({
      vehicleId: selectedVehicleId!,
      kilometraje,
      descripcionTrabajo: descripcionTrabajo || undefined,
      crearOrden,
    }),
    onSuccess: (data: any) => {
      setIngresoId(data.ingreso?.id);
      setOrdenId(data.ordenTrabajo?.id);
      setStep(2);
    },
  });

  // Save checklist mutation
  const saveChecklistMut = useMutation({
    mutationFn: async () => {
      // Upload photos first if any (use raw fetch for multipart)
      if (ingresoId && fotos.length > 0) {
        for (const foto of fotos) {
          const formData = new FormData();
          formData.append("file", foto.file);
          await api.request(`/workshop/ingresos/${ingresoId}/fotos`, {
            method: "POST",
            headers: { "Content-Type": "" },
            body: formData,
          } as any);
        }
      }
      // Then save checklist
      return api.request("/workshop/ingresos/" + ingresoId + "/checklist", {
        method: "POST",
        body: JSON.stringify({
          panels,
          neumaticos,
          nivelCombustibleExacto: nivelCombustible,
          kilometrajeFoto: fotos.length > 0,
          accesorios,
          observacionesCliente: observacionesCliente || undefined,
          firmaCliente: firmaCliente || undefined,
          firmaClienteNombre: firmaNombre || undefined,
        }),
      });
    },
    onSuccess: () => setStep(4),
  });

  const handleSelectVehicle = (v: any) => {
    setSelectedVehicleId(v.id);
    setSelectedPlate(v.plate || "");
    setSelectedVehicleName(`${v.brand} ${v.model} (${v.year || "s/a"})`);
    setSelectedClientName(v.clientName || v.clientId || "");
    setKilometraje(v.kilometraje || 0);
  };

  const handleSubmitIngreso = () => {
    if (!selectedVehicleId) return;
    createIngresoMut.mutate();
  };

  // G-01: Photo upload handlers
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFotos: { file: File; preview: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) continue; // 10MB max
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) continue;
      newFotos.push({ file, preview: URL.createObjectURL(file) });
    }
    setFotos((prev) => [...prev, ...newFotos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFoto = (index: number) => {
    setFotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmitChecklist = () => {
    if (!firmaCliente) {
      // TODO: migrate to useToast when refactoring
      alert("La firma del cliente es requerida para completar la recepción");
      return;
    }
    saveChecklistMut.mutate();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      {/* ── Header ─────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-blue-500" />
            Recepción de Vehículo
          </h1>
          <p className="text-sm text-muted-foreground">
            Ingreso estructurado con checklist visual y firma digital
          </p>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                "h-2 w-8 rounded-full transition-colors",
                step >= s ? "bg-blue-500" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════ */}
      {/* STEP 1: Vehicle Selection */}
      {/* ═══════════════════════════════════ */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                Buscar Vehículo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Buscar por placa, marca, modelo o cliente…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
              
              {vLoading ? (
                <p className="text-sm text-muted-foreground">Cargando vehículos…</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {(filteredVehicles as any[]).map((v: any) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectVehicle(v)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-colors",
                        selectedVehicleId === v.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                          : "hover:bg-accent"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{v.brand} {v.model}</p>
                          <p className="text-xs text-muted-foreground">
                            {v.plate || "sin placa"} · {v.year || "s/a"} · {v.engineType || "Nafta"}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{v.clientName || "—"}</p>
                          <p>{v.kilometraje?.toLocaleString("es-PY") || "0"} km</p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {(filteredVehicles as any[]).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No se encontraron vehículos
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedVehicleId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Vehículo Seleccionado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-accent/50 p-3">
                  <p className="font-semibold">{selectedVehicleName}</p>
                  <p className="text-sm text-muted-foreground">Placa: {selectedPlate}</p>
                  <p className="text-sm text-muted-foreground">Cliente: {selectedClientName}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Kilometraje actual" htmlFor="km">
                    <div className="relative">
                      <Input
                        id="km"
                        type="number"
                        value={kilometraje}
                        onChange={(e) => setKilometraje(Number(e.target.value))}
                      />
                      <Gauge className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  </FormField>
                  <FormField label="Nivel de Combustible" htmlFor="fuel">
                    <div className="flex items-center gap-2">
                      <input
                        id="fuel"
                        type="range"
                        min="0"
                        max="1"
                        step="0.125"
                        value={nivelCombustible}
                        onChange={(e) => setNivelCombustible(Number(e.target.value))}
                        className="flex-1"
                      />
                      <Fuel className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs font-mono w-8">{(nivelCombustible * 100).toFixed(0)}%</span>
                    </div>
                  </FormField>
                </div>

                <FormField label="Descripción del Trabajo" htmlFor="desc">
                  <Textarea
                    id="desc"
                    placeholder="Describa el motivo de la visita o el trabajo solicitado…"
                    value={descripcionTrabajo}
                    onChange={(e) => setDescripcionTrabajo(e.target.value)}
                    rows={2}
                  />
                </FormField>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={crearOrden}
                    onChange={(e) => setCrearOrden(e.target.checked)}
                    className="rounded"
                  />
                  Crear orden de trabajo automáticamente
                </label>

                <Button
                  className="w-full"
                  onClick={handleSubmitIngreso}
                  loading={createIngresoMut.isPending}
                >
                  {createIngresoMut.isPending ? "Registrando ingreso…" : "Registrar Ingreso y Continuar →"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════ */}
      {/* STEP 2: Checklist */}
      {/* ═══════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-4">
          {/* G-03: QR Code display */}
          {ingresoId && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-4">
                  <img
                    src={`/workshop/ingresos/${ingresoId}/qr`}
                    alt="QR del Ingreso"
                    className="w-24 h-24 border rounded-lg"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <QrCode className="h-4 w-4" />
                      QR del Ingreso
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Escanee para identificar este ingreso rápidamente
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/workshop/ingresos/${ingresoId}/qr`, "_blank")}
                  >
                    Imprimir
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* G-01: Photo capture section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-4 w-4 text-blue-500" />
                Fotos del Vehículo
                {fotos.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{fotos.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Capture el estado del vehículo al momento de recepción. Formatos: JPG, PNG, WEBP (máx. 10MB).
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                capture="environment"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5" /> Tomar Foto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute("capture");
                      fileInputRef.current.click();
                      setTimeout(() => fileInputRef.current?.setAttribute("capture", "environment"), 100);
                    }
                  }}
                >
                  <ImageIcon className="h-3.5 w-3.5 mr-1.5" /> Subir Foto
                </Button>
              </div>
              {fotos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {fotos.map((foto, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border">
                      <img src={foto.preview} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFoto(idx)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Checklist de Recepción
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Panels */}
              <PanelSelector panels={panels} onChange={(key, state) => setPanels((p) => ({ ...p, [key]: state }))} />

              {/* Neumáticos */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Estado de Neumáticos</p>
                {["delIzq", "delDer", "trasIzq", "trasDer", "repuesto"].map((pos) => (
                  <div key={pos} className="flex items-center gap-2">
                    <span className="text-xs w-24 capitalize">{pos === "delIzq" ? "Del. Izq" : pos === "delDer" ? "Del. Der" : pos === "trasIzq" ? "Tras. Izq" : pos === "trasDer" ? "Tras. Der" : "Repuesto"}</span>
                    <Input
                      placeholder="Presión y condición"
                      value={(neumaticos as any)[pos]}
                      onChange={(e) => setNeumaticos((n: any) => ({ ...n, [pos]: e.target.value }))}
                      className="text-sm h-8"
                    />
                  </div>
                ))}
              </div>

              {/* Accesorios */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Accesorios</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(accesorios).map(([key, val]) => (
                    <label key={key} className="flex items-center gap-2 text-sm p-2 rounded-lg border hover:bg-accent/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={() => setAccesorios((a: any) => ({ ...a, [key]: !val }))}
                      />
                      {key === "gato" ? "Gato" : key === "triangulos" ? "Triángulos" : key === "extintor" ? "Extintor" : key === "ruedaRepuesto" ? "Rueda Repuesto" : key === "herramientas" ? "Herramientas" : "Manual"}
                    </label>
                  ))}
                </div>
              </div>

              <FormField label="Observaciones del Cliente" htmlFor="obs">
                <Textarea
                  id="obs"
                  placeholder="El cliente reportó algún problema adicional…"
                  value={observacionesCliente}
                  onChange={(e) => setObservacionesCliente(e.target.value)}
                  rows={2}
                />
              </FormField>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  ← Volver
                </Button>
                <Button onClick={() => setStep(3)}>
                  Continuar a Firma →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════ */}
      {/* STEP 3: Firma Digital */}
      {/* ═══════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PenLine className="h-4 w-4" />
                Firma Digital del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                El cliente debe firmar para confirmar que el vehículo fue recibido
                en el estado descrito en el checklist.
              </p>

              <FormField label="Nombre del Cliente" htmlFor="fn">
                <Input
                  id="fn"
                  value={firmaNombre}
                  onChange={(e) => setFirmaNombre(e.target.value)}
                  placeholder="Nombre completo"
                />
              </FormField>

              <SignaturePad value={firmaCliente} onChange={setFirmaCliente} label="Firma" />

              {firmaCliente && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Firma capturada correctamente
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  ← Volver al Checklist
                </Button>
                <Button onClick={handleSubmitChecklist} loading={saveChecklistMut.isPending}>
                  {saveChecklistMut.isPending ? "Guardando…" : "Completar Recepción"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════ */}
      {/* STEP 4: Resumen */}
      {/* ═══════════════════════════════════ */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Recepción Completada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-950 p-4">
              <p className="text-sm">El vehículo fue registrado correctamente.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Vehículo</p>
                <p className="font-medium">{selectedVehicleName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Placa</p>
                <p className="font-medium">{selectedPlate}</p>
              </div>
              {ordenId && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Orden de Trabajo</p>
                  <p className="font-mono text-xs">{ordenId}</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => router.push("/dashboard/taller")}>
                Ir a Taller
              </Button>
              <Button variant="outline" onClick={() => {
                setStep(1);
                setSelectedVehicleId(null);
                setIngresoId(null);
                setOrdenId(null);
                setFirmaCliente("");
              }}>
                Nueva Recepción
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
