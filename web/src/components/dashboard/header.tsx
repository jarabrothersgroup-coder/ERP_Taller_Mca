"use client";

import * as React from "react";
import { Menu, Bell, Search, ChevronDown, Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function DashboardHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const [tenant] = React.useState("Taller El Chero");

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 lg:px-6">
      {/* Left: Mobile menu + Tenant */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Separator orientation="vertical" className="h-6 lg:hidden" />

        {/* Tenant Switcher */}
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 hover:bg-accent cursor-pointer transition-colors">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium hidden sm:inline">{tenant}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      {/* Right: Search + Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <Button variant="ghost" size="icon" className="hidden md:flex">
          <Search className="h-4 w-4" />
        </Button>

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

        {/* User Avatar */}
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer transition-colors">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            JJ
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-medium">Juan Jara</span>
            <span className="text-[10px] text-muted-foreground">Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
