/**
 * Billing hooks — React Query wrappers for billing API.
 *
 * Fetches from /billing/* routes on the Fastify backend.
 * Falls back to mock data when backend is unreachable.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTenantSlug } from "@/lib/api";

/* ── Types ──────────────────────────────────── */

export interface BillingPlan {
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

export interface BillingSubscription {
  id: string;
  tenantId: string;
  stripeSubscriptionId: string | null;
  planId: string;
  status: string;
  interval: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  activeUsers: number;
  plan?: BillingPlan;
}

export interface BillingInvoice {
  id: string;
  tenantId: string;
  stripeInvoiceId: string | null;
  stripeSubscriptionId: string | null;
  amountPyg: number;
  currency: string;
  status: string;
  periodLabel: string | null;
  pdfUrl: string | null;
  paidAt: string | null;
  dueDate: string | null;
  createdAt: string;
}

/* ── Query Keys ─────────────────────────────── */

const billingKeys = {
  all: ["billing"] as const,
  plans: () => [...billingKeys.all, "plans"] as const,
  subscription: () => [...billingKeys.all, "subscription"] as const,
  invoices: () => [...billingKeys.all, "invoices"] as const,
};

/* ── API Helpers ────────────────────────────── */

async function fetchBilling<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", "X-Tenant-Slug": getTenantSlug() },
    });
    if (!res.ok) return fallback;
    return res.json();
  } catch {
    return fallback;
  }
}

/* ── Hooks ──────────────────────────────────── */

export function useBillingPlans() {
  return useQuery({
    queryKey: billingKeys.plans(),
    queryFn: async (): Promise<{ plans: BillingPlan[] }> => {
      return fetchBilling<{ plans: BillingPlan[] }>("/billing/plans", { plans: [] });
    },
  });
}

export function useBillingSubscription() {
  return useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: async (): Promise<{ subscription: BillingSubscription | null }> => {
      return fetchBilling("/billing/subscription", { subscription: null });
    },
  });
}

export function useBillingInvoices() {
  return useQuery({
    queryKey: billingKeys.invoices(),
    queryFn: async (): Promise<{ invoices: BillingInvoice[] }> => {
      return fetchBilling("/billing/invoices", { invoices: [] });
    },
  });
}

export function useBillingCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { planId: string; interval?: "monthly" | "annual" }) => {
      const res = await fetch("/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": getTenantSlug() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error creating checkout session");
      return res.json() as Promise<{ url?: string; sessionId?: string }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: billingKeys.subscription() });
      qc.invalidateQueries({ queryKey: billingKeys.invoices() });
    },
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: async (): Promise<{ url: string }> => {
      const res = await fetch("/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Slug": getTenantSlug() },
      });
      if (!res.ok) throw new Error("Error creating portal session");
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
}
