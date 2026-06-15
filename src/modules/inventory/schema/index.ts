/**
 * Inventory schema barrel — re-exports all table definitions, types and relations.
 *
 * Import from this file to access all inventory Drizzle ORM schemas:
 *
 * ```ts
 * import {
 *   herramientas,
 *   repuestos,
 *   controlHerramientas,
 *   toolInstances,
 *   toolMaintenanceEvents,
 *   toolDepreciationEntries,
 *   stockMovements,
 *   costHistory,
 *   purchaseOrders,
 *   purchaseOrderItems,
 *   inventoryAccountsMap,
 *   reorderAlerts,
 * } from "../schema/index.js";
 * ```
 *
 * @module inventory/schema/index
 */

// ─── Tables ───────────────────────────────────
export { herramientas } from "./herramientas.js";
export type { Herramienta, NewHerramienta } from "./herramientas.js";

export { repuestos } from "./repuestos.js";
export type { Repuesto, NewRepuesto } from "./repuestos.js";

export {
  controlHerramientas,
  estadoControlHerramientaEnum,
} from "./control-herramientas.js";
export type {
  ControlHerramienta,
  NewControlHerramienta,
  EstadoControlHerramienta,
} from "./control-herramientas.js";

export { toolInstances } from "./tool-instances.js";
export type {
  ToolInstance,
  NewToolInstance,
} from "./tool-instances.js";

export { toolMaintenanceEvents } from "./tool-maintenance-events.js";
export type {
  ToolMaintenanceEvent,
  NewToolMaintenanceEvent,
} from "./tool-maintenance-events.js";

export { toolDepreciationEntries } from "./tool-depreciation-entries.js";
export type {
  ToolDepreciationEntry,
  NewToolDepreciationEntry,
} from "./tool-depreciation-entries.js";

export { stockMovements } from "./stock-movements.js";
export type {
  StockMovement,
  NewStockMovement,
} from "./stock-movements.js";

export { costHistory } from "./cost-history.js";
export type {
  CostHistoryEntry,
  NewCostHistoryEntry,
} from "./cost-history.js";

export {
  purchaseOrders,
  purchaseOrderItems,
} from "./purchase-orders.js";
export type {
  PurchaseOrder,
  NewPurchaseOrder,
  PurchaseOrderItem,
  NewPurchaseOrderItem,
} from "./purchase-orders.js";

export { inventoryAccountsMap } from "./inventory-accounts-map.js";
export type {
  InventoryAccountsMap,
  NewInventoryAccountsMap,
} from "./inventory-accounts-map.js";

export { reorderAlerts } from "./reorder-alerts.js";
export type {
  ReorderAlert,
  NewReorderAlert,
} from "./reorder-alerts.js";

export { initialInventoryLoads } from "./initial-inventory-loads.js";
export type {
  InitialInventoryLoad,
  NewInitialInventoryLoad,
} from "./initial-inventory-loads.js";

// ─── Relations ────────────────────────────────
export {
  herramientasRelations,
  toolInstancesRelations,
  toolMaintenanceEventsRelations,
  toolDepreciationEntriesRelations,
  controlHerramientasRelations,
} from "./relations.js";
