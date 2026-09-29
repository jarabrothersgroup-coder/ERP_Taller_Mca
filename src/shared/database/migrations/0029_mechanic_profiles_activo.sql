-- Migration 0029: mechanic_profiles.activo — baja lógica de mecánicos
-- Fase 4 · T-42 — "DELETE mecánicos (soft)".
--
-- Contexto: el plan pedía una baja SOFT para mecánicos. Borrar la fila
-- destruiría el historial financiero (commission_records depende de ella
-- con ON DELETE CASCADE), así que se añade una bandera `activo` en lugar
-- de eliminar registros: el perfil de la persona (profiles) y sus
-- comisiones se conservan.
--
-- Idempotente (IF NOT EXISTS) para poder aplicarla sobre bases donde la
-- columna haya sido creada manualmente.

ALTER TABLE mechanic_profiles
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
