"use client";

import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSecurityHWStatus } from "@/hooks/use-data";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Fingerprint, Usb, Key, AlertTriangle, CheckCircle } from "lucide-react";

interface HardwareFingerprint {
  hostname: string;
  platform: string;
  arch: string;
  motherboardUuid: string;
  cpuSerial: string;
  diskSerial: string;
}

interface UsbDevice {
  serial: string;
  model: string;
  mountPoint: string | null;
}

interface ValidateTokenResult {
  valid: boolean;
  message?: string;
}

export default function SecurityHWPage() {
  const { data: status, isLoading } = useSecurityHWStatus();

  // GET /security/hw/fingerprint (T-63 S126)
  const { data: fingerprint } = useQuery<HardwareFingerprint>({
    queryKey: ["security-hw", "fingerprint"],
    queryFn: () => api.request("/security/hw/fingerprint") as any,
  });

  // GET /security/hw/usb-devices (T-63 S126)
  const { data: usbData } = useQuery<{ devices: UsbDevice[] }>({
    queryKey: ["security-hw", "usb-devices"],
    queryFn: () => api.request("/security/hw/usb-devices") as any,
  });

  const [tokenInput, setTokenInput] = React.useState("");
  const [validateResult, setValidateResult] = React.useState<ValidateTokenResult | null>(null);

  // POST /security/hw/validate-token (T-63 S126)
  const validateMut = useMutation({
    mutationFn: () =>
      api.request("/security/hw/validate-token", {
        method: "POST",
        body: JSON.stringify({ token: tokenInput }),
      }) as Promise<ValidateTokenResult>,
    onSuccess: (r) => setValidateResult(r),
    onError: (err: any) => setValidateResult({ valid: false, message: err?.message || "Error validando token" }),
  });

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
              {fingerprint?.motherboardUuid ?? status?.fingerprint ?? "No registrado"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {fingerprint ? `${fingerprint.hostname} · ${fingerprint.platform}` : "Identificador único del servidor"}
            </p>
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
            <p className="text-2xl font-bold">{usbData?.devices?.length ?? status?.usbTokens ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Tokens registrados</p>
            {usbData?.devices && usbData.devices.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {usbData.devices.map((d) => (
                  <li key={d.serial} className="text-[10px] font-mono text-muted-foreground truncate">
                    {d.serial} {d.model && `· ${d.model}`}
                  </li>
                ))}
              </ul>
            )}
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
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Token a validar…"
              className="w-64"
            />
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => validateMut.mutate()}
              disabled={!tokenInput || validateMut.isPending}
              loading={validateMut.isPending}
            >
              <Usb className="h-4 w-4" /> Verificar USB
            </Button>
          </div>
          {validateResult && (
            <p className={`text-sm text-center mt-3 ${validateResult.valid ? "text-green-600" : "text-red-600"}`}>
              {validateResult.valid ? "Token válido ✓" : `Inválido: ${validateResult.message || "token no reconocido"}`}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
