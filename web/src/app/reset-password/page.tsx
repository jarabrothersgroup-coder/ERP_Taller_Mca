"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Car, ArrowLeft, KeyRound, CheckCircle2, Loader2 } from "lucide-react";

/**
 * Recuperación de contraseña — paso 2 (S132-9).
 *
 * Consume el token del email (`?token=…&tenant=…`) contra
 * `POST /api/auth/reset-password`. El backend aplica la política de
 * contraseña (mínimo 8) y responde con un error genérico si el token
 * es inválido, venció o ya se usó.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const tenantSlug = searchParams.get("tenant") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const tokenFaltante = !token || !tenantSlug;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, token, password }),
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
        setError(
          data.message ||
            "El enlace de recuperación es inválido o expiró. Solicitá uno nuevo.",
        );
        return;
      }

      setDone(true);
    } catch {
      setError("Error de conexión. Verificá tu internet e intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (tokenFaltante) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-lg text-center">
        <h2 className="text-lg font-semibold">Enlace incompleto</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          El enlace no incluye el token o el taller. Pedí uno nuevo desde la
          pantalla de recuperación.
        </p>
        <button
          onClick={() => router.push("/forgot-password")}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
        >
          Pedir un enlace nuevo
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-lg text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold">Contraseña actualizada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ya podés iniciar sesión con tu nueva contraseña en el taller{" "}
          <strong>{tenantSlug}</strong>.
        </p>
        <button
          onClick={() => router.push("/sign-in")}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
        >
          Ir al Inicio de Sesión
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <KeyRound className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">Nueva contraseña</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Taller: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div>
          <label htmlFor="reset-password" className="text-sm font-medium">
            Nueva contraseña
          </label>
          <input
            id="reset-password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            minLength={8}
            required
            autoFocus
            disabled={loading}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="reset-confirm" className="text-sm font-medium">
            Repetir contraseña
          </label>
          <input
            id="reset-confirm"
            name="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repetí la contraseña"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={loading}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
            {/inválido|expir/i.test(error) && (
              <button
                type="button"
                onClick={() => router.push("/forgot-password")}
                className="mt-2 block text-xs underline"
              >
                Pedir un enlace nuevo
              </button>
            )}
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
            "Guardar contraseña"
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
  );
}

export default function ResetPasswordPage() {
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
            Restablecer contraseña
          </p>
        </div>

        <Suspense
          fallback={
            <div className="rounded-xl border bg-card p-6 shadow-lg text-center text-sm text-muted-foreground">
              Cargando…
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © 2026 AutomotiveOS. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
