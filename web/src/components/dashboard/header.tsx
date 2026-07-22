"use client";

import * as React from "react";
import { useAuth } from "@/components/providers/session-provider";
import { Menu, Bell, LogOut, ChevronDown, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/providers/theme-provider";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

/* ── Theme Toggle Button ────────────────────── */

function ThemeToggleButton() {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return <div className="h-9 w-9" />; // Placeholder to prevent layout shift
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="text-muted-foreground hover:text-foreground transition-colors"
      aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}

/* ── Header ──────────────────────────────────── */

export function DashboardHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();
  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "??";

  const displayName = user?.fullName || user?.email || "Usuario";
  const role = user?.role || "user";

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 lg:px-6">
      {/* Left: Mobile menu + Tenant */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Separator orientation="vertical" className="h-6 lg:hidden" />

        {/* Tenant badge */}
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5">
          <span className="text-sm font-medium hidden sm:inline capitalize">
            {user?.tenantName || "demo"}
          </span>
        </div>
      </div>

      {/* Right: Theme Toggle + Notifications + User + Logout */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <ThemeToggleButton />

        {/* Locale Switcher */}
        <LocaleSwitcher />

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <Badge
            variant="destructive"
            className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[9px]"
          >
            3
          </Badge>
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* User Avatar + Name */}
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer transition-colors group relative">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-primary-foreground text-xs font-bold shadow-sm">
            {initials}
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-medium">{displayName}</span>
            <span className="text-[10px] text-muted-foreground capitalize">
              {role}
            </span>
          </div>
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          className="text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
