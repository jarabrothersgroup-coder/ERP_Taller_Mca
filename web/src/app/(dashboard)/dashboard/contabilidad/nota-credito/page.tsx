"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { getTenantSlug } from "@/lib/api";
import { FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export default function NotaCreditoPage() {
  const [cdcOriginal, setCdcOriginal] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const [monto, setMonto] = React.useState("");
  const [result, setResult] = React.useState<{ success: boolean; notaDocumentoId?: string; cdcNota?: string; error?: string } | null>(null);

  const emitNCMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/finance/sifen/nota-credito", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": getTenantSlug() },
        body: JSON.stringify({
          cdcOriginal,
          motivo,
          monto: monto ? Number(monto) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Error al emitir NC");
      return data;
    },
    onSuccess: (data) => setResult(data),
    onError: (err: Error) => setResult({ success: false, error: err.message }),
  });

  const resetForm = () => {
    setCdcOriginal("");
    setMotivo("");
    setMonto("");
    setResult(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nota de Crédito SIFEN</h1>
        <p className="text-sm text-muted-foreground">Emitir Nota de Crédito Electrónica con reversión contable automática</p>
      </div>

      {result && (
        <Card className={result.success ? "border-emerald-500/50" : "border-destructive/50"}>
          <CardContent className="flex items-start gap-4 py-4">
            {result.success ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-semibold">{result.success ? "NC Emitida Exitosamente" : "Error al emitir NC"}</p>
              {result.success ? (
                <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                  <li><strong>Documento ID:</strong> {result.notaDocumentoId}</li>
                  {result.cdcNota && <li><strong>CDC:</strong> <code className="text-xs">{result.cdcNota}</code></li>}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-destructive">{result.error}</p>
              )}
              <Button variant="outline" size="sm" onClick={resetForm} className="mt-3">Nueva NC</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2.5 border bg-red-500/10 text-red-500 border-red-500/20">
                <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-base">Datos de la Nota de Crédito</CardTitle>
                <CardDescription>Ingrese el CDC del DTE original a notar y el motivo</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); emitNCMutation.mutate(); }} className="space-y-4">
              <FormField label="CDC del DTE Original" htmlFor="cdc" required helperText="Código de Control de 44 dígitos">
                <Input id="cdc" placeholder="00000000000000000000000000000000000000000000" value={cdcOriginal} onChange={(e) => setCdcOriginal(e.target.value)} required minLength={44} maxLength={44} className="font-mono text-sm" />
              </FormField>

              <FormField label="Motivo de la NC" htmlFor="motivo" required>
                <Textarea id="motivo" placeholder="Ej: Anulación por error en facturación, descuento otorgado..." value={motivo} onChange={(e) => setMotivo(e.target.value)} required rows={3} />
              </FormField>

              <FormField label="Monto (opcional)" htmlFor="monto" helperText="Si se omite, se replica el total del DTE original">
                <Input id="monto" type="number" placeholder="Dejar vacío para usar el total original" value={monto} onChange={(e) => setMonto(e.target.value)} />
              </FormField>

              <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  La NC generará un asiento contable de reversión y se enviará a DNIT. Esta acción no se puede deshacer.
                </p>
              </div>

              <Button type="submit" size="lg" className="w-full gap-2" loading={emitNCMutation.isPending}>
                {emitNCMutation.isPending ? "Emitiendo NC..." : "Emitir Nota de Crédito"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
