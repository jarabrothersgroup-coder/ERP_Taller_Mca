# Plan Estratégico — Backend 100% + Frontend React/Next.js

**Proyecto:** AutomotiveOS Cloud ERP  
**Fecha:** 08 de julio de 2026  
**Restricción Hardware:**

| Equipo | CPU | RAM | Uso Recomendado |
|:-------|:----|:----|:----------------|
| **Servidor** | Core 2 Duo E8400 | 3 GB | ❌ NO usar para desarrollo |
| **PC Escritorio** | i3 | 8 GB | ✅ Desarrollo principal (backend) |
| **Notebook** | i3 | 8 GB | ✅ Desarrollo principal (frontend) |
| **Notebook N3540** | Intel N3540 | 4 GB | ⚠️ Solo tareas ligeras (git, docs, testing) |

---

## 1. DIAGNÓSTICO: POR QUÉ EL SERVIDOR NO SIRVE PARA DESARROLLO

```
Core 2 Duo E8400 (2C/2T @ 2.83GHz) + 3GB RAM
├── Windows/Linux + apps base:         ~1.5 GB
├── PostgreSQL (si local):             ~300 MB
├── Node.js (Fastify backend):         ~80-150 MB
├── Next.js Dev Server:                ~400-800 MB  ← DESBORDA
├── TypeScript Compiler (tsc):         ~200-400 MB  ← DESBORDA
├── Chrome/VSCode:                     ~500 MB+     ← DESBORDA
└── TOTAL NECESARIO:                   ~2.5-3.5 GB  ← IMPOSIBLE
```

**Conclusión:** El servidor solo puede servir la aplicación **ya construida** en producción (con `--max-old-space-size=48`), nunca para desarrollo.

---

## 2. ARQUITECTURA DE DESARROLLO RECOMENDADA

### 2.1 Distribución de Trabajo por Equipo

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE DESARROLLO                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐        ┌──────────────────┐              │
│  │  PC i3 8GB       │        │  Notebook i3 8GB  │              │
│  │  DESARROLLO      │        │  DESARROLLO       │              │
│  │  BACKEND         │        │  FRONTEND         │              │
│  │                  │        │                   │              │
│  │  • Fastify TS    │        │  • Next.js 14     │              │
│  │  • Drizzle ORM   │◄──────►│  • React 18       │              │
│  │  • Services      │  API   │  • Tailwind       │              │
│  │  • Routes        │  JSON  │  • shadcn/ui      │              │
│  │  • Tests (vitest)│        │  • React Query    │              │
│  └──────────────────┘        └──────────────────┘              │
│           │                          │                          │
│           ▼                          ▼                          │
│  ┌──────────────────────────────────────────┐                  │
│  │         Supabase PostgreSQL              │                  │
│  │         (Base de datos remota)           │                  │
│  │         FREE tier: 500MB                 │                  │
│  │         PRO tier: 8GB ($25/mes)          │                  │
│  └──────────────────────────────────────────┘                  │
│                                                                 │
│  ┌──────────────────┐                                          │
│  │  N3540 4GB       │                                          │
│  │  SOLO PARA:      │                                          │
│  │  • Git commits   │                                          │
│  │  • Documentación │                                          │
│  │  • Code review   │                                          │
│  │  • Testing ligero│                                          │
│  └──────────────────┘                                          │
│                                                                 │
│  ┌──────────────────┐                                          │
│  │  Servidor 3GB    │                                          │
│  │  SOLO PARA:      │                                          │
│  │  • Deploy prod   │                                          │
│  │  • Docker compose│                                          │
│  │  • Health checks │                                          │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Por qué NO usar el servidor para desarrollo

| Razón | Detalle |
|:------|:--------|
| **RAM insuficiente** | 3GB no alcanzan para Node.js + Next.js + Chrome |
| **CPU obsoleto** | Core 2 Duo es 15x más lento que un i3 moderno |
| **Sin hot-reload** | TypeScript compilation tardaría 30-60s por cambio |
| **Riesgo de corrupción** | OOM kills podrían dañar la BD en desarrollo |
| **El servidor ya funciona** | Deploy con `--max-old-space-size=48` en 50MB |

---

## 3. PLAN: BACKEND AL 100% (Sprint B1-B4)

### Objetivo: Completar los módulos faltantes del backend

**Duración estimada:** 4-6 sprints (2-3 semanas por sprint)  
**Equipo:** 1 desarrollador en PC i3 8GB

### Sprint B1: APIs Públicas + SDK (1 semana)

| Tarea | Archivos | Prioridad |
|:------|:---------|:----------|
| OpenAPI 3.1 spec completa | `src/shared/swagger/` | Alta |
| SDK generator (openapi-typescript-codegen) | `scripts/gen-sdk.ts` | Alta |
| Rate limiting por tenant | `src/shared/middleware/tenant-rate-limit.ts` | Alta |
| API versioning (v1/v2) | `src/app.ts` | Media |
| Webhook system para eventos | `src/shared/services/webhook.service.ts` | Media |

**Archivos a crear:**
```
src/shared/swagger/openapi.ts          — Spec completa
src/shared/middleware/tenant-rate-limit.ts — Rate limit por tenant
src/shared/services/webhook.service.ts  — Webhook dispatch
src/shared/services/api-key.service.ts  — API key management
scripts/gen-sdk.ts                      — SDK generator
```

### Sprint B2: Email Transaccional + Notificaciones Push (1 semana)

| Tarea | Archivos | Prioridad |
|:------|:---------|:----------|
| SendGrid integration | `src/shared/services/email.service.ts` | Alta |
| Email templates (factura, presupuesto, recordatorio) | `src/shared/templates/` | Alta |
| Firebase Cloud Messaging | `src/shared/services/push.service.ts` | Media |
| Notificaciones email automáticas | Integración con existing service | Alta |

**Archivos a crear:**
```
src/shared/services/email.service.ts      — SendGrid wrapper
src/shared/services/push.service.ts       — FCM wrapper
src/shared/templates/factura.html         — Template factura
src/shared/templates/presupuesto.html     — Template presupuesto
src/shared/templates/recordatorio.html    — Template recordatorio
```

### Sprint B3: Analytics Avanzado + Event Tracking (1 semana)

| Tarea | Archivos | Prioridad |
|:------|:---------|:----------|
| Event tracking system | `src/shared/services/event-tracker.ts` | Alta |
| Metabase embed API | `src/modules/analytics/routes/metabase.routes.ts` | Media |
| Custom report builder | `src/modules/analytics/services/report-builder.service.ts` | Alta |
| Export a PDF/Excel | `src/shared/services/export.service.ts` | Media |

**Archivos a crear:**
```
src/shared/services/event-tracker.ts         — Event tracking
src/shared/services/export.service.ts        — PDF/Excel export
src/modules/analytics/services/report-builder.service.ts — Custom reports
src/modules/analytics/routes/metabase.routes.ts — Metabase embed
```

### Sprint B4: Seguridad Enterprise + Compliance (1 semana)

| Tarea | Archivos | Prioridad |
|:------|:---------|:----------|
| 2FA (TOTP) | `src/shared/services/totp.service.ts` | Alta |
| Audit log enterprise | `src/shared/services/audit-enterprise.service.ts` | Alta |
| Data retention policies | `src/shared/services/data-retention.service.ts` | Media |
| IP whitelist por tenant | `src/shared/middleware/ip-whitelist.ts` | Media |

**Archivos a crear:**
```
src/shared/services/totp.service.ts              — 2FA TOTP
src/shared/services/audit-enterprise.service.ts  — Enterprise audit
src/shared/services/data-retention.service.ts    — Data retention
src/shared/middleware/ip-whitelist.ts            — IP whitelist
```

---

## 4. PLAN: FRONTEND REACT/NEXT.JS (Sprint F1-F10)

### 4.1 Stack Tecnológico (Optimizado para 8GB RAM)

```json
{
  "framework": "Next.js 14 (App Router)",
  "ui": "shadcn/ui + Tailwind CSS 4",
  "state": "Zustand (lightweight)",
  "data": "@tanstack/react-query",
  "forms": "react-hook-form + zod",
  "charts": "recharts",
  "table": "@tanstack/react-table",
  "icons": "lucide-react",
  "auth": "clerk",
  "i18n": "next-intl"
}
```

**Optimizaciones de RAM para 8GB:**
```bash
# next.config.js — Limitar memoria
module.exports = {
  experimental: {
    memoryBasedWorkers: true,
  },
  // Usar Turbopack (más eficiente que Webpack)
  experimental: {
    turbo: {},
  },
}

# tsconfig.json — Reducir uso de memoria
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

### 4.2 Estructura del Proyecto

```
frontend/
├── src/
│   ├── app/                    ← Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx      ← Sidebar + nav
│   │   │   ├── page.tsx        ← KPIs dashboard
│   │   │   ├── workshop/
│   │   │   │   ├── ordenes/page.tsx
│   │   │   │   ├── clientes/page.tsx
│   │   │   │   ├── vehiculos/page.tsx
│   │   │   │   └── dvi/page.tsx
│   │   │   ├── inventory/
│   │   │   │   ├── repuestos/page.tsx
│   │   │   │   ├── stock/page.tsx
│   │   │   │   └── ordenes-compra/page.tsx
│   │   │   ├── finance/
│   │   │   │   ├── facturacion/page.tsx
│   │   │   │   ├── tesoreria/page.tsx
│   │   │   │   ├── contabilidad/page.tsx
│   │   │   │   └── reportes/page.tsx
│   │   │   ├── crm/
│   │   │   │   ├── pipeline/page.tsx
│   │   │   │   └── contactos/page.tsx
│   │   │   ├── scheduling/
│   │   │   │   └── calendario/page.tsx
│   │   │   └── admin/
│   │   │       ├── usuarios/page.tsx
│   │   │       ├── sucursales/page.tsx
│   │   │       └── config/page.tsx
│   │   └── api/                ← API routes (Next.js)
│   ├── components/
│   │   ├── ui/                 ← shadcn/ui components
│   │   ├── layout/             ← Sidebar, Header, Breadcrumbs
│   │   ├── workshop/           ← OT, Client, Vehicle components
│   │   ├── inventory/          ← Stock, Repuestos components
│   │   ├── finance/            ← Facturacion, Tesoreria components
│   │   └── shared/             ← DataTable, FormBuilder, etc.
│   ├── lib/
│   │   ├── api-client.ts       ← Axios/fetch wrapper
│   │   ├── auth.ts             ← Auth helpers
│   │   └── utils.ts            ← Shared utilities
│   ├── hooks/                  ← Custom React hooks
│   ├── stores/                 ← Zustand stores
│   └── types/                  ← TypeScript types
├── public/
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 4.3 Sprints de Frontend

#### Sprint F1: Fundación + Design System (2 semanas)

| Tarea | Detalle | RAM |
|:------|:--------|:----|
| Inicializar Next.js 14 | `npx create-next-app@latest frontend` | 500MB |
| Configurar Tailwind + shadcn/ui | `npx shadcn-ui@latest init` | 300MB |
| Design System base | Button, Input, Select, Modal, Card | 200MB |
| Layout principal | Sidebar colapsable, Header, Breadcrumbs | 300MB |
| Clerk Auth setup | Login, register, forgot-password | 200MB |

**Total RAM estimado:** ~1.5 GB (cabe en 8GB)

#### Sprint F2: Dashboard + KPIs (1 semana)

| Tarea | Detalle |
|:------|:--------|
| Dashboard page | KPI cards, charts (Recharts) |
| Activity feed | Últimas actividades |
| Quick actions | Accesos rápidos |
| Responsive layout | Mobile-first |

#### Sprint F3: Workshop Module (2 semanas)

| Tarea | Detalle |
|:------|:--------|
| OT Kanban | Drag-and-drop states |
| OT List + Filters | DataTable con sorting/filtering |
| Client CRUD | Create/Edit/View modal |
| Vehicle CRUD | Create/Edit con VIN decode |
| DVI Canvas | Markup tools, photo upload |

#### Sprint F4: Inventory Module (1 semana)

| Tarea | Detalle |
|:------|:--------|
| Repuestos CRUD | Create/Edit con barcode |
| Stock movements | Entrada/Salida con validación |
| Purchase orders | OC lifecycle |
| Tool instances | Estado, préstamo, devolución |

#### Sprint F5: Finance Module (2 semanas)

| Tarea | Detalle |
|:------|:--------|
| Facturación SIFEN | Emisión, consulta, anulación |
| Contabilidad | Plan de cuentas, asientos, balance |
| Tesorería | Cuentas bancarias, movimientos |
| CxC/CxP | Cobros, pagos, vencimientos |

#### Sprint F6: Scheduling + CRM (1 semana)

| Tarea | Detalle |
|:------|:--------|
| Calendar view | Week/Month con drag-drop |
| Appointments | CRUD con disponibilidad |
| CRM Pipeline | Kanban de ventas |
| Contactos | CRUD con historial |

#### Sprint F7: WhatsApp + Notifications (1 semana)

| Tarea | Detalle |
|:------|:--------|
| WhatsApp panel | QR, envío, historial |
| Template manager | CRUD templates |
| Notification bell | WebSocket en tiempo real |
| Follow-ups | Programación automática |

#### Sprint F8: Analytics + Reports (1 semana)

| Tarea | Detalle |
|:------|:--------|
| Analytics dashboard | KPIs, trends, charts |
| Scorecard | Balanced Scorecard |
| Custom reports | Builder de reportes |
| CSV/PDF export | Exportación de datos |

#### Sprint F9: Settings + Admin (1 semana)

| Tarea | Detalle |
|:------|:--------|
| User management | CRUD usuarios, roles |
| Branch management | Multi-sucursal |
| Tenant config | Configuración del taller |
| Backup/Restore UI | Panel de backups |

#### Sprint F10: PWA + Offline + Polish (1 semana)

| Tarea | Detalle |
|:------|:--------|
| PWA setup | Service Worker, manifest |
| Offline sync | IndexedDB + background sync |
| Mobile responsive | Optimización táctil |
| Performance | Lighthouse > 90 |
| i18n | ES/GU translations |

---

## 5. DESPLIEGUE: DÓNDE CORRE QUÉ

### 5.1 Producción (Recomendado)

```
┌─────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA CLOUD                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐     ┌─────────────────┐              │
│  │  Vercel (FREE)   │     │  Railway (FREE)  │              │
│  │  Frontend Next.js│     │  Backend Fastify  │              │
│  │  100GB bandwidth │     │  512MB RAM        │              │
│  │  SSL automático  │     │  $5/mes after     │              │
│  └────────┬────────┘     └────────┬────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────────────────────────────┐              │
│  │         Supabase PostgreSQL              │              │
│  │         FREE tier: 500MB                 │              │
│  │         PRO tier: 8GB ($25/mes)          │              │
│  └──────────────────────────────────────────┘              │
│                                                             │
│  Costo total: $0-30/mes (FREE tier)                        │
│  Costo producción: ~$30/mes (PRO tier)                     │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Desarrollo Local (En tus máquinas)

```
┌─────────────────────────────────────────────────────────────┐
│              DESARROLLO LOCAL (8GB RAM)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PC i3 8GB:                                                │
│  ├── Backend (Fastify): ~150MB                              │
│  ├── VSCode: ~400MB                                         │
│  ├── Chrome (docs): ~500MB                                  │
│  └── Total: ~1.1GB ✅                                      │
│                                                             │
│  Notebook i3 8GB:                                          │
│  ├── Frontend (Next.js): ~800MB                             │
│  ├── VSCode: ~400MB                                         │
│  ├── Chrome (localhost): ~500MB                             │
│  └── Total: ~1.7GB ✅                                      │
│                                                             │
│  ⚠️ NO correr backend + frontend en la misma máquina       │
│     (usar API remota o segundo proceso)                     │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Servidor 3GB (SOLO Producción)

```
┌─────────────────────────────────────────────────────────────┐
│           SERVIDOR CORE 2 DUO 3GB (PRODUCCIÓN)              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Docker Compose (mínimo):                                   │
│  ├── Fastify backend: 48MB (--max-old-space-size=48)        │
│  ├── PostgreSQL: 256MB (limitado)                           │
│  ├── Redis: 32MB (opcional)                                 │
│  └── Total: ~336MB ✅                                      │
│                                                             │
│  ⚠️ NO Next.js dev server                                   │
│  ⚠️ NO compilation                                          │
│  ⚠️ SOLO archivos estáticos (next build + next start)       │
│                                                             │
│  Alternativa mejor:                                         │
│  ├── Frontend en Vercel (GRATIS)                            │
│  ├── Backend en Railway (GRATIS/5USD)                       │
│  ├── DB en Supabase (GRATIS/25USD)                          │
│  └── Servidor como backup/development only                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. SCRIPTS DE DESARROLLO

### 6.1 Backend (PC i3 8GB)

```bash
# Terminal 1: Backend
cd /home/jara/Projects/ERP_Taller_Mca
npm run dev

# Terminal 2: Tests watch
npm run test:watch

# Terminal 3: Type check
npm run typecheck
```

### 6.2 Frontend (Notebook i3 8GB)

```bash
# Terminal 1: Frontend
cd /home/jara/Projects/ERP_Taller_Mca/frontend
npm run dev

# Terminal 2: API proxy (si backend corre en otra máquina)
# Editar .env.local:
# NEXT_PUBLIC_API_URL=http://192.168.x.x:3000
```

### 6.3 N3540 4GB (Tareas Ligeras)

```bash
# Solo git y docs
cd /home/jara/Projects/ERP_Taller_Mca
git status
git add .
git commit -m "feat: ..."
git push

# Documentación
code docs/
```

---

## 7. CRONOGRAMA TOTAL

```
Julio 2026          Agosto            Septiembre         Octubre
│                   │                 │                  │
├─ B1: API+SDK ────┤                 │                  │
├─ B2: Email+Push ─┤                 │                  │
├─ B3: Analytics ──┤                 │                  │
├─ B4: Security ───┤                 │                  │
│                   │                 │                  │
│   ┌─ F1: Fundation + Design System (2 sem) ──────────┤
│   ├─ F2: Dashboard (1 sem) ─────────────────────────┤
│   ├─ F3: Workshop (2 sem) ──────────────────────────┤
│   ├─ F4: Inventory (1 sem) ─────────────────────────┤
│   ├─ F5: Finance (2 sem) ───────────────────────────┤
│   ├─ F6: Scheduling+CRM (1 sem) ────────────────────┤
│   ├─ F7: WhatsApp+Notify (1 sem) ───────────────────┤
│   ├─ F8: Analytics (1 sem) ─────────────────────────┤
│   ├─ F9: Admin (1 sem) ─────────────────────────────┤
│   └─ F10: PWA+Offline (1 sem) ──────────────────────┤
│                   │                 │                  │
▼                   ▼                 ▼                  ▼
HOY            1 MES            2 MESES            3 MESES
```

**Total estimado:** 14-16 semanas (~3.5-4 meses)

---

## 8. PRESUPUESTO MÍNIMO

| Servicio | Tier | Costo/Mes |
|:---------|:-----|:----------|
| Supabase PostgreSQL | FREE | $0 |
| Vercel (Frontend) | FREE | $0 |
| Railway (Backend) | FREE | $0 |
| Clerk (Auth) | FREE | $0 (hasta 10K MAU) |
| **Total desarrollo** | | **$0** |
| | | |
| Supabase PostgreSQL | PRO | $25 |
| Vercel | Pro | $20 |
| Railway | Starter | $5 |
| Clerk | Pro | $25 |
| **Total producción** | | **~$75/mes** |

---

## 9. RECOMENDACIONES FINALES

### ✅ HACER

1. **Separar backend y frontend** en máquinas distintas (una por cada uno)
2. **Usar Supabase PostgreSQL** (no local) — ahorra 300MB de RAM
3. **Vercel para frontend** — build automático, SSL gratis, CDN global
4. **Railway para backend** — deployment automático, escalable
5. **Turbopack** en Next.js — 10x más rápido que Webpack, menos RAM
6. **Incremental builds** — TypeScript incremental reduce tiempo de compilación

### ❌ NO HACER

1. **NO correr frontend + backend en la misma máquina 8GB** — se quedará sin RAM
2. **NO usar el servidor 3GB para desarrollo** — solo para producción
3. **NO instalar PostgreSQL local** — usar Supabase/Neon remoto
4. **NO usar Webpack** — Turbopack es más eficiente en RAM
5. **NO crear el frontend monolítico** — separar por módulos con lazy loading

### 💡 TRUCOS PARA 8GB RAM

```bash
# Limitar memoria de Node.js
export NODE_OPTIONS="--max-old-space-size=4096"

# Next.js con Turbopack (menos RAM)
npx next dev --turbo

# VSCode: deshabilitar extensiones pesadas
# - GitLens (usa ~200MB)
# - ESLint (usa ~100MB)
# - Usar solo TypeScript + Tailwind

# Chrome: deshabilitar extensiones
# - Solo abrir localhost:3000, no múltiples tabs
```

---

**Estado:** ✅ Plan completado  
**Próximo paso:** Decidir si empezar por Backend B1 o Frontend F1
