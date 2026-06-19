-- Migration 0021: Factura Detalle — Line items for hybrid invoices
-- Sprint 20 — Invoice line items from OT services/repuestos
--
-- Creates factura_detalles table to store individual service and parts
-- line items for each invoice. Generated automatically when issuing
-- an invoice from a work order.

-- ═══════════════════════════════════════════════════
--  1. Factura Detalle Table
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS factura_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  numero_linea INT NOT NULL,
  tipo_linea TEXT NOT NULL,  -- SERVICIO | REPUESTO
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(12,2) NOT NULL,
  precio_unitario NUMERIC(14,2) NOT NULL,
  iva INT NOT NULL DEFAULT 10,
  iva_monto NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL,
  orden_servicio_id UUID,
  orden_repuesto_id UUID,
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS factura_detalles_factura_id_idx ON factura_detalles (factura_id);
CREATE INDEX IF NOT EXISTS factura_detalles_tenant_slug_idx ON factura_detalles (tenant_slug);
