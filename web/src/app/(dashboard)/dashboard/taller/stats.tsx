import {
  Wrench,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkOrder } from "./types";

export function WorkshopStats({ orders }: { orders: WorkOrder[] }) {
  const active = orders.filter((o) => o.status === "in_progress" || o.status === "quality").length;
  const pending = orders.filter((o) => o.status === "pending" || o.status === "budgeted").length;
  const completed = orders.filter((o) => o.status === "completed" || o.status === "ready").length;
  const totalCost = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((acc, o) => acc + o.estimatedCost, 0);

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">En Progreso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{active}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{pending}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Completadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{completed}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Fact. Estimada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold">₲ {(totalCost / 1_000_000).toFixed(1)}M</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
