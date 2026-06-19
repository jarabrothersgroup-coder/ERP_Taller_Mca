-- Seed 0020: Multi-Dimensional Service Catalog + Vehicle Master Data
-- Sprint 19 — Paraguayan automotive workshop reference data
--
-- Run AFTER migration 0020_service_catalog_multidimensional.sql

-- ═══════════════════════════════════════════════════
--  1. Vehicle Types
-- ═══════════════════════════════════════════════════

INSERT INTO vehicle_types (nombre, descripcion) VALUES
  ('AUTOMOVIL', 'Sedanes, Hatchbacks, Station Wagons'),
  ('SUV', 'Sport Utility Vehicles, Crossovers'),
  ('PICK_UP', 'Pick-ups medianas y pesadas'),
  ('CAMIONETA', 'Camionetas de carga y pasajeros'),
  ('CAMION', 'Camiones rígidos y tractocamiones'),
  ('MOTOCICLETA', 'Motocicletas')
ON CONFLICT (nombre) DO NOTHING;

-- ═══════════════════════════════════════════════════
--  2. Fuel Types
-- ═══════════════════════════════════════════════════

INSERT INTO fuel_types (nombre, descripcion) VALUES
  ('NAFTA', 'Gasolina regular / Premium'),
  ('DIESEL', 'Diésel convencional'),
  ('DIESEL_CR', 'Diésel Common Rail'),
  ('FLEX', 'Flex Fuel (Nafta + Etanol)'),
  ('HIBRIDO', 'Hybrid Electric Vehicle (HEV)'),
  ('ELECTRICO', 'Battery Electric Vehicle (BEV)')
ON CONFLICT (nombre) DO NOTHING;

-- ═══════════════════════════════════════════════════
--  3. Mileage Intervals
-- ═══════════════════════════════════════════════════

INSERT INTO mileage_intervals (km_desde, km_hasta, nombre, orden) VALUES
  (0,     5000,  '0 - 5.000 km',    1),
  (5000,  10000, '5.000 - 10.000 km', 2),
  (10000, 20000, '10.000 - 20.000 km', 3),
  (20000, 40000, '20.000 - 40.000 km', 4),
  (40000, 60000, '40.000 - 60.000 km', 5),
  (60000, NULL,  '60.000+ km',      6)
ON CONFLICT (nombre) DO NOTHING;

-- ═══════════════════════════════════════════════════
--  4. Service Categories
-- ═══════════════════════════════════════════════════

INSERT INTO service_categories (nombre, descripcion, icono, color, orden) VALUES
  ('Mecánica Preventiva Rápida', 'Cambios de aceite, filtros, inspección 25 puntos', '🔧', '#0F2C59', 1),
  ('Especialidad Alta Performance', 'Diagnóstico, inyección, GDI, Flex, Common Rail', '💻', '#FF6B35', 2),
  ('Electricidad y Diagnóstico', 'Redes CAN/LIN, DTC, calibración ADAS', '⚡', '#FFD700', 3),
  ('Tren Delantero y Frenos', 'Suspensión, frenos, dirección, rectificado', '🚗', '#0F2C59', 4),
  ('Climatización y Confort', 'A/C, gas R134a/R1234yf, higienización', '❄️', '#00BFFF', 5),
  ('Sistemas Flotas y Corporativos', 'Mantenimiento predictivo, reportes flotas', '🏢', '#333333', 6),
  ('Descarbonización y EGR', 'Limpieza EGR, admisión, ultrasonido', '🔥', '#FF4500', 7),
  ('Transmisión y Correas', 'Aceite de caja, correa distribución, kit timing', '⚙️', '#666666', 8)
ON CONFLICT (nombre) DO NOTHING;

-- ═══════════════════════════════════════════════════
--  5. Vehicle Brands (Paraguay market leaders)
-- ═══════════════════════════════════════════════════

INSERT INTO vehiculos_marca (nombre, pais_origen) VALUES
  ('TOYOTA', 'Japón'),
  ('KIA', 'Corea del Sur'),
  ('HYUNDAI', 'Corea del Sur'),
  ('VOLKSWAGEN', 'Brasil'),
  ('FIAT', 'Brasil'),
  ('CHEVROLET', 'Brasil'),
  ('SUZUKI', 'India'),
  ('GEELY', 'China'),
  ('BYD', 'China'),
  ('CHERY', 'China'),
  ('NISSAN', 'Japón'),
  ('MITSUBISHI', 'Japón'),
  ('FORD', 'Estados Unidos'),
  ('MAHINDRA', 'India')
ON CONFLICT (nombre) DO NOTHING;

-- ═══════════════════════════════════════════════════
--  6. Vehicle Models (Most popular in Paraguay)
-- ═══════════════════════════════════════════════════

-- Toyota (Japón)
INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'VITZ', '1.0 - 1.3cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'TOYOTA' AND vt.nombre = 'AUTOMOVIL'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'COROLLA', '1.6 - 1.8cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'TOYOTA' AND vt.nombre = 'AUTOMOVIL'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'COROLLA CROSS', '1.8cc', 'HIBRIDO'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'TOYOTA' AND vt.nombre = 'SUV'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'HILUX', '2.4 - 2.8cc', 'DIESEL_CR'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'TOYOTA' AND vt.nombre = 'PICK_UP'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'ALLION', '1.5 - 1.8cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'TOYOTA' AND vt.nombre = 'AUTOMOVIL'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'PREMIA', '1.5 - 1.8cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'TOYOTA' AND vt.nombre = 'AUTOMOVIL'
ON CONFLICT (marca_id, nombre) DO NOTHING;

-- Kia (Corea del Sur)
INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'PICANTO', '1.0cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'KIA' AND vt.nombre = 'AUTOMOVIL'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'SOLUTO', '1.4cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'KIA' AND vt.nombre = 'AUTOMOVIL'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'RIO', '1.4cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'KIA' AND vt.nombre = 'AUTOMOVIL'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'SPORTAGE', '2.0cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'KIA' AND vt.nombre = 'SUV'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'SELTOS', '1.6cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'KIA' AND vt.nombre = 'SUV'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'SORENTO', '2.0 - 2.2cc', 'DIESEL_CR'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'KIA' AND vt.nombre = 'SUV'
ON CONFLICT (marca_id, nombre) DO NOTHING;

-- Hyundai
INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'HB20', '1.0cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'HYUNDAI' AND vt.nombre = 'AUTOMOVIL'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'CRETA', '1.6cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'HYUNDAI' AND vt.nombre = 'SUV'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'TUCSON', '2.0cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'HYUNDAI' AND vt.nombre = 'SUV'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'SANTA FE', '2.0 - 2.2cc', 'DIESEL_CR'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'HYUNDAI' AND vt.nombre = 'SUV'
ON CONFLICT (marca_id, nombre) DO NOTHING;

-- Volkswagen
INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'GOL', '1.0 - 1.6cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'VOLKSWAGEN' AND vt.nombre = 'AUTOMOVIL'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'VOYAGE', '1.0 - 1.6cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'VOLKSWAGEN' AND vt.nombre = 'AUTOMOVIL'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'AMAROK', '2.0cc', 'DIESEL_CR'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'VOLKSWAGEN' AND vt.nombre = 'PICK_UP'
ON CONFLICT (marca_id, nombre) DO NOTHING;

-- Fiat
INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'ARGO', '1.0cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'FIAT' AND vt.nombre = 'AUTOMOVIL'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'STRADA', '1.4cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'FIAT' AND vt.nombre = 'PICK_UP'
ON CONFLICT (marca_id, nombre) DO NOTHING;

-- Suzuki
INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'SWIFT', '1.2cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'SUZUKI' AND vt.nombre = 'AUTOMOVIL'
ON CONFLICT (marca_id, nombre) DO NOTHING;

INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'VITARA', '1.4 - 1.6cc', 'FLEX'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'SUZUKI' AND vt.nombre = 'SUV'
ON CONFLICT (marca_id, nombre) DO NOTHING;

-- Chevrolet
INSERT INTO vehiculos_modelo (marca_id, vehicle_type_id, nombre, motor_cc, combustible_default)
SELECT vm.id, vt.id, 'S10', '2.5 - 2.8cc', 'DIESEL_CR'
FROM vehiculos_marca vm, vehicle_types vt WHERE vm.nombre = 'CHEVROLET' AND vt.nombre = 'PICK_UP'
ON CONFLICT (marca_id, nombre) DO NOTHING;
