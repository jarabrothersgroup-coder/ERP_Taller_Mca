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
  Calendar,
  Clock,
  Car,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Helpers ──────────────────────────────────── */

function getSession(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("portal_session");
}

/* ── Types ──────────────────────────────────── */

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  plate: string | null;
  year: number | null;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

const STEPS = [
  { num: 1, label: "Vehículo", icon: Car },
  { num: 2, label: "Fecha", icon: Calendar },
  { num: 3, label: "Horario", icon: Clock },
  { num: 4, label: "Motivo", icon: FileText },
];

/* ── Page ─────────────────────────────────────── */

export default function PortalBookingPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [motivo, setMotivo] = useState("");
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // AI Suggestions
  const [aiSuggestions, setAiSuggestions] = useState<{
    time: string;
    score: number;
    reason: string;
    isSweetSpot: boolean;
  }[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);

  // Compute current step
  const currentStep = !selectedVehicle ? 1 : !selectedDate ? 2 : !selectedTime ? 3 : 4;

  // Load vehicles on mount
  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/portal/login");
      return;
    }

    const fetchVehicles = async () => {
      try {
        const data = await api.request<Vehicle[]>("/portal/vehicles", {
          headers: { "X-Portal-Session": session },
        });
        setVehicles(data);
      } catch (err: any) {
        if (err?.status === 401) {
          localStorage.removeItem("portal_session");
          router.push("/portal/login");
          return;
        }
        setError(err?.message || "Error al cargar vehículos");
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();
  }, [router]);

  // Fetch availability when date changes
  useEffect(() => {
    if (!selectedDate) {
      setAvailableSlots([]);
      setAiSuggestions([]);
      return;
    }

    const session = getSession();
    if (!session) return;

    const fetchAvailability = async () => {
      setSlotsLoading(true);
      try {
        const data = await api.request<{ slots: TimeSlot[] }>(
          `/portal/availability?date=${selectedDate}`,
          { headers: { "X-Portal-Session": session } },
        );
        setAvailableSlots(data.slots || []);
      } catch (err: any) {
        console.error("Error fetching availability:", err);
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchAvailability();

    // Fetch AI suggestions for selected date
    const fetchAiSuggestions = async () => {
      setLoadingAi(true);
      try {
        const sessionToken = getSession();
        const clientPhone = sessionToken
          ? await api
              .request<{ phone: string }>("/portal/profile", {
                headers: { "X-Portal-Session": sessionToken },
              })
              .then((r) => r.phone)
              .catch(() => undefined)
          : undefined;

        const data = await api.request<{
          suggestions: { time: string; score: number; reason: string; isSweetSpot: boolean }[];
        }>(`/scheduling/ai-suggestions?date=${selectedDate}&tipoServicio=RAPIDO${clientPhone ? `&clientePhone=${encodeURIComponent(clientPhone)}` : ""}`);
        setAiSuggestions(data.suggestions || []);
      } catch {
        // AI suggestions are optional
      } finally {
        setLoadingAi(false);
      }
    };

    fetchAiSuggestions();
  }, [selectedDate]);

  // Get min date (tomorrow)
  const minDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  // Handle booking submission
  const handleBook = async () => {
    if (!selectedVehicle || !selectedDate || !selectedTime || !motivo) return;

    const session = getSession();
    if (!session) {
      router.push("/portal/login");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await api.request("/portal/appointments", {
        method: "POST",
        headers: {
          "X-Portal-Session": session,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicleId: selectedVehicle,
          date: selectedDate,
          time: selectedTime,
          motivo,
        }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Error al agendar cita");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.push("/portal/dashboard")} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver al Dashboard
        </Button>
        <Card className="border-green-200 dark:border-green-800 overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-center text-white">
            <div className="mx-auto h-16 w-16 rounded-full bg-white/20 flex items-center justify-center mb-3 backdrop-blur-sm">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold">¡Cita Agendada!</h2>
            <p className="text-green-100 mt-1 text-sm">
              Tu cita fue registrada exitosamente
            </p>
          </div>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground text-center mb-4">
              Te contactaremos para confirmar el turno.
            </p>
            <div className="space-y-3 text-sm bg-muted/50 rounded-xl p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha:</span>
                <span className="font-medium">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hora:</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vehículo:</span>
                <span className="font-medium">
                  {vehicles.find((v) => v.id === selectedVehicle)?.brand}{" "}
                  {vehicles.find((v) => v.id === selectedVehicle)?.model}
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/portal/dashboard")}
              >
                Volver al Dashboard
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => {
                  setSuccess(false);
                  setSelectedVehicle("");
                  setSelectedDate("");
                  setSelectedTime("");
                  setMotivo("");
                }}
              >
                <Calendar className="h-4 w-4" />
                Agendar otra
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/portal/dashboard")} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <h1 className="text-xl font-bold tracking-tight">Agendar Cita</h1>
        <p className="text-sm text-muted-foreground">Completá los pasos para reservar tu turno</p>
      </div>

      {/* Progress Stepper */}
      <div className="flex items-center gap-1 sm:gap-2">
        {STEPS.map((step, i) => {
          const StepIcon = step.icon;
          const isCompleted = step.num < currentStep;
          const isCurrent = step.num === currentStep;
          const isFuture = step.num > currentStep;
          return (
            <React.Fragment key={step.num}>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                    isCompleted && "bg-green-500 text-white shadow-sm shadow-green-500/30",
                    isCurrent && "bg-orange-500 text-white shadow-sm shadow-orange-500/30 scale-110",
                    isFuture && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </div>
                <span className={cn(
                  "text-xs font-medium hidden sm:block",
                  isCurrent ? "text-orange-600 dark:text-orange-400" : isCompleted ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 rounded-full transition-all duration-300",
                  isCompleted ? "bg-green-300 dark:bg-green-700" : "bg-muted"
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-3 flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Vehicle */}
      <Card className={cn("transition-all duration-200", currentStep === 1 && "ring-2 ring-orange-500/20 border-orange-300 dark:border-orange-700")}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold", currentStep === 1 ? "bg-orange-500 text-white" : currentStep > 1 ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")}>
              {currentStep > 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : "1"}
            </div>
            Seleccioná tu vehículo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenés vehículos registrados</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVehicle(v.id)}
                  className={cn(
                    "text-left p-3 rounded-xl border-2 transition-all duration-200",
                    selectedVehicle === v.id
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 shadow-sm shadow-orange-500/10"
                      : "border-transparent hover:border-border hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Car className={cn("h-4 w-4 shrink-0", selectedVehicle === v.id ? "text-orange-500" : "text-muted-foreground")} />
                    <div>
                      <p className="text-sm font-medium">
                        {v.brand} {v.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {v.plate || "Sin chapa"} {v.year ? `· ${v.year}` : ""}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Date */}
      <Card className={cn("transition-all duration-200", currentStep === 2 && "ring-2 ring-orange-500/20 border-orange-300 dark:border-orange-700", currentStep < 2 && "opacity-50 pointer-events-none")}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold", currentStep === 2 ? "bg-orange-500 text-white" : currentStep > 2 ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")}>
              {currentStep > 2 ? <CheckCircle2 className="h-3.5 w-3.5" /> : "2"}
            </div>
            Elegí una fecha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="date"
            min={minDate}
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSelectedTime("");
            }}
            className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-300 transition-all"
          />
        </CardContent>
      </Card>

      {/* Step 3: Time */}
      <Card className={cn("transition-all duration-200", currentStep === 3 && "ring-2 ring-orange-500/20 border-orange-300 dark:border-orange-700", currentStep < 3 && "opacity-50 pointer-events-none")}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold", currentStep === 3 ? "bg-orange-500 text-white" : currentStep > 3 ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")}>
              {currentStep > 3 ? <CheckCircle2 className="h-3.5 w-3.5" /> : "3"}
            </div>
            Elegí un horario
          </CardTitle>
        </CardHeader>
        <CardContent>
          {slotsLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-11 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              {/* AI Suggestions banner */}
              {!slotsLoading && aiSuggestions.length > 0 && !loadingAi && (
                <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      Horarios recomendados para vos
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aiSuggestions.slice(0, 3).map((s) => (
                      <button
                        key={s.time}
                        type="button"
                        onClick={() => setSelectedTime(s.time)}
                        className={cn(
                          "px-3.5 py-2 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                          selectedTime === s.time
                            ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                            : "bg-white dark:bg-amber-950/50 border-amber-200 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/50",
                          s.isSweetSpot && "ring-2 ring-amber-400/50",
                        )}
                        title={s.reason}
                      >
                        <Sparkles className={cn("h-3 w-3", s.isSweetSpot ? "text-amber-400" : "text-amber-400")} />
                        {s.time}
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

              {availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay horarios disponibles para esta fecha</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableSlots.map((slot) => {
                    const isAiSuggested = aiSuggestions.some((s) => s.time === slot.time);
                    const aiSuggestion = aiSuggestions.find((s) => s.time === slot.time);
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.time)}
                        className={cn(
                          "h-11 rounded-xl border-2 text-sm font-medium transition-all duration-200 relative group",
                          !slot.available
                            ? "opacity-30 cursor-not-allowed bg-muted border-transparent"
                            : selectedTime === slot.time
                              ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-600 shadow-sm shadow-orange-500/10"
                              : isAiSuggested
                                ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                : "border-transparent hover:border-border hover:bg-accent/50"
                        )}
                      >
                        {slot.time}
                        {isAiSuggested && (
                          <div className="absolute -top-1.5 -right-1.5">
                            <Sparkles className="h-3 w-3 text-amber-400" />
                          </div>
                        )}
                        {isAiSuggested && aiSuggestion && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-popover border text-[10px] text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-sm">
                            {aiSuggestion.reason}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Step 4: Motivo */}
      <Card className={cn("transition-all duration-200", currentStep === 4 && "ring-2 ring-orange-500/20 border-orange-300 dark:border-orange-700", currentStep < 4 && "opacity-50 pointer-events-none")}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold", currentStep === 4 ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground")}>
              4
            </div>
            Motivo de la visita
          </CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: service de 10.000km, cambio de aceite, revisión general..."
            rows={3}
            className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-300 transition-all placeholder:text-muted-foreground/60"
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        className="w-full h-12 text-base font-semibold gap-2 shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform"
        size="lg"
        disabled={!selectedVehicle || !selectedDate || !selectedTime || !motivo || submitting}
        onClick={handleBook}
      >
        {submitting ? (
          "Agendando..."
        ) : (
          <>
            <Calendar className="h-5 w-5" />
            Agendar Cita
            <Sparkles className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
