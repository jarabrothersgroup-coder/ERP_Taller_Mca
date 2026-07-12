import {
  Building2,
  AlertTriangle,
  Banknote,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CUentaRecord, MovimientoRecord, CxcRecord } from "./columns";

export function TreasuryStats({ cuentas, movimientos, cxc }: { cuentas: CUentaRecord[]; movimientos: MovimientoRecord[]; cxc: CxcRecord[] }) {
  const totalCuentas = cuentas.filter((c) => c.activo).length;
  const saldoTotalPYG = cuentas
    .filter((c) => c.moneda === "PYG" && c.activo)
    .reduce((sum, c) => sum + c.saldoActual, 0);
  const movimientosMes = movimientos.length;
  const saldoPendienteCxc = cxc.filter((c) => c.saldo > 0).reduce((sum, c) => sum + c.saldo, 0);

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Cuentas Activas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{totalCuentas}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Total (PYG)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold">₲ {(saldoTotalPYG / 1_000_000).toFixed(1)}M</p>
          </div>
          {cuentas.some((c) => c.moneda === "USD" && c.activo) && (
            <p className="text-xs text-muted-foreground mt-1">
              + ${cuentas.filter((c) => c.moneda === "USD" && c.activo).reduce((s, c) => s + c.saldoActual, 0).toLocaleString("es-PY")} USD
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{movimientosMes}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Registrados</p>
        </CardContent>
      </Card>
      <Card className={cn(saldoPendienteCxc > 0 && "border-amber-200 dark:border-amber-800")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            CxC Pendiente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", saldoPendienteCxc > 0 && "text-amber-500")}>
            ₲ {(saldoPendienteCxc / 1_000_000).toFixed(1)}M
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
