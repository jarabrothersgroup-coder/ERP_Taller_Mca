import type { Metadata } from "next";
import Link from "next/link";
import { Car } from "lucide-react";

export const metadata: Metadata = {
  title: "Portal del Cliente — AutomotiveOS",
  description: "Consulta el estado de tus vehículos y órdenes de trabajo",
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Simple public header */}
      <header className="border-b border-border/40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
          <Link href="/portal/dashboard" className="flex items-center gap-2 font-semibold text-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white font-bold text-xs">
              AO
            </div>
            <span className="hidden sm:inline">AutomotiveOS</span>
            <span className="text-muted-foreground">· Portal</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Car className="h-3.5 w-3.5" />
            <span>Taller Mecánico</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        {children}
      </main>

      {/* Simple footer */}
      <footer className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground">
        <p>AutomotiveOS ERP — Portal del Cliente</p>
      </footer>
    </div>
  );
}
