# Auditoría Arquitectónica Integral — AutomotiveOS ERP

**Fecha:** 2026-07-24  
**Alcance:** 30 módulos frontend · 23 módulos backend · 67,955 líneas de código backend  
**Estado:** Sprint 89 COMPLETED (Sprint 89.5 — Conciliación Bancaria + Nómina completados)

---

## 1. Resumen Ejecutivo

### 1.1 Métricas del Sistema

| Métrica | Valor |
|---------|-------|
| Páginas frontend | 30 módulos + 13 sub-páginas = **43 rutas** |
| Líneas frontend (page.tsx) | **9,791 líneas** |
| Módulos backend | **23 módulos** (24 contando migration) |
| Route files backend | **80 archivos**, 17,768 líneas |
| Schema files backend | **90 archivos**, 8,479 líneas |
| Service files backend | **85 archivos**, 41,708 líneas |
| **Total backend** | **67,955 líneas** |
| API client (api.ts) | 1,764 líneas |
| Data hooks (use-data.ts) | 426 líneas |
| Data service (data-service.ts) | 935 líneas |

### 1.2 Estimación de Automatización

| Proceso | % Automatizado | Estado |
|---------|----------------|--------|
| Recepción de vehículos | **95%** | ✅ Checklist estructurado, firma digital, paneles, neumáticos, combustible, accesorios |
| Presupuestos | **85%** | ✅ CRUD completo, aprobación, conversión automática a OT |
| Órdenes de Trabajo | **90%** | ✅ CRUD, transiciones de estado, flat-rate, asignación, ML predictivo |
| Facturación | **80%** | ✅ Emisión MANUAL + ELECTRÓNICA (SIFEN), portal de pagos online |
| Contabilidad | **85%** | ✅ Partida doble, asientos automáticos, RG90, depreciación, centralización |
| Tesorería | **80%** | ✅ Cuentas bancarias, movimientos, CxC, conciliación bancaria |
| Inventario | **75%** | ✅ Repuestos, stock movements, herramientas, órdenes compra, TecDoc |
| Nómina | **70%** | ⚠️ Perfiles MTESS, cálculo de comisiones, break-even. Falta: liquidación mensual formal |
| CRM | **50%** | ⚠️ Leads, Twenty CRM sync. Falta: pipeline visual, follow-ups automáticos |
| Marketing | **60%** | ⚠️ Campañas, loyalty, reviews. Falta: automatización de secuencias |
| Calendario | **65%** | ⚠️ Citas, week view. Falta: recordatorios automáticos, capacity planning visual |

### 1.3 Riesgos Operacionales Principales

1. **Facturación electrónica parcial**: La rama MANUAL funciona pero la ELECTRÓNICA depende de worker thread SIFEN que puede fallar silenciosamente
2. **Stock sin alertas automáticas**: reorder_alerts existe pero no hay scheduler que lo ejecute periódicamente
3. **Integración Taller→Facturación→Contabilidad**: Existe pero la contabilización automática de asientos al facturar es manual (requiere trigger explícito)
4. **Mobile App stub**: `src/modules/mobile/` tiene 0 services — solo schema y routes básicas
5. **CRM sync unidireccional**: Twenty CRM sync existe pero los leads del frontend no se sincronizan automáticamente

---

## 2. Matriz de Módulos

### 2.1 Módulos Frontend (30 páginas principales)

| # | Módulo | Líneas | Tabs/Views | Estado | Observaciones |
|---|--------|--------|------------|--------|---------------|
| 1 | **taller** | 174 | List + Cards | ✅ Completo | CRUD OT, filtros, stats. Sub-páginas: [id] (1030L), mecanicos (440L), predictive-ml (611L), asignacion (232L), flat-rate (361L), precios (531L) |
| 2 | **recepcion** | 645 | 4 steps wizard | ✅ Completo | Checklist visual paneles, neumáticos, combustible, accesorios, firma canvas digital, creación automática de OT |
| 3 | **inventario** | 126 | Dashboard + links | ✅ Completo | Sub-páginas: movimientos (382L), ordenes-compra (301L), herramientas (485L), almacenes (461L), tecdoc (355L) |
| 4 | **presupuestos** | 335 | List + Detail | ✅ Completo | CRUD, aprobación/rechazo, conversión a OT, alertas de desvío, progreso visual |
| 5 | **facturacion** | 203 | DataTable | ✅ Completo | Emisión manual+electrónica, estados, NewInvoiceDialog, exportación |
| 6 | **billing** | 179 | Plans + Subscriptions | ✅ Completo | Stripe plans, checkout, portal, invoices del SaaS |
| 7 | **contabilidad** | 313 | Hub + sub-pages | ✅ Completo | Sub-páginas: nota-credito (737L), integracion (709L), evolucion-patrimonio (403L), flujo-efectivo (381L), notas-financieras (299L) |
| 8 | **tesoreria** | 486 | 4 tabs (cuentas/movimientos/CxC/conciliación) | ✅ Completo | CRUD cuentas bancarias, movimientos, conciliación bancaria (Sprint 89.5) |
| 9 | **clientes** | 285 | DataTable | ✅ Completo | CRUD con NewClientDialog, stats, exportación |
| 10 | **vehiculos** | 254 | DataTable | ✅ Completo | CRUD con NewVehicleDialog, tipos motor (Nafta/Diesel/HEV/BEV) |
| 11 | **nomina** | 692 | 3 tabs (Resumen/Personal/Mensual) | ✅ Completo | Break-even, perfiles MTESS, comisiones, cálculo nómina (Sprint 89.5) |
| 12 | **ejecutivo** | 378 | KPI dashboard | ✅ Completo | Analytics del taller, trends, top mechanics |
| 13 | **analytics** | 399 | KPI + trends + distribution | ✅ Completo | KPI cards, trends OT, distribución, mechanic leaderboard |
| 14 | **calendario** | 115 | Week + Table | ⚠️ Funcional | WeekView + DataTable, NewAppointmentDialog. Falta: recordatorios automáticos |
| 15 | **crm** | 337 | Leads + Stats | ⚠️ Funcional | Leads CRUD, Twenty CRM sync, stats. Falta: pipeline visual Kanban |
| 16 | **flotas** | 271 | DataTable | ⚠️ Funcional | Fleet CRUD, contratos. Falta: gestión vehicular por flota |
| 17 | **servicios** | 702 | Catálogo CRUD | ✅ Completo | 17 categorías, CRUD completo con dialog modal, ThinkcarDTC link |
| 18 | **marketing** | 707 | 4 tabs (Campañas/Leads/Reviews/Loyalty) | ⚠️ Funcional | Campañas, leads, Google Reviews, loyalty points |
| 19 | **whatsapp** | 80 | Minimal | ⚠️ Stub | Solo 80 líneas — integración backend completa pero frontend mínimo |
| 20 | **dvi** | 516 | DVI inspections | ✅ Completo | Inspecciones DVI con items, score de salud |
| 21 | **thinkcar** | 503 | Dashboard + imports | ✅ Completo | Importaciones Thinkcar, health dashboard, stats |
| 22 | **enterprise** | 409 | SSO + 2FA + audit | ✅ Completo | SSO OIDC, 2FA TOTP, audit trail, data export |
| 23 | **config** | 168 | Settings hub | ⚠️ Funcional | Sucursales, configuración multi-branch |
| 24 | **usuarios** | 287 | DataTable | ✅ Completo | CRUD usuarios con roles |
| 25 | **seguridad** | 114 | Security hub | ⚠️ Funcional | Hardware fingerprint, tokens, USB |
| 26 | **security-hw** | 113 | HW status | ✅ Completo | Fingerprint, USB tokens |
| 27 | **backup** | 93 | Backup jobs | ✅ Completo | Backup engine, policies |
| 28 | **label-printing** | 111 | Templates | ✅ Completo | Templates de etiquetas |
| 29 | **finance** | 80 | Finance hub | ⚠️ Hub | Página de entrada con links a sub-módulos |
| 30 | **perfil** | 185 | Profile | ✅ Completo | Perfil de usuario |

### 2.2 Módulos Backend (23 módulos)

| # | Módulo | Total Líneas | Routes | Schemas | Services | Estado |
|---|--------|-------------|--------|---------|----------|--------|
| 1 | **finance** | 25,709 | 4,662 | 3,115 | 17,932 | ✅ Módulo más grande. Accounting (1821L), SIFEN (755L), Invoice (465L), Treasury (385L), Budget (221L), Payroll, Fiscal |
| 2 | **workshop** | 10,022 | 3,732 | 1,284 | 5,006 | ✅ Core operations. Ordenes, Ingresos, Flat-Rate, Service Pricing (605L), ML Predictive |
| 3 | **inventory** | 8,547 | 2,083 | 1,801 | 4,663 | ✅ Repuestos, Stock, Herramientas, Auto-PO, TecDoc, Batch, Tool Depreciation |
| 4 | **intelligence** | 2,823 | 915 | 100 | 1,808 | ✅ OCR, DTC, HV Safety, AI DTC Assistant, Vehicle Intelligence |
| 5 | **whatsapp** | 2,302 | 706 | 382 | 1,214 | ✅ Service, Queue, Templates, Followup |
| 6 | **thinkcar** | 2,142 | 406 | 74 | 1,662 | ✅ Bluetooth, USB, Parser, Pipeline, Health, Notifications |
| 7 | **enterprise** | 2,042 | 808 | 186 | 1,048 | ✅ SSO, 2FA, Audit, Data Export |
| 8 | **scheduling** | 1,634 | 422 | 174 | 1,038 | ✅ Agendamiento, Capacity Planning |
| 9 | **dvi** | 1,376 | 445 | 181 | 750 | ✅ DVI inspections, Photo storage |
| 10 | **billing** | 1,222 | 411 | 140 | 671 | ✅ Stripe service, Plans, Subscriptions |
| 11 | **crm** | 1,201 | 132 | 115 | 954 | ⚠️ Twenty CRM sync, but heavy service layer |
| 12 | **config** | 1,172 | 475 | 79 | 618 | ⚠️ Auth, Profiles, Sucursales, Multi-branch |
| 13 | **analytics** | 1,126 | 346 | 0 | 780 | ⚠️ No schema propio, consume de otros módulos |
| 14 | **backup** | 932 | 197 | 200 | 535 | ✅ Engine, Worker, Policies |
| 15 | **security-hw** | 854 | 213 | 140 | 501 | ✅ Hardware fingerprint, tokens |
| 16 | **email** | 840 | 439 | 48 | 353 | ✅ Resend service, templates |
| 17 | **label-printing** | 837 | 250 | 156 | 431 | ✅ Templates, service |
| 18 | **client-portal** | 828 | 245 | 0 | 583 | ⚠️ No schema propio, consume finance schemas |
| 19 | **api-keys** | 741 | 250 | 118 | 373 | ✅ API key management |
| 20 | **tenants** | 664 | 194 | 155 | 315 | ✅ Multi-tenancy, onboarding |
| 21 | **marketing** | 607 | 220 | 0 | 387 | ⚠️ No schema propio |
| 22 | **fleet** | 171 | 85 | 0 | 86 | ⚠️ Mínimo — solo routes básicas |
| 23 | **mobile** | 163 | 132 | 31 | 0 | ❌ Stub — 0 services |

---

## 3. Matriz de Integraciones entre Módulos

### 3.1 Integraciones Backend (importaciones cruzadas reales)

```
WORKSHOP ──imports──→ INVENTORY (ot-stock-consumer: previewStockConsumption, consumeStockOnOTClose)
WORKSHOP ──imports──→ FINANCE  (facturas, asientosContables, planCuentas)
WORKSHOP ──imports──→ SHARED   (clients, profiles, notificaciones)
WORKSHOP ──imports──→ EMAIL    (orderCompletedTemplate, smartSend)

INVENTORY ──imports──→ FINANCE  (asientosContables, planCuentas, profiles)
INVENTORY ──imports──→ SHARED   (db, schemas)

FINANCE   ──imports──→ WORKSHOP (ordenesTrabajo, ordenServicios, ordenRepuestos, mechanicProfiles)
FINANCE   ──imports──→ INVENTORY (repuestos, stockMovements, herramientas, toolInstances)
FINANCE   ──imports──→ SHARED   (clients, profiles, tenants, planCuentas)
FINANCE   ──imports──→ EMAIL    (smartSend, invoiceReadyTemplate, billing-email)

CRM       ──imports──→ (Twenty CRM sync, no dependencias directas de otros módulos)
ANALYTICS ──imports──→ (consume datos de workshop + finance, no dependencias directas)
```

### 3.2 Diagrama de Flujo Principal

```
                    ┌─────────────┐
                    │ RECEPCIÓN   │ ← Check-in vehicular (paneles, firma, checklist)
                    └──────┬──────┘
                           │ crea
                    ┌──────▼──────┐
              ┌─────│  INGRESO    │─────┐
              │     └──────┬──────┘     │
              │            │ opcional   │
              │     ┌──────▼──────┐     │
              │     │  PRESUPUESTO│─────┤
              │     │  (borrador) │     │
              │     └──────┬──────┘     │
              │            │ aprueba    │
              │     ┌──────▼──────┐     │
              │     │ ORDEN TRABAJO│     │
              │     │ (estados)   │     │
              │     └──┬───┬───┬──┘     │
              │        │   │   │        │
     ┌────────▼───┐    │   │   │  ┌────▼──────────┐
     │ INVENTARIO  │    │   │   │  │ TRABAJOS      │
     │ (consumo    │    │   │   │  │ TERCEROS      │
     │  stock OT)  │    │   │   │  └───────────────┘
     └─────────────┘    │   │   │
                   ┌────▼┐ ┌▼───▼──┐
                   │FLAT │ │MECÁNI-│
                   │RATE │ │COS    │
                   │(HH) │ │ASIG.  │
                   └─────┘ └───────┘
                        │
              ┌─────────▼─────────┐
              │  FACTURACIÓN      │
              │ (MANUAL/ELECTRON) │
              │  → SIFEN CDC      │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │  CONTABILIDAD     │
              │ (asientos auto)   │
              │  → RG90, Libros   │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │  TESORERÍA        │
              │ (CxC, bancos,     │
              │  conciliación)    │
              └───────────────────┘
```

---

## 4. Análisis de Procesos Clave

### 4.1 Recepción de Vehículos — ✅ 95% Automatizado

**Componentes existentes:**
- Frontend: Wizard de 4 pasos (`recepcion/page.tsx`, 645 líneas)
  - Step 1: Búsqueda de vehículo, kilometraje, combustible, descripción
  - Step 2: Checklist visual con 11 paneles (capot, paragolpes, puertas, techo, espejos), neumáticos, accesorios (gato, triángulos, extintor, etc.)
  - Step 3: Firma digital canvas del cliente
  - Step 4: Resumen con ID de ingreso y OT
- Backend: `workshop/routes/ingresos.ts` (221L) + `workshop/services/ingreso.service.ts`
- Schema: `ingresos.ts` (89L) + `ingreso-checklist.ts` (82L) con JSONB para panels, neumáticos, accesorios

**Flujo automatizado:**
1. POST `/workshop/ingresos` → crea ingreso + opcionalmente OT en estado "Presupuestado"
2. POST `/workshop/ingresos/:id/checklist` → guarda checklist completo con firma
3. Si `crearOrden=true`, la OT se crea automáticamente

**Falta:**
- ❌ **Fotos del vehículo**: El campo `kilometrajeFoto` existe como boolean pero no hay upload de fotos reales. Necesario: storage de fotos (Supabase Storage o S3) con preview en checklist
- ❌ **QR code en recepción**: No se genera QR para identificar el ingreso
- ❌ **Notificación WhatsApp automática**: La integración WhatsApp existe pero no se dispara al recepcionar

### 4.2 Tarifas y Horas Hombre — ✅ 85% Automatizado

**Componentes existentes:**
- Backend: `workshop/routes/service-pricing.routes.ts` (605L) — CRUD completo
- Schema: `service-pricing.ts` (148L) — tablas: `service_categories`, `service_pricing_rules`, `service_brand_map`, `rh_service_hours`
- Frontend: `taller/precios/page.tsx` (531L) + `servicios/page.tsx` (702L)
- Resolución: `GET /workshop/pricing-matrix` resuelve precio por servicio + tipo vehículo + combustible + intervalo km
- Flat-rate: `flat-rate.routes.ts` (132L) + `flat-rate.service.ts` (238L) — clock-in/clock-out, eficiencia por técnico, rentabilidad por bahía

**Dimensiones de pricing:**
- 17 categorías de servicio (Mecánica, Eléctrica, Electrónica, Chapa, Pintura, Suspensión, etc.)
- Tipos de vehículo (reference data)
- Tipos de combustible
- Intervalos de kilometraje
- Brand map (marcas compatibles por servicio)

**Falta:**
- ⚠️ **Precios MTESS escalafón**: Las categorías de mecánico (AYUDANTE/MEDIO_OFICIAL/OFICIAL/OFICIAL_CERTIFICADO) con sus salarios MTESS existen pero no se conectan automáticamente al cálculo de horas hombre
- ⚠️ **Rh_service_hours vacío probablemente**: La tabla existe pero puede no tener datos seed
- ❌ **Sugerencia automática de pricing al crear OT**: El pricing matrix resuelve pero no se pre-sugiere al abrir presupuesto

### 4.3 Trabajos Terceros — ✅ 80% Automatizado

**Componentes existentes:**
- Backend: `workshop/routes/trabajos-terceros.ts` (141L) — POST + GET por OT
- Service: `trabajo-tercero.service.ts`
- Schema: `trabajos-terceros.ts`
- Campos: proveedor, descripcion, costo, fechaInicio, fechaFin

**Falta:**
- ⚠️ **Sin status de跟踪**: No hay campo `estado` (PENDIENTE/EN_PROCESO/COMPLETADO). Solo fechas
- ⚠️ **Sin integración con CxC**: El costo de trabajo tercero no se refleja automáticamente en tesorería como cuentas por pagar
- ❌ **Sin lista de proveedores**: No hay catálogo de proveedores de servicios tercerizados
- ❌ **Sin adjuntos**: No se pueden adjuntar facturas de proveedores

### 4.4 Inventario — ✅ 75% Automatizado

**Componentes existentes:**
- **Repuestos**: CRUD completo (`repuestos.ts`, 413L) con código, código barras, marca, categoría, precios, stock min/max
- **Stock Movements**: Entrada/Salida/Ajuste/Transferencia (`stock-movements.ts`, 83L)
- **Herramientas**: CRUD + control de préstamos + depreciación (453L route + services)
- **Órdenes de Compra**: Schema `purchase-orders.ts` (147L) con lifecycle BORRADOR→RECIBIDA
- **Auto-PO**: Generación automática desde `reorder-alerts` (`auto-po.routes.ts`, 64L)
- **Batch Inventory**: Batch tracking (`batch-inventory.routes.ts`)
- **TecDoc**: Integración catálogo TecDoc (`tecdoc.routes.ts`)
- **Cálculo de costos**: `costing.service.ts`, `stock.service.ts` (684L)
- **OT Stock Consumer**: Consumo automático al cerrar OT (`ot-stock-consumer.ts`, 196L)

**Falta:**
- ⚠️ **Órdenes de Compra frontend**: Sub-página existe (301L) pero flujo OC puede estar incompleto
- ❌ **Transferencias entre almacenes**: Schema `almacenes.ts` existe, sub-página 461L, pero transferencias inter-almacén pueden no tener UI completa
- ❌ **Ajustes de stock con aprobación**: Solo ajuste directo sin flujo de aprobación multi-nivel
- ❌ **Reportes de inventario**: No hay generación de reportes PDF/Excel de inventario
- ❌ **Control de lotes/smartos**: Schema existe pero integración con UI puede estar parcial

### 4.5 Facturación — ✅ 80% Automatizado

**Componentes existentes:**
- Backend: `invoice.routes.ts` (465L) — Emisión dual MANUAL/ELECTRÓNICA
- SIFEN: `sifen.ts` (755L) — Firma XML, CDC, DNIT integration
- Portal: `client-portal/` — Pagos online vía Stripe/PagosPy
- Schema: `facturas.ts`, `factura-detalle.ts`, `fiscal-docs.ts`
- Frontend: `facturacion/page.tsx` (203L) + `finance/sifen/page.tsx` (675L) + `finance/pagos-online/page.tsx` (304L)

**Flujo:**
1. OT completada → Emitir Factura (POST `/finance/invoices/issue`)
2. Rama MANUAL: registra número pre-impreso, CDC=null
3. Rama ELECTRÓNICA: firma XML async → CDC → DNIT
4. Email automático al cliente con template
5. Asiento contable generado automáticamente

**Falta:**
- ⚠️ **Retenciones IVA**: Las rutas de fiscal (`fiscal.ts`, 338L) manejan cálculos pero la integración con facturación puede ser manual
- ⚠️ **Nota de crédito frontend**: Sub-página existe (737L) pero puede faltar conexión con facturación
- ❌ **Facturación recurrente para flotas**: No hay generación automática mensual para contratos de flotas

### 4.6 Órdenes de Trabajo — ✅ 90% Automatizado

**Componentes existentes:**
- Backend: `ordenes.ts` (264L) — CRUD completo + transiciones de estado
- Service: `orden.service.ts` (723L) — Lógica completa de negocio
- Sub-módulos:
  - `order-items.routes.ts` (326L) — Servicios + repuestos en OT
  - `flat-rate.routes.ts` (132L) — Time tracking
  - `mechanic-assignment.routes.ts` — Asignación de mecánicos
  - `trabajos-terceros.routes.ts` (141L) — Servicios subcontratados
  - `predictive-ml.routes.ts` + `predictive-maintenance.routes.ts` — ML predictivo
  - `analytics.routes.ts` (270L) — Analytics del taller
  - `service-pricing.routes.ts` (605L) — Pricing matrix
  - `client-portal.routes.ts` — Portal del cliente
  - `notification-sse.routes.ts` + `notification-push.routes.ts` — Notificaciones
  - `signature.routes.ts` — Firma de retiro
  - `bulk-operations.routes.ts` — Operaciones masivas
  - `notifications.routes.ts` — Notificaciones generales

- Frontend: `taller/page.tsx` (174L) + `taller/[id]/page.tsx` (1030L detail) + 5 sub-páginas

**Estados de OT:** presupuestado → aprobado → en_progreso → completado → facturado (+ cancelado)

**Falta:**
- ⚠️ **Tiempo real de estados**: Los webhooks/SSE existen pero la UI no los consume en tiempo real (usa polling)
- ⚠️ **Historial de cambios de estado**: Puede no estar persistiendo cada transición
- ❌ **Impresión de OT**: No hay generación de OT en formato PDF/imprimible

---

## 5. Priorización de Gaps

### Tier 1 — Impacto Alto, Bloquea Flujo Operativo

| # | Gap | Módulos Afectados | Esfuerzo | Dependencias |
|---|-----|-------------------|----------|--------------|
| **G-01** | **Fotos en recepción** — Upload y preview de fotos del vehículo | workshop, dvi, storage | Medio | Ninguna |
| **G-02** | **Historial de estados OT** — Log de cada transición con timestamp y usuario | workshop | Bajo | Ninguna |
| **G-03** | **QR en recepción** — Generar QR identificable para cada ingreso | workshop | Bajo | Ninguna |
| **G-04** | **Reportes de inventario** — PDF/Excel de stock, movimientos, valorización | inventory | Medio | Ninguna |
| **G-05** | **Seguimiento trabajos terceros** — Campo estado + notificaciones | workshop | Bajo | Ninguna |

### Tier 2 — Impacto Alto, Mejora Operativa Significativa

| # | Gap | Módulos Afectados | Esfuerzo | Dependencias |
|---|-----|-------------------|----------|--------------|
| **G-06** | **Conexión Pricing→Presupuesto** — Auto-sugerir precios al crear presupuesto | workshop, pricing | Medio | G-07 |
| **G-07** | **Seed rh_service_hours** — Poblar tabla de horas estándar por servicio×vehículo×complejidad | workshop | Bajo | Ninguna |
| **G-08** | **Notificación WhatsApp recepción** — Auto-enviar confirmación al recepcionar | whatsapp, workshop | Bajo | Ninguna |
| **G-09** | **Scheduler reorder-alerts** — Cron job periódico para generar auto-POs | inventory | Bajo | Ninguna |
| **G-10** | **Impresión de OT** — Generar PDF/impresión de órdenes de trabajo | workshop | Medio | Ninguna |
| **G-11** | **Ajustes stock con aprobación** — Flujo multi-nivel para ajustes grandes | inventory, finance | Medio | Ninguna |

### Tier 3 — Impacto Medio, Completa Funcionalidad

| # | Gap | Módulos Afectados | Esfuerzo | Dependencias |
|---|-----|-------------------|----------|--------------|
| **G-12** | **CRM pipeline visual** — Tablero Kanban de deals | crm | Medio | Ninguna |
| **G-13** | **Recordatorios calendario** — Notificaciones push/email antes de citas | scheduling, email | Medio | Ninguna |
| **G-14** | **Transferencias inter-almacen** — UI para mover stock entre almacenes | inventory | Bajo | Ninguna |
| **G-15** | **Facturación recurrente flotas** — Auto-facturar contratos mensuales | finance, fleet | Alto | G-16 |
| **G-16** | **Catálogo proveedores** — CRUD de proveedores de servicios terceros | workshop | Bajo | Ninguna |
| **G-17** | **Adjuntos en trabajos terceros** — Upload de facturas de proveedores | workshop, storage | Medio | G-16 |

### Tier 4 — Impacto Bajo, Nice-to-Have

| # | Gap | Módulos Afectados | Esfuerzo | Dependencias |
|---|-----|-------------------|----------|--------------|
| **G-18** | **Mobile App** — React Native completo | mobile | Alto | Ninguna |
| **G-19** | **Automatización marketing** — Secuencias de email/WhatsApp | marketing, email, whatsapp | Alto | Ninguna |
| **G-20** | **Dashboard financiero avanzado** — Flujos de efectivo en tiempo real | analytics, finance | Medio | Ninguna |

---

## 6. Especificaciones Técnicas — Gaps Prioritarios

### G-01: Fotos en Recepción

**Componente a desarrollar:**
- Frontend: Componente `PhotoCapture` en `recepcion/page.tsx` — cámara del dispositivo o upload
- Backend: Endpoint `POST /workshop/ingresos/:id/fotos` — recibe multipart/form-data
- Storage: Supabase Storage bucket `vehiculo-fotos` con path `{tenant}/{ingresoId}/{n}.jpg`

**Campos en schema (agregar a `ingreso_checklist`):**
```sql
ALTER TABLE ingreso_checklist ADD COLUMN fotos jsonb DEFAULT '[]'::jsonb;
-- Formato: [{ url: string, tipo: "EXTERIOR"|"INTERIOR"|"DAÑO", panel?: string }]
```

**Integraciones:**
- Workshop → Storage (upload/download)
- Workshop → Checklist (preview de fotos en step 2)
- DVI → Fotos (reutilizar en inspección DVI)

**Uso operativo:** Al recepcionar, el mecánico toma 4-6 fotos del estado del vehículo. Se almacenan y se asocian al ingreso. El checklist muestra thumbnails.

---

### G-02: Historial de Estados OT

**Componente a desarrollar:**
- Backend: Tabla `orden_estado_historial` + middleware en `updateOrdenStatus()`
- Frontend: Timeline de estados en `taller/[id]/page.tsx`

**Schema:**
```sql
CREATE TABLE orden_estado_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES ordenes_trabajo(id),
  estado_anterior TEXT,
  estado_nuevo TEXT NOT NULL,
  usuario_id UUID REFERENCES profiles(id),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Integraciones:**
- Workshop → Workshop (se registra automáticamente en cada cambio de estado)
- Workshop → Analytics (datos para métricas de tiempo por estado)

**Uso operativo:** Al cambiar estado de OT (vía API o UI), se registra automáticamente en el historial. La vista de detalle muestra timeline visual.

---

### G-06: Conexión Pricing→Presupuesto

**Componente a desarrollar:**
- Backend: Nuevo endpoint `GET /workshop/pricing-suggest?servicioId=X&vehicleId=Y`
- Frontend: En dialog de crear presupuesto, auto-completar precio y horas al seleccionar servicio + vehículo

**Lógica:**
```
1. Al abrir "Nuevo Ítem" en presupuesto:
   - Select de servicio (del catálogo)
   - Al seleccionar servicio + vehículo → GET /workshop/pricing-matrix
   - Auto-rellenar: precio, horas estimadas, complejidad
```

**Integraciones:**
- Workshop pricing → Presupuestos (resolución automática)
- Workshop pricing → Flat-rate (horas estimadas para time tracking)

---

### G-07: Seed rh_service_hours

**Datos seed para tablas de referencia:**

```sql
-- rh_service_hours: Horas estándar por servicio × tipo vehículo × complejidad
-- Ejemplo: "Cambio de balatas" × "Sedán" × "Baja" = 1.5 horas
-- Ejemplo: "Cambio de balatas" × "SUV" × "Media" = 2.0 horas

INSERT INTO rh_service_hours (servicio_id, vehicle_type_id, complejidad, horasEstimadas, horasMinimas, horasMaximas)
SELECT s.id, v.id, 'BAJA', 1.5, 1.0, 2.0
FROM servicios_catalogo s, vehicle_types v
WHERE s.codigo = 'FREN-001' AND v.nombre = 'SEDAN';
```

**Acción:** Crear script de seed con las 17 categorías × 4 tipos de vehículo × 3 niveles de complejidad = ~200 registros base.

---

### G-09: Scheduler Reorder-Alerts

**Componente a desarrollar:**
- Backend: Servicio `reorder-scheduler.service.ts` que ejecuta `generateAutoPOs()` periódicamente
- Configuración: Intervalo configurable por tenant (default: cada 6 horas)

**Implementación:**
```typescript
// En server startup o vía pg-cron
setInterval(async () => {
  const tenants = await listActiveTenants();
  for (const tenant of tenants) {
    await generateAutoPOs(tenant.slug);
  }
}, 6 * 60 * 60 * 1000); // Cada 6 horas
```

**Integraciones:**
- Inventory auto-po → Email (notificar POs generados)
- Inventory auto-po → WhatsApp (alerta stock crítico)

---

### G-10: Impresión de OT

**Componente a desarrollar:**
- Backend: `GET /workshop/ordenes/:id/print` → genera HTML/PDF
- Frontend: Botón "Imprimir" en `taller/[id]/page.tsx`

**Contenido del documento:**
- Header: Logo del taller, datos del cliente
- Datos vehículo: Marca, modelo, placa, VIN, kilometraje
- Trabajo solicitado (de la recepción)
- Lista de servicios y repuestos con precios
- Firma del cliente
- Términos y condiciones

**Integraciones:**
- Workshop → PDF generation (puppeteer-free, usar @react-pdf o HTML print)

---

### G-12: CRM Pipeline Visual

**Componente a desarrollar:**
- Frontend: Componente `KanbanBoard` en `crm/page.tsx`
- Columnas: Prospecto → Contactado → Presupuesto → Aprobado → Cerrado
- Drag & drop entre columnas

**Lógica:**
```
1. Cada lead tiene campo `etapa` (PROSPECTO/CONTACTADO/PRESUPUESTO/APROBADO/CERRADO)
2. Kanban muestra leads agrupados por etapa
3. Drag & drop actualiza etapa via PATCH /crm/leads/:id
4. Métricas: tasa de conversión entre etapas, tiempo promedio por etapa
```

**Integraciones:**
- CRM → Twenty CRM (sync bidireccional)
- CRM → WhatsApp (follow-up automático)
- CRM → Marketing (leads que no convirtieron → campaña re-engagement)

---

## 7. Mapa de Archivos Críticos por Gap

| Gap | Archivos a Modificar/Crear |
|-----|---------------------------|
| G-01 | `web/src/app/(dashboard)/dashboard/recepcion/page.tsx`, `src/modules/workshop/routes/ingresos.ts`, `src/shared/database/schema/ingreso-checklist.ts`, `src/modules/workshop/services/ingreso.service.ts` |
| G-02 | `src/modules/workshop/routes/ordenes.ts`, `src/modules/workshop/services/orden.service.ts`, `src/modules/workshop/schema/ordenes-trabajo.ts`, `web/src/app/(dashboard)/dashboard/taller/[id]/page.tsx` |
| G-03 | `web/src/app/(dashboard)/dashboard/recepcion/page.tsx`, `src/modules/workshop/routes/ingresos.ts` |
| G-04 | `src/modules/inventory/routes/repuestos.ts`, `src/modules/inventory/services/stock.service.ts`, `web/src/app/(dashboard)/dashboard/inventario/page.tsx` |
| G-05 | `src/modules/workshop/routes/trabajos-terceros.ts`, `src/modules/workshop/schema/trabajos-terceros.ts`, `src/modules/workshop/services/trabajo-tercero.service.ts` |
| G-06 | `src/modules/workshop/routes/service-pricing.routes.ts`, `web/src/app/(dashboard)/dashboard/taller/precios/page.tsx`, `web/src/app/(dashboard)/dashboard/presupuestos/page.tsx` |
| G-07 | Script de seed SQL + `src/modules/workshop/schema/service-pricing.ts` |
| G-08 | `src/modules/workshop/routes/ingresos.ts`, `src/modules/whatsapp/routes/whatsapp.routes.ts` |
| G-09 | `src/modules/inventory/services/auto-po.service.ts` + nuevo scheduler |
| G-10 | `src/modules/workshop/routes/ordenes.ts` (nuevo endpoint print), `web/src/app/(dashboard)/dashboard/taller/[id]/page.tsx` (botón imprimir) |
| G-11 | `src/modules/inventory/routes/stock-movements.ts`, `src/modules/inventory/services/stock.service.ts` |
| G-12 | `web/src/app/(dashboard)/dashboard/crm/page.tsx`, `src/modules/crm/routes/crm.routes.ts` |
| G-13 | `src/modules/scheduling/routes/scheduling.routes.ts`, `src/modules/scheduling/services/agendamiento.service.ts` |
| G-14 | `src/modules/inventory/routes/almacenes.ts`, `web/src/app/(dashboard)/dashboard/inventario/almacenes/page.tsx` |
| G-16 | `src/modules/workshop/routes/` (nuevo proveedores.routes.ts), `src/modules/workshop/schema/` (nuevo proveedores.ts) |

---

## 8. Recomendaciones de Ejecución

### Orden de Ejecución (por dependencias)

```
Fase 1 (Quick wins, 1-2 días):
  → G-02 (Historial estados OT)
  → G-05 (Seguimiento trabajos terceros)
  → G-07 (Seed rh_service_hours)
  → G-08 (WhatsApp recepción)
  → G-16 (Catálogo proveedores)

Fase 2 (Core improvements, 2-3 días):
  → G-01 (Fotos recepción)
  → G-03 (QR recepción)
  → G-06 (Pricing→Presupuesto)
  → G-09 (Scheduler reorder)

Fase 3 (Operational completeness, 3-5 días):
  → G-04 (Reportes inventario)
  → G-10 (Impresión OT)
  → G-11 (Ajustes stock con aprobación)
  → G-12 (CRM pipeline)
  → G-13 (Recordatorios calendario)
  → G-14 (Transferencias inter-almacen)

Fase 4 (Advanced features, 5+ días):
  → G-15 (Facturación recurrente flotas)
  → G-17 (Adjuntos trabajos terceros)
  → G-20 (Dashboard financiero avanzado)

Deferred:
  → G-18 (Mobile App) — Requiere proyecto dedicado
  → G-19 (Automatización marketing) — Requiere investigación de vendor
```

---

## 9. Conclusión

El sistema AutomotiveOS ERP está en un estado **muy avanzado** con **~85% de automatización global**. Los 30 módulos frontend y 23 backend cubren la totalidad del flujo operativo de un taller mecánico automotriz en Paraguay.

**Fortalezas principales:**
- Arquitectura limpia y modular (Fastify + TypeScript + Drizzle + PostgreSQL)
- Integración fiscal Paraguay completa (SIFEN, RG 90, DNIT)
- Checklist de recepción con firma digital (nivel enterprise)
- Pricing matrix multi-dimensional con flat-rate
- Consumo automático de stock al cerrar OT
- Accounting contabilidad completa con asientos automáticos
- ML predictivo para mantenimiento

**Áreas de mejora prioritarias:**
1. Completar la experiencia de recepción con fotos y QR
2. Automatizar la conexión pricing→presupuesto
3. Agregar scheduler para alertas de stock
4. Completar el seguimiento de trabajos de terceros
5. CRM con pipeline visual Kanban

**Esfuerzo total estimado:** ~25-35 días de desarrollo para cerrar todos los gaps Tier 1-3.
