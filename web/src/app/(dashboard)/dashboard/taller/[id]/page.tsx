"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import {
  ArrowLeft,
  Car,
  User,
  Wrench,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  FileText,
  Camera,
  ExternalLink,
  Plus,
  Trash2,
  ChevronRight,
  Building2,
  ClipboardCheck,
  MessageCircle,
  Send,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/* ── Status Config ─────────────────────────── */

interface StatusConfigItem {
  label: string;
  color: string;
  bg: string;
  icon: React.ElementType;
  next?: string;
}

const STATUS_CONFIG: Record<string, StatusConfigItem> = {
  Presupuestado: { label: "Presupuestado", color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950", icon: Clock, next: "Aprobado" },
  Aprobado: { label: "Aprobado", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950", icon: CheckCircle2, next: "En_Proceso" },
  En_Proceso: { label: "En Proceso", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950", icon: Wrench, next: "Control_Calidad" },
  Control_Calidad: { label: "Control Calidad", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950", icon: Building2, next: "Listo" },
  Listo: { label: "Listo", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950", icon: CheckCircle2 },
};

/* ── Types ──────────────────────────────────── */

interface OrdenDetalle {
  id: string;
  vehicleId: string;
  clientId: string;
  description: string | null;
  diagnosis: string | null;
  status: string;
  hvAlert: boolean;
  hvLockoutSigned: boolean;
  dtcCodes: string[] | null;
  totalCost: string | null;
  createdAt: string;
  updatedAt: string;
  vehiculo: string | null;
  plate: string | null;
  cliente: string | null;
  clienteEmail: string | null;
  clientePhone: string | null;
  servicios: any[];
  repuestos: any[];
  trabajosTerceros: any[];
  checklist: any | null;
  firmaRetiro: string | null;
  firmaRetiroNombre: string | null;
  dviInspections: any[];
  timeline: any[];
  ingresoId: string | null;
}

/* ── Main Page ──────────────────────────────── */

export default function OrdenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params.id as string;
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState("resumen");
  const [showStatusMenu, setShowStatusMenu] = React.useState(false);
  const [firmaRetiro, setFirmaRetiro] = React.useState("");
  const [firmaRetiroNombre, setFirmaRetiroNombre] = React.useState("");

  // Invoice dialog
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);
  const [invoiceTipo, setInvoiceTipo] = React.useState<"MANUAL" | "ELECTRONICA">("ELECTRONICA");
  const [invoiceManualNum, setInvoiceManualNum] = React.useState("");
  
  // Add/remove state
  const [addingServicio, setAddingServicio] = React.useState(false);
  const [addingRepuesto, setAddingRepuesto] = React.useState(false);
  const [newServicioId, setNewServicioId] = React.useState("");
  const [newRepuestoNombre, setNewRepuestoNombre] = React.useState("");
  const [newRepuestoPrecio, setNewRepuestoPrecio] = React.useState(0);
  const [newRepuestoCant, setNewRepuestoCant] = React.useState(1);

  // Click outside handler for status menu
  const statusMenuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Servicios catalog for adding
  const { data: catalogServicios = [] } = useQuery<any[]>({
    queryKey: ["service-catalog"],
    queryFn: () => api.request<any[]>("/workshop/servicios?activo=true"),
  });

  // Mutations
  const addServicio = useMutation({
    mutationFn: (servicioId: string) =>
      api.request(`/workshop/ordenes/${id}/servicios`, {
        method: "POST",
        body: JSON.stringify({ servicioId, cantidad: 1 }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orden-detail", id] });
      setAddingServicio(false);
      setNewServicioId("");
    },
  });

  const deleteServicio = useMutation({
    mutationFn: (itemId: string) =>
      api.request(`/workshop/ordenes/${id}/servicios/${itemId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orden-detail", id] }),
  });

  const addRepuesto = useMutation({
    mutationFn: () =>
      api.request(`/workshop/ordenes/${id}/repuestos`, {
        method: "POST",
        body: JSON.stringify({
          repuestoNombre: newRepuestoNombre,
          cantidad: newRepuestoCant,
          precioUnitario: newRepuestoPrecio,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orden-detail", id] });
      setAddingRepuesto(false);
      setNewRepuestoNombre("");
      setNewRepuestoPrecio(0);
      setNewRepuestoCant(1);
    },
  });

  const deleteRepuesto = useMutation({
    mutationFn: (itemId: string) =>
      api.request(`/workshop/ordenes/${id}/repuestos/${itemId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orden-detail", id] }),
  });

  // Fetch OT detail
  const { data: orden, isLoading } = useQuery<OrdenDetalle>({
    queryKey: ["orden-detail", id],
    queryFn: async () => {
      const [ot, servicios, repuestos, terceros] = await Promise.all([
        api.getWorkOrder(id),
        api.request<any[]>(`/workshop/ordenes/${id}/servicios`),
        api.request<any[]>(`/workshop/ordenes/${id}/repuestos`),
        api.request<any[]>(`/workshop/ordenes/${id}/trabajos-terceros`),
      ]);
      const clientHistory = await api.getClientHistory(ot.clientId).catch(() => null);

      // Resolve ingresoId for this OT via vehicle's ingresos
      let resolvedIngresoId: string | null = null;
      let checklistData: any = null;
      let firmaRetiroData: string | null = null;
      let firmaRetiroNombreData: string | null = null;
      try {
        const ingresos = await api.request<any[]>(`/workshop/ingresos?vehicleId=${ot.vehicleId}`);
        const linkedIngreso = ingresos?.find((i: any) => i.ordenTrabajo?.id === id);
        if (linkedIngreso) {
          resolvedIngresoId = linkedIngreso.id;
          checklistData = await api.request<any>(`/workshop/ingresos/${linkedIngreso.id}/checklist`).catch(() => null);
        }
      } catch { /* ingreso not found — OT may exist without linked ingreso */ }

      // Fetch real DVI inspections for this OT
      let dviData: any[] = [];
      try {
        dviData = await api.request<any[]>(`/dvi/orden/${id}`);
      } catch { /* no DVI inspections */ }

      // Fetch firma retiro via signatures endpoint
      try {
        const signatures = await api.request<any[]>(`/workshop/signatures/${id}`);
        const entrega = signatures?.find((s: any) => s.tipo === "ENTREGA");
        if (entrega) {
          firmaRetiroData = entrega.firmaBase64 ?? null;
          firmaRetiroNombreData = entrega.clienteNombre ?? null;
        }
      } catch { /* no signatures yet */ }

      // Build timeline from known events
      const timeline: any[] = [
        { fecha: ot.createdAt, estado: "Creada", usuario: "Sistema", descripcion: "Orden de trabajo creada" },
      ];
      if (checklistData) {
        timeline.push({ fecha: ot.createdAt, estado: "Checklist", usuario: "Sistema", descripcion: "Checklist de recepción completado" });
      }
      if (firmaRetiroData) {
        timeline.push({ fecha: ot.updatedAt, estado: "Entregado", usuario: "Sistema", descripcion: "Vehículo entregado al cliente" });
      }

      return {
        ...ot,
        clienteEmail: (clientHistory as any)?.client?.email ?? null,
        clientePhone: (clientHistory as any)?.client?.phone ?? null,
        servicios: servicios ?? [],
        repuestos: repuestos ?? [],
        trabajosTerceros: terceros ?? [],
        checklist: checklistData ?? null,
        firmaRetiro: firmaRetiroData,
        firmaRetiroNombre: firmaRetiroNombreData,
        dviInspections: dviData ?? [],
        timeline,
        ingresoId: resolvedIngresoId,
      } as OrdenDetalle;
    },
    enabled: !!id,
  });

  // G-06: Pricing suggest — fetch suggested price + hours when service is selected
  const { data: pricingSuggest } = useQuery<any>({
    queryKey: ["pricing-suggest", newServicioId, orden?.vehicleId],
    queryFn: () =>
      api.request(`/workshop/pricing-suggest?servicioId=${newServicioId}&vehicleTypeId=${orden?.vehicleId}`),
    enabled: !!newServicioId && !!orden?.vehicleId,
    staleTime: 60_000,
  });

  // Status change mutation
  const updateStatus = useMutation({
    mutationFn: (newStatus: string) => api.updateWorkOrderStatus(id, newStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orden-detail", id] });
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      setShowStatusMenu(false);
    },
  });

  // Issue invoice mutation
  const issueInvoiceMut = useMutation({
    mutationFn: () => api.issueInvoice({
      ordenId: id,
      tipoFacturacion: invoiceTipo,
      ...(invoiceTipo === "MANUAL" && invoiceManualNum ? { numeroFacturaManual: invoiceManualNum } : {}),
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["orden-detail", id] });
      setInvoiceOpen(false);
      setInvoiceManualNum("");
      const inv = result.data;
      if (inv?.sifenCdc) {
        toast.success(`Factura electrónica emitida · CDC: ${inv.sifenCdc.slice(0, 16)}...`);
      } else {
        toast.success(`Factura ${inv?.numeroFacturaManual || ""} emitida correctamente`);
      }
    },
    onError: (err: any) => toast.error(err?.message || "Error al emitir factura"),
  });

  // WhatsApp quick message mutation
  const sendWhatsApp = useMutation({
    mutationFn: (body: { phone: string; message: string }) => api.sendWhatsAppMessage(body),
    onSuccess: () => toast.success("Mensaje enviado por WhatsApp"),
    onError: (err: Error) => toast.error(err.message || "Error al enviar WhatsApp"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!orden) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Orden de trabajo no encontrada</p>
        <Button variant="outline" onClick={() => router.push("/dashboard/taller")} className="mt-4">
          ← Volver al Taller
        </Button>
      </div>
    );
  }

  const config = STATUS_CONFIG[orden.status] || { label: orden.status, color: "text-muted-foreground", bg: "bg-muted", icon: FileText, next: undefined };
  const canChangeStatus = orden.status !== "Listo" && config.next;
  const totalServicios = (orden.servicios || []).reduce((s: number, i: any) => s + Number(i.subtotal || 0), 0);
  const totalRepuestos = (orden.repuestos || []).reduce((s: number, i: any) => s + Number(i.subtotal || 0), 0);
  const totalTerceros = (orden.trabajosTerceros || []).reduce((s: number, i: any) => s + Number(i.costo || 0), 0);
  const totalGeneral = totalServicios + totalRepuestos + totalTerceros;

  const tabs = [
    { key: "resumen", label: "Resumen", icon: FileText },
    { key: "servicios", label: `Servicios (${orden.servicios?.length || 0})`, icon: Wrench },
    { key: "repuestos", label: `Repuestos (${orden.repuestos?.length || 0})`, icon: Package },
    { key: "terceros", label: `Terceros (${orden.trabajosTerceros?.length || 0})`, icon: ExternalLink },
    { key: "checklist", label: "Checklist", icon: ClipboardCheck },
    { key: "dvi", label: `DVI (${orden.dviInspections?.length || 0})`, icon: Camera },
    { key: "entrega", label: "Entrega", icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      {/* ── Header ─────────────────────── */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/taller")} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver al Taller
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight font-mono text-sm bg-muted px-2 py-0.5 rounded">
                OT #{orden.id.slice(0, 8)}
              </h1>
              <Badge className={cn(config.bg, config.color, "border-0")}>
                <config.icon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
              {orden.hvAlert && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  HV
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {orden.vehiculo} · {orden.plate} · {orden.cliente}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.open(`/workshop/ordenes/${orden.id}/pdf`, "_blank")}
            >
              <FileText className="h-4 w-4" />
              Imprimir OT
            </Button>
            {orden.status === "Listo" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => { setInvoiceTipo("ELECTRONICA"); setInvoiceOpen(true); }}
              >
                <Receipt className="h-4 w-4 text-blue-500" />
                Emitir Factura
              </Button>
            )}          {canChangeStatus && (
            <div className="relative">
              <Button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="gap-1.5"
              >
                <ChevronRight className="h-4 w-4" />
                Avanzar a {STATUS_CONFIG[config.next!]?.label}
              </Button>
              {showStatusMenu && (
                <Card ref={statusMenuRef} className="absolute right-0 top-10 z-50 w-48 shadow-lg">
                  <CardContent className="p-2">
                    {(["Presupuestado", "Aprobado", "En_Proceso", "Control_Calidad", "Listo"] as string[]).map((s) => {
                      const sc = STATUS_CONFIG[s];
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateStatus.mutate(s)}
                          disabled={updateStatus.isPending}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                            s === orden.status ? "bg-accent font-medium" : "hover:bg-accent/50"
                          )}
                        >
                          <sc.icon className="h-3.5 w-3.5" />
                          {sc.label}
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* ── Mobile Status Advance Bar ──── */}
      {/* Mobile buttons */}
      <div className="md:hidden space-y-2">
        {orden.status === "Listo" && (
          <Button
            onClick={() => { setInvoiceTipo("ELECTRONICA"); setInvoiceOpen(true); }}
            className="w-full h-12 text-base font-medium gap-2"
            size="lg"
            variant="outline"
          >
            <Receipt className="h-5 w-5 text-blue-500" />
            Emitir Factura
          </Button>
        )}
        {canChangeStatus && (
          <Button
            onClick={() => updateStatus.mutate(config.next!)}
            disabled={updateStatus.isPending}
            className="w-full h-12 text-base font-medium gap-2"
            size="lg"
          >
            {updateStatus.isPending ? (
              <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
            Avanzar a {STATUS_CONFIG[config.next!]?.label}
          </Button>
        )}
        {orden.status !== "Listo" && !canChangeStatus && (
          <Button variant="outline" onClick={() => setActiveTab("entrega")} className="w-full">
            <CheckCircle2 className="h-4 w-4 mr-1" /> Finalizar Entrega
          </Button>
        )}
      </div>

      {/* ── Tabs (scrollable on mobile) ─── */}
      <div className="flex gap-1 border-b overflow-x-auto scrollbar-none -mx-1 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0",
              activeTab === tab.key
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════ */}
      {/* TAB: Resumen */}
      {/* ═══════════════════════════════════ */}
      {activeTab === "resumen" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Cliente y Vehículo</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{orden.cliente}</div>
              <div className="flex items-center gap-2"><Car className="h-4 w-4 text-muted-foreground" />{orden.vehiculo} ({orden.plate})</div>
              {orden.clienteEmail && <div className="flex items-center gap-2 text-xs text-muted-foreground">✉ {orden.clienteEmail}</div>}
              {orden.clientePhone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>📞 {orden.clientePhone}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    disabled={sendWhatsApp.isPending}
                    onClick={() => {
                      const phone = orden.clientePhone!.replace(/\D/g, "");
                      const msg = `Hola ${orden.cliente}, su vehículo ${orden.vehiculo} (${orden.plate}) está en estado: ${orden.status}. — Taller MCA`;
                      sendWhatsApp.mutate({ phone, message: msg });
                    }}
                  >
                    {sendWhatsApp.isPending ? (
                      <span className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
                    ) : (
                      <MessageCircle className="h-3 w-3" />
                    )}
                    WhatsApp
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Costos</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Servicios</span><span>₲ {totalServicios.toLocaleString("es-PY")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Repuestos</span><span>₲ {totalRepuestos.toLocaleString("es-PY")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Terceros</span><span>₲ {totalTerceros.toLocaleString("es-PY")}</span></div>
              <div className="flex justify-between font-bold border-t pt-2"><span>Total</span><span>₲ {totalGeneral.toLocaleString("es-PY")}</span></div>
            </CardContent>
          </Card>
          {orden.diagnosis && (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-sm">Diagnóstico</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{orden.diagnosis}</p></CardContent>
            </Card>
          )}
          {orden.dtcCodes && orden.dtcCodes.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-sm">Códigos DTC</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {orden.dtcCodes.map((code: string) => (
                    <Badge key={code} variant="outline" className="font-mono">{code}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════ */}
      {/* TAB: Servicios */}
      {/* ═══════════════════════════════════ */}
      {activeTab === "servicios" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Servicios</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-normal">₲ {totalServicios.toLocaleString("es-PY")}</span>
                <Button variant="outline" size="sm" onClick={() => setAddingServicio(!addingServicio)} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  {addingServicio ? "Cancelar" : "Agregar"}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Add service form */}
            {addingServicio && (
              <div className="flex flex-col gap-2 rounded-lg border p-3 bg-accent/30">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">Servicio del Catálogo</label>
                    <select
                      value={newServicioId}
                      onChange={(e) => setNewServicioId(e.target.value)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="">Seleccionar servicio…</option>
                      {(catalogServicios as any[]).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.nombre} — ₲ {Number(s.precioEstimado || 0).toLocaleString("es-PY")}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    className="h-9"
                    disabled={!newServicioId}
                    loading={addServicio.isPending}
                    onClick={() => newServicioId && addServicio.mutate(newServicioId)}
                  >
                    Agregar
                  </Button>
                </div>
                {/* G-06: Pricing suggest info */}
                {pricingSuggest && (
                  <div className="flex flex-wrap gap-4 text-xs border-t pt-2">
                    <span className="text-muted-foreground">
                      Precio sugerido: <strong>₲ {Number(pricingSuggest.precioVentaPyg || 0).toLocaleString("es-PY")}</strong>
                    </span>
                    {pricingSuggest.horasEstimadas && (
                      <span className="text-muted-foreground">
                        Horas: <strong>{pricingSuggest.horasEstimadas}h</strong>
                        {pricingSuggest.horasMinimas && pricingSuggest.horasMaximas && (
                          <> ({pricingSuggest.horasMinimas}–{pricingSuggest.horasMaximas}h)</>
                        )}
                      </span>
                    )}
                    {pricingSuggest.requiereEspecialista && (
                      <Badge variant="destructive" className="text-[10px]">Requiere Especialista</Badge>
                    )}
                  </div>
                )}
              </div>
            )}

            {(!orden.servicios || orden.servicios.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay servicios asignados</p>
            ) : (
              <div className="space-y-2">
                {orden.servicios.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 text-sm group hover:bg-accent/30 transition-colors">
                    <div>
                      <p className="font-medium">{s.servicioNombre}</p>
                      <p className="text-xs text-muted-foreground">Cant: {s.cantidad} · ₲ {Number(s.precioUnitario).toLocaleString("es-PY")} c/u</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">₲ {Number(s.subtotal).toLocaleString("es-PY")}</span>
                      <button
                        onClick={() => { if (confirm("¿Eliminar este servicio?")) deleteServicio.mutate(s.id); }}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                        title="Eliminar servicio"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════ */}
      {/* TAB: Repuestos */}
      {/* ═══════════════════════════════════ */}
      {activeTab === "repuestos" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Repuestos</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-normal">₲ {totalRepuestos.toLocaleString("es-PY")}</span>
                <Button variant="outline" size="sm" onClick={() => setAddingRepuesto(!addingRepuesto)} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  {addingRepuesto ? "Cancelar" : "Agregar"}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Add repuesto form */}
            {addingRepuesto && (
              <div className="grid grid-cols-3 gap-2 items-end rounded-lg border p-3 bg-accent/30">
                <div>
                  <label className="text-xs text-muted-foreground">Nombre del Repuesto</label>
                  <input
                    value={newRepuestoNombre}
                    onChange={(e) => setNewRepuestoNombre(e.target.value)}
                    placeholder="Ej: Filtro de Aceite"
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    value={newRepuestoCant}
                    onChange={(e) => setNewRepuestoCant(Number(e.target.value))}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Precio Unit. (₲)</label>
                  <input
                    type="number"
                    min={0}
                    value={newRepuestoPrecio}
                    onChange={(e) => setNewRepuestoPrecio(Number(e.target.value))}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!newRepuestoNombre || newRepuestoPrecio <= 0}
                    loading={addRepuesto.isPending}
                    onClick={() => addRepuesto.mutate()}
                  >
                    Agregar Repuesto
                  </Button>
                </div>
              </div>
            )}

            {(!orden.repuestos || orden.repuestos.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay repuestos asignados</p>
            ) : (
              <div className="space-y-2">
                {orden.repuestos.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 text-sm group hover:bg-accent/30 transition-colors">
                    <div>
                      <p className="font-medium">{r.repuestoNombre}</p>
                      <p className="text-xs text-muted-foreground">Cód: {r.codigo || "—"} · Cant: {r.cantidad}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">₲ {Number(r.subtotal).toLocaleString("es-PY")}</span>
                      <button
                        onClick={() => { if (confirm("¿Eliminar este repuesto?")) deleteRepuesto.mutate(r.id); }}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                        title="Eliminar repuesto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════ */}
      {/* TAB: Terceros */}
      {/* ═══════════════════════════════════ */}
      {activeTab === "terceros" && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center justify-between"><span>Trabajos Terceros</span><span className="text-muted-foreground font-normal">₲ {totalTerceros.toLocaleString("es-PY")}</span></CardTitle></CardHeader>
          <CardContent>
            {(!orden.trabajosTerceros || orden.trabajosTerceros.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay trabajos tercerizados</p>
            ) : (
              <div className="space-y-2">
                {orden.trabajosTerceros.map((t: any) => (
                  <TrabajoTerceroCard key={t.id} trabajo={t} ordenId={id} qc={qc} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════ */}
      {/* TAB: Checklist */}
      {/* ═══════════════════════════════════ */}
      {activeTab === "checklist" && (
        <div className="space-y-4">
          {orden.checklist ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Checklist de Recepción</span>
                  <Badge variant="outline" className="text-xs">Completado</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Panels summary */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Paneles del vehículo</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(orden.checklist.panels || {}).map(([key, panel]: [string, any]) => (
                      <div key={key} className="flex items-center gap-2 text-xs rounded border p-2">
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          panel.estado === "BUENO" ? "bg-green-500" :
                          panel.estado === "RAYADO" ? "bg-yellow-500" :
                          panel.estado === "ABOLLADO" ? "bg-orange-500" :
                          panel.estado === "ROTO" ? "bg-red-500" : "bg-gray-400"
                        )} />
                        <span className="truncate">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Tires */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Neumáticos</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(orden.checklist.neumaticos || {}).map(([key, val]: [string, any]) => (
                      <div key={key} className="text-xs text-center rounded border p-2">
                        <p className="font-medium">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                        <p className="text-muted-foreground">{val || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Fuel */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">Combustible:</span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(orden.checklist.nivelCombustibleExacto || 0) * 100}%` }} />
                  </div>
                  <span className="font-medium">{Math.round((orden.checklist.nivelCombustibleExacto || 0) * 100)}%</span>
                </div>
                {/* Accessories */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Accesorios</h4>
                  <div className="flex flex-wrap gap-2">
                    {orden.checklist.accesorios && Object.entries(orden.checklist.accesorios).filter(([k]) => typeof orden.checklist.accesorios[k] === "boolean").map(([key, val]: [string, any]) => (
                      <Badge key={key} variant={val ? "default" : "outline"} className="text-xs">
                        {val ? "✓" : "✗"} {key.replace(/([A-Z])/g, " $1").trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <ClipboardCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-4">No hay checklist registrado para esta orden</p>
                {orden.ingresoId && (
                  <Button variant="outline" onClick={() => router.push(`/dashboard/taller/checklist/${orden.ingresoId}`)}>
                    <ClipboardCheck className="h-4 w-4 mr-1" />
                    Ir al Checklist de Recepción
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════ */}
      {/* TAB: DVI */}
      {/* ═══════════════════════════════════ */}
      {activeTab === "dvi" && (
        <div className="space-y-4">
          {(orden.dviInspections?.length || 0) > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Inspecciones DVI</span>
                  <Badge variant="outline" className="text-xs">{orden.dviInspections?.length} inspecciones</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {orden.dviInspections.map((dvi: any) => (
                  <div key={dvi.id} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent/30 transition-colors">
                    <div>
                      <p className="font-medium">DVI #{dvi.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">Estado: {dvi.estado || dvi.status || "N/A"} · {dvi.fechaCreacion ? new Date(dvi.fechaCreacion).toLocaleDateString("es-PY") : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {dvi.healthScore != null && (
                        <Badge variant={dvi.healthScore >= 80 ? "default" : dvi.healthScore >= 50 ? "outline" : "destructive"} className="text-xs">
                          Score: {dvi.healthScore}
                        </Badge>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push(`/dashboard/dvi/${dvi.id}`)}>
                        <ExternalLink className="h-3 w-3 mr-1" /> Ver
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No hay inspecciones DVI para esta orden</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════ */}
      {/* TAB: Entrega */}
      {/* ═══════════════════════════════════ */}
      {activeTab === "entrega" && (
        <div className="space-y-4">
          {orden.status === "Listo" && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Firma de Retiro</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  El cliente debe firmar para confirmar que recibió el vehículo conforme.
                </p>
                <FormField label="Nombre del Cliente" htmlFor="fn">
                  <Input id="fn" value={firmaRetiroNombre} onChange={(e) => setFirmaRetiroNombre(e.target.value)} placeholder="Nombre completo" />
                </FormField>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Firma Digital</label>
                  <canvas
                    id="signature-canvas"
                    width={400}
                    height={120}
                    className="w-full border rounded-lg bg-white touch-none cursor-crosshair"
                    onMouseDown={(e) => {
                      const canvas = e.currentTarget;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) return;
                      const rect = canvas.getBoundingClientRect();
                      ctx.beginPath();
                      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                      ctx.strokeStyle = "#000";
                      ctx.lineWidth = 2;
                    }}
                    onMouseMove={(e) => {
                      if (e.buttons !== 1) return;
                      const canvas = e.currentTarget;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) return;
                      const rect = canvas.getBoundingClientRect();
                      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                      ctx.stroke();
                    }}
                    onMouseUp={(e) => {
                      const canvas = e.currentTarget;
                      setFirmaRetiro(canvas.toDataURL("image/png"));
                    }}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!firmaRetiro || !firmaRetiroNombre}
                  onClick={async () => {
                    if (!firmaRetiro || !firmaRetiroNombre) return;
                    try {
                      // Save via signatures endpoint
                      await api.request("/workshop/signatures", {
                        method: "POST",
                        body: JSON.stringify({
                          ordenTrabajoId: id,
                          tipo: "ENTREGA",
                          firmaBase64: firmaRetiro,
                          clienteNombre: firmaRetiroNombre,
                        }),
                      });
                      // Also save via ingreso firma-retiro endpoint if linked
                      if (orden?.ingresoId) {
                        await api.request(`/workshop/ingresos/${orden.ingresoId}/firma-retiro`, {
                          method: "POST",
                          body: JSON.stringify({ firma: firmaRetiro, nombre: firmaRetiroNombre }),
                        });
                      }
                      qc.invalidateQueries({ queryKey: ["orden-detail", id] });
                      toast.success("Vehículo entregado correctamente");
                      router.push("/dashboard/taller");
                    } catch (err: any) {
                      toast.error(err?.message || "Error al guardar firma");
                    }
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Confirmar Entrega
                </Button>
              </CardContent>
            </Card>
          )}
          {orden.status !== "Listo" && (
            <Card>
              <CardContent className="text-center py-8">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">La orden debe estar en estado "Listo" para realizar la entrega</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Invoice Dialog ──────────────────── */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Emitir Factura</DialogTitle>
            <DialogDescription>
              Seleccione el tipo de facturación para la OT #{id.slice(0, 8)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Facturación</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors",
                    invoiceTipo === "ELECTRONICA"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "border-input hover:bg-accent"
                  )}
                  onClick={() => setInvoiceTipo("ELECTRONICA")}
                >
                  <FileSpreadsheet className="h-5 w-5 mx-auto mb-1" />
                  Electrónica (SIFEN)
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors",
                    invoiceTipo === "MANUAL"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "border-input hover:bg-accent"
                  )}
                  onClick={() => setInvoiceTipo("MANUAL")}
                >
                  <Receipt className="h-5 w-5 mx-auto mb-1" />
                  Manual (Física)
                </button>
              </div>
            </div>

            {invoiceTipo === "MANUAL" && (
              <div className="space-y-2">
                <label htmlFor="manual-num" className="text-sm font-medium">
                  Número de Factura Manual
                </label>
                <Input
                  id="manual-num"
                  value={invoiceManualNum}
                  onChange={(e) => setInvoiceManualNum(e.target.value)}
                  placeholder="Ej: 001-001-0000123"
                />
              </div>
            )}

            {(orden.totalCost || totalGeneral > 0) && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total a facturar</span>
                  <span className="font-semibold">₲ {Number(orden.totalCost || totalGeneral).toLocaleString("es-PY")}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInvoiceOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => issueInvoiceMut.mutate()}
              disabled={issueInvoiceMut.isPending || (invoiceTipo === "MANUAL" && !invoiceManualNum)}
              loading={issueInvoiceMut.isPending}
            >
              <Receipt className="h-4 w-4 mr-1" />
              Emitir Factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Trabajo Tercero Card with Attachments ───── */

function TrabajoTerceroCard({
  trabajo,
  ordenId,
  qc,
}: {
  trabajo: any;
  ordenId: string;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const { data: adjuntos = [] } = useQuery<any[]>({
    queryKey: ["trabajo-adjuntos", ordenId, trabajo.id],
    queryFn: () =>
      api.request(`/workshop/ordenes/${ordenId}/trabajos-terceros/${trabajo.id}/adjuntos`),
    staleTime: 30_000,
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `${api.getBaseUrl()}/workshop/ordenes/${ordenId}/trabajos-terceros/${trabajo.id}/adjuntos`,
        {
          method: "POST",
          headers: { "X-Tenant-Slug": api.getTenantSlug() },
          body: formData,
        }
      );
      if (!response.ok) throw new Error("Error subiendo archivo");
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trabajo-adjuntos", ordenId, trabajo.id] });
      setUploading(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (path: string) =>
      api.request(
        `/workshop/ordenes/${ordenId}/trabajos-terceros/${trabajo.id}/adjuntos?path=${encodeURIComponent(path)}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trabajo-adjuntos", ordenId, trabajo.id] });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    uploadMut.mutate(file);
    e.target.value = "";
  }

  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{trabajo.descripcion}</p>
          <p className="text-xs text-muted-foreground">Proveedor: {trabajo.proveedor} · Estado: {trabajo.estado}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">₲ {Number(trabajo.costo).toLocaleString("es-PY")}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Plus className="h-3 w-3" />
            {uploading ? "Subiendo…" : "Factura"}
          </Button>
        </div>
      </div>
      {adjuntos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {adjuntos.map((a: any) => (
            <a
              key={a.path}
              href={`/api/storage/${encodeURIComponent(a.path)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded border bg-muted/50 px-2 py-0.5 text-[10px] hover:bg-muted transition-colors"
            >
              <FileText className="h-2.5 w-2.5" />
              {a.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
