-- ═══════════════════════════════════════════════════════════
--  AutomotiveOS Cloud ERP — Consolidated Schema Migration
--  Fecha: 2026-06-19
--  Supabase CLI: supabase db push --linked
-- ═══════════════════════════════════════════════════════════
-- Este archivo consolida las migraciones 0000–0023 en un
-- único esquema inicial para nueva instalación en Supabase.
-- Para proyectos existentes, usar las migraciones individuales
-- en src/shared/database/migrations/.
-- ═══════════════════════════════════════════════════════════

-- ─── Extensions ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════
--  1. CORE TABLES (Multi-Tenant)
-- ═══════════════════════════════════════════════════════════

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  schema_name TEXT NOT NULL UNIQUE,
  ruc TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Profiles (Usuarios)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'user' NOT NULL CHECK (role IN ('admin', 'manager', 'mechanic', 'user')),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tenant Config
CREATE TABLE IF NOT EXISTS tenant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_key TEXT NOT NULL,
  config_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(tenant_id, config_key)
);

-- Libros Obligatorios (Fiscal)
CREATE TABLE IF NOT EXISTS libros_obligatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  libro_type TEXT NOT NULL,
  anio INTEGER NOT NULL,
  mes INTEGER,
  estado TEXT DEFAULT 'abierto' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ═══════════════════════════════════════════════════════════
--  2. WORKSHOP TABLES (Taller)
-- ═══════════════════════════════════════════════════════════

-- Clients (Clientes)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  document_id TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Vehicles (Vehículos)
CREATE TABLE IF NOT EXISTS vehiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  plate TEXT,
  vin TEXT,
  color TEXT,
  engine_type TEXT DEFAULT 'GASOLINA' CHECK (engine_type IN ('GASOLINA', 'DIESEL', 'ELECTRICO', 'HIBRIDO')),
  mileage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Sucursales
CREATE TABLE IF NOT EXISTS sucursales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Ordenes de Trabajo (OTs)
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  vehicle_id UUID NOT NULL REFERENCES vehiculos(id),
  sucursal_id UUID REFERENCES sucursales(id),
  status TEXT DEFAULT 'PENDIENTE' NOT NULL CHECK (status IN (
    'PENDIENTE', 'EN_PROGRESO', 'ESPERANDO_REPUESTOS',
    'FINALIZADO_RETIRADO', 'CANCELADO'
  )),
  description TEXT,
  diagnosis TEXT,
  total_cost NUMERIC(12,2) DEFAULT 0,
  estimated_hours NUMERIC(5,2),
  assigned_mechanic_id UUID REFERENCES profiles(id),
  check_in_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Orden Servicios (Trabajos asignados a OT)
CREATE TABLE IF NOT EXISTS orden_servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  orden_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  labor_hours NUMERIC(5,2) DEFAULT 0,
  labor_rate NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'PENDIENTE' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Orden Repuestos (Parts used in OT)
CREATE TABLE IF NOT EXISTS orden_repuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  orden_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  repuesto_id UUID NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ═══════════════════════════════════════════════════════════
--  3. INVENTORY TABLES (Inventario)
-- ═══════════════════════════════════════════════════════════

-- Repuestos (Parts)
CREATE TABLE IF NOT EXISTS repuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  category TEXT,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  unit_price NUMERIC(12,2) DEFAULT 0,
  stock_qty INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  location TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Herramientas (Tools)
CREATE TABLE IF NOT EXISTS herramientas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  serial_number TEXT,
  status TEXT DEFAULT 'disponible' CHECK (status IN ('disponible', 'en_uso', 'mantenimiento', 'baja')),
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Control Herramientas (Tool Checkout)
CREATE TABLE IF NOT EXISTS control_herramientas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  herramienta_id UUID NOT NULL REFERENCES herramientas(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  checkout_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  returned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ═══════════════════════════════════════════════════════════
--  4. FINANCE TABLES (Finanzas)
-- ═══════════════════════════════════════════════════════════

-- Plan de Cuentas (Chart of Accounts)
CREATE TABLE IF NOT EXISTS plan_cuentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO')),
  parent_id UUID REFERENCES plan_cuentas(id),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(tenant_id, code)
);

-- Asientos Contables (Journal Entries)
CREATE TABLE IF NOT EXISTS asientos_contables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asiento_number INTEGER NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'CONTABILIZADO' CHECK (status IN ('BORRADOR', 'CONTABILIZADO', 'ANULADO')),
  source TEXT,
  source_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Asientos Detalle (Journal Entry Lines)
CREATE TABLE IF NOT EXISTS asientos_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asiento_id UUID NOT NULL REFERENCES asientos_contables(id) ON DELETE CASCADE,
  cuenta_id UUID NOT NULL REFERENCES plan_cuentas(id),
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Facturas (Invoices)
CREATE TABLE IF NOT EXISTS facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  orden_id UUID REFERENCES ordenes_trabajo(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  tipo TEXT DEFAULT 'FACTURA' CHECK (tipo IN ('FACTURA', 'PRESUPUESTO', 'NOTA_CREDITO')),
  sifen_status TEXT DEFAULT 'PENDIENTE' CHECK (sifen_status IN ('PENDIENTE', 'ENVIADO', 'APROBADO', 'RECHAZADO')),
  subtotal NUMERIC(15,2) DEFAULT 0,
  iva NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'PYG',
  status TEXT DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'PAGADA', 'ANULADA')),
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Factura Detalle (Invoice Lines)
CREATE TABLE IF NOT EXISTS factura_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  factura_id UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SIFEN Sync Log
CREATE TABLE IF NOT EXISTS sifen_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  factura_id UUID NOT NULL REFERENCES facturas(id),
  operation TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Fiscal Documentos (DNIT/SIFEN)
CREATE TABLE IF NOT EXISTS fiscal_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  numero TEXT NOT NULL,
  ruc_emisor TEXT,
  ruc_receptor TEXT,
  monto_total NUMERIC(15,2) DEFAULT 0,
  iva_total NUMERIC(15,2) DEFAULT 0,
  estado TEXT DEFAULT 'PENDIENTE',
  sifen_key TEXT,
  xml_content TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Fixed Assets (Activos Fijos)
CREATE TABLE IF NOT EXISTS activos_fijos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC(15,2) DEFAULT 0,
  residual_value NUMERIC(15,2) DEFAULT 0,
  useful_life_years INTEGER DEFAULT 5,
  depreciation_method TEXT DEFAULT 'LINEAL',
  status TEXT DEFAULT 'ACTIVO',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Depreciación Activos
CREATE TABLE IF NOT EXISTS depreciacion_activos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  activo_id UUID NOT NULL REFERENCES activos_fijos(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  depreciation_amount NUMERIC(15,2) DEFAULT 0,
  accumulated NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Cuentas Bancarias
CREATE TABLE IF NOT EXISTS cuentas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT DEFAULT 'CORRIENTE',
  balance NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'PYG',
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Movimientos Tesorería
CREATE TABLE IF NOT EXISTS movimientos_tes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cuenta_id UUID NOT NULL REFERENCES cuentas_bancarias(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO', 'TRANSFERENCIA')),
  amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  reference TEXT,
  movement_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ═══════════════════════════════════════════════════════════
--  5. HR TABLES (Recursos Humanos)
-- ═══════════════════════════════════════════════════════════

-- Mechanic Profiles
CREATE TABLE IF NOT EXISTS mechanic_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  category TEXT DEFAULT 'Oficial' CHECK (category IN ('Ayudante', 'Medio_Oficial', 'Oficial', 'Oficial_Certificado')),
  hourly_rate NUMERIC(12,2) DEFAULT 0,
  specializations TEXT[],
  certifications TEXT[],
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Staff Profiles
CREATE TABLE IF NOT EXISTS staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  cargo TEXT NOT NULL,
  base_salary NUMERIC(12,2) DEFAULT 0,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  hire_date DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Commission Records
CREATE TABLE IF NOT EXISTS commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  order_id UUID REFERENCES ordenes_trabajo(id),
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'PAGADA', 'ANULADA')),
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Fixed Expenses (Gastos Fijos)
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  frequency TEXT DEFAULT 'MENSUAL' CHECK (frequency IN ('DIARIO', 'SEMANAL', 'MENSUAL', 'ANUAL')),
  due_date DATE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ═══════════════════════════════════════════════════════════
--  6. NOTIFICATIONS TABLES
-- ═══════════════════════════════════════════════════════════

-- Notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  tipo TEXT DEFAULT 'SISTEMA' CHECK (tipo IN ('INVENTARIO', 'COBRO', 'OT', 'SEGURIDAD', 'SISTEMA')),
  priority TEXT DEFAULT 'NORMAL' CHECK (priority IN ('URGENT', 'HIGH', 'NORMAL', 'LOW')),
  entity_type TEXT,
  entity_id UUID,
  leido BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ═══════════════════════════════════════════════════════════
--  7. CRM SYNC LOG
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  direction TEXT DEFAULT 'erp_to_crm' NOT NULL,
  orden_id UUID,
  client_id UUID,
  client_name TEXT,
  twenty_contact_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  error_message TEXT,
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════
--  8. THINKCAR TABLES
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS thinkcar_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehiculos(id),
  vin TEXT,
  dtc_codes TEXT[],
  raw_data JSONB,
  imported_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ═══════════════════════════════════════════════════════════
--  9. RAG (AI / Knowledge Base)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vehicle_manual_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_make TEXT,
  vehicle_model TEXT,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ═══════════════════════════════════════════════════════════
--  10. INDEXES
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehiculos_tenant ON vehiculos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehiculos_client ON vehiculos(client_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_tenant ON ordenes_trabajo(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_status ON ordenes_trabajo(status);
CREATE INDEX IF NOT EXISTS idx_ordenes_sucursal ON ordenes_trabajo(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_mechanic ON ordenes_trabajo(assigned_mechanic_id);
CREATE INDEX IF NOT EXISTS idx_repuestos_tenant ON repuestos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_repuestos_sku ON repuestos(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_facturas_tenant ON facturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facturas_status ON facturas(status);
CREATE INDEX IF NOT EXISTS idx_asientos_tenant ON asientos_contables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_asientos_date ON asientos_contables(date);
CREATE INDEX IF NOT EXISTS idx_notificaciones_user ON notificaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_unread ON notificaciones(user_id, leido);
CREATE INDEX IF NOT EXISTS idx_crm_sync_orden ON crm_sync_log(orden_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_status ON crm_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sifen_sync_factura ON sifen_sync_log(factura_id);
CREATE INDEX IF NOT EXISTS idx_sucursal_tenant ON sucursales(tenant_id);

-- ═══════════════════════════════════════════════════════════
--  11. ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_repuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE repuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE herramientas ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_herramientas ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE factura_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE asientos_contables ENABLE ROW LEVEL SECURITY;
ALTER TABLE asientos_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sifen_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE libros_obligatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE activos_fijos ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciacion_activos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_tes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinkcar_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_manual_chunks ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ───────────────────────────────────────
-- Tenant isolation: users can only see their own tenant's data

CREATE POLICY "tenant_isolation" ON profiles
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON clients
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON vehiculos
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON ordenes_trabajo
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON orden_servicios
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON orden_repuestos
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON repuestos
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON herramientas
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON control_herramientas
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON facturas
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON factura_detalles
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON plan_cuentas
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON asientos_contables
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON asientos_detalle
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON fiscal_documentos
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON sifen_sync_log
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON notificaciones
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON crm_sync_log
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON sucursales
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON tenant_config
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON libros_obligatorios
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON activos_fijos
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON depreciacion_activos
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON cuentas_bancarias
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON movimientos_tes
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON mechanic_profiles
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON staff_profiles
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON commission_records
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON fixed_expenses
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON thinkcar_imports
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY "tenant_isolation" ON vehicle_manual_chunks
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- ─── Role-Based Policies ─────────────────────────────────
-- Mechanics can only read/edit their assigned OTs

CREATE POLICY "mechanic_own_orders" ON ordenes_trabajo
  FOR ALL USING (
    assigned_mechanic_id = auth.uid()
    OR current_setting('app.current_role') IN ('admin', 'manager')
  );

-- Cashiers can only access billing modules

CREATE POLICY "cashier_billing_access" ON facturas
  FOR ALL USING (
    current_setting('app.current_role') IN ('admin', 'manager', 'user')
  );

-- ═══════════════════════════════════════════════════════════
--  12. FUNCTIONS (Supavisor Transaction Mode)
-- ═══════════════════════════════════════════════════════════

-- Function to set current tenant (for RLS)
CREATE OR REPLACE FUNCTION set_current_tenant(tenant_uuid UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant', tenant_uuid::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set current role (for RBAC)
CREATE OR REPLACE FUNCTION set_current_role(role_name TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_role', role_name, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════
--  END OF CONSOLIDATED MIGRATION
-- ═══════════════════════════════════════════════════════════
