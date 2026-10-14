"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ErrorState } from "@/components/ui/error-state";
import { useErrorToast } from "@/hooks/use-error-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Megaphone,
  Plus,
  Send,
  Eye,
  MousePointerClick,
  Star,
  MessageSquareQuote,
  Heart,
  Gift,
  Trophy,
  Medal,
  Users,
  RefreshCw,
  Search,
  User,
  Wallet,
  Coins,
  Mail,
  BarChart3,
  Workflow,
  Reply,
  Trash2,
  UserPlus,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────── */

interface Campaign {
  id: string;
  nombre: string;
  tipo: string;
  status: string;
  enviados: number;
  aperturas: number;
  conversiones: number;
  createdAt: string;
}

interface GoogleReview {
  id: string;
  autor: string;
  rating: number;
  texto: string;
  fecha: string;
  responded: boolean;
  respuesta?: string;
}

interface MarketingSequence {
  id: string;
  nombre: string;
  descripcion: string | null;
  trigger_event: string;
  estado: string;
  total_enrolled: number;
  total_completed: number;
}

interface SequenceEnrollment {
  id: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_phone: string | null;
  estado: string;
  current_step: number;
  next_action_at: string | null;
  started_at: string;
}

interface LoyaltyMovement {
  id: string;
  clienteId: string;
  tipo: string;
  puntos: number;
  descripcion: string | null;
  fecha: string;
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  responseRate: number;
  sentimentScore: number;
}

interface Reward {
  id: string;
  nombre: string;
  descripcion: string;
  puntosRequeridos: number;
  activo: boolean;
}

interface LoyaltyAccount {
  clienteId: string;
  clienteNombre: string;
  puntosActuales: number;
  puntosGanadosTotal: number;
  nivel: "BRONCE" | "PLATA" | "ORO" | "PLATINO";
}

/* ─── Helpers ──────────────────────────────────── */

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn(cls, s <= rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30")} />
      ))}
    </div>
  );
}

/* ─── Tabs ─────────────────────────────────────── */

const TABS = [
  { key: "campaigns", label: "Campañas", icon: Megaphone },
  { key: "sequences", label: "Secuencias", icon: Workflow },
  { key: "reviews", label: "Reseñas", icon: MessageSquareQuote },
  { key: "loyalty", label: "Fidelización", icon: Heart },
];

/* ─── Main Page ───────────────────────────────── */

export default function MarketingPage() {
  const qc = useQueryClient();
  const { toast, ToastContainer } = useToast();
  const [activeTab, setActiveTab] = React.useState("campaigns");
  const [searchCliente, setSearchCliente] = React.useState("");

  // Campaign dialog state
  const [showCreateCampaign, setShowCreateCampaign] = React.useState(false);
  const [campForm, setCampForm] = React.useState({ nombre: "", tipo: "whatsapp" as "whatsapp" | "email" | "sms", mensaje: "", segmento: "" });

  // Client search state
  const [selectedClienteId, setSelectedClienteId] = React.useState<string | null>(null);

  // Campaigns
  const { data: campaigns = [], isLoading: loadingCampaigns, isError, error, refetch } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: () => api.request<Campaign[]>("/marketing/campaigns"),
  });

  // T-53: feedback visible al fallar la carga
  useErrorToast(isError, "las campañas de marketing");

  if (isError) {
    return (
      <ErrorState
        title="No se pudo cargar marketing"
        message={error instanceof Error ? error.message : undefined}
        onRetry={refetch}
        className="min-h-[50vh] justify-center"
      />
    );
  }

  // Reviews
  const { data: reviews = [], isLoading: loadingReviews } = useQuery<GoogleReview[]>({
    queryKey: ["reviews"],
    queryFn: () => api.request<GoogleReview[]>("/marketing/reviews"),
  });

  const { data: reviewStats } = useQuery<ReviewStats>({
    queryKey: ["review-stats"],
    queryFn: () => api.request<ReviewStats>("/marketing/reviews/stats"),
  });

  // Rewards
  const { data: rewards = [], isLoading: loadingRewards } = useQuery<Reward[]>({
    queryKey: ["rewards"],
    queryFn: () => api.request<Reward[]>("/marketing/rewards"),
  });

  // ─── Campaign mutation ───────────────────────
  const createCampaignMut = useMutation({
    mutationFn: () =>
      api.request("/marketing/campaigns", {
        method: "POST",
        body: JSON.stringify({
          nombre: campForm.nombre,
          tipo: campForm.tipo,
          mensaje: campForm.mensaje,
          segmento: campForm.segmento || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      setShowCreateCampaign(false);
      setCampForm({ nombre: "", tipo: "whatsapp", mensaje: "", segmento: "" });
      toast.success("Campaña creada correctamente");
    },
    onError: (err: any) => toast.error(err?.message || "Error al crear campaña"),
  });

  // ─── Client search + loyalty ──────────────────
  // T-54: la búsqueda de clientes viaja al backend (antes filtraba en cliente)
  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ["clientes-search", searchCliente],
    queryFn: async () => (await api.listClients({ search: searchCliente, limit: 10 })).items,
    enabled: searchCliente.length >= 2,
  });

  const { data: loyaltyAccount, isLoading: loadingLoyalty } = useQuery<LoyaltyAccount | null>({
    queryKey: ["loyalty-account", selectedClienteId],
    queryFn: () =>
      api.request<LoyaltyAccount>(`/marketing/loyalty/${selectedClienteId}`).catch(() => null),
    enabled: !!selectedClienteId,
  });

  // ─── Responder reseñas (POST/DELETE /marketing/reviews/:id/respond) ───
  const [respondingId, setRespondingId] = React.useState<string | null>(null);
  const [respuestaText, setRespuestaText] = React.useState("");

  const respondMut = useMutation({
    mutationFn: (id: string) =>
      api.request(`/marketing/reviews/${id}/respond`, {
        method: "POST",
        body: JSON.stringify({ respuesta: respuestaText }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["review-stats"] });
      setRespondingId(null);
      setRespuestaText("");
      toast.success("Respuesta publicada");
    },
    onError: (err: any) => toast.error(err?.message || "No se pudo publicar la respuesta"),
  });

  const deleteResponseMut = useMutation({
    mutationFn: (id: string) =>
      api.request(`/marketing/reviews/${id}/respond`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["review-stats"] });
      toast.success("Respuesta eliminada");
    },
    onError: (err: any) => toast.error(err?.message || "No se pudo eliminar la respuesta"),
  });

  // ─── Loyalty: movimientos + acreditar/canjear puntos ───
  const { data: movements = [] } = useQuery<LoyaltyMovement[]>({
    queryKey: ["loyalty-movements", selectedClienteId],
    queryFn: () =>
      api.request<LoyaltyMovement[]>(`/marketing/loyalty/${selectedClienteId}/movements?limit=50`),
    enabled: !!selectedClienteId && !!loyaltyAccount,
  });

  const [pointsForm, setPointsForm] = React.useState({ puntos: "", descripcion: "" });

  const refreshLoyalty = () => {
    qc.invalidateQueries({ queryKey: ["loyalty-account", selectedClienteId] });
    qc.invalidateQueries({ queryKey: ["loyalty-movements", selectedClienteId] });
  };

  const creditPointsMut = useMutation({
    mutationFn: () =>
      api.request(`/marketing/loyalty/${selectedClienteId}/points`, {
        method: "POST",
        body: JSON.stringify({
          puntos: Number(pointsForm.puntos),
          descripcion: pointsForm.descripcion || undefined,
        }),
      }),
    onSuccess: () => {
      refreshLoyalty();
      setPointsForm({ puntos: "", descripcion: "" });
      toast.success("Puntos acreditados");
    },
    onError: (err: any) => toast.error(err?.message || "No se pudieron acreditar puntos"),
  });

  const redeemPointsMut = useMutation({
    mutationFn: () =>
      api.request(`/marketing/loyalty/${selectedClienteId}/redeem`, {
        method: "POST",
        body: JSON.stringify({
          puntos: Number(pointsForm.puntos),
          descripcion: pointsForm.descripcion || undefined,
        }),
      }),
    onSuccess: () => {
      refreshLoyalty();
      setPointsForm({ puntos: "", descripcion: "" });
      toast.success("Puntos canjeados");
    },
    onError: (err: any) => toast.error(err?.message || "No se pudieron canjear puntos"),
  });

  const redeemRewardMut = useMutation({
    mutationFn: (rewardId: string) =>
      api.request(`/marketing/loyalty/${selectedClienteId}/redeem/${rewardId}`, {
        method: "POST",
      }),
    onSuccess: () => {
      refreshLoyalty();
      toast.success("Recompensa canjeada");
    },
    onError: (err: any) => toast.error(err?.message || "No se pudo canjear la recompensa"),
  });

  // ─── Secuencias de automatización ─────────────
  const [selectedSeqId, setSelectedSeqId] = React.useState<string | null>(null);
  const [showCreateSeq, setShowCreateSeq] = React.useState(false);
  const [seqForm, setSeqForm] = React.useState({ nombre: "", descripcion: "", tipo: "whatsapp", delayDays: 0, mensaje: "" });
  const [enrollForm, setEnrollForm] = React.useState({ clienteNombre: "", clientePhone: "" });

  const seqQuery = useQuery<MarketingSequence[]>({
    queryKey: ["marketing-sequences"],
    queryFn: () => api.request<MarketingSequence[]>("/marketing/sequences"),
  });

  const { data: enrollments = [] } = useQuery<SequenceEnrollment[]>({
    queryKey: ["seq-enrollments", selectedSeqId],
    queryFn: () => api.request<SequenceEnrollment[]>(`/marketing/sequences/${selectedSeqId}/enrollments`),
    enabled: !!selectedSeqId,
  });

  const createSeqMut = useMutation({
    mutationFn: () =>
      api.request("/marketing/sequences", {
        method: "POST",
        body: JSON.stringify({
          nombre: seqForm.nombre,
          descripcion: seqForm.descripcion || undefined,
          steps: [
            {
              orden: 1,
              delayDays: seqForm.delayDays,
              tipo: seqForm.tipo,
              mensaje: seqForm.mensaje,
            },
          ],
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-sequences"] });
      setShowCreateSeq(false);
      setSeqForm({ nombre: "", descripcion: "", tipo: "whatsapp", delayDays: 0, mensaje: "" });
      toast.success("Secuencia creada");
    },
    onError: (err: any) => toast.error(err?.message || "No se pudo crear la secuencia"),
  });

  const enrollMut = useMutation({
    mutationFn: () =>
      api.request(`/marketing/sequences/${selectedSeqId}/enroll`, {
        method: "POST",
        body: JSON.stringify({
          clienteNombre: enrollForm.clienteNombre,
          clientePhone: enrollForm.clientePhone || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seq-enrollments", selectedSeqId] });
      qc.invalidateQueries({ queryKey: ["marketing-sequences"] });
      setEnrollForm({ clienteNombre: "", clientePhone: "" });
      toast.success("Cliente inscrito en la secuencia");
    },
    onError: (err: any) => toast.error(err?.message || "No se pudo inscribir al cliente"),
  });

  // ─── Campaign status breakdown ───────────────
  const statusCounts = campaigns.reduce<Record<string, number>>((acc, c) => {
    const st = c.status || "BORRADOR";
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVA: { label: "Activas", color: "text-emerald-600", bg: "bg-emerald-500" },
    BORRADOR: { label: "Borradores", color: "text-gray-600", bg: "bg-gray-400" },
    PROGRAMADA: { label: "Programadas", color: "text-blue-600", bg: "bg-blue-500" },
    ENVIADA: { label: "Enviadas", color: "text-indigo-600", bg: "bg-indigo-500" },
    CANCELADA: { label: "Canceladas", color: "text-red-600", bg: "bg-red-500" },
  };

  const totalCampaigns = campaigns.length;

  // ─── Campaign Stats ──────────────────────────
  const totalEnviados = campaigns.reduce((s, c) => s + (c.enviados ?? 0), 0);
  const totalAperturas = campaigns.reduce((s, c) => s + (c.aperturas ?? 0), 0);
  const totalConversiones = campaigns.reduce((s, c) => s + (c.conversiones ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-blue-500" />
            Marketing
          </h1>
          <p className="text-sm text-muted-foreground">Campañas, reseñas de Google y fidelización de clientes</p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateCampaign(true)}>
          <Plus className="h-4 w-4" /> Nueva Campaña
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto scrollbar-none -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0",
              activeTab === tab.key
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════ */}
      {/* TAB: Campañas */}
      {/* ════════════════════════════════════════ */}
      {activeTab === "campaigns" && (
        <>
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Send className="h-3 w-3" /> Enviados
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{totalEnviados}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Eye className="h-3 w-3" /> Aperturas
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{totalAperturas}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <MousePointerClick className="h-3 w-3" /> Conversiones
                </CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{totalConversiones}</p></CardContent>
            </Card>
          </div>

          {/* Status breakdown */}
          {totalCampaigns > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Campañas por Estado
                </CardTitle>
                <CardDescription>{totalCampaigns} campaña{totalCampaigns !== 1 ? "s" : ""} en total</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Stacked bar */}
                <div className="flex h-6 rounded-full overflow-hidden mb-4">
                  {Object.entries(STATUS_CONFIG).map(([st, cfg]) => {
                    const count = statusCounts[st] || 0;
                    if (count === 0) return null;
                    const pct = Math.round((count / totalCampaigns) * 100);
                    return (
                      <div
                        key={st}
                        className={cn(cfg.bg, "transition-all duration-500 first:rounded-l-full last:rounded-r-full")}
                        style={{ width: `${pct}%` }}
                        title={`${cfg.label}: ${count} (${pct}%)`}
                      />
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-3">
                  {Object.entries(STATUS_CONFIG).map(([st, cfg]) => {
                    const count = statusCounts[st] || 0;
                    if (count === 0) return null;
                    return (
                      <div key={st} className="flex items-center gap-1.5">
                        <div className={cn("h-2.5 w-2.5 rounded-full", cfg.bg)} />
                        <span className="text-xs text-muted-foreground">
                          {cfg.label}: <strong>{count}</strong>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campaigns list */}
          {loadingCampaigns ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay campañas registradas</p>
                <p className="text-xs text-muted-foreground mt-1">Creá una campaña para comenzar</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c) => (
                <Card key={c.id} className="hover:border-foreground/20 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{c.nombre}</CardTitle>
                      <Badge variant={c.status === "ACTIVA" ? "success" : "secondary"}>{c.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{c.tipo}</span>
                      <span>{c.enviados} enviados</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════ */}
      {/* TAB: Secuencias de automatización */}
      {/* ════════════════════════════════════════ */}
      {activeTab === "sequences" && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Secuencias de seguimiento automáticas (WhatsApp/email/SMS)
            </p>
            <Button size="sm" className="gap-1.5" onClick={() => setShowCreateSeq(true)}>
              <Plus className="h-4 w-4" /> Nueva Secuencia
            </Button>
          </div>

          {seqQuery.isLoading ? (
            <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : seqQuery.isError ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No se pudieron cargar las secuencias
              </CardContent>
            </Card>
          ) : (seqQuery.data ?? []).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay secuencias de automatización</p>
                <p className="text-xs text-muted-foreground mt-1">Creá una para dar seguimiento automático a tus clientes</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(seqQuery.data ?? []).map((s) => (
                <Card
                  key={s.id}
                  className={cn("cursor-pointer transition-colors", selectedSeqId === s.id && "border-blue-500")}
                  onClick={() => setSelectedSeqId(selectedSeqId === s.id ? null : s.id)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{s.nombre}</p>
                        <p className="text-xs text-muted-foreground mt-1">{s.descripcion || s.trigger_event}</p>
                      </div>
                      <Badge variant={s.estado === "ACTIVA" ? "success" : "secondary"} className="text-xs">
                        {s.estado}
                      </Badge>
                    </div>
                    <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                      <span>{s.total_enrolled} inscritos</span>
                      <span>{s.total_completed} completados</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Detalle: inscribir cliente + inscritos */}
          {selectedSeqId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-blue-500" /> Inscribir cliente
                </CardTitle>
                <CardDescription>Alta en la secuencia seleccionada</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium">Nombre del cliente *</label>
                    <Input
                      value={enrollForm.clienteNombre}
                      onChange={(e) => setEnrollForm({ ...enrollForm, clienteNombre: e.target.value })}
                      placeholder="Nombre completo"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">WhatsApp</label>
                    <Input
                      value={enrollForm.clientePhone}
                      onChange={(e) => setEnrollForm({ ...enrollForm, clientePhone: e.target.value })}
                      placeholder="+595…"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1"
                  disabled={!enrollForm.clienteNombre.trim() || enrollMut.isPending}
                  loading={enrollMut.isPending}
                  onClick={() => enrollMut.mutate()}
                >
                  <UserPlus className="h-3 w-3" /> Inscribir
                </Button>

                <div>
                  <p className="mb-2 text-xs font-medium">Inscritos ({enrollments.length})</p>
                  {enrollments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin inscritos todavía</p>
                  ) : (
                    <div className="max-h-56 space-y-1.5 overflow-y-auto">
                      {enrollments.map((en) => (
                        <div key={en.id} className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs">
                          <div>
                            <p className="font-medium">{en.cliente_nombre || "Cliente sin nombre"}</p>
                            <p className="text-muted-foreground">
                              Paso {en.current_step + 1} · {en.cliente_phone || "sin teléfono"}
                            </p>
                          </div>
                          <Badge variant={en.estado === "ACTIVO" ? "success" : "secondary"} className="text-[10px]">
                            {en.estado}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ════════════════════════════════════════ */}
      {/* TAB: Reseñas (Google Reviews) */}
      {/* ════════════════════════════════════════ */}
      {activeTab === "reviews" && (
        <>
          {/* Review Stats */}
          {reviewStats && (
            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Star className="h-3 w-3 text-amber-500" /> Promedio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{reviewStats.averageRating.toFixed(1)}</p>
                    <StarRating rating={Math.round(reviewStats.averageRating)} size="md" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <MessageSquareQuote className="h-3 w-3" /> Total Reseñas
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{reviewStats.totalReviews}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Send className="h-3 w-3" /> Respuestas
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{reviewStats.responseRate}%</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Heart className="h-3 w-3 text-emerald-500" /> Sentimiento
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{reviewStats.sentimentScore.toFixed(0)}%</p></CardContent>
              </Card>
            </div>
          )}

          {/* Reviews list */}
          {loadingReviews ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : reviews.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Star className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay reseñas de Google registradas</p>
                <p className="text-xs text-muted-foreground mt-1">Las reseñas se sincronizan automáticamente desde Google Business</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <Card key={r.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold">
                          {r.autor.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{r.autor}</p>
                          <StarRating rating={r.rating} />
                        </div>
                      </div>
                      <Badge variant={r.responded ? "success" : "secondary"} className="text-xs">
                        {r.responded ? "Respondida" : "Pendiente"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{r.texto}</p>
                    <p className="text-xs text-muted-foreground mt-2">{new Date(r.fecha).toLocaleDateString("es-PY")}</p>

                    {/* Respuesta / acciones */}
                    {r.responded && r.respuesta && (
                      <div className="mt-3 rounded-lg border bg-muted/40 p-2.5">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Respuesta publicada:</p>
                        <p className="text-xs">{r.respuesta}</p>
                      </div>
                    )}
                    {respondingId === r.id ? (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          value={respuestaText}
                          onChange={(e) => setRespuestaText(e.target.value)}
                          placeholder="Escribí tu respuesta pública…"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" loading={respondMut.isPending} disabled={!respuestaText.trim()} onClick={() => respondMut.mutate(r.id)}>
                            Publicar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setRespondingId(null); setRespuestaText(""); }}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => { setRespondingId(r.id); setRespuestaText(r.respuesta ?? ""); }}
                        >
                          <Reply className="h-3 w-3" /> {r.responded ? "Editar respuesta" : "Responder"}
                        </Button>
                        {r.responded && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1 text-red-600"
                            loading={deleteResponseMut.isPending}
                            onClick={() => deleteResponseMut.mutate(r.id)}
                          >
                            <Trash2 className="h-3 w-3" /> Quitar respuesta
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════ */}
      {/* TAB: Fidelización (Loyalty) */}
      {/* ════════════════════════════════════════ */}
      {activeTab === "loyalty" && (
        <>
          {/* Rewards stats */}
          {loadingRewards ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Gift className="h-3 w-3 text-emerald-500" /> Recompensas Activas
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{rewards.filter((r) => r.activo).length}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Trophy className="h-3 w-3 text-amber-500" /> Niveles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-1">
                    {["BRONCE", "PLATA", "ORO", "PLATINO"].map((n) => (
                      <Badge key={n} variant="outline" className="text-[10px]">{n}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Search className="h-3 w-3 text-blue-500" /> Buscar Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Input
                    placeholder="Nombre del cliente (mín. 2 caracteres)..."
                    value={searchCliente}
                    onChange={(e) => { setSearchCliente(e.target.value); setSelectedClienteId(null); }}
                    className="h-8 text-xs"
                  />
                  {/* Search results */}
                  {searchCliente.length >= 2 && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {loadingClientes ? (
                        <p className="text-xs text-muted-foreground">Buscando...</p>
                      ) : clientes.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sin resultados</p>
                      ) : (
                        clientes.map((c: any) => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedClienteId(c.id)}
                            className={cn(
                              "w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors flex items-center gap-2",
                              selectedClienteId === c.id && "bg-accent font-medium"
                            )}
                          >
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>{c.name}</span>
                            {c.ruc && <span className="text-muted-foreground">· {c.ruc}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* Loyalty account result */}
                  {selectedClienteId && (
                    loadingLoyalty ? (
                      <p className="text-xs text-muted-foreground">Cargando cuenta...</p>
                    ) : loyaltyAccount ? (
                      <div className="mt-3 rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium">{loyaltyAccount.clienteNombre}</p>
                          <Badge className={cn(
                            "text-[10px]",
                            loyaltyAccount.nivel === "PLATINO" ? "bg-blue-500" :
                            loyaltyAccount.nivel === "ORO" ? "bg-amber-500" :
                            loyaltyAccount.nivel === "PLATA" ? "bg-gray-400" :
                            "bg-orange-700"
                          )}>
                            <Trophy className="h-2.5 w-2.5 mr-1" />
                            {loyaltyAccount.nivel}
                          </Badge>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <Wallet className="h-3 w-3 text-emerald-500" />
                            <span><strong>{loyaltyAccount.puntosActuales}</strong> pts actuales</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Coins className="h-3 w-3 text-amber-500" />
                            <span><strong>{loyaltyAccount.puntosGanadosTotal}</strong> pts ganados</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">Sin cuenta de fidelización activa</p>
                    )
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Acciones de puntos + historial (cliente con cuenta) */}
          {selectedClienteId && loyaltyAccount && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" /> Acreditar / Canjear Puntos
                  </CardTitle>
                  <CardDescription>Movimientos manuales sobre la cuenta de {loyaltyAccount.clienteNombre}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Puntos</label>
                      <Input
                        type="number"
                        min={1}
                        value={pointsForm.puntos}
                        onChange={(e) => setPointsForm({ ...pointsForm, puntos: e.target.value })}
                        placeholder="Ej: 100"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium">Descripción</label>
                      <Input
                        value={pointsForm.descripcion}
                        onChange={(e) => setPointsForm({ ...pointsForm, descripcion: e.target.value })}
                        placeholder="Ej: Bonus por servicio pagado"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1"
                      disabled={!Number(pointsForm.puntos) || creditPointsMut.isPending}
                      loading={creditPointsMut.isPending}
                      onClick={() => creditPointsMut.mutate()}
                    >
                      <Wallet className="h-3 w-3" /> Acreditar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1"
                      disabled={!Number(pointsForm.puntos) || redeemPointsMut.isPending}
                      loading={redeemPointsMut.isPending}
                      onClick={() => redeemPointsMut.mutate()}
                    >
                      <Coins className="h-3 w-3" /> Canjear puntos
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Historial de movimientos (GET /movements) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4 text-blue-500" /> Historial de Puntos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {movements.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Sin movimientos registrados</p>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {movements.map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs">
                          <div>
                            <p className="font-medium">{m.descripcion || "Movimiento"}</p>
                            <p className="text-muted-foreground">{new Date(m.fecha).toLocaleDateString("es-PY")} · {m.tipo}</p>
                          </div>
                          <span className={cn("font-mono font-semibold", m.puntos >= 0 ? "text-emerald-600" : "text-red-600")}>
                            {m.puntos >= 0 ? "+" : ""}{m.puntos} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Rewards list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Gift className="h-4 w-4 text-emerald-500" />
                Recompensas Disponibles
              </CardTitle>
              <CardDescription>Canjeá puntos por recompensas</CardDescription>
            </CardHeader>
            <CardContent>
              {rewards.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground flex flex-col items-center gap-2">
                  <Gift className="h-8 w-8 opacity-30" />
                  <p>No hay recompensas configuradas</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rewards.map((r) => (
                    <Card key={r.id} className="hover:border-emerald-500/30 transition-colors">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{r.nombre}</p>
                            <p className="text-xs text-muted-foreground mt-1">{r.descripcion}</p>
                          </div>
                          <Badge className="text-xs whitespace-nowrap">{r.puntosRequeridos} pts</Badge>
                        </div>
                        {selectedClienteId && loyaltyAccount && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 h-7 w-full text-xs"
                            loading={redeemRewardMut.isPending}
                            disabled={(loyaltyAccount.puntosActuales ?? 0) < r.puntosRequeridos}
                            onClick={() => redeemRewardMut.mutate(r.id)}
                          >
                            {(loyaltyAccount.puntosActuales ?? 0) < r.puntosRequeridos
                              ? `Faltan ${r.puntosRequeridos - (loyaltyAccount.puntosActuales ?? 0)} pts`
                              : "Canjear recompensa"}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Loyalty level info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Niveles de Fidelización
              </CardTitle>
              <CardDescription>Los clientes acumulan puntos por cada servicio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { nivel: "BRONCE", pts: "0-500", color: "bg-orange-700/20 text-orange-700 border-orange-700/30" },
                  { nivel: "PLATA", pts: "501-1500", color: "bg-gray-400/20 text-gray-500 border-gray-400/30" },
                  { nivel: "ORO", pts: "1501-3000", color: "bg-amber-500/20 text-amber-600 border-amber-500/30" },
                  { nivel: "PLATINO", pts: "3001+", color: "bg-blue-500/20 text-blue-600 border-blue-500/30" },
                ].map((n) => (
                  <div key={n.nivel} className={cn("rounded-lg border p-3 text-center", n.color)}>
                    <p className="text-xs font-bold">{n.nivel}</p>
                    <p className="text-[10px] opacity-70 mt-1">{n.pts} pts</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Create Campaign Dialog ───────────── */}
      <Dialog open={showCreateCampaign} onOpenChange={setShowCreateCampaign}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-500" />
              Nueva Campaña
            </DialogTitle>
            <DialogDescription>
              Creá una campaña de marketing para tus clientes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre de la Campaña</label>
              <Input
                value={campForm.nombre}
                onChange={(e) => setCampForm({ ...campForm, nombre: e.target.value })}
                placeholder="Ej: Promoción cambio de aceite"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Canal</label>
              <div className="flex gap-2">
                {[
                  { key: "whatsapp", label: "WhatsApp", icon: Send },
                  { key: "email", label: "Email", icon: Mail },
                  { key: "sms", label: "SMS", icon: MessageSquareQuote },
                ].map((ch) => (
                  <button
                    key={ch.key}
                    type="button"
                    onClick={() => setCampForm({ ...campForm, tipo: ch.key as "whatsapp" | "email" | "sms" })}
                    className={cn(
                      "flex-1 rounded-lg border-2 p-2.5 text-center text-xs font-medium transition-colors",
                      campForm.tipo === ch.key
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "border-input hover:bg-accent"
                    )}
                  >
                    <ch.icon className="h-4 w-4 mx-auto mb-1" />
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensaje</label>
              <Textarea
                value={campForm.mensaje}
                onChange={(e) => setCampForm({ ...campForm, mensaje: e.target.value })}
                placeholder="Redactá el mensaje de la campaña..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Segmento (opcional)</label>
              <select
                value={campForm.segmento}
                onChange={(e) => setCampForm({ ...campForm, segmento: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Todos los clientes</option>
                <option value="ACTIVOS">Clientes activos</option>
                <option value="INACTIVOS">Clientes inactivos</option>
                <option value="FLOTA">Clientes flota</option>
                <option value="PARTICULARES">Clientes particulares</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateCampaign(false); setCampForm({ nombre: "", tipo: "whatsapp", mensaje: "", segmento: "" }); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => createCampaignMut.mutate()}
              disabled={!campForm.nombre || !campForm.mensaje || createCampaignMut.isPending}
              loading={createCampaignMut.isPending}
            >
              <Send className="h-4 w-4 mr-1" />
              Crear Campaña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Sequence Dialog ───────────── */}
      <Dialog open={showCreateSeq} onOpenChange={setShowCreateSeq}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-blue-500" />
              Nueva Secuencia
            </DialogTitle>
            <DialogDescription>
              Creá una secuencia de seguimiento con un primer paso automático.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={seqForm.nombre}
                onChange={(e) => setSeqForm({ ...seqForm, nombre: e.target.value })}
                placeholder="Ej: Seguimiento post-servicio"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción (opcional)</label>
              <Input
                value={seqForm.descripcion}
                onChange={(e) => setSeqForm({ ...seqForm, descripcion: e.target.value })}
                placeholder="Objetivo de la secuencia…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Canal</label>
                <select
                  value={seqForm.tipo}
                  onChange={(e) => setSeqForm({ ...seqForm, tipo: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Delay (días)</label>
                <Input
                  type="number"
                  min={0}
                  value={seqForm.delayDays}
                  onChange={(e) => setSeqForm({ ...seqForm, delayDays: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensaje del paso 1</label>
              <Textarea
                value={seqForm.mensaje}
                onChange={(e) => setSeqForm({ ...seqForm, mensaje: e.target.value })}
                placeholder="Texto que recibirá el cliente…"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSeq(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createSeqMut.mutate()}
              disabled={!seqForm.nombre.trim() || !seqForm.mensaje.trim() || createSeqMut.isPending}
              loading={createSeqMut.isPending}
            >
              Crear Secuencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ToastContainer}
    </div>
  );
}
