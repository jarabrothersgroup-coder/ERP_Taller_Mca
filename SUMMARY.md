## Objective
- Update on-prem server with all changes, explore it, sync repo, backup frontend, prepare i3/8GB PC provisioning, resolve production GAP, fix login 500 bug, implement strict RLS activation — then build a real test suite + CI (keystone) before any further risky changes.

## Important Details
- Server `192.168.18.104` (Fedora 44, PG 18, `erp-taller.service`, Tailscale `100.104.144.92`). SSH `jara`/`202360`. Tunnel `localhost:5432` → prod (needs `erp_user`/`erp_prod_password`, not jara). `.env` has stale `erp_dev_password` (wrong for tunnel); tests use shell `DATABASE_URL` with `erp_prod_password` + `?sslmode=disable`.
- `DATABASE_URL`: `postgresql://erp_user:erp_prod_password@localhost:5432/automotive_os?sslmode=disable` (must include `?sslmode=disable` or TLS fails on tunnel).
- Subagent delegation BROKEN: `@oracle`/`@fixer` fail with "Model not found" → all work done directly by orchestrator.
- Backend auth on-prem: login JWT HS256, scrypt hashing. RLS as defense-in-depth via `scripts/apply-rls.sql` (64 tables, `''` escape, non-regressive).
- `web/` is CLOUD (Vercel/Railway, Clerk). On-prem serves SPA `src/shared/public/` at `/dashboard`. nginx `/api` → `:3000`.
- SELinux Enforcing: nginx needs `setsebool -P httpd_can_network_connect on`.
- Architecture: 88 tables, single migration `0000_sharp_rocket_raccoon.sql`, `tenant_slug` isolation. `configs/ca-erp-taller.crt` + `configs/sssd-client.conf` server-specific, not in repo.
- **RLS decision (user)**: keep as defense-in-depth; do NOT do the `sql.begin()` per-request transaction refactor yet — too risky without a test suite. Deferred.
- **Test infra**: `vitest.config.ts` → `tests/**/*.test.ts`, pool forks. 64 test files. `tsconfig.json` includes ONLY `src/**/*` (tests excluded from `tsc --noEmit`). `erp_user` lacks CREATEDB → no local test DB possible; CI uses postgres:18 service container (superuser).
- `src/config/env.ts` loads `.env` via dotenv when `NODE_ENV !== "production"` (does NOT override existing shell vars). `getDb()` reads `process.env.DATABASE_URL`.
- `drizzle-kit migrate` reads `process.env.DATABASE_URL` but its dotenv loads `.env` and overrides shell var → local migrate hits prod. CI has no `.env`, so `DATABASE_URL` from CI env is used correctly.
- `resolveTenant` only validates slug format (no DB query). `resolveProfile` queries `profiles` only when a header is present; missing profile = no throw (just no `request.profile`). So DB-dependent tests need a reachable migrated DB but not specific seed rows.

## Work State
### Completed
- Explored server, backed up frontend (`/data/backups/frontend-20260712.tar.gz`) + DB (`/data/backups/db-20260712.dump`).
- RLS applied live; systemd timers (`erp-backup.timer`, `erp-healthcheck.timer`); nginx TLS live; `TOKEN_SECRET` set.
- Commits `50eb5e6`, `aa5904e`, `d2fcf47` (login 500 fix) pushed to `origin/main`; server at `d2fcf47`.
- **Login 500 FIXED + VERIFIED live** (commit `d2fcf47`): `require()`→ESM imports in `validation.ts`, `rate-limiter.ts`, `security-headers.ts`, `backup-engine.service.ts`. Invalid input → 422, wrong password → 401. `sifen-crypto.service.ts` worker `require` left untouched.
- `scripts/provision-i3.sh` + `docs/RUNBOOK_ONPREM.md` written.
- **KEYSTONE DONE — test suite + CI:**
  - Baseline was 1345/1408 pass, 63 fail across 8 files.
  - Fixed 4 files (sprint18/19/20/36): re-pointed stale per-sprint migration refs to `0000_sharp_rocket_raccoon.sql`; sprint18 RLS tests now verify `scripts/apply-rls.sql` content; sprint19/20 verify live schema via `information_schema`.
  - Verified the other 4 failing files (e2e-workflow, sprint28, sprint31, sprint45-46) are read-only against DB (e2e/sprint28 SELECT only; sprint31/sprint45-46 mock db) → all pass against prod with no seed needed.
  - **Full suite GREEN: 1406/1406 tests across 64 files, 0 failures** (run against prod, read-only).
  - `tsc --noEmit` clean (exit 0) — tests excluded from tsconfig.
  - Created `.github/workflows/ci.yml` (postgres:18 service → migrate → apply-rls → seed → vitest → typecheck) and `scripts/seed-test.sql` (idempotent test tenants `test-tenant`/`taller-test` + client `test@example.com`).
  - **Committed `6796b5a` and PUSHED to `origin/main`** (test fixes + CI + seed).

### Active
- None — keystone complete, committed, and pushed.

### Blocked
- (none).

## Sprint 69 Plan — Multi-tenant SaaS

### Objetivo
Establecer la fundación para SaaS multi-tenant: Billing integration, API documentation, y email transaccional.

### Tareas
| ID | Tarea | Estado | Archivos |
|:---|:------|:------:|:---------|
| S69-1 | Billing Module Enhancement (Stripe) | IN_PROGRESS | `src/modules/billing/*` |
| S69-2 | API Documentation (Swagger) | PLANNED | `src/app.ts` |
| S69-3 | Email Transaccional | PLANNED | `src/modules/email/*` |

### Criterios de Éxito
- ✅ Stripe billing funcional en test mode
- ✅ API documentation accesible en /docs
- ✅ Email notifications enviadas al crear facturas

### Next Move
- Completar S69-1: Billing module con webhooks y suscripciones
- Push a origin/main después de completar sprint

## Relevant Files
- `src/shared/schemas/validation.ts`, `src/shared/services/rate-limiter.ts`, `src/shared/middleware/security-headers.ts`, `src/modules/backup/services/backup-engine.service.ts`: ESM `require` fixes (committed `d2fcf47`).
- `src/modules/finance/services/sifen/sifen-crypto.service.ts`: worker `require` — correct, untouched.
- `tests/sprint18-security.test.ts`: RLS tests verify `scripts/apply-rls.sql` content (current_tenant, FORCE RLS, `''` escape).
- `tests/sprint19.test.ts`: `0000_sharp_rocket_raccoon.sql`; servicios_catalogo columns via `information_schema`.
- `tests/sprint20.test.ts`: factura_detalles table/columns/indexes via `information_schema`.
- `tests/sprint36.test.ts`: consolidated migration check (sucursales, dvi_inspections only).
- `.github/workflows/ci.yml`: CI (postgres:18 service, migrate, apply-rls, seed-test.sql, test, typecheck). Committed `6796b5a`.
- `scripts/seed-test.sql`: idempotent test seed (committed `6796b5a`).
- `src/shared/database/migrations/0000_sharp_rocket_raccoon.sql`: canonical single migration (88 tables).
- `src/shared/database/connection.ts`: `getDb()` postgres client.
- `src/config/env.ts`: dotenv load (non-prod), reads `process.env.DATABASE_URL`.
- `src/shared/middleware/tenant-resolver.ts`: validates slug format only (no DB).
- `src/shared/middleware/rbac.ts`: `resolveProfile` queries `profiles` only with header; missing = no throw.
- `drizzle.config.ts`: reads `process.env.DATABASE_URL` (but drizzle-kit dotenv overrides with `.env` locally).
- `/tmp/askpass.sh`: SSH password helper (`202360`).
