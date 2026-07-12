"use client";

import * as React from "react";
import { useBackups, useExecuteBackup } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, Download, Trash2, RefreshCw } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function BackupPage() {
  const { data: backups = [], isLoading } = useBackups();
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
