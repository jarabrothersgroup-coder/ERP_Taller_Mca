"use client";

import * as React from "react";
import { ShieldAlert, ShieldCheck, Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useAuditLog } from "@/hooks/use-data";
import { AuditStats, actionConfig } from "./stats";
import { columns } from "./columns";
import type { UIMappedAuditEntry as AuditRecord } from "@/lib/data-service";

export default function SeguridadPage() {
  const { data: entries = [], isLoading: loading } = useAuditLog();
  const [search, setSearch] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState("");

  const filtered = React.useMemo(() => {
    let result = entries;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.usuario.toLowerCase().includes(q) ||
          e.descripcion.toLowerCase().includes(q) ||
          e.entidad.toLowerCase().includes(q) ||
          e.entidadId.toLowerCase().includes(q)
      );
    }
    if (actionFilter) {
      result = result.filter((e) => e.accion === actionFilter);
    }
    return result;
  }, [entries, search, actionFilter]);

  const criticalActions = entries.filter((e) => e.accion === "ANULAR");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seguridad y Auditoría</h1>
          <p className="text-sm text-muted-foreground">Registro de actividad, eventos críticos y trazabilidad del sistema</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Exportar Auditoría
        </Button>
      </div>

      {criticalActions.length > 0 && !loading && (
        <Alert variant="warning">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Eventos críticos detectados</AlertTitle>
          <AlertDescription>
            {criticalActions.length} anulacion{criticalActions.length !== 1 ? "es" : ""} registrada{criticalActions.length !== 1 ? "s" : ""} en el período.
            Se recomienda revisar la trazabilidad completa.
          </AlertDescription>
        </Alert>
      )}

      {!loading && <AuditStats entries={filtered} />}

      {!loading && (
        <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
              <Lock className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Protocolo HV Lockout/Tagout</p>
              <p className="text-xs text-muted-foreground">Sistema de seguridad para vehículos HEV/BEV — Desconexión obligatoria de alto voltaje</p>
            </div>
          </div>
          <Badge variant="success" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            Protocolo Activo
          </Badge>
        </div>
      )}

      {!loading && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por acción">
          <Button variant={actionFilter === "" ? "secondary" : "ghost"} size="sm" onClick={() => setActionFilter("")} role="tab" aria-selected={actionFilter === ""}>
            Todas
          </Button>
          {Object.entries(actionConfig).map(([key, config]) => (
            <Button key={key} variant={actionFilter === key ? "secondary" : "ghost"} size="sm" onClick={() => setActionFilter(key)} className="gap-1.5" role="tab" aria-selected={actionFilter === key}>
              <config.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {config.label}
            </Button>
          ))}
        </div>
      )}

      <DataTable<AuditRecord>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={search || actionFilter ? "No se encontraron eventos con esos filtros" : "No hay eventos de auditoría registrados"}
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar usuario, entidad o descripción…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
      />
    </div>
  );
}
