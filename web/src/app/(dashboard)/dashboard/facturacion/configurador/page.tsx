"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Save,
  Printer,
  FileText,
  Eye,
  Settings,
} from "lucide-react";
import Link from "next/link";

/* ── Types ────────────────────────────────────── */

interface InvoiceConfig {
  paperWidthMm: number;
  paperHeightMm: number;
  printerProtocol: string;
  printerAddress: string;
  printerDpi: number;
  showCompanyHeader: boolean;
  showClientInfo: boolean;
  showLineItems: boolean;
  showSubtotal: boolean;
  showIva: boolean;
  showBarcode: boolean;
  showQRCode: boolean;
  showFooter: boolean;
  showTimbrado: boolean;
  showIvaPerLine: boolean;
  showConservation: boolean;
  companyNombre: string;
  companyRuc: string;
  companyDireccion: string;
  companyTelefono: string;
  companyActividad: string;
}

/* ── Paper presets ─────────────────────────────── */

const paperPresets = [
  { label: "Térmica 80mm", width: 80, height: 200, icon: "🧾" },
  { label: "Térmica 58mm", width: 58, height: 200, icon: "🧾" },
  { label: "A4 (210×297mm)", width: 210, height: 297, icon: "📄" },
  { label: "Personalizado", width: 0, height: 0, icon: "⚙️" },
];

const protocolOptions = [
  { value: "ESCPOS", label: "ESC/POS (Térmica 80/58mm)" },
  { value: "PDF", label: "PDF (HP LaserJet / CUPS)" },
  { value: "PCL", label: "PCL (HP LaserJet nativo)" },
  { value: "ZPL", label: "ZPL (Zebra)" },
];

/* ── Component ─────────────────────────────────── */

export default function InvoiceConfiguratorPage() {
  const [config, setConfig] = useState<InvoiceConfig>({
    paperWidthMm: 80,
    paperHeightMm: 200,
    printerProtocol: "ESCPOS",
    printerAddress: "",
    printerDpi: 203,
    showCompanyHeader: true,
    showClientInfo: true,
    showLineItems: true,
    showSubtotal: true,
    showIva: true,
    showBarcode: true,
    showQRCode: true,
    showFooter: true,
    showTimbrado: true,
    showIvaPerLine: false,
    showConservation: false,
    companyNombre: "",
    companyRuc: "",
    companyDireccion: "",
    companyTelefono: "",
    companyActividad: "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState("Térmica 80mm");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Load config
  useEffect(() => {
    fetch("/api/label-printing/config")
      .then((r) => r.json())
      .then((data) => {
        setConfig({
          paperWidthMm: data.paperWidthMm || 80,
          paperHeightMm: data.paperHeightMm || 200,
          printerProtocol: data.printerProtocol || "ESCPOS",
          printerAddress: data.printerAddress || "",
          printerDpi: data.printerDpi || 203,
          showCompanyHeader: data.showCompanyHeader ?? true,
          showClientInfo: data.showClientInfo ?? true,
          showLineItems: data.showLineItems ?? true,
          showSubtotal: data.showSubtotal ?? true,
          showIva: data.showIva ?? true,
          showBarcode: data.showBarcode ?? true,
          showQRCode: data.showQRCode ?? true,
          showFooter: data.showFooter ?? true,
          showTimbrado: data.showTimbrado ?? true,
          showIvaPerLine: data.showIvaPerLine ?? false,
          showConservation: data.showConservation ?? false,
          companyNombre: data.companyNombre || "",
          companyRuc: data.companyRuc || "",
          companyDireccion: data.companyDireccion || "",
          companyTelefono: data.companyTelefono || "",
          companyActividad: data.companyActividad || "",
        });
        // Match preset
        const match = paperPresets.find(
          (p) => p.width === data.paperWidthMm && p.height === data.paperHeightMm,
        );
        if (match) setSelectedPreset(match.label);
        else setSelectedPreset("Personalizado");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/label-printing/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    } catch (err) {
      console.error("Error saving config:", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/label-printing/config/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      setPreviewHtml(data.html || null);
    } catch (err) {
      console.error("Error generating preview:", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleSwitch = (key: keyof InvoiceConfig) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (key: keyof InvoiceConfig, value: string | number) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/facturacion">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-blue-500" />
            Configurador de Facturas
          </h1>
          <p className="text-sm text-muted-foreground">
            Configurar formato, impresora y elementos de la factura impresa
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column — Config */}
        <div className="space-y-6">
          {/* Section 1: Paper Size */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Tamaño de Papel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {paperPresets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant={selectedPreset === preset.label ? "default" : "outline"}
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => {
                      setSelectedPreset(preset.label);
                      if (preset.width > 0) {
                        updateField("paperWidthMm", preset.width);
                        updateField("paperHeightMm", preset.height);
                      }
                    }}
                  >
                    <span>{preset.icon}</span>
                    {preset.label}
                  </Button>
                ))}
              </div>
              {selectedPreset === "Personalizado" && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">Ancho (mm)</label>
                    <Input
                      type="number"
                      value={config.paperWidthMm}
                      onChange={(e) => updateField("paperWidthMm", parseInt(e.target.value) || 80)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">Alto (mm)</label>
                    <Input
                      type="number"
                      value={config.paperHeightMm}
                      onChange={(e) => updateField("paperHeightMm", parseInt(e.target.value) || 200)}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
              {/* Visual preview of paper size */}
              <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/30">
                <div
                  className="border-2 border-dashed border-primary/40 bg-white flex items-center justify-center text-xs text-muted-foreground"
                  style={{
                    width: `${Math.min(config.paperWidthMm * 2, 160)}px`,
                    height: `${Math.min(config.paperHeightMm * 0.8, 200)}px`,
                  }}
                >
                  {config.paperWidthMm}×{config.paperHeightMm}mm
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Printer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Impresora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Protocolo</label>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm mt-1"
                  value={config.printerProtocol}
                  onChange={(e) => updateField("printerProtocol", e.target.value)}
                >
                  {protocolOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Dirección (IP o USB path)
                </label>
                <Input
                  placeholder="192.168.1.100:9100 o /dev/usb/lp0"
                  value={config.printerAddress}
                  onChange={(e) => updateField("printerAddress", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">DPI</label>
                <Input
                  type="number"
                  value={config.printerDpi}
                  onChange={(e) => updateField("printerDpi", parseInt(e.target.value) || 203)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Visible Elements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Elementos de la Factura</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {([
                  ["showCompanyHeader", "Encabezado empresa (nombre, RUC, dirección)"],
                  ["showClientInfo", "Datos del cliente"],
                  ["showLineItems", "Línea de detalle (servicios y repuestos)"],
                  ["showSubtotal", "Subtotal"],
                  ["showIva", "IVA (10% / 5% / Exento)"],
                  ["showBarcode", "Código de barras (factura manual)"],
                  ["showQRCode", "Código QR (factura electrónica — CDC)"],
                  ["showTimbrado", "Número de timbrado (R 1382/05)"],
                  ["showFooter", "Pie de página (agradecimiento)"],
                  ["showIvaPerLine", "IVA por línea de detalle"],
                  ["showConservation", "Condiciones conservación papel térmico (R 27/2019)"],
                ] as [keyof InvoiceConfig, string][]).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm">{label}</span>
                    <button
                      type="button"
                      onClick={() => toggleSwitch(key)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config[key] ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config[key] ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Company Info Override */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos de la Empresa (override)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Nombre</label>
                <Input
                  placeholder="AUTOMOTIVEOS"
                  value={config.companyNombre}
                  onChange={(e) => updateField("companyNombre", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">RUC</label>
                <Input
                  placeholder="800XXXX-X"
                  value={config.companyRuc}
                  onChange={(e) => updateField("companyRuc", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Dirección</label>
                <Input
                  placeholder="Coronel Oviedo, Paraguay"
                  value={config.companyDireccion}
                  onChange={(e) => updateField("companyDireccion", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Teléfono</label>
                <Input
                  placeholder="+595 21 123 4567"
                  value={config.companyTelefono}
                  onChange={(e) => updateField("companyTelefono", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Actividad Económica (SET)</label>
                <Input
                  placeholder="Servicios de reparación vehicular"
                  value={config.companyActividad}
                  onChange={(e) => updateField("companyActividad", e.target.value)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — Preview + Save */}
        <div className="space-y-6">
          {/* Preview Card */}
          <Card className="sticky top-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Vista Previa
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={previewLoading}
                >
                  {previewLoading ? "Generando..." : "Actualizar"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {previewHtml ? (
                <div className="rounded-lg border bg-white p-4 overflow-auto max-h-[600px]">
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                  Presiona &quot;Actualizar&quot; para generar la vista previa
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar Configuración"}
          </Button>
        </div>
      </div>
    </div>
  );
}
