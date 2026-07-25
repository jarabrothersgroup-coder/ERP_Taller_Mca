"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { api } from "@/lib/api";
import { LogIn, Mail, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [step, setStep] = React.useState<"email" | "sent" | "error">("email");
  const [message, setMessage] = React.useState("");

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setMessage("");
    try {
      const result = await api.request<{ success: boolean; message: string; link?: string }>(
        "/portal/auth/magic",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim() }),
        },
      );

      if (result.success) {
        setStep("sent");
        setMessage(result.message);

        // Dev mode: if link is returned, store it and auto-redirect after 2s
        if (result.link) {
          setTimeout(() => {
            router.push(result.link!);
          }, 2000);
        }
      } else {
        setStep("error");
        setMessage(result.message || "Error al enviar el enlace");
      }
    } catch (err: any) {
      setStep("error");
      setMessage(err?.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
            <LogIn className="h-6 w-6 text-orange-500" />
          </div>
          <CardTitle className="text-xl">Portal del Cliente</CardTitle>
          <CardDescription>
            Ingresá tu email para recibir un enlace mágico de acceso
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <form onSubmit={handleSendMagicLink} className="space-y-4">
              <FormField label="Correo electrónico" htmlFor="email">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                    autoFocus
                  />
                </div>
              </FormField>
              <Button type="submit" className="w-full gap-2" loading={loading}>
                {loading ? "Enviando..." : "Enviar enlace mágico"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}

          {step === "sent" && (
            <div className="text-center space-y-3 py-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">{message}</p>
              <p className="text-xs text-muted-foreground/60">
                Revisá tu bandeja de entrada. El enlace expira en 15 minutos.
              </p>
              <Button variant="outline" size="sm" onClick={() => setStep("email")} className="mt-2">
                Reintentar con otro email
              </Button>
            </div>
          )}

          {step === "error" && (
            <div className="text-center space-y-3 py-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-sm text-destructive">{message}</p>
              <Button variant="outline" size="sm" onClick={() => setStep("email")} className="mt-2">
                Intentar de nuevo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
