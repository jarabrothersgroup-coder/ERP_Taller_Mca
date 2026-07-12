"use client";

import * as React from "react";
import { useSecurityHWStatus } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Fingerprint, Usb, Key, AlertTriangle, CheckCircle } from "lucide-react";

export default function SecurityHWPage() {
  const { data: status, isLoading } = useSecurityHWStatus();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Seguridad de Hardware</h1>
        <p className="text-sm text-muted-foreground">Kill Switch, tokens USB y fingerprint del servidor</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* HW Lock Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" /> HW Lock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {status?.hwLockEnabled ? (
                <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" /> Activo</Badge>
              ) : (
                <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" /> Inactivo</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Valida USB + token en cada request
            </p>
          </CardContent>
        </Card>

        {/* Fingerprint */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Fingerprint className="h-4 w-4" /> Fingerprint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono truncate">
              {status?.fingerprint ?? "No registrado"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Identificador único del servidor</p>
          </CardContent>
        </Card>

        {/* USB Tokens */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Usb className="h-4 w-4" /> Tokens USB
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{status?.usbTokens ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Tokens registrados</p>
          </CardContent>
        </Card>

        {/* Last Validation */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Key className="h-4 w-4" /> Última Validación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {status?.lastValidation
                ? new Date(status.lastValidation).toLocaleString("es-PY")
                : "Sin validaciones"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" className="gap-2">
              <Fingerprint className="h-4 w-4" /> Generar Token
            </Button>
            <Button variant="outline" className="gap-2">
              <Usb className="h-4 w-4" /> Verificar USB
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
