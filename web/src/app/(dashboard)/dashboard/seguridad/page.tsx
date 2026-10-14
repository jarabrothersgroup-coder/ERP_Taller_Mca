"use client";

import * as React from "react";
import { ShieldAlert, ShieldCheck, Download, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useAuditLog } from "@/hooks/use-data";
import { api } from "@/lib/api";
import { ErrorState } from "@/components/ui/error-state";
import { useErrorToast } from "@/hooks/use-error-toast";
import { AuditStats, actionConfig } from "./stats";
import { TwoFactorCard } from "./two-factor-card";
import { columns } from "./columns";
import type { UIMappedAuditEntry as AuditRecord } from "@/lib/data-service";

type VerifyResult = { valid: boolean; verified: number; brokenAt?: string };

export default function SeguridadPage() {
  const { data: entries = [], isLoading: loading, isError, error, refetch } = useAuditLog();
  // T-53: feedback visible al fallar la carga
  useErrorToast(isError, "el registro de auditoría");
  const [exporting, setExporting] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [verifyResult, setVerifyResult] = React.useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await api.downloadFile("/audit/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setExporting(false);
    }
  };

  // GET /export/audit-log — export CSV filtrado por acción (T-63 S126)
  const handleExportFiltered = async () => {
    setExporting(true);
    try {
      const qs = actionFilter ? `?accion=${encodeURIComponent(actionFilter)}&limit=5000` : "?limit=5000";
      const blob = await api.downloadFile("/export/audit-log" + qs);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-filtered-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "No se pudo exportar el CSV filtrado");
    } finally {
      setExporting(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await api.request<VerifyResult>("/audit/verify");
      setVerifyResult(result);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "No se pudo verificar la integridad");
    } finally {
      setVerifying(false);
    }
  };

  if (isError) {
    return (
      <ErrorState
        title="No se pudo cargar el registro de auditoría"
        message={error instanceof Error ? error.message : undefined}
        onRetry={refetch}
        className="min-h-[50vh] justify-center"
      />
    );
  }
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleVerify}
            loading={verifying}
          >
            {verifying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Verificar Integridad
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            loading={exporting}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar Auditoría
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExportFiltered}
            loading={exporting}
            title={actionFilter ? `Exportar solo acciones ${actionFilter}` : "Exportar todo el log (hasta 5000 filas)"}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar {actionFilter || "CSV"}
          </Button>
        </div>
      </div>

      {verifyResult && (
        <Alert
          variant={verifyResult.valid ? "default" : "error"}
          className={verifyResult.valid ? "border-emerald-500/30 bg-emerald-500/10" : undefined}
        >
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>
            {verifyResult.valid
              ? "Cadena de integridad verificada"
              : "Cadena de integridad rota"}
          </AlertTitle>
          <AlertDescription>
            {verifyResult.verified} registro{verifyResult.verified !== 1 ? "s" : ""} verificado
            {verifyResult.verified !== 1 ? "s" : ""} (hash chain)
            {verifyResult.brokenAt ? ` · roto en ${verifyResult.brokenAt}` : ""}
          </AlertDescription>
        </Alert>
      )}

      {verifyError && (
        <Alert variant="error">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{verifyError}</AlertDescription>
        </Alert>
      )}

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

      {!loading && <TwoFactorCard />}

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
