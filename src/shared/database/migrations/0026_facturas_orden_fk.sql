-- Migration 0026: FK facturas.orden_id → ordenes_trabajo.id
-- Fase 3 · T-34 (CRM-01) — integridad fiscal.
--
-- Objetivo: 0 registros fiscales huérfanos.
--   1) Desvincula huérfanos preexistentes (orden_id que ya no existe) → NULL,
--      el caso que el esquema ya soporta ("fleet billing / manual imports").
--   2) ON DELETE RESTRICT: una factura jamás pierde (ni sobrevive a) su OT.
--      Complementa la guarda de aplicación en `deleteClient()`, que rechaza
--      borrar clientes que aún poseen órdenes de trabajo.

UPDATE facturas
SET orden_id = NULL
WHERE orden_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ordenes_trabajo o WHERE o.id = facturas.orden_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'facturas_orden_id_ordenes_trabajo_fk'
      AND conrelid = 'facturas'::regclass
  ) THEN
    ALTER TABLE facturas
      ADD CONSTRAINT facturas_orden_id_ordenes_trabajo_fk
      FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo (id)
      ON DELETE RESTRICT;
  END IF;
END $$;
