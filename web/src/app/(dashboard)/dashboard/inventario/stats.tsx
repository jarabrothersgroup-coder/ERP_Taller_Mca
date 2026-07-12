import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UIMappedInventoryItem as InventoryItem } from "@/lib/data-service";

export const statusColors: Record<InventoryItem["status"], "success" | "warning" | "destructive"> = {
  ok: "success",
  low: "warning",
  critical: "destructive",
};

export const statusLabels: Record<InventoryItem["status"], string> = {
  ok: "Normal",
  low: "Stock Bajo",
  critical: "Crítico",
};

export function InventoryStats({ items }: { items: InventoryItem[] }) {
  const totalItems = items.length;
  const totalValue = items.reduce((acc, item) => acc + item.stock * item.price, 0);
  const lowStock = items.filter((i) => i.status === "low" || i.status === "critical").length;
  const critical = items.filter((i) => i.status === "critical").length;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{totalItems}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Valor Inventario</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">₲ {(totalValue / 1_000_000).toFixed(1)}M</p>
        </CardContent>
      </Card>
      <Card className={cn(lowStock > 0 && "border-amber-200 dark:border-amber-800")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            Stock Bajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", lowStock > 0 && "text-amber-500")}>{lowStock}</p>
        </CardContent>
      </Card>
      <Card className={cn(critical > 0 && "border-destructive/30")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
            Crítico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-2xl font-bold", critical > 0 && "text-destructive")}>{critical}</p>
        </CardContent>
      </Card>
    </div>
  );
}
