"use client";

import * as React from "react";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowRight,
  Receipt,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useBillingPlans, useBillingSubscription, useBillingInvoices, useBillingCheckout, useBillingPortal } from "@/hooks/use-billing";
import { PlanCard } from "@/components/billing/plan-card";
import { InvoiceTable } from "@/components/billing/invoice-table";

export default function BillingPage() {
  const { data: plansData, isLoading: plansLoading } = useBillingPlans();
  const { data: subData, isLoading: subLoading } = useBillingSubscription();
  const { data: invoicesData, isLoading: invoicesLoading } = useBillingInvoices();
  const checkoutMutation = useBillingCheckout();
  const portalMutation = useBillingPortal();
  const [isAnnual, setIsAnnual] = React.useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      setCheckoutSuccess(true);
      setTimeout(() => setCheckoutSuccess(false), 5000);
    }
  }, []);

  const plans = plansData?.plans ?? [];
  const subscription = subData?.subscription;
  const invoices = invoicesData?.invoices ?? [];
  const loading = plansLoading || subLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-violet-500" aria-hidden="true" />
            Suscripción y Facturación
          </h1>
          <p className="text-sm text-muted-foreground">Gestioná tu plan, método de pago y historial de facturación</p>
        </div>
      </div>

      {/* Success alert */}
      {checkoutSuccess && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>¡Pago procesado!</AlertTitle>
          <AlertDescription>Tu suscripción ha sido actualizada exitosamente.</AlertDescription>
        </Alert>
      )}

      {/* Current Subscription */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" aria-hidden="true" />
              Plan Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold">{subscription.plan?.name ?? "Plan Desconocido"}</p>
                  <p className="text-sm text-muted-foreground">
                    {subscription.status === "active" ? "Activo" : subscription.status} · {subscription.interval === "annual" ? "Anual" : "Mensual"}
                  </p>
                  {subscription.currentPeriodEnd && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Próxima facturación: {new Date(subscription.currentPeriodEnd).toLocaleDateString("es-PY")}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={subscription.status === "active" ? "success" : "secondary"}>
                    {subscription.status === "active" ? "Activo" : subscription.status}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => portalMutation.mutate()}
                    loading={portalMutation.isPending}
                  >
                    <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                    Gestionar
                  </Button>
                </div>
              </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Interval Toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={cn("text-sm", !isAnnual && "font-medium text-foreground")}>Mensual</span>
        <button
          className={cn("relative h-6 w-11 rounded-full transition-colors", isAnnual ? "bg-primary" : "bg-muted")}
          onClick={() => setIsAnnual(!isAnnual)}
          aria-label={`Cambiar a facturación ${isAnnual ? "mensual" : "anual"}`}
        >
          <div className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", isAnnual ? "translate-x-5" : "translate-x-0.5")} />
        </button>
        <span className={cn("text-sm", isAnnual && "font-medium text-foreground")}>
          Anual
          <Badge variant="success" className="ml-1.5 text-[10px]">Ahorra 17%</Badge>
        </span>
      </div>

      {/* Plan Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {plans
          .filter((p) => p.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={subscription?.planId === plan.id}
              isAnnual={isAnnual}
              onSelect={(planId) => {
                checkoutMutation.mutate(
                  { planId, interval: isAnnual ? "annual" : "monthly" },
                  {
                    onSuccess: (data) => {
                      if (data.url) {
                        window.location.href = data.url;
                      }
                    },
                  },
                );
              }}
            />
          ))}
      </div>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" aria-hidden="true" />
            Historial de Facturas
          </CardTitle>
          <CardDescription>Todas las facturas de tu suscripción</CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceTable invoices={invoices} />
        </CardContent>
      </Card>
    </div>
  );
}
