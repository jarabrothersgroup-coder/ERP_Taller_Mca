"use client";

import * as React from "react";
import {
  Settings,
  Save,
  Building2,
  FileText,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  FileSignature,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { fetchConfigSettings, type UIMappedConfigSettings } from "@/lib/data-service";

/* ── Mock Data ──────────────────────────────── */

function getMockSettings(): UIMappedConfigSettings {
  return {
    companyName: "Taller Mecánico El Chero",
    companyRuc: "80012345-6",
    companyAddress: "Av. Mariscal López 1234, Coronel Oviedo",
    companyPhone: "+595 981 234 567",
    companyEmail: "info@tallerelchero.com.py",
    companyLogo: null,
    fiscalRegimen: "General",
    timbrado: "12345678",
    facturaInicio: "001-001",
  };
}

/* ── Logo Upload ────────────────────────────── */

function LogoUpload({    currentLogo,
    onLogoChange,
    disabled,
  }: {
    currentLogo: string | null;
    onLogoChange: (logo: string | null) => void;
    disabled: boolean;
  }) {
  const [preview, setPreview] = React.useState<string | null>(currentLogo);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no puede superar los 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      onLogoChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Preview */}
      <div
        className={cn(
          "flex h-28 w-28 items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden",
          dragOver
            ? "border-orange-500 bg-orange-500/5 scale-105"
            : preview
            ? "border-orange-300 dark:border-orange-700 bg-muted/30"
            : "border-muted-foreground/30 hover:border-muted-foreground/50 bg-muted/10"
        )}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
        aria-label="Subir logo del taller"
      >
        {preview ? (
          <img
            src={preview}
            alt="Logo del taller"
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Upload className="h-6 w-6" aria-hidden="true" />
            <span className="text-[10px]">Logo</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        disabled={disabled}
      />

      <p className="text-[10px] text-muted-foreground text-center max-w-[120px] leading-tight">
        PNG o JPG, máx 5MB
      </p>

      {preview && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground"
          onClick={() => {
            setPreview(null);
            onLogoChange(null);
          }}
          disabled={disabled}
        >
          Quitar logo
        </Button>
      )}
    </div>
  );
}

/* ── Form Field ─────────────────────────────── */

function FormField({
  label,
  icon: Icon,
  children,
  required,
}: {
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {Icon && <Icon className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground align-text-bottom" aria-hidden="true" />}
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ── Main Page ──────────────────────────────── */

export default function ConfigPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [form, setForm] = React.useState<UIMappedConfigSettings>({
    companyName: "",
    companyRuc: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    companyLogo: null,
    fiscalRegimen: "General",
    timbrado: "",
    facturaInicio: "",
  });

  // Load settings
  React.useEffect(() => {
    let cancelled = false;
    fetchConfigSettings(getMockSettings).then((data) => {
      if (!cancelled) {
        setForm(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const updateField = <K extends keyof UIMappedConfigSettings>(
    field: K,
    value: UIMappedConfigSettings[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    // Simulate API save
    await new Promise((r) => setTimeout(r, 800));
    setSaveSuccess(true);
    setSaving(false);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse mt-2" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1">
            <div className="h-64 rounded-lg border bg-card animate-pulse" />
          </div>
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
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
          <p className="text-sm text-muted-foreground">
            Datos del taller, parámetros fiscales y preferencias del sistema
          </p>
        </div>

        {/* ⭐ PRIMARY CTA */}
        <Button
          size="lg"
          className="gap-2 shadow-md hover:shadow-lg transition-shadow"
          onClick={handleSave}
          loading={saving}
        >
          {saving ? (
            "Guardando…"
          ) : (
            <>
              <Save className="h-5 w-5" aria-hidden="true" />
              Guardar Cambios
            </>
          )}
        </Button>
      </div>

      {/* ── Success alert ────────────────────── */}
      {saveSuccess && (
        <Alert variant="success" dismissible onDismiss={() => setSaveSuccess(false)}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>¡Guardado!</AlertTitle>
          <AlertDescription>
            Los cambios se han guardado exitosamente.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Sidebar: Logo ──────────────────── */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                Logo del Taller
              </CardTitle>
              <CardDescription>
                Arrastrá una imagen o hacé clic para subir el logo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LogoUpload
                currentLogo={form.companyLogo ?? null}
                onLogoChange={(logo) => updateField("companyLogo", logo ?? null)}
                disabled={saving}
              />
            </CardContent>
          </Card>

          {/* Quick info */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Resumen Fiscal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Régimen</span>
                <span className="font-medium">{form.fiscalRegimen}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">RUC</span>
                <span className="font-mono text-xs">{form.companyRuc}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timbrado</span>
                <span className="font-mono text-xs">{form.timbrado}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Factura</span>
                <span className="font-mono text-xs">{form.facturaInicio}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column ──────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* ── Company Info ─────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Datos del Taller
              </CardTitle>
              <CardDescription>
                Información principal de la empresa para facturación y contacto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormField label="Razón Social" icon={Building2} required>
                    <Input
                      value={form.companyName}
                      onChange={(e) => updateField("companyName", e.target.value)}
                      placeholder="Taller Mecánico El Chero"
                      disabled={saving}
                    />
                  </FormField>
                </div>

                <FormField label="RUC" icon={FileSignature} required>
                  <Input
                    value={form.companyRuc}
                    onChange={(e) => updateField("companyRuc", e.target.value)}
                    placeholder="80012345-6"
                    className="font-mono"
                    disabled={saving}
                  />
                </FormField>

                <FormField label="Teléfono" icon={Phone} required>
                  <Input
                    value={form.companyPhone}
                    onChange={(e) => updateField("companyPhone", e.target.value)}
                    placeholder="+595 981 234 567"
                    disabled={saving}
                  />
                </FormField>

                <div className="sm:col-span-2">
                  <FormField label="Dirección" icon={MapPin}>
                    <Input
                      value={form.companyAddress}
                      onChange={(e) => updateField("companyAddress", e.target.value)}
                      placeholder="Av. Mariscal López 1234, Coronel Oviedo"
                      disabled={saving}
                    />
                  </FormField>
                </div>

                <FormField label="Correo Electrónico" icon={Mail}>
                  <Input
                    type="email"
                    value={form.companyEmail}
                    onChange={(e) => updateField("companyEmail", e.target.value)}
                    placeholder="info@tallerelchero.com.py"
                    disabled={saving}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* ── Fiscal Parameters ─────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Parámetros Fiscales
              </CardTitle>
              <CardDescription>
                Configuración para facturación electrónica SIFEN y DNIT
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Régimen Fiscal" icon={FileText}>
                  <Input
                    value={form.fiscalRegimen}
                    onChange={(e) => updateField("fiscalRegimen", e.target.value)}
                    placeholder="General"
                    disabled={saving}
                  />
                </FormField>

                <FormField label="N° Timbrado" icon={Hash}>
                  <Input
                    value={form.timbrado}
                    onChange={(e) => updateField("timbrado", e.target.value)}
                    placeholder="12345678"
                    className="font-mono"
                    disabled={saving}
                  />
                </FormField>

                <FormField label="Inicio Numeración Factura" icon={FileSignature}>
                  <Input
                    value={form.facturaInicio}
                    onChange={(e) => updateField("facturaInicio", e.target.value)}
                    placeholder="001-001"
                    className="font-mono"
                    disabled={saving}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
