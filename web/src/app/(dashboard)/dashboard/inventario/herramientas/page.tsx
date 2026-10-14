"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorState } from "@/components/ui/error-state";
import { useErrorToast } from "@/hooks/use-error-toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Wrench,
  Plus,
  Users,
  CheckCircle2,
  RotateCcw,
  Hammer,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────── */

interface Herramienta {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  marca: string | null;
  modelo: string | null;
  stockTotal: number;
  stockDisponible: number;
  requiereCalibracion: boolean;
  activo: boolean;
  createdAt: string;
}

interface ToolInstance {
  id: string;
  herramientaId: string;
  numeroSerie: string;
  codigoInventario: string | null;
  costoAdquisicion: number;
  estadoActual: "DISPONIBLE" | "PRESTADO" | "EN_REPARACION" | "EN_CALIBRACION" | "BAJA";
  ubicacionActual: string | null;
  fechaAdquisicion: string;
  activa: boolean;
}

/** Registro de checkout — `GET /inventory/herramientas/control` */
interface ToolLoan {
  id: string;
  herramientaId: string;
  herramientaNombre: string | null;
  herramientaCodigo: string | null;
  toolInstanceId: string;
  ordenTrabajoId: string;
  mecanicoId: string;
  mecanicoNombre: string | null;
  fechaAsignacion: string;
  fechaDevolucion: string | null;
  estado: "Asignado" | "Devuelto" | "Perdido" | "Dañado";
  condicionRetorno: string | null;
  observaciones: string | null;
}

/** Fila de `GET /inventory/tool-loans/overdue` (sólo se usa el id/recuento). */
interface OverdueLoan {
  id: string;
  herramientaNombre: string | null;
  fechaEsperadaDevolucion: string | null;
}

/** Respuesta de `GET /inventory/tools/depreciation/book-value/:toolInstanceId`. */
interface BookValue {
  herramientaNombre: string;
  herramientaCodigo: string;
  numeroSerie: string;
  costoAdquisicion: string | number;
  valorActualLibros: string | number;
  ultimaDepreciacion: string | null;
  depreciacionAcumulada: string;
}

const CONTROL_ESTADOS = ["", "Asignado", "Devuelto", "Perdido", "Dañado"] as const;

interface ServiceEvent {
  id: string;
  toolInstanceId: string;
  tipo: string;
  estado: "PROGRAMADO" | "EN_PROCESO" | "COMPLETADO" | "CANCELADO";
  fechaInicio: string | null;
  fechaFin: string | null;
  costo: number | null;
  proveedor: string | null;
  observaciones: string | null;
}

const CATEGORIAS = [
  "MANUAL", "ELECTRICA", "MEDICION", "ELEVACION", "NEUMATICA",
  "ESPECIAL", "DIAGNOSTICO", "SEGURIDAD", "LIMPIEZA", "OTROS",
];

const ESTADO_INSTANCE_COLORS: Record<string, string> = {
  DISPONIBLE: "bg-green-100 text-green-700 border-green-300",
  PRESTADO: "bg-blue-100 text-blue-700 border-blue-300",
  EN_REPARACION: "bg-amber-100 text-amber-700 border-amber-300",
  EN_CALIBRACION: "bg-purple-100 text-purple-700 border-purple-300",
  BAJA: "bg-red-100 text-red-700 border-red-300",
};

const ESTADO_LOAN_COLORS: Record<string, string> = {
  Asignado: "bg-blue-100 text-blue-700 border-blue-300",
  Devuelto: "bg-green-100 text-green-700 border-green-300",
  Perdido: "bg-red-100 text-red-700 border-red-300",
  Dañado: "bg-amber-100 text-amber-700 border-amber-300",
};

const ESTADO_LOAN_LABELS: Record<string, string> = {
  Asignado: "Asignado",
  Devuelto: "Devuelto",
  Perdido: "Perdido",
  Dañado: "Dañado",
};

const TIPO_EVENTO_LABELS: Record<string, string> = {
  CALIBRACION_PROGRAMADA: "Calibración Programada",
  CALIBRACION_EXTRAORDINARIA: "Calibración Extraordinaria",
  REPARACION: "Reparación",
  MANTENIMIENTO_PREVENTIVO: "Mantenimiento Preventivo",
  INSPECCION: "Inspección",
};

/* ── Page Component ─────────────────────────── */

export default function HerramientasPage() {
  const qc = useQueryClient();
  const { toast: t, ToastContainer } = useToast();
  const [activeTab, setActiveTab] = React.useState<"catalogo" | "instancias" | "prestamos" | "mantenimiento">("catalogo");
  const [search, setSearch] = React.useState("");
  const [categoriaFilter, setCategoriaFilter] = React.useState("");
  const [loanEstadoFilter, setLoanEstadoFilter] = React.useState<string>("");
  const [bookInstanceId, setBookInstanceId] = React.useState<string | null>(null);

  // Create tool dialog
  const [createOpen, setCreateOpen] = React.useState(false);
  const [formNombre, setFormNombre] = React.useState("");
  const [formCodigo, setFormCodigo] = React.useState("");
  const [formCategoria, setFormCategoria] = React.useState("");
  const [formMarca, setFormMarca] = React.useState("");

  // Lend dialog
  const [lendOpen, setLendOpen] = React.useState(false);
  const [lendInstanceId, setLendInstanceId] = React.useState("");
  const [lendOtId, setLendOtId] = React.useState("");
  const [lendTecnico, setLendTecnico] = React.useState("");

  // Return dialog
  const [returnOpen, setReturnOpen] = React.useState(false);
  const [returnLoanId, setReturnLoanId] = React.useState("");
  const [returnCondicion, setReturnCondicion] = React.useState("BUENO");

  // Complete calibration dialog (T-63 S126)
  const [calibOpen, setCalibOpen] = React.useState(false);
  const [calibInstanceId, setCalibInstanceId] = React.useState("");
  const [calibProxima, setCalibProxima] = React.useState("");
  const [calibObs, setCalibObs] = React.useState("");

  // Decommission dialog (T-63 S126)
  const [decomOpen, setDecomOpen] = React.useState(false);
  const [decomInstanceId, setDecomInstanceId] = React.useState("");
  const [decomMotivo, setDecomMotivo] = React.useState("");
  const [decomObs, setDecomObs] = React.useState("");

  // Calibration history dialog (T-63 S126)
  const [calHistInstanceId, setCalHistInstanceId] = React.useState<string | null>(null);

  // Mechanic active loans filter (T-63 S126)
  const [mechanicFilterId, setMechanicFilterId] = React.useState("");

  // ── Fetch catalog ──
  const { data: catalogData, isLoading: catLoading, isError, error, refetch } = useQuery<{ items: Herramienta[]; total: number }>({
    queryKey: ["herramientas", categoriaFilter],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (categoriaFilter) qs.set("categoria", categoriaFilter);
      qs.set("limit", "100");
      return api.request(`/inventory/herramientas?${qs.toString()}`) as any;
    },
  });

  // T-53: feedback visible al fallar la carga
  useErrorToast(isError, "las herramientas");

  if (isError) {
    return (
      <ErrorState
        title="No se pudo cargar las herramientas"
        message={error instanceof Error ? error.message : undefined}
        onRetry={refetch}
        className="min-h-[50vh] justify-center"
      />
    );
  }

  // ── Fetch instances ──
  const { data: instancesData, isLoading: instLoading } = useQuery<{ items: ToolInstance[]; total: number }>({
    queryKey: ["tool-instances"],
    queryFn: () => api.request("/inventory/tool-instances?limit=100") as any,
  });

  // ── Fetch checkout records (`/inventory/herramientas/control`) ──
  const { data: loansData, isLoading: loansLoading } = useQuery<{ items: ToolLoan[]; total: number }>({
    queryKey: ["tool-loans", "control", loanEstadoFilter],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: "100" });
      if (loanEstadoFilter) qs.set("estado", loanEstadoFilter);
      return api.request(`/inventory/herramientas/control?${qs.toString()}`) as any;
    },
  });

  // ── Préstamos vencidos (badge en el tab) ──
  const { data: overdueLoans } = useQuery<OverdueLoan[]>({
    queryKey: ["tool-loans", "overdue"],
    queryFn: () => api.request("/inventory/tool-loans/overdue") as any,
    refetchInterval: 60000,
  });
  const overdueCount = overdueLoans?.length ?? 0;

  // ── Valor en libros de la instancia seleccionada ──
  const { data: bookValue, isLoading: bookLoading, isError: bookError } = useQuery<BookValue>({
    queryKey: ["tool-instances", "book-value", bookInstanceId],
    queryFn: () => api.request(`/inventory/tools/depreciation/book-value/${bookInstanceId}`),
    enabled: !!bookInstanceId,
    retry: 1,
  });

  // ── Fetch service events ──
  const { data: eventsData } = useQuery<{ items: ServiceEvent[]; total: number }>({
    queryKey: ["tool-service-events"],
    queryFn: () => api.request("/inventory/tool-service-events?limit=50") as any,
  });

  // ── Create tool mutation ──
  const createMut = useMutation({
    mutationFn: () => api.createHerramienta({ codigo: formCodigo, descripcion: formNombre, marca: formMarca || undefined, categoria: formCategoria || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["herramientas"] });
      setCreateOpen(false);
      resetForm();
      t.success("Herramienta creada");
    },
    onError: (err: any) => t.error(err?.message || "Error al crear herramienta"),
  });

  // ── Lend tool mutation ──
  const lendMut = useMutation({
    mutationFn: () => api.lendTool({ toolInstanceId: lendInstanceId, ordenTrabajoId: lendOtId, mecanicoId: lendTecnico }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tool-instances"] });
      qc.invalidateQueries({ queryKey: ["tool-loans"] });
      setLendOpen(false);
      t.success("Herramienta prestada");
    },
    onError: (err: any) => t.error(err?.message || "Error al prestar herramienta"),
  });

  // ── Return tool mutation ──
  const returnMut = useMutation({
    mutationFn: () => api.returnTool({ loanId: returnLoanId, condicionRetorno: returnCondicion as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tool-instances"] });
      qc.invalidateQueries({ queryKey: ["tool-loans"] });
      setReturnOpen(false);
      t.success("Herramienta devuelta");
    },
    onError: (err: any) => t.error(err?.message || "Error al devolver herramienta"),
  });

  // ── Start calibration ──
  const calibrateMut = useMutation({
    mutationFn: (instanceId: string) =>
      api.request(`/inventory/tool-instances/${instanceId}/calibrate`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tool-instances"] });
      t.success("Instancia enviada a calibración");
    },
    onError: (err: any) => t.error(err?.message || "No se pudo iniciar la calibración"),
  });

  // ── Complete calibration (POST /inventory/tool-instances/:id/complete-calibration) ──
  const completeCalibMut = useMutation({
    mutationFn: () =>
      api.request(`/inventory/tool-instances/${calibInstanceId}/complete-calibration`, {
        method: "POST",
        body: JSON.stringify({ proximaCalibracion: calibProxima || undefined, observaciones: calibObs || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tool-instances"] });
      qc.invalidateQueries({ queryKey: ["tool-service-events"] });
      setCalibOpen(false);
      setCalibInstanceId("");
      setCalibProxima("");
      setCalibObs("");
      t.success("Calibración completada");
    },
    onError: (err: any) => t.error(err?.message || "No se pudo completar la calibración"),
  });

  // ── Complete repair (POST /inventory/tool-instances/:id/complete-repair) ──
  const completeRepairMut = useMutation({
    mutationFn: (instanceId: string) =>
      api.request(`/inventory/tool-instances/${instanceId}/complete-repair`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tool-instances"] });
      qc.invalidateQueries({ queryKey: ["tool-service-events"] });
      t.success("Reparación completada — instancia disponible");
    },
    onError: (err: any) => t.error(err?.message || "No se pudo completar la reparación"),
  });

  // ── Decommission (POST /inventory/tool-instances/:id/decommission) ──
  const decommissionMut = useMutation({
    mutationFn: () =>
      api.request(`/inventory/tool-instances/${decomInstanceId}/decommission`, {
        method: "POST",
        body: JSON.stringify({ motivoBaja: decomMotivo, observaciones: decomObs || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tool-instances"] });
      setDecomOpen(false);
      setDecomInstanceId("");
      setDecomMotivo("");
      setDecomObs("");
      t.success("Instancia dada de baja");
    },
    onError: (err: any) => t.error(err?.message || "No se pudo dar de baja la instancia"),
  });

  // ── Mechanic active loans (GET /inventory/tool-loans/mechanic/:mecanicoId) ──
  const { data: mechanicLoans, isFetching: mechLoansLoading } = useQuery<{ items: ToolLoan[]; total: number }>({
    queryKey: ["tool-loans", "mechanic", mechanicFilterId],
    queryFn: () => api.request(`/inventory/tool-loans/mechanic/${mechanicFilterId}`) as any,
    enabled: !!mechanicFilterId,
  });

  // ── Calibration history (GET /inventory/tool-service-events/calibration/:toolInstanceId) ──
  const { data: calHistory, isLoading: calHistLoading } = useQuery<{ items: ServiceEvent[] }>({
    queryKey: ["tool-service-events", "calibration", calHistInstanceId],
    queryFn: () => api.request(`/inventory/tool-service-events/calibration/${calHistInstanceId}`) as any,
    enabled: !!calHistInstanceId,
  });

  // ── Update service event (PATCH /inventory/tool-service-events/:id) ──
  const updateEventMut = useMutation({
    mutationFn: ({ eventId, estado }: { eventId: string; estado: string }) =>
      api.request(`/inventory/tool-service-events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tool-service-events"] });
      t.success("Evento actualizado");
    },
    onError: (err: any) => t.error(err?.message || "No se pudo actualizar el evento"),
  });

  const resetForm = () => {
    setFormNombre("");
    setFormCodigo("");
    setFormCategoria("");
    setFormMarca("");
  };

  const catalog = catalogData?.items || [];
  const instances = instancesData?.items || [];
  const loans = loansData?.items || [];
  const events = eventsData?.items || [];

  const activeLoans = loans.filter((l) => l.estado === "Asignado");
  const dueForCalibration = instances.filter(
    (i) => i.estadoActual === "EN_CALIBRACION",
  );

  // Filter catalog
  const filteredCatalog = catalog.filter((h) => {
    if (!h.activo) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        h.nombre.toLowerCase().includes(q) ||
        (h.codigo || "").toLowerCase().includes(q) ||
        (h.marca || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const catalogColumns: Column<Herramienta>[] = [
    { header: "Código", accessor: "codigo", sortable: true, cell: (_, r) => <span className="font-mono text-xs">{r.codigo}</span> },
    { header: "Nombre", accessor: "nombre", sortable: true, cell: (_, r) => <span className="font-medium">{r.nombre}</span> },
    { header: "Marca", accessor: "marca", hideOnMobile: true },
    { header: "Categoría", accessor: "categoria", hideOnMobile: true, cell: (_, r) => r.categoria ? <Badge variant="outline" className="text-xs">{r.categoria}</Badge> : <span className="text-muted-foreground">—</span> },
    { header: "Stock", accessor: "stockTotal", align: "center", cell: (_, r) => <span className="font-mono">{r.stockDisponible}/{r.stockTotal}</span> },
    { header: "Calib.", accessor: "requiereCalibracion", align: "center", cell: (_, r) => r.requiereCalibracion ? <Badge variant="warning" className="text-[10px]">Sí</Badge> : <span className="text-muted-foreground/50">—</span> },
  ];

  const instanceColumns: Column<ToolInstance>[] = [
    { header: "N° Serie", accessor: "numeroSerie", sortable: true, cell: (_, r) => <span className="font-mono text-xs">{r.numeroSerie}</span> },
    { header: "Código Inventario", accessor: "codigoInventario", hideOnMobile: true, cell: (_, r) => <span className="font-mono text-xs text-muted-foreground">{r.codigoInventario || "—"}</span> },
    { header: "Estado", accessor: "estadoActual", cell: (_, r) => (
      <Badge className={cn("text-xs border", ESTADO_INSTANCE_COLORS[r.estadoActual])}>{r.estadoActual === "DISPONIBLE" ? "Disponible" : r.estadoActual === "PRESTADO" ? "Prestado" : r.estadoActual === "EN_REPARACION" ? "En reparación" : r.estadoActual === "EN_CALIBRACION" ? "En calibración" : "Baja"}</Badge>
    )},
    { header: "Adquisición", accessor: "fechaAdquisicion", hideOnMobile: true, cell: (_, r) => <span className="text-xs text-muted-foreground">{new Date(r.fechaAdquisicion).toLocaleDateString("es-PY")}</span> },
    { header: "Costo", accessor: "costoAdquisicion", align: "right", hideOnMobile: true, cell: (_, r) => <span className="font-mono text-xs">₲ {Number(r.costoAdquisicion).toLocaleString("es-PY")}</span> },
    {
      header: "Acción",
      accessor: "estadoActual",
      cell: (_, r) => (
        <div className="flex justify-end gap-1 flex-wrap">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setBookInstanceId(r.id)}>
            Valor libro
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCalHistInstanceId(r.id)}>
            Hist. calib.
          </Button>
          {r.estadoActual === "DISPONIBLE" && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { if (confirm("¿Enviar esta instancia a calibración?")) calibrateMut.mutate(r.id); }}>
              Calibrar
            </Button>
          )}
          {r.estadoActual === "DISPONIBLE" && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setLendInstanceId(r.id); setLendOpen(true); }}>
              Prestar
            </Button>
          )}
          {r.estadoActual === "EN_CALIBRACION" && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setCalibInstanceId(r.id); setCalibOpen(true); }}>
              Completar calib.
            </Button>
          )}
          {r.estadoActual === "EN_REPARACION" && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { if (confirm("¿Marcar reparación como completada?")) completeRepairMut.mutate(r.id); }}>
              Completar rep.
            </Button>
          )}
          {r.estadoActual !== "BAJA" && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={() => { setDecomInstanceId(r.id); setDecomOpen(true); }}>
              Baja
            </Button>
          )}
        </div>
      ),
    },
  ];

  const loanColumns: Column<ToolLoan>[] = [
    { header: "Herramienta", accessor: "herramientaNombre", cell: (_, r) => (
      <div>
        <span className="font-medium text-sm">{r.herramientaNombre || r.toolInstanceId.slice(0, 8)}</span>
        {r.herramientaCodigo && <span className="ml-2 font-mono text-[10px] text-muted-foreground">{r.herramientaCodigo}</span>}
      </div>
    ) },
    { header: "OT", accessor: "ordenTrabajoId", cell: (_, r) => <span className="font-mono text-xs">#{r.ordenTrabajoId.slice(0, 8)}</span> },
    { header: "Técnico", accessor: "mecanicoNombre", hideOnMobile: true },
    { header: "Asignación", accessor: "fechaAsignacion", cell: (_, r) => <span className="text-xs">{new Date(r.fechaAsignacion).toLocaleDateString("es-PY")}</span> },
    { header: "Devolución", accessor: "fechaDevolucion", hideOnMobile: true, cell: (_, r) => r.fechaDevolucion ? <span className="text-xs text-muted-foreground">{new Date(r.fechaDevolucion).toLocaleDateString("es-PY")}</span> : <span className="text-muted-foreground/50">—</span> },
    { header: "Estado", accessor: "estado", cell: (_, r) => (
      <Badge className={cn("text-xs border", ESTADO_LOAN_COLORS[r.estado])}>
        {ESTADO_LOAN_LABELS[r.estado] || r.estado}
      </Badge>
    )},
    {
      header: "",
      accessor: "estado",
      cell: (_, r) => r.estado === "Asignado" ? (
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setReturnLoanId(r.id); setReturnOpen(true); }}>
          Devolver
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6 text-orange-500" />
            Herramientas y Equipos
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión de catálogo, instancias, préstamos y mantenimiento
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Nueva Herramienta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total herramientas</p><Wrench className="h-4 w-4 text-orange-500" /></div>
          <p className="text-2xl font-bold mt-1">{catalog.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Instancias disponibles</p><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
          <p className="text-2xl font-bold mt-1 text-green-600">{instances.filter((i) => i.estadoActual === "DISPONIBLE").length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Préstamos activos</p><Users className="h-4 w-4 text-blue-500" /></div>
          <p className="text-2xl font-bold mt-1 text-blue-600">{activeLoans.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">En mantenimiento</p><Hammer className="h-4 w-4 text-amber-500" /></div>
          <p className="text-2xl font-bold mt-1 text-amber-600">{dueForCalibration.length}</p>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" role="tablist">
        {[
          { key: "catalogo" as const, label: "Catálogo", icon: Wrench },
          { key: "instancias" as const, label: "Instancias", icon: Wrench },
          { key: "prestamos" as const, label: "Préstamos", icon: Users, badge: overdueCount },
          { key: "mantenimiento" as const, label: "Mantenimiento", icon: Hammer },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5",
              activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground")}
            role="tab">
            <tab.icon className="h-4 w-4" /> {tab.label}
            {"badge" in tab && tab.badge ? (
              <Badge className="ml-1 text-[10px] bg-red-100 text-red-700 border border-red-300">
                {tab.badge} vencido{tab.badge > 1 ? "s" : ""}
              </Badge>
            ) : null}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════ */}
      {/* TAB: Catálogo */}
      {/* ════════════════════════════════════ */}
      {activeTab === "catalogo" && (
        <>
          <div className="flex flex-wrap gap-2" role="tablist">
            <Button variant={categoriaFilter === "" ? "secondary" : "ghost"} size="sm" onClick={() => setCategoriaFilter("")} role="tab">Todas</Button>
            {CATEGORIAS.map((cat) => (
              <Button key={cat} variant={categoriaFilter === cat ? "secondary" : "ghost"} size="sm" onClick={() => setCategoriaFilter(cat)} role="tab">{cat}</Button>
            ))}
          </div>
          <DataTable<Herramienta>
            columns={catalogColumns} data={filteredCatalog} rowKey="id"
            loading={catLoading} emptyMessage="No hay herramientas registradas"
            paginate pageSize={10} sortable
            searchPlaceholder="Buscar herramienta..." searchValue={search} onSearchChange={setSearch}
            className="shadow-sm"
          />
        </>
      )}

      {/* ════════════════════════════════════ */}
      {/* TAB: Instancias */}
      {/* ════════════════════════════════════ */}
      {activeTab === "instancias" && (
        <DataTable<ToolInstance>
          columns={instanceColumns} data={instances} rowKey="id"
          loading={instLoading} emptyMessage="No hay instancias registradas"
          paginate pageSize={10} sortable className="shadow-sm"
        />
      )}

      {/* ════════════════════════════════════ */}
      {/* TAB: Préstamos */}
      {/* ════════════════════════════════════ */}
      {activeTab === "prestamos" && (
        <>
          <div className="flex flex-wrap items-end gap-2" role="tablist">
            {CONTROL_ESTADOS.map((estado) => (
              <Button
                key={estado || "todos"}
                variant={loanEstadoFilter === estado ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setLoanEstadoFilter(estado)}
                role="tab"
                aria-selected={loanEstadoFilter === estado}
              >
                {estado || "Todos"}
              </Button>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <Input
                value={mechanicFilterId}
                onChange={(e) => setMechanicFilterId(e.target.value)}
                placeholder="ID mecánico (préstamos activos)"
                className="h-8 w-56 text-xs"
              />
            </div>
          </div>
          {mechanicFilterId && (
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Préstamos activos del mecánico {mechanicFilterId} {mechLoansLoading && "(cargando…)"}
              </p>
              {(mechanicLoans?.items || []).length === 0 && !mechLoansLoading ? (
                <p className="text-sm text-muted-foreground">Sin préstamos activos</p>
              ) : (
                <ul className="space-y-1">
                  {(mechanicLoans?.items || []).map((l) => (
                    <li key={l.id} className="text-sm flex justify-between">
                      <span>{l.herramientaNombre || l.toolInstanceId.slice(0, 8)}</span>
                      <Badge className={cn("text-xs border", ESTADO_LOAN_COLORS[l.estado])}>{ESTADO_LOAN_LABELS[l.estado] || l.estado}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <DataTable<ToolLoan>
            columns={loanColumns} data={loans} rowKey="id"
            loading={loansLoading} emptyMessage="No hay registros de préstamo"
            paginate pageSize={10} sortable className="shadow-sm"
          />
        </>
      )}

      {/* ════════════════════════════════════ */}
      {/* TAB: Mantenimiento */}
      {/* ════════════════════════════════════ */}
      {activeTab === "mantenimiento" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Hammer className="h-4 w-4" /> Eventos de Servicio ({events.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay eventos de mantenimiento registrados</p>
            ) : (
              <div className="space-y-2">
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{TIPO_EVENTO_LABELS[ev.tipo] || ev.tipo}</p>
                      <p className="text-xs text-muted-foreground">{ev.proveedor ? `Proveedor: ${ev.proveedor}` : ev.observaciones?.slice(0, 50) || ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {ev.costo && <span className="text-xs font-mono">₲ {Number(ev.costo).toLocaleString("es-PY")}</span>}
                      <Badge className={cn("text-xs", ev.estado === "COMPLETADO" ? "bg-green-100 text-green-700" : ev.estado === "EN_PROCESO" ? "bg-blue-100 text-blue-700" : ev.estado === "PROGRAMADO" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700")}>
                        {ev.estado === "COMPLETADO" ? "Completado" : ev.estado === "EN_PROCESO" ? "En proceso" : ev.estado === "PROGRAMADO" ? "Programado" : "Cancelado"}
                      </Badge>
                      {ev.estado !== "COMPLETADO" && ev.estado !== "CANCELADO" && (
                        <Button
                          variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => updateEventMut.mutate({ eventId: ev.id, estado: "COMPLETADO" })}
                          disabled={updateEventMut.isPending}
                        >
                          Completar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Book Value Dialog ──────────────── */}
      <Dialog open={!!bookInstanceId} onOpenChange={(open) => !open && setBookInstanceId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5 text-orange-500" /> Valor en libros</DialogTitle>
            <DialogDescription>
              {bookValue ? `${bookValue.herramientaNombre} (${bookValue.herramientaCodigo})` : "Calculando…"}
            </DialogDescription>
          </DialogHeader>
          {bookLoading && <p className="text-sm text-muted-foreground py-4">Cargando…</p>}
          {bookError && !bookLoading && (
            <p className="text-sm text-red-600 py-4">No se pudo calcular el valor en libros (404 si la instancia no existe).</p>
          )}
          {bookValue && !bookLoading && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">N° Serie</span><span className="font-mono text-xs">{bookValue.numeroSerie}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Costo de adquisición</span><span className="font-mono">₲ {Number(bookValue.costoAdquisicion).toLocaleString("es-PY")}</span></div>
              <div className="flex justify-between font-medium"><span>Valor actual en libros</span><span className="font-mono">₲ {Number(bookValue.valorActualLibros).toLocaleString("es-PY")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Depreciación acumulada</span><span className="font-mono text-red-600">₲ {Number(bookValue.depreciacionAcumulada).toLocaleString("es-PY")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Última depreciación</span><span className="text-xs">{bookValue.ultimaDepreciacion ? new Date(bookValue.ultimaDepreciacion).toLocaleDateString("es-PY") : "—"}</span></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookInstanceId(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Tool Dialog ───────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5 text-orange-500" /> Nueva Herramienta</DialogTitle>
            <DialogDescription>Agregá una nueva herramienta al catálogo del taller</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Código" htmlFor="cod"><Input id="cod" value={formCodigo} onChange={(e) => setFormCodigo(e.target.value)} placeholder="Ej: H-001" required /></FormField>
              <FormField label="Categoría" htmlFor="cat">
                <select id="cat" value={formCategoria} onChange={(e) => setFormCategoria(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Seleccionar...</option>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Nombre" htmlFor="nom"><Input id="nom" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder='Ej: Llave de torque 1/2 pulg' required /></FormField>
            <FormField label="Marca" htmlFor="mar"><Input id="mar" value={formMarca} onChange={(e) => setFormMarca(e.target.value)} placeholder="Ej: Stanley" /></FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} disabled={!formCodigo || !formNombre || createMut.isPending} loading={createMut.isPending}>Crear Herramienta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Lend Dialog ─────────────────── */}
      <Dialog open={lendOpen} onOpenChange={setLendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-500" /> Prestar Herramienta</DialogTitle>
            <DialogDescription>Registrá el préstamo de la herramienta a un mecánico</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <FormField label="ID de OT" htmlFor="ot"><Input id="ot" value={lendOtId} onChange={(e) => setLendOtId(e.target.value)} placeholder="ID de la orden de trabajo" /></FormField>
            <FormField label="ID del Técnico" htmlFor="tec"><Input id="tec" value={lendTecnico} onChange={(e) => setLendTecnico(e.target.value)} placeholder="ID del mecánico" /></FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLendOpen(false)}>Cancelar</Button>
            <Button onClick={() => lendMut.mutate()} disabled={!lendOtId || !lendTecnico || lendMut.isPending} loading={lendMut.isPending}>Prestar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Return Dialog ───────────────── */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-green-500" /> Devolver Herramienta</DialogTitle>
            <DialogDescription>Registrá la devolución y el estado de la herramienta</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <FormField label="Condición de retorno" htmlFor="cond">
              <select id="cond" value={returnCondicion} onChange={(e) => setReturnCondicion(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="BUENO">Bueno</option>
                <option value="DESGASTADO">Desgastado</option>
                <option value="DANADO">Dañado</option>
                <option value="EXTRAVIADO">Extravíado</option>
              </select>
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancelar</Button>
            <Button onClick={() => returnMut.mutate()} disabled={returnMut.isPending} loading={returnMut.isPending}>Devolver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Complete Calibration Dialog (T-63 S126) ─── */}
      <Dialog open={calibOpen} onOpenChange={setCalibOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Completar Calibración</DialogTitle>
            <DialogDescription>Registrá la próxima calibración programada</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <FormField label="Próxima calibración" htmlFor="prox">
              <Input id="prox" type="date" value={calibProxima} onChange={(e) => setCalibProxima(e.target.value)} />
            </FormField>
            <FormField label="Observaciones" htmlFor="obs">
              <Input id="obs" value={calibObs} onChange={(e) => setCalibObs(e.target.value)} placeholder="Opcional" />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalibOpen(false)}>Cancelar</Button>
            <Button onClick={() => completeCalibMut.mutate()} disabled={completeCalibMut.isPending} loading={completeCalibMut.isPending}>Completar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Decommission Dialog (T-63 S126) ─── */}
      <Dialog open={decomOpen} onOpenChange={setDecomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Dar de Baja Instancia</DialogTitle>
            <DialogDescription>Esta acción es irreversible. Indicá el motivo de la baja.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <FormField label="Motivo de baja *" htmlFor="mot">
              <Input id="mot" value={decomMotivo} onChange={(e) => setDecomMotivo(e.target.value)} placeholder="Ej: Desgaste total, robo, irreparable" required />
            </FormField>
            <FormField label="Observaciones" htmlFor="obd">
              <Input id="obd" value={decomObs} onChange={(e) => setDecomObs(e.target.value)} placeholder="Opcional" />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecomOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => decommissionMut.mutate()} disabled={!decomMotivo || decommissionMut.isPending} loading={decommissionMut.isPending}>Dar de Baja</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Calibration History Dialog (T-63 S126) ─── */}
      <Dialog open={!!calHistInstanceId} onOpenChange={(open) => !open && setCalHistInstanceId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Historial de Calibración</DialogTitle>
            <DialogDescription>Eventos de calibración de la instancia</DialogDescription>
          </DialogHeader>
          {calHistLoading && <p className="text-sm text-muted-foreground py-4">Cargando…</p>}
          {!calHistLoading && (calHistory?.items || []).length === 0 && (
            <p className="text-sm text-muted-foreground py-4">Sin calibraciones registradas</p>
          )}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(calHistory?.items || []).map((ev) => (
              <div key={ev.id} className="flex items-center justify-between p-2 rounded border text-sm">
                <span>{TIPO_EVENTO_LABELS[ev.tipo] || ev.tipo}</span>
                <span className="text-xs text-muted-foreground">{ev.fechaFin ? new Date(ev.fechaFin).toLocaleDateString("es-PY") : "—"}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalHistInstanceId(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ToastContainer}
    </div>
  );
}
