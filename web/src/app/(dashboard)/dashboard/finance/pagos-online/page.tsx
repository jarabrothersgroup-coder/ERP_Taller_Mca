"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getTenantSlug } from "@/lib/api";
import { CreditCard, CheckCircle2, Copy, ExternalLink } from "lucide-react";

export default function PagosOnlinePage() {
  const [facturaId, setFacturaId] = React.useState("");
  const [provider, setProvider] = React.useState<"STRIPE" | "PAGOS_PY">("STRIPE");
  const [linkResult, setLinkResult] = React.useState<{ paymentUrl: string; provider: string } | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/finance/payments/link", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": getTenantSlug() },
        body: JSON.stringify({ facturaId, provider }),
      });
      if (!res.ok) throw new Error("Error generando link de pago");
      return res.json();
    },
    onSuccess: (data) => setLinkResult(data),
  });

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch { /* clipboard not available */ }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pagos Online</h1>
        <p className="text-sm text-muted-foreground">Generar links de pago Stripe / PagosPy para facturas</p>
      </div>

      {linkResult && (
        <Card className="border-emerald-500/50">
          <CardContent className="flex items-start gap-4 py-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Link de Pago Generado</p>
              <code className="mt-2 block text-xs bg-muted p-2 rounded break-all">{linkResult.paymentUrl}</code>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyToClipboard(linkResult.paymentUrl)}>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => window.open(linkResult.paymentUrl, "_blank")}>
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir
                </Button>
              </div>
              <Badge variant="outline" className="mt-3">{linkResult.provider}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {!linkResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2.5 border bg-purple-500/10 text-purple-500 border-purple-500/20">
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-base">Generar Link de Pago</CardTitle>
                <CardDescription>Seleccione la factura y el proveedor de pago</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); generateMutation.mutate(); }} className="space-y-4">
              <FormField label="ID de Factura" htmlFor="factura-id" required>
                <Input id="factura-id" placeholder="uuid de la factura" value={facturaId} onChange={(e) => setFacturaId(e.target.value)} required />
              </FormField>

              <FormField label="Proveedor de Pago" htmlFor="provider">
                <Select id="provider" value={provider} onChange={(e) => setProvider(e.target.value as "STRIPE" | "PAGOS_PY")}>
                  <option value="STRIPE">Stripe (Tarjetas internacionales)</option>
                  <option value="PAGOS_PY">PagosPy (Efectivo / Transferencia PY)</option>
                </Select>
              </FormField>

              <Button type="submit" size="lg" className="w-full gap-2" loading={generateMutation.isPending}>
                {generateMutation.isPending ? "Generando..." : "Generar Link de Pago"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
