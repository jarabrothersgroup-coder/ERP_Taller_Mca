/**
 * Twenty CRM Service — API client for Twenty CRM.
 *
 * Handles all communication with Twenty CRM via REST and GraphQL:
 *   - Contact lookup by phone/document
 *   - Contact creation (new walk-in clients)
 *   - Contact update (existing clients with new service)
 *   - Note attachment (service history)
 *
 * Twenty CRM API docs: https://docs.twenty.com
 *
 * RAM impact: ~5 KB (HTTP client, no persistent connections).
 *
 * @module crm/services/twenty-crm.service
 */

import { env } from "../../../config/env.js";
import type {
  TwentyContact,
  TwentyUpsertResult,
  TwentyAutomotiveFields,
} from "../types.js";

// ─── Constants ─────────────────────────────────────────

/** HTTP timeout for Twenty CRM API calls */
const API_TIMEOUT_MS = 15_000;

/** Default retry configuration */
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

// ─── Configuration ─────────────────────────────────────

function getApiUrl(): string {
  return env.TWENTY_API_URL || "http://localhost:3001";
}

function getApiKey(): string {
  return env.TWENTY_API_KEY || "";
}

function getGraphQLUrl(): string {
  return env.TWENTY_GRAPHQL_URL || `${getApiUrl()}/graphql`;
}

// ─── HTTP Client ───────────────────────────────────────

/**
 * Executes a GraphQL query against Twenty CRM.
 */
async function twentyGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const url = getGraphQLUrl();
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("Twenty CRM API key not configured (TWENTY_API_KEY)");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Twenty GraphQL ${response.status}: ${errorText}`);
    }

    const result: any = await response.json();
    if (result.errors) {
      throw new Error(`Twenty GraphQL errors: ${JSON.stringify(result.errors)}`);
    }
    return result.data as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Twenty CRM GraphQL timeout — verify connection");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Retry Wrapper ─────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delayMs: number = RETRY_DELAY_MS,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

// ─── Public API ────────────────────────────────────────

/**
 * Searches for a contact in Twenty CRM by phone number.
 *
 * @param phone - Phone number to search (E.164 or raw)
 * @returns Matching contact or null
 */
export async function findContactByPhone(
  phone: string,
): Promise<TwentyContact | null> {
  try {
    const cleanPhone = phone.replace(/\D/g, "");
    const result = await twentyGraphQL<{
      people: {
        edges: Array<{
          node: {
            id: string;
            name: { firstName: string; lastName: string };
            phone: string[];
            emails: string[];
            customFields?: Record<string, unknown>;
          };
        }>;
      };
    }>(
      `query FindByPhone($phone: String!) {
        people(filter: { phone: { eq: $phone } }) {
          edges {
            node {
              id
              name { firstName lastName }
              phone
              emails
            }
          }
        }
      }`,
      { phone: cleanPhone },
    );

    const edges = result.people?.edges || [];
    if (edges.length === 0) return null;

    const node = edges[0].node;
    return {
      id: node.id,
      name: `${node.name.firstName} ${node.name.lastName}`.trim(),
      phone: node.phone?.[0],
      email: node.emails?.[0],
    };
  } catch {
    return null;
  }
}

/**
 * Searches for a contact in Twenty CRM by document ID (C.I./RUC).
 */
export async function findContactByDocument(
  documentId: string,
): Promise<TwentyContact | null> {
  try {
    const result = await twentyGraphQL<{
      people: {
        edges: Array<{
          node: {
            id: string;
            name: { firstName: string; lastName: string };
            phone: string[];
            emails: string[];
            customFields?: Record<string, unknown>;
          };
        }>;
      };
    }>(
      `query FindByDocument($docId: String!) {
        people(filter: { customFields: { documentId: { eq: $docId } } }) {
          edges {
            node {
              id
              name { firstName lastName }
              phone
              emails
              customFields
            }
          }
        }
      }`,
      { docId: documentId },
    );

    const edges = result.people?.edges || [];
    if (edges.length === 0) return null;

    const node = edges[0].node;
    return {
      id: node.id,
      name: `${node.name.firstName} ${node.name.lastName}`.trim(),
      phone: node.phone?.[0],
      email: node.emails?.[0],
      documentId,
    };
  } catch {
    return null;
  }
}

/**
 * Creates a new contact (Person) in Twenty CRM.
 *
 * @param contact - Contact data
 * @param automotiveFields - Vehicle/service data
 * @returns Created contact ID
 */
export async function createContact(
  contact: TwentyContact,
  automotiveFields?: TwentyAutomotiveFields,
): Promise<TwentyUpsertResult> {
  const startTime = Date.now();

  const nameParts = contact.name.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const result = await withRetry(() =>
    twentyGraphQL<{
      createPerson: { id: string };
    }>(
      `mutation CreatePerson($input: PersonCreateInput!) {
        createPerson(input: $input) {
          id
        }
      }`,
      {
        input: {
          name: { firstName, lastName },
          phone: contact.phone ? [contact.phone] : [],
          emails: contact.email ? [contact.email] : [],
          ...(automotiveFields && {
            customFields: {
              vehiclePlate: automotiveFields.vehiclePlate,
              vehicleBrand: automotiveFields.vehicleBrand,
              vehicleModel: automotiveFields.vehicleModel,
              vehicleVin: automotiveFields.vehicleVin,
              currentMileage: automotiveFields.currentMileage,
              clientType: automotiveFields.clientType || "WALK_IN",
              lastServiceType: automotiveFields.lastServiceType,
              lastServiceDate: automotiveFields.lastServiceDate,
              totalVisits: automotiveFields.totalVisits || 1,
              totalSpent: automotiveFields.totalSpent || 0,
            },
          }),
        },
      },
    ),
  );

  return {
    created: true,
    contactId: result.createPerson.id,
    operation: "created",
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
}

/**
 * Updates an existing contact in Twenty CRM.
 *
 * @param contactId - Twenty CRM person ID
 * @param updates - Fields to update
 * @returns Update result
 */
export async function updateContact(
  contactId: string,
  updates: Partial<TwentyAutomotiveFields>,
): Promise<TwentyUpsertResult> {
  const startTime = Date.now();

  await withRetry(() =>
    twentyGraphQL(
      `mutation UpdatePerson($id: ID!, $input: PersonUpdateInput!) {
        updatePerson(id: $id, input: $input) {
          id
        }
      }`,
      {
        id: contactId,
        input: {
          customFields: updates,
        },
      },
    ),
  );

  return {
    created: false,
    contactId,
    operation: "updated",
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
}

/**
 * Adds a note to a Twenty CRM contact.
 *
 * @param contactId - Twenty CRM person ID
 * @param noteBody - Note text content
 * @param authorId - Author person ID (optional)
 */
export async function addNoteToContact(
  contactId: string,
  noteBody: string,
  authorId?: string,
): Promise<void> {
  await withRetry(() =>
    twentyGraphQL(
      `mutation CreateNote($input: NoteCreateInput!) {
        createNote(input: $input) {
          id
        }
      }`,
      {
        input: {
          body: noteBody,
          authorId: authorId || undefined,
          contextTargets: [{ id: contactId, objectName: "person" }],
        },
      },
    ),
  );
}

/**
 * UPSERT: Search by phone/document, create or update accordingly.
 *
 * This is the main entry point for the reverse sync worker.
 * When an order reaches FINALIZADO_RETIRADO, this function:
 *   1. Searches Twenty for existing contact (phone or document)
 *   2. If found → update + add service note
 *   3. If not found → create new contact with vehicle data
 *
 * @param clientData - Client info from ERP
 * @param vehicleData - Vehicle info from ERP
 * @param ordenId - Work order ID
 * @param serviceSummary - Summary of the completed service
 * @returns Upsert result with contact ID and operation type
 */
export async function upsertContact(
  clientData: {
    name: string;
    phone: string;
    documentId?: string;
    email?: string;
  },
  vehicleData: {
    plate: string;
    brand: string;
    model: string;
    vin?: string;
    mileage?: number;
  },
  ordenId: string,
  serviceSummary: {
    type: string;
    totalCost: number;
    invoiceNumber?: string;
    mechanicName?: string;
  },
): Promise<TwentyUpsertResult> {
  // Step 1: Search by phone first, then by document
  let existingContact = await findContactByPhone(clientData.phone);
  if (!existingContact && clientData.documentId) {
    existingContact = await findContactByDocument(clientData.documentId);
  }

  const automotiveFields: TwentyAutomotiveFields = {
    vehiclePlate: vehicleData.plate,
    vehicleBrand: vehicleData.brand,
    vehicleModel: vehicleData.model,
    vehicleVin: vehicleData.vin,
    currentMileage: vehicleData.mileage,
    lastServiceType: serviceSummary.type,
    lastServiceDate: new Date().toISOString().split("T")[0],
  };

  // Step 2: Create or update
  if (existingContact) {
    // Update existing contact
    const upsertResult = await updateContact(existingContact.id!, automotiveFields);

    // Add service note
    const noteBody = [
      `🔧 **Servicio completado** — Orden #${ordenId.substring(0, 8).toUpperCase()}`,
      `Fecha: ${new Date().toLocaleDateString("es-PY")}`,
      `Tipo: ${serviceSummary.type}`,
      `Vehículo: ${vehicleData.brand} ${vehicleData.model} (${vehicleData.plate})`,
      `Mecánico: ${serviceSummary.mechanicName || "N/A"}`,
      `Total: Gs. ${serviceSummary.totalCost.toLocaleString("es-PY")}`,
      serviceSummary.invoiceNumber ? `Factura: ${serviceSummary.invoiceNumber}` : "",
    ].filter(Boolean).join("\n");

    await addNoteToContact(existingContact.id!, noteBody);

    return upsertResult;
  } else {
    // Create new contact
    const createResult = await createContact(
      {
        name: clientData.name,
        phone: clientData.phone,
        email: clientData.email,
        documentId: clientData.documentId,
      },
      {
        ...automotiveFields,
        clientType: "WALK_IN",
        totalVisits: 1,
        totalSpent: serviceSummary.totalCost,
      },
    );

    // Add welcome note
    const noteBody = [
      `🎉 **Primer registro** — Cliente Walk-in`,
      `Orden: #${ordenId.substring(0, 8).toUpperCase()}`,
      `Vehículo: ${vehicleData.brand} ${vehicleData.model} (${vehicleData.plate})`,
      `Servicio: ${serviceSummary.type}`,
      `Total: Gs. ${serviceSummary.totalCost.toLocaleString("es-PY")}`,
    ].join("\n");

    await addNoteToContact(createResult.contactId, noteBody);

    return createResult;
  }
}

/**
 * Tests the connection to Twenty CRM.
 *
 * @returns Connection status
 */
export async function testConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    const result = await twentyGraphQL<{ currentUser: { id: string } }>(
      `query { currentUser { id } }`,
    );
    return {
      connected: true,
      message: `Connected to Twenty CRM (user: ${result.currentUser.id})`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      connected: false,
      message: `Connection failed: ${msg}`,
    };
  }
}
