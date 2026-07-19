"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/session-provider";
import { useRouter } from "next/navigation";
import { Car, Building2, Users, CheckCircle2, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

interface OnboardingData {
  tenantSlug: string;
  ruc: string;
  dv: string;
  razonSocial: string;
  formaJuridica: string;
  cantidadPersonal: number;
  ingresosAnuales: number;
}

const steps = [
  { id: 1, title: "Datos del Taller", icon: Building2 },
  { id: 2, title: "Clasificación", icon: Users },
  { id: 3, title: "Confirmar", icon: CheckCircle2 },
];

const formasJuridicas = [
  { value: "UNIPERSONAL", label: "Unipersonal" },
  { value: "SRL", label: "S.R.L." },
  { value: "SA", label: "S.A." },
  { value: "EAS", label: "E.A.S." },
  { value: "SAECA", label: "S.A.E.C.A." },
];

export default function OnboardingWizard() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData>({
    tenantSlug: "",
    ruc: "",
    dv: "",
    razonSocial: "",
    formaJuridica: "UNIPERSONAL",
    cantidadPersonal: 1,
    ingresosAnuales: 0,
  });

  const updateData = (partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
    setError(null);
  };

  const validateStep1 = (): boolean => {
    if (!data.tenantSlug || !data.ruc || !data.dv || !data.razonSocial) {
      setError("Completá todos los campos obligatorios");
      return false;
    }
    if (data.ruc.length < 8) {
      setError("El RUC debe tener al menos 8 dígitos");
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (data.cantidadPersonal < 1) {
      setError("Indicá la cantidad de personal");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Error al crear el taller");
      }

      // Success — redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3) {
      handleSubmit();
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => s - 1);
    setError(null);
  };

  // Auto-generate slug from business name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex flex-col">
      {/* Background pattern */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Logo */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/25">
            <Car className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Configurá tu Taller</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solo necesitamos algunos datos para comenzar
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  step >= s.id
                    ? "bg-orange-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.id ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  s.id
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-1 ${
                    step > s.id ? "bg-orange-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
          <h2 className="text-lg font-semibold mb-4">{steps[step - 1].title}</h2>

          {/* Step 1: Business Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nombre del Taller *</label>
                <input
                  type="text"
                  value={data.razonSocial}
                  onChange={(e) => {
                    updateData({
                      razonSocial: e.target.value,
                      tenantSlug: generateSlug(e.target.value),
                    });
                  }}
                  placeholder="Ej: Taller El Chero"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Slug (identificador) *</label>
                <div className="mt-1 flex items-center rounded-lg border bg-background px-3 py-2">
                  <span className="text-muted-foreground text-sm">/</span>
                  <input
                    type="text"
                    value={data.tenantSlug}
                    onChange={(e) => updateData({ tenantSlug: e.target.value })}
                    placeholder="taller-el-chero"
                    className="ml-1 flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Se genera automáticamente, podés editarlo
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-sm font-medium">RUC *</label>
                  <input
                    type="text"
                    value={data.ruc}
                    onChange={(e) => updateData({ ruc: e.target.value })}
                    placeholder="80012345"
                    maxLength={10}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">DV *</label>
                  <input
                    type="text"
                    value={data.dv}
                    onChange={(e) => updateData({ dv: e.target.value })}
                    placeholder="5"
                    maxLength={2}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Forma Jurídica</label>
                <select
                  value={data.formaJuridica}
                  onChange={(e) => updateData({ formaJuridica: e.target.value })}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  {formasJuridicas.map((fj) => (
                    <option key={fj.value} value={fj.value}>
                      {fj.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Classification */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Cantidad de Personal *</label>
                <input
                  type="number"
                  value={data.cantidadPersonal || ""}
                  onChange={(e) =>
                    updateData({ cantidadPersonal: parseInt(e.target.value) || 0 })
                  }
                  min={1}
                  placeholder="Ej: 5"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Se usa para clasificación MIC (Micro, Pequeña, Mediana)
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Ingresos Anuales (Guaraníes)
                </label>
                <input
                  type="number"
                  value={data.ingresosAnuales || ""}
                  onChange={(e) =>
                    updateData({
                      ingresosAnuales: parseInt(e.target.value) || 0,
                    })
                  }
                  min={0}
                  placeholder="Ej: 500000000"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Último ejercicio cerrado (opcional, podés completar después)
                </p>
              </div>

              {/* Classification preview */}
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium mb-2">Clasificación Estimada:</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-orange-500/10 px-3 py-1 text-sm font-medium text-orange-600">
                    {data.ingresosAnuales <= 500000000 && data.cantidadPersonal <= 10
                      ? "MICRO"
                      : data.ingresosAnuales <= 5000000000 && data.cantidadPersonal <= 30
                      ? "PEQUEÑA"
                      : data.ingresosAnuales <= 20000000000 && data.cantidadPersonal <= 100
                      ? "MEDIANA"
                      : "GRANDE"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    (según Ley 4457/12)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Taller:</span>
                  <span className="text-sm font-medium">{data.razonSocial}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Slug:</span>
                  <span className="text-sm font-mono">/{data.tenantSlug}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">RUC:</span>
                  <span className="text-sm font-medium">
                    {data.ruc}-{data.dv}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Forma Jurídica:</span>
                  <span className="text-sm font-medium">
                    {formasJuridicas.find((f) => f.value === data.formaJuridica)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Personal:</span>
                  <span className="text-sm font-medium">{data.cantidadPersonal}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Al confirmar se creará tu taller con la configuración fiscal por defecto.
                Podés modificar estos datos después desde Configuración.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step === 3 ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Crear Taller
                </>
              ) : (
                <>
                  Siguiente
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © 2026 AutomotiveOS. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
