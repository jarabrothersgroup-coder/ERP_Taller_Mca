-- 0018: Prevent duplicate invoice numbers across tenants
-- UNIQUE on (tenant_slug, numero_factura_manual) WHERE numero_factura_manual IS NOT NULL
ALTER TABLE facturas
  ADD CONSTRAINT uq_facturas_numero_manual
  UNIQUE (tenant_slug, numero_factura_manual);
