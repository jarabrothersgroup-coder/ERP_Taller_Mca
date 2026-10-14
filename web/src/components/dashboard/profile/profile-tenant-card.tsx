"use client";

import * as React from "react";
import { BadgeCheck, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

/** Shape de `GET /api/tenant/profile` (TenantProfileDTO del backend). */
interface TenantProfile {
  tenantSlug: string;
  ruc: string;
  dv: string;
  razonSocial: string;
  clasificacionMic: string;
  formaJuridica: string;
  regimenIre: string;
  ejercicioActual: number;
  periodoAbiertoMes: number;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

/**
 * Perfil del Contribuyente del taller: datos fiscales (RUC/DV, clasificación
 * MIC, régimen IRE) y ejercicio contable vigente, servidos por
 * `GET /api/tenant/profile`.
 */
export function ProfileTenantCard() {
  const [profile, setProfile] = React.useState<TenantProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.request<TenantProfile>("/api/tenant/profile");
      setProfile(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el perfil");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BadgeCheck className="h-4 w-4" aria-hidden="true" />
          Perfil del Contribuyente
        </CardTitle>
        <CardDescription>Datos fiscales y ejercicio contable del taller</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        )}

        {!loading && !error && profile && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Razón social" value={profile.razonSocial || "—"} />
              <Field
                label="RUC"
                value={
                  profile.ruc ? `${profile.ruc}-${profile.dv}` : "—"
                }
              />
              <Field label="Clasificación MIC" value={profile.clasificacionMic || "—"} />
              <Field label="Forma jurídica" value={profile.formaJuridica || "—"} />
              <Field label="Régimen IRE" value={profile.regimenIre || "—"} />
              <Field
                label="Ejercicio / período abierto"
                value={`${profile.ejercicioActual} · mes ${profile.periodoAbiertoMes}`}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Editable desde Configuración · los libros obligatorios se activan
              automáticamente al reclasificar.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
