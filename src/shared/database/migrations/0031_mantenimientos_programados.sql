-- 0031_mantenimientos_programados.sql — ficha de próximos mantenimientos
--
-- Auditoría 2026-09-25 · Fase 4 (T-43 / SRV-03): no existía tabla donde
-- persistir el próximo mantenimiento al completar una OT; la "ficha de
-- próximos mantenimientos" era solo una predicción en memoria que inventaba
-- el odómetro. Idempotente (IF NOT EXISTS).
--
--   origen: OT_COMPLETADA (generada al pasar la OT a "Listo") | MANUAL | PREDICCION
--   estado: PENDIENTE | REALIZADO | CANCELADO
--
-- FKs con ON DELETE: vehiculo en cascade (la ficha es derivada del vehículo),
-- orden en set null (la ficha sobrevive si la OT se purga).

CREATE TABLE IF NOT EXISTS mantenimientos_programados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id uuid NOT NULL REFERENCES vehiculos (id) ON DELETE CASCADE,
  orden_trabajo_id uuid REFERENCES ordenes_trabajo (id) ON DELETE SET NULL,
  servicio text NOT NULL,
  km_objetivo integer,
  fecha_objetivo date,
  estado text NOT NULL DEFAULT 'PENDIENTE',
  origen text NOT NULL DEFAULT 'OT_COMPLETADA',
  recordatorio_enviado boolean NOT NULL DEFAULT false,
  recordatorio_enviado_at timestamptz,
  tenant_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mantenimientos_programados_estado_chk
    CHECK (estado IN ('PENDIENTE', 'REALIZADO', 'CANCELADO')),
  CONSTRAINT mantenimientos_programados_origen_chk
    CHECK (origen IN ('OT_COMPLETADA', 'MANUAL', 'PREDICCION'))
);

CREATE INDEX IF NOT EXISTS mantenimientos_programados_tenant_idx
  ON mantenimientos_programados (tenant_slug);
CREATE INDEX IF NOT EXISTS mantenimientos_programados_vehiculo_idx
  ON mantenimientos_programados (vehiculo_id);
CREATE INDEX IF NOT EXISTS mantenimientos_programados_pendientes_idx
  ON mantenimientos_programados (tenant_slug, estado, recordatorio_enviado);
