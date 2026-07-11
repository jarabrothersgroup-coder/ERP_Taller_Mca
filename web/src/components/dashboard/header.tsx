"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, Bell, LogOut, User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function DashboardHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: session } = useSession();
  const user = session?.user;
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??";

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
            {user?.tenantSlug || "demo"}
          </span>
        </div>
      </div>

      {/* Right: Notifications + User + Logout */}
      <div className="flex items-center gap-2">
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
            <span className="text-xs font-medium">{user?.name || "Usuario"}</span>
            <span className="text-[10px] text-muted-foreground capitalize">
              {user?.role || "user"}
            </span>
          </div>
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
          className="text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
