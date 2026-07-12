"use client";

import * as React from "react";
import {
  Shield, Globe, Database, Save, Loader2, CheckCircle2,
  Key, Palette, Clock, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ── Types ──────────────────────────────────── */

interface SsoConfig {
  samlEnabled: boolean;
  oidcEnabled: boolean;
  oidcIssuer: string;
  oidcClientId: string;
  enforceSso: boolean;
  defaultRole: string;
}

interface WhiteLabelConfig {
  customDomain: string;
  companyName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText: string;
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
}

interface DataRetentionPolicy {
  auditLogRetentionDays: string;
  emailLogRetentionDays: string;
  backupRetentionDays: string;
  sessionRetentionDays: string;
  autoCleanupEnabled: boolean;
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  gdprCompliant: boolean;
  rightToErasure: boolean;
}

/* ── SSO Tab ────────────────────────────────── */

function SSOTab() {
  const [config, setConfig] = React.useState<SsoConfig>({
    samlEnabled: false,
    oidcEnabled: false,
    oidcIssuer: "",
    oidcClientId: "",
    enforceSso: false,
    defaultRole: "user",
  });
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/enterprise/sso", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": "demo" },
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" aria-hidden="true" />
            SSO — Single Sign-On
          </CardTitle>
          <CardDescription>Configurá autenticación SAML 2.0 u OIDC para tu taller</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Habilitar SSO</p>
              <p className="text-xs text-muted-foreground">Requiere configuración de proveedor de identidad</p>
            </div>
            <button
              className={`relative h-6 w-11 rounded-full transition-colors ${config.samlEnabled || config.oidcEnabled ? "bg-primary" : "bg-muted"}`}
              onClick={() => setConfig((p) => ({ ...p, samlEnabled: !p.samlEnabled, oidcEnabled: !p.samlEnabled }))}
            >
              <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${config.samlEnabled || config.oidcEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {(config.samlEnabled || config.oidcEnabled) && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="oidc-issuer">OIDC Issuer URL</Label>
                <Input
                  id="oidc-issuer"
                  placeholder="https://accounts.google.com"
                  value={config.oidcIssuer}
                  onChange={(e) => setConfig((p) => ({ ...p, oidcIssuer: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oidc-client">Client ID</Label>
                <Input
                  id="oidc-client"
                  placeholder="your-client-id"
                  value={config.oidcClientId}
                  onChange={(e) => setConfig((p) => ({ ...p, oidcClientId: e.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Forzar SSO</p>
                  <p className="text-xs text-muted-foreground">Bloquear login con email/password</p>
                </div>
                <button
                  className={`relative h-6 w-11 rounded-full transition-colors ${config.enforceSso ? "bg-primary" : "bg-muted"}`}
                  onClick={() => setConfig((p) => ({ ...p, enforceSso: !p.enforceSso }))}
                >
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${config.enforceSso ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Guardando…" : saved ? "Guardado" : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  );
}

/* ── White-Label Tab ────────────────────────── */

function WhiteLabelTab() {
  const [config, setConfig] = React.useState<WhiteLabelConfig>({
    customDomain: "",
    companyName: "",
    logoUrl: "",
    primaryColor: "#f97316",
    secondaryColor: "#1e293b",
    accentColor: "#3b82f6",
    footerText: "",
    privacyPolicyUrl: "",
    termsOfServiceUrl: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/enterprise/white-label", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": "demo" },
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" aria-hidden="true" />
            Dominio Personalizado
          </CardTitle>
          <CardDescription>Usá tu propio dominio para el ERP</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="domain">Dominio</Label>
            <Input
              id="domain"
              placeholder="taller.midominio.com.py"
              value={config.customDomain}
              onChange={(e) => setConfig((p) => ({ ...p, customDomain: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company">Nombre de la Empresa</Label>
            <Input
              id="company"
              placeholder="Taller Mecánico XYZ"
              value={config.companyName}
              onChange={(e) => setConfig((p) => ({ ...p, companyName: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" aria-hidden="true" />
            Colores de Marca
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: "primaryColor", label: "Primario" },
              { key: "secondaryColor", label: "Secundario" },
              { key: "accentColor", label: "Acento" },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    id={key}
                    value={(config as any)[key]}
                    onChange={(e) => setConfig((p) => ({ ...p, [key]: e.target.value }))}
                    className="h-10 w-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={(config as any)[key]}
                    onChange={(e) => setConfig((p) => ({ ...p, [key]: e.target.value }))}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Guardando…" : saved ? "Guardado" : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  );
}

/* ── Data Retention Tab ─────────────────────── */

function DataRetentionTab() {
  const [config, setConfig] = React.useState<DataRetentionPolicy>({
    auditLogRetentionDays: "2555",
    emailLogRetentionDays: "365",
    backupRetentionDays: "90",
    sessionRetentionDays: "30",
    autoCleanupEnabled: true,
    encryptionAtRest: true,
    encryptionInTransit: true,
    gdprCompliant: true,
    rightToErasure: true,
  });
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/enterprise/data-retention", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": "demo" },
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" aria-hidden="true" />
            Períodos de Retención
          </CardTitle>
          <CardDescription>Configurá cuánto tiempo se conservan los datos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "auditLogRetentionDays", label: "Audit Log", suffix: "días" },
              { key: "emailLogRetentionDays", label: "Email Log", suffix: "días" },
              { key: "backupRetentionDays", label: "Backups", suffix: "días" },
              { key: "sessionRetentionDays", label: "Sesiones", suffix: "días" },
            ].map(({ key, label, suffix }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <div className="flex gap-2">
                  <Input
                    id={key}
                    type="number"
                    value={(config as any)[key]}
                    onChange={(e) => setConfig((p) => ({ ...p, [key]: e.target.value }))}
                  />
                  <span className="flex items-center text-sm text-muted-foreground">{suffix}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" aria-hidden="true" />
            Compliance SOC2
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "autoCleanupEnabled", label: "Limpieza automática", desc: "Eliminar datos expirados automáticamente" },
            { key: "encryptionAtRest", label: "Encriptación en disco", desc: "AES-256 para datos almacenados" },
            { key: "encryptionInTransit", label: "Encriptación en tránsito", desc: "TLS 1.3 para todas las conexiones" },
            { key: "gdprCompliant", label: "Cumplimiento GDPR", desc: "Políticas de protección de datos" },
            { key: "rightToErasure", label: "Derecho al olvido", desc: "Permitir eliminación de datos personales" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Badge variant={(config as any)[key] ? "success" : "secondary"}>
                {(config as any)[key] ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Guardando…" : saved ? "Guardado" : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function EnterprisePage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-violet-500" aria-hidden="true" />
          Enterprise
        </h1>
        <p className="text-sm text-muted-foreground">SSO, white-label y compliance — Funcionalidades empresariales</p>
      </div>

      <Tabs defaultValue="sso">
        <TabsList>
          <TabsTrigger value="sso" className="gap-1.5">
            <Key className="h-3.5 w-3.5" />
            SSO
          </TabsTrigger>
          <TabsTrigger value="white-label" className="gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            White-Label
          </TabsTrigger>
          <TabsTrigger value="data-retention" className="gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Data Retention
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sso">
          <SSOTab />
        </TabsContent>
        <TabsContent value="white-label">
          <WhiteLabelTab />
        </TabsContent>
        <TabsContent value="data-retention">
          <DataRetentionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
