"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useWhatsAppMessages } from "@/hooks/use-data";
import { ErrorState } from "@/components/ui/error-state";
import { useErrorToast } from "@/hooks/use-error-toast";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { WAMessageStats, ConnectionStatus, statusConfig } from "./stats";
import { columns } from "./columns";
import { SendMessageDialog } from "./send-message-dialog";
import type { UIMappedWhatsAppMessage as WAMessageRecord } from "@/lib/data-service";

interface WaErrorLog {
  id: string;
  errorType: string;
  errorMessage: string;
  resolved: boolean;
  createdAt: string;
}

export default function WhatsAppPage() {
  const { data: messages = [], isLoading: loading, isError, error, refetch } = useWhatsAppMessages();
  // T-53: feedback visible al fallar la carga
  useErrorToast(isError, "los mensajes de WhatsApp");
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();

  // GET /whatsapp/errors (T-63 S126)
  const { data: errorsData } = useQuery<{ items: WaErrorLog[] }>({
    queryKey: ["whatsapp-errors"],
    queryFn: () => api.request("/whatsapp/errors?limit=20") as any,
  });

  // POST /whatsapp/errors/:errorId/resolve (T-63 S126)
  const resolveMut = useMutation({
    mutationFn: (errorId: string) =>
      api.request(`/whatsapp/errors/${errorId}/resolve`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-errors"] });
      t.success("Error marcado como resuelto");
    },
    onError: (err: any) => t.error(err?.message || "No se pudo resolver el error"),
  });

  // DELETE /whatsapp/instance (T-63 S126)
  const deleteInstanceMut = useMutation({
    mutationFn: () => api.request("/whatsapp/instance", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-errors"] });
      t.success("Instancia eliminada");
    },
    onError: (err: any) => t.error(err?.message || "No se pudo eliminar la instancia"),
  });

  if (isError) {
    return (
      <ErrorState
        title="No se pudo cargar los mensajes de WhatsApp"
        message={error instanceof Error ? error.message : undefined}
        onRetry={refetch}
        className="min-h-[50vh] justify-center"
      />
    );
  }
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Mensajería y notificaciones para clientes</p>
        </div>
        <SendMessageDialog />
      </div>

      {!loading && <ConnectionStatus />}
      {!loading && <WAMessageStats messages={filtered} />}

      {!loading && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
          <Button variant={statusFilter === "" ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter("")} role="tab" aria-selected={statusFilter === ""}>
            Todos
          </Button>
          {Object.entries(statusConfig).map(([key, config]) => (
            <Button key={key} variant={statusFilter === key ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter(key)} className="gap-1.5" role="tab" aria-selected={statusFilter === key}>
              <config.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {config.label}
            </Button>
          ))}
        </div>
      )}

      <DataTable<WAMessageRecord>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={search || statusFilter ? "No se encontraron mensajes con esos filtros" : "No hay mensajes enviados"}
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar cliente, teléfono o mensaje…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
        actions={<Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" aria-hidden="true" />Exportar</Button>}
      />

      {/* Errores sin resolver (T-63 S126) */}
      {(errorsData?.items?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
              Errores sin resolver ({errorsData!.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {errorsData!.items.map((err) => (
                <div key={err.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{err.errorType}</p>
                    <p className="text-xs text-muted-foreground truncate">{err.errorMessage}</p>
                  </div>
                  <Button
                    variant="outline" size="sm" className="gap-1.5 shrink-0"
                    onClick={() => resolveMut.mutate(err.id)}
                    disabled={resolveMut.isPending}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Resolver
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zona de instancia (T-63 S126) */}
      <Card className="border-destructive/30">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium">Eliminar instancia de WhatsApp</p>
            <p className="text-xs text-muted-foreground">Desconecta y borra la instancia actual del taller</p>
          </div>
          <Button
            variant="destructive" size="sm" className="gap-1.5"
            onClick={() => { if (confirm("¿Eliminar la instancia de WhatsApp? Esta acción desconecta el número.")) deleteInstanceMut.mutate(); }}
            disabled={deleteInstanceMut.isPending}
            loading={deleteInstanceMut.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Eliminar instancia
          </Button>
        </CardContent>
      </Card>

      {ToastContainer}
    </div>
  );
}
