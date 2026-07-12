import { Activity, ShieldCheck, ShieldAlert, FileText, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UIMappedAuditEntry as AuditRecord } from "@/lib/data-service";

export const actionConfig: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" | "default"; icon: React.ElementType }> = {
  CREAR: { label: "Crear", variant: "success", icon: ShieldCheck },
  MODIFICAR: { label: "Modificar", variant: "warning", icon: Activity },
  ANULAR: { label: "Anular", variant: "destructive", icon: ShieldAlert },
  PAGAR: { label: "Pagar", variant: "default", icon: Eye },
  EMITIR: { label: "Emitir", variant: "secondary", icon: FileText },
};

export const entityColors: Record<string, string> = {
  OT: "text-blue-500 bg-blue-500/10",
  FACTURA: "text-emerald-500 bg-emerald-500/10",
  ASIENTO: "text-violet-500 bg-violet-500/10",
  PAGO: "text-orange-500 bg-orange-500/10",
  REPUESTO: "text-amber-500 bg-amber-500/10",
  USUARIO: "text-red-500 bg-red-500/10",
  CLIENTE: "text-cyan-500 bg-cyan-500/10",
};

export function AuditStats({ entries }: { entries: AuditRecord[] }) {
  const total = entries.length;
  const creaciones = entries.filter((e) => e.accion === "CREAR").length;
  const anulaciones = entries.filter((e) => e.accion === "ANULAR").length;
  const entidadesUnicas = [...new Set(entries.map((e) => e.entidad))].length;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Eventos Totales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{total}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Últimos 30 días</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Creaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold text-emerald-500">{creaciones}</p>
          </div>
        </CardContent>
      </Card>
      <Card className={cn(anulaciones > 0 && "border-destructive/30")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
            Anulaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", anulaciones > 0 && "text-destructive")}>{anulaciones}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Entidades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{entidadesUnicas}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
