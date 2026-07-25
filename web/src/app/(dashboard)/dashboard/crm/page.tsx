"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Download,
  Phone,
  Mail,
  Car,
  DollarSign,
  GitBranch,
  Loader2,
  GripVertical,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Pencil,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────── */

interface PipelineStage {
  id: string;
  nombre: string;
  orden: number;
  color: string;
  activo: boolean;
}

interface CrmDeal {
  id: string;
  titulo: string;
  descripcion: string | null;
  clienteNombre: string | null;
  clienteEmail: string | null;
  clientePhone: string | null;
  vehiculoChapa: string | null;
  vehiculoMarca: string | null;
  vehiculoModelo: string | null;
  stageId: string;
  valorEstimado: string | null;
  probabilidad: number | null;
  fuente: string | null;
  responsable: string | null;
  ganado: boolean | null;
  createdAt: string;
}

const EMPTY_DEAL = {
  titulo: "",
  descripcion: "",
  clienteNombre: "",
  clienteEmail: "",
  clientePhone: "",
  vehiculoChapa: "",
  vehiculoMarca: "",
  vehiculoModelo: "",
  stageId: "",
  valorEstimado: 0,
  probabilidad: 50,
  fuente: "directo",
  responsable: "",
};

/* ── Page ─────────────────────────────────────── */

export default function CRMPage() {
  const qc = useQueryClient();
  const { toast, ToastContainer } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(EMPTY_DEAL);
  const [search, setSearch] = React.useState("");

  // ── Fetch stages + deals ──
  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ["crm-stages"],
    queryFn: () => api.request<PipelineStage[]>("/crm/stages"),
  });

  const { data: deals = [], isLoading } = useQuery<CrmDeal[]>({
    queryKey: ["crm-deals"],
    queryFn: () => api.request<CrmDeal[]>("/crm/deals"),
  });

  // ── Seed default stages ──
  const seedStages = useMutation({
    mutationFn: () => api.request("/crm/stages/seed", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-stages"] }),
  });

  // Auto-seed on first load
  React.useEffect(() => {
    if (stages.length === 0 && !isLoading && !seedStages.isPending) {
      seedStages.mutate();
    }
  }, [stages.length, isLoading]);

  // ── Mutations ──
  const createMut = useMutation({
    mutationFn: () =>
      api.request("/crm/deals", {
        method: "POST",
        body: JSON.stringify({ ...form, stageId: form.stageId || stages[0]?.id }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-deals"] });
      closeDialog();
      toast.success("Deal creado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      api.request(`/crm/deals/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-deals"] });
      closeDialog();
      toast.success("Deal actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveMut = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) =>
      api.request(`/crm/deals/${dealId}/move`, {
        method: "POST",
        body: JSON.stringify({ stageId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-deals"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.request(`/crm/deals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-deals"] });
      toast.success("Deal eliminado");
    },
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_DEAL);
  }

  function openEdit(deal: CrmDeal) {
    setEditingId(deal.id);
    setForm({
      titulo: deal.titulo,
      descripcion: deal.descripcion ?? "",
      clienteNombre: deal.clienteNombre ?? "",
      clienteEmail: deal.clienteEmail ?? "",
      clientePhone: deal.clientePhone ?? "",
      vehiculoChapa: deal.vehiculoChapa ?? "",
      vehiculoMarca: deal.vehiculoMarca ?? "",
      vehiculoModelo: deal.vehiculoModelo ?? "",
      stageId: deal.stageId,
      valorEstimado: Number(deal.valorEstimado) || 0,
      probabilidad: deal.probabilidad ?? 50,
      fuente: deal.fuente ?? "directo",
      responsable: deal.responsable ?? "",
    });
    setDialogOpen(true);
  }

  // ── Group deals by stage ──
  const sortedStages = React.useMemo(
    () => [...stages].sort((a, b) => a.orden - b.orden),
    [stages]
  );

  const dealsByStage = React.useMemo(() => {
    const map: Record<string, CrmDeal[]> = {};
    sortedStages.forEach((s) => (map[s.id] = []));
    deals.forEach((d) => {
      if (map[d.stageId]) map[d.stageId].push(d);
    });
    return map;
  }, [deals, sortedStages]);

  // ── Stats ──
  const totalDeals = deals.length;
  const ganados = deals.filter((d) => d.ganado === true).length;
  const valorTotal = deals.reduce((s, d) => s + (Number(d.valorEstimado) || 0), 0);
  const probPromedio = totalDeals ? Math.round(deals.reduce((s, d) => s + (d.probabilidad || 0), 0) / totalDeals) : 0;

  // ── Filtered (search) ──
  const filteredByStage = React.useMemo(() => {
    if (!search) return dealsByStage;
    const q = search.toLowerCase();
    const result: Record<string, CrmDeal[]> = {};
    sortedStages.forEach((s) => {
      result[s.id] = (dealsByStage[s.id] || []).filter(
        (d) =>
          d.titulo.toLowerCase().includes(q) ||
          d.clienteNombre?.toLowerCase().includes(q) ||
          d.vehiculoChapa?.toLowerCase().includes(q)
      );
    });
    return result;
  }, [dealsByStage, sortedStages, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-indigo-500" />
            CRM Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalDeals} deal{totalDeals !== 1 ? "s" : ""} · {sortedStages.length} etapas
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar deals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Button
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY_DEAL);
              setDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nuevo Deal
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <p className="text-2xl font-bold">{totalDeals}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <p className="text-2xl font-bold">₲ {(valorTotal / 1_000_000).toFixed(1)}M</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prob. Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{probPromedio}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ganados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <p className="text-2xl font-bold text-emerald-600">{ganados}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Kanban Board ── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sortedStages.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">No hay etapas configuradas</p>
          <Button onClick={() => seedStages.mutate()} variant="outline">
            Crear etapas por defecto
          </Button>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {sortedStages.map((stage) => {
            const stageDeals = filteredByStage[stage.id] || [];
            const stageValor = stageDeals.reduce((s, d) => s + (Number(d.valorEstimado) || 0), 0);
            return (
              <div
                key={stage.id}
                className="flex-shrink-0 w-72 flex flex-col rounded-lg border bg-muted/30"
              >
                {/* Column header */}
                <div className="flex items-center justify-between p-3 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <h3 className="font-semibold text-sm">{stage.nombre}</h3>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {stageDeals.length}
                    </Badge>
                  </div>
                  {stageValor > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ₲ {(stageValor / 1_000_000).toFixed(1)}M
                    </span>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 min-h-[120px]">
                  {stageDeals.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      Sin deals
                    </p>
                  ) : (
                    stageDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        stage={stage}
                        allStages={sortedStages}
                        onMove={(newStageId) => moveMut.mutate({ dealId: deal.id, stageId: newStageId })}
                        onEdit={() => openEdit(deal)}
                        onDelete={() => {
                          if (confirm(`¿Eliminar deal "${deal.titulo}"?`)) deleteMut.mutate(deal.id);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Deal" : "Nuevo Deal"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Actualice los datos del deal" : "Complete los datos del nuevo deal"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <FormField label="Título" htmlFor="deal-title" required>
              <Input
                id="deal-title"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej: Presupuesto pintura completo"
                required
              />
            </FormField>
            <FormField label="Descripción" htmlFor="deal-desc">
              <Textarea
                id="deal-desc"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={2}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Cliente" htmlFor="deal-client">
                <Input id="deal-client" value={form.clienteNombre} onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })} placeholder="Nombre del cliente" />
              </FormField>
              <FormField label="Teléfono" htmlFor="deal-phone">
                <Input id="deal-phone" value={form.clientePhone} onChange={(e) => setForm({ ...form, clientePhone: e.target.value })} placeholder="+595..." />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Chapa" htmlFor="deal-chapa">
                <Input id="deal-chapa" value={form.vehiculoChapa} onChange={(e) => setForm({ ...form, vehiculoChapa: e.target.value })} placeholder="ABC 123" />
              </FormField>
              <FormField label="Fuente" htmlFor="deal-fuente">
                <select
                  id="deal-fuente"
                  value={form.fuente}
                  onChange={(e) => setForm({ ...form, fuente: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="directo">Directo</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telefono">Teléfono</option>
                  <option value="referido">Referido</option>
                  <option value="web">Web</option>
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Valor Estimado (₲)" htmlFor="deal-valor">
                <Input id="deal-valor" type="number" min={0} value={form.valorEstimado || ""} onChange={(e) => setForm({ ...form, valorEstimado: Number(e.target.value) })} />
              </FormField>
              <FormField label="Probabilidad (%)" htmlFor="deal-prob">
                <Input id="deal-prob" type="number" min={0} max={100} value={form.probabilidad} onChange={(e) => setForm({ ...form, probabilidad: Number(e.target.value) })} />
              </FormField>
            </div>
            {editingId && (
              <FormField label="Etapa" htmlFor="deal-stage">
                <select
                  id="deal-stage"
                  value={form.stageId}
                  onChange={(e) => setForm({ ...form, stageId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {sortedStages.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </FormField>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => (editingId ? updateMut.mutate() : createMut.mutate())}
              disabled={!form.titulo || createMut.isPending || updateMut.isPending}
              loading={createMut.isPending || updateMut.isPending}
            >
              {editingId ? "Guardar" : "Crear Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ToastContainer}
    </div>
  );
}

/* ── Deal Card Component ────────────────────── */

function DealCard({
  deal,
  stage,
  allStages,
  onMove,
  onEdit,
  onDelete,
}: {
  deal: CrmDeal;
  stage: PipelineStage;
  allStages: PipelineStage[];
  onMove: (stageId: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const sortedStages = [...allStages].sort((a, b) => a.orden - b.orden);
  const currentIdx = sortedStages.findIndex((s) => s.id === stage.id);
  const canMoveLeft = currentIdx > 0;
  const canMoveRight = currentIdx < sortedStages.length - 1;

  return (
    <div className="rounded-md border bg-card p-3 space-y-2 group hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-sm leading-tight flex-1">{deal.titulo}</h4>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {deal.clienteNombre && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="h-3 w-3" />
          {deal.clienteNombre}
        </p>
      )}

      {deal.vehiculoChapa && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Car className="h-3 w-3" />
          {deal.vehiculoMarca} {deal.vehiculoModelo} · {deal.vehiculoChapa}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        {deal.valorEstimado && Number(deal.valorEstimado) > 0 ? (
          <span className="text-xs font-medium">₲ {(Number(deal.valorEstimado) / 1_000_000).toFixed(1)}M</span>
        ) : (
          <span />
        )}
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={!canMoveLeft}
            onClick={() => canMoveLeft && onMove(sortedStages[currentIdx - 1].id)}
            title="Mover a etapa anterior"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={!canMoveRight}
            onClick={() => canMoveRight && onMove(sortedStages[currentIdx + 1].id)}
            title="Mover a etapa siguiente"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
