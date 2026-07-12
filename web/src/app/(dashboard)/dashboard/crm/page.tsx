"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Plus, Download, Phone, Mail, Calendar,
  Building2, Tag, TrendingUp, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { api } from "@/lib/api";

/* ── Types ──────────────────────────────────── */

interface LeadRecord {
  id: string;
  nombre: string;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  origen: string;
  etapa: string;
  probabilidad: number;
  valorEstimado: number;
  proximoContacto: string;
  responsable: string;
  tags: string[];
  createdAt: string;
}

interface CRMStats {
  totalContacts: number;
  syncedOrders: number;
  pendingSync: number;
  failedSync: number;
}

/* ── CRM Data Hook ─────────────────────────── */

function useCRMData() {
  return useQuery({
    queryKey: ["crm-data"],
    queryFn: async () => {
      try {
        const [status, stats] = await Promise.all([
          api.request<{ connected: boolean; instance?: string }>("/crm/status"),
          api.request<CRMStats>("/crm/stats"),
        ]);
        return { status, stats, source: "api" as const };
      } catch {
        return {
          status: { connected: false },
          stats: { totalContacts: 0, syncedOrders: 0, pendingSync: 0, failedSync: 0 },
          source: "mock" as const,
        };
      }
    },
  });
}

/* ── Etapa Config ───────────────────────────── */

const etapaConfig: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "success" | "destructive" }> = {
  CONTACTADO: { label: "Contactado", variant: "secondary" },
  CALIFICADO: { label: "Calificado", variant: "default" },
  PROPUESTA: { label: "Propuesta", variant: "warning" },
  CERRADO_GANADO: { label: "Cerrado", variant: "success" },
  PERDIDO: { label: "Perdido", variant: "destructive" },
};

/* ── Stats ──────────────────────────────────── */

function CRMStatsCards({ leads, crmStats }: { leads: LeadRecord[]; crmStats: CRMStats }) {
  const total = leads.length;
  const activos = leads.filter((l) => l.etapa !== "PERDIDO").length;
  const valorTotal = leads.reduce((s, l) => s + l.valorEstimado, 0);
  const probPromedio = leads.length ? Math.round(leads.reduce((s, l) => s + l.probabilidad, 0) / leads.length) : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{total}</p>
          </div>
          {crmStats.totalContacts > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">{crmStats.totalContacts} contactos en CRM</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Activos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{activos}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Valor Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-orange-500" aria-hidden="true" />
            <p className="text-2xl font-bold">₲ {(valorTotal / 1_000_000).toFixed(1)}M</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Prob. Promedio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-violet-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{probPromedio}%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Columns ────────────────────────────────── */

const columns: Column<LeadRecord>[] = [
  {
    header: "Lead",
    accessor: "nombre",
    sortable: true,
    cell: (_, row) => (
      <div>
        <p className="font-medium">{row.nombre}</p>
        {row.empresa && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3 w-3" aria-hidden="true" />
            {row.empresa}
          </p>
        )}
      </div>
    ),
  },
  {
    header: "Contacto",
    accessor: "telefono",
    hideOnMobile: true,
    cell: (_, row) => (
      <div className="text-xs space-y-0.5">
        {row.telefono && (
          <p className="flex items-center gap-1"><Phone className="h-3 w-3" aria-hidden="true" />{row.telefono}</p>
        )}
        {row.email && (
          <p className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" aria-hidden="true" />{row.email}</p>
        )}
      </div>
    ),
  },
  {
    header: "Origen",
    accessor: "origen",
    sortable: true,
    hideOnMobile: true,
    cell: (value) => <Badge variant="secondary" className="font-normal">{value as string}</Badge>,
  },
  {
    header: "Etapa",
    accessor: "etapa",
    sortable: true,
    cell: (_, row) => {
      const config = etapaConfig[row.etapa] ?? { label: row.etapa, variant: "default" as const };
      return <Badge variant={config.variant}>{config.label}</Badge>;
    },
  },
  {
    header: "Prob.",
    accessor: "probabilidad",
    sortable: true,
    align: "center",
    cell: (value) => {
      const pct = value as number;
      return (
        <span className={`tabular-nums font-medium ${pct >= 70 ? "text-emerald-500" : pct >= 40 ? "text-amber-500" : "text-red-500"}`}>
          {pct}%
        </span>
      );
    },
  },
  {
    header: "Valor Est.",
    accessor: "valorEstimado",
    sortable: true,
    align: "right",
    cell: (value) => (
      <span className="tabular-nums font-medium">₲ {(Number(value) / 1_000_000).toFixed(1)}M</span>
    ),
  },
  {
    header: "Próx. Contacto",
    accessor: "proximoContacto",
    sortable: true,
    align: "right",
    className: "text-xs",
  },
  {
    header: "Tags",
    accessor: "tags",
    hideOnMobile: true,
    cell: (value) => {
      const tags = value as string[];
      return (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <Badge key={t} variant="outline" className="text-[10px] font-normal gap-0.5">
              <Tag className="h-2.5 w-2.5" aria-hidden="true" />
              {t}
            </Badge>
          ))}
        </div>
      );
    },
  },
];

/* ── Page ─────────────────────────────────────── */

export default function CRMPage() {
  const [search, setSearch] = React.useState("");
  const [etapaFilter, setEtapaFilter] = React.useState("");
  const { data: crmData, isLoading } = useCRMData();

  // Leads from CRM stats (when available) or empty
  const leads = React.useMemo<LeadRecord[]>(() => {
    if (crmData?.source === "api" && crmData.stats.totalContacts > 0) {
      // TODO: Replace with real leads list endpoint when Twenty CRM GraphQL is exposed
      return [];
    }
    // Fallback: empty until real data is connected
    return [];
  }, [crmData]);

  const filtered = React.useMemo(() => {
    let result = leads;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.nombre.toLowerCase().includes(q) ||
          l.empresa?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.telefono?.includes(q)
      );
    }
    if (etapaFilter) {
      result = result.filter((l) => l.etapa === etapaFilter);
    }
    return result;
  }, [leads, search, etapaFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de leads y pipeline de ventas
            {crmData?.status?.connected && (
              <Badge variant="success" className="ml-2 text-[10px]">Conectado</Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar
          </Button>
          <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
            <Plus className="h-5 w-5" aria-hidden="true" />
            Nuevo Lead
          </Button>
        </div>
      </div>

      <CRMStatsCards leads={filtered} crmStats={crmData?.stats ?? { totalContacts: 0, syncedOrders: 0, pendingSync: 0, failedSync: 0 }} />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por etapa">
        <Button variant={etapaFilter === "" ? "secondary" : "ghost"} size="sm" onClick={() => setEtapaFilter("")} role="tab" aria-selected={etapaFilter === ""}>
          Todos
        </Button>
        {Object.entries(etapaConfig).map(([key, config]) => (
          <Button key={key} variant={etapaFilter === key ? "secondary" : "ghost"} size="sm" onClick={() => setEtapaFilter(key)} className="gap-1.5" role="tab" aria-selected={etapaFilter === key}>
            {config.label}
          </Button>
        ))}
      </div>

      <DataTable<LeadRecord>
        columns={columns}
        data={filtered}
        rowKey="id"
        emptyMessage={
          crmData?.source === "mock"
            ? "CRM no conectado. Configurá Twenty CRM para ver leads reales."
            : search || etapaFilter
              ? "No se encontraron leads con esos filtros"
              : "No hay leads registrados. Agregá tu primer lead para comenzar."
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar por nombre, empresa, email o teléfono…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
        onRowClick={(row) => console.log("Open lead:", row.id)}
      />
    </div>
  );
}
