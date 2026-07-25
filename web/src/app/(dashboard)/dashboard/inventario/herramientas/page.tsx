"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

interface ToolLoan {
  id: string;
  toolInstanceId: string;
  herramientaNombre?: string;
  herramientaCodigo?: string;
  ordenTrabajoId: string;
  mecanicoId: string;
  mecanicoNombre?: string;
  fechaPrestamo: string;
  fechaEsperadaDevolucion: string | null;
  fechaDevolucion: string | null;
  condicionSalida: string;
  condicionRetorno: string | null;
  estado: "ACTIVO" | "DEVUELTO" | "VENCIDO";
}

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
  ACTIVO: "bg-blue-100 text-blue-700 border-blue-300",
  DEVUELTO: "bg-green-100 text-green-700 border-green-300",
  VENCIDO: "bg-red-100 text-red-700 border-red-300",
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

  // ── Fetch catalog ──
  const { data: catalogData, isLoading: catLoading } = useQuery<{ items: Herramienta[]; total: number }>({
    queryKey: ["herramientas", categoriaFilter],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (categoriaFilter) qs.set("categoria", categoriaFilter);
      qs.set("limit", "100");
      return api.request(`/inventory/herramientas?${qs.toString()}`) as any;
    },
  });

  // ── Fetch instances ──
  const { data: instancesData, isLoading: instLoading } = useQuery<{ items: ToolInstance[]; total: number }>({
    queryKey: ["tool-instances"],
    queryFn: () => api.request("/inventory/tool-instances?limit=100") as any,
  });

  // ── Fetch loans ──
  const { data: loansData, isLoading: loansLoading } = useQuery<{ items: ToolLoan[]; total: number }>({
    queryKey: ["tool-loans"],
    queryFn: () => api.request("/inventory/tool-loans?limit=50") as any,
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
    mutationFn: () => api.lendTool({ toolInstanceId: lendInstanceId, ordenTrabajoId: lendOtId, tecnicoId: lendTecnico }),
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

  const activeLoans = loans.filter((l) => l.estado === "ACTIVO" || l.estado === "VENCIDO");
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
      cell: (_, r) => r.estadoActual === "DISPONIBLE" ? (
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setLendInstanceId(r.id); setLendOpen(true); }}>
          Prestar
        </Button>
      ) : null,
    },
  ];

  const loanColumns: Column<ToolLoan>[] = [
    { header: "Herramienta", accessor: "herramientaNombre", cell: (_, r) => <span className="font-medium text-sm">{r.herramientaNombre || r.toolInstanceId.slice(0, 8)}</span> },
    { header: "OT", accessor: "ordenTrabajoId", cell: (_, r) => <span className="font-mono text-xs">#{r.ordenTrabajoId.slice(0, 8)}</span> },
    { header: "Técnico", accessor: "mecanicoNombre", hideOnMobile: true },
    { header: "Préstamo", accessor: "fechaPrestamo", cell: (_, r) => <span className="text-xs">{new Date(r.fechaPrestamo).toLocaleDateString("es-PY")}</span> },
    { header: "Estado", accessor: "estado", cell: (_, r) => (
      <Badge className={cn("text-xs border", ESTADO_LOAN_COLORS[r.estado])}>
        {r.estado === "ACTIVO" ? "Activo" : r.estado === "DEVUELTO" ? "Devuelto" : "Vencido"}
      </Badge>
    )},
    {
      header: "",
      accessor: "estado",
      cell: (_, r) => r.estado === "ACTIVO" || r.estado === "VENCIDO" ? (
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
          { key: "prestamos" as const, label: "Préstamos", icon: Users },
          { key: "mantenimiento" as const, label: "Mantenimiento", icon: Hammer },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5",
              activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground")}
            role="tab">
            <tab.icon className="h-4 w-4" /> {tab.label}
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
        <DataTable<ToolLoan>
          columns={loanColumns} data={loans} rowKey="id"
          loading={loansLoading} emptyMessage="No hay préstamos registrados"
          paginate pageSize={10} sortable className="shadow-sm"
        />
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      {ToastContainer}
    </div>
  );
}
