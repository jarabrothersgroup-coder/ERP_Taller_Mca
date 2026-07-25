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
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => router.push("/portal/dashboard")} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver al Dashboard
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-lg font-bold mb-2">¡Cita Agendada!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Tu cita fue registrada exitosamente. Te contactaremos para confirmar.
            </p>
            <div className="space-y-2 text-sm bg-muted/50 rounded-lg p-4 max-w-sm mx-auto">
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
            <Button className="mt-6" onClick={() => router.push("/portal/dashboard")}>
              Volver al Dashboard
            </Button>
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
        <p className="text-sm text-muted-foreground">Seleccioná fecha, hora y motivo para tu visita al taller</p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="py-3 flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Vehicle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Car className="h-4 w-4" />
            1. Seleccioná tu vehículo
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
                    "text-left p-3 rounded-lg border transition-colors",
                    selectedVehicle === v.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                      : "hover:bg-accent/50"
                  )}
                >
                  <p className="text-sm font-medium">
                    {v.brand} {v.model}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {v.plate || "Sin chapa"} {v.year ? `· ${v.year}` : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Date */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            2. Elegí una fecha
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
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </CardContent>
      </Card>

      {/* Step 3: Time */}
      {selectedDate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              3. Elegí un horario
            </CardTitle>
          </CardHeader>
          <CardContent>
            {slotsLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : availableSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay horarios disponibles para esta fecha</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setSelectedTime(slot.time)}
                    className={cn(
                      "h-10 rounded-md border text-sm font-medium transition-colors",
                      !slot.available
                        ? "opacity-40 cursor-not-allowed bg-muted"
                        : selectedTime === slot.time
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-600"
                          : "hover:bg-accent/50"
                    )}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Motivo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">4. Motivo de la visita</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: service de 10.000km, cambio de aceite, revisión general..."
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        className="w-full"
        size="lg"
        disabled={!selectedVehicle || !selectedDate || !selectedTime || !motivo || submitting}
        onClick={handleBook}
      >
        {submitting ? "Agendando..." : "Agendar Cita"}
      </Button>
    </div>
  );
}
