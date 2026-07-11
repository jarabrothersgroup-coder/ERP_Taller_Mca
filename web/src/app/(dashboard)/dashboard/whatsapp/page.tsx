"use client";

import * as React from "react";
import {
  MessageSquare,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  FileText,
  Download,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { fetchWhatsAppMessages, type UIMappedWhatsAppMessage } from "@/lib/data-service";

/* ── Types ──────────────────────────────────── */

interface WAMessageRecord extends UIMappedWhatsAppMessage {
  // Extended from base type
}

/* ── Status Configuration ───────────────────── */

const statusConfig: Record<string, { label: string; variant: "success" | "destructive" | "secondary" | "warning"; icon: React.ElementType }> = {
  SENT: { label: "Enviado", variant: "success", icon: CheckCircle2 },
  FAILED: { label: "Fallido", variant: "destructive", icon: XCircle },
  PENDING: { label: "Pendiente", variant: "warning", icon: Clock },
};

/* ── Mock Data ──────────────────────────────── */

const nombresClientes = [
  "María González", "Pedro López", "Juan Pérez", "Lucía Fernández",
  "Carlos Ruiz", "Ana Martínez", "Roberto Sánchez", "Laura Gómez",
];

const plantillas = ["RECEPCIONADO", "PRESUPUESTADO", "EN_REPARACION", "LISTO_ENTREGA", "FINALIZADO_RETIRADO", "CUSTOM"];

function getMockMessages(): WAMessageRecord[] {
  return Array.from({ length: 24 }, (_, i) => {
    const statuses: WAMessageRecord["status"][] = ["SENT", "SENT", "SENT", "FAILED", "SENT", "PENDING", "SENT", "SENT"];
    const daysAgo = Math.floor(Math.random() * 14);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const template = plantillas[i % plantillas.length];
    const hasAttach = template === "PRESUPUESTADO" && i % 3 === 0;

    return {
      id: `wa-${String(i + 1).padStart(4, "0")}`,
      clienteName: nombresClientes[i % nombresClientes.length],
      phoneNumber: `+595 981 ${String(100000 + i * 7).slice(0, 6)}`,
      template,
      messageText: hasAttach
        ? "Presupuesto adjunto en PDF"
        : template === "RECEPCIONADO"
          ? "Su vehículo fue recibido en nuestro taller"
          : template === "PRESUPUESTADO"
            ? "Su presupuesto está listo"
            : template === "EN_REPARACION"
              ? "Su vehículo está en reparación"
              : template === "LISTO_ENTREGA"
                ? "Su vehículo está listo para retirar"
                : template === "FINALIZADO_RETIRADO"
                  ? "Gracias por su visita. Califique su experiencia"
                  : "Mensaje personalizado",
      status: statuses[i % statuses.length],
      sentAt: date.toLocaleDateString("es-PY") + " " + `${8 + (i % 9)}:${String((i * 7) % 60).padStart(2, "0")}`,
      hasAttachment: hasAttach,
      errorMessage: statuses[i % statuses.length] === "FAILED" ? "Error de conexión con Evolution API" : null,
    };
  });
}

/* ── Stats Cards ────────────────────────────── */

function WAMessageStats({ messages }: { messages: WAMessageRecord[] }) {
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

/* ── Connection Status Card ─────────────────── */

function ConnectionStatus() {
  const [connected, setConnected] = React.useState(true);

  return (
    <Card className={cn(
      "border-l-4",
      connected ? "border-l-emerald-500" : "border-l-destructive"
    )}>
      <CardContent className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            connected ? "bg-emerald-500/10" : "bg-destructive/10"
          )}>
            {connected ? (
              <Wifi className="h-5 w-5 text-emerald-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-destructive" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">
              {connected ? "WhatsApp Conectado" : "WhatsApp Desconectado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {connected ? "Instancia activa — Evolution API" : "Escanee el código QR para conectar"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!connected && (
            <Button variant="outline" size="sm" className="gap-1.5">
              <Smartphone className="h-3.5 w-3.5" />
              Escanear QR
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setConnected(!connected)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {connected ? "Desconectar" : "Reconectar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Columns ────────────────────────────────── */

const columns: Column<WAMessageRecord>[] = [
  {
    header: "Cliente",
    accessor: "clienteName",
    sortable: true,
    cell: (_, row) => (
      <div>
        <p className="font-medium">{row.clienteName}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Phone className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">{row.phoneNumber}</span>
        </div>
      </div>
    ),
  },
  {
    header: "Plantilla",
    accessor: "template",
    sortable: true,
    hideOnMobile: true,
    cell: (_, row) => (
      <Badge variant="secondary" className="font-mono text-[10px]">
        {row.template === "CUSTOM" ? "Personalizado" : row.template}
      </Badge>
    ),
  },
  {
    header: "Mensaje",
    accessor: "messageText",
    className: "max-w-xs",
    cell: (value) => (
      <p className="text-xs text-muted-foreground truncate">{value as string}</p>
    ),
  },
  {
    header: "Estado",
    accessor: "status",
    sortable: true,
    sortKey: "status",
    cell: (_, row) => {
      const config = statusConfig[row.status];
      return (
        <Badge variant={config.variant} className="gap-1">
          <config.icon className="h-3 w-3" aria-hidden="true" />
          {config.label}
        </Badge>
      );
    },
  },
  {
    header: "Adjunto",
    accessor: "hasAttachment",
    cell: (_, row) => (
      row.hasAttachment ? (
        <div className="flex items-center gap-1">
          <FileText className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
          <span className="text-xs text-orange-500">PDF</span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )
    ),
  },
  {
    header: "Envío",
    accessor: "sentAt",
    sortable: true,
    className: "text-xs",
  },
];

/* ── Main Page ──────────────────────────────── */

export default function WhatsAppPage() {
  const [loading, setLoading] = React.useState(true);
  const [messages, setMessages] = React.useState<WAMessageRecord[]>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    fetchWhatsAppMessages(getMockMessages).then((data) => {
      if (!cancelled) {
        setMessages(data as WAMessageRecord[]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = React.useMemo(() => {
    let result = messages;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.clienteName.toLowerCase().includes(q) ||
          m.phoneNumber.includes(q) ||
          m.messageText.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      result = result.filter((m) => m.status === statusFilter);
    }
    return result;
  }, [messages, search, statusFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Mensajería y notificaciones para clientes
          </p>
        </div>
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Send className="h-5 w-5" aria-hidden="true" />
          Nuevo Mensaje
        </Button>
      </div>

      {/* Connection Status */}
      {!loading && <ConnectionStatus />}

      {/* Stats */}
      {!loading && <WAMessageStats messages={filtered} />}

      {/* Filter tabs */}
      {!loading && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
          <Button
            variant={statusFilter === "" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter("")}
            role="tab"
            aria-selected={statusFilter === ""}
          >
            Todos
          </Button>
          {Object.entries(statusConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={statusFilter === key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(key)}
              className="gap-1.5"
              role="tab"
              aria-selected={statusFilter === key}
            >
              <config.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {config.label}
            </Button>
          ))}
        </div>
      )}

      {/* Data Table */}
      <DataTable<WAMessageRecord>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={
          search || statusFilter
            ? "No se encontraron mensajes con esos filtros"
            : "No hay mensajes enviados"
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar cliente, teléfono o mensaje…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
        actions={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar
          </Button>
        }
      />
    </div>
  );
}
