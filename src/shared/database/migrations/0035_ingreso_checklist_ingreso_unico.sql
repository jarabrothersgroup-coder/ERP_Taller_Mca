-- 0035_ingreso_checklist_ingreso_unico.sql — un checklist por ingreso
--
-- Auditoría 2026-10-02 · Sprint 105 · candidato (e) / T-61.
--
-- `workshop/services/ingreso.service.ts::guardarChecklist` escribe contra
-- `ingreso_checklist` con un UPSERT:
--
--   .onConflictDoUpdate({ target: ingresoChecklist.ingresoId, ... })
--
-- Postgres exige que el objetivo del ON CONFLICT tenga un índice único o de
-- exclusión. `ingreso_checklist` sólo declaraba PRIMARY KEY (id) más dos
-- índices NO únicos, así que la sentencia falla siempre:
--
--   ERROR: there is no unique or exclusion constraint matching
--          the ON CONFLICT specification
--
-- Traducido a la API: POST /workshop/ingresos/:id/checklist devolvía 500 en el
-- 100% de los casos. El endpoint figuraba como "cubierto" para el escaneo de
-- consumidores (otro par GET lo toca), mientras que la escritura —la parte que
-- importa en recepción— estaba muerta. El checklist de reception nunca se
-- guardó, y por extensión tampoco hay firma de retiro que completar.
--
-- El UNIQUE es además la invariante correcta del dominio: un ingreso es una
-- sola visita de recepción, con un único checklist firmado. Sin él, el
-- intención del upsert de "reenviar el checklist actualiza" se convertiría en N filas y
-- `guardarFirmaRetiro` (que hace UPDATE ... WHERE ingreso_id = $1) escribiría
-- sobre todas a la vez.
--
-- Idempotente: si el índice ya existe no hace nada. Antes de crearlo se
-- colapsan duplicados históricos (conservando la fila más reciente), para que el
-- propio UNIQUE no falle en bases que ya acumularon repeatidos.

-- 1. Colapsar duplicados previos: conservar la fila con created_at más reciente.
DELETE FROM ingreso_checklist a
  USING ingreso_checklist b
 WHERE a.ingreso_id = b.ingreso_id
   AND (a.created_at, a.id) < (b.created_at, b.id);

-- 2. El invariante que el UPSERT ya asumía.
CREATE UNIQUE INDEX IF NOT EXISTS ingreso_checklist_ingreso_unq
  ON ingreso_checklist (ingreso_id);