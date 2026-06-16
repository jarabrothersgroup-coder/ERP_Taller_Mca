-- Migration 0019: Row Level Security (RLS) + Security Hardening
-- Sprint 18 — Defense-in-depth multi-tenant isolation
--
-- OWASP Top 10 2021:
--   A01:2021 Broken Access Control (BOLA/IDOR)
--   A05:2021 Security Misconfiguration
--
-- Strategy:
--   1. Create current_tenant() function (reads session variable)
--   2. Enable RLS on ALL tenant-scoped tables
--   3. Create SELECT/INSERT/UPDATE/DELETE policies per table
--   4. Policies check current_setting('app.current_tenant') against tenant_slug column
--   5. NULL/empty current_tenant = public route (login, health) — allowed
--
-- IMPORTANT: This migration is safe to run on existing data.
-- RLS policies only filter queries — they don't modify data.
-- ────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════
--  1. RLS Helper Function
-- ═══════════════════════════════════════════════════

-- Function to read the current tenant from session variable
-- SET LOCAL app.current_tenant = 'taller-el-chero' (set by middleware)
CREATE OR REPLACE FUNCTION public.current_tenant()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT nullif(current_setting('app.current_tenant', true), '')::text;
$$;

-- ═══════════════════════════════════════════════════
--  2. Workshop Module Tables
-- ═══════════════════════════════════════════════════

-- clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
CREATE POLICY clients_tenant_select ON clients FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY clients_tenant_insert ON clients FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY clients_tenant_update ON clients FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY clients_tenant_delete ON clients FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- vehiculos
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos FORCE ROW LEVEL SECURITY;
CREATE POLICY vehiculos_tenant_select ON vehiculos FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY vehiculos_tenant_insert ON vehiculos FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY vehiculos_tenant_update ON vehiculos FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY vehiculos_tenant_delete ON vehiculos FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- ordenes_trabajo
ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_trabajo FORCE ROW LEVEL SECURITY;
CREATE POLICY ordenes_trabajo_tenant_select ON ordenes_trabajo FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY ordenes_trabajo_tenant_insert ON ordenes_trabajo FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY ordenes_trabajo_tenant_update ON ordenes_trabajo FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY ordenes_trabajo_tenant_delete ON ordenes_trabajo FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- ingresos
ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingresos FORCE ROW LEVEL SECURITY;
CREATE POLICY ingresos_tenant_select ON ingresos FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY ingresos_tenant_insert ON ingresos FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY ingresos_tenant_update ON ingresos FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY ingresos_tenant_delete ON ingresos FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- trabajos_terceros
ALTER TABLE trabajos_terceros ENABLE ROW LEVEL SECURITY;
ALTER TABLE trabajos_terceros FORCE ROW LEVEL SECURITY;
CREATE POLICY trabajos_terceros_tenant_select ON trabajos_terceros FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY trabajos_terceros_tenant_insert ON trabajos_terceros FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY trabajos_terceros_tenant_update ON trabajos_terceros FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY trabajos_terceros_tenant_delete ON trabajos_terceros FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- orden_servicios
ALTER TABLE orden_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_servicios FORCE ROW LEVEL SECURITY;
CREATE POLICY orden_servicios_tenant_select ON orden_servicios FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY orden_servicios_tenant_insert ON orden_servicios FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY orden_servicios_tenant_update ON orden_servicios FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY orden_servicios_tenant_delete ON orden_servicios FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- orden_repuestos
ALTER TABLE orden_repuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_repuestos FORCE ROW LEVEL SECURITY;
CREATE POLICY orden_repuestos_tenant_select ON orden_repuestos FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY orden_repuestos_tenant_insert ON orden_repuestos FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY orden_repuestos_tenant_update ON orden_repuestos FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY orden_repuestos_tenant_delete ON orden_repuestos FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- servicios_catalogo
ALTER TABLE servicios_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios_catalogo FORCE ROW LEVEL SECURITY;
CREATE POLICY servicios_catalogo_tenant_select ON servicios_catalogo FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY servicios_catalogo_tenant_insert ON servicios_catalogo FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY servicios_catalogo_tenant_update ON servicios_catalogo FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY servicios_catalogo_tenant_delete ON servicios_catalogo FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- ═══════════════════════════════════════════════════
--  3. Notifications
-- ═══════════════════════════════════════════════════

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones FORCE ROW LEVEL SECURITY;
CREATE POLICY notificaciones_tenant_select ON notificaciones FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY notificaciones_tenant_insert ON notificaciones FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY notificaciones_tenant_update ON notificaciones FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY notificaciones_tenant_delete ON notificaciones FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- ═══════════════════════════════════════════════════
--  4. Finance Module Tables
-- ═══════════════════════════════════════════════════

-- facturas
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas FORCE ROW LEVEL SECURITY;
CREATE POLICY facturas_tenant_select ON facturas FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY facturas_tenant_insert ON facturas FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY facturas_tenant_update ON facturas FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY facturas_tenant_delete ON facturas FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- fiscal_documentos
ALTER TABLE fiscal_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_documentos FORCE ROW LEVEL SECURITY;
CREATE POLICY fiscal_documentos_tenant_select ON fiscal_documentos FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY fiscal_documentos_tenant_insert ON fiscal_documentos FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY fiscal_documentos_tenant_update ON fiscal_documentos FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY fiscal_documentos_tenant_delete ON fiscal_documentos FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- fiscal_documento_detalles
ALTER TABLE fiscal_documento_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_documento_detalles FORCE ROW LEVEL SECURITY;
CREATE POLICY fiscal_documento_detalles_tenant_select ON fiscal_documento_detalles FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY fiscal_documento_detalles_tenant_insert ON fiscal_documento_detalles FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY fiscal_documento_detalles_tenant_update ON fiscal_documento_detalles FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY fiscal_documento_detalles_tenant_delete ON fiscal_documento_detalles FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- sifen_sync_log
ALTER TABLE sifen_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sifen_sync_log FORCE ROW LEVEL SECURITY;
CREATE POLICY sifen_sync_log_tenant_select ON sifen_sync_log FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY sifen_sync_log_tenant_insert ON sifen_sync_log FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY sifen_sync_log_tenant_update ON sifen_sync_log FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY sifen_sync_log_tenant_delete ON sifen_sync_log FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- plan_cuentas
ALTER TABLE plan_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_cuentas FORCE ROW LEVEL SECURITY;
CREATE POLICY plan_cuentas_tenant_select ON plan_cuentas FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY plan_cuentas_tenant_insert ON plan_cuentas FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY plan_cuentas_tenant_update ON plan_cuentas FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY plan_cuentas_tenant_delete ON plan_cuentas FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- asientos_contables
ALTER TABLE asientos_contables ENABLE ROW LEVEL SECURITY;
ALTER TABLE asientos_contables FORCE ROW LEVEL SECURITY;
CREATE POLICY asientos_contables_tenant_select ON asientos_contables FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY asientos_contables_tenant_insert ON asientos_contables FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY asientos_contables_tenant_update ON asientos_contables FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY asientos_contables_tenant_delete ON asientos_contables FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- asientos_detalle
ALTER TABLE asientos_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE asientos_detalle FORCE ROW LEVEL SECURITY;
CREATE POLICY asientos_detalle_tenant_select ON asientos_detalle FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY asientos_detalle_tenant_insert ON asientos_detalle FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY asientos_detalle_tenant_update ON asientos_detalle FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY asientos_detalle_tenant_delete ON asientos_detalle FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- fixed_expenses
ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses FORCE ROW LEVEL SECURITY;
CREATE POLICY fixed_expenses_tenant_select ON fixed_expenses FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY fixed_expenses_tenant_insert ON fixed_expenses FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY fixed_expenses_tenant_update ON fixed_expenses FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY fixed_expenses_tenant_delete ON fixed_expenses FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- mechanic_profiles
ALTER TABLE mechanic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanic_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY mechanic_profiles_tenant_select ON mechanic_profiles FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY mechanic_profiles_tenant_insert ON mechanic_profiles FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY mechanic_profiles_tenant_update ON mechanic_profiles FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY mechanic_profiles_tenant_delete ON mechanic_profiles FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- staff_profiles
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY staff_profiles_tenant_select ON staff_profiles FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY staff_profiles_tenant_insert ON staff_profiles FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY staff_profiles_tenant_update ON staff_profiles FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY staff_profiles_tenant_delete ON staff_profiles FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- commission_records
ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_records FORCE ROW LEVEL SECURITY;
CREATE POLICY commission_records_tenant_select ON commission_records FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY commission_records_tenant_insert ON commission_records FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY commission_records_tenant_update ON commission_records FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY commission_records_tenant_delete ON commission_records FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- payroll_summary
ALTER TABLE payroll_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_summary FORCE ROW LEVEL SECURITY;
CREATE POLICY payroll_summary_tenant_select ON payroll_summary FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY payroll_summary_tenant_insert ON payroll_summary FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY payroll_summary_tenant_update ON payroll_summary FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY payroll_summary_tenant_delete ON payroll_summary FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_log_tenant_select ON audit_log FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY audit_log_tenant_insert ON audit_log FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
-- Note: audit_log should NOT be updatable or deletable (immutability)

-- centros_costo
ALTER TABLE centros_costo ENABLE ROW LEVEL SECURITY;
ALTER TABLE centros_costo FORCE ROW LEVEL SECURITY;
CREATE POLICY centros_costo_tenant_select ON centros_costo FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY centros_costo_tenant_insert ON centros_costo FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY centros_costo_tenant_update ON centros_costo FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY centros_costo_tenant_delete ON centros_costo FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- ═══════════════════════════════════════════════════
--  5. Treasury Module Tables
-- ═══════════════════════════════════════════════════

-- cuentas_bancarias
ALTER TABLE cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_bancarias FORCE ROW LEVEL SECURITY;
CREATE POLICY cuentas_bancarias_tenant_select ON cuentas_bancarias FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY cuentas_bancarias_tenant_insert ON cuentas_bancarias FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY cuentas_bancarias_tenant_update ON cuentas_bancarias FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY cuentas_bancarias_tenant_delete ON cuentas_bancarias FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- movimientos_tesoreria
ALTER TABLE movimientos_tesoreria ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_tesoreria FORCE ROW LEVEL SECURITY;
CREATE POLICY movimientos_tesoreria_tenant_select ON movimientos_tesoreria FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY movimientos_tesoreria_tenant_insert ON movimientos_tesoreria FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY movimientos_tesoreria_tenant_update ON movimientos_tesoreria FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY movimientos_tesoreria_tenant_delete ON movimientos_tesoreria FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- conciliacion_bancaria
ALTER TABLE conciliacion_bancaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE conciliacion_bancaria FORCE ROW LEVEL SECURITY;
CREATE POLICY conciliacion_bancaria_tenant_select ON conciliacion_bancaria FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY conciliacion_bancaria_tenant_insert ON conciliacion_bancaria FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY conciliacion_bancaria_tenant_update ON conciliacion_bancaria FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY conciliacion_bancaria_tenant_delete ON conciliacion_bancaria FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- facturas_proveedor
ALTER TABLE facturas_proveedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas_proveedor FORCE ROW LEVEL SECURITY;
CREATE POLICY facturas_proveedor_tenant_select ON facturas_proveedor FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY facturas_proveedor_tenant_insert ON facturas_proveedor FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY facturas_proveedor_tenant_update ON facturas_proveedor FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY facturas_proveedor_tenant_delete ON facturas_proveedor FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- ═══════════════════════════════════════════════════
--  6. Inventory Module Tables
-- ═══════════════════════════════════════════════════

-- repuestos
ALTER TABLE repuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE repuestos FORCE ROW LEVEL SECURITY;
CREATE POLICY repuestos_tenant_select ON repuestos FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY repuestos_tenant_insert ON repuestos FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY repuestos_tenant_update ON repuestos FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY repuestos_tenant_delete ON repuestos FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- herramientas
ALTER TABLE herramientas ENABLE ROW LEVEL SECURITY;
ALTER TABLE herramientas FORCE ROW LEVEL SECURITY;
CREATE POLICY herramientas_tenant_select ON herramientas FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY herramientas_tenant_insert ON herramientas FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY herramientas_tenant_update ON herramientas FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY herramientas_tenant_delete ON herramientas FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- control_herramientas
ALTER TABLE control_herramientas ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_herramientas FORCE ROW LEVEL SECURITY;
CREATE POLICY control_herramientas_tenant_select ON control_herramientas FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY control_herramientas_tenant_insert ON control_herramientas FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY control_herramientas_tenant_update ON control_herramientas FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY control_herramientas_tenant_delete ON control_herramientas FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- stock_movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY stock_movements_tenant_select ON stock_movements FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY stock_movements_tenant_insert ON stock_movements FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());

-- cost_history
ALTER TABLE cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_history FORCE ROW LEVEL SECURITY;
CREATE POLICY cost_history_tenant_select ON cost_history FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY cost_history_tenant_insert ON cost_history FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());

-- reorder_alerts
ALTER TABLE reorder_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY reorder_alerts_tenant_select ON reorder_alerts FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY reorder_alerts_tenant_insert ON reorder_alerts FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY reorder_alerts_tenant_delete ON reorder_alerts FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- purchase_orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY purchase_orders_tenant_select ON purchase_orders FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY purchase_orders_tenant_insert ON purchase_orders FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY purchase_orders_tenant_update ON purchase_orders FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());

-- purchase_order_items
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY purchase_order_items_tenant_select ON purchase_order_items FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY purchase_order_items_tenant_insert ON purchase_order_items FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY purchase_order_items_tenant_update ON purchase_order_items FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());

-- inventory_accounts_map
ALTER TABLE inventory_accounts_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_accounts_map FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_accounts_map_tenant_select ON inventory_accounts_map FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY inventory_accounts_map_tenant_insert ON inventory_accounts_map FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY inventory_accounts_map_tenant_delete ON inventory_accounts_map FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- ═══════════════════════════════════════════════════
--  7. Budget Module
-- ═══════════════════════════════════════════════════

-- presupuestos
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos FORCE ROW LEVEL SECURITY;
CREATE POLICY presupuestos_tenant_select ON presupuestos FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY presupuestos_tenant_insert ON presupuestos FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY presupuestos_tenant_update ON presupuestos FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY presupuestos_tenant_delete ON presupuestos FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- presupuestos_items
ALTER TABLE presupuestos_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos_items FORCE ROW LEVEL SECURITY;
CREATE POLICY presupuestos_items_tenant_select ON presupuestos_items FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY presupuestos_items_tenant_insert ON presupuestos_items FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY presupuestos_items_tenant_update ON presupuestos_items FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY presupuestos_items_tenant_delete ON presupuestos_items FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- ═══════════════════════════════════════════════════
--  8. Tenant Config Module
-- ═══════════════════════════════════════════════════

-- tenant_config
ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_config FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_config_tenant_select ON tenant_config FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY tenant_config_tenant_insert ON tenant_config FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY tenant_config_tenant_update ON tenant_config FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY tenant_config_tenant_delete ON tenant_config FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- libros_obligatorios
ALTER TABLE libros_obligatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE libros_obligatorios FORCE ROW LEVEL SECURITY;
CREATE POLICY libros_obligatorios_tenant_select ON libros_obligatorios FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY libros_obligatorios_tenant_insert ON libros_obligatorios FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY libros_obligatorios_tenant_update ON libros_obligatorios FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY libros_obligatorios_tenant_delete ON libros_obligatorios FOR DELETE
  USING (tenant_slug = public.current_tenant());

-- ═══════════════════════════════════════════════════
--  9. Thinkcar Module
-- ═══════════════════════════════════════════════════

-- thinkcar_imports
ALTER TABLE thinkcar_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinkcar_imports FORCE ROW LEVEL SECURITY;
CREATE POLICY thinkcar_imports_tenant_select ON thinkcar_imports FOR SELECT
  USING (tenant_slug = public.current_tenant());
CREATE POLICY thinkcar_imports_tenant_insert ON thinkcar_imports FOR INSERT
  WITH CHECK (tenant_slug = public.current_tenant());
CREATE POLICY thinkcar_imports_tenant_update ON thinkcar_imports FOR UPDATE
  USING (tenant_slug = public.current_tenant())
  WITH CHECK (tenant_slug = public.current_tenant());

-- ═══════════════════════════════════════════════════
-- 10. Profiles (uses tenant_id UUID, not tenant_slug)
-- ═══════════════════════════════════════════════════

-- profiles — uses tenant_id UUID FK to tenants table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY profiles_tenant_select ON profiles FOR SELECT
  USING (tenant_id::text = public.current_tenant());
CREATE POLICY profiles_tenant_insert ON profiles FOR INSERT
  WITH CHECK (tenant_id::text = public.current_tenant());
CREATE POLICY profiles_tenant_update ON profiles FOR UPDATE
  USING (tenant_id::text = public.current_tenant())
  WITH CHECK (tenant_id::text = public.current_tenant());
CREATE POLICY profiles_tenant_delete ON profiles FOR DELETE
  USING (tenant_id::text = public.current_tenant());

-- ═══════════════════════════════════════════════════
-- 11. Platform Tables (tenants — no RLS, public)
-- ═══════════════════════════════════════════════════

-- tenants table is NOT tenant-scoped (it's the platform registry)
-- No RLS policies needed — accessed by platform admin only
-- RLS disabled for this table (open access for login flow)
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
