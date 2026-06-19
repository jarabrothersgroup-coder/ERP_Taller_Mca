/**
 * WhatsApp Module — shared types & DTOs.
 *
 * Defines request/response schemas for WhatsApp integration
 * with Evolution API gateway.
 *
 * @module whatsapp/types
 */

// ─── Evolution API Types ────────────────────────

/** Connection status of the WhatsApp instance */
export type WhatsAppConnectionStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "QR_READY"
  | "ERROR";

/** QR code response from Evolution API */
export interface QRCodeResponse {
  /** Base64-encoded QR image or QR string */
  base64: string;
  /** Raw QR data string */
  code: string;
}

/** WhatsApp message send result */
export interface WhatsAppSendResult {
  /** Whether the message was sent successfully */
  success: boolean;
  /** Evolution API message key/ID */
  key?: string;
  /** Error message if failed */
  error?: string;
  /** Timestamp of the send attempt */
  timestamp: string;
}

// ─── Request/Response DTOs ─────────────────────

/** POST /whatsapp/send — Send a WhatsApp message */
export interface SendMessageRequest {
  /** Work order UUID */
  ordenId: string;
  /** Target order state to determine message template */
  estadoSolicitado: string;
  /** Optional custom message override */
  customMessage?: string;
  /** Optional PDF attachment URL (for presupuesto) */
  pdfUrl?: string;
}

/** POST /whatsapp/send-bulk — Send to multiple clients */
export interface SendBulkMessageRequest {
  /** Array of work order UUIDs */
  ordenIds: string[];
  /** Target order state */
  estadoSolicitado: string;
}

/** GET /whatsapp/status — Connection status response */
export interface WhatsAppStatusResponse {
  /** Current connection status */
  status: WhatsAppConnectionStatus;
  /** Instance name */
  instanceName: string;
  /** Phone number associated (if connected) */
  phoneNumber?: string;
  /** Last connection timestamp */
  lastConnectedAt?: string;
}

/** GET /whatsapp/log — Message log entry */
export interface WhatsAppLogEntry {
  id: string;
  ordenId: string;
  clienteName: string;
  phoneNumber: string;
  messageTemplate: string;
  messagePreview: string;
  status: "SENT" | "FAILED" | "PENDING";
  errorMessage?: string;
  sentAt: string;
  sentBy: string;
}

/** GET /whatsapp/log response */
export interface WhatsAppLogResponse {
  items: WhatsAppLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Message Template Types ─────────────────────

/** Template data for message formatting */
export interface MessageTemplateData {
  nombre_cliente: string;
  vehiculo_marca: string;
  vehiculo_modelo: string;
  chapa: string;
  id_orden: string;
  monto_total?: string;
  nombre_mecanico?: string;
  fecha_estimada_entrega?: string;
  numero_factura?: string;
  url_encuesta_satisfaccion?: string;
}

/** Order state to message template mapping */
export type MessageTemplate =
  | "RECEPCIONADO"
  | "PRESUPUESTADO"
  | "EN_REPARACION"
  | "LISTO_ENTREGA"
  | "FINALIZADO_RETIRADO";

/** WhatsApp configuration for a tenant */
export interface WhatsAppConfig {
  /** Evolution API instance name */
  instanceName: string;
  /** Whether WhatsApp is connected */
  connected: boolean;
  /** Phone number */
  phoneNumber?: string;
  /** Survey URL template */
  surveyUrlTemplate?: string;
}
