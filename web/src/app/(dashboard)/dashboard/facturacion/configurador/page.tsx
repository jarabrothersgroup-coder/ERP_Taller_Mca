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
  Stamp,
  Building2,
  CheckCircle2,
  MonitorSpeaker,
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
  // SET compliance
  timbradoNumero: string;
  timbradoVigenciaInicio: string;
  timbradoVigenciaFin: string;
  condicionVentaDefault: string;
  showCondicionVenta: boolean;
  showContribuyenteIva: boolean;
  showTipoCambio: boolean;
  seriePrefix: string;
  // HP LaserJet P1150
  printerModel: string;
  cupsPrinterName: string;
  paperTray: string;
}

/* ── Paper presets (incluye HP LaserJet P1150) ── */

interface PaperPreset {
  label: string;
  width: number;
  height: number;
  icon: string;
  description: string;
  printerType: string;
}

const paperPresets: PaperPreset[] = [
  { label: "Térmica 80mm", width: 80, height: 200, icon: "🧾", description: "Impresora térmica Epson/Xprinter", printerType: "thermal" },
  { label: "Térmica 58mm", width: 58, height: 200, icon: "🧾", description: "Impresora térmica mini", printerType: "thermal" },
  { label: "HP LaserJet P1150 — Carta", width: 216, height: 279, icon: "🖨️", description: "Carta 216×279mm — SET Paraguay", printerType: "hp-laser" },
  { label: "HP LaserJet P1150 — Media Carta", width: 216, height: 356, icon: "🖨️", description: "Carta extendida 216×356mm", printerType: "hp-laser" },
  { label: "HP LaserJet P1150 — Legal", width: 216, height: 356, icon: "🖨️", description: "Legal 216×356mm", printerType: "hp-laser" },
  { label: "HP LaserJet P1150 — A4", width: 210, height: 297, icon: "🖨️", description: "A4 210×297mm internacional", printerType: "hp-laser" },
  { label: "A4 (210×297mm)", width: 210, height: 297, icon: "📄", description: "A4 estándar", printerType: "generic" },
  { label: "Personalizado", width: 0, height: 0, icon: "⚙️", description: "Dimensiones personalizadas", printerType: "custom" },
];

const protocolOptions = [
  { value: "ESCPOS", label: "ESC/POS (Térmica 80/58mm)", printerType: "thermal" },
  { value: "PDF", label: "PDF (HP LaserJet / CUPS)", printerType: "hp-laser" },
  { value: "PCL", label: "PCL5e (HP LaserJet P1150 nativo)", printerType: "hp-laser" },
  { value: "ZPL", label: "ZPL (Zebra)", printerType: "label" },
];

const printerModels = [
  { value: "generic", label: "Genérica" },
  { value: "hp-lj-p1150", label: "HP LaserJet P1150" },
  { value: "epson-t88", label: "Epson TM-T88" },
  { value: "xprinter", label: "Xprinter XP-80C" },
  { value: "zebra", label: "Zebra ZD421" },
];

const condicionVentaOptions = [
  { value: "CONTADO", label: "Contado" },
  { value: "CREDITO", label: "Crédito" },
];

/* ── SET Elements Info ─────────────────────────── */

const SET_ELEMENTS = [
  { key: "emisor", label: "Datos del emisor", description: "Nombre, RUC, dirección, actividad económica", required: true, reg: "RG 1382/05" },
  { key: "timbrado", label: "Timbrado N°", description: "Número y vigencia del timbrado", required: true, reg: "RG 1382/05" },
  { key: "numeracion", label: "Numeración", description: "13 dígitos: serie(3) + punto venta(3) + correlativo(7)", required: true, reg: "RG 1382/05" },
  { key: "fecha", label: "Fecha de emisión", description: "Fecha y hora de emisión del comprobante", required: true, reg: "SIFEN V150" },
  { key: "cliente", label: "Datos del receptor", description: "Nombre y RUC (obligatorio si >₲35M)", required: true, reg: "SIFEN V150" },
  { key: "detalle", label: "Detalle de operaciones", description: "Descripción, cantidad, precio unitario", required: true, reg: "RG 1382/05" },
  { key: "iva", label: "IVA discriminado", description: "5%, 10% o exento por línea", required: true, reg: "Ley 1034/83" },
  { key: "total", label: "Total de la operación", description: "Monto total en Guaraníes", required: true, reg: "RG 1382/05" },
  { key: "condicion", label: "Condición de venta", description: "Contado o crédito", required: true, reg: "RG 1382/05" },
  { key: "cdc", label: "CDC + QR", description: "Código de Determinación del Comprobante (electrónica)", required: false, reg: "SIFEN V150" },
  { key: "barcode", label: "Código de barras", description: "Para factura manual (13 dígitos)", required: false, reg: "RG 1382/05" },
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
    timbradoNumero: "",
    timbradoVigenciaInicio: "",
    timbradoVigenciaFin: "",
    condicionVentaDefault: "CONTADO",
    showCondicionVenta: true,
    showContribuyenteIva: true,
    showTipoCambio: false,
    seriePrefix: "001",
    printerModel: "generic",
    cupsPrinterName: "",
    paperTray: "Auto",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState("Térmica 80mm");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"paper" | "printer" | "elements" | "set" | "company">("paper");

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
          timbradoNumero: data.timbradoNumero || "",
          timbradoVigenciaInicio: data.timbradoVigenciaInicio || "",
          timbradoVigenciaFin: data.timbradoVigenciaFin || "",
          condicionVentaDefault: data.condicionVentaDefault || "CONTADO",
          showCondicionVenta: data.showCondicionVenta ?? true,
          showContribuyenteIva: data.showContribuyenteIva ?? true,
          showTipoCambio: data.showTipoCambio ?? false,
          seriePrefix: data.seriePrefix || "001",
          printerModel: data.printerModel || "generic",
          cupsPrinterName: data.cupsPrinterName || "",
          paperTray: data.paperTray || "Auto",
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

  const updateField = (key: keyof InvoiceConfig, value: string | number | boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // Auto-detect HP LaserJet and set protocol
  const selectPreset = (preset: PaperPreset) => {
    setSelectedPreset(preset.label);
    if (preset.width > 0) {
      updateField("paperWidthMm", preset.width);
      updateField("paperHeightMm", preset.height);
    }
    if (preset.printerType === "hp-laser") {
      updateField("printerModel", "hp-lj-p1150");
      updateField("printerProtocol", "PCL");
      updateField("printerDpi", 600);
    } else if (preset.printerType === "thermal") {
      updateField("printerModel", "generic");
      updateField("printerProtocol", "ESCPOS");
      updateField("printerDpi", 203);
    }
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

  const isHPLaser = config.printerModel === "hp-lj-p1150" || config.printerProtocol === "PCL";

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
            Configurar formato, impresora HP LaserJet P1150 y elementos SET
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {isHPLaser && (
            <Badge variant="default" className="gap-1">
              <Printer className="h-3 w-3" />
              HP LaserJet P1150
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: "paper", label: "Tamaño Papel", icon: FileText },
          { key: "printer", label: "Impresora", icon: Printer },
          { key: "elements", label: "Elementos", icon: CheckCircle2 },
          { key: "set", label: "SET / Timbrado", icon: Stamp },
          { key: "company", label: "Empresa", icon: Building2 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column — Config */}
        <div className="space-y-6">
          {/* Tab: Paper Size */}
          {activeTab === "paper" && (
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
                      className="justify-start gap-2 h-auto py-2 flex-col items-start"
                      onClick={() => selectPreset(preset)}
                    >
                      <div className="flex items-center gap-2">
                        <span>{preset.icon}</span>
                        <span className="text-xs font-medium">{preset.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{preset.description}</span>
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
          )}

          {/* Tab: Printer */}
          {activeTab === "printer" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    Impresora
                    {isHPLaser && (
                      <Badge variant="default" className="ml-2 text-[10px]">
                        HP LaserJet P1150
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Modelo de Impresora</label>
                    <select
                      className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm mt-1"
                      value={config.printerModel}
                      onChange={(e) => {
                        updateField("printerModel", e.target.value);
                        if (e.target.value === "hp-lj-p1150") {
                          updateField("printerProtocol", "PCL");
                          updateField("printerDpi", 600);
                        }
                      }}
                    >
                      {printerModels.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Protocolo</label>
                    <select
                      className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm mt-1"
                      value={config.printerProtocol}
                      onChange={(e) => updateField("printerProtocol", e.target.value)}
                    >
                      {protocolOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Dirección (IP o USB path)
                    </label>
                    <Input
                      placeholder={isHPLaser ? "usb://HP/LaserJet%201150 o 192.168.1.100:9100" : "/dev/usb/lp0"}
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
                  {isHPLaser && (
                    <>
                      <div>
                        <label className="text-xs text-muted-foreground">Nombre CUPS</label>
                        <Input
                          placeholder="HP_LaserJet_1150"
                          value={config.cupsPrinterName}
                          onChange={(e) => updateField("cupsPrinterName", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Bandeja de Entrada</label>
                        <select
                          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm mt-1"
                          value={config.paperTray}
                          onChange={(e) => updateField("paperTray", e.target.value)}
                        >
                          <option value="Auto">Automática</option>
                          <option value="Tray1">Bandeja 1</option>
                          <option value="Tray2">Bandeja 2</option>
                          <option value="Manual">Manual</option>
                        </select>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* HP P1150 Info Card */}
              {isHPLaser && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="pt-4">
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-blue-700 flex items-center gap-1">
                        <MonitorSpeaker className="h-4 w-4" />
                        HP LaserJet P1150 — Especificaciones
                      </p>
                      <ul className="text-xs text-blue-600 space-y-1 ml-5 list-disc">
                        <li>PCL5e nativo (NO soporta PCL6/XL)</li>
                        <li>600×600 DPI nativo, 1200 enhanced</li>
                        <li>8MB RAM, USB + Paralelo</li>
                        <li>Bandeja 250 hojas, monocromático</li>
                        <li>Soporte: HPLIP / CUPS en Linux</li>
                      </ul>
                      <p className="text-[10px] text-blue-500 mt-2">
                        Instalación: <code>sudo apt install hplip && sudo hp-setup</code>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Tab: Elements */}
          {activeTab === "elements" && (
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
                    ["showCondicionVenta", "Condición de venta (CONTADO/CREDITO)"],
                    ["showContribuyenteIva", "Aviso Contribuyente del IVA"],
                    ["showTipoCambio", "Tipo de cambio (facturas USD)"],
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
          )}

          {/* Tab: SET / Timbrado */}
          {activeTab === "set" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Stamp className="h-4 w-4" />
                    Configuración SET — Timbrado
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Serie / Punto de Venta</label>
                    <Input
                      placeholder="001"
                      value={config.seriePrefix}
                      onChange={(e) => updateField("seriePrefix", e.target.value)}
                      className="mt-1"
                      maxLength={3}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Código de punto de venta (3 dígitos)
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Timbrado N°</label>
                    <Input
                      placeholder="12345678"
                      value={config.timbradoNumero}
                      onChange={(e) => updateField("timbradoNumero", e.target.value)}
                      className="mt-1"
                      maxLength={8}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Número de timbrado otorgado por la SET (8 dígitos)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Vigencia Desde</label>
                      <Input
                        type="date"
                        value={config.timbradoVigenciaInicio}
                        onChange={(e) => updateField("timbradoVigenciaInicio", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Vigencia Hasta</label>
                      <Input
                        type="date"
                        value={config.timbradoVigenciaFin}
                        onChange={(e) => updateField("timbradoVigenciaFin", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Condición de Venta por Defecto</label>
                    <select
                      className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm mt-1"
                      value={config.condicionVentaDefault}
                      onChange={(e) => updateField("condicionVentaDefault", e.target.value)}
                    >
                      {condicionVentaOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>

              {/* SET Elements Reference */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Elementos Obligatorios SET</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {SET_ELEMENTS.map((el) => (
                      <div key={el.key} className="flex items-start justify-between p-2 rounded-lg border bg-muted/30">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{el.label}</span>
                            {el.required && (
                              <Badge variant="destructive" className="text-[9px] px-1">REQ</Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{el.description}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] shrink-0 ml-2">
                          {el.reg}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Tab: Company */}
          {activeTab === "company" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Datos de la Empresa (override)
                </CardTitle>
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
          )}
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
