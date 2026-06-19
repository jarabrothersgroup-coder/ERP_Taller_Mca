-- ─────────────────────────────────────────────────────────
-- AutomotiveOS Cloud ERP — PostgreSQL Initialization
-- ─────────────────────────────────────────────────────────
-- Este script se ejecuta automáticamente al levantar el
-- contenedor de PostgreSQL por primera vez.
--
-- Crea las bases de datos necesarias para:
--   - automotive_os (ERP principal)
--   - twenty_crm (Twenty CRM)
--   - evolution_api (Evolution API)
-- ─────────────────────────────────────────────────────────

-- ─── Create databases ──────────────────────────────────
CREATE DATABASE twenty_crm;
CREATE DATABASE evolution_api;

-- ─── ERP Schema Extensions ─────────────────────────────
-- Las tablas del ERP se crean con Drizzle ORM via migraciones.
-- Este script solo crea extensiones y datos iniciales.

\c automotive_os;

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── WhatsApp Error Log Table (ETAPA 5) ────────────────
-- Tabla separada para errores de integración WhatsApp/CRM
-- que NO bloquea la transacción comercial principal.
CREATE TABLE IF NOT EXISTS whatsapp_errors_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Contexto de la operación
    operation VARCHAR(50) NOT NULL,           -- 'send_message', 'create_instance', 'get_qr', 'crm_sync'
    source VARCHAR(50) NOT NULL,              -- 'whatsapp', 'twenty_crm'
    
    -- Datos de la orden/cliente afectado
    orden_id UUID,
    client_name VARCHAR(255),
    phone_number VARCHAR(20),
    
    -- Error details
    error_code VARCHAR(50),                   -- HTTP status code o error interno
    error_message TEXT NOT NULL,              -- Mensaje descriptivo del error
    error_stack TEXT,                         -- Stack trace (solo en desarrollo)
    
    -- Request/Response context
    request_url VARCHAR(500),
    request_method VARCHAR(10),
    response_status INTEGER,
    response_body TEXT,                       -- Respuesta completa del API externo
    
    -- Tenant + User
    tenant_slug VARCHAR(100) NOT NULL,
    triggered_by VARCHAR(255),               -- Email del usuario que provocó la operación
    
    -- Retry info
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Resolution
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255),
    resolution_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for error log queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_errors_operation ON whatsapp_errors_log(operation);
CREATE INDEX IF NOT EXISTS idx_whatsapp_errors_source ON whatsapp_errors_log(source);
CREATE INDEX IF NOT EXISTS idx_whatsapp_errors_tenant ON whatsapp_errors_log(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_whatsapp_errors_unresolved ON whatsapp_errors_log(resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_whatsapp_errors_created ON whatsapp_errors_log(created_at DESC);

-- ─── Twenty CRM Sync Log ───────────────────────────────
-- Registro de sincronizaciones ERP → Twenty CRM
CREATE TABLE IF NOT EXISTS crm_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Sync context
    operation VARCHAR(50) NOT NULL,           -- 'upsert_contact', 'add_note', 'update_vehicle'
    direction VARCHAR(20) DEFAULT 'erp_to_crm',
    
    -- ERP side
    orden_id UUID,
    client_id UUID,
    client_name VARCHAR(255),
    
    -- Twenty CRM side
    twenty_contact_id VARCHAR(100),           -- ID del contacto en Twenty
    twenty_object_name VARCHAR(100),          -- 'person', 'company', etc.
    twenty_record_id VARCHAR(100),            -- ID del registro creado/actualizado
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',     -- pending, success, failed, retrying
    error_message TEXT,
    
    -- Payload sent to Twenty
    request_payload JSONB,
    response_payload JSONB,
    
    -- Tenant
    tenant_slug VARCHAR(100) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_crm_sync_status ON crm_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_crm_sync_tenant ON crm_sync_log(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_crm_sync_orden ON crm_sync_log(orden_id);

-- ─── WhatsApp Error Log Function ───────────────────────
-- Función para registrar errores sin bloquear la transacción
CREATE OR REPLACE FUNCTION log_whatsapp_error(
    p_operation VARCHAR,
    p_source VARCHAR,
    p_orden_id UUID DEFAULT NULL,
    p_client_name VARCHAR DEFAULT NULL,
    p_phone_number VARCHAR DEFAULT NULL,
    p_error_code VARCHAR DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_error_stack TEXT DEFAULT NULL,
    p_request_url VARCHAR DEFAULT NULL,
    p_request_method VARCHAR DEFAULT NULL,
    p_response_status INTEGER DEFAULT NULL,
    p_response_body TEXT DEFAULT NULL,
    p_tenant_slug VARCHAR DEFAULT 'unknown',
    p_triggered_by VARCHAR DEFAULT 'system'
) RETURNS UUID AS $$
DECLARE
    v_error_id UUID;
BEGIN
    INSERT INTO whatsapp_errors_log (
        operation, source, orden_id, client_name, phone_number,
        error_code, error_message, error_stack,
        request_url, request_method, response_status, response_body,
        tenant_slug, triggered_by
    ) VALUES (
        p_operation, p_source, p_orden_id, p_client_name, p_phone_number,
        p_error_code, p_error_message, p_error_stack,
        p_request_url, p_request_method, p_response_status, p_response_body,
        p_tenant_slug, p_triggered_by
    ) RETURNING id INTO v_error_id;
    
    RETURN v_error_id;
END;
$$ LANGUAGE plpgsql;

-- ─── CRM Sync Function ────────────────────────────────
CREATE OR REPLACE FUNCTION log_crm_sync(
    p_operation VARCHAR,
    p_orden_id UUID DEFAULT NULL,
    p_client_id UUID DEFAULT NULL,
    p_client_name VARCHAR DEFAULT NULL,
    p_tenant_slug VARCHAR DEFAULT 'unknown'
) RETURNS UUID AS $$
DECLARE
    v_sync_id UUID;
BEGIN
    INSERT INTO crm_sync_log (
        operation, orden_id, client_id, client_name, tenant_slug, status
    ) VALUES (
        p_operation, p_orden_id, p_client_id, p_client_name, p_tenant_slug, 'pending'
    ) RETURNING id INTO v_sync_id;
    
    RETURN v_sync_id;
END;
$$ LANGUAGE plpgsql;

-- ─── Seed Data (Development) ──────────────────────────
-- Default tenant para desarrollo
INSERT INTO whatsapp_errors_log (operation, source, error_message, tenant_slug)
VALUES ('init', 'system', 'Database initialized successfully', 'taller-el-chero')
ON CONFLICT DO NOTHING;
