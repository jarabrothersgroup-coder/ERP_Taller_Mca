"use client";

import * as React from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  FileText,
  Download,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { fetchAuditLog, type UIMappedAuditEntry } from "@/lib/data-service";

/* ── Types ──────────────────────────────────── */

interface AuditRecord extends UIMappedAuditEntry {
  // Extended from base type
}

/* ── Action Configuration ───────────────────── */

const actionConfig: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" | "default"; icon: React.ElementType }> = {
  CREAR: { label: "Crear", variant: "success", icon: ShieldCheck },
  MODIFICAR: { label: "Modificar", variant: "warning", icon: Activity },
  ANULAR: { label: "Anular", variant: "destructive", icon: ShieldAlert },
  PAGAR: { label: "Pagar", variant: "default", icon: Eye },
  EMITIR: { label: "Emitir", variant: "secondary", icon: FileText },
};

const entityColors: Record<string, string> = {
  OT: "text-blue-500 bg-blue-500/10",
  FACTURA: "text-emerald-500 bg-emerald-500/10",
  ASIENTO: "text-violet-500 bg-violet-500/10",
  PAGO: "text-orange-500 bg-orange-500/10",
  REPUESTO: "text-amber-500 bg-amber-500/10",
  USUARIO: "text-red-500 bg-red-500/10",
  CLIENTE: "text-cyan-500 bg-cyan-500/10",
};

/* ── Mock Data ──────────────────────────────── */

const acciones = ["CREAR", "MODIFICAR", "ANULAR", "PAGAR", "EMITIR"] as const;
const entidades = ["OT", "FACTURA", "ASIENTO", "PAGO", "REPUESTO", "USUARIO", "CLIENTE"] as const;

function getMockAudit(): AuditRecord[] {
  return Array.from({ length: 35 }, (_, i) => {
    const accion = acciones[i % acciones.length];
    const entidad = entidades[i % entidades.length];
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    const descripciones: Record<string, string[]> = {
      CREAR: [
        `Creación de ${entidad.toLowerCase()} #${String(100 + i).padStart(3, "0")}`,
        `Nuevo registro de ${entidad.toLowerCase()}`,
      ],
      MODIFICAR: [
        `Actualización de datos de ${entidad.toLowerCase()}`,
        `Cambio de estado en ${entidad.toLowerCase()} #${String(100 + i).padStart(3, "0")}`,
      ],
      ANULAR: [
        `Anulación de ${entidad.toLowerCase()} #${String(100 + i).padStart(3, "0")}`,
        `Cancelación de registro`,
      ],
      PAGAR: [
        `Pago registrado para ${entidad.toLowerCase()}`,
        `Cobro de ${entidad.toLowerCase()} #${String(100 + i).padStart(3, "0")}`,
      ],
      EMITIR: [
        `Emisión de ${entidad.toLowerCase()} electrónica`,
        `Factura ${String(100 + i).padStart(3, "0")} emitida`,
      ],
    };

    const descList = descripciones[accion] || ["Operación registrada"];

    return {
      id: `aud-${String(i + 1).padStart(4, "0")}`,
      usuario: ["Juan Jara", "María López", "Carlos M.", "Ana R.", "Sistema"][i % 5],
      accion,
      entidad,
      entidadId: `${entidad.slice(0, 3)}-${String(100 + i).padStart(3, "0")}`,
      descripcion: descList[i % descList.length],
      valorAnterior: i % 5 === 0 ? "Pendiente" : null,
      valorNuevo: i % 5 === 0 ? "Aprobado" : null,
      createdAt: date.toLocaleDateString("es-PY") + " " + `${8 + (i % 8)}:${String((i * 13) % 60).padStart(2, "0")}`,
    };
  });
}

/* ── Stats Cards ────────────────────────────── */

function AuditStats({ entries }: { entries: AuditRecord[] }) {
  const total = entries.length;
  const creaciones = entries.filter((e) => e.accion === "CREAR").length;
  const anulaciones = entries.filter((e) => e.accion === "ANULAR").length;
  const entidadesUnicas = [...new Set(entries.map((e) => e.entidad))].length;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Eventos Totales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{total}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Últimos 30 días</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Creaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold text-emerald-500">{creaciones}</p>
          </div>
        </CardContent>
      </Card>
      <Card className={cn(anulaciones > 0 && "border-destructive/30")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
            Anulaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", anulaciones > 0 && "text-destructive")}>{anulaciones}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Entidades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{entidadesUnicas}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Columns ────────────────────────────────── */

const columns: Column<AuditRecord>[] = [
  {
    header: "Usuario",
    accessor: "usuario",
    sortable: true,
    cell: (_, row) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
          {row.usuario.charAt(0)}
        </div>
        <span className="font-medium text-sm">{row.usuario}</span>
      </div>
    ),
  },
  {
    header: "Acción",
    accessor: "accion",
    sortable: true,
    sortKey: "accion",
    cell: (_, row) => {
      const config = actionConfig[row.accion] || { label: row.accion, variant: "secondary" as const, icon: FileText };
      return (
        <Badge variant={config.variant} className="gap-1">
          <config.icon className="h-3 w-3" aria-hidden="true" />
          {config.label}
        </Badge>
      );
    },
  },
  {
    header: "Entidad",
    accessor: "entidad",
    sortable: true,
    cell: (_, row) => (
      <Badge
        variant="secondary"
        className={cn("font-normal", entityColors[row.entidad] || "")}
      >
        {row.entidad}
      </Badge>
    ),
  },
  {
    header: "Descripción",
    accessor: "descripcion",
    sortable: true,
    cell: (_, row) => (
      <div>
        <p className="text-sm">{row.descripcion}</p>
        <p className="text-xs text-muted-foreground font-mono">{row.entidadId}</p>
      </div>
    ),
  },
  {
    header: "Cambios",
    accessor: "valorAnterior",
    hideOnMobile: true,
    cell: (_, row) => (
      row.valorAnterior ? (
        <div className="text-xs">
          <span className="text-destructive line-through">{row.valorAnterior}</span>
          <span className="mx-1 text-muted-foreground">→</span>
          <span className="text-emerald-500">{row.valorNuevo}</span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )
    ),
  },
  {
    header: "Fecha",
    accessor: "createdAt",
    sortable: true,
    className: "text-xs",
    hideOnMobile: true,
  },
];

/* ── Main Page ──────────────────────────────── */

export default function SeguridadPage() {
  const [loading, setLoading] = React.useState(true);
  const [entries, setEntries] = React.useState<AuditRecord[]>([]);
  const [search, setSearch] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    fetchAuditLog(getMockAudit).then((data) => {
      if (!cancelled) {
        setEntries(data as AuditRecord[]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = React.useMemo(() => {
    let result = entries;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.usuario.toLowerCase().includes(q) ||
          e.descripcion.toLowerCase().includes(q) ||
          e.entidad.toLowerCase().includes(q) ||
          e.entidadId.toLowerCase().includes(q)
      );
    }
    if (actionFilter) {
      result = result.filter((e) => e.accion === actionFilter);
    }
    return result;
  }, [entries, search, actionFilter]);

  const criticalActions = entries.filter((e) => e.accion === "ANULAR");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seguridad y Auditoría</h1>
          <p className="text-sm text-muted-foreground">
            Registro de actividad, eventos críticos y trazabilidad del sistema
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Exportar Auditoría
        </Button>
      </div>

      {/* Critical alert */}
      {criticalActions.length > 0 && !loading && (
        <Alert variant="warning">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Eventos críticos detectados</AlertTitle>
          <AlertDescription>
            {criticalActions.length} anulacion{criticalActions.length !== 1 ? "es" : ""} registrada{criticalActions.length !== 1 ? "s" : ""} en el período.
            Se recomienda revisar la trazabilidad completa.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      {!loading && <AuditStats entries={filtered} />}

      {/* HV Safety Card */}
      {!loading && (
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Lock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Protocolo HV Lockout/Tagout</p>
                <p className="text-xs text-muted-foreground">
                  Sistema de seguridad para vehículos HEV/BEV — Desconexión obligatoria de alto voltaje
                </p>
              </div>
            </div>
            <Badge variant="success" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              Protocolo Activo
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Filter tabs */}
      {!loading && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por acción">
          <Button
            variant={actionFilter === "" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActionFilter("")}
            role="tab"
            aria-selected={actionFilter === ""}
          >
            Todas
          </Button>
          {Object.entries(actionConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={actionFilter === key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActionFilter(key)}
              className="gap-1.5"
              role="tab"
              aria-selected={actionFilter === key}
            >
              <config.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {config.label}
            </Button>
          ))}
        </div>
      )}

      {/* Data Table */}
      <DataTable<AuditRecord>
        columns={columns}
        data={filtered}
        rowKey="id"
        loading={loading}
        emptyMessage={
          search || actionFilter
            ? "No se encontraron eventos con esos filtros"
            : "No hay eventos de auditoría registrados"
        }
        paginate
        pageSize={10}
        sortable
        searchPlaceholder="Buscar usuario, entidad o descripción…"
        searchValue={search}
        onSearchChange={setSearch}
        className="shadow-sm"
        stickyHeader
      />
    </div>
  );
}
