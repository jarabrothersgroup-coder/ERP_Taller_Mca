-- Migration 0011: Fixed Assets + Depreciation Tracking
--
-- Adds tables for finance-level fixed asset management and
-- depreciation tracking, with auto-generated accounting entries.
--
-- Dependencies: migration 0010 (tenant_config)

-- ─── ENUMs ─────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tipo_activo_fijo AS ENUM (
    'EQUIPO_DIAGNOSTICO',
    'HERRAMIENTA_ESPECIAL',
    'VEHICULO_SERVICIO',
    'MAQUINARIA_TALLER',
    'MUEBLE_ENSAYRE',
    'INFORMATICA',
    'INMUEBLE',
    'OTRO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE metodo_depreciacion_af AS ENUM (
    'LINEA_RECTA',
    'DIGITO_CRECIENTE',
    'DIGITO_DECRECIENTE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE estado_activo_fijo AS ENUM (
    'ACTIVO',
    'EN_REPARACION',
    'RETIRADO',
    'VENDIDO',
    'DADO_DE_BAJA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Activos Fijos ───────────────────────────

CREATE TABLE IF NOT EXISTS "activos_fijos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_slug" text NOT NULL,
  "codigo" text NOT NULL,
  "nombre" text NOT NULL,
  "tipo" tipo_activo_fijo NOT NULL,
  "marca" text,
  "modelo" text,
  "numero_serie" text,

  -- Contables
  "fecha_adquisicion" timestamptz NOT NULL,
  "costo_adquisicion" numeric(14,2) NOT NULL DEFAULT '0',
  "valor_residual" numeric(14,2) NOT NULL DEFAULT '0',
  "vida_util_anos" integer NOT NULL DEFAULT 5,
  "metodo_depreciacion" metodo_depreciacion_af NOT NULL DEFAULT 'LINEA_RECTA',
  "valor_actual_libros" numeric(14,2) NOT NULL DEFAULT '0',
  "depreciacion_acumulada" numeric(14,2) NOT NULL DEFAULT '0',
  "ultima_depreciacion" timestamptz,
  "estado" estado_activo_fijo NOT NULL DEFAULT 'ACTIVO',
  "cuenta_gasto_depreciacion_id" uuid,
  "cuenta_depreciacion_acumulada_id" uuid,
  "activo" boolean NOT NULL DEFAULT true,
  "notas" text,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS activos_fijos_codigo_unique
  ON activos_fijos (codigo, tenant_slug);
CREATE INDEX IF NOT EXISTS activos_fijos_tenant_idx
  ON activos_fijos (tenant_slug);
CREATE INDEX IF NOT EXISTS activos_fijos_tipo_idx
  ON activos_fijos (tipo);
CREATE INDEX IF NOT EXISTS activos_fijos_estado_idx
  ON activos_fijos (estado);

-- ─── Depreciación de Activos ─────────────────

CREATE TABLE IF NOT EXISTS "depreciacion_activos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "activo_fijo_id" uuid NOT NULL REFERENCES activos_fijos(id) ON DELETE CASCADE,
  "asiento_id" uuid,
  "periodo" text NOT NULL,
  "fecha" timestamptz NOT NULL,
  "valor_inicial" numeric(14,2) NOT NULL,
  "monto_depreciacion" numeric(14,2) NOT NULL,
  "valor_final" numeric(14,2) NOT NULL,
  "depreciacion_acumulada" numeric(14,2) NOT NULL,
  "tenant_slug" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dep_activos_periodo_unique
  ON depreciacion_activos (activo_fijo_id, periodo);
CREATE INDEX IF NOT EXISTS dep_activos_activo_idx
  ON depreciacion_activos (activo_fijo_id);
CREATE INDEX IF NOT EXISTS dep_activos_tenant_idx
  ON depreciacion_activos (tenant_slug);
