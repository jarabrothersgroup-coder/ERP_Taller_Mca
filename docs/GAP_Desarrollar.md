# Informe de GAPs — Análisis de Brechas para Desarrollo

**Proyecto:** AutomotiveOS Cloud ERP  
**Fecha:** 08 de julio de 2026  
**Clasificación:** Documento Interno — Planificación de Desarrollo  
**Base:** Exploración directa del código fuente + Plan Conejo de Indias (Sprint 62-80)

---

## 📊 Métricas Generales del Código Fuente

| Categoría | Cantidad |
|:---|:---|
| **Módulos backend** | 19 plugins registrados |
| **Archivos de rutas** | 67 route files |
| **Archivos de servicios** | 72 service files |
| **Archivos de schema** | 63 schema files |
| **Módulos frontend (JS)** | 49 archivos |
| **Archivos de test** | 39 test files |
| **Tests totales** | 1,116+ passing |
| **Migraciones SQL** | 25 (0000–0024) |
| **Frontend React/Next.js** | ❌ NO EXISTE |
| **Mobile React Native** | ❌ NO EXISTE |

---

## 🔧 BACKEND — 19 Módulos Implementados

| # | Módulo | Plugin | Servicios | Rutas | Schema |
|:--|:-------|:------:|:---------:|:-----:|:------:|
| 1 | **Workshop** (core) | ✅ | 14 | 15 | 12 |
| 2 | **Finance** (SIFEN+Accounting) | ✅ | 8 | 10 | 17 |
| 3 | **Inventory** (Stock) | ✅ | 10 | 10 | 12 |
| 4 | **WhatsApp** (Evolution API) | ✅ | 4 | 3 | 4 |
| 5 | **CRM** (Twenty) | ✅ | 2 | 1 | 1 |
| 6 | **Scheduling** (Calendario) | ✅ | 2 | 1 | 1 |
| 7 | **Intelligence** (AI+OCR) | ✅ | 7 | 6 | 2 |
| 8 | **Config** (Tenant) | ✅ | 4 | 3 | 1 |
| 9 | **DVI** (Inspección Digital) | ✅ | 2 | 2 | 1 |
| 10 | **Analytics** | ✅ | 1 | 1 | 0 |
| 11 | **Thinkcar** (OBD2) | ✅ | 8 | 1 | 1 |
| 12 | **Marketing** | ✅ | 4 | 2 | 0 |
| 13 | **Fleet** (Flotas B2B) | ✅ | 1 | 1 | 0 |
| 14 | **Label Printing** | ✅ | 1 | 1 | 1 |
| 15 | **Backup/Restore** | ✅ | 2 | 1 | 1 |
| 16 | **Security HW** (Kill-Switch) | ✅ | 1 | 1 | 1 |
| 17 | **Client Portal** | ✅ | 2 | 1 | 0 |
| 18 | **Tenants** (Multi-branch) | ✅ | 2 | 1 | 2 |
| 19 | **Migration** (Config export) | ✅ | 1 | 1 | 0 |

**Total: 72 servicios, 67 rutas, 63 schemas**

---

## 🖥️ FRONTEND — Solo Vanilla JavaScript (SIN React)

### Archivos existentes (49 módulos JS)

Ubicación: `src/shared/public/js/`

| Categoría | Módulos |
|:---|:---|
| **Core** | app.js, dashboard.js, search.js, notifications.js, notification-bell.js |
| **Workshop** | ordenes.js, ingreso.js, taller.js, servicios.js, history.js, signature |
| **Finance** | contabilidad.js, tesoreria.js, facturacion.js, budget.js, payroll.js |
| **Inventory** | inventario.js, inventory-batch.js |
| **CRM/Sales** | crm.js, marketing.js, fleet.js, calendario.js |
| **Communication** | whatsapp.js, whatsapp-monitor.js, wa-templates.js |
| **Intelligence** | thinkcar.js, ai-copilot.js, dvi.js, analytics-dashboard.js, analytics.js |
| **UX/Infra** | ux.js, theme.js, shortcuts.js, a11y.js, i18n.js, mobile.js, pwa.js |
| **Offline** | offline-db.js, offline-queue.js |
| **Security** | sanitize.js, security-hw.js, backup-restore.js, label-printing.js |
| **Reports** | charts.js, print.js, sifen-monitor.js, client-portal.js |
| **Help** | help-sidebar.js, faq-data.js, faq-data.js |

### Estado del frontend

- ✅ SPA funcional con vanilla JS + Tailwind CDN
- ✅ 49 módulos extraídos de un monolito de 4,431 líneas
- ✅ PWA con Service Worker, IndexedDB offline, Background Sync
- ✅ RBAC frontend con roles y visibilidad por vista
- ❌ **SIN React/Next.js** — No existe `src/app/`, `frontend/`, ni `next.config.*`
- ❌ **SIN design system** — No shadcn/ui, no componentes reutilizables
- ❌ **SIN state management** — No Zustand, no React Query
- ❌ **SIN TypeScript en frontend** — Todo es JavaScript vanilla

---

## 🗄️ BASE DE DATOS — 25 Migraciones, 63 Schemas

### Migraciones SQL (0000–0024)

| Rango | Contenido |
|:---|:---|
| 0000-0004 | Base (clientes, vehículos, OT, Thinkcar imports) |
| 0005-0006 | Inventario Phase 1 + Tool lifecycle |
| 0007-0010 | Dimensiones analíticas, IRE, Formularios fiscales, Tenant config |
| 0011-0014 | Activos fijos, Sprint 4, Capa 4-5 (audit/centros costo), Asiento ID en facturas |
| 0015-0018 | Tesorería, Workshop items, Presupuestos, Notificaciones |
| 0019-0022 | RLS Security (35+ tablas), Catálogo multidimensional, Factura detalles, Sprint 34 |
| 0023-0024 | Branch isolation RLS, Check constraints |

### Schema Groups

| Grupo | Tablas Principales |
|:---|:---|
| **Workshop** | vehiculos, ordenes_trabajo, ingresos, trabajos_terceros, servicios_catalogo, service_pricing, vehicle_reference, vehiculos_master, orden_servicios, orden_repuestos, notification_priority |
| **Finance** | accounting (plan_cuentas, asientos), facturas, factura-detalle, treasury (cuentas_bancarias, movimientos_tesoreria, conciliacion_bancaria, facturas_proveedor), fixed-expenses, mechanic-profiles, staff-profiles, commission-records, payroll-summary, budget, cost-centers, audit-log, fiscal-docs, fiscal-forms, fixed-assets, exchange-rates, revaluations |
| **Inventory** | repuestos, herramientas, control_herramientas, stock-movements, cost-history, purchase-orders, purchase_order_items, reorder-alerts, inventory_accounts_map, tool_instances, tool_maintenance_events, tool_depreciation_entries, initial_inventory_loads |
| **WhatsApp** | whatsapp_messages, whatsapp_templates, whatsapp_followups, whatsapp_error_log |
| **DVI** | dvi_inspections, dvi_photos, dvi_items |
| **Scheduling** | agendamientos |
| **CRM** | crm_sync_log, Twenty CRM (externo) |
| **Security** | hardware_fingerprints, usb_security_tokens, security_audit_log |
| **Backup** | backup_policies, backup_jobs, restore_sessions |
| **Label** | label_templates, print_jobs |
| **Tenants** | tenants, tenant_config, sucursales |
| **Core** | clients, profiles, notifications |

---

## 🚨 GAP CRÍTICOS vs. Plan Conejo de Indias (Sprint 62-80)

### FASE 1 — Conejo de Indias (Sprint 62-68) — Primer Cliente

| Sprint | Target Planificado | Estado Actual | GAP |
|:-------|:-------------------|:-------------:|:----|
| **62** | Design System + Dashboard Layout (React/Next.js) | ❌ NO INICIADO | Frontend entero sin React |
| **63** | Auth + Tenant Management (Clerk) | ❌ NO INICIADO | Auth actual es scrypt manual |
| **64** | Workshop Module (OTs, Clientes, Vehículos) en React | ❌ NO INICIADO | Solo existe en vanilla JS |
| **65** | Inventory Module (Stock, Repuestos) en React | ❌ NO INICIADO | Solo existe en vanilla JS |
| **66** | Finance Module (Facturación SIFEN) en React | ❌ NO INICIADO | Solo existe en vanilla JS |
| **67** | Scheduling + CRM + WhatsApp en React | ❌ NO INICIADO | Solo existe en vanilla JS |
| **68** | DVI + Thinkcar + Mobile MVP | ⚠️ Backend listo | Frontend vanilla, sin React Native |

**Total FASE 1:** 17 semanas (~4 meses) — **0% de frontend React avanzado**

### FASE 2 — Escalabilidad (Sprint 69-74) — Multi-tenant SaaS

| Sprint | Target Planificado | Estado Actual | GAP |
|:-------|:-------------------|:-------------:|:----|
| **69** | Billing + Subscriptions (Stripe) | ❌ NO EXISTE | Sin tablas, sin integración |
| **70** | API Pública + Swagger + SDK | ⚠️ Swagger parcial | Sin SDK, sin developer portal |
| **71** | Analytics + Reporting (Metabase) | ⚠️ Básico | Sin Metabase, sin event tracking |
| **72** | Push Notifications + Email (SendGrid) | ❌ NO EXISTE | Solo WhatsApp |
| **73** | RBAC Avanzado + Audit Logs | ⚠️ RBAC básico | Sin SSO, sin audit enterprise |
| **74** | Load Testing + Performance Tuning | ❌ NO INICIADO | Sin benchmarks de carga |

### FASE 3 — Enterprise (Sprint 75-80)

| Sprint | Target Planificado | Estado Actual | GAP |
|:-------|:-------------------|:-------------:|:----|
| **75** | SSO (SAML/OIDC) + 2FA | ❌ NO EXISTE | |
| **76** | Data Export + Import + Migration Tools | ⚠️ Parcial | Migración de config existe |
| **77** | White-label + Custom Domain | ❌ NO EXISTE | |
| **78** | Mobile App (React Native) — Full | ❌ NO EXISTE | Sin `frontend/` ni Expo |
| **79** | AI Features (Predictive, Copilot) | ⚠️ Básico | AI DTC assistant existe, falta predictive completo |
| **80** | SOC2 + GDPR Compliance Prep | ❌ NO EXISTE | |

---

## 📋 Brechas por Categoría de Severidad

### 🔴 CRÍTICAS — Bloquean Primer Cliente SaaS

| # | Brecha | Impacto | Esfuerzo Est. |
|:--|:-------|:--------|:--------------|
| 1 | **Frontend React/Next.js** — 0% de lo planificado. Todo es vanilla JS sin componentes reutilizables | Bloquea todos los sprints 62-68 | 8-10 sprints |
| 2 | **Auth Clerk** — Sistema actual es scrypt manual, no SaaS-ready, sin MFA | Sin onboarding self-service | 2 sprints |
| 3 | **Billing Stripe** — Sin tablas, sin integración, sin suscripciones | Sin revenue model | 2 sprints |
| 4 | **React Native Mobile** — Sin app nativa para mecánicos | Mecánicos sin herramienta móvil | 3-4 sprints |

### 🟠 ALTAS — Reducen Competitividad

| # | Brecha | Impacto | Esfuerzo Est. |
|:--|:-------|:--------|:--------------|
| 5 | **Design System** — Sin shadcn/ui, sin componentes reutilizables | Inconsistencia visual, retrabajo | 2 sprints |
| 6 | **API Gateway** — Sin Kong/Traefik, sin rate limiting por tenant | Sin escalabilidad SaaS | 1-2 sprints |
| 7 | **SendGrid/Email** — Solo WhatsApp, sin email transaccional | Sin facturas por email, sin notificaciones | 1 sprint |
| 8 | **Load Testing** — Sin benchmarks de carga ni optimización | Riesgo de downtime en producción | 1-2 sprints |

### 🟡 MEDIAS — Funcionalidades Faltantes vs. Competencia

| # | Brecha | Competencia | Esfuerzo Est. |
|:--|:-------|:------------|:--------------|
| 9 | **Online Booking 24/7** — Solo por WhatsApp, sin booking web | Tekmetric, Shopmonkey lo tienen | 1-2 sprints |
| 10 | **Google Reviews** — Schema existe pero sin integración real | Tekmetric, Mitchell 1 | 1 sprint |
| 11 | **Email Marketing** — Campaign schema existe, sin envío real | Tekmetric Marketing | 1-2 sprints |
| 12 | **Cross-reference VIN (TecDoc)** — Solo NHTSA, sin catálogo OEM | Mitchell 1 (3B+ registros) | 2-3 sprints |
| 13 | **Barcode/QR scanning** — Service existe, sin frontend integrado | Shopmonkey, TallerAlpha | 1 sprint |
| 14 | **Before/After photos** — DVI tiene fotos, sin comparación | Tekmetric Smart DVI | 1 sprint |
| 15 | **Gestión de neumáticos** — No existe módulo | Tekmetric, Mitchell 1 | 1-2 sprints |

### 🟢 BAJAS — Mejoras Incrementales

| # | Brecha | Esfuerzo Est. |
|:--|:-------|:--------------|
| 16 | **White-label** — Sin soporte multi-branding | 2 sprints |
| 17 | **SOC2/GDPR** — Sin compliance framework | 2-3 sprints |
| 18 | **Multi-idioma backend** — Solo frontend i18n | 1 sprint |
| 19 | **Marketplace plugins** — Sin extensibilidad de terceros | 3+ sprints |

---

## ✅ Lo que SÍ Está Sólido (Backend Maduro ~80%)

| Área | Estado | Detalle |
|:-----|:------:|:--------|
| Core ERP | ✅ | Workshop, Finance, Inventory funcional |
| SIFEN Fiscal | ✅ | V150, RG 90 Marangatu, emitting facturas |
| WhatsApp | ✅ | Bidireccional con templates, follow-ups, queue |
| DVI | ✅ | Fotos, canvas markup, health score, WhatsApp share |
| Thinkcar OBD2 | ✅ | 3 canales (USB/BT/Email), health tracking |
| AI DTC Assistant | ✅ | GPT-4o-mini + fallback local |
| RLS Multi-tenant | ✅ | 35+ tablas protegidas |
| PWA Offline-first | ✅ | IndexedDB, Background Sync, Service Worker v2 |
| Testing | ✅ | 1,116+ tests, 39 archivos |
| Security | ✅ | JWT, RBAC, CSRF, Helmet, Kill-Switch USB |
| Backup/Restore | ✅ | pg_dump + AES-256-GCM + checksums |
| i18n | ✅ | ES + Guaraní (200+ strings cada uno) |
| Accounting Bus | ✅ | Auto asientos para VENTA, COMPRA, STOCK, NÓMINA |
| Scheduling | ✅ | Capacity management, WhatsApp reminders, check-in |

---

## 🎯 Recomendación de Priorización

### Sprint 62-63: Fundación (4 semanas)
1. Inicializar proyecto Next.js 14 + TypeScript + Tailwind + shadcn/ui
2. Design System: Button, Input, Table, Modal, Sidebar, Layout
3. Clerk Auth: Login, register, forgot-password, JWT middleware
4. Dashboard Layout: Sidebar colapsable, breadcrumbs, notificaciones

### Sprint 64-66: Core ERP en React (7 semanas)
5. Workshop: OT Kanban, clientes CRUD, vehículos CRUD, DVI
6. Inventory: Repuestos, stock movements, purchase orders
7. Finance: Facturación SIFEN, contabilidad, tesorería

### Sprint 67-68: Integraciones + Mobile (5 semanas)
8. Scheduling: Calendar drag-drop, appointments
9. CRM + WhatsApp: Pipeline, messages, templates
10. DVI + Thinkcar: Canvas markup, OBD2 import
11. React Native MVP: Mis OTs, DVI, Thinkcar

### Sprint 69-74: SaaS (12 semanas)
12. Stripe billing + subscriptions
13. API docs + SDK
14. SendGrid email
15. Load testing + optimization

---

**Estado del informe:** ✅ Generado automáticamente por exploración del código fuente  
**Próximo paso:** Iniciar Sprint 62 — Design System + Dashboard Layout (React/Next.js)
