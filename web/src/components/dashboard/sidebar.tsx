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
  Shield,
  Truck,
  Users,
  ChevronLeft,
  ChevronRight,
  Car,
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
      { label: "Inventario", href: "/dashboard/inventario", icon: Package },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { label: "Facturación", href: "/dashboard/facturacion", icon: DollarSign },
      { label: "Contabilidad", href: "/dashboard/contabilidad", icon: FileText },
      { label: "Tesorería", href: "/dashboard/tesoreria", icon: DollarSign },
    ],
  },
  {
    title: "Operaciones",
    items: [
      { label: "Calendario", href: "/dashboard/calendario", icon: Calendar },
      { label: "WhatsApp", href: "/dashboard/whatsapp", icon: MessageSquare, badge: "3" },
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Usuarios", href: "/dashboard/usuarios", icon: Users },
      { label: "Vehículos", href: "/dashboard/vehiculos", icon: Car },
      { label: "Seguridad", href: "/dashboard/seguridad", icon: Shield },
      { label: "Flotas", href: "/dashboard/flotas", icon: Truck },
      { label: "Configuración", href: "/dashboard/config", icon: Settings },
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
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-orange-400"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
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
