"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/components/providers/session-provider";

interface SetupResponse {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
  message: string;
}

/**
 * Bloque 2FA de la página de Seguridad: estado vía `GET /2fa/status`,
 * activación vía `POST /2fa/setup` y cuenta regresiva TOTP vía
 * `GET /2fa/time-remaining`. Sólo admin (403 ⇒ no se renderiza).
 */
export function TwoFactorCard() {
  const { user } = useAuth();
  const [enroll, setEnroll] = React.useState<SetupResponse | null>(null);

  const statusQuery = useQuery({
    queryKey: ["2fa-status"],
    queryFn: () => api.request<{ enabled: boolean }>("/2fa/status"),
    retry: 1,
  });

  const showCountdown = Boolean(statusQuery.data?.enabled) || !!enroll;
  const countdownQuery = useQuery({
    queryKey: ["2fa-time-remaining"],
    queryFn: () => api.request<{ remaining: number }>("/2fa/time-remaining"),
    enabled: showCountdown,
    refetchInterval: 1000,
    retry: 0,
  });

  const setupMut = useMutation({
    mutationFn: () =>
      api.request<SetupResponse>("/2fa/setup", {
        method: "POST",
        body: JSON.stringify({ accountName: user?.email || "admin" }),
      }),
    onSuccess: (data) => setEnroll(data),
  });

  if (statusQuery.isError) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Autenticación en Dos Pasos (2FA)
        </CardTitle>
        <CardDescription>
          Protege el acceso de administrador con códigos TOTP de tu app de autenticación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {statusQuery.isLoading ? (
          <Skeleton className="h-14 w-full" />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className={`h-4 w-4 ${statusQuery.data?.enabled ? "text-emerald-500" : "text-muted-foreground"}`}
                aria-hidden="true"
              />
              <span className="text-sm font-medium">
                {statusQuery.data?.enabled ? "2FA activado" : "2FA no activado"}
              </span>
            </div>
            {showCountdown && (
              <Badge variant="secondary" className="gap-1 tabular-nums">
                <Timer className="h-3 w-3" aria-hidden="true" />
                {countdownQuery.data?.remaining ?? "—"}s para el próximo código
              </Badge>
            )}
          </div>
        )}

        {!statusQuery.data?.enabled && !enroll && (
          <Button
            className="gap-2"
            size="sm"
            onClick={() => setupMut.mutate()}
            loading={setupMut.isPending}
          >
            <KeyRound className="h-4 w-4" />
            {setupMut.isPending ? "Generando secreto…" : "Activar 2FA"}
          </Button>
        )}

        {setupMut.isError && (
          <p className="text-xs text-destructive">
            {setupMut.error instanceof Error ? setupMut.error.message : "No se pudo activar 2FA"}
          </p>
        )}

        {enroll && (
          <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Escaneá el secreto con tu app de autenticación y guardá los códigos de
              respaldo en un lugar seguro.
            </p>
            <p className="text-xs">
              <span className="text-muted-foreground">Secreto:</span>{" "}
              <code className="font-mono break-all">{enroll.secret}</code>
            </p>
            <p className="text-xs break-all">
              <span className="text-muted-foreground">URI:</span>{" "}
              <code className="font-mono">{enroll.otpauthUrl}</code>
            </p>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Códigos de respaldo:</p>
              <div className="flex flex-wrap gap-1.5">
                {enroll.backupCodes.map((code) => (
                  <Badge key={code} variant="outline" className="font-mono text-[10px]">
                    {code}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
