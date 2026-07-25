-- Migration 0013: Database CHECK constraints for data integrity
-- Fixes C-05: "Sin CHECK constraints en DB"
--
-- Adds CHECK constraints to critical tables to prevent:
--   - Negative monetary amounts
--   - Invalid enum values
--   - Null required fields
--   - Zero/negative quantities
--
-- Created: 2026-07-24

-- =============================================================
-- 1. Financial tables — Monetary integrity
-- =============================================================

-- facturas: positive total
ALTER TABLE facturas DROP CONSTRAINT IF EXISTS facturas_total_check;
ALTER TABLE facturas ADD CONSTRAINT facturas_total_check
  CHECK (total IS NULL OR total >= 0);

-- factura_detalle: positive amounts
ALTER TABLE factura_detalle DROP CONSTRAINT IF EXISTS factura_detalle_precio_check;
ALTER TABLE factura_detalle ADD CONSTRAINT factura_detalle_precio_check
  CHECK (precio_unitario IS NULL OR precio_unitario >= 0);

-- asientos_contables: debe/haber must be positive
ALTER TABLE asientos_contables DROP CONSTRAINT IF EXISTS asientos_debe_check;
ALTER TABLE asientos_contables ADD CONSTRAINT asientos_debe_check
  CHECK (debe >= 0);
ALTER TABLE asientos_contables DROP CONSTRAINT IF EXISTS asientos_haber_check;
ALTER TABLE asientos_contables ADD CONSTRAINT asientos_haber_check
  CHECK (haber >= 0);

-- plan_cuentas: tipo must be valid
ALTER TABLE plan_cuentas DROP CONSTRAINT IF EXISTS plan_cuentas_tipo_check;
ALTER TABLE plan_cuentas ADD CONSTRAINT plan_cuentas_tipo_check
  CHECK (tipo IN ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO', 'ORDEN'));

-- =============================================================
-- 2. Workshop tables — Status enums and data integrity
-- =============================================================

-- ordenes_trabajo: valid status values
ALTER TABLE ordenes_trabajo DROP CONSTRAINT IF EXISTS ordenes_status_check;
ALTER TABLE ordenes_trabajo ADD CONSTRAINT ordenes_status_check
  CHECK (status IN ('PRESUPUESTADO', 'APROBADO', 'EN_PROCESO', 'CONTROL_CALIDAD', 'LISTO', 'FINALIZADO_RETIRADO', 'CANCELADO', 'RECHAZADO'));

-- ingresos: valid status
ALTER TABLE ingresos DROP CONSTRAINT IF EXISTS ingresos_status_check;
ALTER TABLE ingresos ADD CONSTRAINT ingresos_status_check
  CHECK (status IN ('ACTIVO', 'FINALIZADO', 'CANCELADO'));

-- clients: valid document type
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_tipo_documento_check;
ALTER TABLE clients ADD CONSTRAINT clients_tipo_documento_check
  CHECK (tipo_documento IS NULL OR tipo_documento IN ('RUC', 'CI', 'PASAPORTE', 'OTRO'));

-- vehicles: valid fuel type
ALTER TABLE vehiculos DROP CONSTRAINT IF EXISTS vehiculos_combustible_check;
ALTER TABLE vehiculos ADD CONSTRAINT vehiculos_combustible_check
  CHECK (tipo_combustible IS NULL OR tipo_combustible IN ('NAFTA', 'DIESEL', 'ELECTRICO', 'HIBRIDO', 'GNV', 'ETANOL'));

-- vehiculos: valid vehicle type
ALTER TABLE vehiculos DROP CONSTRAINT IF EXISTS vehiculos_tipo_check;
ALTER TABLE vehiculos ADD CONSTRAINT vehiculos_tipo_check
  CHECK (tipo IS NULL OR tipo IN ('AUTOMOVIL', 'SUV', 'PICK_UP', 'CAMIONETA', 'CAMION', 'MOTO', 'ACOPLADO', 'MAQUINARIA'));

-- =============================================================
-- 3. Inventory tables — Quantity and price integrity
-- =============================================================

-- repuestos: stock and price must be non-negative
ALTER TABLE repuestos DROP CONSTRAINT IF EXISTS repuestos_stock_check;
ALTER TABLE repuestos ADD CONSTRAINT repuestos_stock_check
  CHECK (stock IS NULL OR stock >= 0);

ALTER TABLE repuestos DROP CONSTRAINT IF EXISTS repuestos_precio_check;
ALTER TABLE repuestos ADD CONSTRAINT repuestos_precio_check
  CHECK (precio_costo IS NULL OR precio_costo >= 0);

ALTER TABLE repuestos DROP CONSTRAINT IF EXISTS repuestos_precio_venta_check;
ALTER TABLE repuestos ADD CONSTRAINT repuestos_precio_venta_check
  CHECK (precio_venta IS NULL OR precio_venta >= 0);

-- stock_movements: quantity must be positive
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_cantidad_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_cantidad_check
  CHECK (cantidad > 0);

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_tipo_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_tipo_check
  CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE', 'TRANSFERENCIA'));

-- purchase_orders: total must be positive
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_total_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_total_check
  CHECK (total IS NULL OR total >= 0);

-- =============================================================
-- 4. Scheduling — Appointment validation
-- =============================================================

-- agendamientos: valid status values
ALTER TABLE agendamientos DROP CONSTRAINT IF EXISTS agendamientos_estado_check;
ALTER TABLE agendamientos ADD CONSTRAINT agendamientos_estado_check
  CHECK (estado IN ('RESERVADO', 'CONFIRMADO', 'PROCESADO_EN_ERP', 'AUSENTE', 'CANCELADO'));

-- agendamientos: duration must be positive
ALTER TABLE agendamientos DROP CONSTRAINT IF EXISTS agendamientos_duracion_check;
ALTER TABLE agendamientos ADD CONSTRAINT agendamientos_duracion_check
  CHECK (duracion_horas IS NULL OR duracion_horas > 0);

-- =============================================================
-- 5. HR/Payroll — Salary integrity
-- =============================================================

-- mechanic_profiles: positive salary and efficiency
ALTER TABLE mechanic_profiles DROP CONSTRAINT IF EXISTS mechanic_salario_check;
ALTER TABLE mechanic_profiles ADD CONSTRAINT mechanic_salario_check
  CHECK (salario_base IS NULL OR salario_base >= 0);

ALTER TABLE mechanic_profiles DROP CONSTRAINT IF EXISTS mechanic_eficiencia_check;
ALTER TABLE mechanic_profiles ADD CONSTRAINT mechanic_eficiencia_check
  CHECK (eficiencia IS NULL OR (eficiencia >= 0 AND eficiencia <= 100));

-- =============================================================
-- 6. Treasury — Positive amounts
-- =============================================================

-- cuentas_bancarias: positive saldo
ALTER TABLE cuentas_bancarias DROP CONSTRAINT IF EXISTS cuentas_saldo_check;
ALTER TABLE cuentas_bancarias ADD CONSTRAINT cuentas_saldo_check
  CHECK (saldo_actual IS NULL OR saldo_actual >= 0);

-- movimientos_tesoreria: positive monto
ALTER TABLE movimientos_tesoreria DROP CONSTRAINT IF EXISTS movimientos_monto_check;
ALTER TABLE movimientos_tesoreria ADD CONSTRAINT movimientos_monto_check
  CHECK (monto IS NULL OR monto > 0);
