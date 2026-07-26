"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MagicLinkAuthPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  if (!token) return null;

  const [status, setStatus] = useState<"validating" | "success" | "error">("validating");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) return;

    const validate = async () => {
      try {
        const result = await api.request<{ session: string; client: { name: string; email: string } }>(
          `/portal/auth/magic/${token}`,
        );

        if (result.session) {
          // Store session in localStorage
          localStorage.setItem("portal_session", result.session);
          localStorage.setItem("portal_client_name", result.client.name);
          localStorage.setItem("portal_client_email", result.client.email);
          setStatus("success");

          // Redirect to dashboard
          setTimeout(() => router.push("/portal/dashboard"), 1500);
        } else {
          setStatus("error");
          setErrorMsg("Enlace inválido o expirado");
        }
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err?.message || "Error al validar el enlace");
      }
    };

    validate();
  }, [token, router]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardContent className="py-12 text-center space-y-4">
          {status === "validating" && (
            <>
              <Spinner className="mx-auto h-8 w-8" />
              <p className="text-sm text-muted-foreground">Validando enlace mágico...</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-sm font-medium text-green-600">¡Acceso concedido!</p>
              <p className="text-xs text-muted-foreground">Redirigiendo al portal...</p>
            </>
          )}
          {status === "error" && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-sm text-destructive">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={() => router.push("/portal/login")}>
                Volver al inicio de sesión
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
