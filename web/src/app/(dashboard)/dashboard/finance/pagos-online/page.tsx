"use client";

import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, CheckCircle2, Copy, ExternalLink, DollarSign, Clock, RefreshCw, History, TrendingUp } from "lucide-react";
import type { Column } from "@/components/ui/data-table";

interface PaymentLinkResult {
  paymentUrl: string;
  provider: string;
  facturaId: string;
}

interface CxCItem {
  id: string;
  facturaId: string;
  clienteNombre: string;
  total: number;
  saldoPendiente: number;
  fechaVencimiento: string;
  diasVencido: number;
}

export default function PagosOnlinePage() {
  const { toast: t, ToastContainer } = useToast();
  const [facturaId, setFacturaId] = React.useState("");
  const [provider, setProvider] = React.useState<"STRIPE" | "PAGOS_PY">("STRIPE");
  const [linkResult, setLinkResult] = React.useState<PaymentLinkResult | null>(null);

  // Fetch pending invoices (CxC)
  const { data: cxcItems = [], isLoading: loadingCxc, refetch: refetchCxc } = useQuery({
    queryKey: ["pagos-online-cxc"],
    queryFn: () => api.listCxcPendientes(),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await api.request<PaymentLinkResult>("/finance/payments/link", {
        method: "POST",
        body: JSON.stringify({ facturaId, provider }),
      });
      return result;
    },
    onSuccess: (data) => {
      setLinkResult(data);
      t.success("Link de pago generado correctamente");
    },
    onError: (err: Error) => t.error(err.message),
  });

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      t.success("Link copiado al portapapeles");
    } catch { /* clipboard not available */ }
  };

  const totalPending = cxcItems.reduce((sum, item) => sum + item.saldoPendiente, 0);
  const vencidos = cxcItems.filter((item) => item.diasVencido > 0);

  const cxcColumns: Column<CxCItem>[] = [
    { header: "Cliente", accessor: "clienteNombre", cell: (_, row) => <span className="font-medium">{row.clienteNombre}</span> },
    { header: "Total", accessor: "total", className: "text-right font-mono", cell: (_, row) => `Gs. ${row.total.toLocaleString("es-PY")}` },
    { header: "Saldo", accessor: "saldoPendiente", className: "text-right font-mono", cell: (_, row) => <span className="text-amber-500">Gs. {row.saldoPendiente.toLocaleString("es-PY")}</span> },
    { header: "Vencimiento", accessor: "fechaVencimiento", className: "text-xs", cell: (_, row) => row.fechaVencimiento || "—" },
    {
      header: "Estado",
      accessor: "diasVencido",
      className: "text-center",
      cell: (_, row) => row.diasVencido > 0 ? <Badge variant="destructive">{row.diasVencido}d vencido</Badge> : <Badge variant="secondary">Al día</Badge>,
    },
    {
      header: "Link",
      accessor: "facturaId",
      className: "text-right",
      cell: (_, row) => (
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => {
            setFacturaId(row.facturaId);
            setProvider("STRIPE");
            generateMutation.mutate();
          }}
        >
          <CreditCard className="h-3 w-3" />
          Link
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-purple-500" />
          Pagos Online
        </h1>
        <p className="text-sm text-muted-foreground">Stripe / PagosPy — Links de pago y reconciliación automática</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              Pendiente Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">Gs. {totalPending.toLocaleString("es-PY")}</p>
            <p className="text-xs text-muted-foreground mt-1">{cxcItems.length} facturas pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              Facturas Vencidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{vencidos.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Requieren atención inmediata</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Reconciliación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500">Automática</p>
            <p className="text-xs text-muted-foreground mt-1">Webhooks Stripe + PagosPy</p>
          </CardContent>
        </Card>
      </div>

      {/* Link Result */}
      {linkResult && (
        <Card className="border-emerald-500/50">
          <CardContent className="flex items-start gap-4 py-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Link de Pago Generado</p>
              <code className="mt-2 block text-xs bg-muted p-2 rounded break-all font-mono">{linkResult.paymentUrl}</code>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyToClipboard(linkResult.paymentUrl)}>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => window.open(linkResult.paymentUrl, "_blank")}>
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setLinkResult(null)}>
                  Nueva Generación
                </Button>
              </div>
              <div className="flex gap-2 mt-3">
                <Badge variant="outline" className="text-xs">{linkResult.provider}</Badge>
                <Badge variant="secondary" className="text-xs">Factura: {linkResult.facturaId.substring(0, 8)}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generator + History Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Payment Link Generator */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2.5 border bg-purple-500/10 text-purple-500 border-purple-500/20">
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-base">Generar Link de Pago</CardTitle>
                <CardDescription>Seleccione la factura y el proveedor</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => { e.preventDefault(); generateMutation.mutate(); }}
              className="space-y-4"
            >
              <FormField label="ID de Factura" htmlFor="factura-id" required>
                <div className="flex gap-2">
                  <Input
                    id="factura-id"
                    placeholder="UUID de la factura..."
                    value={facturaId}
                    onChange={(e) => setFacturaId(e.target.value)}
                    required
                    className="flex-1"
                  />
                </div>
              </FormField>

              <FormField label="Proveedor de Pago" htmlFor="provider">
                <Select
                  id="provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as "STRIPE" | "PAGOS_PY")}
                >
                  <option value="STRIPE">Stripe (Tarjetas internacionales)</option>
                  <option value="PAGOS_PY">PagosPy (Efectivo / Transferencia PY)</option>
                </Select>
              </FormField>

              <Button
                type="submit"
                size="lg"
                className="w-full gap-2"
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? "Generando..." : "Generar Link de Pago"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-blue-500" />
              Flujo de Reconciliación
            </CardTitle>
            <CardDescription>Cómo funcionan los pagos online</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { step: "1", title: "Generar Link", desc: "Ingresá el ID de la factura y seleccioná Stripe o PagosPy. El sistema genera un link de pago único.", icon: CreditCard },
                { step: "2", title: "Enviar al Cliente", desc: "Copiá el link y envialo al cliente vía WhatsApp, email o SMS. El cliente paga con tarjeta (Stripe) o efectivo/transferencia (PagosPy).", icon: ExternalLink },
                { step: "3", title: "Webhook Automático", desc: "Stripe o PagosPy notifican al sistema cuando el pago se completa. El webhook procesa el cobro sin intervención manual.", icon: RefreshCw },
                { step: "4", title: "Reconciliación", desc: "El sistema registra el pago, actualiza el saldo de la factura, genera el asiento contable y actualiza la cuenta bancaria automáticamente.", icon: CheckCircle2 },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="h-7 w-7 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-xs font-bold shrink-0">
                    {item.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Invoices Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-blue-500" />
                Facturas Pendientes
              </CardTitle>
              <CardDescription>Seleccioná una factura para generar su link de pago</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetchCxc()}>
              <RefreshCw className="h-3.5 w-3.5" /> Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable<CxCItem>
            columns={cxcColumns}
            data={cxcItems}
            rowKey="facturaId"
            loading={loadingCxc}
            emptyMessage="No hay facturas pendientes. Todas las facturas están al día."
            paginate
            pageSize={8}
            sortable
            className="shadow-sm"
            stickyHeader
          />
        </CardContent>
      </Card>

      {ToastContainer}
    </div>
  );
}
