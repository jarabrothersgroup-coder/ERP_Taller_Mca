"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import {
  UserCheck,
  Brain,
  Star,
  AlertTriangle,
  Target,
  Users,
  BarChart3,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AssignmentInput {
  ordenId: string;
  hvAlert?: boolean;
  requiredCertificaciones?: string[];
  preferredMechanicId?: string;
}

interface AssignmentResult {
  selectedMechanicId: string;
  selectedMechanicName: string;
  score: number;
  alternatives: Array<{ profileId: string; nombre: string; score: number }>;
}

export default function AsignacionPage() {
  const { toast: t, ToastContainer } = useToast();
  const [ordenId, setOrdenId] = React.useState("");
  const [hvAlert, setHvAlert] = React.useState(false);
  const [certInput, setCertInput] = React.useState("");
  const [certificaciones, setCertificaciones] = React.useState<string[]>([]);
  const [preferredId, setPreferredId] = React.useState("");

  const assignMut = useMutation({
    mutationFn: (input: AssignmentInput) =>
      api.request<AssignmentResult>("/workshop/mechanic-assignment/assign", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      t.success(`Asignado: ${data.selectedMechanicName} (score: ${data.score})`);
    },
    onError: (err: Error) => t.error(err.message),
  });

  const addCert = () => {
    const cert = certInput.trim().toUpperCase();
    if (cert && !certificaciones.includes(cert)) {
      setCertificaciones([...certificaciones, cert]);
    }
    setCertInput("");
  };

  const handleAssign = () => {
    if (!ordenId.trim()) {
      t.error("Ingresá un ID de Orden de Trabajo");
      return;
    }
    assignMut.mutate({
      ordenId: ordenId.trim(),
      hvAlert,
      requiredCertificaciones: certificaciones.length > 0 ? certificaciones : undefined,
      preferredMechanicId: preferredId.trim() || undefined,
    });
  };

  const result = assignMut.data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="h-6 w-6 text-violet-500" />
          Asignación Inteligente de Mecánicos
        </h1>
        <p className="text-sm text-muted-foreground">
          Algoritmo de scoring que evalúa carga laboral, certificaciones y eficiencia histórica
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Parámetros de Asignación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                ID de Orden de Trabajo <span className="text-destructive">*</span>
              </label>
              <Input placeholder="UUID de la OT..." value={ordenId} onChange={(e) => setOrdenId(e.target.value)} />
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <input type="checkbox" id="hv-alert" checked={hvAlert} onChange={(e) => setHvAlert(e.target.checked)} className="rounded border-gray-600" />
              <label htmlFor="hv-alert" className="flex items-center gap-2 text-sm cursor-pointer">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Vehículo HV (Alto Voltaje)</span>
                <Badge variant="warning" className="ml-1 text-[10px]">Requiere certificación</Badge>
              </label>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Certificaciones Requeridas</label>
              <div className="flex gap-2 mb-2">
                <Input placeholder="Ej: HV, AC, DIESEL..." value={certInput} onChange={(e) => setCertInput(e.target.value)} />
                <Button variant="outline" size="sm" onClick={addCert} type="button">Agregar</Button>
              </div>
              {certificaciones.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {certificaciones.map((cert) => (
                    <Badge key={cert} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setCertificaciones((prev) => prev.filter((c) => c !== cert))}>
                      {cert} ✕
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Mecánico Preferido (opcional)</label>
              <Input placeholder="UUID del mecánico..." value={preferredId} onChange={(e) => setPreferredId(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">Si se especifica, recibe +30 puntos de bonus</p>
            </div>

            <Button className="w-full gap-2" size="lg" onClick={handleAssign} disabled={assignMut.isPending}>
              {assignMut.isPending ? "Analizando..." : "Asignar Mecánico Óptimo"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-500" />
              Resultado de Asignación
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assignMut.isPending ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <div className="animate-spin mb-3"><Brain className="h-8 w-8" /></div>
                <p>Calculando scoring...</p>
                <p className="text-xs mt-1">Evaluando carga laboral, certificaciones y eficiencia</p>
              </div>
            ) : result ? (
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <UserCheck className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-muted-foreground">MECÁNICO SELECCIONADO</p>
                      <p className="text-lg font-bold">{result.selectedMechanicName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="text-sm font-medium">Score: <strong>{result.score}</strong> pts</span>
                  </div>
                </div>

                {result.alternatives.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Alternativas ({result.alternatives.length})
                    </h4>
                    <div className="space-y-2">
                      {result.alternatives.map((alt) => (
                        <div key={alt.profileId} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                              {alt.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{alt.nombre}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{alt.profileId.substring(0, 8)}</p>
                            </div>
                          </div>
                          <Badge variant="secondary">{alt.score} pts</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Scoring: Eficiencia base (50pts) — Carga laboral (-10pts/OT) — Certificaciones (+20pts) — Preferencia (+30pts)
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Brain className="h-12 w-12 mb-3 opacity-30" />
                <p className="font-medium">Completá los parámetros</p>
                <p className="text-xs mt-1 text-center max-w-xs">
                  Ingresá el ID de la OT, configurá opciones y presioná "Asignar" para que el algoritmo encuentre el mecánico óptimo
                </p>
              </div>
            )}

            {assignMut.isError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{assignMut.error.message}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {ToastContainer}
    </div>
  );
}
