"use client";

import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useBackups, useExecuteBackup } from "@/hooks/use-data";
import { api } from "@/lib/api";
import { ErrorState } from "@/components/ui/error-state";
import { useErrorToast } from "@/hooks/use-error-toast";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, Download, Trash2, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface BackupListResponse {
  backups: Array<{
    filename: string;
    filePath: string;
    size: number;
    sizeFormatted: string;
    createdAt: string;
    isEncrypted: boolean;
  }>;
  total: number;
}

interface BackupValidateResult {
  valid: boolean;
  size?: number;
  checksum?: string;
  error?: string;
}

export default function BackupPage() {
  const { data: backups = [], isLoading, isError, error, refetch } = useBackups();
  // T-53: feedback visible al fallar la carga
  useErrorToast(isError, "los backups");
  const { toast: t, ToastContainer } = useToast();

  // GET /backup/list — filePath del listado para validate
  const listQuery = useQuery<BackupListResponse>({
    queryKey: ["backup-list-paths"],
    queryFn: () => api.request<BackupListResponse>("/backup/list"),
  });

  // POST /backup/validate — validación de integridad
  const validateMut = useMutation({
    mutationFn: (filePath: string) =>
      api.request<BackupValidateResult>("/backup/validate", {
        method: "POST",
        body: JSON.stringify({ filePath }),
      }),
    onSuccess: (d) => {
      if (d.valid) {
        t.success(`Backup válido — ${formatBytes(d.size ?? 0)} · checksum ${d.checksum?.slice(0, 8)}…`);
      } else {
        t.error(`Backup inválido: ${d.error}`);
      }
    },
    onError: (err: Error) => t.error(err.message),
  });

  if (isError) {
    return (
      <ErrorState
        title="No se pudo cargar los backups"
        message={error instanceof Error ? error.message : undefined}
        onRetry={refetch}
        className="min-h-[50vh] justify-center"
      />
    );
  }

  const executeBackup = useExecuteBackup();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {ToastContainer}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup & Restore</h1>
          <p className="text-sm text-muted-foreground">Copias de seguridad automáticas y manuales</p>
        </div>
        <Button
          className="gap-2"
          onClick={() => executeBackup.mutate()}
          disabled={executeBackup.isPending}
        >
          <Database className="h-4 w-4" />
          {executeBackup.isPending ? "Creando..." : "Crear Backup"}
        </Button>
      </div>

      {backups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay backups registrados</p>
            <p className="text-xs text-muted-foreground mt-1">Creá tu primer backup manual</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backups Recientes</CardTitle>
            <CardDescription>{backups.length} backups almacenados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {backups.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{b.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(b.size)} — {new Date(b.createdAt).toLocaleString("es-PY")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={b.status === "COMPLETED" ? "success" : "secondary"}>{b.status}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Validar integridad"
                      loading={validateMut.isPending && validateMut.variables === listQuery.data?.backups.find((x) => x.filename === b.filename)?.filePath}
                      onClick={() => {
                        const filePath = listQuery.data?.backups.find((x) => x.filename === b.filename)?.filePath;
                        if (filePath) validateMut.mutate(filePath);
                        else t.error("No se encontró la ruta del archivo");
                      }}
                    >
                      {validateMut.isSuccess && validateMut.variables === listQuery.data?.backups.find((x) => x.filename === b.filename)?.filePath && validateMut.data?.valid ? (
                        <ShieldCheck className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <ShieldAlert className="h-3 w-3" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
