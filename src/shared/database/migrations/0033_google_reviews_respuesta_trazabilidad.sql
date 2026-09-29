-- 0033_google_reviews_respuesta_trazabilidad.sql — quién y cuándo respondió
--
-- Auditoría 2026-09-25 · Fase 4 (T-46 / CRM-02).
--
-- `google_reviews` solo tenía un booleano `responded` + el texto. No había
-- forma de saber cuándo se respondió, ni qué empleado lo hizo: en un taller la
-- respuesta a una reseña negativa es una pieza de servicio al cliente que
-- después se audita ("¿cuándo y quién contestó la reseña del lunes?").
--
-- Idempotente: no hace nada si las columnas ya existen.

ALTER TABLE google_reviews
  ADD COLUMN IF NOT EXISTS respondido_at timestamptz;

ALTER TABLE google_reviews
  ADD COLUMN IF NOT EXISTS respondido_por uuid;

-- Un booleano `responded` puede quedar en true sin respuesta, o al revés, si
-- alguien escribe por SQL suelto. El CHECK ata ambos estados.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'google_reviews'::regclass
      AND conname = 'google_reviews_responded_consistency'
  ) THEN
    ALTER TABLE google_reviews
      ADD CONSTRAINT google_reviews_responded_consistency
      CHECK (
        (responded = true  AND respuesta IS NOT NULL AND btrim(respuesta) <> '')
        OR (responded = false)
      );
  END IF;
END $$;

-- Índice parcial para el panel de "pendientes de responder": la consulta más
-- frecuente del módulo y sobre la minority de filas (respondido = false).
CREATE INDEX IF NOT EXISTS greviews_pendientes_idx
  ON google_reviews (tenant_slug, fecha DESC)
  WHERE responded = false;
