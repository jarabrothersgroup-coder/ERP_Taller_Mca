import { FileText, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UIMappedInvoice } from "@/lib/data-service";

export function InvoiceStats({ invoices }: { invoices: UIMappedInvoice[] }) {
  const totalEmitidas = invoices.length;
  const totalPendiente = invoices
    .filter((i) => i.estadoPago === "PENDIENTE" && i.estado !== "ANULADA")
    .reduce((sum, i) => sum + i.total, 0);
  const vencidas = invoices.filter((i) => i.estado === "VENCIDA").length;
  const emitidasEsteMes = invoices.filter((i) => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const invDate = new Date(i.fechaEmision.split("/").reverse().join("-"));
    return invDate >= monthStart;
  }).length;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Facturas Emitidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{totalEmitidas}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{emitidasEsteMes} este mes</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Por Cobrar</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">₲ {(totalPendiente / 1_000_000).toFixed(1)}M</p>
        </CardContent>
      </Card>
      <Card className={cn(vencidas > 0 && "border-destructive/30")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
            Vencidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", vencidas > 0 && "text-destructive")}>{vencidas}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Electrónicas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{invoices.filter((i) => i.tipo === "ELECTRONICA").length}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
