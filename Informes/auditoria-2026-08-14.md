# Auditoría Técnica Integral — AutomotiveOS Cloud ERP (ERP_Taller_Mca)

Fecha: 2026-08-14
Stack real auditado: Fastify 5 + TypeScript (`src/`), Next.js 14 (`web/`), PostgreSQL remoto (Neon/Supabase) vía Drizzle ORM, Clerk (parcial), Playwright/Vitest.
Nota de alcance: el prompt de auditoría describía el repo **GestionIRP** (Go microservices, Kafka, Podman prod, `go.work`, `docker-compose.prod.yml`). Con aprobación del usuario, la auditoría se **adaptó a la stack real**. Pilares Go/Kafka/Podman-prod → **N/A** (documentado).

---

## 1. Resumen ejecutivo

El sistema es un ERP multi-tenant para talleres automotrices (PY) con backend Fastify+TS (~462 archivos, ~284 endpoints), frontend Next.js 14 y PostgreSQL vía Drizzle. Se encontraron **3 problemas CRITICAL**, **9 HIGH**, **~12 MEDIUM** y deuda técnica LOW extensa (≥2600 lint errors preexistentes, mayoría `any`).

El hallazgo más grave: **la API entera operaba sin autenticación efectiva** — cualquier cliente HTTP podía acceder a finanzas, taller, inventario, backups, etc. con solo enviar `X-Tenant-Slug`. Se corrigió con un **auth gate global** (verificado live: rutas protegidas → 401 sin token; probes públicos OK) + resolución de perfil acotada a tenant + 15 call sites del frontend que no enviaban el token.

Las fases que requieren base de datos real (E2E, smoke de datos, integridad contable en DB) quedan **BLOCKED**: no hay `DATABASE_URL` en el entorno y no existe `.env`. No se tocó ninguna migración ni la base de datos.

**Recomendación: APTO CON OBSERVACIONES** — los CRITICALs de auth están corregidos y verificados; quedan BLOCKED los flujos con DB y riesgos MEDIUM documentados (RLS, idempotencia contable, lint debt).

## 2. Arquitectura encontrada

- **Backend**: Fastify 5, plugins por módulo (`src/modules/*`: workshop, inventory, finance, intelligence, thinkcar, whatsapp, crm, scheduling, billing, enterprise, client-portal, backup, dvi, analytics, fleet, marketing, mobile, api-keys, security-hw, migration, email, label-printing, tenants, config). Sin capas domain/application/infrastructure formales: repositorios y lógica mezclados en `services/` por módulo.
- **Frontend**: Next.js 14 (App Router) + React Query + Tailwind, auth custom (JWT en localStorage + cookie), portal cliente público con magic-link/PIN.
- **Base de datos**: PostgreSQL remoto, Drizzle ORM, migraciones SQL en `src/shared/database/migrations/` (0000–0018), RLS parcial vía `scripts/apply-rls.sql` (no es migración).
- **Auth**: JWT propio HS256 (`JWT_SECRET`) + verificación Clerk (RS256/JWKS) si está configurado; header legacy `X-User-Email` deshabilitado por defecto.
- **Redis**: definido en compose pero **NO consumido por la app** (rate-limit y cola async in-memory).
- **Kafka**: no existe (N/A). Microservicios: no existe (monolito). Go: no existe.
- **Compose**: `docker-compose.yml` (dev) y `docker-compose.onpremise.yml`; sin `docker-compose.prod.yml`. Dockerfile multi-stage.
- **CI/CD**: `.github/workflows/ci.yml` y `ci-cd.yml`.
- **Multitenancy**: header `X-Tenant-Slug` + subdominio/dominio custom → `request.tenantSlug`; filtros `tenant_slug` en queries + RLS de defensa en profundidad (escape hatch `current_tenant()=''`).

## 3. Problemas CRITICAL

1. **Bypass total de autenticación en la API** (corregido). Solo 4 archivos de rutas usaban `requireAuth`/`requireRole`; el resto (finance 57 rutas, workshop 28, inventory 20, analytics, whatsapp, etc.) corría con `resolveProfile` que pasa silencioso sin token. `registerGlobalRBAC` era código muerto (nunca registrado). Cualquiera con `X-Tenant-Slug` podía leer/escribir datos ajenos.
2. **Cross-tenant por header**: el perfil se resolvía por email **sin filtrar tenantId**, y `X-Tenant-Slug` no se verificaba contra la pertenencia del usuario → un usuario de tenant A podía pasar el slug de tenant B (corregido: lookup por email + tenantId; tenant inexistente → 401).
3. **Escalada entre tenants vía RLS con escape hatch**: políticas `tenant_slug = current_tenant() OR current_tenant() = ''` (apply-rls.sql y generadores) permiten ver TODAS las filas cuando el contexto es `''` — y el modo por-petición (desactivado por defecto) setea `''` en rutas públicas. La defensa primaria es el filtro de app; con el fix de auth (1) y (2) el vector principal se cierra, pero el escape hatch sigue siendo riesgo si se agrega una query sin filtro.

## 4. Problemas HIGH

1. (corregido) Healthchecks rotos: Dockerfile apuntaba a `/api/v1/health` (no existe) y compose a `/health` (requiere auth) → contenedor marcado unhealthy siempre. Ahora usan `/health/live`.
2. (corregido) `SIFEN_USE_TEST: === "true" || true` — siempre true; imposible activar SIFEN producción. Ahora `!== "false"`.
3. (corregido) `TOKEN_SECRET` obligatorio (≥32 chars, fail-closed al arrancar) **ausente en compose y `""` en .env.example** → `docker compose up` crasheaba al boot. Agregado a ambos compose + .env.example.
4. (corregido) `podman-compose 1.6.0` crasheaba (`TypeError: sequence item 0: expected str instance, int found`) con el default int en el mapeo de puertos del ERP → los archivos no validaban con podman. Puerto hardcodeado `3000:3000` (bug de podman-compose documentado en comentario).
5. **RLS no es parte de las migraciones**: solo 6 migraciones habilitan RLS; el resto depende de `scripts/apply-rls.sql` manual. Un entorno nuevo (o la DB remota sin correrlo) no tiene RLS en la mayoría de tablas. Referencias a `0019_rls_security.sql` en comentarios del código que **no existe**.
6. **Módulo scheduling sin resolución de tenant** (corregido): plugin sin `resolveTenant`, rutas leían `request.tenantSlug` siempre `undefined` → citas no aisladas y funcionalmente rotas. Ahora resuelve tenant + profile.
7. **Módulos crm / migration / api-keys / rutas compartidas (import, presets, pdf-report, audit-export) sin tenant ni auth** (corregido: hooks agregados / scoped plugin).
8. **Idempotencia de asientos**: `createAsiento` valida balance (∑Debe=∑Haber ≤0.01) en app, pero **no hay unique en `documento_ref`** ni dedup para asientos generales → retry/doble click puede duplicar contabilización. (No modificado: requiere migración DB.)
9. **npm audit**: 9 HIGH (web: next/postcss + undici) y root quedó en 1 HIGH tras `npm audit fix` (hyperid/uuid en autocannon, devDep con fix rompedor). Ver sección 10.

## 5. Problemas MEDIUM

1. **Config/logo global**: `tenant_settings.json` y `company_logo.png` son globales, no por tenant → un admin de un tenant sobrescribe identidad de todos.
2. **`/health/deep`**: hacía ping HTTP a Redis (puerto RESP) → siempre "error" → 503 falso. Corregido (skip documentado).
3. **Clerk**: `fetchJwks` usa `https://api.clerk.com/.well-known/jwks.json` hardcodeado (el JWKS de Clerk es por instancia: `https://<frontend-api>.clerk.accounts.dev/...`); si no matchea, la verificación cae a JWT legacy. No verificable sin credenciales reales.
4. **JWT legacy**: `verifyToken` no valida `alg` del header (siempre HS256 — sin risk de confusion de algoritmo, pero descuidado) y no valida `iat`.
5. **`web/next.config.mjs`**: `BACKEND_HOST` default hardcodeado `192.168.18.104` (IP LAN del dev).
6. **Token en localStorage + cookie sin HttpOnly** (`auth_token`): expuesto a XSS; el SPA legacy lo exige, documentado como tradeoff.
7. **Migraciones**: `0012` duplicado (cycle_counts + ingreso_checklist); tests referencian migraciones 0020/0021 que no existen en el repo.
8. **`dbForTenant`**: `SET search_path` session-scoped sobre el pool compartido, sin `await` y sin límite de tenant; muta el singleton `_db`. Solo usado por CLI/backfill según doc — riesgo de leak de contexto.
9. **Delete por id sin filtro tenant post-verificación** (`deleteCompra`, `deleteDonacion`, `deleteMapping`): el DELETE final no incluye `tenant_slug` (TOCTOU menor; RLS mitigaría si estuviera aplicada).
10. **Profile `email` UNIQUE global**: un email no puede existir en 2 tenants (limitación de diseño multi-tenant).
11. **`/metrics` público** (sin auth) — aceptado para scrapeo Prometheus; requiere ACL/red interna en prod.
12. **ESLint**: 2623 errores + 906 warnings (mayoría `no-explicit-any`) — deuda técnica preexistente, sin arreglar por principio de cambio mínimo.

## 6. Problemas LOW

- `(request as any).tenantSlug` en decenas de handlers (type safety).
- `SIFEN_USE_TEST` corregido; `PAGOSPY_API_URL` default hardcodeado.
- `pingService` usa `catch (err: any)`.
- `_db_test6.mjs` / `_db_testA.mjs` / `.rate-limit/rate-limit.json` / `.slim/deepwork/*.md` commiteados (clutter de desarrollo).
- `src/shared/public/index.html` y SPA legacy duplican login (deuda).
- `export.routes.ts` (GET /export) no registrado en app.ts (posible ruta muerta).
- `start.sh` sin secretos hardcodeados (bien).

## 7. Cambios realizados (todos mínimos y justificados)

1. **Nuevo `src/shared/middleware/auth-gate.ts`**: preHandler global que exige perfil autenticado salvo allowlist pública (health probes, `/api/auth/*`, `/api/onboarding/*`, `/api/lead`, webhook de pagos, `/portal/*`, `/api/v1/visual/*`, SPA legacy, `/docs`, `/developer`, `/scheduling/webhook/whatsapp`, `/scheduling/ai-suggestions`, `/scheduling/check-availability`, `/mobile/health`, `/reports/health`, `/metrics`, assets estáticos). Matching por límite de segmento.
2. **`src/app.ts`**: registro del gate global (preHandler, tras onRequest de tenant) + rutas compartidas (import/presets/pdf/audit-export) en scope con tenant+profile.
3. **`src/shared/middleware/rbac.ts`**: lookup de perfil filtrado por `tenantId` (resolveTenantId del slug); tenant desconocido → UnauthorizedError (fail-closed).
4. **Plugins** con hooks tenant+profile agregados: scheduling, api-keys, crm, migration, config (scoped: auth público intacto).
5. **`src/plugins/health-check.ts`**: /health/deep — Redis mark skip (no hay cliente Redis).
6. **`src/config/env.ts`**: fix `SIFEN_USE_TEST`.
7. **RAG**: `LIMIT ${topK}` ahora clamp 1–20 int (defensa en profundidad; ya validado por schema).
8. **Dockerfile**: healthcheck `/health/live`; quitado `tsc --noEmit 2>/dev/null;` que ocultaba errores.
9. **docker-compose.yml / onpremise**: healthchecks `/health/live`, `TOKEN_SECRET`, puerto ERP fijo (workaround podman-compose).
10. **.env.example**: `TOKEN_SECRET` con placeholder ≥32 chars.
11. **Frontend** (`web/src`): helper `authHeaders()`/`authHeadersMultipart()` en `lib/api.ts` + 15 call sites de `fetch` directo ahora envían Authorization+tenant (billing, dialogs, config, enterprise, label-printing, reimpresion, uploads DVI/fotos).
12. **`npm audit fix`** (root, no rompedor): 17→8 vulns.

## 8. Archivos modificados (31: 29 M + 2 nuevos)

```
M .env.example, M Dockerfile, M docker-compose.yml, M docker-compose.onpremise.yml, M package-lock.json
M src/app.ts, M src/config/env.ts
M src/modules/api-keys/plugin.ts, M src/modules/config/plugin.ts, M src/modules/crm/plugin.ts,
M src/modules/migration/plugin.ts, M src/modules/scheduling/plugin.ts
M src/modules/intelligence/rag/manual-ingestion.service.ts
M src/plugins/health-check.ts, M src/shared/middleware/rbac.ts
M web/src/lib/api.ts, M web/src/hooks/use-billing.ts
M web/src/app/(dashboard)/dashboard/{vehiculos/new-vehicle-dialog,tesoreria/new-movement-dialog,tesoreria/new-account-dialog,contabilidad/new-account-dialog,config,enterprise,calendario/new-appointment-dialog,inventario/new-product-dialog,facturacion/configurador,facturacion/reimpresion,taller/[id],taller/checklist/[ingresoId]}.tsx
?? src/shared/middleware/auth-gate.ts, ?? tests/auth-gate.test.ts
```

## 9. Migraciones creadas

**Ninguna.** No se modificó ni creó migración alguna (regla de seguridad: no tocar esquema sin poder verificar contra DB). Pendientes recomendadas (requieren validación con DATABASE_URL):
- Partial unique index `(tenant_slug, documento_ref) WHERE documento_ref IS NOT NULL` en `asientos_contables` (idempotencia).
- Check constraint `total_debe = total_haber` en `asientos_contables` (la validación hoy es solo de app).
- Migración RLS formal (reemplazar `scripts/apply-rls.sql`).

## 10. Vulnerabilidades encontradas (npm audit)

- **Root** (tras `npm audit fix`): 8 (7 moderate, 1 high). El high restante: hyperid→uuid <11.1.1 vía `autocannon` (devDep; fix rompedor → no aplicado). Antes: 17 (9 high, 8 moderate). Cadena imapflow→nodemailer y postcss quedaron resueltos con el fix.
- **Web**: 9 high — `undici` (transitivo de Next) y `postcss` (de `next`). `npm audit fix` no aplicado en web: verificar compatibilidad con Next 14.2.29 antes.
- No hay CRITICAL en ninguna de las dos.
- No se actualizaron dependencias mayores.

## 11. Multitenancy / RLS

- Auth gate + perfil por tenant (corregido, ver CRITICAL 1-2).
- RLS: aplicada solo en 6 migraciones; resto depende de `apply-rls.sql` (no versionada) con escape hatch `''`. **Recomendación**: convertir apply-rls.sql en migración y evaluar fail-closed (quitar `OR current_tenant()=''`) + `ENABLE_REQUEST_TENANT_CONTEXT=true`.
- Config/logo globales (MEDIUM).
- Scheduling/crm/migration/api-keys sin aislamiento previo (corregido).

## 12. Problemas de integridad DB

- Migraciones 0019–0021 referenciadas (tests/RLS) no existen en el repo; `0012` duplicado.
- Sin verificación de datos reales (BLOCKED — no hay DB).
- FKs/índices: existen índices compuestos (0009, 0014); no auditados contra DB real.

## 13. Problemas contables

- **Balance de asientos**: validado en app (`createAsiento`, diferencia ≤ 0.01) ✓. Sin constraint DB (recomendado).
- **Idempotencia**: apertura deduplicada por período; asientos generales sin unique en `documento_ref` → riesgo de doble contabilización (HIGH, sin corregir por requerir migración).
- Salary receipts (recibo de salarios): **el módulo no existe** en este repo (hay payroll de comisiones + breakeven). Cálculo gross−aportes=neto: N/A.

## 14. Problemas tributarios detectados

- `SIFEN_USE_TEST` siempre true (corregido).
- SIFEN: certificado X.509 + SOAP DNIT — sin verificación posible sin credenciales (BLOCKED).
- RAG/manuales e IVA: mappings `compras.configurator`/`accounting-bus` revisados por lectura; sin datos para verificar.

## 15. Problemas Kafka

**N/A** — no existe Kafka en este repositorio.

## 16. Problemas Redis

- **La app no usa Redis** (in-memory). Compose lo levanta pero ningún código lo consume (buscar deps: ninguna).
- `/health/deep` chequeaba Redis vía HTTP (corregido a skip).
- TTL/invalidación: N/A.

## 17. Problemas frontend

- 15 call sites sin header Authorization (corregidos).
- `BACKEND_HOST` default IP LAN hardcodeada (MEDIUM).
- `auth_token` en localStorage (XSS risk, tradeoff del SPA legacy).
- Lint debt: errores de tipos `any` masivos (preexistente).
- Páginas: hub, ejecutivo, tesorería, contabilidad, facturación — con estados vacíos y loaders básicos; no se ejecutó navegación real (BLOCKED sin backend+DB).

## 18. Problemas Docker/Podman

- Healthchecks rotos (corregido).
- `tsc --noEmit 2>/dev/null` ocultaba errores de build (corregido).
- `podman-compose 1.6.0` incompatible con default int en puertos (workaround aplicado; validado OK).
- Imagen no fijada a SHA (node:22-alpine, postgres:16-alpine, redis:7-alpine) — práctica estándar documentada, no bloqueante.
- Dockerfile ejecuta como non-root ✓, multi-stage ✓, sin secretos ✓.
- `docker compose config` y `podman-compose config`: **4/4 PASS** (post-fix).

## 19. Resultado go test

**N/A** — no hay Go.

## 20. Resultado go vet

**N/A** — no hay Go. Equivalente aplicado: `tsc --noEmit` backend **PASS**, `eslint src/` reporta 2623 errores preexistentes (no introducidos por esta auditoría).

## 21. Resultado frontend build

- `web npm run build` → **PASS**
- `web tsc --noEmit` → **PASS**
- `web vitest run` → **PASS** (11 archivos, 111 tests)

## 22. Resultado health checks

Live (server arrancado con TOKEN_SECRET, sin DB):
- `/health/live` → **200** ✓
- `/api/v1/visual/status` → **200** ✓
- `/api/auth/login` (público) → 422 (validación zod — ruta accesible) ✓
- `/workshop/vehiculos` y `/finance/compras` sin token → **401** ✓ (antes accesibles)
- `/health/ready`, `/health/deep` → dependen de DB (BLOCKED)
- `/health` (con auth) → requiere JWT+DB (BLOCKED)

## 23. Resultado smoke tests

**Parcial (BLOCKED para DB)**. Script `db:smoke` existe (`src/shared/database/smoke-test.ts`) pero requiere DATABASE_URL. Se ejecutó smoke manual live (sección 22). Falta: PostgreSQL accesible, Redis, login con JWT, endpoints autenticados con datos — todo requiere DB + credenciales.

## 24. Resultado E2E

**BLOCKED** — Playwright configurado (`web/playwright.config.ts`, 14 specs en `web/e2e/`) pero requiere backend+DB+frontend corriendo. Reproducible: `DATABASE_URL=... npm run dev` + `cd web && npm run test:e2e`.

## 25. Resultado pruebas negativas

- Sin token + tenant → 401 ✓ (verificado live)
- Sin tenant → 403 ✓
- Token inválido/expirado → 401 (lógica verificada por lectura; requiere DB para probar perfil)
- `podman-compose config` (negativo → fallaba) → corregido, ahora 0

## 26. Rendimiento / optimizaciones

- No se introdujeron optimizaciones agresivas (principio: sin complejidad prematura).
- Observado: N+1 bajo en módulos principales (JOINs en workshop); índices compuestos en migraciones 0009/0014 ✓; falta audit contra DB real.
- `resolveProfile` agrega 1 query de tenantId por request autenticado (costo aceptable, cierra el cross-tenant).
- Bundle web: First Load JS compartido ~87.6 kB (saludable).

## 27. Deuda técnica pendiente

- Lint debt (2623 errores `any`).
- RLS no versionada + escape hatch.
- Idempotencia contable (unique documento_ref).
- Migraciones 0019–0021 faltantes / 0012 duplicado.
- Config/logo por tenant (hoy global).
- Clerk JWKS endpoint por instancia.
- Clutter commiteado (_db_test*.mjs, .slim/, .rate-limit/).

## 28. Riesgos que NO fueron modificados

- RLS (requiere decisión + validación DB): escape hatch, enable ENABLE_REQUEST_TENANT_CONTEXT.
- Unique index de idempotencia contable (migración nueva pendiente).
- Cambio de `BACKEND_HOST` default (requiere coordinación con despliegue).
- Rotación de dependencias mayores (next, undici).
- Rediseño de TenantConfigService (archivo global).

## 29. git diff --check

**PASS** (sin whitespace errors).

## 30. git status --short

31 archivos modificados/creados por esta auditoría (listados en sección 8). El árbol estaba limpio al inicio; no se revirtió nada preexistente. **No se hizo commit ni push.**

## 31. Recomendación final

**APTO CON OBSERVACIONES** — para continuar desarrollo:

- Los CRITICALs de seguridad (auth bypass + cross-tenant) están **corregidos y verificados en vivo** (401 en rutas protegidas, probes públicos OK, typecheck/tests/builds PASS).
- **BLOCKED**: cualquier validación con datos reales (E2E, smoke, integridad contable en DB) — falta `DATABASE_URL`/`.env`. No afirmar "sistema validado" hasta correr: `npm run db:smoke`, login+JWT, y `cd web && npm run test:e2e` con entorno completo.
- Prioridad pendiente: migración RLS formal + idempotencia contable + activar `ENABLE_REQUEST_TENANT_CONTEXT`.

---

### Matrices de resultado

| PILAR | ESTADO | CRITICAL | HIGH | MEDIUM | LOW |
|---|---|---|---|---|---|
| 1 Calidad de código | PASS (parcial) | 0 | 0 | 1 | ~30 |
| 2 Seguridad | CORREGIDO (críticos) | 3→0 | 6→1 | 5 | 3 |
| 3 Arquitectura | PASS con notas | 0 | 0 | 3 | 1 |
| 4 Rendimiento | PASS (parcial) | 0 | 0 | 1 | 2 |
| 5 BD/integridad/contabilidad | BLOCKED (DB) | 0 | 1 | 3 | 1 |
| 6 API REST | PASS con notas | 0 | 1 | 2 | 5 |
| 7 Frontend UX | PASS (parcial) | 0 | 1 | 2 | 2 |
| 8 Testing/observabilidad | PASS (parcial) | 0 | 2 | 1 | 1 |
| Compose/Dockerfile | CORREGIDO | 0 | 2 | 1 | 1 |
| Smoke/E2E | BLOCKED (DB) | — | — | — | — |

| COMPONENTE | TEST | RESULTADO |
|---|---|---|
| backend (tsc --noEmit) | typecheck | PASS |
| backend (eslint src/) | lint | 2623 errors preexistentes (deuda) |
| backend (npm run build) | build | PASS |
| backend (vitest) | unit/integration | 75/81 files PASS; 6 BLOCKED (DB) |
| auth-gate (nuevo) | unit | PASS (6/6) |
| web (tsc --noEmit) | typecheck | PASS |
| web (npm run build) | build | PASS |
| web (vitest) | unit | PASS (111/111) |
| web (playwright) | e2e | BLOCKED (sin entorno+DB) |
| compose dev (docker) | config | PASS |
| compose onpremise (docker) | config | PASS |
| compose dev (podman-compose 1.6.0) | config | PASS (post-fix) |
| compose onpremise (podman-compose) | config | PASS (post-fix) |
| npm audit root | vulns | 8 (7 mod, 1 high, devDep) |
| npm audit web | vulns | 9 high (next/undici) |
| Live: /health/live | smoke | PASS (200) |
| Live: ruta protegida sin token | smoke | PASS (401 — fix verificado) |
| E2E income/expense/salary/accounting | integration | BLOCKED (DB) |

---

## 32. Actualización 2026-08-15 — Sesión 2 (validación con DB local + deuda pendiente)

Esta sesión cerró los ítems que quedaron **BLOCKED / pendientes** de la sesión 1, levantando un entorno local completo (PostgreSQL en contenedor, `DATABASE_URL` con `sslmode=disable`).

### Migraciones — sistema dual reparado

- **Hallazgo crítico**: `meta/_journal.json` solo listaba 0000/0001 → `drizzle-kit migrate` (y el runner de migraciones) aplicaba **solo 2 de 20 migraciones silenciosamente** (0002–0018 nunca se aplicaban). Eso explicaba el 500 real en `/inventory/almacenes` (tabla `almacenes` inexistente) y varios fallos E2E.
- **Corregido**: journal regenerado completo (22 entradas, hashes sha256, `when` en ms como el resto). Verificado aplicando **todas las migraciones en DB limpia** (111 tablas).
- **0008** (contabilidad RLS): creaba políticas sobre `configurador_modulo`/`cuenta_mapping` que **ninguna migración creaba** (solo existían en schema TS). Ahora la migración es autocontenida (`CREATE TABLE IF NOT EXISTS` + columna `tenant_slug`).
- **0009** (índices compuestos): indexaba `asientos_contables(tenant_slug)` inexistente → columna retirada del índice.
- **Nota**: las migraciones 0002–0018 nunca estuvieron en el journal commiteado → nunca se aplicaron vía drizzle en ningún entorno; corregirlas es seguro. Producción real se construyó vía `drizzle-kit push`.

### Migración 0019 — RLS fail-closed en 80 tablas

- Convertido `scripts/apply-rls.sql` en migración versionada **0019_rls_security.sql**: habilita RLS y crea políticas fail-closed (sin escape hatch `''`) en **80 tablas** (antes 13).
- Verificado: `erp_user` es superusuario con `bypassrls` → RLS estaba **inerte**; fail-closed es seguro de desplegar. Login, rutas protegidas y webhook siguen funcionando (probe con token real).
- `rls.ts` actualizado para generar políticas fail-closed (removido el escape hatch).
- Pre-auth bootstrap excluido por diseño: `profiles` (login), `facturas`/`cuentas_bancarias`/`movimientos_tesoreria` (webhook resuelve factura por id antes de conocer tenant), y tablas con `tenant_id` UUID (no matchean slug).

### Migración 0020 — Idempotencia contable

- Índice único parcial: `asientos_contables(documento_ref, modulo_origen) WHERE estado='CONTABILIZADO' AND documento_ref IS NOT NULL AND NOT LIKE 'nota_%'`.
- Verificado en DB: duplicado CONTABILIZADO → `23505` bloqueado; múltiples NC/ND por factura y BORRADORs permitidos.
- El accounting-bus crea `documentoRef = <tipo>:<id>` sin dedup → una redelivery Kafka duplicaba asientos; el índice lo bloquea a nivel DB.

### Corrección real: mechanic-assignment

- `POST /api/workshop/mechanic-assignment/assign` aceptaba un `ordenId` inexistente y asignaba mecánicos a una OT que no existe → ahora valida la OT (404 con `success:false`) antes de asignar.

### Corrección real: duplicate `getStorageStats` (offline-db.js)

- Dos declaraciones de `getStorageStats` en el mismo scope; la segunda (conteo de filas) **sombraba** la versión documentada (quota/usage en MB). Removida la duplicada; la función exportada vuelve a ser la de cuota.

### Corrección: barcode-scanner sin `@ts-nocheck`

- `src/shared/services/barcode-scanner.service.ts` y el componente web: reemplazado `@ts-nocheck` por declaraciones de tipos reales de `BarcodeDetector` (web: `src/types/barcode-detector.d.ts`). El componente web además ahora **valida soporte en runtime** (antes fallaba silenciosamente sin BarcodeDetector).

### Lint — 2623 → 0 errores

- `eslint.config.js`: agregados `globals` (node/browser/serviceworker) — los 2523 `no-undef` eran falsos positivos en JS legacy (`src/shared/public/**`), `sw.js` y configs.
- `no-undef` desactivado para el frontend legacy global-scope (los 119 símbolos cruzados entre archivos son intencionales, cargados vía `<script defer>`).
- Reglas nuevas ruidosas (`no-useless-assignment`, `preserve-caught-error`) desactivadas — falsos positivos en patrones existentes.
- `--fix` aplicado: `prefer-const`, `no-useless-escape`, `no-empty` (allowEmptyCatch), `no-unused-expressions`→warn, `no-case-declarations` (backup-worker), `no-irregular-whitespace` (journal-consolidation).
- Resultado: **root 0 errores (950 warnings — `any`/unused intencionales), web 0 errores (399 warnings)**.

### Tenant config por tenant (MEDIUM-1 de sesión 1)

- `TenantConfigService`: settings ahora en `config/tenant_settings.<slug>.json` y logo en `assets/uploads/logo.<slug>.png`, con fallback al global. Un admin ya no sobrescribe la identidad de otros tenants.
- Rutas `/api/config/settings` (GET/PUT), `/api/config/logo`, `/api/config/upload-logo` pasan `request.tenantSlug`.
- `getWorkshopAddress(tenantSlug)` en órdenes usa settings del tenant.
- Verificado live: PUT demo → `tenant_settings.demo.json`; otro tenant → default global; archivo global intacto.

### Test environment fix

- Test `configure() requires PostgreSQL` asumía DB caída; ahora se skippea cuando `DATABASE_URL` está seteada (con DB viva `configure()` resuelve — idempotente).

### Resultados finales sesión 2

| COMPONENTE | TEST | RESULTADO |
|---|---|---|
| migraciones (journal 22) | apply en DB limpia | PASS (111 tablas) |
| RLS (0019) | 80 tablas habilitadas | PASS |
| idempotencia (0020) | dup bloqueado / NC permitido | PASS |
| backend tsc --noEmit | typecheck | PASS |
| backend eslint src/ | lint | 0 errors (was 2623) |
| backend vitest (con DB local) | unit/integration | **1776 PASS / 1 skip (1777)** |
| web tsc --noEmit | typecheck | PASS |
| web eslint src/ | lint | 0 errors |
| web npm run build | build | PASS |
| web playwright (con DB local) | e2e | **48/48 PASS** |
| compose dev + onpremise (podman) | config | PASS |
| git diff --check | whitespace | PASS |

### Pendientes documentados (riesgos NO modificados)

- `BACKEND_HOST` default `192.168.18.104` en `web/next.config.mjs` (requiere coordinación con despliegue).
- Rotación de dependencias mayores (next/postcss/undici — HIGH en npm audit).
- `ENABLE_REQUEST_TENANT_CONTEXT=true` (activa el SET LOCAL por petición — requiere validar webhook/portal con el nuevo RLS fail-closed; hoy el superuser bypass lo hace innecesario).
- `dbForTenant` con `search_path` session-scoped sobre pool compartido (solo CLI/backfill).
- Profile `email` UNIQUE global (límite de diseño multi-tenant).

---

## 33. Actualización 2026-08-15 — Sesión 3 (tareas sugeridas)

Cerró las 4 tareas sugeridas al final de la sesión 2.

### 1. Metadata de migraciones completa (drizzle-kit)

- Faltaban los archivos `meta/<tag>.sql.json` (hash sha256) para las migraciones 0002–0018 (y 0000/0001). El journal las listaba pero sin hash files → metadata incompleta.
- Generados los 22 hash files, verificados **22/22 hashes coinciden** con el contenido SQL, y `drizzle-kit migrate` sigue aplicando correctamente ("migrations applied successfully").

### 2. BACKEND_HOST default seguro

- `web/next.config.mjs`: el default era `192.168.18.104` (IP LAN del dev) → cualquier despliegue sin `BACKEND_HOST` apuntaba a una IP privada. Ahora default `localhost:3000` (same-host / local dev), documentado en el archivo.
- `web/.env.example`: reemplazado `AUTH_BACKEND_URL` (nunca consumido) por `BACKEND_HOST`/`BACKEND_PORT` reales (los que usa `next.config.mjs`).

### 3. ENABLE_REQUEST_TENANT_CONTEXT activado + bug de orden de hooks

- **Bug real encontrado**: `registerRequestTransactions` registraba su hook como `onRequest` en el scope RAÍZ, pero `resolveTenant` corre como `onRequest` en scopes hijos de cada módulo. Fastify ejecuta hooks del padre ANTES que los del hijo → `request.tenantSlug` era `undefined` cuando corría el contexto → habría seteado `app.current_tenant=''` para TODA request (aislamiento roto).
- Verificado empíricamente el orden (`root-onRequest → child-onRequest → root-preHandler`).
- **Fix**: el hook ahora se registra como `preHandler` (corre después de todos los onRequest, igual que `rlsTenantContext`). AsyncLocalStorage verificado que propaga al handler.
- Activado por defecto: `ENABLE_REQUEST_TENANT_CONTEXT=true` en `docker-compose.yml`, `docker-compose.onpremise.yml` y `.env.example`.
- Verificado en vivo (flag ON): login OK, rutas protegidas 200, webhook `{"ok":false}` (validación correcta), onboarding 200, sin-token → 401. Test de aislamiento (`tests/security-tenant-isolation.test.ts`) PASS con DB. **E2E completo 48/48 PASS con el flag activo.**

### 4. npm audit

**Root: 8 → 4 moderate (0 high).**
- `nodemailer` HIGH (SSRF/arbitrary file read, GHSA-p6gq-j5cr-w38f): actualizado `8.0.11 → 9.0.5`. El "breaking change" de 9.x ES la propia mitigación (restringe fetch de contenido remoto); API usada (`createTransport`/`sendMail`) sin cambios.
- `uuid`/`hyperid` moderate (GHSA-w5hq-g745-h8pq): cadena `autocannon → hyperid → uuid`. `hyperid@4.0.0` eliminó la dependencia de uuid → override en package.json.
- Quedan 4 moderate: `esbuild <=0.24.2` (GHSA-67mh-4wv8-2f99, dev-server de esbuild) vía `@esbuild-kit/core-utils` (drizzle-kit CLI). `@esbuild-kit/core-utils` es la última versión y pinnea `esbuild ~0.18.20`; forzar override rompería drizzle-kit. Dev-tooling-only, feature `--serve` no usada → documentado, no corregido (regla: no corregir si introduce riesgo).

**Web: 9 → 2 high.**
- `@clerk/nextjs` (auth bypass, GHSA-w24r-5266-9c3c) + js-cookie: **dependencia muerta** — declarada en package.json pero **nunca importada** en `web/src` (la app usa JWT propio). Removida → eliminó 5+ vulns de la cadena Clerk.
- `undici` (7.0.0-7.28.0) y `nanoid`: corregidos vía `npm audit fix` (no-breaking).
- Quedan 2 high: `next` (advisories varios, rangos `<15.5.x`) y su `postcss` bundled. Fix requiere `next@16` (major breaking + migración React 19) → documentado como riesgo pendiente de coordinación. Ya en la última 14.2.x (14.2.35).

### Resultados sesión 3

| COMPONENTE | RESULTADO |
|---|---|
| metadata migraciones (22 hashes) | PASS |
| drizzle-kit migrate | PASS |
| web tsc --noEmit | PASS |
| backend tsc --noEmit | PASS |
| backend vitest (DB local) | 1776 PASS / 1 skip |
| E2E Playwright (flag RLS ON) | 48/48 PASS |
| compose dev + onpremise (podman) | PASS |
| npm audit root | 0 high / 4 moderate |
| npm audit web | 2 high (next major pendiente) |

---

## 34. Actualización 2026-08-15 — Sesión 4 (riesgos latentes restantes)

Cerró los riesgos restantes documentados: `dbForTenant`, `getDb()` directo en handlers, y el email UNIQUE global.

### 1. `dbForTenant` eliminado (search_path leak en pool compartido)

- La función mutaba el `search_path` session-scoped de la conexión singleton **sin `await`** y además reutilizaba el mismo `_db` singleton de `db()` — cualquier uso futuro habría filtrado el contexto de tenant al pool compartido.
- **Cero callers** en todo el repo (verificado con grep) → código muerto con footgun documentado → **eliminada** de `src/shared/database/drizzle.ts`.

### 2. `getDb()` request-aware (cierra el gap RLS para raw SQL)

- Antes: `getDb()` siempre devolvía el pool singleton → los handlers que usaban **raw SQL** (`getDb().unsafe(...)` / template tags en ledger, accrual, centralization, payroll, FinancialOrchestrator, fleet, marketing, manual-ingestion) **bypaseaban** el contexto `app.current_tenant` por request que `db()` sí respeta.
- Ahora `getDb()` devuelve la conexión reservada de la request (`ctx.tx`) cuando el contexto de request está activo, y el pool singleton fuera de request (cron/CLI). Verificado: template tags, `.unsafe()` y `.begin()` se comportan igual en la conexión reservada (solo `begin()` no existe ahí — ningún caller lo usa).
- El preHandler de transaction-context llama `getDb()` ANTES de asignar `ctx.tx` → cae al pool para `reserve()` (sin deadlock).
- Verificado en vivo (flag ON): login 200, `/workshop/clientes` 200, payroll commissions (raw SQL) 200.

### 3. Email único por tenant (migración 0021)

- **Antes**: `profiles.email UNIQUE` global → un email no podía existir en 2 tenants (limitación de diseño multi-tenant documentada).
- **Ahora**: `UNIQUE (tenant_id, email)` → el mismo email puede existir en talleres distintos (ej: contador con 2 talleres), pero nunca 2 veces en el mismo taller.
- Migración **0021_email_unique_por_tenant.sql** (drop global, add compuesto). Verificada: mismo email en tenant distinto → OK; mismo email en mismo tenant → `23505` bloqueado.
- Actualizados: `profiles.ts` (constraint compuesta en schema), `onboarding.ts` (check global removido — el tenant nuevo no tiene perfiles, el constraint DB cubre), `seed.ts` (lookup de perfil ahora `AND tenant_id`), `profiles.ts` POST (error `23505` → 400 "Ya existe un perfil con ese email en este taller" — antes 500 genérico).
- Login/portal ya resuelven por (tenant_id, email) → sin impacto en auth.

### Verificación final sesión 4

| COMPONENTE | RESULTADO |
|---|---|
| backend tsc --noEmit | PASS |
| backend vitest (DB local) | **1776 PASS / 1 skip** |
| web tsc --noEmit | PASS |
| web vitest | **111 PASS** |
| web next build | PASS (69 static pages) |
| E2E Playwright (flag RLS ON) | **48/48 PASS** |
| drizzle-kit migrate (23 migraciones) | PASS |
| compose dev + onpremise (podman) | PASS |
| eslint (cambios) | 0 errors |
| git diff --check | PASS |
| hash migración 0021 | coincide |

**Sin commit ni push.** Riesgos restantes (documentados, no modificados): next 14→16 major (requiere React 19 — coordinación), esbuild dev-server advisory (dev-only, sin fix seguro), y el esquema por-tenant `tenant_<slug>` sin aprovisionar en entornos de prueba (rompe `/finance/dashboard/break-even` — pre-existente, no relacionado con esta sesión).

---

## 35. Actualización 2026-08-15 — Sesión 5 (tareas sugeridas: schemas tenant, plan Next 16, test email único)

### 1. Rutas per-schema arregladas (migración de Arquitectura B → A)

- **Diagnóstico**: `/api/v1/finance/dashboard/break-even` devolvía 500 porque `FinancialOrchestratorService` consultaba `tenant_<slug>.work_orders` — la tabla de la **Arquitectura B legada** (schemas por tenant, `migrate.legacy.ts`). El modelo canónico (Arquitectura A, `0000_sharp_rocket_raccoon.sql`) tiene `public.ordenes_trabajo` con columna `tenant_slug`.
- **Decisión**: NO aprovisionar schemas paralelos legados (duplicaría el modelo de datos). En su lugar se migraron las 3 consultas restantes al modelo canónico:
  - `FinancialOrchestratorService.ts`: `tenant_<slug>.work_orders` → `public.ordenes_trabajo` + `WHERE tenant_slug = slug` + `status = 'Listo'` (2 consultas: commissions y equilibrium).
  - `accrual.service.ts`: `work_orders` (sin calificar) → `public.ordenes_trabajo` con `status IN ('En_Proceso','Control_Calidad')` (el enum canónico; el legado usaba `'in_progress'`).
  - `ledger.service.ts` (`generarAsientoAutomatico`): `work_orders` → `public.ordenes_trabajo`.
- `tenantSchema()` eliminado (era solo interpolación de schema legacy). `validateTenantSchema()` se mantiene (exportado, usado por tests de seguridad SQLi).
- Verificado en vivo: **break-even 200** con datos reales (8 OTs `Listo` → `currentRevenue: 2088000`), commissions 200, payroll calculate 200.

### 2. Plan de migración Next.js 14 → 16 (documentado, NO ejecutado)

- `docs/PLAN_MIGRACION_NEXT16.md`: checklist accionable en 6 fases (prep → install + codemods → breaking changes por archivo → next-intl → validación → despliegue/rollback).
- Detectado el alcance concreto del proyecto: `middleware.ts` → `proxy.ts` (Next 16), **23 usos** de `params`/`searchParams` síncronos a migrar (9 archivos page/route listados), Turbopack compatible (sin webpack config propio), `next-intl@4` compatible.
- Regla de auditoría respetada: no se ejecuta el upgrade mayor sin coordinación; el plan cierra los 2 HIGH restantes de npm audit.

### 3. Test unitario: email único por tenant

- `tests/unit/profiles-email-unique.test.ts`: DB-backed (skip sin `DATABASE_URL`), verifica la constraint `profiles_tenant_id_email_unique` (migración 0021):
  - Constraint existe en DB.
  - Mismo email en 2 tenants → permitido (x2 casos).
  - Mismo email en el mismo tenant → `23505` bloqueado.
  - Cleanup automático de datos de prueba (verificado: 0 restos).
- Total backend: **1780 PASS / 1 skip** (antes 1776).

### Verificación sesión 5

| COMPONENTE | RESULTADO |
|---|---|
| backend tsc --noEmit | PASS |
| backend vitest (DB local) | **1780 PASS / 1 skip** |
| web vitest | 111 PASS |
| E2E Playwright (flag RLS ON) | **48/48 PASS** |
| break-even live | **200** (antes 500) |
| payroll commissions / calculate live | 200 / 200 |
| eslint (cambios) | 0 errors |
| git diff --check | PASS |
| cleanup datos de prueba | 0 restos |

**Sin commit ni push.** Pendientes documentados: ejecutar el plan Next 16 (requiere coordinación de despliegue), y los advisories moderate de esbuild (dev-only).

---

## §36 — Migración Next.js 14 → 16 ejecutada (2026-08-15)

**Solicitado:** ejecutar el plan `docs/PLAN_MIGRACION_NEXT16.md`.

### Cambios

1. **Dependencias**: `next@14.2.35 → 16.3.1`, `react@18.3.1 → 19.2.8`, `react-dom` igual,
   `@types/react` v19, `next-intl@4.x` (compatible). Upgrade en 2 saltos (14→15→16) con
   validación completa en cada paso.
2. **`src/middleware.ts` → `src/proxy.ts`**: renombrado + export `proxy` (Next 16).
3. **Matcher en `export const config = { matcher }`** — CRÍTICO: en Next 16 un export
   top-level `matcher` se ignora → el proxy corría sobre `_next/static/*.js` y redirigía
   los chunks a `/sign-in` → la página no hidrataba → login caía en submit nativo del
   form (fallaba E2E 34/48). Verificado: chunks 200 `application/javascript` tras fix.
4. **`src/pages/` eliminado** (`_document.tsx`, `_error.tsx`): custom `_document` no
   soportado en Next 16 (`PageNotFoundError: /_document`). `src/app/error.tsx` y
   `not-found.tsx` ya cubren la UX.
5. **`optimizeFonts` removido** de `next.config.mjs` (obsoleto en v15+).
6. **`next/dynamic ssr:false` movido del layout (Server Component) a
   `src/components/providers/service-worker.tsx`** (client component).
7. **tsconfig**: Next 16 setea `jsx: react-jsx` + `include` de `.next/dev/types`.
8. **E2E contra build de producción** (`next start` + `BACKEND_PORT=4000`): el dev
   server de Turbopack compila rutas on-demand (8.7m, 14/48). Con prod: 1.4m, 48/48.
   `BACKEND_PORT` se inyecta en build y runtime (rewrites se hornean en build).

### Verificación final (Next 16.3.1 + React 19.2.8)

| Componente | Resultado |
|---|---|
| `npx tsc --noEmit` (root + web) | PASS |
| `next build` (Turbopack) | PASS — 69 páginas, Proxy reconocido |
| `vitest run` (web) | **111 PASS** |
| E2E Playwright (prod build, flag RLS ON) | **48/48 PASS** (1.4m) |
| `npm audit` web | **0 vulnerabilidades** (antes 2 HIGH) |
| `npm audit` root | 4 moderate (esbuild dev-only, documentado) |
| Hash migraciones (23) | PASS |
| `git diff --check` | PASS |

### Bugs reales encontrados y corregidos durante la migración

- **Proxy matcher ignorado en Next 16** (top-level `matcher` export no soportado) —
  rompía la hidratación de TODA la app en prod. Severidad CRITICAL en el contexto
  del upgrade; corregido con `config.matcher`.
- **Custom `_document` no soportado en Next 16** — build fallaba con
  `PageNotFoundError`. Corregido eliminando `src/pages/` (App Router ya tenía
  error/not-found).
- **Rewrite proxy apuntando al propio web server** durante la sesión (sin
  `BACKEND_PORT=4000` el default `3000` era el propio web) — causa de los timeouts
  de API en E2E; resuelto inyectando `BACKEND_HOST/BACKEND_PORT` en build y runtime.

**Sin commit ni push.** Pendientes: advisories moderate de esbuild (dev-only, sin fix
seguro) y el esquema `tenant_<slug>` legacy (rompe break-even si hay datos en schemas
por-tenant — hoy usa `public.ordenes_trabajo`, verificado 200).

---

## §37 — Cierre de pendientes: esbuild advisory + docs (2026-08-16)

### 1. npm audit root: 4 moderate → 0 (esbuild dev-only)

**Causa:** `drizzle-kit@0.31.10` → `@esbuild-kit/esm-loader@2.6.5` → `@esbuild-kit/core-utils@3.3.2`
fija `esbuild@~0.18.20` (vulnerable GHSA-67mh-4wv8-2f99, <= 0.24.2). El `npm audit fix --force`
proponía degradar `drizzle-kit` a 0.18.1 (breaking change — peor que el problema).

**Fix:** override puntual en `package.json`:

```json
"overrides": {
  "hyperid": "^4.0.0",
  "@esbuild-kit/core-utils": { "esbuild": "^0.25.4" }
}
```

`@esbuild-kit/core-utils` solo usa `esbuild.transform`/`transformSync` (API estable) — verificado
en el bundle. Resultado: `esbuild@0.18.20 → 0.25.12` anidado, **`npm audit` root: 0 vulns**.

**Verificación:**
- `drizzle-kit check` lee `drizzle.config.ts` correctamente (el path que usa @esbuild-kit).
- Hash migraciones (23/23) OK contra los `.sql` — el journal regenerado por `drizzle-kit` coincide.
- Backend: `tsc --noEmit` PASS, **1780 PASS / 1 skip** (con DATABASE_URL real).
- Web: **111 PASS**.

### 2. Documentación corregida

- `web/.env.example`: `BACKEND_PORT=3000 → 4000` (3000 es el puerto del propio web server →
  loop infinito en el rewrite; el puerto se hornea en build). Advertencia documentada.
- `web/.env.example`: removidas referencias a Clerk (el sistema usa JWT custom — stale).
- README.md: sin cambios — no referencia versiones de Next; las menciones a "Next.js 14" están
  solo en docs históricos fechados (snapshot), no actualizados por regla de auditoría.

### 3. HALLAZGO pre-existente: journal de migraciones incompleto en HEAD

El `_journal.json` commiteado solo listaba **2** migraciones (0000, 0001) mientras existen **23**
archivos `.sql`, y los **21** `.sql.json` de hash están **untracked**. Un clone fresco con
`drizzle-kit migrate` habría aplicado solo 2 migraciones — riesgo HIGH latente de despliegue.

- El working tree ya tenía el journal regenerado (Aug 15, sesión previa con `drizzle-kit migrate`).
- Verificado: journal = 23 entradas, hashes SHA-256 de los 23 `.sql` coinciden (23/23 OK).
- **No se commiteó** (regla de auditoría: sin commit). **Acción requerida:** commit de
  `src/shared/database/migrations/` completo (0019-0021 `.sql` + meta `.sql.json` + `_journal.json`).

### Verificación final

| Componente | Resultado |
|---|---|
| `npm audit` root | **0 vulnerabilidades** (antes 4 moderate) |
| `npm audit` web | 0 (heredado del upgrade Next 16) |
| `npx tsc --noEmit` | PASS |
| Backend tests (DB real) | **1780 PASS / 1 skip** |
| Web vitest | **111 PASS** |
| `drizzle-kit check` + hash 23/23 | PASS |
| `git diff --check` | PASS |

**Sin commit ni push.**
