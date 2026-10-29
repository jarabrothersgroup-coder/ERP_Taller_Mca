# Auditoría canónica en 3 frentes — Diagramas · Reglas de negocio · Agrupación de servicios

**Fecha:** 2026-10-28 · **Alcance:** repo `ERP_Taller_Mca` @ `95b6e76` (tras Fase 0 del Sprint 132) · **Trazabilidad:** registrado en `engram.json → state.audit_canonica_3frentes_20261028` · **Derivado en plan:** `engram.json → state.sprint_132_plan` (tareas S132-19…28, ampliación de Fases 1-3)

**Método:** inventario de fuentes canónicas → extracción de reglas de negocio documentadas (frente B) e inventario de diagramas (frente A) en dos exploraciones paralelas → verificación directa de las afirmaciones contra el código (24 módulos, esquema, middleware, seeds) → contraste con la auditoría tricapa previa (`AUDITORIA_ARQUITECTURA_TRICAPA_2026-10-28.md`, @ `ae53563`) para no duplicar hallazgos ya registrados.

---

## 0. Fuentes canónicas localizadas y tipo de cada una

| Fuente | Tipo | Rol en esta auditoría |
|---|---|---|
| `docs/Proyecto/01_ERS_Especificacion_Requisitos_Software.md` (v2.0, 19-jun-2026) | **Especificación formal de requisitos** (Markdown, estructura IEEE-830/MITIC, RF-xxx/RNF-xxx) | Fuente primaria de reglas de negocio |
| `docs/Proyecto/02_DAS_Documento_Arquitectura_Software.md` (v3.0, 22-jun-2026) | **Documento de arquitectura formal** (Markdown, "Documento Oficial MITIC") con **diagramas ASCII embebidos** | Fuente primaria de diagramas y agrupación de servicios |
| `Docs/Proyecto/Especificación Técnica - AutomotiveOS Cloud ERP.pdf` (7 pp.) | **Especificación técnica formal (PDF)** | Reglas de negocio (RFA-xx, CU-xx) |
| `Docs/Proyecto/ERP B2B SaaS Automotriz multi-tenant_1.pdf` (5 pp.) | **Documento de producto/visión (PDF)** — idéntico byte a byte a `IERP B2B SaaS Automotriz multi-tenant .pdf` | Reglas de negocio (RFA/CU) |
| `docs/Proyecto/08_Plan_Maestro_Conejo_de_Indias.md` | **Plan maestro de producto** (Markdown, aspiracional v3.0) | Agrupación objetivo de servicios (micromódulos + gateway) |
| `engram.json` → `domain_rules`, sprints, findings | **Memoria persistente del proyecto (JSON)** — constitución de negocio no funcional | Reglas, invariantes y estado de implementación |
| `docs/AUDITORIA_ARQUITECTURA_TRICAPA_2026-10-28.md` | **Auditoría técnica previa (Markdown)**, commiteada hoy | Hallazgos heredados (BD-x, FE-x, DC-x, FN-x) |
| `docs/Auditoria_Arquitectonica_Completa.md` (24-jul-2026) | **Auditoría con matriz de componentes** (Markdown) | Único diagrama de dependencias entre módulos |
| Código: `src/app.ts`, `src/modules/*`, `src/shared/*`, `web/src/*` | **Código fuente** | Verificación de implementación |
| **No disponibles:** Confluence (sin acceso), diagramas UML/C4/.drawio (confirmado: **no existen** en el repo), imágenes de diagramas (solo hay 1 PNG, es un brochure de marketing) | — | Marcado como no verificable donde aplica |

> **Nota metodológica sobre la premisa "microservicios":** el encargo asume una arquitectura de microservicios. **El sistema implementado es un monolito modular** (24 módulos registrados en un único proceso Fastify, `src/app.ts:325-556`, una sola BD compartida). La documentación canónica es **interna y contradictoria** sobre esto (DAS dice "microservicios", sus propios diagramas muestran una caja única; el Plan Maestro los declara *objetivo*). Este desajuste es en sí mismo el hallazgo central del Frente C, y condiciona cómo se leen los dos frentes restantes: no existen "contratos de comunicación entre servicios" ni "propiedad de datos por servicio" que verificar *entre procesos* — se verifican como límites lógicos entre módulos y como reglas de aislamiento de tenant sobre una BD física única.

---

## Frente A — Diagramas del sistema vs. documentación canónica

### A.1 Inventario (resultado del barrido exhaustivo)

- **Diagramas de sistema total: ~35 bloques ASCII** en Markdown. **0 archivos `.drawio`/`.puml`/`.mmd`**, **0 imágenes de diagrama** (el único PNG del repo es un brochure comercial), **0 bloques mermaid renderizables** (los 3 existentes son *ejemplos* dentro de la guía de Obsidian `06_Obsidian_Vault_Configuration_Guide.md:650,894,954`).
- El documento con más diagramas es el **DAS** (8: arquitectura, casos de uso, ERD, Docker Compose, red, 4 flujos de integración, kill-switch, IMAP worker).
- El único **diagrama de componentes** del repo es la matriz de imports de `docs/Auditoria_Arquitectonica_Completa.md:119-139`.
- **Ningún documento con diagramas lleva banner de caducidad**; los banners (Fase 0, S132-3) se pusieron en documentos *sin* diagramas. El DAS está declarado desactualizado por la auditoría tricapa (DC-5) pero **no lleva ninguna marca**.

### A.2 Hallazgos

| ID | Referencia canónica (tipo) | Evidencia (sistema / diagrama) | Desviación | Sev. | Recomendación → tarea |
|---|---|---|---|---|---|
| **A-1** | DAS §1.1 **:16** (doc. arquitectura): *"adopta una arquitectura **Cloud-Tethered de microservicios integrados**"* | El **mismo documento**, diagrama **:18-47**: una sola caja `ERP BACKEND (Fastify+TS)` + sidecars (PG, Redis, Twenty, Evolution). Código: `src/app.ts` registra **24 plugins en un proceso**. `Informes/auditoria-2026-08-14.md:30`: *"Microservicios: no existe (monolito)"* | **Contradicción interna del doc de arquitectura oficial**: la prosa afirma microservicios; su propio diagrama y el código muestran un monolito modular. El doc más autoritativo describe un estilo arquitectónico inexistente | **Alto** | Reescribir §1.1 como "monolito modular (24 módulos Fastify) + integraciones asíncronas"; añadir vista interna de módulos → **S132-16** |
| **A-2** | DAS **:54** *"Multi-tenant por schema… cada tenant tiene su propio schema"* y §3.1 **:174** | Realidad: **schema único + `tenant_slug`** (tricapa BD-1: ~100 tablas; `0019_rls_security.sql` con `app.current_tenant` slug). Contradicción **interna**: el propio ERD del DAS **:208+** muestra columna `tenant_slug`, y §7 :555 describe RLS sobre schema único (Arquitectura A). Restos Arquitectura B: `TENANT_SCHEMA_PREFIX` en compose, `tenants.schema_name` (tricapa BD-7) | El DAS describe **dos modelos de aislamiento simultáneamente** y el vigente es solo uno | **Alto** | Unificar el DAS a Arquitectura A y purgar restos B → **S132-16** (+ BD-7 de Fase 2) |
| **A-3** | DAS §3.2 **:206-250** *"Diagrama Entidad-Relación (Simplificado)"* (~15 tablas en §3.1) | Realidad: **121 declaraciones `pgTable(`** en schema TS + tablas solo-SQL (tricapa BD-8). `AutomotiveOS_Vault/…/MOC_Desarrollo_Core.md:23` enlaza `[[Diagrama_ERD_Completo]]` → **archivo inexistente** | **No existe ningún ERD completo del sistema**; el único ERD cubre ~12% del modelo de datos real | **Alto** | Generar ERD completo desde Drizzle (script → mermaid en `docs/`) → **S132-25** |
| **A-4** | DAS diagrama **:23-35**: `FRONTEND (SPA+Tailwind, Puerto 3000)`, `PostgreSQL (Neon/Supabase)` | Realidad: frontend **Next.js 16** en `web/` (SPA legacy solo como segundo front, tricapa FE-9), backend en **:4000** en dev (`next.config.mjs:12` declara default 3000 → colisión FE-5), deploy **on-premise Podman** (`docker-compose.onpremise.yml`, `last_deploy` en engram) | El diagrama de arquitectura general dibuja el stack de junio 2026 (SPA + cloud), no el actual | **Medio** | Actualizar diagrama → **S132-16** |
| **A-5** | DAS §4.1 **:283-301** (Docker Compose 5 servicios) y `06_Manual_Despliegue…md:75-134` ("Puente Híbrido On-Prem↔Supabase") | Realidad de despliegue: `scripts/deploy-to-pcserver.sh` (podman-compose + `drizzle-kit migrate`), `deploy-local-*.sh`, CI GitHub Actions con DB efímera (`ci.yml`). **Puente híbrido Supabase: no verificable** (sin acceso al servidor; existe directorio `supabase/`) | Dos diagramas de despliegue que no corresponden al flujo real de release; el puente híbrido no se puede confirmar vigente | **Medio** | Actualizar diagrama de despliegue; verificar y marcar o borrar el puente → **S132-16** |
| **A-6** | `docs/Auditoria_Arquitectonica_Completa.md:119-139` (matriz de componentes, jul-2026) — **el único diagrama de componentes** | Escaneo real: **25 aristas hoy**; la matriz de julio documenta ~10 y **omite ciclos enteros**: `backup↔enterprise`, `crm→thinkcar`, `scheduling→whatsapp`, `label-printing→{finance,inventory,workshop}`, `thinkcar→workshop(5)`, `intelligence→workshop`, `dvi→workshop`, `client-portal→workshop`, `migration→workshop`, `tenants→{config,finance}` | El único diagrama de componentes está **desactualizado y omite los ciclos** (los más relevantes para evolucionar la arquitectura) | **Medio** | Script de análisis de imports + matriz con fecha en CI → **S132-21** |
| **A-7** | Esperable según DAS §2 (casos de uso) y ERS §2.2 (flujos core) | **No existen** diagramas de secuencia del flujo core (auth multi-tenant, OT→factura→asiento, emisión SIFEN end-to-end); los únicos `sequenceDiagram` son del kill-switch y sólo como ejemplos no renderizados | **Hueco**: los flujos con mayor riesgo (fiscal, aislamiento) no tienen ni diagrama ni secuencia documentada | **Medio** | 2 diagramas mermaid: emisión SIFEN (CDC/contingencia) y auth/tenant → **S132-26** |
| **A-8** | Vault MOCs (`MOC_Desarrollo_Core.md:23`, `MOC_Seguridad.md:21`, `MOC_Seguridad_Hardware.md:27`) | Enlazan `[[Diagrama_ERD_Completo]]` y `[[Diagrama_Kill_Switch_Visual]]` → **no existen** | Enlaces a diagramas inexistentes en el "START HERE" del vault (extiende DC-2) | **Bajo** | Cerrar con decisión de vault → **S132-16** (+ ERD en S132-25) |
| **A-9** | Inventario de banners (S132-3, completado hoy) | Los 10 docs con banner carecen de diagramas; **el DAS —el doc con 8 diagramas— está stale (DC-5) y sin marca de vigencia** | Asimetría: se marcaron docs menores y no el documento de arquitectura central | **Medio** | Corregir DAS en vez de marcarlo → **S132-16** |

**Frente A — veredicto: alineación baja (~30%).** Documentación diagramática escasa (ASCII no versionable como artefacción) y los dos diagramas más autoritativos (arquitectura y ERD del DAS) contradicen el sistema en sus puntos centrales (estilo arquitectónico, modelo de tenant, stack, cobertura del modelo de datos).

---

## Frente B — Reglas de negocio documentadas vs. implementación

**Alcance de verificación:** se catalogaron **~70 reglas** de las 5 fuentes (IDs originales `RF-xxx`/`RNF-xxx` del ERS, `RFA-xx`/`CU-xx` de los PDFs, claves `domain_rules.*` de engram). **Se verificaron directamente en código 15 reglas/contradicciones** (citadas abajo); el resto queda en B.4 con estado **"evidencia secundaria (engram/tests)"** o **"no verificable"** — no se asume cumplimiento.

### B.1 Desviaciones y contradicciones (hallazgos)

| ID | Regla / referencia canónica (tipo) | Evidencia en el sistema | Desviación | Sev. | Recomendación → tarea |
|---|---|---|---|---|---|
| **B-1** | **Ciclo de vida de la OT** — ERS §2.2 **:85-88** + RF-WA-001: estado inicial `RECIBIDO`, luego `EN_PRESUPUESTO`→`EN_REPARACION`→`FINALIZADO(_RETIRADO)` (spec. requisitos) | `workshop/schema/ordenes-trabajo.ts:40-47`: enum real = `Presupuestado, Aprobado, En_Proceso, Control_Calidad, Listo, Finalizado_Retirado` (default `Presupuestado`, :74). **No existe `RECIBIDO`**; existen `Aprobado` y `Control_Calidad` que el ERS no documenta | **La máquina de estados de la fuente primaria no es la implementada**. Contradice también al PDF Especificación Técnica RFA-02 (que sí coincide ~con el código). Los estados gobiernan gatillos críticos (consumo de stock, plantillas WhatsApp, sync CRM) | **Alto** | Actualizar ERS §2.2/RF-WA-001 al enum real + documentar gatillos por estado → **S132-27** |
| **B-2** | **Aislamiento RLS** — ERS RNF-SEG-001 **:227**: *"RLS en PostgreSQL **y** filtrado a nivel de aplicación"* | `0019_rls_security.sql` fail-closed, **pero rol de app con BYPASSRLS** (lo admite `0019:27-29`, tricapa BD-3); tablas `tenant_id` uuid excluidas por llevar slug en `app.current_tenant` | Regla **solo mitad cumplida**: filtro de aplicación existe (+ auditor estático), defense-in-depth de BD **no opera** | **Alto** | S132-8 + S132-7 (ya planificados en Fase 1) |
| **B-3** | **Aislamiento del núcleo fiscal** — ERS RNF-SEG-001 + RF-FISC-001 (SIFEN/RG 90) | `fiscal_documentos`, `fiscal_documento_detalles`, `sifen_sync_log` **sin columna tenant**; identificación por `emisor_ruc` (`fiscal-docs.ts:85-87`, tricapa BD-2) | El módulo más regulatorio tiene **el aislamiento más débil**: sin columna no hay policy RLS posible; una query sin filtro RUC cruza tenants | **Crítico** | S132-6 (columna tenant + backfill + extensión de 0019) — ya planificado; **P1 absoluto** |
| **B-4** | **Asientos manuales prohibidos** — engram `domain_rules.auto_accounting` (JSON canónico): *"El usuario **nunca** crea asientos manualmente"*; ERS RF-FISC-002 **:145** | `POST /finance/contabilidad/asientos` **existe** y crea asientos manuales (`accounting.ts:252-315`; valida periodo abierto + audit). **Sin `preHandler` de rol** — mientras *anular* exige `requireManager` (:395) y cerrar período `requireAdmin` (:1011). `POST/PATCH` de cuentas (:155, :240) tampoco tienen guard. engram mismo registra *"asiento manual #15"* | (a) La regla "nunca manual" **está contradicha por la implementación y por la propia memoria**; (b) **asimetría de guard**: cualquier autenticado *crea* asientos y cuentas, pero no puede anularlos | **Medio** | `requireManager` en altas + reescribir la regla en engram/ERS → **S132-20** |
| **B-5** | **Plan de Cuentas "5 niveles"** — ERS RF-FISC-003 **:146** | Seeds: `nivel` ∈ {1,2,3,4} (**4 niveles**, 6 raíces); engram: *"4 hierarchical levels"*; schema admite `nivel` entero | **La implementación tiene 4 niveles; la fuente primaria exige 5** | **Medio** | Fijar canónico (recomendado: 4) y corregir ERS → **S132-24** |
| **B-6** | **Autenticación por headers** — ERS RNF-SEG-003 **:229**: auth vía `X-Tenant-Slug` + `X-User-Email` | `shared/middleware/rbac.ts:52,88-93`: `X-User-Email` es ***"DEPRECATED fallback (will be removed)"***; primario = JWT. (DAS §7 sí documenta JWT HMAC-SHA256 → el DAS está más al día que el ERS) | El ERS documenta un mecanismo **deprecado**; quien integre siguiendo el ERS usaría el fallback obsoleto | **Medio** | Actualizar ERS a JWT; retirar fallback tras verificar consumidores → **S132-19** |
| **B-7** | **i18n ES/Guaraní** — ERS RF-I18N-001..003 **:206-208** (2 idiomas con traducciones completas) | Infra montada: `NextIntlClientProvider`, `locale-switcher`, `proxy.ts`, `messages/{es,en,gu}.json`. **`grep useTranslations/getTranslations/formatMessage` en `web/src` = 0 ocurrencias** | **Cero traducciones aplicadas en UI** (peor que el "4 archivos" de la tricapa FE-8): regla documentada incumplida pese a tener toda la infraestructura | **Medio** | Campaña de i18n por área o degradación formal → **S132-28** |
| **B-8** | **Contingencia SIFEN** — ERS §2.3.3 RF-FISC-001/002/003 **:174-176** (Fase 2: modo contingencia, **matriz** de documentos, **sincronización automática** post-conexión) | (a) Modo contingencia: ✅ `finance/services/sifen/contingencia.service.ts` (`guardarEnContingencia`, `reenviarContingencia`, `getContingenciaStatus`, `limpiarContingenciaVieja`). (b) **Matriz de contingencia: sin evidencia** (0 símbolos "matriz"). (c) Sincronización: ⚠️ solo **reenvío manual** (`routes/sifen.ts:659`); `reenviarContingenciaGlobal` **sin cron/on-recovery caller** | (a) ✅ (la nota de engram "solo-SQL" está **obsoleta**); (b) **no verificable/no implementada**; (c) **parcial** | **Medio** | Cerrar matriz + auto-sync o degradar alcance en ERS → **S132-23** |
| **B-9** | **Umbral de comisiones (margen de contribución)** — ERS RF-COM-003 **:184** + engram `workshop_finance` | E2E T-62 (engram) verifica break-even contra `payroll_summary`; `flat-rate.service.ts` existe | ✅ probablemente implementada — **no re-ejecutado en esta auditoría** | Info | Evidencia secundaria aceptada (E2E en CI) |
| **B-10** | **Reglas implementadas sin documentación canónica** | Estados `Aprobado`/`Control_Calidad` (B-1); guard matrix `requireManager/Admin` por endpoint (engram T-21c, no en ERS); validaciones nuevas del catálogo (`cantidad>0`, `search ≥3`); escalafón MTESS 2026 con % comisión (engram `labor`); IVA 10% (engram) | **Capa de reglas viva solo en `engram.json`**: válida como memoria, invisible para un integrador que lea ERS/DAS | **Bajo** | Volcar `domain_rules` al ERS como anexo → **S132-27** |

### B.2 Reglas verificadas **conformes** (verificación directa en código)

| Regla (ref. canónica) | Evidencia |
|---|---|
| **RF-AGE-002** capacidad 5 bahías + horarios exactos (ERS **:133**) | `scheduling/types.ts:82-91`: `maxCapacity: 5`, Lun-Vie 07:30-17:30, Sáb 07:30-12:00, dom cerrado, `slotIntervalMinutes: 30` — **coincidencia exacta** |
| **CU-02 / consumo de stock al cierre de OT** (PDF Espec. Técnica) | `inventory/services/ot-stock-consumer.ts:60` + `workshop/services/orden.service.ts:523-525`: *"`consumeStockOnOTClose` propaga el error dentro de una transacción"* → **atómico** |
| **Reorden + orden de compra automática** (engram INV-002) | `inventory/jobs/reorder-check.cron.ts`: cron 6h (`REORDER_CHECK_INTERVAL_MS`) → `generateAutoPOs` |
| **Lockout HV obligatorio** (engram `safety_protocols.hev_bev_lockout`; PDFs RFA-05) | `POST /workshop/ordenes/:id/sign-lockout` (`workshop/routes/ordenes.ts:273-275`); el 422→firmar→200 está en E2E según engram (**422: evidencia secundaria**) |
| **Degradación graceful** (ERS RNF-DISP-003; DAS §5.5) | Colas Redis WA_OUT + workers (engram/DAS; **mecanismo exacto de envío contradictorio en el DAS §5.2 vs §5.5 — no resuelto**) |

### B.3 Contradicciones **entre fuentes canónicas** detectadas (sin resolver en la doc)

1. **Estados de la OT**: ERS (4 estados, `RECIBIDO`…) vs PDF Espec. Técnica (5 estados, `Control_Calidad`) vs código (6 estados, `Finalizado_Retirado`) — tres modelos; ver B-1 → S132-27.
2. **Modelo de aislamiento**: DAS `:54` schema-per-tenant vs ERS `:227`/DAS `:555` RLS sobre schema único (reconocido por el propio proyecto: gap DC-5) — ver A-2 → S132-16.
3. **Plan de cuentas**: 5 niveles (ERS) vs 4 reales (código/engram) — ver B-5 → S132-24.
4. **Asientos "nunca manuales"** (engram) vs asiento manual implementado y documentado en engram — ver B-4 → S132-20.
5. **Reintentos SIFEN**: DAS §5.6 fija 2 intentos vs `SIFEN_MAX_RETRIES` configurable (engram) — **default no documentado** (no verificable sin `.env` de prod).
6. **Síncrono vs asíncrono** en WhatsApp: DAS §5.2 ("HTTP síncrono") vs §5.5 (cola Redis); el cron de recordatorios llama `whatsapp.service` **directamente** (`scheduling/jobs/reminder.cron.ts:22-23`); **no verificable** si el envío final entra a WA_OUT → unificar en S132-16.
7. **Recordatorios "24h antes"** (ERS RF-AGE-003) vs **cron fijo 08:00** (DAS §5.4): interacción no resuelta documentalmente.
8. **Protocolo SIFEN**: "HTTPS/SOAP a DNIT" (PDF 1) vs "e-Kuatia" (PDF 2) — terminología no unificada.
9. **LLM local vs Gemini exclusivo** entre los dos PDFs (RFA-05).

### B.4 No verificable con el material disponible (explícito)

- **RNF-DISP-001** (99,5% disponibilidad WhatsApp) y **RNF-REN-002** (95% API <200ms): metas sin evidencia de medición en el material.
- **Expiración JWT 8h** (DAS §7): no re-verificada en código esta sesión.
- **Matriz de documentos en contingencia** (RF-FISC-002 del ERS): sin implementación localizable — tratada en B-8b como *no verificable/no implementada*.
- **OCR de placa (RFA-06 PDF)** y **archivos REI/IPS (RFA-10 PDF)**: sin confirmación en fuentes leídas.
- **Ejecución de E2Es**: los estados provenientes de engram (B-9, lockout 422, flat-rate) son evidencia secundaria; esta auditoría **no ejecutó la suite backend/E2E**.
- **Recursos Confluence**: no hay ninguno disponible en el material; **diagramas UML/C4/drawio: confirmadamente inexistentes**.

**Frente B — veredicto: alineación media-alta en el núcleo operativo (~75%).** Agenda, stock, transaccionalidad, roles y lockout HV: verificados conformes y con tests. Desviaciones **documentales concentradas** (estados OT, plan de cuentas, auth headers, "asientos nunca manuales") y **dos fallas reales de integridad** heredadas de la tricapa que son el P1 (B-3 crítica, B-2 alta).

---

## Frente C — Agrupaciones de funcionalidades vs. diseño documentado

### C.1 Hallazgos

| ID | Diseño documentado (ref. tipo) | Evidencia en el sistema | Desviación | Sev. | Recomendación → tarea |
|---|---|---|---|---|---|
| **C-1** | **DAS :16** "microservicios integrados" y **Plan Maestro :45** fila `MICROSERVICES (Fastify+TypeScript)` bajo `API GATEWAY (Kong/Traefik)` + :168 *"Backend — Microservices Ready"* | **24 módulos en un único proceso Fastify** (`app.ts:325-556`), sin gateway, **una sola BD compartida** (121 `pgTable`), comunicación in-process: **25 aristas de import** entre módulos; sin contratos HTTP inter-servicio | La agrupación documentada (microservicios con gateway) **no corresponde a la implementación**; el DAS no aclara que es aspiracional → los **ciclos actuales harían imposible** cualquier separación posterior (ver C-2) | **Alto** | Formalizar "monolito modular con límites de módulo" en DAS + Plan Maestro (o hoja de ruta explícita si microservicios es meta) → **S132-16** |
| **C-2** | Matriz de componentes de julio (`Auditoria_Arquitectonica_Completa:119-139`): flujo WORKSHOP→INVENTORY/FINANCE, FINANCE→WORKSHOP/INVENTORY | Escaneo real: **ciclos bidireccionales**: **`workshop↔finance`** (11 y 6), **`inventory↔finance`** (13 y 5), **`backup↔enterprise`** (1 y 1). Ejemplos: `finance/routes/budget.routes.ts:36` importa `convertPresupuestoToOT` (**finanzas ejecuta lógica del agregado OT**); `workshop/services/analytics.service.ts:18-22` lee `asientosDetalle/movimientosTes` **directo** (sin API intermedia) | **Acoplamiento indebido entre límites**: dependencias circulares entre dominios; lecturas directas de tablas cruzadas sin contrato. La matriz canónica **omita los ciclos** y está desactualizada | **Alto** | Política de dependencias en dirección única + romper ciclos + matriz regenerable en CI → **S132-21** |
| **C-3** | Propiedad por dominio: Plan Maestro :171-190 (workshop=core, finance=SIFEN+Accounting) y ERS §2.2 (Presupuestación es función del taller) | (a) **`presupuestos` (budget.ts) vive en `finance/schema`** y la conversión a OT también; (b) **`mechanicProfiles` en `finance/schema`** pero rutas en **`workshop/routes/mechanic-profiles.routes.ts`**; (c) **tres superficies de portal**: módulo `client-portal` (`/portal/*`, PIN), `workshop/client-portal.routes.ts` (`/portal/client/:id/summary`), frontend `web/src/app/portal`; (d) **dominio Thinkcar partido**: ingesta en `thinkcar`, **parsing DTC en `intelligence`**, con `crm→thinkcar` además | **Funcionalidades mal ubicadas / responsabilidades duplicadas**: frontera finance/workshop difusa (presupuestos, perfiles de mecánico); portal y diagnóstico con **dueños ambiguos** | **Medio** | Tabla canónica tabla→módulo + consolidación → **S132-22** |
| **C-4** | Conteos en docs: **Plan Maestro: 14 módulos** (junio); **README: 17** (omite api-keys, billing, email, enterprise, migration, mobile, thinkcar); **tricapa: 26** | **Realidad: 24** en `src/modules/` = 24 registrados en `app.ts` | **Cuatro cifras distintas** de "cuántos servicios tiene el sistema" entre las cuatro fuentes que lo afirman | **Bajo** | Lista de módulos generada desde código → **S132-16** |
| **C-5** | Contratos de comunicación (bajo premisa microservicios): doc solo define contratos **externos** (CRM GraphQL, webhook WA, SOAP DNIT) y **FE↔BE** | FE↔BE: **sano y blindado** (tricapa: 521 rutas / 501 call-sites / 0 rotos, test `fe-be-contract.test.ts` + guard T-63). Contratos internos: **no existen** (imports in-process). Propiedad de datos: **sin fronteras físicas**; único mecanismo = filtro de tenant con los huecos B-2/B-3 | El frente "contratos" documentado vs real **solo aplica al FE↔BE, que está bien**; la propiedad de datos por servicio **no existe como tal** y donde la doc promete aislamiento (RLS) no opera | **Medio** | Documentar contrato interno = exports públicos del módulo + reglas de propiedad → **S132-22** |
| **C-6** | Lógica que cruza límites | (a) **Accounting bus** (workshop/inv→finance): **SÍ documentado** (engram `auto_accounting` + INV-006/007) ✅; (b) `scheduling`→`whatsapp.service` directo: comportamiento documentado (DAS §5.4) pero **mecanismo** difiere del diagrama de cola WA_OUT (DAS §5.5); (c) `crm-sync.worker.ts:27` importa schema `thinkcar` — **no documentado**; (d) `workshop/analytics` lee tablas de finance — **no documentado** | Los cruces están previstos y documentados en su mayoría; **3 cruces concretos no lo están** | **Bajo** | Documentar (c)/(d) en S132-21/22; unificar síncrono/cola WA en S132-16 |

**Frente C — veredicto: alineación media (~60%).** Internamente el código es coherente y con convención clara (plugin→routes→services→schema), pero **la agrupación documentada (microservicios/gateway) no existe**, los **ciclos workshop↔finance↔inventory** son deuda estructural real, y hay **3-4 responsabilidades con dueño ambiguo** (presupuestos, perfiles de mecánico, portal, thinkcar). Contrato FE↔BE: **sano**.

---

## Resumen ejecutivo — nivel de alineación general

| Frente | Nivel de alineación | Síntesis |
|---|---|---|
| **A. Diagramas** | **Baja (~30%)** | Escasos (ASCII, sin UML/C4/drawio); arquitectura y ERD del DAS contradicen el sistema (estilo, tenant, stack, 15 tablas dibujadas vs 121+ reales). Sin ERD completo ni secuencia del flujo fiscal. |
| **B. Reglas de negocio** | **Media-alta (~75%)** | Núcleo operativo verificado **cumple**. Desviaciones: 1 contradicción grave de modelo (estados OT), 4 desviaciones documentales (PUC, asientos manuales, auth headers, i18n), 1 regla parcial (contingencia), + 2 fallas críticas/alto de aislamiento heredadas (B-3/B-2, ya en Sprint 132). |
| **C. Agrupaciones** | **Media (~60%)** | Agrupación de facto coherente; documentación promete microservicios/gateway inexistentes; matriz de componentes omite ciclos reales; 3-4 funcionalidades con propiedad ambigua. Contrato FE↔BE sano. |

**Alineación general: MEDIA (~60-65%).** El patrón dominante no es código defectuoso sino **documentación desactualizada tras decisiones reales ya tomadas** (cloud→on-premise, schema-per-tenant→RLS con slug, microservicios→monolito modular, estados ERS→enum real), **más dos fallos reales de integridad de tenant** que son el único riesgo crítico activo.

### Acciones prioritarias (mapeadas a `engram.json → sprint_132_plan`)

1. **[Crítico] Aislamiento fiscal** — **S132-6** + **S132-8** (columna tenant, rol sin BYPASSRLS). *Cubre B-3/B-2.*
2. **[Alto] Estilo arquitectónico canónico** — ampliar **S132-16**: DAS §1.1 "monolito modular (24 módulos)", diagrama de stack/puertos/despliegue, matriz de módulos única, decisión de vault + enlaces de diagramas rotos. *Cubre A-1/A-2/A-4/A-5/A-8/A-9/C-1/C-4/C-6b.*
3. **[Alto] Unificar máquina de estados de la OT** — **S132-27**: ERS §2.2/RF-WA-001 ↔ enum real + gatillos por estado + anexo de `domain_rules` al ERS. *Cubre B-1/B-10.*
4. **[Alto] Política de dependencias entre módulos** — **S132-21**: romper ciclos `workshop↔finance`, `inventory↔finance`, `backup↔enterprise`; matriz de componentes regenerable en CI. *Cubre C-2/A-6/C-6d.*
5. **[Medio] Paquete de reglas** — **S132-20** (requireManager en altas de asientos/cuentas + regla "nunca manual" reescrita), **S132-24** (PUC: fijar niveles canónicos), **S132-19** (auth JWT en ERS + retiro del fallback `X-User-Email`), **S132-23** (contingencia: matriz + auto-sync o degradación formal).
6. **[Medio] Propiedad de datos** — **S132-22**: tabla canónica tabla→módulo; consolidar presupuestos/perfiles/portal/thinkcar; contrato interno documentado. *Cubre C-3/C-5/C-6c.*
7. **[Bajo] Diagramas y superficie** — **S132-25** (ERD completo generado), **S132-26** (secuencias core: SIFEN + auth), **S132-28** (i18n aplicado o degradado formalmente).

---

*Informe elaborado por auditoría estática (2 exploraciones paralelas de documentación + verificación directa en código @ `95b6e76`). No se ejecutó la suite backend/E2E; los ítems marcados "no verificable" se dejan explícitos y ningún cumplimiento se asume desde documentación sin confirmación de código o test. Registro de trazabilidad: `engram.json → state.audit_canonica_3frentes_20261028`.*
