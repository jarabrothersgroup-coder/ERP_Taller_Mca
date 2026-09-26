import type { ElementType } from "react";

/* ── Technician type — canonical payload shape re-exported from api client ── */
export type { Tecnico } from "@/lib/api";

/* ── Re-export unified status config from lib/status.ts ── */
export { ORDER_STATUS, TERMINAL_STATUS, BOARD_STATUSES, STATUS_LABELS, WHATSAPP_STATUS_MAP, STATUS_FLOW, statusConfig, statusColors, getStatusLabel, getStatusConfig, isTerminalStatus, isBoardStatus, toUiStatus, toBackendStatus } from "@/lib/status";

/* ── Local import for type alias ── */
import { STATUS_FLOW as STATUS_FLOW_TYPE } from "@/lib/status";

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
  /** Mechanic (profile id) assigned to this OT — powers the technician filter */
  assignedTo?: string | null;
  /** Board payloads (GET /workshop/hub/board) pre-join these as vehiculo/cliente */
  vehiculo?: string | null;
  cliente?: string | null;
  services?: any[];
  repuestos?: any[];
  trabajosTerceros?: any[];
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

// Legacy type alias for backward compatibility
export type StatusConfigItem = typeof STATUS_FLOW_TYPE[0];
