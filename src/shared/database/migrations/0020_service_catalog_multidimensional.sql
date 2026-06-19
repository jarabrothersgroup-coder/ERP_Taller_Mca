-- Migration 0020: Multi-Dimensional Service Catalog + Vehicle Master Data + RH Hours
-- Sprint 19 — Service catalog pricing matrix, vehicle types, mileage intervals
--
-- Strategy:
--   1. Reference tables: vehicle_types, fuel_types, mileage_intervals
--   2. Vehicle master data: vehiculos_marca, vehiculos_modelo
--   3. Service catalog enrichment: service_categories, extend servicios_catalogo
--   4. Pricing matrix: service_pricing_rules (service × vehicle × fuel × km interval)
--   5. Brand mapping: service_brand_map
--   6. RH service hours: rh_service_hours (service × vehicle × complexity → hours)

-- ═══════════════════════════════════════════════════
--  1. Reference Tables (Global, not tenant-scoped)
-- ═══════════════════════════════════════════════════

-- Vehicle types
CREATE TABLE IF NOT EXISTS vehicle_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true
);

-- Fuel types
CREATE TABLE IF NOT EXISTS fuel_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(30) NOT NULL UNIQUE,
  descripcion TEXT
);

-- Mileage intervals for maintenance scheduling
CREATE TABLE IF NOT EXISTS mileage_intervals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  km_desde INT NOT NULL,
  km_hasta INT,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  orden SMALLINT NOT NULL
);

-- ═══════════════════════════════════════════════════
--  2. Vehicle Master Data (Global reference)
-- ═══════════════════════════════════════════════════

-- Vehicle brands (Toyota, Kia, Hyundai, etc.)
CREATE TABLE IF NOT EXISTS vehiculos_marca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(50) NOT NULL UNIQUE,
  pais_origen VARCHAR(30),
  activa BOOLEAN DEFAULT true
);

-- Vehicle models (Corolla, Hilux, Picanto, etc.)
CREATE TABLE IF NOT EXISTS vehiculos_modelo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_id UUID NOT NULL REFERENCES vehiculos_marca(id),
  vehicle_type_id UUID NOT NULL REFERENCES vehicle_types(id),
  nombre VARCHAR(50) NOT NULL,
  motor_cc VARCHAR(20),
  combustible_default VARCHAR(20),
  UNIQUE(marca_id, nombre)
);

-- ═══════════════════════════════════════════════════
--  3. Service Catalog Enrichment
-- ═══════════════════════════════════════════════════

-- Service categories (normalized, replaces free-text categoria)
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  icono VARCHAR(10),
  color VARCHAR(7),
  orden SMALLINT DEFAULT 0
);

-- Extend servicios_catalogo with new columns (idempotent)
DO $$ BEGIN
  ALTER TABLE servicios_catalogo ADD COLUMN IF NOT EXISTS codigo VARCHAR(20);
  ALTER TABLE servicios_catalogo ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES service_categories(id);
  ALTER TABLE servicios_catalogo ADD COLUMN IF NOT EXISTS thinkcar_modulo VARCHAR(50);
  ALTER TABLE servicios_catalogo ADD COLUMN IF NOT EXISTS descripcion_tecnica TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Unique index on codigo per tenant
CREATE UNIQUE INDEX IF NOT EXISTS servicios_catalogo_codigo_tenant_idx
  ON servicios_catalogo (codigo, tenant_slug) WHERE codigo IS NOT NULL;

-- ═══════════════════════════════════════════════════
--  4. Pricing Matrix (Tenant-scoped)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS service_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id UUID NOT NULL REFERENCES servicios_catalogo(id) ON DELETE CASCADE,
  vehicle_type_id UUID NOT NULL REFERENCES vehicle_types(id),
  fuel_type_id UUID REFERENCES fuel_types(id),
  mileage_interval_id UUID REFERENCES mileage_intervals(id),
  precio_venta_pyg NUMERIC(15,2) NOT NULL,
  precio_costo_pyg NUMERIC(15,2) DEFAULT 0,
  impuesto_iva_pct NUMERIC(5,2) DEFAULT 10,
  tiempo_estimado_min INT NOT NULL,
  complejidad VARCHAR(20) DEFAULT 'NORMAL',
  activo BOOLEAN DEFAULT true,
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_pricing_rules_tenant_idx ON service_pricing_rules (tenant_slug);
CREATE INDEX IF NOT EXISTS service_pricing_rules_servicio_idx ON service_pricing_rules (servicio_id);

-- Unique constraint: one rule per service × vehicle × fuel × km interval per tenant
CREATE UNIQUE INDEX IF NOT EXISTS service_pricing_rules_unique_idx
  ON service_pricing_rules (servicio_id, vehicle_type_id, COALESCE(fuel_type_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(mileage_interval_id, '00000000-0000-0000-0000-000000000000'::uuid), tenant_slug);

-- ═══════════════════════════════════════════════════
--  5. Brand Mapping (which brands apply to which service)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS service_brand_map (
  servicio_id UUID NOT NULL REFERENCES servicios_catalogo(id) ON DELETE CASCADE,
  marca VARCHAR(50) NOT NULL,
  PRIMARY KEY(servicio_id, marca)
);

-- ═══════════════════════════════════════════════════
--  6. RH Service Hours (complexity × vehicle → hours)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rh_service_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id UUID NOT NULL REFERENCES servicios_catalogo(id) ON DELETE CASCADE,
  vehicle_type_id UUID NOT NULL REFERENCES vehicle_types(id),
  complejidad VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  horas_estimadas NUMERIC(5,2) NOT NULL,
  horas_minimas NUMERIC(5,2),
  horas_maximas NUMERIC(5,2),
  requiere_especialista BOOLEAN DEFAULT false,
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rh_service_hours_tenant_idx ON rh_service_hours (tenant_slug);
CREATE INDEX IF NOT EXISTS rh_service_hours_servicio_idx ON rh_service_hours (servicio_id);

CREATE UNIQUE INDEX IF NOT EXISTS rh_service_hours_unique_idx
  ON rh_service_hours (servicio_id, vehicle_type_id, complejidad, tenant_slug);
