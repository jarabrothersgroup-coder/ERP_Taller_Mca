"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Zap, ArrowRight, User, Car } from "lucide-react";

interface QuickCreateModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

export function QuickCreateModal({ open, onOpenChange, onCreated }: QuickCreateModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = React.useState<"cliente" | "vehiculo" | "orden">("cliente");
  const [clientName, setClientName] = React.useState("");
  const [clientPhone, setClientPhone] = React.useState("");
  const [clientEmail, setClientEmail] = React.useState("");
  const [vehicleName, setVehicleName] = React.useState("");
  const [plate, setPlate] = React.useState("");
  const [service, setService] = React.useState("");
  const [createdClientId, setCreatedClientId] = React.useState<string | null>(null);
  const [createdVehicleId, setCreatedVehicleId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const { data: existingClients = [] } = useQuery<any[]>({
    queryKey: ["hub-clients-search"],
    queryFn: () => api.request<any[]>("/workshop/clientes?limit=50"),
  });

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
      if (!clientId) { toast.error("Debe seleccionar o crear un cliente"); setCreating(false); return; }

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
      if (!vehicleId) { toast.error("Debe seleccionar o crear un vehículo"); setCreating(false); return; }

      if (service.trim() && vehicleId) {
        await api.createWorkOrder({ vehicleId, clientId, description: service.trim() });
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
    } finally { setCreating(false); }
  };

  const resetForm = () => {
    setStep("cliente"); setClientName(""); setClientPhone(""); setClientEmail("");
    setVehicleName(""); setPlate(""); setService(""); setCreatedClientId(null); setCreatedVehicleId(null);
  };

  const steps = ["cliente", "vehiculo", "orden"];
  const stepIndex = steps.indexOf(step);

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
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div className={cn("flex items-center gap-1.5 text-xs font-medium",
                  step === s ? "text-orange-500" : i < stepIndex ? "text-green-500" : "text-muted-foreground/50"
                )}>
                  <div className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    step === s ? "bg-orange-500 text-white" : i < stepIndex ? "bg-green-500 text-white" : "bg-muted text-muted-foreground/50"
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
                  <button key={c.id} type="button" onClick={() => { setCreatedClientId(c.id); setClientName(c.name); setStep("vehiculo"); }}
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
              <FormField label="Nombre del Cliente" htmlFor="qcn" required>
                <Input id="qcn" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Juan Pérez" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Teléfono" htmlFor="qcp">
                  <Input id="qcp" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="0981 123 456" />
                </FormField>
                <FormField label="Email" htmlFor="qce">
                  <Input id="qce" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="cliente@email.com" />
                </FormField>
              </div>
              <Button className="w-full" size="sm" disabled={!clientName.trim()} onClick={() => setStep("vehiculo")}>
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
                    <button key={v.id} type="button" onClick={() => { setCreatedVehicleId(v.id); setVehicleName(`${v.brand || ""} ${v.model || ""}`.trim()); setPlate(v.plate || ""); setStep("orden"); }}
                      className="w-full text-left text-xs p-2 rounded-lg border hover:bg-accent/50 transition-colors flex items-center gap-2"
                    >
                      <Car className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{v.brand} {v.model}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <span className="relative flex justify-center text-xs text-muted-foreground bg-background px-2">o nuevo vehículo</span>
              </div>
              <FormField label="Vehículo" htmlFor="qvn" required>
                <Input id="qvn" value={vehicleName} onChange={e => setVehicleName(e.target.value)} placeholder="Toyota Hilux 2020" />
              </FormField>
              <FormField label="Matrícula" htmlFor="qp" required>
                <Input id="qp" value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="ABC 1234" className="uppercase" />
              </FormField>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep("cliente")}>← Atrás</Button>
                <Button className="flex-1" size="sm" disabled={!vehicleName.trim()} onClick={() => setStep("orden")}>
                  Continuar <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Work order */}
          {step === "orden" && (
            <div className="space-y-3">
              <div className="rounded-lg bg-accent/30 p-3 text-xs space-y-1">
                <div className="flex items-center gap-2"><User className="h-3 w-3" />{clientName}</div>
                <div className="flex items-center gap-2"><Car className="h-3 w-3" />{vehicleName} · {plate}</div>
              </div>
              <FormField label="Servicio a realizar" htmlFor="qs" required>
                <Textarea id="qs" value={service} onChange={e => setService(e.target.value)} placeholder="Descripción del trabajo..." rows={2} />
              </FormField>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep("vehiculo")}>← Atrás</Button>
                <Button className="flex-1" size="sm" disabled={!service.trim() || creating} loading={creating} onClick={handleCreate}>
                  <Zap className="h-3.5 w-3.5 mr-1" />{creating ? "Creando..." : "Crear Orden"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
