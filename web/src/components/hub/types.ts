import { Clock, Star, Wrench, Search, CheckCircle2 } from "lucide-react";
import type { ElementType } from "react";

/* ── Work order type ──────────────────────── */

export interface KanbanOT {
  id: string;
  vehicleId: string;
  clientId: string;
  description: string | null;
  status: string;
  totalCost: string | null;
  createdAt: string;
  vehicleName?: string;
  plate?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  hvAlert?: boolean;
  services?: any[];
  repuestos?: any[];
  trabajosTerceros?: any[];
}

/* ── Status flow config ───────────────────── */

export interface StatusConfigItem {
  key: string;
  label: string;
  icon: ElementType;
  color: string;
  bg: string;
  border: string;
  dot: string;
}

export const STATUS_FLOW: StatusConfigItem[] = [
  { key: "Presupuestado", label: "Presupuestado", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-800/30", dot: "bg-yellow-500" },
  { key: "Aprobado", label: "Aprobado", icon: Star, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800/30", dot: "bg-blue-500" },
  { key: "En_Proceso", label: "En Proceso", icon: Wrench, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800/30", dot: "bg-indigo-500" },
  { key: "Control_Calidad", label: "Control Calidad", icon: Search, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800/30", dot: "bg-purple-500" },
  { key: "Listo", label: "Listo", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800/30", dot: "bg-green-500" },
];

/* ── Helpers ───────────────────────────────── */

export function getStatusConfig(status: string): StatusConfigItem {
  return STATUS_FLOW.find(s => s.key === status) || STATUS_FLOW[0];
}

export function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value || 0);
  return `₲ ${num.toLocaleString("es-PY")}`;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
