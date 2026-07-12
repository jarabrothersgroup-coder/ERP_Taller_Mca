import * as React from "react";
import { MessageSquare, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, RefreshCw, Smartphone } from "lucide-react";
import type { UIMappedWhatsAppMessage as WAMessageRecord } from "@/lib/data-service";

export const statusConfig: Record<string, { label: string; variant: "success" | "destructive" | "secondary" | "warning"; icon: React.ElementType }> = {
  SENT: { label: "Enviado", variant: "success", icon: CheckCircle2 },
  FAILED: { label: "Fallido", variant: "destructive", icon: XCircle },
  PENDING: { label: "Pendiente", variant: "warning", icon: Clock },
};

export function WAMessageStats({ messages }: { messages: WAMessageRecord[] }) {
  const total = messages.length;
  const sent = messages.filter((m) => m.status === "SENT").length;
  const failed = messages.filter((m) => m.status === "FAILED").length;
  const pending = messages.filter((m) => m.status === "PENDING").length;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Mensajes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{total}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Enviados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold text-emerald-500">{sent}</p>
          </div>
        </CardContent>
      </Card>
      <Card className={cn(failed > 0 && "border-destructive/30")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Fallidos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", failed > 0 && "text-destructive")}>{failed}</p>
        </CardContent>
      </Card>
      <Card className={cn(pending > 0 && "border-amber-200 dark:border-amber-800")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", pending > 0 && "text-amber-500")}>{pending}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function ConnectionStatus() {
  const [connected, setConnected] = React.useState(true);

  return (
    <Card className={cn("border-l-4", connected ? "border-l-emerald-500" : "border-l-destructive")}>
      <CardContent className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", connected ? "bg-emerald-500/10" : "bg-destructive/10")}>
            {connected ? <Wifi className="h-5 w-5 text-emerald-500" /> : <WifiOff className="h-5 w-5 text-destructive" />}
          </div>
          <div>
            <p className="text-sm font-medium">{connected ? "WhatsApp Conectado" : "WhatsApp Desconectado"}</p>
            <p className="text-xs text-muted-foreground">{connected ? "Instancia activa — Evolution API" : "Escanee el código QR para conectar"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!connected && (
            <Button variant="outline" size="sm" className="gap-1.5">
              <Smartphone className="h-3.5 w-3.5" />
              Escanear QR
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConnected(!connected)}>
            <RefreshCw className="h-3.5 w-3.5" />
            {connected ? "Desconectar" : "Reconectar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
