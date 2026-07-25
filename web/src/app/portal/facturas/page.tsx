"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  FileText,
  Search,
  Download,
  CreditCard,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

function getSession(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("portal_session");
}

export default function PortalFacturasPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"success" | "cancelled" | null>(null);

  // Check URL for payment status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setPaymentStatus("success");
      window.history.replaceState({}, "", "/portal/facturas");
    } else if (params.get("payment") === "cancelled") {
      setPaymentStatus("cancelled");
      window.history.replaceState({}, "", "/portal/facturas");
    }
  }, []);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/portal/login");
      return;
    }

    const fetchInvoices = async () => {
      try {
        const data = await api.request<any[]>("/portal/invoices", {
          headers: { "X-Portal-Session": session },
        });
        setInvoices(data || []);
      } catch (err: any) {
        if (err?.status === 401) {
          localStorage.removeItem("portal_session");
          router.push("/portal/login");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [router]);

  const handlePay = async (facturaId: string) => {
    const session = getSession();
    if (!session) return;

    setPayingId(facturaId);
    try {
      const result = await api.createPortalPaymentLink(facturaId, "STRIPE");
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al generar link de pago";
      // Toast not available in portal — use ErrorBoundary or inline feedback
      console.error("Payment link error:", msg);
    } finally {
      setPayingId(null);
    }
  };

  const filtered = search
    ? invoices.filter(
        (inv) =>
          (inv.numeroFacturaManual || inv.id || "").toLowerCase().includes(search.toLowerCase()),
      )
    : invoices;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/portal/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Facturas</h1>
          <p className="text-xs text-muted-foreground">Historial de facturación</p>
        </div>
      </div>

      {/* Payment status feedback */}
      {paymentStatus === "success" && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/30">
          <CardContent className="py-3 flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Pago procesado exitosamente
          </CardContent>
        </Card>
      )}
      {paymentStatus === "cancelled" && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="py-3 flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
            <AlertCircle className="h-4 w-4" />
            Pago cancelado — podés intentar nuevamente cuando quieras
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar factura..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                {search ? "No se encontraron facturas" : "No hay facturas registradas"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((inv: any) => {
                const isPaid = inv.estadoPago === "PAGADO" || inv.estadoPago === "PAGADA";
                const isPaying = payingId === inv.id;

                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="rounded-full bg-muted p-2 shrink-0">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {inv.numeroFacturaManual || `Factura #${inv.id.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(inv.createdAt).toLocaleDateString("es-PY")} · ₲{" "}
                          {Number(inv.total).toLocaleString("es-PY")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {inv.sifenCdc && (
                        <Badge variant="outline" className="text-[10px] font-mono text-green-600 border-green-300">
                          CDC
                        </Badge>
                      )}
                      <Badge
                        variant={isPaid ? "default" : "secondary"}
                        className={cn(
                          "text-[10px]",
                          isPaid ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""
                        )}
                      >
                        {isPaid ? "Pagada" : "Pendiente"}
                      </Badge>
                      {!isPaid && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={isPaying}
                          onClick={() => handlePay(inv.id)}
                        >
                          <CreditCard className="h-3 w-3" />
                          {isPaying ? "Redirigiendo..." : "Pagar"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
