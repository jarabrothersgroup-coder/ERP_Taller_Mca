import type { Metadata } from "next";
import Link from "next/link";
import { Car, Phone, MapPin, Clock, Menu, X } from "lucide-react";
import { PortalMobileNav } from "./portal-mobile-nav";

export const metadata: Metadata = {
  title: "Portal del Cliente — AutomotiveOS",
  description: "Consulta el estado de tus vehículos, órdenes de trabajo y agendá tu turno",
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Modern header with contact info */}
      <header className="border-b border-border/40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-4">
          {/* Top bar - contact info (hidden on mobile) */}
          <div className="hidden md:flex items-center justify-end gap-6 py-1.5 text-[11px] text-muted-foreground border-b border-border/30">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" />
              <span>+595 21 123 4567</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              <span>Asunción, Paraguay</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>Lun-Sáb 8:00 - 17:00</span>
            </div>
          </div>
          
          {/* Main nav */}
          <div className="flex h-14 items-center justify-between">
            <Link href="/portal/dashboard" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold text-sm shadow-md shadow-orange-500/20 group-hover:shadow-lg group-hover:shadow-orange-500/30 transition-shadow">
                AO
              </div>
              <div className="hidden sm:block">
                <span className="text-sm font-semibold text-foreground block leading-tight">AutomotiveOS</span>
                <span className="text-[10px] text-muted-foreground">Portal del Cliente</span>
              </div>
            </Link>
            
            {/* Nav links - desktop */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/portal/dashboard"
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
              >
                Dashboard
              </Link>
              <Link
                href="/portal/servicios"
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
              >
                Servicios
              </Link>
              <Link
                href="/portal/ordenes"
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
              >
                Órdenes
              </Link>
              <Link
                href="/portal/facturas"
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
              >
                Facturas
              </Link>
            </nav>
            
            {/* CTA + mobile menu */}
            <div className="flex items-center gap-3">
              <Link
                href="/portal/booking"
                className="hidden sm:inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow-md hover:shadow-orange-500/20 active:scale-[0.98]"
              >
                <Car className="h-4 w-4" />
                Agendar Turno
              </Link>
              
              {/* Mobile hamburger */}
              <PortalMobileNav />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>

      {/* Modern footer */}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-white font-bold text-xs">
                  AO
                </div>
                <span className="font-semibold text-sm">AutomotiveOS</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sistema ERP especializado para talleres mecánicos automotrices en Paraguay.
              </p>
            </div>
            
            {/* Quick links */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Enlaces Rápidos
              </h4>
              <ul className="space-y-2 text-xs">
                <li><Link href="/portal/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link></li>
                <li><Link href="/portal/servicios" className="text-muted-foreground hover:text-foreground transition-colors">Servicios</Link></li>
                <li><Link href="/portal/booking" className="text-muted-foreground hover:text-foreground transition-colors">Agendar Turno</Link></li>
                <li><Link href="/portal/ordenes" className="text-muted-foreground hover:text-foreground transition-colors">Mis Órdenes</Link></li>
                <li><Link href="/portal/facturas" className="text-muted-foreground hover:text-foreground transition-colors">Mis Facturas</Link></li>
              </ul>
            </div>
            
            {/* Contact */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Contacto
              </h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  +595 21 123 4567
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  Asunción, Paraguay
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Lun-Sáb 8:00 - 17:00
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-border/40 text-center text-[11px] text-muted-foreground">
            © 2025 AutomotiveOS. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
