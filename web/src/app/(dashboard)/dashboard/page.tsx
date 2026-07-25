"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Panel de Control — Redirige al Dashboard Ejecutivo.
 * El contenido completo del dashboard anterior se mantiene en /dashboard/ejecutivo.
 */
export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/ejecutivo");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <p>Redirigiendo al Dashboard Ejecutivo...</p>
    </div>
  );
}
