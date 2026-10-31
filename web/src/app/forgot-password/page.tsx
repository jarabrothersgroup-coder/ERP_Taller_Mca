"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";
import { Car, ArrowLeft, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Recuperación de contraseña — paso 1 (S132-9).
 *
 * Pide taller + email (el email es único POR taller, igual que en el
 * login) y dispara `POST /api/auth/forgot-password`. La respuesta es
 * siempre la misma exista o no la cuenta: la UI no puede usarse para
 * enumerar usuarios.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, email }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setError(
          data.message ||
            "Demasiados intentos. Esperá unos minutos antes de volver a intentar.",
        );
        return;
      }

      if (!res.ok) {
        setError(data.message || "No pudimos procesar el pedido. Intentá de nuevo.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Error de conexión. Verificá tu internet e intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent" />
        </div>

        <div className="w-full max-w-md animate-fade-in-up">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Revisá tu correo</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Si existe una cuenta con <strong>{email}</strong> en el taller{" "}
              <strong>{tenantSlug}</strong>, recibirás un email con las
              instrucciones para restablecer tu contraseña.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-lg text-center">
            <p className="text-sm text-muted-foreground mb-4">
              El enlace vence en 1 hora y solo puede usarse una vez. Si no lo
              ves, revisá la carpeta de spam.
            </p>
            <button
              onClick={() => router.push("/sign-in")}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al Inicio de Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent" />
      </div>

      <div className="w-full max-w-md animate-fade-in-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/25">
            <Car className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">AutomotiveOS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recuperación de contraseña
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Mail className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold">¿Olvidaste tu contraseña?</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Ingresá tu taller y correo electrónico: te enviamos un enlace
                para restablecerla.
              </p>
            </div>

            <div>
              <label htmlFor="forgot-tenant" className="text-sm font-medium">
                Taller
              </label>
              <input
                id="forgot-tenant"
                name="tenantSlug"
                type="text"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder="mi-taller"
                autoComplete="organization"
                required
                autoFocus
                disabled={loading}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="forgot-email" className="text-sm font-medium">
                Correo electrónico
              </label>
              <input
                id="forgot-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@taller.com"
                autoComplete="email"
                required
                disabled={loading}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Enviar Instrucciones"
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => router.push("/sign-in")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Volver al Inicio de Sesión
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
