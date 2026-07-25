-- Migration 0013: Database CHECK constraints for data integrity
-- Fixes C-05: "Sin CHECK constraints en DB"
--
-- Adds CHECK constraints to critical tables to prevent:
--   - Negative monetary amounts
--   - Invalid enum values
--   - Zero/negative quantities
--
-- Uses PL/pgSQL to verify each column exists before adding constraints,
-- making the migration robust across schema variations.
--
-- Updated: 2026-07-25 (revised to match actual DB schema)

DO $$ 
DECLARE
  col_exists BOOLEAN;
BEGIN

  -- =============================================================
  -- 1. Financial tables — Monetary integrity
  -- =============================================================

  -- facturas: positive total
  ALTER TABLE facturas DROP CONSTRAINT IF EXISTS facturas_total_check;
  ALTER TABLE facturas ADD CONSTRAINT facturas_total_check
    CHECK (total IS NULL OR total >= 0);

  -- factura_detalles: positive unit prices
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='factura_detalles' AND column_name='precio_unitario') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE factura_detalles DROP CONSTRAINT IF EXISTS factura_detalle_precio_check;
    ALTER TABLE factura_detalles ADD CONSTRAINT factura_detalle_precio_check
      CHECK (precio_unitario IS NULL OR precio_unitario >= 0);
  END IF;

  -- asientos_contables: debe/haber must be non-negative (columns: total_debe, total_haber)
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='asientos_contables' AND column_name='total_debe') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE asientos_contables DROP CONSTRAINT IF EXISTS asientos_debe_check;
    ALTER TABLE asientos_contables ADD CONSTRAINT asientos_debe_check
      CHECK (total_debe >= 0);
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='asientos_contables' AND column_name='total_haber') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE asientos_contables DROP CONSTRAINT IF EXISTS asientos_haber_check;
    ALTER TABLE asientos_contables ADD CONSTRAINT asientos_haber_check
      CHECK (total_haber >= 0);
  END IF;

  -- plan_cuentas: tipo is already validated by enum tipo_cuenta_contable — skip CHECK
  RAISE NOTICE 'plan_cuentas.tipo uses enum tipo_cuenta_contable — validation is built-in, skipping CHECK constraint';

  -- =============================================================
  -- 2. Workshop tables — Status enums and data integrity
  -- =============================================================

  -- ordenes_trabajo: status is already validated by enum estado_orden — skip CHECK
  RAISE NOTICE 'ordenes_trabajo.status uses enum estado_orden — validation is built-in, skipping CHECK constraint';

  -- clients: valid RUC/document format (column: ruc)
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='ruc') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_ruc_check;
    ALTER TABLE clients ADD CONSTRAINT clients_ruc_check
      CHECK (ruc IS NULL OR ruc ~ '^[0-9]{6,8}-[0-9]$');
  END IF;

  -- vehiculos: valid engine type
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehiculos' AND column_name='engine_type') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE vehiculos DROP CONSTRAINT IF EXISTS vehiculos_engine_check;
    ALTER TABLE vehiculos ADD CONSTRAINT vehiculos_engine_check
      CHECK (engine_type IS NULL OR engine_type IN ('combustion', 'hybrid', 'electric', 'NAFTA', 'DIESEL', 'ELECTRICO', 'HIBRIDO', 'GNV', 'ETANOL'));
  END IF;

  -- =============================================================
  -- 3. Inventory tables — Quantity and price integrity
  -- =============================================================

  -- repuestos: stock_actual must be non-negative
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='repuestos' AND column_name='stock_actual') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE repuestos DROP CONSTRAINT IF EXISTS repuestos_stock_check;
    ALTER TABLE repuestos ADD CONSTRAINT repuestos_stock_check
      CHECK (stock_actual IS NULL OR stock_actual >= 0);
  END IF;

  -- repuestos: precio_costo must be non-negative
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='repuestos' AND column_name='precio_costo') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE repuestos DROP CONSTRAINT IF EXISTS repuestos_precio_check;
    ALTER TABLE repuestos ADD CONSTRAINT repuestos_precio_check
      CHECK (precio_costo IS NULL OR precio_costo >= 0);
  END IF;

  -- repuestos: precio_venta must be non-negative
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='repuestos' AND column_name='precio_venta') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE repuestos DROP CONSTRAINT IF EXISTS repuestos_precio_venta_check;
    ALTER TABLE repuestos ADD CONSTRAINT repuestos_precio_venta_check
      CHECK (precio_venta IS NULL OR precio_venta >= 0);
  END IF;

  -- stock_movements: quantity must be positive
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='cantidad') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_cantidad_check;
    ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_cantidad_check
      CHECK (cantidad > 0);
  END IF;

  -- stock_movements: tipo must be valid
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='tipo') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_tipo_check;
    ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_tipo_check
      CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE', 'TRANSFERENCIA'));
  END IF;

  -- purchase_orders: total_oc must be positive
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_orders' AND column_name='total_oc') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_total_check;
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_total_check
      CHECK (total_oc IS NULL OR total_oc >= 0);
  END IF;

  -- purchase_orders: valid estado
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_orders' AND column_name='estado') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_estado_check;
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_estado_check
      CHECK (estado IN ('BORRADOR', 'PENDIENTE', 'APROBADA', 'ENVIADA', 'RECIBIDA_PARCIAL', 'RECIBIDA', 'CANCELADA'));
  END IF;

  -- =============================================================
  -- 4. Scheduling — Appointment validation
  -- =============================================================

  -- agendamientos: estado is already validated by enum agendamiento_estado — skip CHECK
  RAISE NOTICE 'agendamientos.estado uses enum agendamiento_estado — validation is built-in, skipping CHECK constraint';

  -- agendamientos: duration must be positive
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agendamientos' AND column_name='duracion_horas') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE agendamientos DROP CONSTRAINT IF EXISTS agendamientos_duracion_check;
    ALTER TABLE agendamientos ADD CONSTRAINT agendamientos_duracion_check
      CHECK (duracion_horas IS NULL OR duracion_horas > 0);
  END IF;

  -- =============================================================
  -- 5. HR/Payroll — Salary integrity
  -- =============================================================

  -- mechanic_profiles: positive base_salary
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mechanic_profiles' AND column_name='base_salary') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE mechanic_profiles DROP CONSTRAINT IF EXISTS mechanic_salario_check;
    ALTER TABLE mechanic_profiles ADD CONSTRAINT mechanic_salario_check
      CHECK (base_salary IS NULL OR base_salary >= 0);
  END IF;

  -- =============================================================
  -- 6. Treasury — Positive amounts
  -- =============================================================

  -- cuentas_bancarias: positive saldo_actual
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cuentas_bancarias' AND column_name='saldo_actual') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE cuentas_bancarias DROP CONSTRAINT IF EXISTS cuentas_saldo_check;
    ALTER TABLE cuentas_bancarias ADD CONSTRAINT cuentas_saldo_check
      CHECK (saldo_actual IS NULL OR saldo_actual >= 0);
  END IF;

  -- movimientos_tesoreria: positive monto
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movimientos_tesoreria' AND column_name='monto') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE movimientos_tesoreria DROP CONSTRAINT IF EXISTS movimientos_monto_check;
    ALTER TABLE movimientos_tesoreria ADD CONSTRAINT movimientos_monto_check
      CHECK (monto IS NULL OR monto > 0);
  END IF;

END $$;
