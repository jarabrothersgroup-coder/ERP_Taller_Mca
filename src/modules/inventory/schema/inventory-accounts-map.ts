/**
 * Inventory Accounts Map table — Drizzle ORM schema.
 *
 * Maps inventory item categories to Chart of Accounts entries
 * for automatic double-entry journal generation on stock movements.
 *
 * Example mapping:
 *   categoria="Filtros"  → cuentaInventario="1.1.3.01" (Inventario de Repuestos Nuevos)
 *                        → cuentaGasto="6.1.01.001" (Costo de Mantenimiento)
 *                        → cuentaProveedor="2.1.01.001" (Proveedores Locales)
 *
 * The '*' categoria serves as the default/fallback mapping for
 * any category without a specific entry.
 *
 * @module inventory/schema/inventory-accounts-map
 */

import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { planCuentas } from "../../finance/schema/accounting.js";

// ─── Table ────────────────────────────────────

/**
 * Inventory Accounts Map — connects inventory categories to
 * Chart of Accounts entries for automatic journaling.
 */
export const inventoryAccountsMap = pgTable(
  "inventory_accounts_map",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Inventory category name (e.g. "Filtros", "Frenos", "Motor").
     * Use '*' for the default/fallback mapping.
     * Unique per tenant.
     */
    categoria: text("categoria").notNull(),

    /**
     * Inventory asset account (Activo).
     * Debited on stock input, credited on stock output.
     * e.g. "1.1.3.01 — Inventario de Repuestos Nuevos"
     */
    cuentaInventarioId: uuid("cuenta_inventario_id")
      .notNull()
      .references(() => planCuentas.id),

    /**
     * Cost/expense account (Gasto/Costo).
     * Debited on stock output (cost of goods sold / maintenance cost).
     * e.g. "6.1.01.001 — Costo de Mantenimiento"
     */
    cuentaGastoId: uuid("cuenta_gasto_id")
      .notNull()
      .references(() => planCuentas.id),

    /**
     * Supplier/payables account (Pasivo).
     * Credited on purchase receipt.
     * e.g. "2.1.01.001 — Proveedores Locales"
     */
    cuentaProveedorId: uuid("cuenta_proveedor_id").references(
      () => planCuentas.id,
    ),

    /** Multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    categoriaTenantUniqueIdx: index("inv_acct_map_cat_tenant_idx").on(
      table.categoria,
      table.tenantSlug,
    ),
    tenantIdx: index("inv_acct_map_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

export type InventoryAccountsMap =
  typeof inventoryAccountsMap.$inferSelect;
export type NewInventoryAccountsMap =
  typeof inventoryAccountsMap.$inferInsert;
