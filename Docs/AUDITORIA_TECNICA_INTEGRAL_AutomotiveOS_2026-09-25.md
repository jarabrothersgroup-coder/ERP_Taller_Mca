# AUDITORÍA TÉCNICA INTEGRAL — AutomotiveOS Cloud ERP

**Fecha:** 2026-09-25 · **Alcance:** sistema completo (7 dominios) · **Marco:** "7 Prompts para Programar más rápido" (El Arquitecto, El Constructor, El Detective, El Crítico, El Optimizador, El Escudo, El Narrador)

---

## 0. MÉTRICAS DE BASE

| Métrica | Valor |
|---|---|
| Backend | Fastify+TS · 93.725 LOC · 24 módulos plugin · **564 rutas** |
| Frontend web | Next 16 · 41.669 LOC · 74 páginas · **328 paths API** |
| Mobile | RN/Expo · 5.706 LOC · 22 pantallas |
| Base de datos | Postgres · 24 migraciones · 91 tablas con RLS definido |
| Tests | 1.780 backend (41/57 archivos **estructurales/readFile**) · 111 web · 48 E2E (**solo assert títulos**) |
| Conectividad FE↔BE | **12 rutas cliente → endpoint inexistente confirmadas** · **316/564 endpoints sin consumidor** |

**Lectura por audiencia:** cada hallazgo trae **[Negocio]** impacto/ROI · **[Arquitectura]** patrón/deuda · **[Dev]** evidencia `archivo:línea`.

---

## 1. INFORME EJECUTIVO — GAPS POR DOMINIO

### 🔵 DOMINIO 1 — OPERACIONES (Hub, Panel Ejecutivo, Recepción, Calendario, WhatsApp)

| ID | Gap | Tipo | Evidencia |
|---|---|---|---|
| OPS-01 | **Crear turno del Calendario 404**: el dialogo POSTea `/workshop/citas`, no existe esa ruta (real: `/scheduling/appointments`). El usuario recibe "Error creando turno" y **no se guarda nunca** | Conectividad/CRUD | `web/.../calendario/new-appointment-dialog.tsx:67` vs `scheduling.routes.ts` |
| OPS-02 | **SSE de notificaciones muerto**: URL default `/workshop/notifications/sse/stream` →404, reintenta ×10 y se rinde. La campana solo funciona por fetch inicial | Conectividad | `web/src/hooks/use-sse.ts:61`, `notification-bell.tsx:143`; backend sirve `/api/notifications/stream` |
| OPS-03 | **Panel Ejecutivo sin datos**: consume `/analytics/kpis\|trends\|distribution\|mechanics` pero **no existe rewrite `/analytics`** en `web/next.config.mjs` ni `vercel.json` →404 y la página (sin `catch/onError`) **muestra ceros en silencio** | Conectividad/Integridad | `ejecutivo/page.tsx:423-445`, `analytics/page.tsx` (0 manejo de error), lista de rewrites |
| OPS-04 | **Efecto secundario sorpresivo en el Hub**: seleccionar una OT *asigna* la OT al técnico filtrado (`assignWorkOrder`) con el error **tragado** (`catch(){}`) — el tablero puede mostrar asignaciones que nadie hizo | UX/Lógica | `hub/page.tsx:84-92` |
| OPS-05 | **Recepción sin corrección**: `/workshop/ingresos` solo POST/GET (sin PATCH/DELETE) — un ingreso mal cargado no se puede corregir, solo apilar observaciones | CRUD | `ingresos.ts` rutas |
| OPS-06 | **Fotos de recepción/checklist no se ven**: `<img src={/uploads/${path}}>` no tiene ruta backend ni rewrite (real: `/storage/:bucket/*`); los adjuntos de OT usan `/api/storage/...` que tampoco existe | Integridad/UI | `checklist/[ingresoId]/page.tsx:786`, `taller/[id]/page.tsx:1161`, `src/plugins/storage.ts:46` |
| OPS-07 | Calendario sin DELETE de cita (solo PATCH estado); badge de WhatsApp en sidebar hardcodeado `"3"` | CRUD/UI | `scheduling.routes.ts`, `sidebar.tsx:96` |

**[Negocio]** OPS-01/03/06 = pérdida de turnos, decisiones sobre tableros en cero y evidencia fotográfica ilegible (uso legal en disputas de daños). **[Arquitectura]** el patrón "cliente asume ruta → backend cambió" se repite: no hay contrato único. **[Dev]** todos los fixes son de URL/rewrite (ver Fase 1).

---

### 🟠 DOMINIO 2 — SERVICIOS (Catálogo, Precios, Flat Rate, Asignación, Mecánicos, DVI, Thinkcar, Predictivo)

| ID | Gap | Tipo | Evidencia |
|---|---|---|---|
| SRV-01 | **Editar Proveedor 404**: UI hace `PATCH /workshop/proveedores/:id` pero backend solo declara GET/POST/GET:id/**DELETE** — no hay UPDATE | CRUD | `proveedores/page.tsx:126` vs `proveedores.routes.ts` |
| SRV-02 | **Mecánicos sin DELETE** (GET/POST/PATCH); **DVI sin DELETE** de inspección/ítem (solo PATCH de estado); asignación OT sin desasignación explícita | CRUD | `mechanic-profiles.routes.ts`, `dvi.routes.ts`, `mechanic-assignment.routes.ts` (solo POST assign) |
| SRV-03 | **⚠️ "Ficha de próximos mantenimientos" NO existe**: (a) nada se persiste al completar un servicio; (b) `predictMaintenance` inventa el odómetro (`kmActual = kmPorMes * 12`) **ignorando `vehiculos.kilometraje`** y el km capturado en cada ingreso; (c) nunca actualiza el vehículo con el km del checklist; (d) **no filtra tenant en la lookup del vehículo** (fuga cross-tenant por UUID); (e) los endpoints `/workshop/predictions/*` **son huérfanos** — el FE solo usa `/predictions/ml` | Integridad/Seguridad/CRUD | `predictive-maintenance.service.ts:66-141`, `ingreso.service.ts:170` (km al ingreso sin propagar), `predictive-ml/page.tsx:120-134` |
| SRV-04 | **Cierre de OT sin transacción**: el estado se commitea primero; historial, **consumo de stock**, **asiento de reconocimiento de ingresos** y notificaciones van cada uno en `try/catch` que solo hace `console.error` → si fallan, la OT queda "Listo" con stock y contabilidad desfasados **sin alerta ni reintento** | Integridad/Lógica | `orden.service.ts:431-502` (comentarios "CRÍTICO" que no bloquean) |
| SRV-05 | Flat Rate sin corrección de reloj (sin ajuste/anulación de clock-in) | CRUD | `flat-rate.routes.ts` |
| SRV-06 | Thinkcar/DVI: bien cubierto (16 rutas thinkcar, DVI before/after) — **positivo** | — | — |

**[Negocio]** SRV-04 es el mayor riesgo operativo del taller: OT dada por lista ⇒ facturación y stock divergentes (merma silenciosa de margen). **[Arquitectura]** patrón "commit temprano + side-effects resilientes" sin outbox: fallo = divergencia permanente. **[Dev]** cerrar con una transacción única + cola de reintentos (Fase 3).

---

### 🟢 DOMINIO 3 — PROVEEDORES / INVENTARIO (Stock, Movimientos, OC, Almacenes, TecDoc, Cíclico)

| ID | Gap | Tipo | Evidencia |
|---|---|---|---|
| INV-01 | **Entrada/Salida de stock desde UI 404**: `api.stockEntrada/stockSalida` llaman `/inventory/stock/entrada\|salida` (no existen; reales: `/inventory/repuestos/salida` y `/inventory/repuestos/:id/ingreso`) — la pantalla de Movimientos **no registra movimientos** | Conectividad | `api.ts:539,550`, `movimientos/page.tsx:114-116` vs `repuestos.ts:297,355` |
| INV-02 | **Devolución de herramienta 404**: `/inventory/tool-loans/return` sin `:id` (real `/inventory/tool-loans/:id/return`) | Conectividad | `api.ts:615` vs `tool-loans.ts` |
| INV-03 | **Órdenes de Compra incompletas**: existe schema `purchase-orders` y la página `/inventario/ordenes-compra`, pero solo hay `auto-po/generate\|pending` — **sin CRUD manual, sin recepción de OC, sin edición** | CRUD/Conectividad | `auto-po.routes.ts`, `ordenes-compra/page.tsx:75,104` |
| INV-04 | **Almacenes sin PATCH** (no editable: solo GET/POST/DELETE/transferir) | CRUD | `almacenes.ts` |
| INV-05 | **Filtro de tenant ausente en lookups de stock**: `getRepuestoById(id)` y el `UPDATE` atómico de `salidaStock` no filtran `tenantSlug` (dependen de RLS… que está inerte, ver SEG-02) | Seguridad | `stock.service.ts:122-127, 343-358` |
| INV-06 | `salidaStock/ingresoStock` hacen 3-4 escrituras (stock → asiento → movimiento → alerta) **sin transacción**: si el asiento falla, stock ya mutado | Integridad | `stock.service.ts:332-430` |
| INV-07 | Conteo cíclico, transferencias, TecDoc, reportes PDF, aprobación de ajustes: **completos** — positivo | — | `cycle-count.routes.ts` (9 rutas) |

---

### 🔴 DOMINIO 4 — FINANZAS (Facturación, SIFEN, Presupuestos, NC, Contabilidad, Tesorería, Nómina, Consolidación)

| ID | Gap | Tipo | Evidencia |
|---|---|---|---|
| FIN-01 | **Nómina no calculable**: `calculatePayroll` → `POST /finance/payroll/calculate` (404; real `/api/v1/finance/payroll/calculate`) — corta de nómina y break-even no corren desde la UI | Conectividad | `api.ts:861`, `nomina/page.tsx:512` vs `payroll-routes.ts:16` |
| FIN-02 | **Alta de cuenta contable 404**: dialog usa `/finance/accounting/cuentas` (real `/finance/contabilidad/cuentas`) — el plan contable no se puede ampliar desde la UI | Conectividad | `contabilidad/new-account-dialog.tsx:52` |
| FIN-03 | **Configuración de impresión y Reimpresión 404**: 6 llamadas a `/api/label-printing/*` (real `/label-printing/*`) | Conectividad | `facturacion/configurador:166,217,232`, `reimpresion:88,105,132` |
| FIN-04 | **Factura manual sin anulación**: `invoice.routes` solo issue/list/get; la anulación existe solo vía SIFEN (`/finance/sifen/anular`) — no se puede corregir una factura manual emitida | CRUD/Fiscal | `invoice.routes.ts` |
| FIN-05 | **63 endpoints contables sin UI**: RG90 (libros/retenciones), cuadratura, centralización, devengamiento, revaluo, diferencia de cambio, reserva legal, rentabilidad… implementados y testeados pero **inalcanzables para el usuario** | Conectividad/Producto | `accounting.ts` (63 rutas no llamadas por FE) |
| FIN-06 | Tesorería: cuentas sin DELETE/baja; transferencias sin GET (consulta de historial de transferencias inexistente) | CRUD | `treasury.routes.ts` |
| FIN-07 | Nómina: `staff-profiles`/`payroll-summary` sin rutas CRUD propias (solo cálculo/historial/comisiones) | CRUD | `payroll-routes.ts` (4 rutas) |
| FIN-08 | **SIFEN completo (15 rutas: emitir/firmar/enviar/consultar/anular/NC/contingencia)** y presupuestos con flujo de aprobación — **positivo** | — | `sifen.ts`, `budget.routes.ts` |

**[Negocio]** FIN-01/02/03 frenan tres procesos críticos (nómina mensual, apertura contable, facturación en papel). **[Arquitectura]** FIN-05 = ~30% del esfuerzo de contabilidad construido sin superficie de uso: features fantasma que inflan la percepción de madurez.

---

### 🟣 DOMINIO 5 — CRM & CRECIMIENTO (Clientes, Pipeline, Marketing, Analytics)

| ID | Gap | Tipo | Evidencia |
|---|---|---|---|
| CRM-01 | **Clientes: DELETE duro con cascada** — `DELETE /workshop/clientes/:id` borra el cliente y, por `onDelete: cascade`, **vehículos y TODAS las órdenes de trabajo**; las facturas quedan huérfanas (`ordenId` es uuid **sin FK**). Sin guardas de "cliente con OT/facturas" | Integridad/Fiscal | `client.service.ts:181-205`, `ordenes-trabajo.ts:71`, `facturas.ts:75` (sin `.references`) |
| CRM-02 | **Fidelización de solo lectura**: existe `addLoyaltyPoints` en servicio pero **sin ruta** — no se acreditan puntos desde la UI; reseñas solo GET (sin respuesta/gestión) | CRUD | `loyalty.routes.ts` (2 GET), `review.routes.ts` (2 GET) |
| CRM-03 | **Campañas sin PATCH/DELETE** (solo POST/GET/stats) — una campaña mal creada no se corrige ni se archiva | CRUD | `campaign.routes.ts` |
| CRM-04 | Pipeline CRM Kanban (stages CRUD + move/close) y analytics con export CSV: **completos** — positivo | — | `deals.routes.ts`, `analytics.routes.ts` |
| CRM-05 | `globalSearch` → `/api/v1/search` **no existe** (código muerto en `api.ts:1170`) | Conectividad (latente) | `api.ts:1167-1170` |

---

### ⚪ DOMINIO 6 — ADMINISTRACIÓN (Taller, Usuarios, Vehículos, Flotas, Cuenta)

| ID | Gap | Tipo | Evidencia |
|---|---|---|---|
| ADM-01 | **Flotas sin PATCH/DELETE** (solo POST/GET/GET:id) — contrato B2B no editable | CRUD | `fleet.routes.ts` |
| ADM-02 | **Usuarios = hallazgo crítico → ver SEG-01** | Seguridad | `profiles.ts` |
| ADM-03 | Vehículos CRUD completo + historial + decode VIN; sucursales CRUD completo — positivo | — | `vehiculos.ts`, `sucursales.routes.ts` |
| ADM-04 | `config/dashboard/consolidated` y `/role` sin consumidor FE (dashboards por rol no implementados en UI) | Conectividad | `sucursales.routes.ts:174,199` |
| ADM-05 | Sidebar: ver UI-01/UI-02 (TRN-06) | UI | — |

---

### ⚫ DOMINIO 7 — SEGURIDAD (HW, Enterprise, Impresión, Backup, Config, Cuenta, Perfil, Suscripción)

| ID | Gap | Tipo | Evidencia |
|---|---|---|---|
| SEG-01 | **🔴 Escalación de privilegios + acceso cross-tenant en usuarios**: `POST/PATCH/DELETE /api/profiles` **sin `requireAdmin` ni chequeo de rol**; el PATCH acepta `role` arbitrario (un usuario se hace admin) y hace lookup `eq(profiles.id, id)` **sin filtro de tenant**; `profiles` está **excluido de RLS** en 0019. Cualquier autenticado puede promoverse o desactivar usuarios de otro taller | Seguridad (CRÍTICO) | `profiles.ts:60,118-150,157-175`, `0019_rls_security.sql:14-17` |
| SEG-02 | **RLS inerte**: la migración 0019 declara que la app conecta como rol **BYPASSRLS** (superuser) → las políticas no aplican; `ENABLE_REQUEST_TENANT_CONTEXT=false` por defecto (`env.ts:143`); `rls.ts:67` usa `set_config(..., false)` (**session-scoped en pool compartido**, contradiciendo su propio comentario "SET LOCAL"). El aislamiento real depende 100% de filtros app… de los que **180/251 lookups por id no filtran tenant** | Seguridad (CRÍTICO) | cabecera de `0019`, `rls.ts:55-72`, escaneo de servicios |
| SEG-03 | **Backup/restore sin autorización real**: el comentario dice "SuperAdmin + 2FA required" pero el código solo exige que el body **traiga** un `twoFactorCode` (nunca lo valida) y **no chequea rol**; `executeRestore` opera sobre `DATABASE_URL`. Igual sin rol: `/backup/purge`, `/backup/execute` | Seguridad (CRÍTICO) | `backup.routes.ts:191-222` |
| SEG-04 | **RBAC casi no usado**: `requireAdmin` solo en 4 archivos (sucursales, 2FA, SSO, auditoría). Sin rol en: DELETE clientes, batch delete OT, SIFEN anular, stock masivo, ajustes, presupuestos, perfiles | Seguridad (ALTO) | `rbac.ts:209-230` (definido) vs usos |
| SEG-05 | `vercel.json` expone `Access-Control-Allow-Origin: *` sobre `/api` y apunta rewrites a `http://localhost:4000` (config muerta/insegura) | Seguridad/Deploy | `vercel.json` |
| SEG-06 | **Positivos verificados**: auth-gate global con allowlist, CSRF double-submit, rate-limit 200/min, Helmet+CSP, scrypt, `TOKEN_SECRET` fail-closed, `/metrics` con basic auth | — | `auth-gate.ts`, `csrf.ts`, `app.ts` |

---

### 🔗 HALLAZGOS TRANSVERSALES (Arquitectura y Calidad)

| ID | Hallazgo | Evidencia |
|---|---|---|
| TRN-01 | **Contrato FE↔BE roto en 12 puntos**: web: `/workshop/citas`, `/finance/accounting/cuentas`, `/inventory/stock/entrada\|salida`, `/finance/payroll/calculate`, `/workshop/notifications/sse/stream`, `/api/label-printing/*` (×6), `/api/storage/:p`, `/uploads/:p`, `/portal/profile`, `/analytics/*` (sin rewrite). Mobile: **`/workshop/ordenes/:id/hv-lockout`** (real `/sign-lockout` → **firma de bloqueo HV EV/HEV no funciona desde la app**, incumple protocolo de seguridad de engram), `/scheduling/citas`, `/inventory/stock/movement`, `/intelligence/dashboard` | diff automatizado cliente↔servidor |
| TRN-02 | **316/564 endpoints sin consumidor** (web+mobile+SPA legacy): 63 en contabilidad, 10 label-printing, 8 secuencias marketing… Coste de mantenimiento y falsa cobertura | script de análisis de rutas |
| TRN-03 | **3 superficies de despliegue divergentes**: `next.config.mjs` raíz (stale, solo 2 rewrites), `web/next.config.mjs` (26 rewrites, sin `/analytics`), `vercel.json` (9 rewrites a localhost), nginx on-prem (solo proxía `/api`, `/storage`, `/health`). Quien edite la config equivocada rompe todo el tráfico API | `next.config.mjs`, `web/next.config.mjs`, `scripts/erp-taller.nginx.conf` |
| TRN-04 | **Tests que no prueban comportamiento**: 41/57 suites leen archivos y hacen `toContain` sobre strings de rutas/comentarios; E2E 13 specs verifican **títulos de página** ("analytics page shows KPIs" = H1 visible). Por eso 12 rutas 404 sobreviven a 1780+111+48 tests verdes | `tests/sprint101.test.ts:33-40`, `web/e2e/pages.spec.ts:65-69` |
| TRN-05 | **Sin manejo de error de UI en 26/64 páginas** (0 `catch/onError/toast`): fallback a skeleton infinito o ceros silenciosos; solo 39 `toast.error` en toda la app | escaneo por página |
| TRN-06 | **Sidebar sin los estados que pide el usuario**: sin grupos colapsables en cascada, estado de colapsado no persiste (`useState` en `shell.tsx:46`), sin filtrado RBAC, badges hardcodeados (`WhatsApp "3"`, `Nuevo`) | `sidebar.tsx`, `shell.tsx` |
| TRN-07 | **Auditoría/trazabilidad parcial**: audit-log solo en contabilidad + enterprise; historial de estados de OT se inserta **fuera de la transacción** (puede perderse); clientes/vehículos/stock sin auditoría de cambios | `orden.service.ts:432-447` |
| TRN-08 | **Persistencia de km desconectada**: el checklist guarda km en `ingresos`, pero `vehiculos.kilometraje` solo se actualiza si el usuario lo edita a mano → base para mantenimiento predictivo y flotas inútil | `ingreso.service.ts:170`, `vehicle.service.ts:251` |

---

## 2. PLAN DE REMEDIACIÓN DETALLADO

> Prioridad: **P0** crítico (riesgo legal/seguridad/dinero parado) · **P1** alto · **P2** medio · **P3** bajo.
> Esfuerzo en días-hombre de un dev senior full-stack.

### FASE 0 — Congelar el contrato (P1 · 1,5 días · sin dependencias)

| ID | Tarea | Esfuerzo | Criterio de éxito |
|---|---|---|---|
| T-00 | Test de **contrato FE↔BE**: script en CI que extrae rutas del backend (`app.printRoutes` o regex) y los paths de `api.ts`/`data-service`/`mobile`/diálogos, y falla ante paths sin match (param-normalizado) | 1 d | CI falla si se reintroduce una URL rota; 0→12 pendientes al cerrar Fase 1 |
| T-01 | Unificar config: **eliminar `next.config.mjs` raíz** (o marcar deprecated), alinear `vercel.json` con `web/next.config.mjs` (generar ambos desde una lista única `API_PREFIXES`), añadir `/analytics` al set | 0,5 d | Un solo lugar define los prefixes; grep de `rewrites` da 1 resultado vivo |

### FASE 1 — Reconexión de flujos rotos (P0 · 4 días · paralelizable con Fase 2)

| ID | Gap | Fix | Esfuerzo | Criterio de éxito |
|---|---|---|---|---|
| T-11 | OPS-01 | `new-appointment-dialog` → `POST /scheduling/appointments` (mapear body) | 0,5 d | Turno creado visible en calendario (E2E) |
| T-12 | OPS-02 | `use-sse.ts` default → `/api/notifications/stream` (+ tenant en query como espera el backend) | 0,25 d | Estado SSE "connected" y push de prueba en campana |
| T-13 | OPS-03 | Añadir rewrite `/analytics/:path*` (+ test) **y** manejo de error en `ejecutivo`/`analytics` | 0,5 d | KPIs con datos reales; en fallo, mensaje de error (no ceros) |
| T-14 | INV-01 | `stockEntrada/stockSalida` → `/inventory/repuestos/:id/ingreso` y `/inventory/repuestos/salida` | 0,5 d | Movimiento persistido y visible con asiento |
| T-15 | INV-02 | `tool-loans/return` → `/inventory/tool-loans/:id/return` | 0,25 d | Devolución registrada, préstamo cerrado |
| T-16 | FIN-01 | `calculatePayroll` → `/api/v1/finance/payroll/calculate` | 0,25 d | Corta de nómina genera resultado + historial |
| T-17 | FIN-02 | dialog cuentas → `/finance/contabilidad/cuentas` | 0,25 d | Cuenta creada aparece en el árbol |
| T-18 | FIN-03 | 6 llamadas → `/label-printing/*` | 0,5 d | Config de impresión carga y guarda; reimpresión lista |
| T-19 | OPS-06 | Servir fotos/adjuntos: front → `/storage/<bucket>/<path>` **o** endpoint `/api/storage/:bucket/*` delegado; revisar formato de `foto.path` | 0,75 d | Imágenes de checklist y adjuntos renderizan (E2E con `expect(img).toBeVisible()`) |
| T-20 | TRN-01 móvil | `hv-lockout`→`sign-lockout`; `scheduling/citas`→`appointments`; `stock/movement`→rutas reales; `intelligence/dashboard`→endpoint real/eliminar | 0,75 d | Firma HV desde app mobile operativa (test de seguridad EV) |
| T-21 | Portal | `/portal/profile` → endpoint existente o crear `GET /portal/profile` (respetando auth mágica) | 0,25 d | Booking con teléfono del cliente |

### FASE 2 — Seguridad (P0 · 6-8 días · paralela a Fase 3)

| ID | Gap | Fix | Esfuerzo | Criterio de éxito |
|---|---|---|---|---|
| T-21a | SEG-01 | `requireAdmin` en `profileRoutes` (POST/PATCH/DELETE) + **filtro de tenant en todos los lookups** + whitelist de campos (prohibir auto-promoción: solo admin cambia `role`) | 1,5 d | Test: usuario `mechanic` →403; A no toca perfil de B (suite `security-tenant-isolation`) |
| T-21b | SEG-03 | Backup: `requireAdmin` + **validación real de TOTP** (servicio 2FA ya existe) en `restore/purge/execute` | 1,5 d | Test: no-admin →403; restore sin TOTP válido →403 |
| T-21c | SEG-04 | `requireManager/Admin` en destructivos: delete clientes, batch delete OT, anular SIFEN, ajustes masivos, cerrar periodo, transferencias | 2 d | Matriz rol×endpoint documentada y testeada |
| T-21d | SEG-02 | Decisión de arquitectura: **(a)** rol Postgres least-privilege sin BYPASSRLS + `ENABLE_REQUEST_TENANT_CONTEXT=true`, o **(b)** aceptar app-filtered y auditar los **180 lookups sin tenant** (script + fix). Corregir `rls.ts` (no session-scoped en pool) | 3-4 d | Prueba de fuego: intento cross-tenant bloqueado a nivel DB (o 200/200 lookups con tenant) |
| T-21e | SEG-05 | Quitar `Access-Control-Allow-Origin: *`; borrar/archivar `vercel.json` apuntando a localhost | 0,5 d | Headers revisados; config de deploy única |

### FASE 3 — Integridad transaccional (P1 · 5 días · requiere Fase 1)

| ID | Gap | Fix | Esfuerzo | Criterio de éxito |
|---|---|---|---|---|
| T-31 | SRV-04 | `updateOrdenStatus`: envolver `update + historial + consumeStock + asiento` en **una transacción**; lo no-crítico (WhatsApp/email/TV) a **outbox con reintento + alerta** | 2 d | Fallo en asiento → rollback total; sin "Listo" con stock desfasado (test) |
| T-32 | INV-06 | `salidaStock/ingresoStock` en `db().transaction()` (stock+asiento+movimiento atómicos) | 1 d | Test de fallo intermedio: nada queda a medias |
| T-33 | TRN-07 | Auditoría de cambios en clientes/vehículos/stock (reutilizar `audit-log`) + historial de OT dentro de la transacción | 1,5 d | Trazabilidad completa: quién/cuándo/antes-después |
| T-34 | CRM-01 | `deleteClient`: bloquear (o soft-delete) si tiene OT/facturas; FK/respaldo para `facturas.ordenId` + migración | 1 d | Imposible borrar cliente con facturas; 0 registros fiscales huérfanos |

### FASE 4 — CRUD y features huérfanas (P1-P2 · 10-12 días · requiere Fase 2)

| ID | Gap | Fix | Esfuerzo | Criterio de éxito |
|---|---|---|---|---|
| T-41 | SRV-01 | `PATCH /workshop/proveedores/:id` (service+route+test) | 0,5 d | Editar proveedor persiste |
| T-42 | SRV-02 | DELETE mecánicos (soft), DELETE/edit almacenes, desasignar OT, DELETE campañas, PATCH/DELETE flotas, baja de herramientas | 2 d | Matriz CRUD completa por módulo |
| T-43 | **SRV-03** | **Ficha de próximos mantenimientos**: (1) tabla `mantenimientos_programados` (vehiculo_id, servicio, km/fecha objetivo, estado, origen=OT completada); (2) al pasar OT a `Listo`, generar/actualizar el próximo mantenimiento de los servicios realizados; (3) propagar `ingresos.kilometraje → vehiculos.kilometraje`; (4) `predictMaintenance` con km real + historial de servicios + **filtro tenant**; (5) UI en detalle de vehículo/flotas + recordatorio WhatsApp (template "Próximo servicio programado" **ya existe**) | 4-5 d | Al completar un servicio aparece la ficha; notificación programada; km real visible |
| T-44 | INV-03 | CRUD manual de Órdenes de Compra (create/edit/recepción→ingreso de stock) sobre `purchase-orders` existente | 2,5 d | Flujo UC completo con asiento y stock |
| T-45 | FIN-04/07 | Anulación de factura manual (estado + reverso vía `AutoReversalService`); rutas CRUD staff/payroll-summary | 1,5 d | Factura anulada genera reverso automático |
| T-46 | CRM-02 | Escritura de fidelización (acreditar/canjear) + gestión de reseñas (responder) | 1 d | Puntos acreditados desde la UI |
| T-47 | TRN-02 | Decisión sobre las 316 rutas sin consumidor: publicar en UI (priorizar FIN-05: RG90/libros/cuadratura), exponer en portal, o deprecar con test que falle si nadie las llama | 2-3 d | Inventario de endpoints con estado (usado/UI-planeado/deprecar) |

### FASE 5 — UI/UX (P1-P2 · 6-8 días · paralela)

| ID | Gap | Fix | Esfuerzo | Criterio de éxito |
|---|---|---|---|---|
| T-51 | TRN-06 | **Sidebar en cascada**: grupos colapsables (chevron por sección, estado en `localStorage`), auto-expandir sección activa, colapsado total persistente, **badges dinámicos** (contador real de WhatsApp vía `/whatsapp/queue/stats`, ocultar "Nuevo"), items filtrados por rol | 2-3 d | Grupos abren/cierran y recuerdan estado; 0 badges falsos; menú = permisos |
| T-52 | TRN-06/Hub | Hub: conservar el **menú lateral global visible** (procesos no urgentes siguen navegables), eliminar asignación automática al seleccionar OT (acción explícita), estados de error/vacío en columna de OTs | 1-1,5 d | Navegación global siempre disponible; 0 asignaciones fantasma |
| T-53 | TRN-05 | Manejo de error en las 26 páginas sin `catch/onError`: patrón `isError → <ErrorState/> + toast` + skeleton con timeout | 2 d | Ninguna página en skeleton/zer0 silencioso |
| T-54 | TRN-05 | Filtros/dropdowns: componente `FilterSelect` con opciones dinámicas (15 páginas usan `<select>` nativo), paginación server-side donde hoy filtra en cliente | 1,5 d | Filtros que consultan el backend; componente unificado |
| T-55 | OPS-07 | Feedback de éxito/error uniforme en CRUD (hoy 39 toasts vs decenas de mutaciones) | 1 d | Toda mutación reporta resultado |

### FASE 6 — Calidad continua (P2 · 2 días + cadencia)

| ID | Tarea | Esfuerzo | Criterio de éxito |
|---|---|---|---|
| T-61 | Reemplazar tests estructurales por **tests de comportamiento**: `app.inject` en rutas críticas (11 archivos hoy) | 2 d + cadencia | ≥80% de rutas críticas con test de comportamiento |
| T-62 | E2E con asserts de **datos**: `analytics` verifica KPI ≠ vacío, `calendario` verifica turno creado, `nomina` verifica cálculo | 1,5 d | Los 12 breaks actuales habrían fallado |
| T-63 | Contrato T-00 + chequeo de tenant (script sobre los 180 lookups) en CI | 1 d | Regresiones bloqueadas antes de merge |

---

### SECUENCIA RECOMENDADA (mínimo riesgo, valor temprano)

```
Semana 1   [Fase 0 + Fase 1]  → 12 flujos reconectados (nómina, stock, calendario,
                                 impresión, Panel Ejecutivo, fotos, mobile HV)  ← ROI inmediato
Semana 2   [Fase 2]           → Escalación de privilegios, backup y RLS cerrados
            (paralelo) [T-31/T-32 inicia]
Semana 3   [Fase 3]           → Cierre transaccional de OT y stock (merma silenciosa = 0)
Semana 4-5 [Fase 5]           → Sidebar en cascada + Hub UX + errores visibles
Semana 5-7 [Fase 4]           → Ficha de mantenimientos, UC manual, CRUD completo
Semana 7+  [Fase 6]           → Tests de comportamiento + E2E con datos (sostén)
```

**Dependencias duras:** T-00 antes de Fase 4/7 (evita reabrir contratos) · T-21a-c antes de T-42 (deletes con rol) · T-31/T-32 antes de T-43/T-44 (si no, la ficha y las UC heredan la no-atomicidad) · T-01 antes de cualquier fix de rewrites.
**Paralelizables:** Fase 1 ∥ Fase 2 · Fase 5 ∥ Fase 4 · Fase 6 continua.

**Esfuerzo total estimado: 40-48 días-hombre** (P0 ≈ 12 d · P1 ≈ 20 d · P2 ≈ 12 d).

---

### MÉTRICAS DE ÉXITO GLOBAL (dashboard de cierre)

1. **0** paths de cliente sin endpoint (test T-00 en CI).
2. **100%** de los flujos críticos (turno→OT→factura→cobro→asiento) con E2E que verifique datos, no títulos.
3. **0** escrituras multi-paso sin transacción en stock, OT y facturación.
4. Matriz rol×endpoint al 100% en destructivos; intento cross-tenant bloqueado en DB.
5. Ficha de próximos mantenimientos generada en **100% de OT completadas** y visible en vehículo/flota.
6. Páginas con manejo de error: 64/64 · sidebar con grupos colapsables persistentes y badges dinámicos.

---

### FORTALEZAS VERIFICADAS (no erosionar)

- SIFEN completo con contingencia y nota de crédito (15 endpoints).
- Flujo presupuesto → aprobación → OT con congelamiento de servicios/repuestos.
- Contabilidad automática con reversión (`AutoReversalService`) y cierre per iódico.
- Aprobación multi-nivel de ajustes de stock; conteo cíclico y transferencias entre almacenes.
- Hub de Operaciones con board agregado en 1 request + SSE con heartbeat.
- Auth-gate global, CSRF double-submit, rate-limit, Helmet/CSP, scrypt, `TOKEN_SECRET` fail-closed.
- Offline/PWA con sync y app mobile con 22 pantallas.
- Backlog de sprints bien documentado en `engram.json`.

---

*Auditoría generada por El Arquitecto (marco "7 Prompts para Programar más rápido") — evidencia verificada contra el código del repositorio el 2026-09-25.*
