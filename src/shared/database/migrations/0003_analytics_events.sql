-- Migration 0003: analytics_events table for event tracking
-- Created for Sprint 71 (event-tracker service)

CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_slug" text NOT NULL,
  "event_type" text NOT NULL,
  "event_name" text NOT NULL,
  "user_id" text,
  "properties" jsonb DEFAULT '{}',
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for fast querying by tenant, type, date, and name
CREATE INDEX IF NOT EXISTS "idx_analytics_events_tenant" ON "analytics_events" ("tenant_slug");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_type" ON "analytics_events" ("event_type");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_created" ON "analytics_events" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_name" ON "analytics_events" ("event_name");

-- Composite index for common query pattern: tenant + type + date range
CREATE INDEX IF NOT EXISTS "idx_analytics_events_tenant_type_date"
  ON "analytics_events" ("tenant_slug", "event_type", "created_at");

-- RLS policy for multi-tenant isolation
ALTER TABLE "analytics_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_events_tenant_isolation" ON "analytics_events"
  USING ("tenant_slug" = current_setting('app.current_tenant', true));
