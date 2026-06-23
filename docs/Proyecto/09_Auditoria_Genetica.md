# 🔬 ÁRBOL DE TRAZABILIDAD Y ADN DEL PROYECTO
## AutomotiveOS Cloud ERP — Auditoría Genética de Software

**Fecha:** 19 de junio de 2026
**Sprint Actual:** 61 COMPLETED (Chaos Audit + Critical Security Patches)
**Siguiente:** Sprint 62 — Conejo de Indias (Design System + Dashboard React/Next.js)
**Clasificación:** Documento de Referencia Permanente — Futuros Proyectos

---

## BLOQUE 1: EL GÉNESIS COGNITIVO (FASE 0 Y FASE 1)

### 1.1 Anclaje de Memoria (Engram)

El `engram.json` (2,700+ líneas) es el **cerebro persistente** del proyecto. No es un simple archivo de configuración — es un **grafo de decisiones arquitectónicas** que sobrevive entre sesiones:

```
engram.json
├── hardware_constraints    → RAM <50MB, Cloud-Tethered, PostgreSQL remoto
├── domain_rules            → SIFEN V150, RG 90, Ley 1034/83, MTESS 2026
│   ├── fiscal              → DNIT SIFEN V150, Marangatu
│   ├── automotive          → EV/HEV HV Safety, Launch/Thinkcar DTC
│   ├── labor               → Escalafón MTESS (Ayudante→Certificado)
│   └── auto_accounting     → Toda transacción genera asiento automático
├── state
│   ├── current_sprint      → "Sprint 61 COMPLETED"
│   ├── next_sprint         → "Sprint 62 — Conejo de Indias"
│   ├── conejo_de_indias    → Plan 19 sprints, $66K, 7 meses
│   ├── chaos_audit         → 12 risks, 4 critical patches (C-01 a C-04 FIXED)
│   └── sprint_18..61       → Historial completo de decisiones por sprint
```

**Mecanismo de persistencia:** Cada sprint actualiza `state.current_sprint`. El orchestrador lee `engram.json` al inicio de cada sesión para recuperar contexto exacto. Esto elimina la "amnesia entre sesiones" — el problema #1 en proyectos de IA.

### 1.2 Los Ojos y Manos del Agente (Servidores MCP)

El ecosistema OpenCode opera con **4 agentes especializados** definidos en `.opencode/agents/`:

| Agente | Rol | Permisos | Cuándo Delegar |
|--------|-----|----------|----------------|
| `@explorer` | Búsqueda paralela en codebase | Solo lectura | Descubrir qué existe antes de planificar |
| `@librarian` | Docs de librerías y APIs externas | Búsqueda web/MCP | APIs con cambios frecuentes (React, Next.js, AI SDKs) |
| `@oracle` | Asesor estratégico, code review | Solo lectura | Decisiones arquitectónicas de alto riesgo, debugging persistente |
| `@fixer` | Ejecución rápida de implementación | Lectura/escritura | Tareas acotadas, tests, cambios multi-archivo |

**Regla anti-espagueti:** Ningún agente escribe código sin que el orquestador valide el plan. El flujo es:
```
Orquestador → @explorer (descubre) → @oracle (decide) → @fixer (ejecuta) → @oracle (revisa)
```

### 1.3 El Segundo Cerebro (Obsidian MOC)

La barra lateral decimal del vault `AutomotiveOS_Vault/` organiza el conocimiento en **8 sub-MOCs**:

```
000_Meta/          → Map of Content central, Kanban de sprints
100_Arquitectura/  → DAS, stack, decisiones ADR
200_Modulos/       → Workshop, Finance, Inventory, Thinkcar, WhatsApp, CRM
300_Fiscal/        → SIFEN V150, RG 90, Ley 1034/83
400_Seguridad/     → Chaos Audit, RLS, Kill-Switch, CSRF
500_Infraestructura/ → Docker, CI/CD, Supabase, Redis
600_QA/            → 1,409 tests, 64 archivos, estrategia 6 capas
```

**Sincronización con código:** Cada sprint actualiza tanto `engram.json` como el vault Obsidian. El MOC central tiene Dataview queries que listan sprints por estado.

### 1.4 Modelo de Sub-Agentes de OpenCode

El orquestador se auto-orquesta usando `subtask` y `task`:

```
┌─────────────────────────────────────────────────────┐
│                  ORCHESTRATOR (yo)                   │
│  Lee engram.json → decide → delega → verifica       │
├─────────────┬─────────────┬─────────────┬───────────┤
│  @explorer  │  @oracle    │  @fixer     │ @librarian│
│  (búsqueda) │  (estrategia)│ (código)   │ (docs)    │
│  2x rápido  │  5x mejor   │ 2x rápido  │ 10x mejor │
│  0.5x costo │  0.8x vel   │ 0.5x costo │ 0.5x costo│
└─────────────┴─────────────┴─────────────┴───────────┘
```

**Paralelización:** Tareas independientes se lanzan en `parallel` (ej: @explorer + @librarian investigando en paralelo). Tareas dependientes van en secuencia.

---

## BLOQUE 2: EL COLCHÓN Y LA ESTRUCTURA DE DATOS (FASE 2)

### 2.1 Inmutabilidad de la Base de Datos

**Protocolo estricto de migraciones:**
- 24 migraciones Drizzle (`0000` a `0023`) en `src/shared/database/migrations/`
- 1 migración consolidada Supabase: `supabase/migrations/20260619000000_init_schema.sql` (30KB, 30+ tablas)
- **Regla de oro:** Nunca modificar una migración existente. Solo crear nueva.
- **Herramienta:** `supabase db diff` → genera SQL diff → `supabase push` aplica

**Tablas protegidas por RLS (35+):**
```sql
-- Todas estas tablas tienen RLS habilitado:
clients, vehiculos, ordenes_trabajo, ingresos, trabajos_terceros,
orden_servicios, orden_repuestos, servicios_catalogo, notificaciones,
facturas, fiscal_documentos, plan_cuentas, asientos_contables,
audit_log, repuestos, herramientas, stock_movements, ...
-- EXCEPCIÓN: tenants (registry público para login flow)
```

### 2.2 El Colchón de Alta Concurrencia (Supavisor)

**Configuración Supavisor:**
```
Transaction mode (port 6543) con ?pgbouncer=true
Pool: ≤5 conexiones lazy (db() como función singleton)
```

**Por qué Transaction mode:** En Supabase Serverless, cada conexión es un proceso PostgreSQL pesado. Supavisor Transaction mode permite que múltiples requests compartan conexiones, reduciendo RAM de 50MB a <10MB para la capa de BD.

### 2.3 Capa de Caché de Alta Velocidad (Redis)

**Estrategia de caché en `docker-compose.yml`:**
```yaml
redis:
  image: redis:7-alpine
  deploy:
    resources:
      limits:
        memory: 128M  # LRU eviction
```

**Patrón de caché implementado:**
- `repuestos` → TTL 5min (catálogo de repuestos)
- `labor_rates` → TTL 10min (tarifas de mano de obra)
- `sessions` → TTL 8h (sesiones de usuario)
- **Invalidación:** Automática en mutaciones (POST/PUT/DELETE invalidan path padre)

### 2.4 La Arquitectura del Puente Híbrido

```
┌─────────────────────────────────────────────────────────┐
│                 PUENTE HÍBRIDO                          │
├─────────────────────┬───────────────────────────────────┤
│   LOCAL (On-Prem)   │        SUPABASE CLOUD            │
├─────────────────────┼───────────────────────────────────┤
│  PostgreSQL Docker  │◄──── Supavisor Transaction ──────►│
│  (dev/test)         │       (producción)                │
│                     │                                   │
│  Redis 128MB        │──── Sync Worker cada 5min ───────►│
│  (cache local)      │       (replicación asíncrona)     │
│                     │                                   │
│  Evolution API      │◄──── WhatsApp Gateway ───────────►│
│  (QR pairing)       │       (webhooks)                  │
│                     │                                   │
│  Twenty CRM         │◄──── GraphQL ────────────────────►│
│  (contacts)         │       (sync bidireccional)        │
└─────────────────────┴───────────────────────────────────┘
```

**Flujo de sincronización:**
1. Operación offline → cola en `localStorage`
2. Reconexión → `POST /api/sync/batch` envía batch
3. Server procesa en orden secuencial (integridad referencial)
4. Respuesta con resultados por operación

---

## BLOQUE 3: LÓGICA DE NEGOCIO, INTEGRACIONES Y HARDWARE (FASE 3 Y 4)

### 3.1 El Vector CRM-ERP

```
LANDING PAGE → Lead Capture → Twenty CRM (Kanban) → Check-in → OT en ERP
     │              │                │                  │           │
     ▼              ▼                ▼                  ▼           ▼
  Marketing    POST /lead      GraphQL UPSERT     POST /check-in   ordenes_trabajo
  Module       (público)       (contacto)         (turno → OT)    (con vehicleId)
```

**Módulos involucrados (19 plugins registrados en app.ts):**
1. `marketing` → Landing page, lead capture, Google Reviews
2. `crm` → Twenty CRM sync (GraphQL), UPSERT en FINALIZADO_RETIRADO
3. `scheduling` → Capacidad, recordatorios WhatsApp, check-in → OT
4. `workshop` → Core de OTs, vehículos, ingresos
5. `finance` → Facturación SIFEN, contabilidad
6. `whatsapp` → Evolution API, templates por estado de OT
7. `inventory` → Repuestos, herramientas, stock
8. `intelligence` → DTC parsing, OCR, HV safety
9. `thinkcar` → Ingesta USB/BT/Email, PDF parser, smart linker
10. `dvi` → Inspección visual digital, photos, markup
11. `analytics` → KPIs, tendencias, CSV export
12. `fleet` → Gestión B2B de flotas
13. `label-printing` → ESC/POS, ZPL, TSPL
14. `backup` → pg_dump, AES-256, cron
15. `client-portal` → Vista pública para clientes
16. `security-hw` → USB Kill-Switch, hardware fingerprinting
17. `config` → Configuración del taller, logo
18. `tenants` → Clasificación MIC, IRE, libros obligatorios
19. `migration` → Export/Import config entre tenants

### 3.2 IoT y Diagnóstico Automotriz

**Triple canal de ingesta Thinkcar:**
```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  USB/MTP     │    │  Bluetooth   │    │  Email IMAP  │
│  (File pick) │    │  RFCOMM      │    │  (polling    │
│              │    │  (3 retries) │    │   5min)      │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────┬───────┘───────────────────┘
                   ▼
        ┌──────────────────┐
        │  SHA-256 Dedup   │  ← Evita duplicados
        │  (hash del PDF)  │
        └────────┬─────────┘
                 ▼
        ┌──────────────────┐
        │  PDF Parser      │  ← regex para VIN, DTCs, placa
        │  (pdf-parse)     │
        └────────┬─────────┘
                 ▼
        ┌──────────────────┐
        │  Smart Linker    │  ← VIN fuzzy matching → Vehicle → OT → Client
        └────────┬─────────┘
                 ▼
        ┌──────────────────┐
        │  Canvas DVI      │  ← HTML5 Canvas para inspección visual
        │  (markup tools)  │
        └──────────────────┘
```

### 3.3 El Core Fiscal y Financiero

**Motor de facturación híbrida:**
```
POST /finance/invoices/issue
├── MANUAL:      numeroFacturaManual (001-001-0001234), sifen_cdc=NULL
│                sifen_status=MANUAL_CONVERT_QUEUE
└── ELECTRONICA: SifenCryptoService.signInvoiceAsync()
                 cdc extraído del XML firmado (44 dígitos)
```

**Flujo SIFEN:**
1. Worker thread `sifen-crypto.worker.ts` firma SHA-256 + RSA en hilo aislado
2. Service `signXMLInWorker` spawn → sign → terminate (0 hilos persistentes)
3. XML firmado → envío SOAP a DNIT → CDC recibido → actualiza `facturas`
4. **Fallback:** Si DNIT offline → factura queda en `MANUAL_CONVERT_QUEUE`
5. **Conversión retroactiva:** Batch que convierte MANuales a DTE cuando DNIT vuelve

**Co-Pago / Split Billing:**
```
Factura Total: ₲2,500,000
├── Aseguradora (60%): ₲1,500,000 → CxC Aseguradora
└── Particular (40%):  ₲1,000,000 → CxC Cliente
```

### 3.4 Seguridad Perimetral Física (Kill-Switch)

**Middleware USB en `src/modules/security-hw/`:**
```
Request → hardware-lock.middleware.ts
  ├── EXEMPT_PATHS: ['/health', '/docs', '/auth', '/api/v1/lead']
  ├── Hardware fingerprint (SHA-256 de CPU + MB + BIOS)
  ├── crypto.timingSafeEqual() ← previene timing attacks
  ├── Cache 5s (evita USB reads excesivos)
  └── FAIL-SECURE: Si USB absent → 403 + log + alert
```

**Estado Fail-Secure:**
- USB presente → operación normal
- USB extraído → bloqueo inmediato (no hay "modo degradado")
- Re-inserción → re-autenticación requerida

---

## BLOQUE 4: DESPLIEGUE, CAPACITACIÓN Y MANTENIMIENTO INMUNE (FASE 5 EN ADELANTE)

### 4.1 El Enfoque "Ver y Hacer" (PPTs)

**Metodología pedagógica en `docs/Proyecto/07_Curso_Capacitacion_ERP_CRM_Automotriz.md`:**
- 12 módulos de capacitación
- Cada módulo: diapositivas con instrucciones explícitas
- Formato: "Recorte de pantalla + botón exacto + resultado esperado"
- **Por qué:** Operadores de taller no son técnicos — necesitan instrucciones visuales paso a paso

### 4.2 El Protocolo de Purga Quirúrgica SQL

**Script controlado de truncamiento para post-capacitación:**
```sql
-- ELIMINAR (datos transaccionales de práctica):
TRUNCATE TABLE ordenes_trabajo CASCADE;
TRUNCATE TABLE facturas CASCADE;
TRUNCATE TABLE asientos_contables CASCADE;
TRUNCATE TABLE stock_movements CASCADE;
TRUNCATE TABLE audit_log CASCADE;

-- CONSERVAR (datos maestros para Go-Live):
-- ✅ clients (50 clientes reales)
-- ✅ vehiculos (20 vehículos reales)
-- ✅ repuestos (80+ parts con pricing real)
-- ✅ herramientas (45+ tools)
-- ✅ servicios_catalogo (59+ services)
-- ✅ plan_cuentas (PUC completo)
-- ✅ profiles (usuarios y mecánicos)
-- ✅ tenants (config del taller)
```

### 4.3 El Patrón "Expandir y Contraer" (Expand and Contract)

**Procedimiento para actualizar código en producción:**
```
FASE 1 — EXPANDIR (sin romper):
  1. Crear nuevas tablas/columnas (migración SQL)
  2. Deploy nuevo código que ESCRIBE en ambas (old + new)
  3. Migrar datos existentes (backfill script)
  4. Verificar integridad (tests + monitoreo)

FASE 2 — CONTRAER (limpieza):
  5. Deploy código que SOLO lee de nuevas tablas
  6. Verificar que nada rompe (feature flag)
  7. Eliminar tablas/columnas obsoletas (migración final)
  8. Actualizar docs y engram.json
```

**Ejemplo real:** Migración de `fiscalDocumentos` → `facturas` (Sprint 20):
- Expand: Crear `facturas` + `factura_detalles`, código escribe en ambas
- Contract: Código solo lee de `facturas`, `fiscalDocumentos` queda como archive

---

## RESUMEN TÉCNICO DEL ESTADO ACTUAL

### Métricas del Proyecto

| Métrica | Valor |
|---------|-------|
| Sprints completados | 61 |
| Tests totales | 1,409 |
| Archivos de test | 64 |
| Errores TypeScript | 0 |
| Módulos backend | 19 plugins |
| Tablas DB (RLS) | 35+ |
| Migraciones Drizzle | 24 |
| Frontend modules (vanilla JS) | 45+ |
| RAM target | <50MB |
| Clientes seed | 50 |
| Repuestos seed | 80+ |
| Herramientas seed | 45+ |
| Servicios seed | 59+ |
| Vehículos seed | 20 |
| OTs seed | 23 |

### Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 26, TypeScript 5.x, ESM (`"type": "module"`) |
| Framework | Fastify 5.x |
| ORM | Drizzle ORM + `postgres` (lazy singleton, pool ≤5) |
| DB | PostgreSQL remoto (Neon/Supabase) via Supavisor Transaction |
| Cache | Redis 7 Alpine (128MB LRU) |
| Test | Vitest 4.x, `pool: "forks"` |
| Crypto | `node:crypto`, `worker_threads`, `tsx` loader |
| Ingesta | `imapflow` 1.3.7, `pdf-parse` 1.1.1 |
| Notificaciones | `nodemailer` |
| Fiscal | SIFEN V150, XAdES-EPES, CDC de 44 dígitos |
| CRM | Twenty CRM (GraphQL) |
| WhatsApp | Evolution API v2.2.3 |
| Frontend actual | Vanilla JavaScript (45+ módulos) |
| Frontend futuro | Next.js 14 + React 18 + shadcn/ui |

### Seguridad

| Capa | Implementación |
|------|---------------|
| RLS | PostgreSQL Row Level Security en 35+ tablas |
| CSRF | Double-submit cookie pattern (stateless) |
| Rate Limiting | 200 req/min por IP |
| Security Headers | OWASP-compliant (CSP, HSTS, X-Frame, etc.) |
| Hardware Kill-Switch | USB dongle + `crypto.timingSafeEqual` + 5s cache |
| RBAC | 4 roles: user(0) < mechanic(1) < manager(2) < admin(3) |
| EXIF Stripping | JPEG, PNG, WEBP, HEIC, GIF, TIFF, AVIF |
| Backup Encryption | AES-256-GCM, PBKDF2 100K iterations |

### Chaos Audit (Sprint 61)

| ID | Hallazgo | Estado |
|----|----------|--------|
| C-01 | RLS bypass por SET LOCAL fallido | ✅ FIXED (fail-closed) |
| C-02 | Race condition stock TOCTOU | ✅ FIXED (atomic UPDATE WHERE) |
| C-03 | SIFEN timezone UTC vs Paraguay | ✅ FIXED (Intl.DateTimeFormat) |
| C-04 | Timing attack USB token | ✅ FIXED (timingSafeEqual) |
| C-05 | Sin CHECK constraints en DB | ⏳ OPEN |
| C-06 | Split-brain sync híbrido | ⏳ OPEN |
| C-07 | Cache stampede Redis | ⏳ OPEN |
| C-08 | Canvas DVI sin auto-save | ⏳ OPEN |
| C-09 | Bluetooth listeners zombi | ⏳ OPEN |
| C-10 | Idempotencia CRM por día | ⏳ OPEN |
| C-11 | WhatsApp queue sin timeout | ⏳ OPEN |
| C-12 | RLS bypass en vistas LEFT JOIN | ⏳ OPEN |

---

## PRIMER ARTEFACTO A EJECUTAR

El siguiente artefacto de software que debemos materializar es:

### **Sprint 62 — Design System + Dashboard Layout (React/Next.js)**

**Justificación:** El plan "Conejo de Indias" (`docs/Proyecto/08_Plan_Maestro_Conejo_de_Indias.md`) define que el Sprint 62 inicia la **reescriitura completa del frontend** de vanilla JS (45+ módulos) a React/Next.js con shadcn/ui. Este es el cuello de botella #1 — el backend es sólido pero el frontend no es escalable ni atractivo.

**Artefactos a crear:**
1. `frontend/` — Proyecto Next.js 14 con App Router
2. `frontend/src/app/layout.tsx` — Layout con sidebar + nav
3. `frontend/src/app/(auth)/login/page.tsx` — Login con Clerk
4. `frontend/src/app/(dashboard)/page.tsx` — Dashboard KPIs
5. `frontend/tailwind.config.ts` — Design system tokens
6. `frontend/package.json` — Dependencias (React 18, shadcn/ui, React Query)

---

## CONTEXTO PARA FUTUROS PROYECTOS

Este documento serve como **template de arquitectura** para proyectos similares:

1. **Siempre crear `engram.json`** como memoria persistente desde el Sprint 1
2. **Separar backend (Fastify+TS) de frontend (React/Next)** desde el inicio
3. **Usar migraciones inmutables** — nunca modificar una existente
4. **RLS en PostgreSQL** como primera línea de defensa multi-tenant
5. **Worker threads** para operaciones pesadas (crypto, parsing) — protege RAM
6. **Chaos Audit** periódico para encontrar vulnerabilidades antes de producción
7. **Seed data realista** desde el inicio — facilita demos y validación
8. **Documentar decisiones arquitectónicas** en engram.json + Obsidian vault
9. **Patrón Expand/Contract** para migraciones en producción sin downtime
10. **Fail-Secure** en seguridad — nunca "modo degradado" para hardware
