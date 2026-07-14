"use client";

export const dynamic = "force-dynamic";

import { SignUp } from "@clerk/nextjs";
import { Car } from "lucide-react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent" />
      </div>

      <div className="w-full max-w-md animate-fade-in-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/25">
            <Car className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">AutomotiveOS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creá tu cuenta de taller
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-lg">
          <div className="text-center mb-4">
            <h2 className="text-lg font-semibold">Registrar Taller</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Completá los datos para crear tu cuenta
            </p>
          </div>

          <SignUp
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-0 bg-transparent p-0",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                formFieldLabel: "text-sm font-medium",
                formButtonPrimary: "bg-orange-500 hover:bg-orange-600 text-white",
                footerActionLink: "text-primary hover:underline",
              },
            }}
            afterSignUpUrl="/onboarding"
            signInUrl="/sign-in"
          />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © 2026 AutomotiveOS. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
