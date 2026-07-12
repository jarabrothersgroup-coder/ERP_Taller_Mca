import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import type { OrderStatus } from "./types";

export const technicians = ["Carlos M.", "Ana R.", "Luis M.", "Pedro G.", "Sofía L."];

export const statusConfig: Record<OrderStatus, { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "default"; icon: React.ElementType }> = {
  pending: { label: "Pendiente", variant: "secondary", icon: Clock },
  budgeted: { label: "Presupuestado", variant: "default", icon: Wrench },
  in_progress: { label: "En Progreso", variant: "warning", icon: Wrench },
  quality: { label: "Control Calidad", variant: "warning", icon: AlertTriangle },
  ready: { label: "Listo", variant: "success", icon: CheckCircle2 },
  completed: { label: "Completado", variant: "success", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", variant: "destructive", icon: X },
};

export const statusColors: Record<OrderStatus, "secondary" | "warning" | "success" | "destructive" | "default"> = {
  pending: "secondary",
  budgeted: "default",
  in_progress: "warning",
  quality: "warning",
  ready: "success",
  completed: "success",
  cancelled: "destructive",
};
