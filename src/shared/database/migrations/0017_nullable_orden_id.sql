-- Migration 0017: Make facturas.orden_id nullable for fleet billing
-- Fleet contract invoices are not tied to work orders.

ALTER TABLE facturas ALTER COLUMN orden_id DROP NOT NULL;
