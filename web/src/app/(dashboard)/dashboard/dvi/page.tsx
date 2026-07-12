"use client";

import * as React from "react";
import { useDVIInspections } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, Plus, Loader2 } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "warning" | "success" | "destructive"> = {
  COMPLETADA: "success",
  EN_PROGRESO: "warning",
  PENDIENTE: "secondary",
  CANCELADA: "destructive",
};

export default function DVIPage() {
  const { data: inspections = [], isLoading } = useDVIInspections();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inspección Vehicular (DVI)</h1>
          <p className="text-sm text-muted-foreground">Inspecciones digitales con fotos y score de salud</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Nueva Inspección</Button>
      </div>

      {inspections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay inspecciones registradas</p>
            <p className="text-xs text-muted-foreground mt-1">Creá una inspección para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {inspections.map((insp) => (
            <Card key={insp.id} className="hover:border-foreground/20 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">DVI-{insp.id.slice(0, 8)}</CardTitle>
                  <Badge variant={statusVariant[insp.status] ?? "secondary"}>{insp.status}</Badge>
                </div>
                <CardDescription>Vehicle: {insp.vehicleId.slice(0, 8)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{insp.healthScore}%</span>
                  <span className="text-xs text-muted-foreground">{new Date(insp.createdAt).toLocaleDateString("es-PY")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
