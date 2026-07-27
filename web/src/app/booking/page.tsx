"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

const SERVICE_LABELS: Record<string, string> = {
  RAPIDO: "Mantenimiento Rápido",
  PESADO: "Reparación General / Pesado",
};

const SERVICE_ICONS: Record<string, string> = {
  RAPIDO: "🚗",
  PESADO: "🔧",
};

const SERVICE_TIMES: Record<string, string> = {
  RAPIDO: "~1 hora",
  PESADO: "~4 horas",
};

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  RAPIDO: "Cambio de aceite, filtros, frenos, líquidos y revisión básica",
  PESADO: "Motor, transmisión, suspensión, diagnosis DTC y reparaciones mayores",
};

interface BookingState {
  servicio: string | null;
  fecha: string | null;
  hora: string | null;
  nombre: string;
  telefono: string;
  email: string;
  patente: string;
  marca: string;
  modelo: string;
  notas: string;
}

export default function BookingPage() {
  const [step, setStep] = React.useState(1);
  const [booking, setBooking] = React.useState<BookingState>({
    servicio: null, fecha: null, hora: null,
    nombre: "", telefono: "", email: "", patente: "", marca: "", modelo: "", notas: "",
  });
  const [availableSlots, setAvailableSlots] = React.useState<string[]>([]);
  const [checkingAvailability, setCheckingAvailability] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState<{ id: string } | null>(null);
  const [error, setError] = React.useState("");

  // AI Suggestions state
  const [aiSuggestions, setAiSuggestions] = React.useState<{
    time: string;
    score: number;
    reason: string;
    isSweetSpot: boolean;
  }[]>([]);
  const [loadingAi, setLoadingAi] = React.useState(false);

  const today = new Date().toISOString().split("T")[0];

  // ─── Availability Check ────────────────────────────

  React.useEffect(() => {
    if (booking.fecha && booking.servicio) {
      setCheckingAvailability(true);
      setBooking((prev) => ({ ...prev, hora: null }));
      setAvailableSlots([]);

      api
        .request<{ available: boolean; availableSlots?: string[]; reason?: string }>(
          "/scheduling/check-availability",
          {
            method: "POST",
            body: JSON.stringify({
              fecha: booking.fecha,
              hora: "08:00",
              tipoServicio: booking.servicio,
            }),
          },
        )
        .then((data) => {
          setAvailableSlots(data.availableSlots || []);
        })
        .catch(() => {
          const slots: string[] = [];
          for (let h = 8; h < 17; h++) {
            for (let m = 0; m < 60; m += 30) {
              const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              if (booking.fecha === today) {
                const [hh, mm] = time.split(":").map(Number);
                const slotDate = new Date();
                slotDate.setHours(hh, mm, 0, 0);
                if (slotDate > new Date()) slots.push(time);
              } else {
                slots.push(time);
              }
            }
          }
          setAvailableSlots(slots);
        })
        .finally(() => setCheckingAvailability(false));
    }
  }, [booking.fecha, booking.servicio, today]);

  // ─── AI Suggestions (separate effect with telefono dep) ──

  React.useEffect(() => {
    if (booking.fecha && booking.servicio) {
      setAiSuggestions([]);
      setLoadingAi(true);

      api
        .request<{
          suggestions: { time: string; score: number; reason: string; isSweetSpot: boolean }[];
        }>(
          `/scheduling/ai-suggestions?date=${booking.fecha}&tipoServicio=${booking.servicio}${booking.telefono ? `&clientePhone=${encodeURIComponent(booking.telefono)}` : ""}`,
        )
        .then((data) => {
          setAiSuggestions(data.suggestions || []);
        })
        .catch(() => {
          // AI suggestions are optional
        })
        .finally(() => setLoadingAi(false));
    }
  }, [booking.fecha, booking.servicio, booking.telefono, today]);

  // ─── Navigation ────────────────────────────────────────

  const canAdvance = (): boolean => {
    setError("");
    switch (step) {
      case 1: return booking.servicio !== null;
      case 2: return booking.fecha !== null && booking.hora !== null;
      case 3: return booking.nombre.trim().length >= 2 && booking.telefono.trim().length >= 7;
      default: return true;
    }
  };

  const goNext = () => {
    if (!canAdvance()) {
      switch (step) {
        case 1: setError("Seleccioná un tipo de servicio"); break;
        case 2: setError("Seleccioná fecha y horario"); break;
        case 3: setError("Completá nombre y teléfono"); break;
      }
      return;
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  // ─── Submit ────────────────────────────────────────────

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const result = await api.request<{ success: boolean; id: string; message: string }>(
        "/scheduling/appointments",
        {
          method: "POST",
          body: JSON.stringify({
            clienteNombre: booking.nombre,
            clientePhone: booking.telefono,
            clienteEmail: booking.email || undefined,
            vehiculoChapa: booking.patente || "S/P",
            vehiculoMarca: booking.marca || "No especificada",
            vehiculoModelo: booking.modelo || "No especificado",
            fechaTurno: booking.fecha,
            horaTurno: booking.hora,
            tipoServicio: booking.servicio,
            notas: booking.notas || undefined,
          }),
        },
      );
      setSuccess({ id: result.id });
    } catch (err: any) {
      setError(err.message || "No se pudo agendar. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetBooking = () => {
    setBooking({
      servicio: null, fecha: null, hora: null,
      nombre: "", telefono: "", email: "", patente: "", marca: "", modelo: "", notas: "",
    });
    setSuccess(null);
    setError("");
    setStep(1);
  };

  // ─── Render Steps ──────────────────────────────────────

  const renderStepIndicator = () => (
    <div className="flex items-center gap-2 mb-8">
      {[
        { num: 1, label: "Servicio" },
        { num: 2, label: "Fecha" },
        { num: 3, label: "Datos" },
        { num: 4, label: "Confirmar" },
      ].map((s, i) => (
        <React.Fragment key={s.num}>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                step > s.num
                  ? "bg-emerald-500 text-white"
                  : step === s.num
                    ? "bg-blue-600 text-white ring-2 ring-blue-400/50"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {step > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
            </div>
            <span className={cn(
              "text-sm hidden sm:inline",
              step === s.num ? "font-semibold text-foreground" : "text-muted-foreground",
            )}>
              {s.label}
            </span>
          </div>
          {i < 3 && <div className={cn("flex-1 h-px", step > s.num ? "bg-emerald-500" : "bg-border")} />}
        </React.Fragment>
      ))}
    </div>
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("es-PY", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  };

  // ─── Success View ──────────────────────────────────────

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">¡Turno agendado!</h1>
            <p className="text-muted-foreground mb-6">
              Te esperamos el {booking.fecha && formatDate(booking.fecha)} a las{" "}
              <strong className="text-foreground">{booking.hora}</strong>
            </p>
            <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Servicio</span>
                <span className="font-medium">{SERVICE_LABELS[booking.servicio || ""]}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fecha</span>
                <span className="font-medium">{booking.fecha}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hora</span>
                <span className="font-medium text-blue-500">{booking.hora}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nombre</span>
                <span className="font-medium">{booking.nombre}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Recibirás un recordatorio vía WhatsApp antes de tu turno
            </p>
            <Button variant="outline" onClick={resetBooking} className="gap-2">
              <Calendar className="h-4 w-4" />
              Agendar otro turno
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold">AutomotiveOS Workshop</h1>
            <p className="text-[10px] text-muted-foreground">Agendá tu turno en línea — 24/7</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {renderStepIndicator()}

        {/* Error message */}
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive flex items-start gap-2">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Step 1: Service Selection */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold mb-1">¿Qué servicio necesitás?</h2>
            <p className="text-sm text-muted-foreground mb-6">Elegí el tipo de servicio para tu vehículo</p>
            <div className="grid gap-3">
              {["RAPIDO", "PESADO"].map((svc) => (
                <button
                  key={svc}
                  onClick={() => setBooking((p) => ({ ...p, servicio: p.servicio === svc ? null : svc }))}
                  className={cn(
                    "text-left p-4 rounded-xl border transition-all",
                    booking.servicio === svc
                      ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30"
                      : "border-border bg-card hover:border-blue-500/50 hover:bg-accent/50",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{SERVICE_ICONS[svc]}</div>
                    <div className="flex-1">
                      <p className="font-semibold">{SERVICE_LABELS[svc]}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{SERVICE_DESCRIPTIONS[svc]}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{SERVICE_TIMES[svc]}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold mb-1">¿Cuándo querés venir?</h2>
            <p className="text-sm text-muted-foreground mb-6">Elegí un día y horario disponible</p>

            <div className="mb-6">
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block font-medium">
                Fecha
              </label>
              <Input
                type="date"
                min={today}
                value={booking.fecha || today}
                onChange={(e) => setBooking((p) => ({ ...p, fecha: e.target.value }))}
                className="max-w-xs"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block font-medium">
                Horarios disponibles
              </label>

              {/* AI Suggestions banner */}
              {!checkingAvailability && aiSuggestions.length > 0 && !loadingAi && (
                <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                      Horarios recomendados
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aiSuggestions.slice(0, 4).map((s) => (
                      <button
                        key={s.time}
                        onClick={() => setBooking((p) => ({ ...p, hora: s.time }))}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                          booking.hora === s.time
                            ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                            : "bg-white dark:bg-blue-950/50 border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/50",
                          s.isSweetSpot && "ring-2 ring-amber-400/50",
                        )}
                        title={s.reason}
                      >
                        <Sparkles className={cn("h-3 w-3", s.isSweetSpot ? "text-amber-400" : "text-blue-400")} />
                        {s.time}
                        {s.isSweetSpot && (
                          <span className="text-[9px] text-amber-500 font-bold ml-0.5">★</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {aiSuggestions[0] && (
                    <p className="text-[10px] text-muted-foreground mt-1.5 italic">
                      ✨ {aiSuggestions[0].reason}
                    </p>
                  )}
                </div>
              )}

              {checkingAvailability ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Clock className="h-6 w-6 mx-auto mb-2 animate-pulse" />
                  Verificando disponibilidad...
                </div>
              ) : availableSlots.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {availableSlots.map((time) => {
                    const isPast = booking.fecha === today && (() => {
                      const [h, m] = time.split(":").map(Number);
                      const slot = new Date();
                      slot.setHours(h, m, 0, 0);
                      return slot <= new Date();
                    })();
                    const isAiSuggested = aiSuggestions.some((s) => s.time === time);
                    const aiSuggestion = aiSuggestions.find((s) => s.time === time);
                    return (
                      <button
                        key={time}
                        disabled={isPast}
                        onClick={() => setBooking((p) => ({ ...p, hora: time }))}
                        className={cn(
                          "py-2.5 rounded-lg text-sm font-medium border transition-all relative group",
                          isPast && "opacity-25 cursor-not-allowed",
                          booking.hora === time
                            ? "bg-blue-600 text-white border-blue-600"
                            : isAiSuggested
                              ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                              : "bg-card border-border hover:border-blue-500 hover:bg-accent",
                        )}
                      >
                        {time}
                        {isAiSuggested && (
                          <div className="absolute -top-1.5 -right-1.5">
                            <Sparkles className="h-3 w-3 text-blue-400" />
                          </div>
                        )}
                        {/* Tooltip with AI reason */}
                        {isAiSuggested && aiSuggestion && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-popover border text-[10px] text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-sm">
                            {aiSuggestion.reason}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay horarios disponibles para esta fecha</p>
                  <p className="text-xs mt-1">Probá con otra fecha</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Client Info */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold mb-1">Tus datos</h2>
            <p className="text-sm text-muted-foreground mb-6">Completá tu información para el turno</p>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Nombre completo <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="Juan Pérez"
                  value={booking.nombre}
                  onChange={(e) => setBooking((p) => ({ ...p, nombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Teléfono <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="0981 123456"
                  value={booking.telefono}
                  onChange={(e) => setBooking((p) => ({ ...p, telefono: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email (opcional)</label>
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={booking.email}
                  onChange={(e) => setBooking((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Patente (opcional)</label>
                  <Input
                    placeholder="ABC 1234"
                    value={booking.patente}
                    onChange={(e) => setBooking((p) => ({ ...p, patente: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Marca</label>
                  <Input
                    placeholder="Toyota"
                    value={booking.marca}
                    onChange={(e) => setBooking((p) => ({ ...p, marca: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Modelo</label>
                <Input
                  placeholder="Corolla"
                  value={booking.modelo}
                  onChange={(e) => setBooking((p) => ({ ...p, modelo: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notas (opcional)</label>
                <Textarea
                  placeholder="Describí el problema o lo que necesitás..."
                  value={booking.notas}
                  onChange={(e) => setBooking((p) => ({ ...p, notas: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold mb-1">Revisá tu turno</h2>
            <p className="text-sm text-muted-foreground mb-6">Verificá que todo esté correcto antes de confirmar</p>

            <Card className="mb-6">
              <CardContent className="p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Servicio</span>
                  <span className="font-medium">{SERVICE_LABELS[booking.servicio || ""]}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Fecha</span>
                  <span className="font-medium capitalize">{booking.fecha && formatDate(booking.fecha)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Hora</span>
                  <span className="font-medium text-blue-500">{booking.hora}</span>
                </div>
                <hr className="border-border" />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Nombre</span>
                  <span className="font-medium">{booking.nombre}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Teléfono</span>
                  <span className="font-medium">{booking.telefono}</span>
                </div>
                {booking.email && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Email</span>
                    <span className="font-medium">{booking.email}</span>
                  </div>
                )}
                {booking.patente && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Patente</span>
                    <span className="font-medium">{booking.patente}</span>
                  </div>
                )}
                {booking.notas && (
                  <div>
                    <span className="text-muted-foreground text-sm block mb-1">Notas</span>
                    <p className="text-sm bg-muted/50 rounded-lg p-2">{booking.notas}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>Agendando...</>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Confirmar Turno
                </>
              )}
            </Button>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8">
          {step > 1 ? (
            <Button variant="outline" onClick={goBack} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Atrás
            </Button>
          ) : <div />}
          {step < 4 && (
            <Button onClick={goNext} className="gap-2">
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground mt-12 py-6 border-t">
          Powered by <span className="font-medium text-foreground">AutomotiveOS</span>
        </footer>
      </main>
    </div>
  );
}
