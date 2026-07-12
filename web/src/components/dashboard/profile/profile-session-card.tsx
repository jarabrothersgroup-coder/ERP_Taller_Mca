"use client";

import { Building2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CopyField } from "./copy-field";

export function ProfileSessionCard({
  tenantSlug,
  sessionExpires,
}: {
  tenantSlug: string;
  sessionExpires?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          Taller y Sesión
        </CardTitle>
        <CardDescription>
          Información del tenant y estado de la sesión
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <CopyField label="Tenant Slug" value={tenantSlug} />
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Expiración de sesión</p>
            <p className="text-sm font-medium">
              {sessionExpires
                ? new Date(sessionExpires).toLocaleDateString("es-PY", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "No disponible"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Sesión activa</p>
            <p className="text-xs text-muted-foreground">
              Autenticado en {tenantSlug}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
