-- Migration 0027: orden_estado_historial — historial inmutable de estados de OT
-- Fase 3 · T-31/T-33 — integridad transaccional + trazabilidad.
--
-- Contexto: el esquema Drizzle (workshop/schema/orden-estado-historial.ts) ya
-- definía esta tabla, pero NUNCA se migró. El INSERT de `updateOrdenStatus`
-- estaba envuelto en try/catch, así que el fallo quedaba silenciado y el
-- estado cambiaba sin registro. T-31 removió ese try/catch (la escritura del
-- historial vive dentro de la transacción: o se registra todo, o no cambia
-- nada), lo que dejó el defecto a la vista.
--
-- Idempotente (IF NOT EXISTS) para poder aplicarla sobre bases donde la tabla
-- haya sido creada manualmente.

CREATE TABLE IF NOT EXISTS orden_estado_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_trabajo_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  estado_anterior TEXT,
  estado_nuevo TEXT NOT NULL,
  usuario_id TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orden_estado_historial_orden_idx
  ON orden_estado_historial (orden_trabajo_id);
