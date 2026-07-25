"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Wrench, Package, Receipt, MessageCircle,
  Send, DollarSign, Car, User, Phone, ExternalLink,
  ChevronRight, Camera, Printer, X, Building2,
} from "lucide-react";
import { STATUS_FLOW, getStatusConfig, formatCurrency, type KanbanOT } from "./types";

/* ── Cobro Actions (Invoice + Payment) ───── */

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
    } finally { setInvoiceLoading(false); }
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
          cuentaId: defaultCuentaId, tipo: "INGRESO", medioPago: "EFECTIVO",
          monto: total, concepto: `Cobro OT #${ordenId.slice(0, 8)}`, fecha: new Date().toISOString(),
        }),
      });
      toast.success("Cobro registrado en tesorería");
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Error al registrar cobro");
    } finally { setCobroLoading(false); }
  };

  return (
    <>
      <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleFacturar} disabled={invoiceLoading}>
        <Receipt className="h-3.5 w-3.5" />{invoiceLoading ? "Facturando..." : "Facturar"}
      </Button>
      <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={handleCobro} disabled={cobroLoading}>
        <DollarSign className="h-3.5 w-3.5" />{cobroLoading ? "Registrando..." : "Registrar Cobro"}
      </Button>
    </>
  );
}

/* ── OT Detail Panel ───────────────────────── */

interface OTDetailPanelProps {
  orden: KanbanOT | null;
  onClose: () => void;
  onRefresh: () => void;
}

export function OTDetailPanel({ orden, onClose, onRefresh }: OTDetailPanelProps) {
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

  // Status advance
  const advanceStatus = useMutation({
    mutationFn: () => {
      if (!fullOrden) throw new Error("No hay orden seleccionada");
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

  // Add repuesto
  const addRepuesto = useMutation({
    mutationFn: () => api.request(`/workshop/ordenes/${orden!.id}/repuestos`, {
      method: "POST", body: JSON.stringify({ repuestoNombre: newRepuestoNombre, cantidad: newRepuestoCant, precioUnitario: newRepuestoPrecio }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hub-orden-detail", orden?.id] });
      setAddingRepuesto(false); setNewRepuestoNombre(""); setNewRepuestoPrecio(0); setNewRepuestoCant(1);
      toast.success("Repuesto agregado correctamente");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Add tercero
  const addTercero = useMutation({
    mutationFn: () => api.request(`/workshop/ordenes/${orden!.id}/trabajos-terceros`, {
      method: "POST", body: JSON.stringify({ proveedor: terceroProveedor, descripcion: terceroDescripcion, costo: terceroCosto }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hub-orden-detail", orden?.id] });
      setAddingTercero(false); setTerceroProveedor(""); setTerceroDescripcion(""); setTerceroCosto(0);
      toast.success("Trabajo tercero registrado correctamente");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // WhatsApp mutations
  const sendConsolidated = useMutation({
    mutationFn: () => {
      if (!orden) throw new Error("No hay orden seleccionada");
      const phone = orden.clientPhone?.replace(/\D/g, "") || "";
      const msg = [
        `🧾 *OT #${orden.id.slice(0, 8)} - ${orden.vehicleName || ""}*`,
        `📋 Estado: ${fullOrden?.status || orden.status}`,
        `💵 Total: ${formatCurrency(totalGeneral)}`,
        ``, `🔗 Adjuntos y OT completa:`,
        `${window.location.origin}/dashboard/taller/${orden.id}`,
      ].join("\n");
      return api.sendWhatsAppMessage({ phone, message: msg });
    },
    onSuccess: () => toast.success("Resumen enviado al cliente por WhatsApp"),
    onError: (err: Error) => toast.error(err.message),
  });

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
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 lg:hidden">
            <X className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold">OT #{orden.id.slice(0, 8)}</span>
              <Badge className={cn(config.bg, config.color, "border-0 text-[10px]")}>
                <config.icon className="h-3 w-3 mr-1" />{config.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{orden.vehicleName || "Sin vehículo"} · {orden.plate || "Sin placa"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canAdvance && nextStatus && (
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => advanceStatus.mutate()} disabled={advanceStatus.isPending}>
              <ChevronRight className="h-3.5 w-3.5" /> Avanzar a {nextStatus.label}
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" /><Skeleton className="h-32" /><Skeleton className="h-20" />
          </div>
        ) : (
          <>
            {/* Client card */}
            <Card className="border-0 shadow-none bg-accent/20">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{orden.clientName || "Sin cliente"}</span>
                  </div>
                  {orden.clientPhone && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={() => sendWhatsApp.mutate()} disabled={sendWhatsApp.isPending}>
                      <MessageCircle className="h-3 w-3" /> WhatsApp
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
                    <Phone className="h-3 w-3" />{orden.clientPhone}
                  </div>
                )}
                {fullOrden?.description && (
                  <p className="text-sm text-muted-foreground border-t pt-2 mt-2">{fullOrden.description}</p>
                )}
              </CardContent>
            </Card>

            {/* Diagnosis */}
            {fullOrden?.diagnosis && (
              <Card className="border-0 shadow-none bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="p-3">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Diagnóstico</p>
                  <p className="text-sm whitespace-pre-wrap">{fullOrden.diagnosis}</p>
                </CardContent>
              </Card>
            )}

            {/* Costs */}
            <Card className="border-0 shadow-none">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Servicios</span><span>{formatCurrency(totalServicios)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Repuestos</span><span>{formatCurrency(totalRepuestos)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Terceros</span><span>{formatCurrency(totalTerceros)}</span></div>
                <div className="flex justify-between text-sm font-bold border-t pt-1.5"><span>Total</span><span>{formatCurrency(totalGeneral)}</span></div>
              </CardContent>
            </Card>

            {/* Services */}
            {(fullOrden?.servicios?.length || 0) > 0 && (
              <Card className="border-0 shadow-none">
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Wrench className="h-3 w-3" /> Servicios ({fullOrden.servicios.length})
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

            {/* Parts */}
            <Card className="border-0 shadow-none">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Package className="h-3 w-3" /> Repuestos ({fullOrden?.repuestos?.length || 0})</span>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setAddingRepuesto(!addingRepuesto)}>
                    {addingRepuesto ? "Cancelar" : "+ Agregar"}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-1">
                {addingRepuesto && (
                  <div className="grid grid-cols-4 gap-2 items-end rounded-lg border p-2 bg-accent/30 mb-2">
                    <div className="col-span-2">
                      <label className="text-[10px] text-muted-foreground">Nombre</label>
                      <input value={newRepuestoNombre} onChange={e => setNewRepuestoNombre(e.target.value)} placeholder="Filtro Aceite" className="mt-0.5 flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Cant.</label>
                      <input type="number" min={1} value={newRepuestoCant} onChange={e => setNewRepuestoCant(Number(e.target.value))} className="mt-0.5 flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">₲/u</label>
                      <input type="number" min={0} value={newRepuestoPrecio} onChange={e => setNewRepuestoPrecio(Number(e.target.value))} className="mt-0.5 flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs" />
                    </div>
                    <div className="col-span-4">
                      <Button size="sm" className="w-full h-7 text-xs" disabled={!newRepuestoNombre || newRepuestoPrecio <= 0} onClick={() => addRepuesto.mutate()}>+ Agregar Repuesto</Button>
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

            {/* Terceros */}
            <Card className="border-0 shadow-none">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" /> Terceros ({fullOrden?.trabajosTerceros?.length || 0})</span>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setAddingTercero(!addingTercero)}>
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
                      <Button size="sm" className="w-full h-7 text-xs" disabled={!terceroProveedor || !terceroDescripcion || terceroCosto <= 0} onClick={() => addTercero.mutate()}>+ Registrar</Button>
                    </div>
                    <div className="col-span-3">
                      <input value={terceroDescripcion} onChange={e => setTerceroDescripcion(e.target.value)} placeholder="Descripción..." className="mt-0.5 flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs" />
                    </div>
                  </div>
                )}
                {(fullOrden?.trabajosTerceros?.length || 0) > 0 ? (
                  fullOrden.trabajosTerceros.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0 border-dashed">
                      <div className="truncate"><span className="font-medium">{t.proveedor}</span><span className="text-muted-foreground ml-1">· {t.descripcion}</span></div>
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
                          <div className={cn("h-6 w-6 rounded-full flex items-center justify-center transition-all",
                            isActive ? (isCurrent ? "bg-blue-500 text-white ring-2 ring-blue-200" : "bg-blue-500/20 text-blue-600") : "bg-muted text-muted-foreground/50"
                          )}><s.icon className="h-3 w-3" /></div>
                          <span className={cn("text-[9px] mt-0.5 font-medium", isActive ? "text-blue-600" : "text-muted-foreground/50")}>
                            {s.label.split(" ")[0]}
                          </span>
                        </div>
                        {i < STATUS_FLOW.length - 1 && (
                          <div className={cn("flex-1 h-px mx-1", i < currentIdx ? "bg-blue-400" : "bg-muted")} />
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

      {/* Bottom actions */}
      <div className="border-t pt-3 flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
          onClick={() => window.open(`/workshop/ordenes/${orden.id}/pdf`, "_blank")}>
          <Printer className="h-3.5 w-3.5" /> Imprimir OT
        </Button>
        {orden.clientPhone && (<>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-emerald-600 hover:text-emerald-700"
            onClick={() => sendWhatsApp.mutate()} disabled={sendWhatsApp.isPending}>
            <Send className="h-3.5 w-3.5" /> WhatsApp
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => sendConsolidated.mutate()} disabled={sendConsolidated.isPending}>
            <MessageCircle className="h-3.5 w-3.5" /> Enviar a Cliente
          </Button>
        </>)}
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
          onClick={() => window.open(`/dashboard/taller/${orden.id}`, "_blank")}>
          <ExternalLink className="h-3.5 w-3.5" /> Ver OT Completa
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
          onClick={() => window.open(`/dashboard/recepcion?ordenId=${orden.id}`, "_blank")}>
          <Camera className="h-3.5 w-3.5" /> DVI / Fotos
        </Button>
        {fullOrden?.status === "Listo" && (
          <CobroActions ordenId={orden.id} total={totalGeneral} onRefresh={onRefresh} />
        )}
      </div>
    </div>
  );
}
