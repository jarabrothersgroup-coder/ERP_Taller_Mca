"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Wrench,
  Zap,
  Shield,
  Cpu,
  Paintbrush,
  Gauge,
  CircleDot,
  Disc,
  Cog,
  Activity,
  Droplets,
  Snowflake,
  Pipette,
  Sparkles,
  ArrowRight,
  Settings,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Service categories with icons ─────────────── */

const CATEGORIAS = [
  { id: "MANTENIMIENTO", label: "Mantenimiento", icon: Wrench, color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400", ring: "ring-orange-200 dark:ring-orange-800", desc: "Cambio de aceite, filtros, revisión general" },
  { id: "MECANICA", label: "Mecánica", icon: Cog, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", ring: "ring-blue-200 dark:ring-blue-800", desc: "Motor, transmisión, embrague, escaping" },
  { id: "FRENOS", label: "Frenos", icon: Disc, color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400", ring: "ring-red-200 dark:ring-red-800", desc: "Pastillas, discos, líquido de frenos" },
  { id: "SUSPENSION", label: "Suspensión", icon: Activity, color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400", ring: "ring-indigo-200 dark:ring-indigo-800", desc: "Amortiguadores, brazos, rótulas" },
  { id: "DIRECCION", label: "Dirección", icon: CircleDot, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400", ring: "ring-cyan-200 dark:ring-cyan-800", desc: "Caja de dirección, terminales, homocinéticas" },
  { id: "ELECTRICA", label: "Eléctrica", icon: Zap, color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400", ring: "ring-yellow-200 dark:ring-yellow-800", desc: "Alternador, marcha, batería, cableado" },
  { id: "ELECTRONICA", label: "Electrónica", icon: Cpu, color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400", ring: "ring-purple-200 dark:ring-purple-800", desc: "Sensores, ECU, diagnoses computarizada" },
  { id: "DIAGNOSTICO", label: "Diagnóstico", icon: Gauge, color: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400", ring: "ring-teal-200 dark:ring-teal-800", desc: "Escaneo DTC, análisis de fallas, pruebas" },
  { id: "TRANSMISION", label: "Transmisión", icon: Settings, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400", ring: "ring-amber-200 dark:ring-amber-800", desc: "Caja automática/manual, CVT, transfer" },
  { id: "MOTOR", label: "Motor", icon: Activity, color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400", ring: "ring-rose-200 dark:ring-rose-800", desc: "Overhaul, juntas, bandas, bomba de agua" },
  { id: "CHAPA", label: "Chapa", icon: Shield, color: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400", ring: "ring-slate-200 dark:ring-slate-800", desc: "Desabolladura, soldadura, estructura" },
  { id: "PINTURA", label: "Pintura", icon: Paintbrush, color: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400", ring: "ring-pink-200 dark:ring-pink-800", desc: "Pintura automotriz, retoques, barniz" },
  { id: "AIRE_ACONDICIONADO", label: "Aire Acondicionado", icon: Snowflake, color: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400", ring: "ring-sky-200 dark:ring-sky-800", desc: "Carga de gas, compresor, evaporador" },
  { id: "LUBRICENTRO", label: "Lubricentro", icon: Droplets, color: "bg-lime-100 text-lime-600 dark:bg-lime-900/30 dark:text-lime-400", ring: "ring-lime-200 dark:ring-lime-800", desc: "Grasas, lubricantes, aceites" },
  { id: "HIGIENICO", label: "Higiénico", icon: Sparkles, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400", ring: "ring-emerald-200 dark:ring-emerald-800", desc: "Limpieza interior, desinfección, tapizados" },
];

/* ── Types ──────────────────────────────────── */

interface ServicioCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  precioEstimado: string | null;
  duracionEstimada: number | null;
  activo: boolean;
}

function formatPrecio(val: string | null): string {
  if (!val) return "Consultar";
  const num = Number(val);
  if (isNaN(num)) return "Consultar";
  return `₲ ${num.toLocaleString("es-PY")}`;
}

function formatDuracion(min: number | null): string {
  if (!min && min !== 0) return null as any;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ── Page Component ─────────────────────────── */

export default function PortalServiciosPage() {
  const router = useRouter();
  const [servicios, setServicios] = React.useState<ServicioCatalogo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedCategoria, setSelectedCategoria] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    const fetchServicios = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/workshop/servicios?limit=200`);
        if (res.ok) {
          const data = await res.json();
          setServicios((data ?? []).filter((s: ServicioCatalogo) => s.activo));
        }
      } catch {
        // Silent - will show empty categories
      } finally {
        setLoading(false);
      }
    };
    fetchServicios();
  }, []);

  /* Group services by category */
  const serviciosPorCategoria = React.useMemo(() => {
    const map = new Map<string, ServicioCatalogo[]>();
    for (const svc of servicios) {
      const cat = svc.categoria || "OTROS";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(svc);
    }
    return map;
  }, [servicios]);

  /* Categories with services */
  const activeCategories = CATEGORIAS.filter(
    (cat) => serviciosPorCategoria.has(cat.id) || true /* show all categories even if no services yet */
  );

  const selectedCategory = selectedCategoria
    ? CATEGORIAS.find((c) => c.id === selectedCategoria)
    : null;

  const filteredServices = React.useMemo(() => {
    let list = selectedCategoria
      ? serviciosPorCategoria.get(selectedCategoria) || []
      : servicios;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.nombre.toLowerCase().includes(q) ||
          (s.descripcion || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [selectedCategoria, servicios, serviciosPorCategoria, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/portal/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Nuestros Servicios</h1>
          <p className="text-sm text-muted-foreground">Conocé todo lo que podemos hacer por tu vehículo</p>
        </div>
      </div>

      {/* Hero CTA — stronger visual */}
      <div className="rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 p-6 sm:p-8 text-white relative overflow-hidden shadow-lg shadow-orange-500/20">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-orange-800/30 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">¿Necesitás un servicio?</h2>
            <p className="text-orange-100 mt-1 text-sm sm:text-base">
              Agendá tu turno en línea y evitá esperas
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-xs text-orange-100">
                <Clock className="h-3 w-3" /> Turnos en 24h
              </span>
              <span className="flex items-center gap-1 text-xs text-orange-100">
                <Shield className="h-3 w-3" /> Garantía incluida
              </span>
            </div>
          </div>
          <Button
            onClick={() => router.push("/portal/booking")}
            className="bg-white text-orange-600 hover:bg-orange-50 font-semibold shadow-lg gap-2 shrink-0 active:scale-[0.98] transition-transform"
            size="lg"
          >
            <Calendar className="h-5 w-5" />
            Agendar Turno
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar servicio por nombre o descripción..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex h-10 w-full rounded-xl border border-input bg-background pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-300 transition-all"
        />
      </div>

      {/* Category grid */}
      {!selectedCategoria && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Categorías de Servicios
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))
              : activeCategories.map((cat) => {
                  const Icon = cat.icon;
                  const count = serviciosPorCategoria.get(cat.id)?.length ?? 0;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoria(cat.id)}
                      className="group text-left p-4 rounded-xl border bg-card hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-200 active:scale-[0.98]"
                    >
                      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ring-2 ring-transparent group-hover:ring-orange-200 dark:group-hover:ring-orange-800", cat.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold">{cat.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{cat.desc}</p>
                      {count > 0 && (
                        <Badge variant="secondary" className="mt-2 text-[10px]">
                          {count} servicio{count > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </button>
                  );
                })}
          </div>
        </div>
      )}

      {/* Filtered services list */}
      {selectedCategoria && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategoria(null)}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Todas las categorías
            </Button>
            {selectedCategory && (
              <div className="flex items-center gap-2">
                {React.createElement(selectedCategory.icon, { className: "h-4 w-4 text-orange-500" })}
                <span className="font-semibold text-sm">{selectedCategory.label}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {filteredServices.length}
                </Badge>
              </div>
            )}
          </div>

          {filteredServices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wrench className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">
                  {searchQuery ? "Sin resultados para tu búsqueda" : "Sin servicios registrados"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {searchQuery ? "Intentá con otros términos" : "Agendá un turno y te asesoramos"}
                </p>
                <Button
                  className="mt-4 gap-2"
                  onClick={() => router.push("/portal/booking")}
                >
                  <Calendar className="h-4 w-4" />
                  Agendar Turno
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredServices.map((svc) => (
                <Card key={svc.id} className="hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-200 group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm group-hover:text-orange-600 transition-colors">{svc.nombre}</p>
                        {svc.descripcion && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {svc.descripcion}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2.5">
                          {svc.precioEstimado && (
                            <div className="flex items-center gap-1 text-xs">
                              <DollarSign className="h-3 w-3 text-emerald-500" />
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatPrecio(svc.precioEstimado)}
                              </span>
                            </div>
                          )}
                          {svc.duracionEstimada && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{formatDuracion(svc.duracionEstimada)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Micro CTA per service */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 w-full justify-center gap-1 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                      onClick={() => router.push("/portal/booking")}
                    >
                      <Calendar className="h-3 w-3" />
                      Agendar este servicio
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom CTA — stronger */}
      <div className="rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200/50 dark:border-orange-800/50 p-6 text-center">
        <p className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-3">
          ¿No encontrás lo que buscás? Agendá un turno y te asesoramos.
        </p>
        <Button
          className="gap-2 bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20"
          onClick={() => router.push("/portal/booking")}
        >
          <Calendar className="h-4 w-4" />
          Agendar Turno
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
