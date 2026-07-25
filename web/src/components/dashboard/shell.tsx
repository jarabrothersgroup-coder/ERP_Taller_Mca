"use client";

import * as React from "react";
import { useAuth } from "@/components/providers/session-provider";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";
import { setTenantSlug } from "@/lib/data-service";
import { useOnlineStatus, type ConnectionStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";

/* ── Connection Status Indicator ─────────── */

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  online: { label: "Conectado", color: "text-emerald-600", bg: "bg-emerald-500", icon: Wifi },
  offline: { label: "Sin conexión", color: "text-red-600", bg: "bg-red-500", icon: WifiOff },
  checking: { label: "Verificando…", color: "text-amber-600", bg: "bg-amber-500", icon: AlertTriangle },
};

function ConnectionIndicator() {
  const status = useOnlineStatus();
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  // Only show when offline or briefly after reconnection
  const [visible, setVisible] = React.useState(status !== "online");

  React.useEffect(() => {
    if (status !== "online") {
      setVisible(true);
    } else {
      // Show "back online" for 3 seconds then hide
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    }
  }, [status]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all duration-300",
        status === "online"
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : status === "offline"
            ? "bg-red-50 text-red-700 border border-red-200"
            : "bg-amber-50 text-amber-700 border border-amber-200",
      )}
      role="status"
      aria-live="polite"
    >
      <div className={cn("h-2 w-2 rounded-full animate-pulse", config.bg)} />
      <Icon className="h-4 w-4" />
      <span>{config.label}</span>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Sync tenant slug from auth session to data-service
  React.useEffect(() => {
    if (user?.tenantSlug) {
      setTenantSlug(user.tenantSlug);
    }
  }, [user]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop */}
      <aside
        className={`hidden lg:flex lg:flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        <DashboardSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </aside>

      {/* Sidebar — mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform duration-200 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <DashboardSidebar
          onToggle={() => setMobileOpen(false)}
        />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setMobileOpen(true)} />

        <main
          className="flex-1 overflow-y-auto p-4 lg:p-6"
          id="view-content"
        >
          {children}
        </main>
      </div>

      {/* Connection status indicator */}
      <ConnectionIndicator />
    </div>
  );
}
