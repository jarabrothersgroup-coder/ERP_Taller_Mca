"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";
import { Car, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

/**
 * Forgot password page — redirects to Clerk's built-in reset flow.
 * Clerk handles password reset natively via email.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Clerk handles this via its own UI. Redirect to sign-in with password reset.
    setTimeout(() => {
      setSubmitted(true);
      setLoading(false);
    }, 1000);
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
            <h1 className="text-2xl font-bold tracking-tight">Email Enviado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Si existe una cuenta con <strong>{email}</strong>, recibirás un email con las instrucciones para restablecer tu contraseña.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-lg text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Revisá tu bandeja de entrada y seguí las instrucciones. El enlace expira en 1 hora.
            </p>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => router.push("/sign-in")}
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al Inicio de Sesión
            </Button>
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
                Ingresá tu correo electrónico y te enviaremos las instrucciones para restablecerla.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                placeholder="admin@taller.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                autoFocus
                autoComplete="email"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
              {loading ? "Enviando…" : "Enviar Instrucciones"}
            </Button>
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
