# 🐇 CONEJO DE INDIAS — Plan Maestro para Escalar a 100% SaaS

**AutomotiveOS Cloud ERP v2.0 → v3.0 Platform**

| Campo | Detalle |
|:---|:---|
| **Proyecto** | AutomotiveOS SaaS Platform |
| **Objetivo** | De ERP funcional → SaaS escalable para múltiples clientes |
| **Enfoque** | Primera desplegue (conejo de indias) → Iteración → v2.0 |
| **Fecha** | 19 de junio de 2026 |
| **Autor** | Arquitecto de Software / Ingeniero Principal |

---

## 1. VISIÓN DEL PROYECTO

### 1.1 De Dónde Venimos

El ERP actual (v2.0) tiene:
- ✅ Backend robusto: Fastify + TypeScript, 1,409 tests
- ✅ Cumplimiento fiscal: SIFEN V150, RG 90 Marangatu
- ✅ Integraciones: WhatsApp, Twenty CRM, Thinkcar OBD2
- ✅ Seguridad: Kill-Switch USB, RLS multi-tenant, Chaos Audit
- ❌ Frontend: Vanilla JavaScript (45+ módulos, DOM manual)
- ❌ Mobile: Solo PWA offline-first
- ❌ SaaS: Sin billing, suscripción, ni tenant management
- ❌ API pública: Sin docs, SDK, ni developer portal

### 1.2 A Dónde Vamos

**v3.0 Platform** — SaaS completo para talleres automotrices de Paraguay y Latinoamérica:

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTOMOTIVEOS PLATFORM                     │
├─────────────┬─────────────┬─────────────┬─────────────────┤
│  Frontend   │   Mobile    │  API/SDK    │  Admin Panel    │
│  React/Next │ React Native│  REST/GraphQL│  Tenant Mgmt   │
├─────────────┴─────────────┴─────────────┴─────────────────┤
│                    API GATEWAY (Kong/Traefik)                │
├─────────────┬─────────────┬─────────────┬─────────────────┤
│  Auth/SSO   │  Billing    │  Analytics  │  Notifications  │
│  Clerk/Auth │  Stripe     │  Metabase   │  SendGrid/Firebase│
├─────────────┴─────────────┴─────────────┴─────────────────┤
│              MICROSERVICES (Fastify + TypeScript)            │
├─────────────┬─────────────┬─────────────┬─────────────────┤
│  Workshop   │  Finance    │  CRM        │  Inventory      │
│  (ERP core) │  (SIFEN)    │  (Twenty)   │  (Stock)        │
├─────────────┴─────────────┴─────────────┴─────────────────┤
│           PostgreSQL (Supabase) + Redis + S3                │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Métricas de Éxito del Conejo de Indias

| Métrica | Target |
|:---|:---|
| **Primer cliente real** | Operando en 3 meses |
| **Tiempo de onboarding** | < 1 día (self-service) |
| **Uptime** | 99.5% (sin dedo) |
| **Latencia API** | < 200ms p95 |
| **Costo por tenant** | < $50/mes infra |
| **Revenue por tenant** | $150-300/mes |

---

## 2. ARQUITECTURA TÉCNICA v3.0

### 2.1 Frontend — React/Next.js (REESCRITURA COMPLETA)

**Por qué:** El frontend actual es vanilla JS con 45+ módulos manuales. No es escalable, no es mantenible, no atrae talento.

**Stack:**
```
Next.js 14+ (App Router)
├── React 18+
├── TypeScript 5+
├── Tailwind CSS 4+ (design system)
├── shadcn/ui (componentes base)
├── React Query (data fetching + cache)
├── Zustand (state management)
├── React Hook Form + Zod (forms)
├── Recharts (gráficos)
└── PWA via next-pwa
```

**Estructura de módulos:**
```
src/app/
├── (auth)/
│   ├── login/
│   ├── register/
│   └── forgot-password/
├── (dashboard)/
│   ├── layout.tsx          ← Sidebar + nav
│   ├── page.tsx            ← KPIs dashboard
│   ├── workshop/
│   │   ├── ordenes/        ← OT list + Kanban
│   │   ├── clientes/       ← CRM clients
│   │   ├── vehiculos/      ← Vehicle registry
│   │   └── dvi/            ← Digital inspection
│   ├── inventory/
│   │   ├── repuestos/      ← Parts catalog
│   │   ├── stock/          ← Stock movements
│   │   └── ordenes-compra/ ← Purchase orders
│   ├── finance/
│   │   ├── facturacion/    ← Invoicing (SIFEN)
│   │   ├── tesoreria/      ← Treasury
│   │   ├── contabilidad/   ← Accounting
│   │   └── reportes/       ← Financial reports
│   ├── crm/
│   │   ├── pipeline/       ← Sales pipeline
│   │   ├── contactos/      ← Contacts
│   │   └── campanas/       ← Campaigns
│   ├── scheduling/
│   │   ├── calendario/     ← Calendar view
│   │   └── turnos/         ← Appointments
│   ├── admin/
│   │   ├── sucursales/     ← Branches
│   │   ├── usuarios/       ← Users + roles
│   │   ├── config/         ← Settings
│   │   └── billing/        ← Subscription
│   └── reports/
│       ├── dashboard/      ← Analytics
│       └── export/         ← CSV/PDF export
├── api/                    ← API routes (Next.js)
└── lib/
    ├── api-client.ts       ← Axios/fetch wrapper
    ├── auth.ts             ← Auth helpers
    ├── i18n.ts             ← Internationalization
    └── utils.ts            ← Shared utilities
```

**Componentes clave a crear:**
1. **Design System** — 50+ componentes reutilizables (Button, Input, Table, Modal, etc.)
2. **Dashboard Layout** — Sidebar colapsable, breadcrumbs, notificaciones
3. **Data Table** — Sorting, filtering, pagination, export (TanStack Table)
4. **Form Builder** — Dynamic forms con validación Zod
5. **Kanban Board** — Drag & drop para OTs y pipeline CRM
6. **Calendar** — Vista semanal/mensual para agendamiento
7. **Charts** — Dashboard KPIs con Recharts
8. **Offline Sync** — Service Worker + IndexedDB (migrar lógica actual)

### 2.2 Mobile — React Native (NUEVO)

**Por qué:** Los mecánicos trabajan con tablets/celulares. PWA no es suficiente.

**Stack:**
```
React Native 0.74+ (Expo managed workflow)
├── Expo Router (navigation)
├── React Native Paper (UI components)
├── React Query (data sync)
├── Expo Bluetooth (Thinkcar)
├── Expo Camera (DVI photos)
├── Expo File System (offline storage)
└── Expo Notifications (push)
```

**Pantallas prioritarias:**
1. **Login + Onboarding** — QR code para vincular dispositivo
2. **Mis OTs** — Lista de órdenes del mecánico
3. **DVI** — Inspección digital con cámara
4. **Thinkcar** — Conexión OBD2 vía Bluetooth
5. **Almacén** — Escaneo de código de barras para stock
6. **Dashboard** — KPIs del día (solo lectura)

### 2.3 Backend — Microservices Ready

**Estructura actual (mantener, refactorizar):**
```
src/
├── modules/
│   ├── workshop/        ← Core ERP (no mover)
│   ├── inventory/       ← Stock management
│   ├── finance/         ← SIFEN + Accounting
│   ├── crm/             ← Twenty CRM sync
│   ├── scheduling/      ← Calendar + appointments
│   ├── whatsapp/        ← Evolution API
│   ├── thinkcar/        ← OBD2 diagnostics
│   ├── dvi/             ← Digital inspection
│   ├── intelligence/    ← AI + OCR
│   ├── config/          ← Tenant settings
│   ├── marketing/       ← Lead capture
│   ├── label-printing/  ← ESC/POS + ZPL
│   ├── security-hw/     ← USB Kill-Switch
│   └── backup/          ← Backup/restore
├── shared/
│   ├── database/        ← Drizzle ORM + migrations
│   ├── middleware/       ← Auth, RLS, CSRF, logging
│   └── services/        ← JWT, email, etc.
└── plugins/
    ├── health-check.ts
    ├── metrics.ts
    └── monitoring.ts
```

**Nuevos servicios a crear:**
```
services/
├── auth-service/        ← Clerk/Auth0 integration
├── billing-service/     ← Stripe subscription management
├── notification-service/← Push + email + SMS
├── analytics-service/   ← Event tracking + reporting
├── file-service/        ← S3/Supabase Storage
└── gateway-service/     ← Kong/Traefik API gateway
```

### 2.4 Base de Datos — Schema Evolution

**Migraciones necesarias (Sprint 62-65):**
```sql
-- 1. Tenant management para SaaS
CREATE TABLE tenant_plans (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL, -- 'starter', 'pro', 'enterprise'
  price_monthly DECIMAL(10,2),
  max_users INT,
  max_branches INT,
  features JSONB
);

-- 2. Billing + subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  stripe_subscription_id TEXT,
  plan_id UUID REFERENCES tenant_plans(id),
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ
);

-- 3. Usage metering
CREATE TABLE usage_events (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  event_type TEXT, -- 'api_call', 'storage_mb', 'sms_sent'
  quantity DECIMAL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Audit logs (enterprise)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID,
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CHECK constraints (Chaos Audit C-05)
ALTER TABLE repuestos ADD CONSTRAINT chk_stock_non_negative
  CHECK (stock_actual >= 0);
ALTER TABLE repuestos ADD CONSTRAINT chk_price_non_negative
  CHECK (precio_venta >= 0);
```

### 2.5 Infraestructura — Production Grade

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE (CDN + WAF)                    │
├─────────────────────────────────────────────────────────────┤
│                 VERCEL (Next.js Frontend)                    │
│                 ↓ API calls ↓                               │
├─────────────────────────────────────────────────────────────┤
│            RAILWAY / FLY.IO (Backend API)                    │
│            Fastify + TypeScript                              │
├─────────────┬─────────────┬─────────────────────────────────┤
│  Supabase   │  Upstash    │  Cloudflare R2                  │
│  PostgreSQL │  Redis      │  File Storage                   │
│  (managed)  │  (serverless)│ (S3-compatible)                │
├─────────────┴─────────────┴─────────────────────────────────┤
│              EXPO (React Native Mobile)                      │
│              OTA updates via EAS Update                      │
└─────────────────────────────────────────────────────────────┘
```

**Costos estimados por tenant/mes:**
| Servicio | Costo |
|:---|:---|
| Vercel (frontend) | $0-20 |
| Railway (backend) | $5-20 |
| Supabase (DB) | $25 (Pro) |
| Upstash (Redis) | $0-10 |
| Cloudflare R2 (storage) | $5 |
| **Total por tenant** | **$35-80** |

---

## 3. FUNCIONALIDADES POR FASE

### FASE 1: Conejo de Indias (Sprint 62-68) — 3 meses

**Objetivo:** Primer cliente real operando.

| Sprint | Enfoque | Duración |
|:---|:---|:---|
| **62** | Design System + Dashboard Layout (React) | 2 semanas |
| **63** | Auth + Tenant Management (Clerk) | 2 semanas |
| **64** | Workshop Module (OTs, Clientes, Vehículos) | 3 semanas |
| **65** | Inventory Module (Stock, Repuestos) | 2 semanas |
| **66** | Finance Module (Facturación SIFEN) | 3 semanas |
| **67** | Scheduling + CRM + WhatsApp | 2 semanas |
| **68** | DVI + Thinkcar + Mobile MVP | 3 semanas |

**Total FASE 1:** 17 semanas (~4 meses)

### FASE 2: Escalabilidad (Sprint 69-74) — 3 meses

**Objetivo:** Multi-tenant SaaS funcional.

| Sprint | Enfoque | Duración |
|:---|:---|:---|
| **69** | Billing + Subscriptions (Stripe) | 2 semanas |
| **70** | API Pública + Swagger + SDK | 2 semanas |
| **71** | Analytics + Reporting (Metabase) | 2 semanas |
| **72** | Push Notifications + Email (SendGrid) | 2 semanas |
| **73** | RBAC Avanzado + Audit Logs | 2 semanas |
| **74** | Load Testing + Performance Tuning | 2 semanas |

**Total FASE 2:** 12 semanas (~3 meses)

### FASE 3: Enterprise (Sprint 75-80) — 3 meses

**Objetivo:** Listo para clientes enterprise.

| Sprint | Enfoque | Duración |
|:---|:---|:---|
| **75** | SSO (SAML/OIDC) + 2FA | 2 semanas |
| **76** | Data Export + Import + Migration Tools | 2 semanas |
| **77** | White-label + Custom Domain | 2 semanas |
| **78** | Mobile App (React Native) — Full | 3 semanas |
| **79** | AI Features (Predictive, Copilot) | 2 semanas |
| **80** | SOC2 + GDPR Compliance Prep | 3 semanas |

**Total FASE 3:** 14 semanas (~3.5 meses)

### RESUMEN CRONOLÓGICO

```
Junio 2026 ─── Julio ─── Agosto ─── Sept ─── Oct ─── Nov ─── Dic ─── Ene 2027
    │            │         │         │        │       │       │        │
    ├─ Sprint 62-63 (Auth + Layout) ─────────┤
    │            ├─ Sprint 64-65 (Workshop + Inventory) ──┤
    │            │         ├─ Sprint 66-67 (Finance + CRM) ─────┤
    │            │         │         ├─ Sprint 68 (DVI + Mobile) ─┤
    │            │         │         │        │       │       │        │
    │            │         │         │   🐇 CONEJO DE INDIAS │        │
    │            │         │         │   PRIMER CLIENTE      │        │
    │            │         │         │        │       │       │        │
    │            │         │         │        ├─ Sprint 69-71 (Billing + API) ────┤
    │            │         │         │        │       ├─ Sprint 72-74 (Notify + Perf) ──┤
    │            │         │         │        │       │       │        │
    │            │         │         │        │       │       ├─ Sprint 75-77 (Enterprise) ─────┤
    │            │         │         │        │       │       │        ├─ Sprint 78-80 (Mobile + AI) ─┤
    │            │         │         │        │       │       │        │
    ▼            ▼         ▼         ▼        ▼       ▼       ▼        ▼
   HOY      1 MES     2 MESES   3 MESES  4 MESES  5 MESES  6 MESES  7 MESES
```

---

## 4. PRESUPUESTO ESTIMADO

### Desarrollo (Equipo mínimo)

| Rol | Personas | Costo/mes | Duración | Total |
|:---|:---|:---|:---|:---|
| Full-Stack Senior (React + Node) | 2 | $3,000 | 7 meses | $42,000 |
| Mobile Developer (React Native) | 1 | $2,500 | 3 meses | $7,500 |
| UI/UX Designer | 1 | $2,000 | 2 meses | $4,000 |
| DevOps/Infrastructure | 0.5 | $1,500 | 7 meses | $10,500 |
| **Total Desarrollo** | | | | **$64,000** |

### Infraestructura (primer año)

| Servicio | Costo/mes | Anual |
|:---|:---|:---|
| Supabase Pro | $25 | $300 |
| Railway / Fly.io | $50 | $600 |
| Vercel Pro | $20 | $240 |
| Cloudflare | $20 | $240 |
| Stripe (2.9% + $0.30) | Variable | ~$500 |
| SendGrid | $20 | $240 |
| Expo EAS | $0 | $0 |
| **Total Infra** | **~$135** | **~$2,120** |

### Total Primer Año: ~$66,000

---

## 5. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|:---|:---|:---|:---|
| Frontend reescritura toma más de lo estimado | Alta | Alto | Usar shadcn/ui + Tailwind para acelerar. No diseñar desde cero. |
| Primer cliente tiene requisitos custom | Alta | Medio | Contrato claro: "vanilla" del SaaS, customizaciones van a v2 |
| React Native para Bluetooth es complejo | Media | Alto | Empezar con PWA mejorada, native solo para BT y cámara |
| Stripe no soporta Paraguay directamente | Baja | Alto | Usar Stripe con USD, o MercadoPago como alternativa |
| Equipo no alcanza ritmo | Media | Alto | FASE 1 con 2 devs senior es viable. Escalar después. |

---

## 6. CRITERIOS DE ACEPTACIÓN — CONEJO DE INDIAS

El primer cliente está "listo" cuando:

- [ ] Login + onboarding funciona en < 5 minutos
- [ ] Puede crear OT, asignar mecánico, facturar
- [ ] SIFEN emite facturas válidas (homologación DNIT)
- [ ] WhatsApp envía confirmaciones automáticas
- [ ] Thinkcar conecta vía Bluetooth y importa DTCs
- [ ] DVI funciona en tablet con cámara
- [ ] Dashboard muestra KPIs en tiempo real
- [ ] Puede pagar suscripción vía Stripe
- [ ] Soporte responde en < 24h (email)
- [ ] Uptime > 99% en primer mes

---

## 7. v2.0 — POST-CONEJO DE INDIAS

Después del primer cliente, v2.0 incluye:

| Área | Cambio |
|:---|:---|
| **Hardware** | Tablet industrial (Samsung Tab Active4 Pro), Thinkcar Pro (no Mini) |
| **Frontend** | Temas personalizables (dark/light/custom branding) |
| **Mobile** | App nativa completa con push notifications |
| **AI** | Predictive maintenance, auto-diagnosis, pricing AI |
| **Multi-idioma** | Español + Portugués (Brasil) + Inglés |
| **Marketplace** | Plugins de terceros (seguros, repuestos, etc.) |

---

**Estado:** 📋 PLAN COMPLETADO — Listo para Sprint 62
