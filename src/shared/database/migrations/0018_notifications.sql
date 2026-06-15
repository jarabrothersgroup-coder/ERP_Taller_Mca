-- Migration 0018: Notifications table
-- Sprint 13 — In-app alerts for workshop events

CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  leido BOOLEAN NOT NULL DEFAULT false,
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS notif_tenant_idx ON notificaciones(tenant_slug);
CREATE INDEX IF NOT EXISTS notif_leido_idx ON notificaciones(leido);
CREATE INDEX IF NOT EXISTS notif_tipo_idx ON notificaciones(tipo);
CREATE INDEX IF NOT EXISTS notif_tenant_leido_idx ON notificaciones(tenant_slug, leido);
