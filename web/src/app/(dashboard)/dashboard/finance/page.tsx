"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard, Receipt, DollarSign, ArrowRight } from "lucide-react";

const modules = [
  {
    href: "/dashboard/finance/pagos-online",
    title: "Pagos Online",
    description: "Generar links de pago Stripe y PagosPy para facturas",
    icon: CreditCard,
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
  {
    href: "/dashboard/facturacion",
    title: "Facturación",
    description: "Gestión de facturas y cobranza",
    icon: Receipt,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  {
    href: "/dashboard/tesoreria",
    title: "Tesorería",
    description: "Cuentas bancarias, movimientos y conciliación",
    icon: DollarSign,
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
];

export default function FinancePage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finanzas</h1>
        <p className="text-sm text-muted-foreground">Gestión financiera del taller</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link key={mod.href} href={mod.href}>
              <Card className="transition-all duration-200 hover:shadow-md hover:border-foreground/20 group h-full cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2.5 border ${mod.color} transition-transform group-hover:scale-110`}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{mod.title}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{mod.description}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    <span>Acceder</span>
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
