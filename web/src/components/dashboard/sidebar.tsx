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
  ShoppingCart,
  Timer,
  UserCheck,
  Brain,
  Warehouse,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Principal",
    items: [
      { label: "Panel de Control", href: "/dashboard", icon: LayoutDashboard },
      { label: "Taller", href: "/dashboard/taller", icon: Wrench },
      { label: "Recepción", href: "/dashboard/recepcion", icon: ClipboardCheck },
      { label: "Servicios", href: "/dashboard/servicios", icon: Wrench },
      { label: "Precios", href: "/dashboard/taller/precios", icon: TrendingUp },
      { label: "Flat Rate", href: "/dashboard/taller/flat-rate", icon: Timer },
      { label: "Asignación", href: "/dashboard/taller/asignacion", icon: UserCheck },
      { label: "Mecánicos", href: "/dashboard/taller/mecanicos", icon: Users },
      { label: "Clientes", href: "/dashboard/clientes", icon: Users },
      { label: "Inventario", href: "/dashboard/inventario", icon: Package },
      { label: "Mov. Stock", href: "/dashboard/inventario/movimientos", icon: RefreshCw },
      { label: "Órdenes Compra", href: "/dashboard/inventario/ordenes-compra", icon: ShoppingCart },
      { label: "Herramientas", href: "/dashboard/inventario/herramientas", icon: Wrench },
      { label: "Almacenes", href: "/dashboard/inventario/almacenes", icon: Warehouse },
      { label: "Conteo Cíclico", href: "/dashboard/inventario/conteo", icon: ClipboardCheck },
      { label: "TecDoc", href: "/dashboard/inventario/tecdoc", icon: Search },
      { label: "Proveedores", href: "/dashboard/taller/proveedores", icon: Truck },
    ],
  },
  {
    title: "Inteligencia",
    items: [
      { label: "Mant. Predictivo", href: "/dashboard/taller/predictive-ml", icon: Brain },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { label: "Facturación", href: "/dashboard/facturacion", icon: DollarSign },
      { label: "SIFEN", href: "/dashboard/finance/sifen", icon: FileText },
      { label: "Nota Crédito", href: "/dashboard/contabilidad/nota-credito", icon: Receipt },
      { label: "Contabilidad", href: "/dashboard/contabilidad", icon: Landmark },
      { label: "Tesorería", href: "/dashboard/tesoreria", icon: DollarSign },
      { label: "Presupuestos", href: "/dashboard/presupuestos", icon: PieChart },
      { label: "Consolidación", href: "/dashboard/finance/consolidation", icon: Building2 },
      { label: "Nómina", href: "/dashboard/nomina", icon: Calculator },
    ],
  },
  {
    title: "Operaciones",
    items: [
      { label: "Calendario", href: "/dashboard/calendario", icon: Calendar },
      { label: "CRM", href: "/dashboard/crm", icon: GitBranch },
      { label: "WhatsApp", href: "/dashboard/whatsapp", icon: MessageSquare, badge: "3" },
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { label: "Ejecutivo", href: "/dashboard/ejecutivo", icon: TrendingUp },
      { label: "DVI", href: "/dashboard/dvi", icon: ClipboardCheck },
      { label: "Thinkcar", href: "/dashboard/thinkcar", icon: Scan },
      { label: "Marketing", href: "/dashboard/marketing", icon: Megaphone },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Usuarios", href: "/dashboard/usuarios", icon: Users },
      { label: "Vehículos", href: "/dashboard/vehiculos", icon: Car },
      { label: "Seguridad", href: "/dashboard/seguridad", icon: Shield },
      { label: "Seguridad HW", href: "/dashboard/security-hw", icon: Fingerprint },
      { label: "Flotas", href: "/dashboard/flotas", icon: Truck },
      { label: "Enterprise", href: "/dashboard/enterprise", icon: Building2 },
      { label: "Impresión", href: "/dashboard/label-printing", icon: Printer },
      { label: "Backup", href: "/dashboard/backup", icon: Database },
      { label: "Configuración", href: "/dashboard/config", icon: Settings },
    ],
  },
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

export function DashboardSidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();

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
        {navSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <h4 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {section.title}
              </h4>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
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
                        {item.badge && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                            {item.badge}
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
                        {item.badge && (
                          <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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
