"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { WifiOff, RefreshCw, Car } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Offline Fallback Page.
 *
 * Shown when the user navigates to a page that isn't cached
 * while the device is offline.
 */
export default function OfflinePage() {
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="mx-auto max-w-md text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <RefreshCw className="h-8 w-8 text-emerald-500" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Ya estás en línea</h1>
          <p className="text-muted-foreground">
            Tu conexión se ha restablecido. Puedes volver al panel de control.
          </p>
          <Button asChild size="lg">
            <a href="/dashboard">Ir al Dashboard</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="mx-auto max-w-md text-center space-y-6 animate-fade-in">
        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
          <WifiOff className="h-8 w-8 text-amber-500" aria-hidden="true" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Sin Conexión</h1>
          <p className="text-muted-foreground">
            No tienes acceso a internet en este momento. Algunas funciones del taller no estarán disponibles hasta que recuperes la conexión.
          </p>
        </div>

        {/* Offline features */}
        <div className="rounded-lg border bg-card p-4 text-left space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Car className="h-4 w-4 text-orange-500" aria-hidden="true" />
            Funciones disponibles sin conexión:
          </h2>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>Visualizar órdenes de trabajo cacheadas</li>
            <li>Ver datos del panel de control</li>
            <li>Consultar información de clientes</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button asChild variant="default" size="lg">
            <a href="/dashboard">Volver al Dashboard</a>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => window.location.reload()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar Conexión
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Una vez que recuperes la conexión, los datos se sincronizarán automáticamente.
        </p>
      </div>
    </div>
  );
}
