# Auditoría de arquitectura tricapa — Backend ↔ Frontend ↔ BD ↔ Documentación canónica

**Fecha:** 2026-10-28 · **Alcance:** repo `ERP_Taller_Mca` @ `ae53563` (con WIP sin commitear en catálogo de servicios) · **Método:** 5 exploraciones estáticas en paralelo (backend, frontend `web/`, base de datos, documentación, cruce de contratos FE↔BE↔docs) + verificación puntual de hallazgos críticos en el working tree.

---

## 1. Resumen ejecutivo

El sistema está en **mejor estado del que sugieren las auditorías históricas**, pero con **deuda concentrada en tres bordes concretos**:

1. **Base de datos** — es el eslabón más débil de la tricapa: discriminador de tenant inconsistente (3 convenciones coexisten), un hueco de aislamiento fiscal real (documentos SIFEN sin columna tenant), RLS que hoy no protege (rol `erp_user` con BYPASSRLS) y drift estructural en el versionado de migraciones.
2. **Documentación canónica** — hay **dos verdades**: `engram.json` + `AGENTS.md` están al día (2026-10-15), pero el vault Obsidian (`AutomotiveOS_Vault/`, 2026-06-19), `docs/API.md` (~88 endpoints documentados vs 521 reales, 5 endpoints fantasma) y varias auditorías de junio–agosto están caducas o directamente erróneas y **contradicen la realidad del código**.
3. **Contrato FE↔BE** — sorprendentemente sano: **0 endpoints rotos** en 501 call-sites verificados (test T-00 + rescan independiente). La deuda está en el *shape* silencioso (campos que el cliente FE declara y el BE ignora), en mocks que inventan datos, y en un fallback de tenant que puede producir fuga cross-tenant silenciosa.

Nada de esto es bloqueante para operar; todo es remediarable con un plan de ~6 semanas.

---

## 2. Lo que está sano (para balance)

- **Contrato FE↔BE blindado:** 521 rutas backend volcadas con `scripts/dump-routes.ts`; 501 call-sites del FE (web + mobile + SPA legacy) verificados con el test de contrato `tests/contract/fe-be-contract.test.ts` y re-scan independiente → **0 llamadas a endpoints inexistentes, 0 métodos rechazados**. Guard T-63 con techo en "0 rutas sin consumidor / 0 sin test" (T-47/T-63).
- **Backend bien estructurado:** Fastify 5, 26 módulos con convención clara (plugin → routes → services → schema), `npx tsc --noEmit` limpio (0 errores), cross-cutting ordenado (CORS, helmet, CSRF, authGate, RLS context, rate-limit, métricas), firma SIFEN en worker_thread por el límite de 50 MB RAM — el compromiso de memoria es explícito hasta en el flag de arranque (`--max-old-space-size=48`).
- **CI verde** (backend/web/e2e, 3 jobs) con dataset e2e determinista; `npm audit` limpio.
- **engram.json es una memoria viva real:** trackea el cierre íntegro de la auditoría 2026-09-25 (T-00…T-63) y declara Sprint 131 completado — coherente con el código.
- **Trazabilidad excepcional:** comentarios con tickets (T-XX, D1, FB-N) en el código permiten reconstruir decisiones.

---

## 3. Hallazgos

### 3.1 Base de datos — severidad alta

| # | Hallazgo | Evidencia | Impacto |
|---|----------|-----------|---------|
| BD-1 | **Discriminador de tenant inconsistente: 3 convenciones** | `tenant_slug` text sin FK (~100 tablas) vs `tenant_id` uuid→tenants.id con FK (profiles, payroll_summary, fixed_expenses, commission_records) vs `tenant_id` uuid **sin FK** (billing_subscriptions, billing_invoices). Defaults sospechosos: `repuestos.ts:121`, `herramientas.ts:101` con `.default("demo")`; `email_log.ts:20` y `cuenta_mapping` nullable | Toda herramienta genérica (RLS, auditoría de filtros, sync-worker, migración entre tenants) necesita casos especiales por tabla; el esquema es un iceberg de excepciones |
| BD-2 | **Hueco de aislamiento fiscal** | `fiscal_documentos`, `fiscal_documento_detalles`, `sifen_sync_log` **no tienen columna tenant**; el documento fiscal se identifica solo por `emisor_ruc` (`fiscal-docs.ts:85-87`); header del archivo aún dice "live in each tenant's schema" (stale, Arquitectura B) | El módulo más regulatorio del sistema (DNIT SIFEN, RG 90) tiene el aislamiento más débil: sin policy RLS posible, depende 100% de que cada query filtre por RUC. Error de query = documento fiscal de un tenant visible a otro |
| BD-3 | **RLS declarado, inefectivo en la práctica** | `0019_rls_security.sql` es fail-closed pero el rol de la app conecta con **BYPASSRLS** — la propia migración lo admite (`0019:27-29`). Además excluye tablas `tenant_id` (profiles, commission_records, fixed_expenses, payroll_summary) porque `app.current_tenant` lleva slug, nunca UUID | El defense-in-depth de DB es hoy sólo teoría; el único muro real es el filtro a nivel aplicación + el auditor estático (`scripts/audit-tenant-filters.mjs`) |
| BD-4 | **Drift en versionado de migraciones** | `migrations/meta/` solo tiene snapshots 0000–0001 pero el journal lista 36 entradas; 0002+ son SQL a mano → `drizzle-kit generate` produciría un diff espurio gigante. **Tres trackers coexisten** sin garantía de alineación: `__drizzle_migrations`, `_migrations` (`run-migrations.ts:31`), `public.migrations` (`apply-migration.ts:14`). Scripts stale: `apply-0008.ts` apunta a un SQL que no existe y recrea una tabla ya creada | Riesgo real de divergencia entre entornos (ya hay evidencia: `0008_contabilidad_rls.sql:10-16` confiesa tablas que "solo existían en entornos bootstrappeados con push"); recuperar drizzle-kit generate requiere operación manual de snapshots |
| BD-5 | **Schemas TS fuera de `drizzle.config.ts`** | billing (3 tablas), fleet (1), mobile (1), marketing (4), analytics, intelligence/rag — drizzle-kit no los ve; viven solo por SQL crudo | Doble fuente de verdad: algunas tablas creadas dos veces (billing en `migration.sql.ts` y `0030_feature_tables.sql` con `IF NOT EXISTS`) |
| BD-6 | **FKs faltantes en puntos calientes + bug de relaciones** | `orden_repuestos.repuesto_id` sin FK; `ordenes_trabajo.sucursal_id` sin FK; `assigned_to`/`hv_lockout_signed_by` en text; ninguna FK de `tenant_slug`→`tenants.slug` en ninguna tabla. **Bug confirmado:** `clientsRelations.vehicles: many(clients)` apunta a sí misma en vez de a vehiculos (`src/shared/database/schema/clients.ts:72`) | Integridad referencial no aplicada donde más duele (stock de OT, sucursales). El bug de relations es inofensivo hoy pero corrompe cualquier query con drizzle relational |
| BD-7 | **Restos de la Arquitectura B** | `migrate.legacy.ts` (LEGACY — DO NOT USE) pero `tenants.schema_name` sigue en el schema, `TENANT_SCHEMA_PREFIX` en compose, `seed.ts` hace seed por `tenant_<slug>` con search_path | Documentación y migraciones legacy confunden el modelo mental: el DAS de junio aún describe "schema por tenant" |
| BD-8 | 12 tablas solo-SQL sin representación TS | transferencias_almacen, marketing_campaigns, loyalty_*, google_reviews, fleets, tenant_groups*, consolidated_report_snapshots, sifen_contingencia_queue, digital_signatures | Queries raw obligatorias; dispersión del modelo de datos |

### 3.2 Frontend ↔ Backend — severidad media

| # | Hallazgo | Evidencia | Impacto |
|---|----------|-----------|---------|
| FE-1 | **Shape drift silencioso (en el WIP actual)** | `web/src/lib/api.ts:669-690` (sin commitear) declara y documenta `precioUnitario` y `notas` para crear/actualizar ítems de servicio de OT, pero el backend solo lee `cantidad` (`src/modules/workshop/routes/order-items.routes.ts:110-117`). Fastify no rechaza `additionalProperties` → se ignoran sin error | El contrato prometido no existe: la UI que se está construyendo en el Hub creerá que el override de precio funciona. **Bloquear o completar antes de commitear** |
| FE-2 | **Tenant fallback "demo"** | `web/src/lib/api.ts:198-208`: si `<TenantResolver/>` no corrió (SSR, primer render), `_tenantSlug` cae silenciosamente a `"demo"` y todas las llamadas salen con `X-Tenant-Slug: demo` | Fuga cross-tenant silenciosa si el backend no blinda por JWT. Hoy el backend sí valida, pero el patrón es una trampa |
| FE-3 | **Mocks que inventan datos, no que degradan** | `data-service.ts:167-180` hardcodea `year: 2024`, `technician: "Sin asignar"`, `deadline: "Pendiente"`, `estimatedCost: 0`; `mapInvoiceFromApi` pone `cliente: "Cliente"`; `flotas/page.tsx:78` calcula "Vehículos Aprox." como `total * 8` | Cuando un envelope cambia (T-62: `map is not a function` en calendario y audit), la UI **muestra datos falsos en vez de error** — peor que caerse. El mock de calendario ocultó un bug real con 3 turnos en BD |
| FE-4 | **Fragilidad de envelopes paginados** | Comentario T-62 documenta que `/scheduling/appointments` y `/audit/` responden `{items\|entries,...}` y el front asumía array | Riesgo latente en cualquier endpoint cuya forma cambie; los `getMock*` lo ocultan en dev |
| FE-5 | **Trampas de configuración de conexión** | `next.config.mjs:12` default `BACKEND_PORT="3000"` (mismo puerto del web; en la práctica 4000); un tercer env var `BACKEND_URL` solo para los 2 route handlers de onboarding (`route.ts:9`); el WebSocket financiero conecta directo a `NEXT_PUBLIC_API_URL \|\| localhost:4000` (`use-financial-ws.ts:28`), bypassando el proxy | Despliegue frágil: 3 mecanismos de dirección del backend, defaults que colisionan. Trampa típica en PC del taller |
| FE-6 | **Doble capa HTTP competidora** | `web/src/lib/api.ts` (2777 líneas, ~150 métodos, tipos duplicados a mano) + `web/src/lib/data-service.ts` (1244 líneas, fetchs crudos propios ignorando al cliente, variantes duplicadas p. ej. `listCxcPendientes` ≡ `listCxcPendientesTreasury`) + 42 fetches dispersos en 17 archivos | Deuda de consistencia: sin contrato generado (OpenAPI/pacts), el tipo que el FE cree que existe se escribe a mano — origen de FE-1 |
| FE-7 | **UI stub o fake** | `/forgot-password` simula envío con `setTimeout` (residuo Clerk, no llama a nada); `/register` estático ("contactá al administrador"); `/dashboard/perfil` sin API; `analytics/mock-data.ts` exporta mocks que nadie importa | Flujos de auth incompletos en la UI; el usuario no puede recuperar contraseña desde el sistema |
| FE-8 | **i18n declarada, no aplicada** | `messages/{es,en,gu}.json` + next-intl v4 configurados, pero solo 4 archivos usan `useTranslations` — **toda la UI está hardcodeada en español** | La guaraní (relevancia real en Paraguay) existe solo en config |
| FE-9 | **SPA legacy como segundo frontend** | `legacy-vanilla-frontend/` y `src/shared/public/` siguen en el repo pegando a los mismos endpoints | Doble mantenimiento del contrato; 9 paths consumidos solo por ella |

### 3.3 Documentación canónica — severidad media-alta (riesgo de decisión sobre información falsa)

| # | Hallazgo | Evidencia | Impacto |
|---|----------|-----------|---------|
| DC-1 | **`docs/API.md` está 6× por debajo de la realidad** | ~96 endpoints documentados vs **521 rutas reales**; omite el 82% de la superficie (treasury, presupuestos, cycle-counts, tool-loans, fleet, portal, DVI, backup, enterprise, etc.); contiene **5 endpoints fantasma**: `POST /intelligence/parse-dtc` (renombrado), `POST /inventory/herramientas/prestar` y `.../control/:id/devolver` (eliminados en Sprint 119), `POST /thinkcar/import` y `.../retry-link` (renombrados) | Cualquier integrador (o agente) que lea API.md construye contra endpoints muertos. Es el documento más peligroso del repo |
| DC-2 | **El vault Obsidian está abandonado y enlaza a notas inexistentes** | `_🎯_START_HERE_MOC.md` (2026-06-19) reporta "59 sprints / 1398 tests" (hoy: 131 / 2642+); sus MOCs enlazan ~20 notas (`2.1_Arquitectura_General`, `4.4_Multitenant_RLS`, `Sprint_58…`) que **no existen físicamente**; queries Dataview vacías | Quien entre por el vault (se anuncia como "START HERE") recibe una fotografía de junio con links rotos |
| DC-3 | **Contradicciones internas entre documentos** | Tres auditorías de julio declaran sprints distintos para la misma semana (82, 86, 93); `engram.json` `conejo_de_india.tech_stack` sigue declarando Next 14 + React 18 + Clerk + Stripe + Vercel/Railway (hoy: Next 16 + React 19 + JWT propio + on-premise Podman); `visual_orchestration.pdf_engine` declara "Cloud-Rendered Chromium" mientras el código usa puppeteer-core local con degradación 503; conteos de rutas irreconciliables entre docs (520/528/564/635) | Un lector que cruce documentos saca conclusiones contradictorias; el tech_stack de engram activamente miente sobre el stack actual |
| DC-4 | **`Informes/auditoria-2026-08-14.md` es inválida** | Nació del prompt equivocado (describía un repo "GestionIRP" en Go/Kafka) y fue adaptada; su stack auditado (Next 14, ~284 endpoints) ya era incorrecto al publicarse y no tiene trazabilidad en engram | Documento erróneo circulando en el repo sin marca de invalidez |
| DC-5 | **DAS de junio describe la Arquitectura B** | `docs/Proyecto/02_DAS_*.md` (v3.0, 2026-06-22) describe multi-tenant por schema + RLS y Docker Compose de 5 servicios; el código es Arquitectura A (schema único, tenant_slug) | El documento de arquitectura oficial está desalineado del sistema real |

**Nota de fairness:** la cadena de auditorías de julio (GAP, 07-22/23/25) reporta gaps P1 que engram confirma **resueltos** (S87–S96), y la auditoría controladora 2026-09-25 está íntegramente cerrada (T-00…T-63). El problema no es falta de disciplina de cierre, es que **los documentos muertos no se entierran ni se marcan como históricos**.

### 3.4 Funcionalidad sin superficie y deuda residual — severidad baja-media

| # | Hallazgo | Detalle |
|---|----------|---------|
| FN-1 | **18 rutas operativas solo invocables por script** (sin UI): secuencias de marketing (run + CRUD :id), retry CRM, procesamiento de colas WhatsApp, emisión/firma/consulta SIFEN, validación 2FA por hardware, cleanup de retención de datos | Funcionalidad construida sin pantalla: nadie puede operarla sin curl |
| FN-2 | **Módulo `/api/v1/migration/*` (5 rutas) sin interfaz** | La migración entre tenants — funcionalidad clave para onboarding — solo es invocable por API/script |
| FN-3 | **Gaps de la auditoría 2026-09-25 sin tarea asignada ni cierre** | OPS-05 (ingresos sin PATCH/DELETE), OPS-07 (calendario sin DELETE de cita), SRV-05 (flat-rate sin corrección de reloj), FIN-06 (tesorería: cuentas sin DELETE, transferencias sin GET). Quedaron fuera del plan T-00…T-63 |
| FN-4 | **`vercel.json`** (`outputDirectory: .next` vs build en `web/`) — único pendiente explícito de la auditoría heredada según `engram.json:176` |
| FN-5 | Higiene: ~40 `reply.send` sin `return` (deuda documentada `e2e_wedge_20261007`); E2E de datos pendientes (T-62: label-printing, storage/uploads, portal/profile, móvil); baseline E2E de AGENTS.md (61) vs real (~96) |

---

## 4. Priorización

**P1 — Riesgo de seguridad/integridad (hacer ya):**
- BD-2 (aislamiento fiscal), BD-1+BD-3 (consolidar discriminador de tenant y hacer real el RLS con rol least-privilege), FE-1 (completar o revertir el WIP de precioUnitario/notas antes de commitear), FE-2 (eliminar fallback "demo").

**P2 — Riesgo de mantenimiento/decisión:**
- BD-4+BD-5 (plan de reconstrucción de snapshots + llevar todos los schemas a drizzle.config), FE-3+FE-4 (mocks que fallan en vez de mentir), FE-5 (unificar env vars de conexión), FE-7 (forgot-password real), DC-1 (regenerar API.md desde dump-routes + schemas), FN-3+FN-4.

**P3 — Higiene:**
- DC-2/DC-3/DC-4/DC-5 (marcar documentos históricos, corregir tech_stack de engram, entierro del vault o regeneración), FE-8 (i18n), FE-9 (decidir futuro de la SPA legacy), BD-7/BD-8 (limpieza Arquitectura B), FN-1/FN-2 (UI para funcionalidad huérfana según demanda).

---

## 5. Siguientes pasos recomendados

### Fase 0 — Quick wins (1 semana, sin riesgo)
1. **Completar o revertir el WIP** de `order-items` (precioUnitario/notas) — está a medio camino entre FE y BE.
2. **Eliminar el fallback `"demo"`** en `api.ts` (fallar ruidosamente si no hay tenant; el backend ya blinda, pero la trampa no debe existir).
3. **Marcar documentos caducos:** banner "⚠️ HISTÓRICO — ver engram.json" en `AutomotiveOS_Vault/_🎯_START_HERE_MOC.md`, auditorías de junio–agosto, `docs/API.md` e `Informes/auditoria-2026-08-14.md` (o moverlos a `docs/_historico/`).
4. **Corregir `tech_stack` y `pdf_engine` en engram.json** (Next 16/React 19/JWT propio/on-premise; puppeteer local).
5. **Fix puntual:** `clientsRelations.vehicles → many(vehiculos)` (`clients.ts:72`), defaults `.default("demo")` en repuestos/herramientas, baseline E2E en AGENTS.md.

### Fase 1 — Seguridad multi-tenant (2–3 semanas)
6. **Añadir columna tenant al núcleo fiscal** (`fiscal_documentos`, detalles, `sifen_sync_log`) con backfill desde `emisor_ruc`→tenants, índice, y extensión de `0019_rls_security.sql`.
7. **Plan de consolidación del discriminador:** elegir una convención (recomendado: `tenant_id uuid` con FK en tablas nuevas; migrar las 4 tablas `tenant_id` hacia políticas RLS que comparen UUID, o normalizar policies), con test del auditor estático como gate.
8. **Rol least-privilege** para la app de Postgres (sin BYPASSRLS) que haga efectivas las policies fail-closed, tras prueba de humo de los webhooks excluidos (facturas, cuentas_bancarias, movimientos_tesoreria).
9. **Endpoint real de recuperación de contraseña** (FE-7) y revisión del allowlist de authGate.

### Fase 2 — Integridad de datos y contrato (2–3 semanas)
10. **Regenerar snapshots drizzle** (reconstruir `migrations/meta/` desde una DB con las 36 migraciones aplicadas) para rehabilitar `drizzle-kit generate`, y unificar trackers (`__drizzle_migrations` como único, con chequeo en CI).
11. **Llevar todos los schemas TS a `drizzle.config.ts`** (billing, fleet, mobile, marketing, analytics, rag) y eliminar dobles creaciones SQL.
12. **Mocks honestos:** `fetchOrMock` debe fallar visiblemente (toast de "modo demo") en vez de mapear datos inventados; eliminar mocks sin importar; tipar envelopes paginados (`PaginatedResponse<T>`) en el cliente FE.
13. **Contrato generado:** derivar los tipos del cliente FE desde los JSON Schema de Fastify (ya existen en cada ruta) o publicar OpenAPI en prod — elimina la clase FE-1/FE-6 de drift.
14. **FKs faltantes** en orden_repuestos→repuestos, ordenes_trabajo.sucursal_id, y política de FKs de tenant.

### Fase 3 — Documentación y superficie (continua, baja urgencia)
15. **Regenerar `docs/API.md` automáticamente** desde `scripts/dump-routes.ts` + JSDoc de rutas (un script `docs:api` en CI impide que vuelva a pudrirse).
16. **Actualizar DAS** (Arquitectura A, stack real, conteos T-63) o marcarlo histórico con puntero a engram.
17. **Decidir el futuro del vault Obsidian** (regenerar MOCs desde engram, o declarar engram+AGENTS.md como única doc viva y archivar el vault).
18. **Cerrar FN-3/FN-4** (OPS-05/07, SRV-05, FIN-06, vercel.json) como sprint de deuda residual de la 09-25.
19. **Backlog de UI** para las 18 rutas huérfanas según demanda real del taller (empezando por migración entre tenants y secuencias de marketing).

### Métricas de salida por fase
- Fase 0: 0 documentos sin marca de vigencia; WIP commiteado con contrato completo; 0 fallbacks "demo".
- Fase 1: 100% de tablas tenant-scoped con columna discriminadora consistente; rol app sin BYPASSRLS; auditor tenant-filters en verde sobre las tablas fiscal.
- Fase 2: `drizzle-kit generate` reproducible sin diff espurio; 1 solo tracker de migraciones; 0 schemas fuera de drizzle.config; mocks que nunca inventan datos.
- Fase 3: API.md generado con fecha ≤ último commit; DAS alineado; deuda 09-25 en 0.

---

*Informe elaborado por auditoría estática (5 frentes en paralelo + verificación en working tree). No se ejecutó la aplicación; los hallazgos de forma de respuesta (FE-3/FE-4) se basan en comentarios de tickets y código, no en trazas en vivo. Recomendación transversal: dado el excelente hábito de trazabilidad (T-XX) que ya existe, registrar estos hallazgos como entradas en engram.json y convertir las Fases 0–2 en el Sprint 132.*
