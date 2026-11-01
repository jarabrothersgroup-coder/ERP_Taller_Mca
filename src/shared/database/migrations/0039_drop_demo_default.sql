-- 0039_drop_demo_default.sql — retiro del default "demo" (S132-31 / S132-5)
--
-- El default text 'demo' en repuestos.tenant_slug y herramientas.tenant_slug
-- era la trampa de runtime que el fallback tenant 'demo' (S132-2) escondía:
-- una fila insertada sin tenantSlug quedaba silenciosamente asignada a un
-- taller fantasma y el aislamiento multi-tenant se rompía. El default deja de
-- existir a nivel de schema (Drizzle ya no lo declara) y aquí se borra de la
-- base para que un INSERT sin tenant_slug falle ruidosamente (NOT NULL).
--
-- Los seeds (scripts/seed-parts-catalog.ts, seed-tools-equipment.ts) ahora
-- pasan tenantSlug explícito (SEED_TENANT_SLUG, default "demo" sólo en el
-- script, nunca en la BD).
--
-- Idempotente: DROP DEFAULT no falla si ya no hay default.
ALTER TABLE public.repuestos     ALTER COLUMN tenant_slug DROP DEFAULT;
ALTER TABLE public.herramientas  ALTER COLUMN tenant_slug DROP DEFAULT;
