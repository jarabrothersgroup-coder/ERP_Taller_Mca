"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wrench,
  Package,
  DollarSign,
  Settings,
  Calendar,
  MessageSquare,
  BarChart3,
  FileText,
  Receipt,
  CreditCard,
  Shield,
  Truck,
  Users,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Car,
  Building2,
  GitBranch,
  ClipboardCheck,
  Scan,
  Calculator,
  PieChart,
  Megaphone,
  Printer,
  Database,
  Fingerprint,
  TrendingUp,
  Landmark,
  ScrollText,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Timer,
  UserCheck,
  Brain,
  Warehouse,
  Search,
  Zap,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/session-provider";
import { api } from "@/lib/api";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  /**
   * T-51: rol mínimo para ver el ítem (alineado a los guards del backend:
   * requireManager / requireAdmin). Sin `minRole` → visible para todos.
   * Se OCULTA (no se deshabilita) cuando el rol no alcanza.
   */
  minRole?: "manager" | "admin";
}

/** ROLE_HIERARCHY del backend (shared/middleware/rbac.ts) — reflejar cambios aquí */
const ROLE_RANK: Record<string, number> = { user: 0, mechanic: 1, manager: 2, admin: 3 };

/**
 * Sidebar reorganizado por FLUJO DE NEGOCIO de un taller automotriz:
 *
 * 1. 🎯 OPERACIONES — Lo que el usuario hace CADA MINUTO (frecuencia alta)
 *    Flujo: Vehículo llega → Recepción → Diagnóstico → Presupuesto → Aprobación → Trabajo → Cobro
 *
 * 2. 🔧 SERVICIOS — Catálogos y herramientas especializadas del taller
 *    Soporte técnico: precios, mecánicos, asignación, DVI, Thinkcar
 *
 * 3. 📦 INVENTARIO — Control de stock, compras, almacenes
 *    Flujo: Stock bajo → Orden de compra → Recepción → Asignación a OT
 *
 * 4. 💰 FINANZAS — Facturación, contabilidad, tesorería, nómina
 *    Flujo: Presupuesto → Factura → SIFEN → Cobro → Asiento contable automático
 *
 * 5. 👥 CRM — Clientes, pipeline, marketing, analytics
 *    Flujo: Lead → CRM → Servicio → Fidelización → Reseñas
 *
 * 6. ⚙️ ADMIN — Configuración del sistema, seguridad, usuarios
 *    Solo accessed on setup/maintenance (frecuencia baja)
 */
const navSections: { title: string; items: NavItem[] }[] = [
  // ── 1. OPERACIONES ──────────────────────────────────────────────
  // Flujo del día a día: qué está pasando AHORA en el taller
  {
    title: "Operaciones",
    items: [
      { label: "Hub de Operaciones", href: "/dashboard/hub", icon: Zap },
      { label: "Panel Ejecutivo", href: "/dashboard/ejecutivo", icon: LayoutDashboard },
      { label: "Recepción", href: "/dashboard/recepcion", icon: ClipboardCheck },
      { label: "Calendario", href: "/dashboard/calendario", icon: Calendar },
      { label: "WhatsApp", href: "/dashboard/whatsapp", icon: MessageSquare },
    ],
  },

  // ── 2. SERVICIOS DEL TALLER ─────────────────────────────────────
  // Catálogos, precios, personal, diagnóstico — todo lo técnico
  {
    title: "Servicios",
    items: [
      { label: "Catálogo Servicios", href: "/dashboard/servicios", icon: Wrench },
      { label: "Precios", href: "/dashboard/taller/precios", icon: TrendingUp },
      { label: "Flat Rate", href: "/dashboard/taller/flat-rate", icon: Timer },
      { label: "Asignación OT", href: "/dashboard/taller/asignacion", icon: UserCheck },
      { label: "Mecánicos", href: "/dashboard/taller/mecanicos", icon: Users, minRole: "manager" },
      { label: "DVI", href: "/dashboard/dvi", icon: ClipboardCheck },
      { label: "Thinkcar OBD2", href: "/dashboard/thinkcar", icon: Scan },
      { label: "Mant. Predictivo", href: "/dashboard/taller/predictive-ml", icon: Brain },
      { label: "Proveedores", href: "/dashboard/taller/proveedores", icon: Truck, minRole: "manager" },
    ],
  },

  // ── 3. INVENTARIO ───────────────────────────────────────────────
  // Control de stock y cadena de suministro
  {
    title: "Inventario",
    items: [
      { label: "Stock General", href: "/dashboard/inventario", icon: Package },
      { label: "Movimientos", href: "/dashboard/inventario/movimientos", icon: RefreshCw },
      { label: "Órdenes Compra", href: "/dashboard/inventario/ordenes-compra", icon: ShoppingCart },
      { label: "Almacenes", href: "/dashboard/inventario/almacenes", icon: Warehouse, minRole: "manager" },
      { label: "Herramientas", href: "/dashboard/inventario/herramientas", icon: Wrench },
      { label: "TecDoc", href: "/dashboard/inventario/tecdoc", icon: Search },
      { label: "Conteo Cíclico", href: "/dashboard/inventario/conteo", icon: ClipboardCheck },
    ],
  },

  // ── 4. FINANZAS ─────────────────────────────────────────────────
  // Facturación electrónica (SIFEN), contabilidad, tesorería, nómina
  {
    title: "Finanzas",
    items: [
      { label: "Facturación", href: "/dashboard/facturacion", icon: DollarSign },
      { label: "Config. Impresión", href: "/dashboard/facturacion/configurador", icon: Settings },
      { label: "Reimpresión", href: "/dashboard/facturacion/reimpresion", icon: RotateCcw },
      { label: "SIFEN", href: "/dashboard/finance/sifen", icon: FileText, minRole: "manager" },
      { label: "Presupuestos", href: "/dashboard/presupuestos", icon: PieChart },
      { label: "Nota Crédito", href: "/dashboard/contabilidad/nota-credito", icon: Receipt, minRole: "manager" },
      { label: "Contabilidad", href: "/dashboard/contabilidad", icon: Landmark, minRole: "manager" },
      { label: "Tesorería", href: "/dashboard/tesoreria", icon: DollarSign, minRole: "manager" },
      { label: "Nómina", href: "/dashboard/nomina", icon: Calculator, minRole: "manager" },
      { label: "Consolidación", href: "/dashboard/finance/consolidation", icon: Building2, minRole: "manager" },
    ],
  },

  // ── 5. CRM & CRECIMIENTO ───────────────────────────────────────
  // Relación con clientes, pipeline de ventas, analytics
  {
    title: "CRM & Crecimiento",
    items: [
      { label: "Clientes", href: "/dashboard/clientes", icon: Users },
      { label: "CRM Pipeline", href: "/dashboard/crm", icon: GitBranch },
      { label: "Marketing", href: "/dashboard/marketing", icon: Megaphone, minRole: "manager" },
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    ],
  },

  // ── 6. ADMINISTRACIÓN ───────────────────────────────────────────
  // Setup y mantenimiento del sistema — acceso esporádico
  {
    title: "Administración",
    items: [
      { label: "Nuevo Taller", href: "/onboarding", icon: Plus },
      { label: "Usuarios", href: "/dashboard/usuarios", icon: Users, minRole: "admin" },
      { label: "Vehículos", href: "/dashboard/vehiculos", icon: Car },
      { label: "Flotas", href: "/dashboard/flotas", icon: Truck, minRole: "manager" },
      { label: "Seguridad", href: "/dashboard/seguridad", icon: Shield, minRole: "admin" },
      { label: "Seguridad HW", href: "/dashboard/security-hw", icon: Fingerprint },
      { label: "Enterprise", href: "/dashboard/enterprise", icon: Building2, minRole: "admin" },
      { label: "Impresión", href: "/dashboard/label-printing", icon: Printer },
      { label: "Backup", href: "/dashboard/backup", icon: Database, minRole: "admin" },
      { label: "Configuración", href: "/dashboard/config", icon: Settings },
    ],
  },

  // ── 7. CUENTA ───────────────────────────────────────────────────
  // Perfil personal y facturación de la suscripción
  {
    title: "Cuenta",
    items: [
      { label: "Mi Perfil", href: "/dashboard/perfil", icon: User },
      { label: "Suscripción", href: "/dashboard/billing", icon: CreditCard },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

/** Evento custom para sincronizar el estado de secciones entre instancias (desktop + móvil) */
const SECTIONS_EVENT = "so:sidebar:sections-change";

export function DashboardSidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  // ── T-51: filtrado por rol — menú = permisos ────────────────────
  // rank null = sesión aún cargando (no filtrar, evita parpadeo);
  // rol desconocido (p. ej. "supervisor") → -1, no supera ningún minRole
  // (igual que el backend: ROLE_HIERARCHY[rol] undefined → 403).
  const role = user?.role;
  const rank = !role ? null : ROLE_RANK[role] ?? -1;

  const visibleSections = React.useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            item.minRole === undefined || rank === null
              ? true
              : rank >= ROLE_RANK[item.minRole],
          ),
        }))
        .filter((section) => section.items.length > 0),
    [rank],
  );

  // ── T-51: secciones colapsables (estado persistente en localStorage) ──
  const [closedSections, setClosedSections] = React.useState<string[]>([]);

  const applySections = (next: string[]) => {
    setClosedSections(next);
    try {
      window.localStorage.setItem("so:sidebar:sections", JSON.stringify(next));
      // Sincroniza la segunda instancia (drawer móvil) en la misma página
      window.dispatchEvent(new Event(SECTIONS_EVENT));
    } catch {
      /* sin localStorage — estado en memoria */
    };
  };

  React.useEffect(() => {
    const load = () => {
      try {
        const raw = window.localStorage.getItem("so:sidebar:sections");
        setClosedSections(raw ? (JSON.parse(raw) as string[]) : []);
      } catch {
        setClosedSections([]);
      }
    };
    load();
    window.addEventListener(SECTIONS_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(SECTIONS_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const toggleSection = (title: string) => {
    applySections(
      closedSections.includes(title)
        ? closedSections.filter((t) => t !== title)
        : [...closedSections, title],
    );
  };

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && !!pathname && pathname.startsWith(href + "/"));

  // Auto-expandir la sección que contiene la ruta activa
  React.useEffect(() => {
    const active = visibleSections.find((sec) =>
      sec.items.some((item) => isActive(item.href)),
    );
    if (active && closedSections.includes(active.title)) {
      applySections(closedSections.filter((t) => t !== active.title));
    }
  }, [pathname, visibleSections, closedSections]);

  // ── T-51: badge WhatsApp dinámico (contador real de la cola) ────
  const { data: waStats } = useQuery({
    queryKey: ["whatsapp-queue-stats"],
    queryFn: () => api.getWhatsAppQueueStats(),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const badgeFor = (item: NavItem): string | undefined => {
    if (item.href === "/dashboard/whatsapp") {
      return waStats && waStats.pending > 0 ? String(waStats.pending) : undefined;
    }
    return item.badge;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-white font-bold text-sm">
          AO
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">
              AutomotiveOS
            </span>
            <span className="text-[10px] text-sidebar-foreground/60">
              ERP Taller
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {visibleSections.map((section) => {
          const sectionClosed = !collapsed && closedSections.includes(section.title);
          return (
          <div key={section.title}>
            {!collapsed && (
              <button
                type="button"
                onClick={() => toggleSection(section.title)}
                aria-expanded={!sectionClosed}
                className="mb-2 flex w-full items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "h-3 w-3 shrink-0 transition-transform duration-150",
                    sectionClosed && "-rotate-90",
                  )}
                  aria-hidden="true"
                />
                {section.title}
              </button>
            )}
            {!sectionClosed && (
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && !!pathname && pathname.startsWith(item.href + "/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-sidebar-accent text-orange-400"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-orange-500" aria-hidden="true" />
                    )}

                    <item.icon className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-150",
                      isActive && "scale-110"
                    )} />

                    {!collapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {badgeFor(item) && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                            {badgeFor(item)}
                          </span>
                        )}
                      </>
                    )}

                    {/* Collapsed tooltip */}
                    {collapsed && (
                      <div
                        className="absolute left-full ml-2 hidden group-hover:flex items-center px-2.5 py-1.5 rounded-md bg-popover text-popover-foreground text-xs font-medium shadow-md border z-50 whitespace-nowrap"
                        role="tooltip"
                      >
                        {item.label}
                        {badgeFor(item) && (
                          <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white">
                            {badgeFor(item)}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
            )}
          </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="mr-2 h-4 w-4" />
              <span className="text-xs">Colapsar</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
