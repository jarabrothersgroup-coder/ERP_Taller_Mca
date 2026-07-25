"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  LayoutDashboard,
  Wrench,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Receipt,
  MessageCircle,
  Send,
  DollarSign,
  ArrowRight,
  Car,
  User,
  Phone,
  ExternalLink,
  Star,
  ChevronRight,
  Camera,
  ClipboardCheck,
  Printer,
  Search,
  Zap,
  X,
  Building2,
} from "lucide-react";

/* ── Types ──────────────────────────────────── */

interface KanbanOT {
  id: string;
  vehicleId: string;
  clientId: string;
  description: string | null;
  status: string;
  totalCost: string | null;
  createdAt: string;
  vehicleName?: string;
  plate?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  hvAlert?: boolean;
  services?: any[];
  repuestos?: any[];
  trabajosTerceros?: any[];
}

/* ── Status Config ──────────────────────────── */

const STATUS_FLOW = [
  { key: "Presupuestado", label: "Presupuestado", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-800/30", dot: "bg-yellow-500" },
  { key: "Aprobado", label: "Aprobado", icon: Star, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800/30", dot: "bg-blue-500" },
  { key: "En_Proceso", label: "En Proceso", icon: Wrench, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800/30", dot: "bg-indigo-500" },
  { key: "Control_Calidad", label: "Control Calidad", icon: Search, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800/30", dot: "bg-purple-500" },
  { key: "Listo", label: "Listo", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800/30", dot: "bg-green-500" },
];

function getStatusConfig(status: string) {
  return STATUS_FLOW.find(s => s.key === status) || STATUS_FLOW[0];
}

function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value || 0);
  return `₲ ${num.toLocaleString("es-PY")}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/* ═══════════════════════════════════════════════ */
/* ── Sidebar Quick Stats Component ─────────── */
/* ═══════════════════════════════════════════════ */

function HubSidebar({ ordenes, selectedId, onSelect }: {
  ordenes: KanbanOT[];
  selectedId: string | null;
  onSelect: (ot: KanbanOT) => void;
}) {
  // Group by status
  const grouped = React.useMemo(() => {
    const groups: Record<string, KanbanOT[]> = {};
    for (const s of STATUS_FLOW) groups[s.key] = [];
    for (const ot of ordenes) {
      if (groups[ot.status]) groups[ot.status].push(ot);
      else groups.Presupuestado.push(ot);
    }
    return groups;
  }, [ordenes]);

  const counts = React.useMemo(() => {
    return STATUS_FLOW.map(s => ({
      ...s,
      count: (grouped[s.key] || []).length,
    }));
  }, [grouped]);

  return (
    <div className="space-y-3">
      {/* Status summary chips */}
      <div className="flex flex-wrap gap-1.5">
        {counts.map(s => (
          <button
            key={s.key}
            onClick={() => {
              const first = grouped[s.key]?.[0];
              if (first) onSelect(first);
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border",
              s.count > 0
                ? `${s.bg} ${s.color} ${s.border} hover:shadow-sm`
                : "text-muted-foreground/50 border-muted bg-muted/30"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
            {s.count}
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>

      {/* OT List grouped by status */}
      <div className="space-y-2">
        {STATUS_FLOW.map(s => {
          const items = grouped[s.key] || [];
          if (items.length === 0) return null;
          return (
            <div key={s.key}>
              <h4 className={cn("text-[11px] font-semibold uppercase tracking-wider px-1 mb-1", s.color)}>
                {s.label} · {items.length}
              </h4>
              <div className="space-y-1">
                {items.map(ot => (
                  <button
                    key={ot.id}
                    onClick={() => onSelect(ot)}
                    className={cn(
                      "w-full text-left rounded-lg border p-2.5 transition-all duration-150 group",
                      selectedId === ot.id
                        ? `${s.bg} ${s.border} shadow-sm ring-1 ring-offset-1 ${s.color.replace("text-", "ring-")}`
                        : "border-transparent hover:bg-accent/50 hover:border-border"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)} />
                          <span className="text-xs font-mono font-medium truncate">
                            OT #{ot.id.slice(0, 8)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {ot.vehicleName || "Sin vehículo"} · {ot.plate || "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 truncate">
                          {ot.clientName || "Sin cliente"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-[10px] tabular-nums text-muted-foreground/60">
                          {timeAgo(ot.createdAt)}
                        </span>
                        {ot.hvAlert && (
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {ordenes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay órdenes activas</p>
          <p className="text-xs">Crea una nueva desde el botón superior</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════ */
/* ── Cobro + Work Tercero Actions ─────────── */
/* ═══════════════════════════════════════════════ */

function CobroActions({ ordenId, total, onRefresh }: { ordenId: string; total: number; onRefresh: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: bankAccounts = [] } = useQuery<any[]>({
    queryKey: ["hub-bank-accounts"],
    queryFn: () => api.request<any[]>("/finance/treasury/cuentas?activo=true"),
  });

  const [invoiceLoading, setInvoiceLoading] = React.useState(false);
  const [cobroLoading, setCobroLoading] = React.useState(false);
  const defaultCuentaId = bankAccounts[0]?.id || null;

  const handleFacturar = async () => {
    setInvoiceLoading(true);
    try {
      const result = await api.issueInvoice({ ordenId, tipoFacturacion: "ELECTRONICA" });
      const inv = result.data;
      if (inv?.sifenCdc) toast.success(`Factura electrónica emitida · CDC: ${inv.sifenCdc.slice(0, 16)}...`);
      else toast.success("Factura emitida correctamente");
      qc.invalidateQueries({ queryKey: ["hub-orden-detail", ordenId] });
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Error al emitir factura");
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleCobro = async () => {
    if (!defaultCuentaId) {
      toast.error("No hay cuentas bancarias configuradas. Creá una en Tesorería primero.");
      return;
    }
    setCobroLoading(true);
    try {
      await api.request("/finance/treasury/movimientos", {
        method: "POST",
        body: JSON.stringify({
          cuentaId: defaultCuentaId,
          tipo: "INGRESO",
          medioPago: "EFECTIVO",
          monto: total,
          concepto: `Cobro OT #${ordenId.slice(0, 8)}`,
          fecha: new Date().toISOString(),
        }),
      });
      toast.success("Cobro registrado en tesorería");
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Error al registrar cobro");
    } finally {
      setCobroLoading(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        className="h-8 text-xs gap-1.5"
        onClick={handleFacturar}
        disabled={invoiceLoading}
      >
        <Receipt className="h-3.5 w-3.5" />
        {invoiceLoading ? "Facturando..." : "Facturar"}
      </Button>
      <Button
        size="sm"
        className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
        onClick={handleCobro}
        disabled={cobroLoading}
      >
        <DollarSign className="h-3.5 w-3.5" />
        {cobroLoading ? "Registrando..." : "Registrar Cobro"}
      </Button>
    </>
  );
}

/* ═══════════════════════════════════════════════ */
/* ── OT Detail Panel (Right Side) ──────────── */
/* ═══════════════════════════════════════════════ */

function OTDetailPanel({ orden, onClose, onRefresh }: {
  orden: KanbanOT | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addingRepuesto, setAddingRepuesto] = React.useState(false);
  const [newRepuestoNombre, setNewRepuestoNombre] = React.useState("");
  const [newRepuestoPrecio, setNewRepuestoPrecio] = React.useState(0);
  const [newRepuestoCant, setNewRepuestoCant] = React.useState(1);
  const [addingTercero, setAddingTercero] = React.useState(false);
  const [terceroProveedor, setTerceroProveedor] = React.useState("");
  const [terceroDescripcion, setTerceroDescripcion] = React.useState("");
  const [terceroCosto, setTerceroCosto] = React.useState(0);

  // Fetch full detail
  const { data: fullOrden, isLoading } = useQuery<any>({
    queryKey: ["hub-orden-detail", orden?.id],
    queryFn: async () => {
      if (!orden?.id) return null;
      const [ot, servicios, repuestos, terceros] = await Promise.all([
        api.getWorkOrder(orden.id),
        api.request<any[]>(`/workshop/ordenes/${orden.id}/servicios`).catch(() => []),
        api.request<any[]>(`/workshop/ordenes/${orden.id}/repuestos`).catch(() => []),
        api.request<any[]>(`/workshop/ordenes/${orden.id}/trabajos-terceros`).catch(() => []),
      ]);
      return { ...ot, servicios, repuestos, trabajosTerceros: terceros };
    },
    enabled: !!orden?.id,
  });

  // Status advance mutation
  const advanceStatus = useMutation({
    mutationFn: () => {
      if (!fullOrden) throw new Error("No hay orden seleccionada");
      const config = getStatusConfig(fullOrden.status);
      if (!config || !STATUS_FLOW.find(s => s.key === config.key)?.key) throw new Error("Estado no válido");
      const currentIdx = STATUS_FLOW.findIndex(s => s.key === fullOrden.status);
      if (currentIdx < 0 || currentIdx >= STATUS_FLOW.length - 1) throw new Error("No se puede avanzar más");
      return api.updateWorkOrderStatus(fullOrden.id, STATUS_FLOW[currentIdx + 1].key);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      qc.invalidateQueries({ queryKey: ["hub-orden-detail", orden?.id] });
      onRefresh();
      toast.success("Estado actualizado correctamente");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Add repuesto mutation
  const addRepuesto = useMutation({
    mutationFn: () => {
      if (!orden?.id) throw new Error("No hay orden seleccionada");
      return api.request(`/workshop/ordenes/${orden.id}/repuestos`, {
        method: "POST",
        body: JSON.stringify({
          repuestoNombre: newRepuestoNombre,
          cantidad: newRepuestoCant,
          precioUnitario: newRepuestoPrecio,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hub-orden-detail", orden?.id] });
      setAddingRepuesto(false);
      setNewRepuestoNombre("");
      setNewRepuestoPrecio(0);
      setNewRepuestoCant(1);
      toast.success("Repuesto agregado correctamente");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Add trabajo tercero mutation
  const addTercero = useMutation({
    mutationFn: () => {
      if (!orden?.id) throw new Error("No hay orden seleccionada");
      return api.request(`/workshop/ordenes/${orden.id}/trabajos-terceros`, {
        method: "POST",
        body: JSON.stringify({
          proveedor: terceroProveedor,
          descripcion: terceroDescripcion,
          costo: terceroCosto,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hub-orden-detail", orden?.id] });
      setAddingTercero(false);
      setTerceroProveedor("");
      setTerceroDescripcion("");
      setTerceroCosto(0);
      toast.success("Trabajo tercero registrado correctamente");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Consolidated WhatsApp: send OT summary + invoice link
  const sendConsolidated = useMutation({
    mutationFn: () => {
      if (!orden) throw new Error("No hay orden seleccionada");
      const phone = orden.clientPhone?.replace(/\D/g, "") || "";
      const lines = [
        `🧾 *OT #${orden.id.slice(0, 8)} - ${orden.vehicleName || ""}*`,
        `📋 Estado: ${fullOrden?.status || orden.status}`,
        `💵 Total: ${formatCurrency(totalGeneral)}`,
        ``,
        `🔗 Adjuntos y OT completa:`,
        `${window.location.origin}/dashboard/taller/${orden.id}`,
      ];
      const msg = lines.join("\n");
      return api.sendWhatsAppMessage({ phone, message: msg });
    },
    onSuccess: () => toast.success("Resumen enviado al cliente por WhatsApp"),
    onError: (err: Error) => toast.error(err.message),
  });

  // Simple status WhatsApp
  const sendWhatsApp = useMutation({
    mutationFn: () => {
      const phone = orden?.clientPhone?.replace(/\D/g, "") || "";
      const msg = `Hola ${orden?.clientName || "cliente"}, su vehículo ${orden?.vehicleName || ""} (${orden?.plate || ""}) está en estado: ${fullOrden?.status || orden?.status}. — Taller MCA`;
      return api.sendWhatsAppMessage({ phone, message: msg });
    },
    onSuccess: () => toast.success("Mensaje enviado por WhatsApp"),
    onError: (err: Error) => toast.error(err.message),
  });

  if (!orden) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-2">
          <LayoutDashboard className="h-12 w-12 mx-auto opacity-20" />
          <p className="text-sm">Seleccioná una orden de trabajo</p>
          <p className="text-xs">del panel izquierdo para ver sus detalles</p>
        </div>
      </div>
    );
  }

  const config = getStatusConfig(fullOrden?.status || orden.status);
  const currentIdx = STATUS_FLOW.findIndex(s => s.key === (fullOrden?.status || orden.status));
  const canAdvance = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1;
  const nextStatus = canAdvance ? STATUS_FLOW[currentIdx + 1] : null;

  const totalServicios = (fullOrden?.servicios || []).reduce((s: number, i: any) => s + Number(i.subtotal || 0), 0);
  const totalRepuestos = (fullOrden?.repuestos || []).reduce((s: number, i: any) => s + Number(i.subtotal || 0), 0);
  const totalTerceros = (fullOrden?.trabajosTerceros || []).reduce((s: number, i: any) => s + Number(i.costo || 0), 0);
  const totalGeneral = totalServicios + totalRepuestos + totalTerceros;

  return (
    <div className="h-full flex flex-col">
      {/* Detail header */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 lg:hidden">
            <X className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold">OT #{orden.id.slice(0, 8)}</span>
              <Badge className={cn(config.bg, config.color, "border-0 text-[10px]")}>
                <config.icon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {orden.vehicleName || "Sin vehículo"} · {orden.plate || "Sin placa"}
            </p>
          </div>
        </div>

        {/* Quick actions row */}
        <div className="flex items-center gap-1">
          {canAdvance && nextStatus && (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => advanceStatus.mutate()}
              disabled={advanceStatus.isPending}
            >
              {advanceStatus.isPending ? (
                <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Avanzar a {nextStatus.label}
            </Button>
          )}
          {fullOrden?.status === "Listo" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                const el = document.getElementById("hub-invoice-btn");
                el?.click();
              }}
            >
              <Receipt className="h-3.5 w-3.5 text-blue-500" />
              Facturar
            </Button>
          )}
        </div>
      </div>

      {/* Detail body */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-32" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <>
            {/* Client & Vehicle info card */}
            <Card className="border-0 shadow-none bg-accent/20">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{orden.clientName || "Sin cliente"}</span>
                  </div>
                  {orden.clientPhone && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={() => sendWhatsApp.mutate()}
                      disabled={sendWhatsApp.isPending}
                    >
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span>{orden.vehicleName || "Sin vehículo"}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{orden.plate || "—"}</Badge>
                </div>
                {orden.clientPhone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {orden.clientPhone}
                  </div>
                )}
                {fullOrden?.description && (
                  <p className="text-sm text-muted-foreground border-t pt-2 mt-2">
                    {fullOrden.description}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Diagnostic info */}
            {fullOrden?.diagnosis && (
              <Card className="border-0 shadow-none bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="p-3">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Diagnóstico</p>
                  <p className="text-sm whitespace-pre-wrap">{fullOrden.diagnosis}</p>
                </CardContent>
              </Card>
            )}

            {/* Costs summary */}
            <Card className="border-0 shadow-none">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Servicios</span>
                  <span>{formatCurrency(totalServicios)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Repuestos</span>
                  <span>{formatCurrency(totalRepuestos)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Terceros</span>
                  <span>{formatCurrency(totalTerceros)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-1.5">
                  <span>Total</span>
                  <span>{formatCurrency(totalGeneral)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Services list */}
            {(fullOrden?.servicios?.length || 0) > 0 && (
              <Card className="border-0 shadow-none">
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Wrench className="h-3 w-3" />
                    Servicios ({fullOrden.servicios.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-1">
                  {fullOrden.servicios.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0 border-dashed">
                      <span className="truncate">{s.servicioNombre || "Servicio"}</span>
                      <span className="font-medium ml-2 shrink-0">{formatCurrency(s.subtotal)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Parts list */}
            <Card className="border-0 shadow-none">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3 w-3" />
                    Repuestos ({fullOrden?.repuestos?.length || 0})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] gap-1"
                    onClick={() => setAddingRepuesto(!addingRepuesto)}
                  >
                    {addingRepuesto ? "Cancelar" : "+ Agregar"}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-1">
                {/* Inline add repuesto form */}
                {addingRepuesto && (
                  <div className="grid grid-cols-4 gap-2 items-end rounded-lg border p-2 bg-accent/30 mb-2">
                    <div className="col-span-2">
                      <label className="text-[10px] text-muted-foreground">Nombre</label>
                      <input
                        value={newRepuestoNombre}
                        onChange={(e) => setNewRepuestoNombre(e.target.value)}
                        placeholder="Ej: Filtro Aceite"
                        className="mt-0.5 flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Cant.</label>
                      <input
                        type="number"
                        min={1}
                        value={newRepuestoCant}
                        onChange={(e) => setNewRepuestoCant(Number(e.target.value))}
                        className="mt-0.5 flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">₲/u</label>
                      <input
                        type="number"
                        min={0}
                        value={newRepuestoPrecio}
                        onChange={(e) => setNewRepuestoPrecio(Number(e.target.value))}
                        className="mt-0.5 flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                      />
                    </div>
                    <div className="col-span-4">
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs"
                        disabled={!newRepuestoNombre || newRepuestoPrecio <= 0}
                        onClick={() => addRepuesto.mutate()}
                      >
                        + Agregar Repuesto
                      </Button>
                    </div>
                  </div>
                )}

                {(fullOrden?.repuestos?.length || 0) > 0 ? (
                  fullOrden.repuestos.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0 border-dashed">
                      <span className="truncate">{r.repuestoNombre || "Repuesto"}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground">x{r.cantidad}</span>
                        <span className="font-medium">{formatCurrency(r.subtotal)}</span>
                      </div>
                    </div>
                  ))
                ) : !addingRepuesto && (
                  <p className="text-[10px] text-muted-foreground text-center py-2">Sin repuestos asignados</p>
                )}
              </CardContent>
            </Card>

            {/* Terceros list with inline add */}
            <Card className="border-0 shadow-none">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" />
                    Trabajos Terceros ({fullOrden?.trabajosTerceros?.length || 0})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] gap-1"
                    onClick={() => setAddingTercero(!addingTercero)}
                  >
                    {addingTercero ? "Cancelar" : "+ Agregar"}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-1">
                {addingTercero && (
                  <div className="grid grid-cols-3 gap-2 items-end rounded-lg border p-2 bg-accent/30 mb-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Proveedor</label>
                      <input value={terceroProveedor} onChange={e => setTerceroProveedor(e.target.value)} placeholder="Taller XYZ" className="mt-0.5 flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Costo (₲)</label>
                      <input type="number" min={0} value={terceroCosto} onChange={e => setTerceroCosto(Number(e.target.value))} className="mt-0.5 flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs" />
                    </div>
                    <div>
                      <Button size="sm" className="w-full h-7 text-xs" disabled={!terceroProveedor || !terceroDescripcion || terceroCosto <= 0} onClick={() => addTercero.mutate()}>
                        + Registrar
                      </Button>
                    </div>
                    <div className="col-span-3">
                      <input value={terceroDescripcion} onChange={e => setTerceroDescripcion(e.target.value)} placeholder="Descripción del trabajo tercerizado..." className="mt-0.5 flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs" />
                    </div>
                  </div>
                )}
                {(fullOrden?.trabajosTerceros?.length || 0) > 0 ? (
                  fullOrden.trabajosTerceros.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0 border-dashed">
                      <div className="truncate">
                        <span className="font-medium">{t.proveedor}</span>
                        <span className="text-muted-foreground ml-1">· {t.descripcion}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[9px]">{t.estado}</Badge>
                        <span className="font-medium">{formatCurrency(t.costo)}</span>
                      </div>
                    </div>
                  ))
                ) : !addingTercero && (
                  <p className="text-[10px] text-muted-foreground text-center py-2">Sin trabajos tercerizados</p>
                )}
              </CardContent>
            </Card>

            {/* Progress stepper */}
            <Card className="border-0 shadow-none bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <CardContent className="p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Progreso</p>
                <div className="flex items-center gap-0">
                  {STATUS_FLOW.map((s, i) => {
                    const isActive = i <= currentIdx;
                    const isCurrent = i === currentIdx;
                    return (
                      <React.Fragment key={s.key}>
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center transition-all",
                            isActive ? (isCurrent ? "bg-blue-500 text-white ring-2 ring-blue-200" : "bg-blue-500/20 text-blue-600") : "bg-muted text-muted-foreground/50"
                          )}>
                            <s.icon className="h-3 w-3" />
                          </div>
                          <span className={cn(
                            "text-[9px] mt-0.5 font-medium",
                            isActive ? "text-blue-600" : "text-muted-foreground/50"
                          )}>
                            {s.label.split(" ")[0]}
                          </span>
                        </div>
                        {i < STATUS_FLOW.length - 1 && (
                          <div className={cn(
                            "flex-1 h-px mx-1",
                            i < currentIdx ? "bg-blue-400" : "bg-muted"
                          )} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="border-t pt-3 flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => window.open(`/workshop/ordenes/${orden.id}/pdf`, "_blank")}
        >
          <Printer className="h-3.5 w-3.5" />
          Imprimir OT
        </Button>
        {orden.clientPhone && (<>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 text-emerald-600 hover:text-emerald-700"
            onClick={() => sendWhatsApp.mutate()}
            disabled={sendWhatsApp.isPending}
          >
            <Send className="h-3.5 w-3.5" />
            WhatsApp
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => sendConsolidated.mutate()}
            disabled={sendConsolidated.isPending}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {sendConsolidated.isPending ? "Enviando..." : "Enviar a Cliente"}
          </Button>
        </>)}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => window.open(`/dashboard/taller/${orden.id}`, "_blank")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ver OT Completa
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => window.open(`/dashboard/recepcion?ordenId=${orden.id}`, "_blank")}
        >
          <Camera className="h-3.5 w-3.5" />
          DVI / Fotos
        </Button>
        {fullOrden?.status === "Listo" && (
          <>
            <CobroActions ordenId={orden.id} total={totalGeneral} onRefresh={onRefresh} />
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════ */
/* ── Quick Create Modal ────────────────────── */
/* ═══════════════════════════════════════════════ */

function QuickCreateModal({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = React.useState<"cliente" | "vehiculo" | "orden">("cliente");
  const [clientName, setClientName] = React.useState("");
  const [clientPhone, setClientPhone] = React.useState("");
  const [clientEmail, setClientEmail] = React.useState("");
  const [vehicleName, setVehicleName] = React.useState("");
  const [plate, setPlate] = React.useState("");
  const [service, setService] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [createdClientId, setCreatedClientId] = React.useState<string | null>(null);
  const [createdVehicleId, setCreatedVehicleId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  // Search existing clients
  const { data: existingClients = [] } = useQuery<any[]>({
    queryKey: ["hub-clients-search"],
    queryFn: () => api.request<any[]>("/workshop/clientes?limit=50"),
  });

  // Search existing vehicles for selected client
  const { data: existingVehicles = [] } = useQuery<any[]>({
    queryKey: ["hub-vehicles-search", createdClientId],
    queryFn: () => createdClientId
      ? api.request<any[]>(`/workshop/vehiculos?clientId=${createdClientId}&limit=50`)
      : Promise.resolve([]),
    enabled: !!createdClientId,
  });

  const handleCreate = async () => {
    setCreating(true);
    try {
      // Step 1: Create client (or skip if selected existing)
      let clientId = createdClientId;
      if (!clientId && clientName.trim()) {
        const client = await api.createClient({
          name: clientName.trim(),
          phone: clientPhone || undefined,
          email: clientEmail || undefined,
        });
        clientId = client.id;
        setCreatedClientId(clientId);
      }

      if (!clientId) {
        toast.error("Debe seleccionar o crear un cliente");
        setCreating(false);
        return;
      }

      // Step 2: Create vehicle (or skip if selected existing)
      let vehicleId = createdVehicleId;
      if (!vehicleId && vehicleName.trim()) {
        const vehicle = await api.createVehicle({
          plate: plate.toUpperCase().trim() || "SIN-PLACA",
          brand: vehicleName.split(" ")[0] || "Sin marca",
          model: vehicleName.trim(),
          clientId,
        });
        vehicleId = vehicle.id;
        setCreatedVehicleId(vehicleId);
      }

      if (!vehicleId) {
        toast.error("Debe seleccionar o crear un vehículo");
        setCreating(false);
        return;
      }

      // Step 3: Create work order
      if (service.trim() && vehicleId) {
        await api.createWorkOrder({
          vehicleId,
          clientId,
          description: service.trim(),
        });
      }

      qc.invalidateQueries({ queryKey: ["work-orders"] });
      qc.invalidateQueries({ queryKey: ["hub-clients-search"] });
      qc.invalidateQueries({ queryKey: ["hub-vehicles-search"] });
      toast.success("Orden de trabajo creada exitosamente");
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || "Error al crear la orden");
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setStep("cliente");
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setVehicleName("");
    setPlate("");
    setService("");
    setNotes("");
    setCreatedClientId(null);
    setCreatedVehicleId(null);
  };

  // Select existing client
  const selectExistingClient = (c: any) => {
    setCreatedClientId(c.id);
    setClientName(c.name);
    setStep("vehiculo");
  };

  // Select existing vehicle
  const selectExistingVehicle = (v: any) => {
    setCreatedVehicleId(v.id);
    setVehicleName(`${v.brand || ""} ${v.model || ""}`.trim());
    setPlate(v.plate || "");
    setStep("orden");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            {step === "cliente" ? "Paso 1: Cliente" : step === "vehiculo" ? "Paso 2: Vehículo" : "Paso 3: Orden de Trabajo"}
          </DialogTitle>
          <DialogDescription>
            {step === "cliente" && "Seleccioná un cliente existente o creá uno nuevo"}
            {step === "vehiculo" && "Seleccioná un vehículo o creá uno nuevo para este cliente"}
            {step === "orden" && "Describí el trabajo a realizar"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {["cliente", "vehiculo", "orden"].map((s, i) => (
              <React.Fragment key={s}>
                <div className={cn(
                  "flex items-center gap-1.5 text-xs font-medium",
                  step === s ? "text-orange-500" : i < ["cliente", "vehiculo", "orden"].indexOf(step) ? "text-green-500" : "text-muted-foreground/50"
                )}>
                  <div className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    step === s ? "bg-orange-500 text-white" : i < ["cliente", "vehiculo", "orden"].indexOf(step) ? "bg-green-500 text-white" : "bg-muted text-muted-foreground/50"
                  )}>{i + 1}</div>
                  {s === "cliente" ? "Cliente" : s === "vehiculo" ? "Vehículo" : "OT"}
                </div>
                {i < 2 && <div className="flex-1 h-px bg-muted" />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Client */}
          {step === "cliente" && (
            <div className="space-y-3">
              <div className="space-y-1 max-h-32 overflow-y-auto">
                <p className="text-[11px] font-medium text-muted-foreground">Clientes existentes</p>
                {existingClients.slice(0, 5).map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectExistingClient(c)}
                    className="w-full text-left text-xs p-2 rounded-lg border hover:bg-accent/50 transition-colors flex items-center gap-2"
                  >
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{c.name}</span>
                    {c.phone && <span className="text-muted-foreground">· {c.phone}</span>}
                  </button>
                ))}
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <span className="relative flex justify-center text-xs text-muted-foreground bg-background px-2">o crear nuevo</span>
              </div>
              <FormField label="Nombre del Cliente" htmlFor="new-client-name" required>
                <Input id="new-client-name" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Juan Pérez" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Teléfono" htmlFor="new-client-phone">
                  <Input id="new-client-phone" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="0981 123 456" />
                </FormField>
                <FormField label="Email" htmlFor="new-client-email">
                  <Input id="new-client-email" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="cliente@email.com" />
                </FormField>
              </div>
              <Button
                className="w-full"
                size="sm"
                disabled={!clientName.trim()}
                onClick={() => {
                  if (existingClients.find((c: any) => c.name.toLowerCase() === clientName.toLowerCase())) {
                    const found = existingClients.find((c: any) => c.name.toLowerCase() === clientName.toLowerCase());
                    selectExistingClient(found);
                  } else {
                    setStep("vehiculo");
                  }
                }}
              >
                Continuar <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 2: Vehicle */}
          {step === "vehiculo" && (
            <div className="space-y-3">
              {existingVehicles.length > 0 && (
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  <p className="text-[11px] font-medium text-muted-foreground">Vehículos de {clientName}</p>
                  {existingVehicles.map((v: any) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => selectExistingVehicle(v)}
                      className="w-full text-left text-xs p-2 rounded-lg border hover:bg-accent/50 transition-colors flex items-center gap-2"
                    >
                      <Car className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{v.brand} {v.model}</span>
                      <Badge variant="outline" className="text-[9px]">{v.plate}</Badge>
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <span className="relative flex justify-center text-xs text-muted-foreground bg-background px-2">o nuevo vehículo</span>
              </div>
              <FormField label="Vehículo (Marca y Modelo)" htmlFor="new-vehicle-name" required>
                <Input id="new-vehicle-name" value={vehicleName} onChange={e => setVehicleName(e.target.value)} placeholder="Toyota Hilux 2020" />
              </FormField>
              <FormField label="Matrícula" htmlFor="new-plate" required>
                <Input id="new-plate" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="ABC 1234" className="uppercase" />
              </FormField>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep("cliente")}>
                  ← Atrás
                </Button>
                <Button
                  className="flex-1"
                  size="sm"
                  disabled={!vehicleName.trim()}
                  onClick={() => setStep("orden")}
                >
                  Continuar <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Work order */}
          {step === "orden" && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="rounded-lg bg-accent/30 p-3 text-xs space-y-1">
                <div className="flex items-center gap-2"><User className="h-3 w-3" />{clientName}</div>
                <div className="flex items-center gap-2"><Car className="h-3 w-3" />{vehicleName} · {plate}</div>
              </div>
              <FormField label="Servicio a realizar" htmlFor="hub-service" required>
                <Textarea id="hub-service" value={service} onChange={e => setService(e.target.value)} placeholder="Descripción del trabajo..." rows={2} />
              </FormField>
              <FormField label="Notas adicionales" htmlFor="hub-notes">
                <Textarea id="hub-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones..." rows={2} />
              </FormField>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep("vehiculo")}>
                  ← Atrás
                </Button>
                <Button
                  className="flex-1"
                  size="sm"
                  disabled={!service.trim() || creating}
                  loading={creating}
                  onClick={handleCreate}
                >
                  <Zap className="h-3.5 w-3.5 mr-1" />
                  {creating ? "Creando..." : "Crear Orden"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════ */
/* ── Main Hub Page ─────────────────────────── */
/* ═══════════════════════════════════════════════ */

export default function OperationsHubPage() {
  const { toast } = useToast();
  const [selectedOT, setSelectedOT] = React.useState<KanbanOT | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [mobilePanel, setMobilePanel] = React.useState<"list" | "detail">("list");

  // Fetch all active work orders
  const { data: ordenes = [], isLoading, refetch } = useQuery<KanbanOT[]>({
    queryKey: ["hub-active-orders"],
    queryFn: async () => {
      const [ots, allVehicles, allClients] = await Promise.all([
        api.listWorkOrders({ limit: 100 }),
        api.request<any[]>("/workshop/vehiculos?limit=200").catch(() => []),
        api.request<any[]>("/workshop/clientes?limit=200").catch(() => []),
      ]);
      // Build lookup maps for O(1) access
      const vehicleMap = new Map(allVehicles.map((v: any) => [v.id, v]));
      const clientMap = new Map(allClients.map((c: any) => [c.id, c]));
      // Enrich with vehicle + client info using maps
      return ots.map((ot: any) => {
        const v = vehicleMap.get(ot.vehicleId);
        const c = clientMap.get(ot.clientId);
        return {
          ...ot,
          vehicleName: v ? `${v.brand || ""} ${v.model || ""}`.trim() : "",
          plate: v?.plate || "",
          clientName: c?.name || "",
          clientPhone: c?.phone || "",
          clientEmail: c?.email || "",
        } as KanbanOT;
      });
    },
    refetchInterval: 30_000, // Poll every 30s
  });

  // Quick stats
  const stats = React.useMemo(() => ({
    total: ordenes.length,
    enProceso: ordenes.filter(o => o.status === "En_Proceso").length,
    listos: ordenes.filter(o => o.status === "Listo").length,
    presupuestados: ordenes.filter(o => o.status === "Presupuestado").length,
  }), [ordenes]);

  const handleSelectOT = (ot: KanbanOT) => {
    setSelectedOT(ot);
    setMobilePanel("detail");
  };

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      {/* ── Header ────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-orange-500" />
            Hub de Operaciones
          </h1>
          <p className="text-xs text-muted-foreground">
            Flujo de trabajo centralizado · {new Date().toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick stats chips */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <span className="px-2 py-1 rounded-full bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 border border-yellow-200 dark:border-yellow-800/30">
              📋 {stats.presupuestados} presup.
            </span>
            <span className="px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 border border-indigo-200 dark:border-indigo-800/30">
              🔧 {stats.enProceso} en proceso
            </span>
            <span className="px-2 py-1 rounded-full bg-green-50 dark:bg-green-950/30 text-green-600 border border-green-200 dark:border-green-800/30">
              ✅ {stats.listos} listos
            </span>
          </div>
          <Button
            size="lg"
            className="gap-2 shadow-md hover:shadow-lg transition-all"
            onClick={() => { setCreateOpen(true); }}
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva OT Rápida</span>
            <span className="sm:hidden">Nueva OT</span>
          </Button>
        </div>
      </div>

      {/* ── Main Content: Split Panels ────── */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left: Kanban/Sidebar panel (hidden on mobile when detail is open) */}
        <div className={cn(
          "flex flex-col w-full lg:w-80 xl:w-96 shrink-0 overflow-y-auto",
          mobilePanel === "detail" && "hidden lg:flex"
        )}>
          <Card className="flex-1 border-0 shadow-sm bg-card">
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Órdenes Activas</span>
                <Badge variant="outline" className="text-[10px]">{stats.total} total</Badge>
              </CardTitle>
              <CardDescription className="text-[10px]">
                Seleccioná una OT para ver sus detalles y acciones
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : (
                <HubSidebar
                  ordenes={ordenes}
                  selectedId={selectedOT?.id || null}
                  onSelect={handleSelectOT}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Detail panel */}
        <div className={cn(
          "flex-1 min-w-0",
          mobilePanel === "list" && "hidden lg:block"
        )}>
          <Card className="h-full border-0 shadow-sm bg-card">
            <CardContent className="p-4 h-full">
              <OTDetailPanel
                orden={selectedOT}
                onClose={() => { setSelectedOT(null); setMobilePanel("list"); }}
                onRefresh={() => refetch()}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Quick Create Modal ────────────── */}
      <QuickCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => refetch()}
      />
    </div>
  );
}
