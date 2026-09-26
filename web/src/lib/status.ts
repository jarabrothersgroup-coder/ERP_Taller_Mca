/**
 * Unified Order Status Configuration — AutomotiveOS Operations Hub.
 *
 * Single source of truth for work order status mappings across backend and
 * frontend. Consolidates previously scattered definitions:
 *   - WHATSAPP_STATUS_MAP (orden.service.ts)
 *   - STATUS_LABELS (orden.service.ts)
 *   - STATUS_FLOW / TERMINAL_STATUS (components/hub/types.ts)
 *   - statusConfig / statusColors (dashboard/taller/status-config.ts)
 *
 * Import from here instead of duplicating status logic in multiple modules.
 *
 * @module lib/status
 */

import { Clock, Star, Wrench, Search, CheckCircle2 } from "lucide-react";

/** Canonical UI status values (matches frontend OrderStatus type). */
export const ORDER_STATUS = [
  "pending",
  "budgeted",
  "in_progress",
  "quality",
  "ready",
  "completed",
] as const;

/** The terminal/delivered state — excluded from active board queries. */
export const TERMINAL_STATUS = "completed" as const;

/** Non-terminal statuses shown on the Kanban board. */
export const BOARD_STATUSES = ORDER_STATUS.filter(s => s !== TERMINAL_STATUS);

/** Mapping from backend Spanish status names to UI English status names. */
export const BACKEND_TO_UI_STATUS: Record<string, (typeof ORDER_STATUS)[number]> = {
  Presupuestado: "budgeted",
  Aprobado: "in_progress",
  En_Proceso: "in_progress",
  Control_Calidad: "quality",
  Listo: "ready",
  Finalizado_Retirado: "completed",
};

/** Human-readable labels for each UI status. */
export const STATUS_LABELS: Record<(typeof ORDER_STATUS)[number], string> = {
  pending: "Pendiente",
  budgeted: "Presupuestado",
  in_progress: "En reparación",
  quality: "Control de calidad",
  ready: "Listo para entrega",
  completed: "Finalizado — Retirado",
};

/** WhatsApp template keys mapped from UI statuses. */
export const WHATSAPP_STATUS_MAP: Record<(typeof ORDER_STATUS)[number], string> = {
  pending: "PRESUPUESTADO",
  budgeted: "EN_REPARACION",
  in_progress: "EN_REPARACION",
  quality: "EN_REPARACION",
  ready: "LISTO_ENTREGA",
  completed: "FINALIZADO_RETIRADO",
};

/** Status flow order for the Kanban board (left to right). */
export const STATUS_FLOW = [
  { key: "budgeted", label: "Presupuestado", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-800/30", dot: "bg-yellow-500" },
  { key: "in_progress", label: "En Proceso", icon: Wrench, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800/30", dot: "bg-indigo-500" },
  { key: "quality", label: "Control Calidad", icon: Search, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800/30", dot: "bg-purple-500" },
  { key: "ready", label: "Listo", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800/30", dot: "bg-green-500" },
];

/** Visual configuration for status badges. */
export const statusConfig: Record<string, {
  label: string;
  variant: "secondary" | "warning" | "success" | "destructive" | "default";
  icon: React.ElementType;
}> = {
  pending: { label: "Pendiente", variant: "default", icon: Clock },
  budgeted: { label: "Presupuestado", variant: "default", icon: Clock },
  in_progress: { label: "En Progreso", variant: "warning", icon: Wrench },
  quality: { label: "Control Calidad", variant: "warning", icon: Search },
  ready: { label: "Listo", variant: "success", icon: CheckCircle2 },
  completed: { label: "Completado", variant: "success", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", variant: "destructive", icon: Clock },
};

/** Status colors for visual indicators. */
export const statusColors: Record<string, "secondary" | "warning" | "success" | "destructive" | "default"> = {
  pending: "default",
  budgeted: "default",
  in_progress: "warning",
  quality: "warning",
  ready: "success",
  completed: "success",
  cancelled: "destructive",
};

/**
 * Get the display label for a status.
 * Falls back to the status key if not found.
 */
export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status;
}

/**
 * Get the config for a status.
 * Falls back to the first status (budgeted) if not found.
 */
export function getStatusConfig(status: string): (typeof STATUS_FLOW)[number] {
  return STATUS_FLOW.find(s => s.key === status) ?? STATUS_FLOW[0];
}

/**
 * Check if a status is a terminal state (vehicle delivered).
 */
export function isTerminalStatus(status: string): boolean {
  return status === TERMINAL_STATUS;
}

/**
 * Check if a status should appear on the active Kanban board.
 */
export function isBoardStatus(status: string): boolean {
  return BOARD_STATUSES.includes(status as (typeof BOARD_STATUSES)[number]);
}

/**
 * Convert a backend status (Spanish) to UI status (English).
 */
export function toUiStatus(backendStatus: string): (typeof ORDER_STATUS)[number] {
  return BACKEND_TO_UI_STATUS[backendStatus] ?? "pending";
}

/**
 * Convert a UI status (English) to backend status (Spanish).
 */
export function toBackendStatus(uiStatus: string): string {
  const reverseMap: Record<string, string> = {};
  for (const [backend, ui] of Object.entries(BACKEND_TO_UI_STATUS)) {
    reverseMap[ui] = backend;
  }
  return reverseMap[uiStatus] ?? uiStatus;
}
