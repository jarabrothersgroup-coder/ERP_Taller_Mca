"use client";

import { Shield, Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SeguridadPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center text-center py-12">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/20">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Seguridad</h1>
          <Badge variant="secondary" className="mb-4 gap-1.5">
            <Construction className="h-3.5 w-3.5" />
            Próximamente
          </Badge>
          <p className="text-sm text-muted-foreground max-w-sm">
            Auditoría de accesos, registro de actividad, protocolo HV Lockout/Tagout y seguridad del taller.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
