-- Seed 0020b: Service Catalog + Pricing Rules (from Docs JSON data)
-- Sprint 19 — Workshop services with multi-dimensional pricing
--
-- Run AFTER seed-0020-reference-data.sql
-- Tenant: taller-el-chero

-- ═══════════════════════════════════════════════════
--  1. Services Catalog (main entries)
-- ═══════════════════════════════════════════════════

-- Mecánica Preventiva Rápida (Category 1)
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-PM-05K', 'Servicio Mantenimiento Preventivo 5K', 'Cambio aceite + filtro + inspección 25 puntos',
  'Mecánica Preventiva', 350000, 60, 'ECM_RESET',
  'Cambio de aceite de motor y filtro según viscosidad de fábrica. Inspección visual de seguridad de 25 puntos clave en tren delantero, luces y niveles hidráulicos.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-PM-05K' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-PM-10K', 'Inspección Intermedia 10K', 'Filtros aire/habitáculo + frenos + alineación',
  'Mecánica Preventiva', 550000, 90, 'ECM_RESET',
  'Cambio de aceite y filtro de motor. Cambio de filtro de aire y habitáculo. Limpieza y regulación de frenos traseros. Alineación y balanceo.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-PM-10K' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-AF-20K', 'Afinación y Frenos 20K', 'Bujías + inyectores + pastillas freno',
  'Especialidad Alta Performance', 1150000, 120, 'INJECTOR_CODING_THROTTLE_RELEARN',
  'Todo lo del servicio 10K. Cambio de bujías de encendido. Limpieza química de inyectores por ultrasonido. Limpieza del cuerpo de aceleración. Cambio de pastillas de freno delanteras.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-AF-20K' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-MM-40K', 'Mantenimiento Mayor 40K', 'Fluidos hidráulicos + filtros completo + cuerpo aceleración',
  'Mecánica Preventiva', 1600000, 210, 'ABS_BLEEDING',
  'Cambio de todos los fluidos: líquido de frenos DOT4, refrigerante, fluido dirección. Cambio de filtro de combustible. Limpieza sistema EVAP. Limpieza cuerpo de aceleración.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-MM-40K' AND tenant_slug = 'taller-el-chero');

INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-TC-60K', 'Transmisión y Correas 60K', 'Aceite caja + correa distribución + bomba agua',
  'Transmisión y Correas', 1800000, 300, 'TRANSMISSION_ADAPTIVE',
  'Cambio de aceite de caja de cambios (Manual o Automática). Cambio de correa de accesorios y correa de distribución si aplica. Inspección de bomba de agua y termostato.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-TC-60K' AND tenant_slug = 'taller-el-chero');

-- Diagnóstico Electrónico
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'ELE-DIAG-ADV', 'Diagnóstico Electrónico Redes Multiplexadas', 'Escaneo CAN/LIN Bus + DTC + informe',
  'Electricidad y Diagnóstico', 250000, 90, 'FULL_SYSTEM_SCAN',
  'Escaneo completo con software automotriz nivel OEM. Lectura y borrado de fallas DTC en redes CAN y LIN Bus. Informe técnico de salud de módulos electrónicos.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'ELE-DIAG-ADV' AND tenant_slug = 'taller-el-chero');

-- Descarbonización EGR
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-DES-EGR', 'Descarbonización EGR y Admisión', 'Limpieza válvula EGR + múltiple admisión por ultrasonido',
  'Descarbonización y EGR', 750000, 240, 'EGR_CALIBRATION',
  'Desmontaje físico e higienización por ultrasonido de la válvula de recirculación de gases (EGR) y del múltiple de admisión de aire.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-DES-EGR' AND tenant_slug = 'taller-el-chero');

-- Frenos ABS
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-FRENOS-ABS', 'Servicio Integral de Frenos con Purga Electrónica', 'Pastillas + rectificado discos + purga ABS',
  'Tren Delantero y Frenos', 550000, 90, 'ABS_BLEEDING',
  'Cambio de pastillas de freno delanteras, rectificado de discos, cambio de líquido hidráulico y purga del módulo ABS por escáner.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-FRENOS-ABS' AND tenant_slug = 'taller-el-chero');

-- A/C
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'CLIM-AC-SERV', 'Servicio y Carga de Aire Acondicionado', 'Detección fugas UV + vacío + carga gas R134a',
  'Climatización y Confort', 350000, 60, NULL,
  'Detección de fugas mediante lámpara UV y gas trazador. Vacío completo del sistema. Carga exacta por peso de gas R134a o R1234yf.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'CLIM-AC-SERV' AND tenant_slug = 'taller-el-chero');

-- Limpieza inyectores
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-INJ-LIM', 'Limpieza de Inyectores por Ultrasonido', 'Banco de pruebas + ultrasonido + flush',
  'Especialidad Alta Performance', 350000, 60, 'INJECTOR_CODING_THROTTLE_RELEARN',
  'Verificación de inyectores en banco de pruebas. Limpieza por ultrasonido. Flush de motor antes del cambio de lubricante.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-INJ-LIM' AND tenant_slug = 'taller-el-chero');

-- Diagnóstico 25 puntos
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'ELE-DIAG-25P', 'Inspección de 25 Puntos de Seguridad', 'Check-up completo visual y mecánico computarizado',
  'Electricidad y Diagnóstico', 100000, 30, NULL,
  'Chequeo visual y mecánico computarizado que abarca luces, neumáticos, fugas inferiores, mangueras, limpiaparabrisas y holguras mecánicas.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'ELE-DIAG-25P' AND tenant_slug = 'taller-el-chero');

-- Alineación y balanceo
INSERT INTO servicios_catalogo (codigo, nombre, descripcion, categoria, precio_estimado, duracion_estimada, thinkcar_modulo, descripcion_tecnica, tenant_slug)
SELECT 'MEC-ALI-BAL', 'Alineación Computarizada 3D + Balanceo', 'Alineación láser 3D + balanceo dinámico 4 ruedas',
  'Tren Delantero y Frenos', 150000, 45, NULL,
  'Alineación delantera/trasera con tecnología láser 3D. Balanceo dinámico de 4 ruedas con contrapesos de precisión.',
  'taller-el-chero'
WHERE NOT EXISTS (SELECT 1 FROM servicios_catalogo WHERE codigo = 'MEC-ALI-BAL' AND tenant_slug = 'taller-el-chero');

-- ═══════════════════════════════════════════════════
--  2. Service Pricing Rules (multi-dimensional)
-- ═══════════════════════════════════════════════════

-- Helper function to get IDs
DO $$
DECLARE
  v_servicio_id UUID;
  v_vehicle_auto UUID;
  v_vehicle_suv UUID;
  v_vehicle_pickup UUID;
  v_fuel_flex UUID;
  v_fuel_diesel UUID;
  v_fuel_hybrid UUID;
  v_km_5k UUID;
  v_km_10k UUID;
  v_km_20k UUID;
  v_km_40k UUID;
  v_km_60k UUID;
BEGIN
  -- Get vehicle type IDs
  SELECT id INTO v_vehicle_auto FROM vehicle_types WHERE nombre = 'AUTOMOVIL';
  SELECT id INTO v_vehicle_suv FROM vehicle_types WHERE nombre = 'SUV';
  SELECT id INTO v_vehicle_pickup FROM vehicle_types WHERE nombre = 'PICK_UP';

  -- Get fuel type IDs
  SELECT id INTO v_fuel_flex FROM fuel_types WHERE nombre = 'FLEX';
  SELECT id INTO v_fuel_diesel FROM fuel_types WHERE nombre = 'DIESEL_CR';
  SELECT id INTO v_fuel_hybrid FROM fuel_types WHERE nombre = 'HIBRIDO';

  -- Get mileage interval IDs
  SELECT id INTO v_km_5k FROM mileage_intervals WHERE nombre = '0 - 5.000 km';
  SELECT id INTO v_km_10k FROM mileage_intervals WHERE nombre = '5.000 - 10.000 km';
  SELECT id INTO v_km_20k FROM mileage_intervals WHERE nombre = '10.000 - 20.000 km';
  SELECT id INTO v_km_40k FROM mileage_intervals WHERE nombre = '20.000 - 40.000 km';
  SELECT id INTO v_km_60k FROM mileage_intervals WHERE nombre = '40.000 - 60.000 km';

  -- MEC-PM-05K (Mantenimiento 5K) — Prices from Docs
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-PM-05K' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, mileage_interval_id, precio_venta_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, v_km_5k, 350000, 60, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, v_km_5k, 550000, 75, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, v_km_5k, 650000, 75, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-PM-10K (Inspección 10K)
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-PM-10K' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, mileage_interval_id, precio_venta_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, v_km_10k, 550000, 90, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, v_km_10k, 750000, 105, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, v_km_10k, 850000, 105, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-AF-20K (Afinación 20K)
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-AF-20K' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, mileage_interval_id, precio_venta_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, v_km_20k, 950000, 120, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, v_km_20k, 1250000, 150, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, v_km_20k, 1450000, 150, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-MM-40K (Mantenimiento Mayor 40K)
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-MM-40K' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, mileage_interval_id, precio_venta_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, v_km_40k, 1600000, 210, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, v_km_40k, 1900000, 240, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, v_km_40k, 2200000, 240, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-TC-60K (Transmisión 60K)
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-TC-60K' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, mileage_interval_id, precio_venta_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, v_fuel_flex, v_km_60k, 1800000, 300, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, v_fuel_flex, v_km_60k, 2800000, 360, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, v_km_60k, 3500000, 420, 'AVANZADO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, v_fuel_diesel, v_km_60k, 5500000, 480, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ELE-DIAG-ADV (Diagnóstico Electrónico)
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'ELE-DIAG-ADV' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, NULL, 150000, 60, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, NULL, 200000, 75, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, NULL, 250000, 90, 'AVANZADO', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- MEC-FRENOS-ABS (Frenos)
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'MEC-FRENOS-ABS' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, NULL, 250000, 60, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, NULL, 350000, 75, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, NULL, 450000, 90, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

  -- CLIM-AC-SERV (A/C)
  SELECT id INTO v_servicio_id FROM servicios_catalogo WHERE codigo = 'CLIM-AC-SERV' AND tenant_slug = 'taller-el-chero';
  IF v_servicio_id IS NOT NULL THEN
    INSERT INTO service_pricing_rules (servicio_id, vehicle_type_id, fuel_type_id, precio_venta_pyg, tiempo_estimado_min, complejidad, tenant_slug) VALUES
      (v_servicio_id, v_vehicle_auto, NULL, 220000, 45, 'BASICO', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_suv, NULL, 350000, 60, 'NORMAL', 'taller-el-chero'),
      (v_servicio_id, v_vehicle_pickup, NULL, 350000, 60, 'NORMAL', 'taller-el-chero')
    ON CONFLICT DO NOTHING;
  END IF;

END $$;
