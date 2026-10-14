"use client";

import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Settings, Save, Building2, FileText, Image as ImageIcon,
  CheckCircle2, Phone, Mail, MapPin, FileSignature, Hash,
  Upload, Download, MailCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useConfigSettings } from "@/hooks/use-data";
import type { UIMappedConfigSettings } from "@/lib/data-service";
import { LogoUpload } from "@/components/dashboard/config/logo-upload";
import { FormField } from "@/components/dashboard/config/form-field";
import { api, authHeaders } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { SucursalesSection } from "./sucursales-section";

/* ── Types (T-63 S126) ── */
interface EmailStatus {
  configured: boolean;
  providers: string[];
  resendConfigured: boolean;
  smtpConfigured: boolean;
}
interface ImportResult {
  inserted: number;
  errors: string[];
  skipped: number;
}

const IMPORT_TABLES = [
  { key: "vehiculos", label: "Vehículos" },
  { key: "clientes", label: "Clientes" },
] as const;

export default function ConfigPage() {
  const { data: settingsData, isLoading: loading } = useConfigSettings();
  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const { toast: t, ToastContainer } = useToast();
  const [form, setForm] = React.useState<UIMappedConfigSettings>({
    companyName: "", companyRuc: "", companyAddress: "", companyPhone: "",
    companyEmail: "", companyLogo: null, fiscalRegimen: "General", timbrado: "", facturaInicio: "",
  });

  // GET /email/status — estado de proveedores de email (T-63 S126)
  const emailStatusQuery = useQuery<EmailStatus>({
    queryKey: ["email-status"],
    queryFn: () => api.request<EmailStatus>("/email/status"),
  });

  // GET /import/:table/template + POST /import/:table (T-63 S126)
  const [importTable, setImportTable] = React.useState<string>("vehiculos");
  const [importCsv, setImportCsv] = React.useState("");
  const importMut = useMutation({
    mutationFn: (table: string) =>
      api.request<ImportResult>(`/import/${table}`, {
        method: "POST",
        body: JSON.stringify({ csv: importCsv }),
      }),
    onSuccess: (d) => {
      if (d.errors.length > 0) {
        t.error(`Importadas ${d.inserted} fila(s), ${d.skipped} omitida(s), ${d.errors.length} error(es): ${d.errors.slice(0, 3).join(" · ")}`);
      } else {
        t.success(`Importadas ${d.inserted} fila(s) · ${d.skipped} omitida(s)`);
      }
      setImportCsv("");
    },
    onError: (err: Error) => t.error(err.message),
  });
  const downloadTemplate = async () => {
    try {
      const blob = await api.downloadFile(`/import/${importTable}/template`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${importTable}_template.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      t.error(e instanceof Error ? e.message : "No se pudo descargar la plantilla");
    }
  };

  React.useEffect(() => {
    if (settingsData) setForm(settingsData);
  }, [settingsData]);

  const updateField = <K extends keyof UIMappedConfigSettings>(field: K, value: UIMappedConfigSettings[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/config/settings", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error handled silently — form stays editable
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1"><div className="h-64 rounded-lg border bg-card animate-pulse" /></div>
          <div className="md:col-span-2 space-y-4">
            <div className="h-80 rounded-lg border bg-card animate-pulse" />
            <div className="h-48 rounded-lg border bg-card animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
          <p className="text-sm text-muted-foreground">Datos del taller, parámetros fiscales y preferencias del sistema</p>
        </div>
        <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow" onClick={handleSave} loading={saving}>
          {saving ? "Guardando…" : <><Save className="h-5 w-5" aria-hidden="true" />Guardar Cambios</>}
        </Button>
      </div>

      {saveSuccess && (
        <Alert variant="success" dismissible onDismiss={() => setSaveSuccess(false)}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>¡Guardado!</AlertTitle>
          <AlertDescription>Los cambios se han guardado exitosamente.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" aria-hidden="true" />Logo del Taller</CardTitle>
              <CardDescription>Arrastrá una imagen o hacé clic para subir el logo</CardDescription>
            </CardHeader>
            <CardContent>
              <LogoUpload currentLogo={form.companyLogo ?? null} onLogoChange={(logo) => updateField("companyLogo", logo ?? null)} disabled={saving} />
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" aria-hidden="true" />Resumen Fiscal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Régimen</span><span className="font-medium">{form.fiscalRegimen}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">RUC</span><span className="font-mono text-xs">{form.companyRuc}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Timbrado</span><span className="font-mono text-xs">{form.timbrado}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Factura</span><span className="font-mono text-xs">{form.facturaInicio}</span></div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" aria-hidden="true" />Datos del Taller</CardTitle>
              <CardDescription>Información principal de la empresa para facturación y contacto</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormField label="Razón Social" icon={Building2} required>
                    <Input value={form.companyName} onChange={(e) => updateField("companyName", e.target.value)} placeholder="Taller Mecánico El Chero" disabled={saving} />
                  </FormField>
                </div>
                <FormField label="RUC" icon={FileSignature} required>
                  <Input value={form.companyRuc} onChange={(e) => updateField("companyRuc", e.target.value)} placeholder="80012345-6" className="font-mono" disabled={saving} />
                </FormField>
                <FormField label="Teléfono" icon={Phone} required>
                  <Input value={form.companyPhone} onChange={(e) => updateField("companyPhone", e.target.value)} placeholder="+595 981 234 567" disabled={saving} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Dirección" icon={MapPin}>
                    <Input value={form.companyAddress} onChange={(e) => updateField("companyAddress", e.target.value)} placeholder="Av. Mariscal López 1234, Coronel Oviedo" disabled={saving} />
                  </FormField>
                </div>
                <FormField label="Correo Electrónico" icon={Mail}>
                  <Input type="email" value={form.companyEmail} onChange={(e) => updateField("companyEmail", e.target.value)} placeholder="info@tallerelchero.com.py" disabled={saving} />
                </FormField>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" aria-hidden="true" />Parámetros Fiscales</CardTitle>
              <CardDescription>Configuración para facturación electrónica SIFEN y DNIT</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Régimen Fiscal" icon={FileText}>
                  <Input value={form.fiscalRegimen} onChange={(e) => updateField("fiscalRegimen", e.target.value)} placeholder="General" disabled={saving} />
                </FormField>
                <FormField label="N° Timbrado" icon={Hash}>
                  <Input value={form.timbrado} onChange={(e) => updateField("timbrado", e.target.value)} placeholder="12345678" className="font-mono" disabled={saving} />
                </FormField>
                <FormField label="Inicio Numeración Factura" icon={FileSignature}>
                  <Input value={form.facturaInicio} onChange={(e) => updateField("facturaInicio", e.target.value)} placeholder="001-001" className="font-mono" disabled={saving} />
                </FormField>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <SucursalesSection />

      {/* ── Email status + Import CSV (T-63 S126) ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MailCheck className="h-4 w-4" aria-hidden="true" />Estado del Email
            </CardTitle>
            <CardDescription>Proveedores de envío configurados (Resend / SMTP)</CardDescription>
          </CardHeader>
          <CardContent>
            {emailStatusQuery.isLoading ? (
              <div className="h-12 rounded-md bg-muted animate-pulse" />
            ) : emailStatusQuery.data ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={emailStatusQuery.data.configured ? "success" : "warning"}>
                  {emailStatusQuery.data.configured ? "Configurado" : "Sin configurar"}
                </Badge>
                {emailStatusQuery.data.providers.length === 0 ? (
                  <span className="text-muted-foreground">No hay proveedores de email activos</span>
                ) : (
                  emailStatusQuery.data.providers.map((p) => (
                    <Badge key={p} variant="secondary" className="font-mono text-xs">{p}</Badge>
                  ))
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No se pudo consultar el estado</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" aria-hidden="true" />Importar CSV
            </CardTitle>
            <CardDescription>Carga masiva de vehículos o clientes desde un archivo CSV</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={importTable}
                onChange={(e) => setImportTable(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                aria-label="Tabla a importar"
              >
                {IMPORT_TABLES.map((tb) => (
                  <option key={tb.key} value={tb.key}>{tb.label}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Plantilla
              </Button>
            </div>
            <textarea
              value={importCsv}
              onChange={(e) => setImportCsv(e.target.value)}
              placeholder="Pegá el contenido del CSV acá (con encabezados)…"
              className="min-h-24 w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
              aria-label="Contenido CSV a importar"
            />
            <Button
              size="sm"
              className="gap-1.5"
              loading={importMut.isPending}
              disabled={!importCsv.trim()}
              onClick={() => importMut.mutate(importTable)}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Importar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* API docs (T-63 S126) — links a Swagger UI y OpenAPI JSON */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" aria-hidden="true" /> API Docs
          </CardTitle>
          <CardDescription>Documentación OpenAPI del backend</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open("/docs/", "_blank")}>
            <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Swagger UI
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open("/docs/json", "_blank")}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> OpenAPI JSON
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open("/docs/yaml", "_blank")}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> OpenAPI YAML
          </Button>
        </CardContent>
      </Card>

      {ToastContainer}
    </div>
  );
}
