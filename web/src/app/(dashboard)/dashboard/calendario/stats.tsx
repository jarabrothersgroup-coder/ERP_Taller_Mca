import { Calendar, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UIMappedAppointment as AppointmentRecord } from "@/lib/data-service";

export const statusConfig: Record<string, { label: string; variant: "secondary" | "default" | "warning" | "success" | "destructive"; icon: React.ElementType }> = {
  RESERVADO: { label: "Reservado", variant: "secondary", icon: Clock },
  CONFIRMADO: { label: "Confirmado", variant: "success", icon: CheckCircle2 },
  PROCESADO_EN_ERP: { label: "En ERP", variant: "default", icon: Calendar },
  AUSENTE: { label: "Ausente", variant: "destructive", icon: XCircle },
  CANCELADO: { label: "Cancelado", variant: "warning", icon: AlertTriangle },
};

export const serviceTypeLabels: Record<string, string> = { RAPIDO: "Rápido", PESADO: "Pesado" };
export const serviceTypeVariants: Record<string, "secondary" | "default"> = { RAPIDO: "secondary", PESADO: "default" };

export function ScheduleStats({ appointments }: { appointments: AppointmentRecord[] }) {
  const reservados = appointments.filter((a) => a.estado === "RESERVADO").length;
  const confirmados = appointments.filter((a) => a.estado === "CONFIRMADO").length;
  const ausentes = appointments.filter((a) => a.estado === "AUSENTE").length;
  const enErp = appointments.filter((a) => a.estado === "PROCESADO_EN_ERP").length;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Reservados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{reservados}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Pendientes de confirmación</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Confirmados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold text-emerald-500">{confirmados}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Listos para atender</p>
        </CardContent>
      </Card>
      <Card className={cn(enErp > 0 && "border-blue-200 dark:border-blue-800")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">En ERP</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-blue-500">{enErp}</p>
          <p className="text-xs text-muted-foreground mt-1">Procesados como OT</p>
        </CardContent>
      </Card>
      <Card className={cn(ausentes > 0 && "border-destructive/30")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
            Ausentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", ausentes > 0 && "text-destructive")}>{ausentes}</p>
        </CardContent>
      </Card>
    </div>
  );
}
