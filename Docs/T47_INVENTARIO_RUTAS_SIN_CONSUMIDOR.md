# T-47 · Inventario y clasificación de rutas sin consumidor

> Estado: **completo**. Auditoría de superficie de la API, ejecutada contra la app real.
> Método: `app.printRoutes()` sobre la app arrancada (no parsing de fuentes) + cruce
> contra consumidores + **sonda HTTP autenticada contra un servidor real**.

## Método y por qué este

Tres pasadas, de la más fiable a la menos:

1. **Inventario real** — `app.printRoutes({ commonPrefix: false })` con la app
   arrancada. Da 635 rutas (excluyendo `HEAD` y `OPTIONS`). Es la verdad de lo que
   Fastify tiene registrado; leer los ficheros de rutas se equivoca por los
   `register()` anidados.
2. **Consumidores** — cada ruta se convierte en un patrón y se busca en `web/src/**` y
   `src/shared/public/**` (260 ficheros). Después en `tests/**`, en el backend
   no-ruta (llamadas internas) y en `Docs/`.
3. **Sonda de vida** — se inyectó cada GET huérfano con un tenant admin real y se
   registró el status. Esto es lo que separa "infumada" de "rota".

> **Por qué la sonda HTTP y no el análisis estático de tablas:** la primera versión
> de este análisis cruzó `FROM|JOIN|INTO` contra `information_schema` y reportó 176
> rutas "rotas", incluidas `/finance/invoices/:id/void`, que T-45 acaba de hacer
> pasar con 37/37 tests. La regex leía prosa en comentarios (`...FROM a table`) y
> confundía palabras inglesas con nombres de tabla. **Descartado por falsos positivos.**
> La sonda HTTP no puede equivocarse: o devuelve 500 o no.

## Resultado 1 — Volumen

| | Rutas |
|---|---|
| Registradas en Fastify | **635** |
| Con consumidor en frontend | 305 |
| **Sin consumidor en frontend** | **330** |
| └─ cubiertas por tests | 64 |
| └─ usadas internamente | 9 |
| └─ documentadas | 2 |
| └─ **sin ningún consumidor** | **255** |

La auditoría original estimaba 316; son 330 porque el backend creció desde entonces.

**255 rutas no las llama nadie** — ni la UI, ni un test, ni otra ruta. Por método:

| Método | Rutas | Riesgo |
|---|---|---|
| POST | 106 | **Alto** — mutación sin ejercitar, imposible de detectar por UI |
| GET | 107 | Medio — 6 de ellas rotas (ver abajo) |
| PATCH | 21 | Alto |
| DELETE | 19 | Alto |
| PUT | 2 | Alto |

Distribución: `finance` 89, `workshop` 44, `inventory` 35, `marketing` 16,
`dvi` 12, `intelligence` 11, `fleet` 9, `email` 8, `thinkcar` 7, `whatsapp` 7.

**El hallazgo estructural**: 148 rutas de escritura (POST+PATCH+PUT+DELETE) que
nadie invoca. Es la misma clase de fallo que el bug de T-46
(`uuid = text` → 500 permanente): código que compila, tipa y se registra, pero que
nadie ejecuta, así que nadie lo prueba. Un GET sin consumidor se nota cuando
alguien lo abre; un POST sin consumidor **solo se nota cuando corrompe datos**.

## Resultado 2 — Las 6 rotas de verdad

Sondeados los 143 GET huérfanos contra un servidor real (`tsx src/app.ts`, puerto
4999, token JWT firmado con el mismo secreto). 135 responden correctamente
(2xx/4xx); 8 dan 5xx. Dos de esas 8 **no son bugs**, y 6 sí:

| Ruta | Causa raíz verificada |
|---|---|
| `GET /workshop/signatures/:ordenId` | `42P01` — **la tabla `digital_signatures` no existe**. `signature.service.ts:53,90` inserta y consulta en ella. 2 rutas rotas (esta + el POST). |
| `GET /finance/contabilidad/tipos-cambio/:fecha` | `ERR_INVALID_ARG_TYPE` — `getRateAtDate` (`exchange-rate.service.ts:112`) interpola un `Date` dentro de `sql\`DATE(${fecha})\``; postgres.js exige string. |
| `GET /api/v1/migration/tables` | `42601 syntax error at or near "="` — `TABLE_CONFIGS.plan_cuentas` es `tenantScoped: true` pero `plan_cuentas` **no tiene columna `tenant_slug`**. Drizzle emite `undefined = $1`. |
| `GET /api/v1/migration/preview` | mismo `42601` (ambas llaman a `getExportPreview`, que itera `plan_cuentas`). |
| `GET /finance/contabilidad/consolidado/balance/:groupId/:anho/:mes` | `throw new Error("Grupo ... no encontrado")` — **`Error` plano en vez de `AppError`**, así que el handler lo devuelve como 500 genérico en lugar de 404. |
| `GET /finance/contabilidad/consolidado/pnl/:groupId/:anho/:mes` | idéntico. |

No son bugs (descartados):
- `GET /health/deep` → 503 **por diseño**: Redis no configurado. Comportamiento correcto.
- `GET /ws/notifications` → la sonda HTTP no puede hablar WebSocket;
  `socket.close is not a function` es artefacto del sondeo, no un defecto.

### Nota sobre falsos positivos del entorno de test

Cinco rutas dar 500 bajo vitest con `TypeError: sql is not a function` y funcionan
bien en el servidor real. Es un artefacto de la transformación SSR de vitest, no
un bug. Conclusión práctica: **para decidir si una ruta está rota hay que sondear un
servidor real, no `app.inject`** — `inject` no reproduce este caso.

## Clasificación propuesta

| Clase | Nº | Qué hacer |
|---|---|---|
| **A. Rota** | 6 | Arreglar. `digital_signatures` falta de la BD (migración nueva); los otros 5 son defectos de código. |
| **B. Cubierta por tests, sin UI** | 64 | Legítimo. API para clientes externos (móvil, portal, integraciones) o scripts. Se deja. |
| **C. Consumida internamente** | 9 | Legítimo. |
| **D. Muerta** | 148 escritura | Decidir por ruta: conectar a la UI o eliminar. Riesgo de corrupción si alguien la descubre. |
| **E. Muerta** | 107 lectura (101 sanas) | Prioridad baja. Considerar exponer en UI o documentar como API pública. |

## Lo que NO se hizo (y por qué)

- **No se borró ninguna ruta.** 255 rutas sin consumidor no autorizan borrado en
  bloque: varias son superficie de API pensada para clientes que no están en este
  repo (el cliente móvil Expo consume `/api/v1/*`, p. ej. `mobile/src/api/client.ts`
  tipa `EstadoResultados`). Borrar a ciegas rompería esos clientes.
- **No se arreglaron las 6 rotas.** Son cambios de comportamiento fuera del alcance
  de T-47 (que es inventario). Quedan documentadas con causa raíz precisa.
- **No se sondearon las rutas de escritura por HTTP.** Habrían mutado datos reales;
  la clasificación de escritura es estática, apoyada en la ausencia total de
  consumidores.

## Siguiente paso recomendado

Crear **T-48 · Sanear superficie de API**, en tres sub-tareas:
- 48a: migración `0034` creando `digital_signatures` (cierra el `42P01`).
- 48b: corregir `getRateAtDate` ( castear la fecha a string) y el
  `planCuentas.tenantScoped` de `TABLE_CONFIGS`.
- 48c: `Error` → `NotFoundError` en los consolidados, para que un grupo inexistente
  devuelva 404 y no 500.

---

## Cierre — T-48 (2026-09-28)

Las 6 rutas quedaron arregladas y blindadas en `tests/fase4-t48-superficie-api.test.ts`
(6/6 verdes; verificado primero contra servidor real con `curl`, luego como regresión):

| Defecto | Fix |
|---|---|
| `digital_signatures` inexistente (42P01, 2 rutas) | Migración `0034_digital_signatures.sql` (aplicada, idx 34 en journal) |
| `getRateAtDate` interpolaba un `Date` (`ERR_INVALID_ARG_TYPE`) | Conversión a ISO `YYYY-MM-DD` antes de interpolar |
| `TABLE_CONFIGS.plan_cuentas.tenantScoped: true` (42601, 2 rutas) | `tenantScoped: false` — `plan_cuentas` no tiene `tenant_slug` |
| `Error` plano en consolidados (2 rutas) | `NotFoundError` → 404 |
| FK violada → 500 opaco | `error-handler.ts` mapea PostgreSQL `23503` → 422 |

**Bug adicional (nº 7) cazado por la regresión:** el happy path de
`POST /workshop/signatures` devolvía 500 — `row.created_at?.toISOString is not a
function`. postgres.js entrega `timestamptz` como **string**, no `Date`, y el
servicio serializaba sin parsear. Ningún sondeo lo había visto: el GET con lista
vacía y el 422 por FK no pasan por esa línea. Fix: `new Date(row.created_at)
`.toISOString()` en `signature.service.ts`. Enseñanza: la sonda HTTP detecta
“ruta rota de origen”, pero solo un test del happy path detecta “ruta rota en el
camino feliz”.

Residuos: cero (`e2e-t48%` purgado de la BD; script temporal y servidor de
sondeo en :4997 eliminados).

## Guard sistémico — T-63 (2026-09-28)

Para que las clases D/E no vuelvan a crecer sin que nadie se entere:

- `scripts/route-consumer-scan.mjs` — cruza el inventario real de rutas
  (`scripts/dump-routes.ts`) contra literales de URL de consumidores
  (web/mobile/public/scripts/backend no-ruta) y de tests (`tests/`, `web/e2e`).
- Baseline congelado: **528 rutas · 293 sin consumidor · 383 sin test**
  (por path; T-47 contaba 635 por método).
- `tests/contract/route-consumer-guard.test.ts` — techos 293/383, bajar con cada fix, jamás subir.
- `.github/workflows/ci.yml` — gates `--max-orphan 293 --max-untested 383` (T-63)
  y `audit-tenant-filters.mjs --max 372` (techo de lookups sin tenant, T-21d).
- El chequeo de tenant ya corría como test (`tests/tenant-filter-audit.test.ts`,
  CEILING 372); el contrato T-00 ya corría (`tests/contract/`). T-63 los hizo
  explícitos como gates de CI y añadió la pata de rutas sin consumidor/test.
- Corrección del matcher (mismo día): la primera versión del escáner nunca
  convertía `:param` a comodín — toda ruta parametrizada contaba como huérfana
  (293/383 falsos). Con el matcher por segmentos el baseline real es
  **197 sin consumidor · 334 sin test**, y el guard congeló también
  **184 escritura-sin-test** (proxy del backlog T-61, incluye rutas ya
  consumidas por la UI) y **92 de clase D** (escritura ∧ sin consumidor ∧ sin test).
- Materialización del triaje (mismo día): `EXCLUDED` en el escáner saca del
  conteo de huérfanas las ~25 externas + ~11 internas por diseño de la tabla
  de abajo (38 rutas concretas; una ya tenía consumidor). `sinConsumidor`
  197 → **160**, clase D 92 → **61**; `sinTest` (334) y escritura-sin-test
  (184) NO bajan — un webhook externo necesita test igual que una ruta de UI.
  El guard añadió un piso `excluded ≥ 36` para que la lista no se pudra:
  si una ruta excluida desaparece, hay que justificarlo en esta tabla.

## Triaje de la clase D (2026-09-28)

La clase D real son **92 rutas de escritura** que ni UI, ni script, ni backend,
ni test ejercitan. Disposición acordada por familia (de nada sirve "decidir por
ruta" 92 veces sin criterio compartido):

| Disposición | ~N | Familias | Criterio |
|---|---|---|---|
| **Conectar a UI** | ~30 | Contabilidad de cierre (`apertura`, `cerrar-periodo`, `devengamiento/*`, `centralizacion/*`, `depreciacion/calcular`, `diferencia-cambio`, `reserva-legal`, `revaluo`, `reversar`, `refundir`, `nota-credito-debito`, `tipos-cambio`), inventario (`adjustments` + approve/reject, `herramientas/prestar`, `control/:id/devolver`, `initial-load`), tesorería (`transferencias`, `PATCH cuentas/:id`), DVI (`items/:id/status`, `photos/:id/markup`), config (`sucursales`), presupuestos (`items`, `refresh`) | Son operaciones que el taller necesita hacer desde la pantalla; hoy solo existen por API. Candidatas a sprints de UI futuros (mismo espíritu que T-55: exponer lo que ya existe). |
| **Externa: documentar como API pública y excluirla** | ~20 | `portal/auth/pin`, `portal/feedback`, `sso/*` (4), `2fa/verify`, `email/send*` (3), `email/billing/*` (4 webhooks del proveedor de suscripciones), `intelligence/*` (7: OCR, DTC, safety), `api-keys` (2) | Superficie para clientes fuera de este repo (móvil, portal del cliente, webhooks entrantes). El criterio de T-47 se aplica: no se borra lo que un cliente externo puede consumir; se documenta y se excluye del conteo. |
| **Interna por diseño: excluir** | ~12 | `fleet/billing/run`, `scheduling/cron/reminders`, `whatsapp/queue/process`, `whatsapp/followups/auto|process`, `enterprise/data-retention/cleanup`, `marketing/sequences/run`, `whatsapp/templates/preview`, `crm/retry` | Disparadas por cron/hook/evento, o herramientas de administración interna. La ausencia de consumidor es correcta. |
| **Legado/duplicado: revisar y probablemente eliminar** | ~6 | `intelligence/parse-dtc` (duplica `dtc/parse`), `thinkcar/import` (convive con `ingest/*` ya consumidos), `thinkcar/imports/:id/link|retry-link|pending/:id/assign` (flujo de apareamiento sin UI), `fleet/contracts*` (CRUD sin página), `PATCH /dvi/photos/:photoId/markup` vs flujo real | Se elimina solo con verificación de que ningún cliente externo las usa (el mismo cuidado de "lo que NO se hizo" de arriba, ahora por ruta). |
| **Decidir caso por caso** | ~24 | Resto: CRM (`deals/:id/close|move`, `stages`), marketing (`sequences/:id/enroll`), WHA (`errors/:id/resolve`, `instance`, `followups/:id/cancel`), compras varias, `workshop/service-brand-map`, `servicios/:id/clock-in|out`, etc. | Necesitan una decisión de producto: ¿el taller lo hace desde WhatsApp/teléfono o desde la UI? |

Cómo baja el techo: cada ruta conectada a la UI deja de contar en `withoutConsumer`;
cada ruta con test deja de contar en `withoutTest` y en clase D; cada ruta borrada
baja todas las métricas. **Las filas "Externa" e "Interna por diseño" están ya
materializadas** como lista `EXCLUDED` en `scripts/route-consumer-scan.mjs`
(con patrón exacto o prefijo `familia/*`): salen del conteo de huérfanas y de
clase D, pero siguen contando en `sinTest` — la exclusión cubre la ausencia
de consumidor, nunca la falta de prueba. Las filas "Legado" y "Decisión"
permanecen visibles a propósito: una exclusión prematura escondería superficie
muerta detrás de una etiqueta.

## Cierre — T-61 (2026-09-30)

El criterio `≥80% de rutas críticas con test de comportamiento` no era medible
hasta que el plan definiera **cuáles son las rutas críticas y su denominador**.
Definido y cerrado:

**Universo (decisión) — A:** rutas bajo `/workshop` + `/inventory` +
`/billing`, **solo escritura** (`POST`/`PATCH`/`PUT`/`DELETE`) = **99 pares
(método, URL)**. La métrica es **por par método+URL** (no por path): `POST
/inventory/adjustments` y `POST /inventory/adjustments/:id/approve` son dos
pares. Piso en CI: `BEHAVIOR_COVERAGE_FLOOR = 0.8`.

**Resultado: 81/99 = 81.8% ≥ 80% → gate en verde.** El margen real son 2 pares
(79/99 = 79.8% ya fallaría), así que cualquier par nuevo de escritura en esos
tres dominios debe entrar con su test o el gate se rompe.

**Ficheros (46 tests en 4 ficheros, todos `app.inject` contra la app real):**

| Fichero | Tests | Pares |
|---|---|---|
| `tests/fase6-t61-behavior.test.ts` | 9 | `PATCH /workshop/ordenes/:id/status` (transacción T-31, 404 cross-tenant, 400 enum) + flujo `POST /inventory/adjustments` → approve/reject (umbral >10, 422 stock negativo, aplicación real) |
| `tests/fase6-t61-items.test.ts` | 14 | 14 pares |
| `tests/fase6-t61-catalogos.test.ts` | 10 | 10 pares |
| `tests/fase6-t61-inventario.test.ts` | 13 | 12 pares (herramientas, tool-instances, calibración/reparación/baja, préstamo/devolución, tool-service-events, depreciación) + happy path de `PATCH /inventory/repuestos/:id`, que solo estaba "cubierto" por un 404 cross-tenant |

29 ficheros de `tests/` usan `app.inject` (eran 11 en la auditoría del 09-25).

**Bugs de `src/` cazados por los tests** (todos con comentario `FIX (T-61)`,
nunca se enshrinó comportamiento roto) — 5 familias / 10 instancias:

1. `prestarHerramienta`/`devolverHerramienta` no recibían `tenantSlug` →
   filtraban con `""` → **404 siempre**; ahora lo pasa la ruta.
2. Response schemas de prestar/devolver declaraban `control` pero los servicios
   devuelven `{ loan }` → serializaban `{}` → schema de respuesta eliminado.
3. **`drizzle .set()` descarta en silencio las claves snake_case** — el
   dialecto recorre solo `Object.keys(tableColumns)` (el nombre JS camelCase
   de cada columna); una clave desconocida no lanza, simplemente no entra al
   SET. Cuatro instancias:
   - `updateToolInstance` iba entero en snake_case → `SET` vacío →
     `update ... set  where ...` → **500 en todo
     `PATCH /inventory/tool-instances/:id`**;
   - `updateHerramienta` y `updateRepuesto` traducían cada campo
     multi-palabra a snake_case → `numeroSerie`, `imagenUrl`, `requiereCalibracion`,
     `precioVenta`, `precioCosto`, `codigoBarras`, `stockMinimo`, … se
     **ignoraban con un 200 aparente** (un par solo cubierto por un 404
     cruzado no lo hubiera visto nunca);
   - `transitionState` limpiaba el custodio con `tecnico_actual_id` /
     `orden_trabajo_actual_id` → el activo dado de baja o extraviado
     **conservaba técnico y OT asignados**;
   - `updateServiceEvent` (`fecha_fin`, `certificado_url`) y `updated_at` en
     `herramientas.service.ts` / `stock.service.ts` → campos ignorados y
     `updated_at` que nunca se refrescaba.
4. `decommissionTool` pasaba un `Date` a una columna `date` (modo string) →
   postgres.js enviaba `Tue Sep 29 2026 ...` → 500; ahora `'YYYY-MM-DD'`.
5. Enums de condición `"Dañado"` estaban en **NFD** en el código y el cliente
   envía **NFC** → 400 injustificado; ahora se aceptan ambas formas y el
   servicio normaliza a NFC.

Decisión (no bug): `createServiceEvent` exige `realizadaPorId` FK válida →
header `x-user-id` con profile real (patrón heredado de `tool-loans.ts`, se
mantiene).

**Gate en CI:** `scripts/route-consumer-scan.mjs --min-behavior 80` en
`.github/workflows/ci.yml` + `tests/contract/route-consumer-guard.test.ts`.

**18 pares aún sin test (no bloquean, son el colchón / fichero 4):**
cycle-counts ×6, ingresos ×4 (checklist, firma-retiro, fotos, delete-foto),
billing ×3 (portal, checkout, webhook), vehiculos ×2 (decode-vin, delete),
mechanic-assignment, initial-load, auto-po.

**Verificación de cierre:** `tsc --noEmit` PASS · suite backend completa
**2127/2127 en 105 ficheros** contra la DB local `:5433` · guard T-63 7/7 ·
eslint sobre `src/modules/inventory` + ficheros nuevos: 0 errores / 33 warnings
(solo `no-explicit-any`, patrón existente).

## Cierre — balde "Legado → eliminar" (Sprint 108, 2026-10-08)

Los 7 handlers del balde "Legado/duplicado" fueron verificados contra
consumidores en `web/`, `mobile/`, `src/shared/public/`, `scripts/`,
`tests/` y `web/e2e/` (**0 referencias**) y eliminados:

| Ruta eliminada | Archivo |
|---|---|
| `POST /intelligence/parse-dtc` | `src/modules/intelligence/routes/vehicle-intelligence.ts` (duplicaba `dtc/parse`) |
| `POST /thinkcar/import` | `src/modules/thinkcar/routes/index.ts` (convive con `ingest/*` consumidos) |
| `POST /thinkcar/imports/:id/retry-link` | `src/modules/thinkcar/routes/index.ts` |
| `POST /fleet/contracts` | `src/modules/fleet/routes/fleet-contracts.routes.ts` |
| `PATCH /fleet/contracts/:id` | ídem |
| `POST /fleet/contracts/:id/cancel` | ídem |
| `PATCH /dvi/photos/:photoId/markup` | `src/modules/dvi/routes/dvi.routes.ts` |

No borradas (corrección del triaje): `POST /thinkcar/imports/:id/link` y
`GET /thinkcar/pending` **sí** tienen consumidores reales (mobile, web,
`dtc-assistant.js`); `POST /thinkcar/pending/:id/assign` lo tiene en
`src/shared/public/js/thinkcar.js` — su URL por concatenación
(`'/thinkcar/pending/' + id + '/assign'`) era invisible para el matcher;
ahora es template literal y el scanner la cuenta.

**Efecto en métricas (Sprint 108):** total 529 → **522** · sin consumidor
160 → **152** · sin test 286 → **279** · escritura sin test 139 → **132** ·
clase D 48 → **40** · excluidas 38 · behavior 99/99. Techos del guard
`tests/contract/route-consumer-guard.test.ts` congelados en 152/279/132/40.
Clase D restante = baldes "Conectar a UI" + "Decidir caso por caso".

## Cierre — clase D con tests (Sprint 109, 2026-10-08)

Nuevo fichero `tests/fase6-s109-classd.test.ts` (15 tests, tenant `e2e-s109`,
patrón fase4-crud) ejercita 10 paths de la clase D con `app.inject`:

- `POST /config/sucursales` + `PATCH|DELETE /config/sucursales/:id` (requireAdmin)
- `POST /finance/donaciones` + `PATCH|DELETE /finance/donaciones/:id`
- `POST /crm/deals/:id/close` (seed de stages + create + cierre con `fecha_cierre`)
- `POST /marketing/sequences/:id/enroll` (+ fixture `POST /marketing/sequences`)
- `POST /whatsapp/errors/:errorId/resolve` (fixture INSERT + aserción `resolved`)
- `PATCH /dvi/items/:itemId/status` (+ fixtures `POST /dvi` y `POST /dvi/:id/items`)
- `POST /dvi/:id/calculate-score` (de regalo vía fixture)

**Bug real encontrado y corregido:** `createSequence`
(`src/modules/marketing/services/sequence.service.ts`) interpolaba
`${step.delayDays}` sin coalescer — con el campo opcional omitido, el tagged
template de drizzle emitía un placeholder vacío (`VALUES ($1,$2,$3, , $4…)`)
→ syntax error → **500 en un POST documentado como opcional**. Corregido a
`${step.delayDays ?? 0}` (la columna es `NOT NULL DEFAULT 0`).

**Efecto en métricas (Sprint 109):** total 522 · sin consumidor 152 ·
sin test 279 → **266** · escritura sin test 132 → **119** · clase D 40 → **30**
· excluidas 38 · behavior 99/99. Techos del guard congelados en
152/266/119/30. Clase D restante: contabilidad/sifen (~20) + "conectar a UI"
y "decidir caso por caso".

## Cierre — clase D tanda 2, liviana (Sprint 110, 2026-10-08)

Nuevo fichero `tests/fase7-s110-classd2.test.ts` (16 tests, tenant `e2e-s110`)
ejercita los 8 paths livianos restantes de la clase D:

- `POST /finance/presupuestos/:id/items` (+409 duplicado, +404 inexistente, aserción BD)
- `POST /finance/presupuestos/:id/refresh` (+404)
- `PATCH /finance/treasury/cuentas/:id` (+404)
- `PATCH /api/tenant/profile` (+GET que auto-crea perfil, reclasificación MIC/IRE)
- `DELETE /whatsapp/instance` (Evolution API localhost traga errores → siempre 200)
- `POST /dvi/:id/share` (cadena cliente→vehículo→orden→DVI, aserción `compartido_whatsapp`)
- `POST /finance/rg90/exportar` (asiento CONTABILIZADO fixture en período aislado 2045-12, +404 período vacío)
- `POST /finance/sifen/contingencia/guardar` (+400 sin campos requeridos; sin FK a documentos)

Se evitó contabilidad (~21 rutas, fixtures pesadas de períodos/asientos) y
sifen emitir/firmar (riesgo de llamada externa al DNIT) — quedan para el
"tanda 3" cuando se decida.

**Efecto en métricas (Sprint 110):** total 522 · sin consumidor 152 ·
sin test 266 → **258** · escritura sin test 119 → **111** · clase D 30 → **22**
· excluidas 38 · behavior 99/99. Techos del guard congelados en
152/258/111/22. Clase D restante: contabilidad (~21) + decidir caso por caso.

## Cierre — clase D tanda 3, contabilidad (Sprint 111, 2026-10-08)

Nuevo fichero `tests/fase7-s111-contabilidad.test.ts` (25 tests, tenant
`e2e-s111`, fixtures SQL con plan de cuentas de 12 códigos con saldo inicial
5M/5M para la apertura, asientos fixture con `modulo_origen='TEST_S111'`,
liquidación IRE 2045 y factura fixture; limpieza pre/post con sweeps por
concepto/S111, ids capturados y módulo+fecha) ejercita los **19 paths
huérfanos de contabilidad**:

- `POST /finance/contabilidad/asientos/automatico` (201, 4 líneas balanceadas)
- `POST /finance/contabilidad/apertura` (201, balance 5M)
- `POST /finance/contabilidad/devengamiento/{ingresos,gastos,revertir}`
- `POST /finance/contabilidad/depreciacion/{activos,calcular}` (+ revaluo con
  aserción BD de `valor_actual_libros`)
- `POST /finance/contabilidad/centralizacion/{ventas,compras,ejecutar}`
- `POST /finance/contabilidad/{tipos-cambio,diferencia-cambio/calcular}`
- `POST /finance/contabilidad/{refundir,reversar,reserva-legal}` (+400
  minItems, +404 reversa repetida, +400 sin campos; aserciones BD de
  `modulo_origen` refundido y estado ANULADO)
- `POST /finance/contabilidad/{centros-costo,validar,nota-credito-debito}`
  (+400×3 de la NC, 201 con `monto='500000.00'`)

**Bugs reales encontrados y corregidos (5)** — los endpoints nunca habían
corrido (éxito del triaje T-47):

1. `generarAsientoAutomatico` (ledger.service.ts) desbalanceaba el asiento
   (Caja/Ingresos = 2t vs t → 422): añadido el par Costo/Inventario
   (`1.1.03.%`), asiento de 4 líneas balanceado.
2. Schema `refundir` exigía `minItems: 1` pero el servicio requiere ≥2
   (un id → 500 plano): `minItems: 2` → 400 correcto.
3. `centralizePurchases`/`centralizeInventory` (centralization.service.ts)
   pasaban `Date` como parámetros de templates crudos de postgres.js →
   `TypeError: Received an instance of Date` → **500**; corregido a
   `toISOString()` (patrón drizzle lo serializa solo, el crudo no).
4. `refundirAsientos` (journal-consolidation.service.ts) usaba
   `sql\`= ANY(${ids}::uuid[])\`` que drizzle expande a `ANY(($1,$2)::uuid[])`
   → `cannot cast type record to uuid[]` → **500**: migrado a `inArray()` en
   los 3 usos (select de validación, agrupado de líneas y UPDATE final).
   *Patrón idéntico sigue vivo en treasury.service.ts:426 (conciliación) —
   candidato a fix.*
5. `centralizePayroll` consultaba columnas inexistentes (`total_salaries`,
   `tenant_slug`, `period_date`) de `payroll_summary` → **500 en
   centralización/ejecutar**: reescrito contra el esquema real
   (`payroll_base_total` + `year`/`month` + JOIN a `tenants`).

**Efecto en métricas (Sprint 111):** total 522 · sin consumidor 152 ·
sin test 258 → **238** (los 19 + `GET /asientos/:id` que el matcher
paramétrico caza desde `/asientos/automatico`) · escritura sin test 111 →
**92** · clase D 22 → **3** · excluidas 38 · behavior 99/99. Techos del
guard congelados en **152/238/92/3**. Clase D restante = las 3 externas
`sifen/emitir|firmar|consultar-lote` (llaman al DNIT — no ejercitar nunca
en tests).
