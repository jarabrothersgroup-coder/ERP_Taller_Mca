/**
 * Twenty CRM — Shared types & DTOs.
 *
 * Defines the interface between the ERP and Twenty CRM API.
 * Twenty exposes both REST and GraphQL endpoints.
 *
 * @module crm/types
 */

// ─── Twenty CRM API Types ──────────────────────────────

/** Twenty CRM connection status */
export type TwentyConnectionStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "ERROR";

/** Contact (Person) in Twenty CRM */
export interface TwentyContact {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  documentId?: string;        // C.I. / RUC (Paraguay)
  company?: string;
  customFields?: Record<string, unknown>;
}

/** Custom fields for automotive CRM */
export interface TwentyAutomotiveFields {
  /** Vehicle plate number (chapa) */
  vehiclePlate?: string;
  /** Vehicle brand/marca */
  vehicleBrand?: string;
  /** Vehicle model */
  vehicleModel?: string;
  /** Vehicle VIN */
  vehicleVin?: string;
  /** Current mileage */
  currentMileage?: number;
  /** Last service type */
  lastServiceType?: string;
  /** Last service date */
  lastServiceDate?: string;
  /** Total visits to workshop */
  totalVisits?: number;
  /** Total spent at workshop */
  totalSpent?: number;
  /** Client type */
  clientType?: "WALK_IN" | "REPEAT" | "VIP";
}

/** Note attached to a Twenty contact */
export interface TwentyNote {
  id: string;
  body: string;
  createdAt: string;
  authorId?: string;
}

/** Upsert result from Twenty CRM */
export interface TwentyUpsertResult {
  /** Whether a new contact was created */
  created: boolean;
  /** Twenty CRM contact/person ID */
  contactId: string;
  /** Operation performed */
  operation: "created" | "updated" | "unchanged";
  /** Timestamp */
  timestamp: string;
  /** Duration in milliseconds */
  durationMs: number;
}

/** CRM sync worker configuration */
export interface CrmSyncConfig {
  /** Twenty CRM API base URL */
  apiUrl: string;
  /** Twenty CRM API key */
  apiKey: string;
  /** GraphQL endpoint (optional, defaults to /graphql) */
  graphqlUrl?: string;
  /** Enable/disable sync (feature flag) */
  enabled: boolean;
  /** Max retries for failed syncs */
  maxRetries: number;
  /** Delay between retries in ms */
  retryDelayMs: number;
}

/** CRM sync worker result */
export interface CrmSyncResult {
  success: boolean;
  operation: string;
  contactId?: string;
  error?: string;
  timestamp: string;
  durationMs: number;
}
