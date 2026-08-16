-- 0021_email_unique_por_tenant
--
-- Multi-tenant design fix: the same email address may now exist in DIFFERENT
-- tenants (e.g. an accountant that manages two workshops), but never twice
-- within the same tenant.
--
-- The global constraint `profiles_email_unique` (UNIQUE(email)) was a design
-- limitation: one email could only belong to one tenant platform-wide. Login
-- and profile resolution are already scoped by (tenant_id, email), so relaxing
-- the constraint does not weaken auth — it only widens what is allowed.
--
-- Safe to apply: any data valid under the global unique constraint is also
-- valid under the per-tenant unique constraint (a stricter → weaker relaxation).
-- In the (impossible) case a duplicate (tenant_id, email) pair already exists,
-- this migration fails loudly and must be resolved first.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS "profiles_email_unique";

ALTER TABLE public.profiles
  ADD CONSTRAINT "profiles_tenant_id_email_unique" UNIQUE ("tenant_id", "email");
