-- Minimal seed for the test / CI database (idempotent).
-- Creates the tenants and a client that the integration tests expect
-- (e2e-workflow uses "test-tenant"; sprint45-46 portal-auth uses
-- "taller-test" + client test@example.com). Reference-data seeds
-- (vehicle_types, fuel_types, pricing rules) live in seed-0020-*.sql.

INSERT INTO tenants (id, name, slug, schema_name, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-0000000000a1',
  'Test Tenant',
  'test-tenant',
  'tenant_test_tenant',
  true,
  now(),
  now()
), (
  '00000000-0000-0000-0000-0000000000a2',
  'Taller Test',
  'taller-test',
  'tenant_taller_test',
  true,
  now(),
  now()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO clients (id, name, email, phone, tenant_slug, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-0000000000b1',
  'Test Client',
  'test@example.com',
  '123456789',
  'taller-test',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;
