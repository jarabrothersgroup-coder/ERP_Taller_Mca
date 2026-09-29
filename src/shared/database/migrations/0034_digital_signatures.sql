-- 0034_digital_signatures.sql — firmas digitales de autorización
--
-- Auditoría 2026-09-25 · Fase 4 (T-48) · clase de fallo T-42.
--
-- `workshop/signature.service.ts` hace INSERT y SELECT contra `digital_signatures`
-- desde hace tiempo, pero la tabla NUNCA fue creada: no hay migración que la
-- declare ni entrada en el esquema Drizzle. Resultado, ambas rutas devuelven 500:
--
--   POST /workshop/signatures          -> 42P01 relation "digital_signatures" does not exist
--   GET  /workshop/signatures/:ordenId -> 42P01 relation "digital_signatures" does not exist
--
-- Es exactamente el patrón que T-42 ya encontró y corrigió dos veces
-- (migraciones 0028 y 0030): código que compila, tipa y se registra, y que solo
-- falla cuando alguien lo ejecuta. Por eso `GET /workshop/signatures/:ordenId`
-- figuraba entre los endpoints sin consumidor — con la tabla ausente, cualquier
-- intento de exponerlo en la UI habría fallado en el primer clic.
--
-- Se declara con SQL crudo (igual que el servicio) y no con Drizzle, para no
-- inventar un schema que el código no importa: el servicio ya fija las columnas.
--
-- Idempotente: no hace nada si la tabla ya existe.

CREATE TABLE IF NOT EXISTS digital_signatures (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- OT a la que pertenece la firma. ON DELETE CASCADE: al anular una OT sus
  -- firmas dejarían de tener sentido, y son datos de la orden, no del cliente.
  orden_trabajo_id uuid NOT NULL
                     REFERENCES ordenes_trabajo (id) ON DELETE CASCADE,

  -- 'AUTORIZACION' | 'CHECKIN' | 'ENTREGA' | 'APROBACION_SERVICIO'
  tipo             text NOT NULL,

  -- Traza de la firma tal cual la devuelve el canvas del cliente.
  firma_base64     text NOT NULL,

  -- El que firma puede no estar dado de alta como cliente (acompañante, dueño
  -- que nunca dejó ficha). Por eso estos campos son texto libre y no una FK.
  cliente_nombre     text,
  cliente_documento  text,
  observaciones      text,

  tenant_slug      text NOT NULL,

  created_at       timestamptz NOT NULL DEFAULT now()
);

-- El service filtra SIEMPRE por (orden_trabajo_id, tenant_slug) — sin estos
-- índices cada GET de firmas es un seq scan sobre la tabla.
CREATE INDEX IF NOT EXISTS digital_signatures_orden_idx
  ON digital_signatures (orden_trabajo_id);

CREATE INDEX IF NOT EXISTS digital_signatures_tenant_idx
  ON digital_signatures (tenant_slug, orden_trabajo_id);
