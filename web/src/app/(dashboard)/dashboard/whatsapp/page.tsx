"use client";

import * as React from "react";
import { Send, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { useWhatsAppMessages } from "@/hooks/use-data";
import { WAMessageStats, ConnectionStatus, statusConfig } from "./stats";
import { columns } from "./columns";
import type { UIMappedWhatsAppMessage as WAMessageRecord } from "@/lib/data-service";

export default function WhatsAppPage() {
  const { data: messages = [], isLoading: loading } = useWhatsAppMessages();
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
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Send className="h-5 w-5" aria-hidden="true" />
          Nuevo Mensaje
        </Button>
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
    </div>
  );
}
