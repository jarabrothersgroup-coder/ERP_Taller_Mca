"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Car, Calendar, Wrench, FileText, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/portal/dashboard", icon: Home },
  { label: "Servicios", href: "/portal/servicios", icon: Wrench },
  { label: "Agendar Turno", href: "/portal/booking", icon: Calendar, accent: true },
  { label: "Órdenes", href: "/portal/ordenes", icon: FileText },
  { label: "Facturas", href: "/portal/facturas", icon: FileText },
];

export function PortalMobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Close on route change
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Hamburger button */}
      <button
        className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors relative z-50"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
      >
        {open ? (
          <X className="h-5 w-5 text-foreground" />
        ) : (
          <Menu className="h-5 w-5 text-foreground" />
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-72 bg-white dark:bg-slate-950 border-l border-border shadow-2xl z-50 md:hidden",
          "transform transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold text-xs shadow-sm">
              AO
            </div>
            <span className="text-sm font-semibold">Menú</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
                const isActive = pathname === item.href || (!!pathname && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  item.accent
                    ? "bg-orange-500 text-white hover:bg-orange-600 shadow-sm shadow-orange-500/20"
                    : isActive
                      ? "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", item.accent && "text-white")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* CTA at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border/40">
          <Link
            href="/portal/booking"
            className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all active:scale-[0.98]"
          >
            <Car className="h-4 w-4" />
            Agendar Turno
          </Link>
        </div>
      </div>
    </>
  );
}
