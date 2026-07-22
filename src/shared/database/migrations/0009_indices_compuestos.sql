-- Migration 0009: Composite indexes for JOIN-heavy queries
-- Sprint 83 — Performance Tuning
-- Adds missing composite indexes identified in the N+1 audit to optimize
-- the most frequent JOIN patterns in workshop, finance, and inventory queries.

-- ── Workshop: ordenes_trabajo ─────────────────────
-- Used in: listOrdenes (status filter), analytics (status + tenant, date range)
CREATE INDEX IF NOT EXISTS ot_tenant_status_idx ON ordenes_trabajo (tenant_slug, status);
CREATE INDEX IF NOT EXISTS ot_tenant_created_idx ON ordenes_trabajo (tenant_slug, created_at);
CREATE INDEX IF NOT EXISTS ot_client_tenant_idx ON ordenes_trabajo (client_id, tenant_slug);

-- ── Finance: facturas ────────────────────────────
-- Used in: dashboard KPIs (tenant + estadoPago), analytics (tenant + date)
CREATE INDEX IF NOT EXISTS facturas_tenant_estado_pago_idx ON facturas (tenant_slug, estado_pago);
CREATE INDEX IF NOT EXISTS facturas_tenant_created_idx ON facturas (tenant_slug, created_at);
CREATE INDEX IF NOT EXISTS facturas_orden_tenant_idx ON facturas (orden_id, tenant_slug);

-- ── Finance: asientos_contables + asientos_detalle ─
-- Used in: balanced scorecard, ledger queries
CREATE INDEX IF NOT EXISTS asientos_fecha_estado_idx ON asientos_contables (fecha, estado);
CREATE INDEX IF NOT EXISTS asientos_tenant_fecha_idx ON asientos_contables (tenant_slug, fecha);
CREATE INDEX IF NOT EXISTS asientos_detalle_asiento_cuenta_idx ON asientos_detalle (asiento_id, cuenta_id);

-- ── Inventory: stock_movements ────────────────────
-- Used in: analytics cost queries, stock reports
CREATE INDEX IF NOT EXISTS sm_tipo_tenant_created_idx ON stock_movements (tipo, tenant_slug, created_at);
CREATE INDEX IF NOT EXISTS sm_repuesto_tenant_idx ON stock_movements (repuesto_id, tenant_slug);

-- ── Workshop: orden_servicios ─────────────────────
-- Used in: getTopServicios analytics
CREATE INDEX IF NOT EXISTS os_tenant_servicio_created_idx ON orden_servicios (tenant_slug, servicio_id, created_at);

-- ── Workshop: orden_repuestos ─────────────────────
-- Used in: OT detail queries
CREATE INDEX IF NOT EXISTS or_orden_tenant_idx ON orden_repuestos (orden_trabajo_id, tenant_slug);

-- ── Notification-priority (existing table) ──────
-- Composite for targeted push queries
CREATE INDEX IF NOT EXISTS np_tenant_target_delivered_idx ON notification_priorities (tenant_slug, target_user, delivered);
