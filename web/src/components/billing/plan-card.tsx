"use client";

import * as React from "react";
import { Check, Crown, Zap, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthlyPyg: number;
  priceAnnualPyg: number | null;
  maxUsers: number;
  maxBranches: number;
  features: Record<string, boolean> | null;
  isActive: boolean;
  sortOrder: number;
}

const planIcons: Record<string, React.ElementType> = {
  STARTER: Zap,
  PRO: Star,
  ENTERPRISE: Crown,
};

const planColors: Record<string, string> = {
  STARTER: "border-blue-200 dark:border-blue-800",
  PRO: "border-orange-200 dark:border-orange-800",
  ENTERPRISE: "border-violet-200 dark:border-violet-800",
};

const featureLabels: Record<string, string> = {
  sifen: "Facturación Electrónica (SIFEN)",
  accounting: "Contabilidad Doble Partida",
  whatsapp: "WhatsApp Business",
  analytics: "Analytics Avanzado",
  fleet: "Gestión de Flotas",
  clientPortal: "Portal de Clientes",
  apiAccess: "Acceso API",
  prioritySupport: "Soporte Prioritario",
};

export function PlanCard({
  plan,
  isCurrentPlan,
  isAnnual,
  onSelect,
}: {
  plan: Plan;
  isCurrentPlan?: boolean;
  isAnnual: boolean;
  onSelect: (planId: string) => void;
}) {
  const Icon = planIcons[plan.code] || Zap;
  const price = (isAnnual ? plan.priceAnnualPyg : plan.priceMonthlyPyg) ?? plan.priceMonthlyPyg;
  const period = isAnnual ? "/año" : "/mes";
  const color = planColors[plan.code] || "";
  const isEnterprise = plan.code === "ENTERPRISE";

  return (
    <Card className={cn("relative", color, isCurrentPlan && "ring-2 ring-primary")}>
      {isEnterprise && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge variant="default" className="bg-violet-600 hover:bg-violet-600 px-3">
            <Crown className="h-3 w-3 mr-1" />
            Más Popular
          </Badge>
        </div>
      )}
      <CardHeader className="text-center pb-2">
        <div className={cn("mx-auto flex h-12 w-12 items-center justify-center rounded-xl mb-2", isEnterprise ? "bg-violet-500/10" : "bg-muted")}>
          <Icon className={cn("h-6 w-6", isEnterprise ? "text-violet-500" : "text-muted-foreground")} />
        </div>
        <CardTitle className="text-lg">{plan.name}</CardTitle>
        {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
      </CardHeader>
      <CardContent className="text-center">
        <div className="mb-4">
          <span className="text-3xl font-bold">₲ {price.toLocaleString("es-PY")}</span>
          <span className="text-sm text-muted-foreground ml-1">{period}</span>
        </div>

        <div className="space-y-2 mb-6 text-left">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Hasta {plan.maxUsers} usuarios · {plan.maxBranches} sucursal{plan.maxBranches > 1 ? "es" : ""}
          </div>
          {plan.features && Object.entries(featureLabels).map(([key, label]) => {
            const enabled = plan.features?.[key];
            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                <Check className={cn("h-4 w-4", enabled ? "text-emerald-500" : "text-muted-foreground/30")} />
                <span className={cn(enabled ? "text-foreground" : "text-muted-foreground/50")}>{label}</span>
              </div>
            );
          })}
        </div>

        <Button
          className={cn("w-full", isEnterprise && "bg-violet-600 hover:bg-violet-700")}
          variant={isCurrentPlan ? "outline" : "default"}
          disabled={isCurrentPlan}
          onClick={() => onSelect(plan.id)}
        >
          {isCurrentPlan ? "Plan Actual" : "Seleccionar Plan"}
        </Button>
      </CardContent>
    </Card>
  );
}
