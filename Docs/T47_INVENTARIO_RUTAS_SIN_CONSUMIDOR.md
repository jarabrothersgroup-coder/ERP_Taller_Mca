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

## Cierre — clase D = 0, exclusión sifen + regresión conciliación (Sprint 112, 2026-10-08)

Tres movimientos que cierran la fase de triaje de T-47:

1. **Fix del patrón `= ANY(${ids}::uuid[])` en treasury** — era el "candidato
   a fix" que Sprint 111 dejó anotado en el punto 4 anterior:
   `cerrarConciliacion` (treasury.service.ts:426) expandía `movimientoIds` a
   `ANY(($1,$2)::uuid[])` → `cannot cast type record to uuid[]` → **500 con
   cualquier lista de ≥1 movimiento**. Migrado a `inArray()` (mismo fix que
   `refundirAsientos` en Sprint 111). Nuevo fichero
   `tests/fase7-s112-treasury.test.ts` (5 tests, tenant `e2e-s112`):
   iniciar conciliación → cerrar con 2 movimientos (regresión, con aserción
   BD de `conciliado`/`fecha_conciliacion`) → cerrar con lista vacía → 404 →
   listado. Verificado que **falla 1/5 sin el fix** (stash) y pasa 5/5 con él.
2. **Exclusión de las 3 externas sifen del triaje** — `POST
   /finance/sifen/{emitir,firmar,consultar-lote}` añadidas a `EXCLUDED` del
   escáner con justificación (emisión electrónica saliente al DKCC; el
   "consumidor" es la red DNIT, no la UI). Con esto **la clase D llega a 0**
   sin arriesgar llamadas fiscales reales. Las exclusiones NO bajan la pata
   `sinTest`: un webhook externo necesita test igual (semántica documentada
   en el propio EXCLUDED).
3. **CI materializado en `.github/workflows/ci.yml`** — el guard T-63 pasó de
   gate local a gate de PR: job backend (postgres service `pgvector/pg16`,
   mismas 36 migraciones sobre DB fresca, `tsc`, `eslint`, `vitest run` con
   el guard dentro) + job web (typecheck, lint, 156 unit tests). Validado
   end-to-end localmente contra una DB recién migrada (117 archivos /
   2268 tests) antes de confiar en el runner.

**Efecto en métricas (Sprint 112):** total 522 · sin consumidor 152 →
**149** (−3 sifen excluidas) · sin test 238 → **235** (−3 paths de
`treasury/conciliación`) · escritura sin test 92 → **90** (−2: start +
cerrar) · clase D 3 → **0** (excluidas, no ejercitadas) · excluidas 38 →
**41** · behavior 99/99. Techos del guard congelados en **149/235/90/0**
(piso de exclusiones 36). **La clase D de T-47 queda vaciada: todo lo que
escribe y no tiene consumidor o tiene test, o es externa documentada.**

## Cierre — balde "Conectar a UI" cableado a UI real (Sprint 113, 2026-10-09)

Sprint 113 tomó el balde "Conectar a UI" (~30 ops del punto anterior) y lo
cableó a pantallas reales en `web/` (alcance "balde completo" aprobado).
Lo que quedó fuera de alcance y por qué:

- `POST /inventory/herramientas/prestar` y `POST
  /inventory/herramientas/control/:id/devolver` — duplicados legados de
  `/inventory/tool-loans/lend|/:id/return` (el servicio los marca
  `@deprecated` y delega). La UI de herramientas ya consume los tool-loans
  canónicos (`api.lendTool`/`api.returnTool`); doble-wiring duplicaría el
  flujo. Candidatos a eliminarse (balde "legado/duplicado").
- `PATCH /dvi/photos/:photoId/markup` — eliminada en Sprint 108 junto con
  el flujo de anotación de fotos. DVI solo necesita `PATCH
  /dvi/items/:itemId/status` (conectado).
- Reportes/mappings GET de contabilidad (`cuadratura`, `rentabilidad/*`,
  `libro-*-iva`, `mappings`, `validar`, `audit-log`, `devengamiento/ajustes`)
  — lecturas especializadas fuera del balde de cierre; siguen en la cola.

Lo cableado (archivos clave en `web/src`):

1. **Tesorería** — `tesoreria/transfer-dialog.tsx` (POST
   `/finance/treasury/transferencias`) + `tesoreria/edit-account-dialog.tsx`
   (PATCH `/finance/treasury/cuentas/:id`).
2. **Config** — `config/sucursales-section.tsx` (CRUD completo
   `/config/sucursales`). El contrato FE↔BE detectó que faltaba el rewrite
   `/config/:path*` en `web/next.config.mjs` (Next respondería la página en
   vez del backend); añadido y testeado.
3. **Presupuestos** — `presupuestos/items-card.tsx` (items CRUD + refresh
   de totales).
4. **DVI** — `dvi/dvi-item-status-control.tsx` cableado a la vista comparada
   de `dvi/page.tsx` con `GET /dvi/:id` (la lista `GET /dvi` no trae items).
5. **Inventario** — `inventario/movimientos/adjustments-card.tsx`
   (`/inventory/adjustments` + pending/approve/reject) y
   `inventario/movimientos/initial-load-card.tsx` (`/inventory/initial-load`
   + batches list/detail; nuevo `api.getInitialLoadBatch` para
   `batches/:batchId`).
6. **Contabilidad** — página nueva
   `contabilidad/cierre/page.tsx` + `cierre/cierre-dialogs.tsx`: las ~14 ops
   de cierre (apertura, devengamiento ingresos/gastos/revertir,
   centralización ventas/compras/ejecutar, depreciación, diferencia de
   cambio, reserva legal + saldo, cerrar-periodo) y operaciones avanzadas
   (revaluo, refundir, reversar, nota crédito/débito, tipos de cambio con
   `actual`/`:fecha`/crear). Pestaña "Cierre" añadida a
   `CONTABILIDAD_SUB_PAGES`.

**Efecto en métricas (Sprint 113):** total 522 · sin consumidor 149 →
**113** (−36: las ~30 del balde menos las 3 legacy/del 108/GETs fuera de
alcance que ya estaban citadas) · sin test 235 (sin cambios — la UI no es
test de comportamiento backend; sigue siendo el backlog T-61) · escritura
sin test 90 · clase D 0 · excluidas 41. Techos del guard congelados en
**113/235/90/0** (piso de exclusiones 36). Validación: backend 117 ficheros
/ 2264 PASS + guard 7/7 + contrato FE↔BE 5/5 + tsc 0; web typecheck 0,
lint 0 errores (191 warnings), 156/156 tests.

## Sprint 114 — Tests de escritura del balde 113 (2026-10-09)

**Alcance:** los 14 endpoints de escritura cableados a UI en Sprint 113 no
tenían tests de comportamiento backend (backlog T-61). Se cubrieron con
`tests/fase7-s114-write-coverage.test.ts` (patrón fase7: tenant dedicado
`e2e-s114`, fixtures SQL idempotentes, `app.inject` con template literals
para el scanner de T-63).

### Rutas cubiertas (14 ops de escritura)

| Módulo | Rutas |
|--------|-------|
| Treasury | POST `/finance/treasury/cuentas`, POST `/finance/treasury/movimientos`, POST `/finance/treasury/facturas-proveedor`, POST `/finance/treasury/facturas-proveedor/:id/pagar` |
| Presupuestos | POST `/finance/presupuestos`, POST `/finance/presupuestos/:id/aprobar` (APROBAR→OT y RECHAZAR) |
| Contabilidad | POST `/finance/contabilidad/asientos`, POST/DELETE `/finance/contabilidad/grupos`, POST/DELETE `/finance/contabilidad/grupos/:id/miembros`, PATCH/DELETE `/finance/contabilidad/centros-costo/:id` |
| DVI | POST `/dvi/:inspectionId/photos` (multipart JPEG + magic bytes + spoofing), DELETE `/dvi/:inspectionId/photos/:photoId` |

### Bugs encontrados y corregidos (RED → fix → GREEN)

1. **POST `/finance/treasury/facturas-proveedor` → 500.** El handler pasaba
   `fechaEmision`/`fechaVencimiento` como strings ISO al insert de drizzle;
   `timestamp withTimezone` exige `Date`. Fix: convertir a `Date` en el
   handler (`treasury.routes.ts`).
2. **DELETE `/finance/contabilidad/grupos/:id` devolvía 204 en grupo ya
   inactivo.** `deactivateTenantGroup` no filtraba `is_active = TRUE`, así
   que el `UPDATE … RETURNING` siempre encontraba la fila. Fix: añadir
   `AND is_active = TRUE` (`consolidated-report.service.ts`).
3. **DELETE `/dvi/:inspectionId/photos/:photoId` → 500 (ENOENT).** El
   handler construía la ruta sin extensión (`{tenant}/{inspection}/{photoId}`)
   pero upload guarda `{photoId}.{ext}`. Fix: resolver el archivo real por
   prefijo con `listPhotos` y devolver 404 si no existe
   (`photo.routes.ts`).

### Ajustes de expectativas (no bugs)

- POST movimientos devuelve **201** (no 200).
- ValidationError (asientos desbalanceados, aprobar sin cliente/vehículo)
  mapea a **422** (error-handler), no 400.
- POST asientos con `< 2` líneas → **400** del schema Fastify (`minItems`),
  antes del servicio.
- POST fotos sin multipart → **406** (parser rechaza Content-Type).
- Estado de factura tras pago total: **`PAGA`** (no `PAGADA`).

**Efecto en métricas (Sprint 114):** total 522 · sin consumidor 113 (sin
cambios) · sin test 235 → **221** (−14) · escritura sin test 90 → **76**
(−14) · clase D 0 · excluidas 41. Techos del guard congelados en
**113/221/76/0** (piso de exclusiones 36). Validación: backend 118 ficheros
/ 2296 PASS + 4 skip + guard 7/7 + tsc 0. Web no se tocó (cambios solo en
backend/tests).

---

## Sprint 115 — Cobertura de escritura lote 2 (backlog T-61) · 2026-10-09

Segundo lote de tests de comportamiento para rutas de escritura sin test
del balde post-113. Patrón fase7 (tenant propio `e2e-s115`, fixtures SQL
idempotentes, `app.inject` con template literals para el scanner T-63).

### Rutas cubiertas (16 ops)

| Módulo | Rutas |
|--------|-------|
| Mobile | POST/DELETE `/mobile/push-token` (insert + upsert + delete) |
| Notifications | PATCH `/api/notifications/:id/read` (+ cross-tenant 404), POST `/api/notifications/read-all` |
| API Keys | POST `/api-keys`, DELETE `/api-keys/:id` (+ 404) |
| Enterprise | PUT `/enterprise/data-retention` (upsert), POST `/enterprise/data-retention/cleanup` (+ 404 sin política) |
| Label printing | PUT `/label-printing/config`, POST `/label-printing/config/preview`, POST `/label-printing/reimpresiones/:id` (404 + 200) |
| Analytics | POST `/analytics/report` (400 + revenue + status) |
| Fleet | POST `/fleet/billing/run` (sin contratos → generated=0) |
| 2FA | POST `/2fa/verify` (400 sin code + valid=false) |
| Finance | POST `/finance/payments/link` (404 + STRIPE mock + 400 schema) |

### Bugs encontrados y corregidos (RED → fix → GREEN)

1. **PATCH `/api/notifications/:id/read` — aislamiento cross-tenant.**
   `markAsRead` en `notification-push.service.ts` recibía `tenantSlug` pero
   solo lo usaba para el broadcast WebSocket; el `WHERE` filtraba solo por
   `id`. Un tenant podía marcar como leídas notificaciones de otro tenant.
   Fix: añadir `AND tenant_slug = $tenant` al update. (La ruta activa es
   `notification-push.routes.ts`; `notifications.routes.ts` está
   superseded y también se corrigió por consistencia.)
2. **POST `/label-printing/reimpresiones/:id` → 500.** El payload ESC/POS
   generado por `generateLabelPayload` contiene bytes NUL (`0x00`, comandos
   de corte/padding) que PostgreSQL rechaza en columnas `text`. Fix:
   strip `/\0/g` antes del insert en `print_jobs`
   (`label-printing.routes.ts`).
3. **Tabla `data_retention_policy`** (singular) — el afterAll del test
   usaba el nombre plural incorrecto.

### Ajustes de expectativas (no bugs)

- POST `/api-keys` exige scopes válidos de `API_SCOPES`
  (ej. `read:workshop`, no `read`) → 400 si scope inválido.
- POST `/analytics/report` type=revenue devuelve `{ trend: [...] }`
  (sin campo `type` en la respuesta).
- POST `/finance/payments/link` sin `STRIPE_SECRET_KEY` devuelve mock URL
  (`/dashboard/facturas/{id}/pago?mock=true&amount=…`).

**Efecto en métricas (Sprint 115):** total 522 · sin consumidor 113 (sin
cambios) · sin test 221 → **208** (−13) · escritura sin test 76 → **63**
(−13) · clase D 0 · excluidas 41. Techos del guard congelados en
**113/208/63/0** (piso de exclusiones 36). Validación: backend 119 ficheros
/ 2326 PASS + 4 skip + guard 7/7 + tsc 0. Web no se tocó.

---

## Sprint 116 — Cobertura de escritura lote 3 (backlog T-61) · 2026-10-09

Tercer lote de tests de comportamiento para rutas de escritura sin test.
14 ops: 5 calculadoras fiscales DNIT (cálculo puro + persistencia de
liquidaciones) y 9 de CRM pipeline (stages + deals CRUD). Patrón fase7
(tenant propio `e2e-s116`, fixtures SQL idempotentes, `app.inject` con
template literals para el scanner T-63).

### Rutas cubiertas (14 ops)

| Módulo | Rutas |
|--------|-------|
| Fiscal | POST `/finance/fiscal/form120/calcular`, POST `/finance/fiscal/ire/calcular`, POST `/finance/fiscal/idu/calcular` (+404 sin IRE previo), POST `/finance/fiscal/isc/calcular`, POST `/finance/fiscal/inr/calcular` (+400 tasa>1) |
| CRM stages | POST `/crm/stages` (+400 sin nombre), POST `/crm/stages/seed` (idempotente), PATCH `/crm/stages/:id`, DELETE `/crm/stages/:id` |
| CRM deals | POST `/crm/deals` (+400 sin titulo/stageId), PATCH `/crm/deals/:id`, POST `/crm/deals/:id/move`, POST `/crm/deals/:id/close` (ganado=true), DELETE `/crm/deals/:id` |

### Bugs encontrados

Ninguno de producción. Los 3 falros iniciales fueron aserciones mal
nombradas en el test (shapes reales: `impuestoIdu`, `impuestoIsc`,
`impuestoInr` — no `impuesto`/`retencion`).

**Efecto en métricas (Sprint 116):** total 522 · sin consumidor 113 (sin
cambios) · sin test 208 → **200** (−8) · escritura sin test 63 → **55**
(−8) · clase D 0 · excluidas 41. Techos del guard congelados en
**113/200/55/0** (piso de exclusiones 36). Validación: backend 120 ficheros
/ 2348 PASS + 4 skip + guard 7/7 + tsc 0. Web no se tocó.

---

## Sprint 117 — Cobertura de escritura lote 4 (backlog T-61) · 2026-10-09

Cuarto lote de tests de comportamiento para rutas de escritura sin test.
15 ops: 7 WhatsApp (templates CRUD + followups), 3 marketing sequences
(PATCH/DELETE/run), 2 CRM sync (sync/:ordenId + retry), 2 Thinkcar
(link + assign), 1 white-label upsert. Patrón fase7 (tenant propio
`e2e-s117`, fixtures SQL idempotentes, `app.inject` con template literals).

### Rutas cubiertas (15 ops)

| Módulo | Rutas |
|--------|-------|
| WhatsApp templates | POST `/whatsapp/templates` (+400 sin key/name/body), POST `/whatsapp/templates/preview` (+400 sin body), POST `/whatsapp/templates/seed` (idempotente), DELETE `/whatsapp/templates/:key` |
| WhatsApp followups | POST `/whatsapp/followups` (+400 sin campos), POST `/whatsapp/followups/:id/cancel`, POST `/whatsapp/followups/process` |
| Marketing sequences | PATCH `/marketing/sequences/:id` (+404), DELETE `/marketing/sequences/:id`, POST `/marketing/sequences/run` |
| CRM sync | POST `/crm/sync/:ordenId` (500 graceful sin CRM externo), POST `/crm/retry` (0 si no hay fallidos) |
| Thinkcar | POST `/thinkcar/imports/:id/link` (+404), POST `/thinkcar/pending/:id/assign` (+400 sin ordenTrabajoId) |
| Enterprise | PUT `/enterprise/white-label` (upsert idempotente) |

### Bugs encontrados

Ninguno de producción. Los fallos iniciales fueron UUIDs mal formados
en las fixtures del test (13 chars en el último segmento), corregidos
antes de la corrida GREEN.

**Efecto en métricas (Sprint 117):** total 522 · sin consumidor 113 (sin
cambios) · sin test 200 → **186** (−14) · escritura sin test 55 → **41**
(−14) · clase D 0 · excluidas 41. Techos del guard congelados en
**113/186/41/0** (piso de exclusiones 36). Validación: backend 121 ficheros
/ 2370 PASS + 4 skip + guard 7/7 + tsc 0. Web no se tocó.

---

## Sprint 118 — Cobertura de escritura lote 5 (backlog T-61) · 2026-10-09

Quinto lote de tests de comportamiento para rutas de escritura sin test.
14 ops, todas offline/local (sin servicios externos): 4 intelligence DTC
(parse, parse-file, diagnose, + safety/protocol), 1 decode-safety (sin VIN,
sin llamada NHTSA), 2 intelligence OCR (plate, cedula — fallback base64),
1 thinkcar mobile-dtc, 1 whatsapp followups/auto, 2 migration (export,
import dryRun), 3 portal (magic, feedback, appointments — vía magic-link
session). Patrón fase7 (tenant propio `e2e-s118`, fixtures SQL idempotentes,
`app.inject` con template literals).

### Rutas cubiertas (14 ops)

| Módulo | Rutas |
|--------|-------|
| Intelligence DTC | POST `/intelligence/dtc/parse` (+400 sin reportText), POST `/intelligence/dtc/parse-file` (+400 sin archivo), POST `/intelligence/dtc/diagnose` (+400 sin códigos válidos) |
| Intelligence safety | POST `/intelligence/safety/protocol` (HV, +400 tensión >1500), POST `/intelligence/decode-safety` (BYD → RED, offline sin VIN) |
| Intelligence OCR | POST `/intelligence/ocr/plate` (202, base64, +400 sin imagen), POST `/intelligence/ocr/cedula` (202, base64) |
| Thinkcar | POST `/thinkcar/mobile-dtc` (manual_review sin OT, +400 sin códigos) |
| WhatsApp | POST `/whatsapp/followups/auto` (según trigger, scheduled 0 si no hay template) |
| Migration | POST `/api/v1/migration/export`, POST `/api/v1/migration/import` (dryRun +400 sin data) |
| Portal | POST `/portal/auth/magic` (link), POST `/portal/feedback` (+401 sin sesión), POST `/portal/appointments` (201/400 por disponibilidad) |

### Bugs encontrados

Ninguno de producción. Los fallos iniciales fueron de test:
1. CSRF double-submit en rutas públicas del portal (sin Bearer) — se
   resolvió enviando token autoconsistente cookie+header.
2. Shape real del protocolo HV: `riskAssessment` (no `isHighVoltage`).
3. Status del job OCR puede ser `processing` inmediatamente (race).
4. `parse-file` fallback de texto crudo es código muerto: el plugin
   multipart decora `request.file`, así que siempre entra la rama
   multipart (si no hay parte de archivo → 400).

**Efecto en métricas (Sprint 118):** total 522 · sin consumidor 113 (sin
cambios) · sin test 186 → **172** (−14) · escritura sin test 41 → **27**
(−14) · clase D 0 · excluidas 41. Techos del guard congelados en
**113/172/27/0** (piso de exclusiones 36). Validación: backend 122 ficheros
/ 2392 PASS + 4 skip + guard 7/7 + tsc 0. Web no se tocó.
