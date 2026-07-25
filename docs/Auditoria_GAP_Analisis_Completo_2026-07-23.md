# Auditoría Integral de Brechas (GAP Analysis) — AutomotiveOS ERP

**Fecha:** 23 de julio de 2026
**Versión analizada:** Sprint 87 (Post-consolidación multi-tenant)
**Arquitectura:** Fastify 5 + TypeScript 6 · PostgreSQL (Neon/Supabase) · Next.js 14 · React Native Mobile
**Analista:** Buffy (Freebuff AI) — Auditoría basada en exploración directa del código fuente (24 módulos backend, 30+ páginas frontend Next.js, 50+ tests)

---

## Resumen Ejecutivo

| Indicador | Valor |
|:----------|:------|
| **Módulos backend** | 24 directorios en `src/modules/` |
| **Páginas frontend Next.js** | 30+ páginas en `web/src/app/` |
| **Pruebas disponibles** | 50+ archivos de test (unit, integration, E2E, security) |
| **Migraciones SQL** | 10 (0000–0010) + 1 nueva (0011 contingencia + tenant groups) |
| **Automatización actual** | ~70% del flujo operativo core |
| **Gaps P1 (bloqueantes)** | 5 |
| **Gaps P2 (alta prioridad)** | 8 |
| **Gaps P3 (mejora continua)** | 7 |

### Estado por Área Funcional

| Área | % | Estado | Observación |
|:-----|:-:|:-------|:------------|
| **Backend — Core ERP** | **95%** | ✅ Maduro | Workshop, Finance, Inventory completos con servicios modulares |
| **Backend — Fiscal Paraguay** | **100%** | ✅ Completo | SIFEN V150, RG 90, Formularios DNIT, Nota crédito, Contingencia |
| **Backend — Integraciones** | **85%** | ✅ Sólido | Thinkcar, WhatsApp, DVI, CRM, Email, Stripe, PagosPy |
| **Backend — Seguridad** | **90%** | ✅ Robusto | JWT, RBAC, 2FA, SSO OIDC, Audit trail SHA-256, RLS multi-tenant |
| **Frontend — Core Taller** | **75%** | ⚠️ Avanzado | Recepción ✅, OT detalle ✅, Servicios catalog ✅. Faltan: pricing matrix, herramientas |
| **Frontend — Finanzas** | **70%** | ⚠️ Bueno | Contabilidad completa ✅. Faltan: SIFEN dashboard, nota crédito operativa |
| **Frontend — Inventario** | **50%** | ⚠️ Parcial | Listado ✅, Almacenes ✅. Faltan: stock movements, purchase orders, herramientas |
| **Frontend — Portal Cliente** | **0%** | 🔴 Inexistente | Backend existe, **sin una sola página frontend** |
| **UX/UI General** | **60%** | ⚠️ | DataTables y formularios básicos OK, workflows detallados en desarrollo |

### Riesgos Operacionales Principales

1. **Sin portal cliente web** — Los clientes no pueden ver estado de sus vehículos, facturas ni agendar citas → llamadas innecesarias al taller.
2. **Sin frontend de stock/OC** — El operario no puede gestionar movimientos de inventario ni generar órdenes de compra → descontrol de inventario.
3. **Sin frontend SIFEN** — El operario no puede monitorear facturación electrónica, activar contingencia ni emitir notas de crédito → riesgo fiscal.
4. **Sin frontend de herramientas** — No hay control de préstamos, mantenimiento ni depreciación → pérdida de herramientas.
5. **Sin booking público** — Los clientes no pueden agendar citas online → pérdida de clientes frente a competidores.

---

## 1. Matriz de 24+ Módulos Backend

### Leyenda

| Símbolo | Significado |
|:-------:|:------------|
| ✅ | **Funcional** — Backend + Frontend completos, probados |
| ⚠️ | **Incompleto** — Backend funcional, frontend parcial o faltante |
| 🔴 | **Crítico** — Backend existe pero frontend ausente o workflow roto |
| ❌ | **Inexistente** — No hay backend ni frontend |
| 🆕 | **Nuevo** — Implementado recientemente, sin frontend aún |

### Módulos Core — Taller (Workshop)

| # | Módulo | Backend | Frontend | BD/Schema | Estado REAL | Gaps Reales (Verificados en Código) |
|:-:|:-------|:-------:|:--------:|:---------:|:-----------:|:------------------------------------|
| 1 | **Workshop — OT (Ordenes Trabajo)** | ✅ 3 servicios (`orden.service.ts`, list, get, create, updateStatus, convertPresupuestoToOT) | ✅ Página detalle con servicios, repuestos, terceros, tabs, cambio de estado, timeline | ✅ `ordenes_trabajo` | ✅ **COMPLETO** | Frontend tiene vista detalle completa con servicios/repuestos/tabs/status. Backend tiene lógica de HV lockout, consumo de stock, notificaciones email+WhatsApp |
| 2 | **Workshop — Clientes** | ✅ `clients.service.ts` | ✅ Listado + crear + editar | ✅ `clients` | ✅ | Sin historial de cliente en frontend (backend `getClientHistory` existe) |
| 3 | **Workshop — Vehículos** | ✅ `vehiculos.service.ts` | ✅ Listado + crear + editar | ✅ `vehiculos` | ✅ | Sin historial de vehículo en frontend (backend `getVehicleHistory` existe) |
| 4 | **Workshop — Ingresos (Check-in)** | ✅ 2 servicios (`ingreso.service.ts` CON checklist completo) | ✅ Página dedicada con 4 pasos: vehículo → checklist → firma → resumen | ✅ `ingresos`, `ingreso_checklist` | ✅ **COMPLETO** | Tiene formulario estructurado con panels (11 zonas), neumáticos, combustible (slider 0-1), accesorios (7 items), observaciones, y firma digital en canvas. **Mejor de lo documentado** |
| 5 | **Workshop — Catálogo Servicios** | ✅ `services-catalog.service.ts` CRUD completo | ✅ Página dedicada con filtros, stats, CRUD completo, categorías | ✅ `servicios_catalogo` (146 registros) | ✅ **COMPLETO** | Frontend tiene tabla, filtros por categoría, diálogo crear/editar, desactivación soft-delete |
| 6 | **Workshop — Service Pricing** | ✅ `service-pricing.service.ts` con matriz multi-dimensional | ❌ **No hay página frontend** | ✅ `service_pricing_rules` (270 reglas), `rh_service_hours`, `service_categories`, `vehicle_types`, `fuel_types`, `mileage_intervals` | 🔴 | Backend tiene resolución de precios por servicio + tipo vehículo + combustible + kilometraje. Sin frontend para gestionar ni visualizar la matriz de precios. |
| 7 | **Workshop — Mecánicos** | ✅ `mechanic-profiles.service.ts` | ❌ No hay página dedicada | ✅ `mechanic_profiles` | ⚠️ | Sin gestión frontend de perfiles de mecánico (habilidades, certificaciones, eficiencia) |
| 8 | **Workshop — Asignación Inteligente** 🆕 | ✅ `mechanic-assignment.service.ts` con scoring | ❌ **No hay página frontend** | ✅ (usa `mechanic_profiles` + OT history) | 🔴🆕 | Algoritmo implementado por eficiencia, carga y certificaciones. Sin UI para visualizar/asignar |
| 9 | **Workshop — Flat Rate** | ✅ `flat-rate.service.ts` | ❌ **No hay página frontend** | ✅ (usa órdenes + mechanic_profiles) | 🔴 | Backend tracking de tiempo real vs estimado por técnico y bahía. Sin frontend |
| 10 | **Workshop — Firmas Digitales** | ✅ `signature.service.ts` con tabla `digital_signatures` | ✅ Integrado en página de Recepción y OT detalle | ✅ `digital_signatures` | ✅ **COMPLETO** | Firma de recepción funcionando con canvas, firma de retiro en backend (falta UI en entrega) |
| 11 | **Workshop — Trabajos Terceros** | ✅ `trabajo-tercero.service.ts` | ✅ Integrado en OT detalle (tab) | ✅ `trabajos_terceros` | ✅ **COMPLETO** | Backend CRUD, frontend OT detalle tiene tab de terceros con lista |
| 12 | **Workshop — Notificaciones Push** | ✅ 2 servicios (`notification-push.service.ts`) | ⚠️ Campana de notificaciones | ✅ `notification_priorities` | ⚠️ | Sin panel de notificaciones completo en frontend |
| 13 | **Workshop — Predictive Maintenance** | ✅ `predictive.service.ts` | ❌ No hay página | ✅ (usa OT history + vehículos) | ⚠️ | Backend básico basado en reglas, sin frontend |
| 14 | **Workshop — Predictive ML** 🆕 | ✅ `predictive-ml.service.ts` | ❌ **No hay página** | ✅ (usa OT + vehículos + DTCs) | 🔴🆕 | Sin frontend para predicciones ML |

### Módulos de Inventario (Inventory)

| # | Módulo | Backend | Frontend | BD/Schema | Estado REAL | Gaps |
|:-:|:-------|:-------:|:--------:|:---------:|:-----------:|:-----|
| 15 | **Inventario — Repuestos** | ✅ 2 servicios (`stock.service.ts`) | ✅ Listado + stats + crear producto | ✅ `repuestos` (72 ítems seed) | ✅ | Sin edición detallada desde frontend |
| 16 | **Inventario — Multi-almacén** 🆕 | ✅ `almacen.service.ts` con transferencias | ✅ Página dedicada con CRUD | ✅ `almacenes`, `transferencias_almacen` | ✅ **COMPLETO** | Frontend tiene página de gestión de almacenes con tabla y formulario crear. **SIN frontend de transferencias entre almacenes** |
| 17 | **Inventario — Stock Movements** | ✅ `stock.service.ts` (list, entrada, salida, ajuste) | ❌ **No hay página** | ✅ `stock_movements` | 🔴 | API endpoints existen, frontend no tiene página para ver movimientos ni realizar entradas/salidas |
| 18 | **Inventario — Purchase Orders** | ✅ 2 servicios (`purchase-order.service.ts`, `auto-po.service.ts`) | ❌ **No hay página** | ✅ `purchase_orders`, `reorder_alerts` | 🔴 | API endpoints existen (list, create, update status). Sin frontend para gestionar OC |
| 19 | **Inventario — Herramientas** | ✅ 4 servicios (`herramientas.service.ts`, `tool-instance.service.ts`, `control-herramientas.service.ts`, `tool-maintenance.service.ts`) | ❌ **No hay página** | ✅ `herramientas`, `tool_instances`, `control_herramientas`, `tool_maintenance_events` | 🔴 | Backend completo con préstamos, mantenimiento programado, depreciación línea recta. Sin frontend |

### Módulos de Finanzas (Finance)

| # | Módulo | Backend | Frontend | BD/Schema | Estado REAL | Gaps |
|:-:|:-------|:-------:|:--------:|:---------:|:-----------:|:-----|
| 20 | **Finance — Facturación** | ✅ 2 servicios (`invoice.service.ts`) | ✅ Listado + crear | ✅ `facturas`, `factura_detalle` | ✅ | Sin detalle de factura con vista CDC SIFEN |
| 21 | **Finance — SIFEN Electrónico** | ✅ 6 servicios (xml, soap, db, nota-credito, contingencia, dashboard) | ❌ **No hay página dedicada** | ✅ `fiscal_documentos`, `sifen_sync_log` | 🔴 | Backend completo: emitir, firmar, enviar, consultar, anular, contingencia, nota crédito. Sin frontend |
| 22 | **Finance — Nota Crédito SIFEN** 🆕 | ✅ `nota-credito.service.ts` | ⚠️ Página existe (esqueleto) | ✅ (usa `fiscal_documentos`) | ⚠️🆕 | Página `contabilidad/nota-credito` existe pero sin funcionalidad operativa |
| 23 | **Finance — Pagos Online** 🆕 | ✅ `online-payment.service.ts` (Stripe + PagosPy) | ⚠️ Página existe (esqueleto) | ✅ (Stripe webhook) | ⚠️🆕 | Página `finance/pagos-online` existe pero sin funcionalidad completa |
| 24 | **Finance — Contabilidad** | ✅ **15 servicios** (ledger, 6 configuradores, libros, estados financieros, cierre, consolidación) | ✅ Balance, P&L, Flujo Efectivo, Patrimonio, Notas, Integración, IVA | ✅ `plan_cuentas` (102 cuentas seed), `asientos_contables` | ✅ **MÁS COMPLETO** | El módulo más maduro del sistema. Frontend completo con 6+ páginas |
| 25 | **Finance — Tesorería** | ✅ `treasury.service.ts` | ✅ Cuentas, movimientos, crear | ✅ `cuentas_bancarias` (9 seed), `movimientos_tesoreria` | ✅ | Sin conciliación bancaria frontend |
| 26 | **Finance — Presupuestos** | ✅ `budget.service.ts` | ✅ Página existe | ✅ `presupuestos` | ✅ | Frontend existe, pendiente revisar funcionalidad completa |

### Módulos de Comunicaciones y Servicio al Cliente

| # | Módulo | Backend | Frontend | BD/Schema | Estado REAL | Gaps |
|:-:|:-------|:-------:|:--------:|:---------:|:-----------:|:-----|
| 27 | **Scheduling (Agendamiento)** | ✅ 2 servicios (`agendamiento.service.ts`) | ✅ Calendario con citas | ✅ `agendamientos` (18 seed) | ✅ | Sin booking web público 24/7, sin sugerencia IA de horarios |
| 28 | **WhatsApp** | ✅ 4 servicios (send, templates, queue, evolution-api) | ✅ Página con mensajes y templates | ✅ `whatsapp_messages`, `templates` | ✅ **COMPLETO** | Templates, cola de mensajes, retry, webhooks |
| 29 | **CRM (Twenty)** | ✅ 2 servicios (sync, webhook) | ⚠️ Página existe | ✅ `crm_sync_log` | ⚠️ | Sin pipeline visual de oportunidades |

### Módulos Especializados

| # | Módulo | Backend | Frontend | BD/Schema | Estado REAL | Gaps |
|:-:|:-------|:-------:|:--------:|:---------:|:-----------:|:-----|
| 30 | **Thinkcar OBD2** | ✅ 8 servicios (ingesta USB/Email/BT, parseo PDF, smart linking, DTC lookup) | ⚠️ Página existe | ✅ `thinkcar_imports`, `dtc_database` | ⚠️ | Sin dashboard DTC en tiempo real (mobile usa mock data) |
| 31 | **DVI (Inspección Digital)** | ✅ 2 servicios (`dvi.service.ts`) con fotos, canvas markup, health score | ⚠️ Página DVI + crear | ✅ `dvi_inspections`, `dvi_photos`, `dvi_items` | ⚠️ | Sin comparación before/after, sin integración automática con OT |
| 32 | **Intelligence (AI/OCR)** | ✅ 7 servicios (AI DTC assistant, RAG manuales, OCR, diagnostic reports) | ❌ Sin página dedicada | ✅ `diagnostic_reports` | ⚠️ | Sin frontend para AI DTC assistant |

### Módulos Administrativos

| # | Módulo | Backend | Frontend | BD/Schema | Estado REAL | Gaps |
|:-:|:-------|:-------:|:--------:|:---------:|:-----------:|:-----|
| 33 | **Usuarios/Perfiles** | ✅ (vía módulo config) | ✅ Página usuarios | ✅ `profiles` (5 roles) | ✅ | Completo |
| 34 | **Billing (Stripe)** | ✅ 3 servicios (plans, subscriptions, invoices) | ⚠️ Página existe | ✅ `plans`, `subscriptions`, `billing_invoices` | ⚠️ | Sin portal de suscripción frontend completo |
| 35 | **Enterprise (Audit/2FA/SSO)** | ✅ 4 servicios (audit trail, 2FA TOTP, SSO OIDC, security) | ⚠️ Página enterprise existe | ✅ `audit_enterprise` | ⚠️ | Sin frontend para 2FA/SSO configuration |
| 36 | **Marketing** | ✅ 4 servicios (campaigns, reviews, loyalty, templates) | ⚠️ Página existe | ✅ `marketing_campaigns` (8 seed) | ⚠️ | Sin frontend completo para campañas, reviews, loyalty |
| 37 | **Flotas B2B** | ✅ `fleet.service.ts` | ⚠️ Página existe | ✅ `fleets` (1 seed) | ⚠️ | Sin frontend detallado para gestión de flotas |
| 38 | **Analytics** | ✅ 3 servicios (kpis, trends, reports) | ⚠️ Página analytics existe | ✅ (usa tablas existentes) | ⚠️ | Sin dashboard ejecutivo completo |
| 39 | **Seguridad HW (Kill-Switch)** | ✅ `security-hw.service.ts` (USB kill switch, hardware fingerprinting) | ⚠️ Página seguridad existe | ✅ `hardware_fingerprints`, `security_tokens` | ⚠️ | Sin frontend de monitoreo |

### Módulos Auxiliares

| # | Módulo | Backend | Frontend | BD/Schema | Estado REAL | Gaps |
|:-:|:-------|:-------:|:--------:|:---------:|:-----------:|:-----|
| 40 | **Config** | ✅ `config.service.ts` | ⚠️ Página existe | ✅ `tenant_config` | ⚠️ | Sin UI completa de configuración |
| 41 | **Backup/Restore** | ✅ 2 servicios (backup AES-256-GCM, restore, cron) | ⚠️ Página existe | ✅ `backup_policies` | ⚠️ | Sin programación de backups desde frontend |
| 42 | **Label Printing** | ✅ `label-printing.service.ts` (ZPL, QR) | ⚠️ Página existe | ✅ `label_templates` | ⚠️ | Sin diseñador de etiquetas frontend |
| 43 | **Client Portal** | ✅ 2 servicios (`portal-auth.service.ts`, `portal.service.ts`) | ❌ **SIN frontend web** | ✅ (API endpoints existen) | 🔴 | **GAP CRÍTICO**: Backend listo (magic link auth, GET OTs, facturas, vehículos), frontend web no existe |

---

## 2. Matriz de Integraciones

### Flujo Operativo Principal

```
Recepción (Ingreso) ──→ Presupuesto ──→ OT ──→ Factura ──→ Contabilidad ──→ Tesorería
     ↓                       ↓            ↓         ↓              ↓              ↓
  Checklist (paneles,      Catálogo    Servicios   SIFEN        Asiento        Pago
  combustible, firma)     Servicios    Repuestos  Electrónico   Automático
                           ↓            ↓
                        Pricing      Inventario
                        Matrix       (stock)

Cliente ←────────── Vehículo ←── WhatsApp/Email ←── CRM ←── Analytics
```

### Estado REAL de Conexiones (Verificado en Código)

| Conexión | Existe | Automatización | Evidencia en Código |
|:---------|:------:|:--------------|:--------------------|
| **Agendamiento → Ingreso → OT** | ✅ | ✅ Automático | `handshake scheduling->ingreso->OT` en `ingreso.service.ts` |
| **OT → Inventario (consumo stock)** | ✅ | ✅ Automático | `consumeStockOnOTClose()` en `orden.service.ts` al pasar a "Listo" |
| **OT → Contabilidad (reconocimiento ingreso)** | ✅ | ✅ Automático | `workshopConfigurator.onOTCompletada()` en `orden.service.ts` |
| **OT → Facturación** | ✅ | ⚠️ Semi-auto | Backend emite factura, frontend no integra el flujo completo desde OT |
| **Facturación → SIFEN** | ✅ | ✅ Automático | Build XML → Firmar X.509 → SOAP DNIT → CDC |
| **Facturación → Contabilidad** | ✅ | ✅ Automático | `sifenConfigurator` genera asiento automático |
| **Facturación → Tesorería (CxC)** | ✅ | ⚠️ Semi-auto | Registra pendiente, pago requiere acción manual |
| **Inventario → Contabilidad** | ✅ | ✅ Automático | `inventarioConfigurator` para entradas/salidas |
| **Nómina → Contabilidad** | ✅ | ✅ Automático | `nominaConfigurator` |
| **Compras → Contabilidad** | ✅ | ✅ Automático | `comprasConfigurator` |
| **Tesorería → Contabilidad** | ✅ | ✅ Automático | `tesoreriaConfigurator` |
| **OT → CRM** | ✅ | ✅ Automático | `POST /crm/sync/:ordenId` |
| **OT → WhatsApp** | ✅ | ✅ **Automático** | `notificarCambioEstadoOt()` en `orden.service.ts` — envía WhatsApp al cliente en estados clave (Aprobado, En_Proceso, Listo) |
| **OT → Email** | ✅ | ✅ **Automático** | `smartSend()` con `orderCompletedTemplate()` cuando OT pasa a "Listo" |
| **OT → Portal Cliente** | ✅ | ⚠️ Parcial | Portal muestra OTs, sin frontend web |
| **Presupuesto → OT** | ✅ | ✅ **Automático** | `convertPresupuestoToOT()` en `orden.service.ts` — convierte presupuesto aprobado a OT en estado "Aprobado" |
| **DVI → OT** | ✅ | ⚠️ Manual | DVI se crea asociado a OT, sin vinculación automática de hallazgos |
| **Scheduling → WhatsApp** | ✅ | ✅ Automático | Recordatorio 24h con respuesta interactiva |
| **Marketing → WhatsApp** | ✅ | ⚠️ Manual | Campañas pueden enviar por WhatsApp |
| **Consolidación Multi-tenant** 🆕 | ✅ | ⚠️ Manual | Backend implementado, sin frontend |

### Hallazgos Clave de Integración

1. **✅ El flujo OT → WhatsApp ya es AUTOMÁTICO** — `notificarCambioEstadoOt()` envía notificaciones push y WhatsApp en cambios de estado clave. La documentación anterior lo marcaba como manual, pero el código ya lo implementa.

2. **✅ El flujo OT → Email ya es AUTOMÁTICO** — `orderCompletedTemplate()` envía email cuando OT pasa a "Listo".

3. **✅ La conversión Presupuesto → OT ya existe** — `convertPresupuestoToOT()` está implementada en backend. Falta frontend para gatillar esta conversión.

4. **⚠️ OT → Facturación automática** — Backend puede emitir factura desde OT, pero el frontend no expone esta acción en la vista detalle de OT.

5. **❌ OT → Notificación WhatsApp en TODOS los cambios** — Actualmente solo para estados clave (Aprobado, En_Proceso, Listo). Podría notificar también Presupuestado y Control_Calidad.

### Conexiones Faltantes (Gaps de Integración)

| Conexión | Impacto | Prioridad | Solución |
|:---------|:--------|:---------:|:---------|
| **OT → Facturación (frontend)** | Operario no puede facturar desde OT | P1 | Botón "Emitir Factura" en vista detalle OT |
| **Presupuesto → OT (frontend)** | Operario no puede convertir presupuesto a OT con 1 clic | P1 | Botón "Convertir a OT" en presupuesto aprobado |
| **Inventario → OC Automática** | OC deben generarse al llegar a punto de reorden | P2 | Mejorar `auto-po.service.ts` para ejecución automática sin intervención |
| **CRM → Marketing** | Datos CRM deben alimentar segmentos | P2 | Sincronización automática de oportunidades a campañas |
| **Fleet → Facturación Recurrente** | Flotas B2B necesitan facturación mensual automática | P2 | Módulo de suscripción para flotas |
| **OT → Portal Cliente (web)** | Clientes no ven estado de su vehículo | P1 | Frontend web del portal cliente |

---

## 3. Análisis de Procesos Clave

### Proceso 1: Recepción de Vehículo — ✅ **AUTOMATIZADO**

| Paso | Automatización | Estado REAL | Detalle Verificado en Código |
|:-----|:--------------|:-----------:|:-----------------------------|
| 1.1 Llegada del cliente | ⚠️ Manual | Sin check-in digital público | No hay kiosko ni booking walk-in |
| 1.2 Identificación del cliente | ✅ Automático | Búsqueda por nombre/RUC/teléfono | `listClients` endpoint |
| 1.3 Identificación del vehículo | ✅ Automático | Búsqueda por placa/VIN, decode VIN | `listVehicles`, `decodeVin` endpoints |
| **1.4 Checklist de recepción** | **✅ AUTOMATIZADO** | **Frontend completo** | **Página `recepcion/page.tsx` con:** 11 paneles (capot a espejos) con 5 estados (BUENO, RAYADO, ABOLLADO, ROTO, ABOLLADO_RAYADO), neumáticos (5 posiciones), combustible (slider 0-1), 7 accesorios checkbox, observaciones. Todo enviado a `POST /ingresos/:id/checklist` |
| **1.5 Firma digital del cliente** | **✅ AUTOMATIZADO** | **Canvas signature pad** | Componente `SignaturePad` con lienzo canvas, captura touch/mouse, almacena base64 en `ingreso_checklist.firma_cliente` |
| 1.6 Asignación de mecánico | ✅ Automático | Algoritmo inteligente | `mechanic-assignment.service.ts` con scoring por eficiencia y carga |
| 1.7 Creación de OT | ✅ Automático | Opcional al crear ingreso | `crearOrden` flag en `createIngreso()` |

**✅ CORRECCIÓN A LA DOCUMENTACIÓN ANTERIOR:** El paso 1.4 (checklist) y 1.5 (firma) YA ESTÁN AUTOMATIZADOS en el frontend de Recepción. El sistema actual tiene un formulario de 4 pasos (vehículo → checklist → firma → resumen) completamente funcional.

### Proceso 2: Presupuesto y Diagnóstico — ⚠️ **PARCIALMENTE AUTOMATIZADO**

| Paso | Automatización | Estado REAL | Detalle |
|:-----|:--------------|:-----------:|:--------|
| 2.1 Lectura de DTCs | ✅ Automático | Thinkcar pipeline completo | USB/Email/BT ingestion + smart linking por VIN |
| 2.2 Interpretación de DTCs | ✅ Automático | AI DTC Assistant | GPT-4o-mini + RAG sobre manuales + diccionario OBD-II |
| 2.3 Inspección visual (DVI) | ✅ Automático | Fotos con canvas markup | DVI con fotos, health score, items dañados |
| **2.4 Cálculo de horas-hombre** | **🔴 No automatizado** | **GAP CRÍTICO** | `rh_service_hours` y `service_pricing_rules` existen con datos, pero NO están integrados en el flujo de creación de OT para calcular automáticamente MO |
| **2.5 Selección de servicios** | **⚠️ Manual en OT** | **GAP** | Catálogo existe (146 servicios), frontend OT detalle permite agregar servicios desde catálogo, pero **sin integración de precios automáticos desde `service_pricing_rules`** |
| 2.6 Cálculo de precios | ⚠️ Semi-auto | Backend `resolvePricing()` existe | Motor de pricing multi-dimensional, pero no conectado al frontend de OT |
| **2.7 Presupuesto → Aprobación** | **🔴 No automatizado** | **GAP** | No hay flujo de aprobación digital (WhatsApp/Portal/Email) desde frontend |
| **2.8 Presupuesto → OT** | **✅ Automatizado en backend** | **⚠️ Sin frontend** | `convertPresupuestoToOT()` existe en backend, pero no hay botón en frontend para gatillarlo |

### Proceso 3: Órdenes de Trabajo — ✅ **AUTOMATIZADO** (con mejoras pendientes)

| Paso | Automatización | Estado REAL | Detalle |
|:-----|:--------------|:-----------:|:--------|
| 3.1 Creación de OT | ✅ Automático | Desde ingreso o scheduling | `createOrden()` en `orden.service.ts` |
| **3.2 Asignación de servicios** | **✅ Automatizado** | **Frontend OK** | Vista detalle OT tiene tab de servicios con selector de catálogo, agregar/eliminar |
| **3.3 Asignación de repuestos** | **✅ Automatizado** | **Frontend OK** | Vista detalle OT tiene tab de repuestos con formulario para agregar nombre/precio/cantidad |
| **3.4 Trabajos terceros** | **✅ Automatizado** | **Frontend OK** | Vista detalle OT tiene tab de terceros |
| **3.5 Transición de estados** | **✅ Automatizado** | **Frontend OK** | Botón "Avanzar" + menú desplegable con 5 estados, validaciones (HV lockout al pasar a Listo) |
| **3.6 Control de calidad** | ⚠️ Parcial | Estado existe | Backend valida, frontend muestra badge pero sin checklist estandarizado |
| **3.7 Firma de retiro** | ⚠️ Parcial | **Frontend parcial** | Backend `guardarFirmaRetiro()` existe, frontend OT detalle tiene tab de Entrega (pendiente verificar funcionalidad) |
| **3.8 Notificación al cliente** | **✅ Automatizado** | **Email + WhatsApp** | `notificarCambioEstadoOt()` envía push + WhatsApp. `smartSend()` envía email al pasar a Listo |
| 3.9 Consumo de stock | ✅ Automático | Al cerrar OT | `consumeStockOnOTClose()` ejecuta salida de stock atómica |
| 3.10 Reconocimiento contable | ✅ Automático | Al cerrar OT | `workshopConfigurator.onOTCompletada()` genera asiento |

### Proceso 4: Facturación — ✅ **AUTOMATIZADO** (con gap de frontend SIFEN)

| Paso | Automatización | Estado REAL | Detalle |
|:-----|:--------------|:-----------:|:--------|
| 4.1 Emisión desde OT | ✅ Automático | Backend completo | `POST /finance/invoices/issue` |
| 4.2 Factura manual | ✅ Automático | Tipo "MANUAL" soportado | Backend genera asiento contable |
| 4.3 Factura electrónica SIFEN | ✅ Automático | Build XML → Firma → SOAP → CDC | 6 servicios backend completos |
| 4.4 Nota de crédito SIFEN 🆕 | ✅ Automático | Backend completo | Sin frontend operativo |
| 4.5 Pagos online 🆕 | ✅ Automático | Stripe + PagosPy | Sin frontend completo |
| 4.6 Registro de pago | ✅ Automático | Efectivo/transferencia/cheque | `payment.service.ts` |
| 4.7 Asiento contable | ✅ Automático | `sifenConfigurator` + `tesoreriaConfigurator` | Décadas comprobado |
| **4.8 Frontend SIFEN** | **🔴 GAP** | **Sin dashboard** | No hay página para monitorear estado DNIT, documentos pendientes, contingencia |

### Proceso 5: Inventario — ⚠️ **PARCIALMENTE AUTOMATIZADO**

| Paso | Automatización | Estado REAL | Detalle |
|:-----|:--------------|:-----------:|:--------|
| 5.1 Entrada de stock | ✅ Automático | PPP automático + asiento contable | Backend completo |
| 5.2 Salida de stock a OT | ✅ Automático | Atómico con guard | `consumeStockOnOTClose()` |
| 5.3 Alerta de reorden | ✅ Automático | Al cruzar punto de reorden | `reorder_alerts` |
| **5.4 Generación de OC** | **⚠️ Semi-auto** | **Sin frontend** | `auto-po.service.ts` existe pero no genera OC automáticamente; no hay frontend para OC |
| **5.5 Transferencia almacenes** | **⚠️ Sin frontend** | Backend existe | `almacen.service.ts` con `transferirStock()`, sin UI |
| **5.6 Toma de inventario físico** | **❌ No implementado** | No existe | No hay módulo de conteo cíclico |
| **5.7 Barcode scanning** | **⚠️ Mobile only** | Sin integración web | Mobile tiene cámara, web no |
| **5.8 Frontend movimientos stock** | **🔴 GAP** | Sin página | No hay UI para ver historial ni registrar movimientos manuales |

---

## 4. Priorización de Gaps

### 🔴 P1 — Críticos (Bloquean flujo operativo)

| # | Gap | Módulo | Impacto | Dependencias | Esfuerzo Est. | Prioridad Real |
|:-:|:----|:-------|:--------|:-------------|:--------------|:--------------:|
| **P1.1** | **Portal Cliente Web Frontend** | Client Portal | 🔴 Alto — clientes no tienen visibilidad | Backend `portal-auth.service.ts` y `portal.service.ts` existen | 5-7 días | **#1** |
| **P1.2** | **Frontend Stock Movements + Purchase Orders** | Inventory | 🔴 Alto — operario no gestiona stock | API endpoints ya existen, `auto-po.service.ts` existe | 4-5 días | **#2** |
| **P1.3** | **Frontend SIFEN (Dashboard + Contingencia + Nota Crédito)** | Finance SIFEN | 🔴 Alto — operario no monitorea facturación electrónica | Backend SIFEN completo (6 servicios) | 4-5 días | **#3** |
| **P1.4** | **Frontend Herramientas (Préstamos + Mantenimiento + Depreciación)** | Inventory | 🔴 Medio — pérdida de herramientas | 4 servicios backend completos | 3-4 días | **#4** |
| **P1.5** | **Frontend Service Pricing Matrix** | Workshop Pricing | 🔴 Medio — precios no automatizados en OT | `service-pricing.service.ts` con `resolvePricing()` | 3-4 días | **#5** |

### 🟠 P2 — Alta Prioridad

| # | Gap | Módulo | Impacto | Dependencias | Esfuerzo | Prioridad |
|:-:|:----|:-------|:--------|:-------------|:--------|:---------:|
| **P2.1** | Botón "Emitir Factura" en vista detalle OT | Workshop + Finance | Alto — agiliza facturación | Backend `POST /finance/invoices/issue` existe | 1-2 días | **#6** |
| **P2.2** | Botón "Convertir Presupuesto a OT" en frontend | Workshop + Finance | Alto — agiliza flujo | `convertPresupuestoToOT()` existe en backend | 1-2 días | **#7** |
| **P2.3** | Flat Rate Tracking Frontend | Workshop | Medio — medición eficiencia | `flat-rate.service.ts` existe | 2-3 días | **#8** |
| **P2.4** | Asignación Inteligente Frontend 🆕 | Workshop | Medio — ver asignación óptima | `mechanic-assignment.service.ts` existe | 2-3 días | **#9** |
| **P2.5** | Frontend Multi-almacén Transferencias 🆕 | Inventory | Medio — mover stock entre almacenes | `almacen.service.ts` con `transferirStock()` existe | 1-2 días | **#10** |
| **P2.6** | Booking Web Público 24/7 | Scheduling | Alto — capturar clientes nuevos | `agendamiento.service.ts` existe | 4-5 días | **#11** |
| **P2.7** | Dashboard Ejecutivo Unificado (KPI) | Analytics | Alto — dueño no ve panorama | `analytics service.ts` existe | 3-4 días | **#12** |
| **P2.8** | Frontend Predictive ML 🆕 | Workshop | Medio — mostrar predicciones | `predictive-ml.service.ts` existe | 2 días | **#13** |

### 🟡 P3 — Mejora Continua

| # | Gap | Módulo | Impacto | Esfuerzo | Prioridad |
|:-:|:----|:-------|:--------|:--------|:---------:|
| **P3.1** | Comparación Before/After DVI | DVI | Medio | 2 días | **#14** |
| **P3.2** | TecDoc Frontend (búsqueda partes por VIN) | Inventory | Medio | 2 días | **#15** |
| **P3.3** | AI DTC Assistant Frontend | Intelligence | Bajo | 2 días | **#16** |
| **P3.4** | Metabase Dashboard Frontend | Analytics | Medio | 2 días | **#17** |
| **P3.5** | Consolidación Multi-tenant Frontend 🆕 | Finance | Bajo | 3 días | **#18** |
| **P3.6** | Google Reviews + Loyalty Frontend | Marketing | Bajo | 2 días | **#19** |
| **P3.7** | Notificación WhatsApp estado "Presupuestado" | WhatsApp + Workshop | Bajo | 1 día | **#20** |

---

## 5. Especificaciones Técnicas — Gaps Prioritarios

### P1.1 — Portal Cliente Web Frontend

**Backend existente:**
- `src/modules/client-portal/services/portal-auth.service.ts` — Magic link + PIN authentication
- `src/modules/client-portal/services/portal.service.ts` — CRUD de datos de portal
- API endpoints ya registrados

**Componente a desarrollar:** Nueva sección en `web/src/app/` (ruta pública, no dashboard)

**Rutas frontend:**
```
/portal/login              — Login con email → magic link → PIN
/portal/dashboard          — Resumen: vehículos, OTs activas, facturas pendientes
/portal/vehiculos          — Lista de vehículos del cliente
/portal/vehiculos/:id      — Historial de servicio del vehículo
/portal/ordenes            — OTs activas e histórico
/portal/ordenes/:id        — Detalle de OT (servicios, repuestos, estado, timeline)
/portal/facturas           — Facturas emitidas
/portal/facturas/:id       — Detalle de factura + link de pago (Stripe)
/portal/agendar            — Agendar nueva cita (booking público)
/portal/perfil             — Datos del cliente
```

**API endpoints a consumir (ya existen):**
- `POST /client-portal/auth/request-magic-link` — solicitar magic link
- `POST /client-portal/auth/verify-pin` — verificar PIN
- `GET /client-portal/vehiculos` — vehículos del cliente
- `GET /client-portal/ordenes` — OTs del cliente
- `GET /client-portal/facturas` — facturas del cliente
- `POST /client-portal/agendar` — agendar cita

**Prioridad MVP:** Login → Dashboard → OTs → Facturas

---

### P1.2 — Frontend Stock Movements + Purchase Orders

**Backend existente:**
- `src/modules/inventory/services/stock.service.ts` — `listStockMovements()`, `createEntrada()`, `createSalida()`
- `src/modules/inventory/services/purchase-order.service.ts` — CRUD completo de órdenes de compra
- `src/modules/inventory/services/auto-po.service.ts` — generación automática por punto de reorden

**Nuevas páginas en `web/src/app/(dashboard)/dashboard/inventario/`:**

**Página: Movimientos de Stock (`/dashboard/inventario/movimientos`)**
```typescript
// Tabla con filtros por tipo, fecha, repuesto, almacén
interface StockMovementUI {
  fecha: string;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE" | "TRANSFERENCIA";
  repuesto: { id: string; nombre: string; codigo: string };
  cantidad: number;
  precioUnitario: number | null;
  stockResultante: number;
  ordenTrabajoId: string | null;
  almacen: { origen: string | null; destino: string | null };
  usuario: string;
  observaciones: string | null;
}
// Acciones:
// - Registrar entrada manual (form: repuesto, cantidad, precio, proveedor, almacén)
// - Registrar salida manual (form: repuesto, cantidad, motivo, OT opcional, almacén)
// - Exportar a CSV
```

**Página: Órdenes de Compra (`/dashboard/inventario/ordenes-compra`)**
```typescript
interface PurchaseOrderUI {
  id: string;
  proveedor: string;
  fechaCreacion: string;
  fechaRecepcion: string | null;
  items: Array<{ repuesto: string; cantidad: number; precioUnitario: number; subtotal: number }>;
  total: number;
  estado: "BORRADOR" | "ENVIADA" | "RECIBIDA_PARCIAL" | "COMPLETADA" | "ANULADA";
  alertaReorden: boolean;  // true si fue generada por punto de reorden
}
// Acciones:
// - Crear OC (seleccionar proveedor, agregar items del catálogo)
// - Crear OC desde alerta de reorden (pre-poblada con items críticos)
// - Editar OC en estado BORRADOR
// - Marcar como recibida (parcial o total) — actualiza stock automáticamente
// - Ver historial por proveedor
```

**API endpoints a consumir (ya existen):**
- `GET /inventory/stock-movements?limit=50&offset=0` — listar movimientos
- `POST /inventory/stock/entrada` — registrar entrada
- `POST /inventory/stock/salida` — registrar salida
- `GET /inventory/purchase-orders` — listar OC
- `POST /inventory/purchase-orders` — crear OC
- `PATCH /inventory/purchase-orders/:id` — actualizar estado OC

---

### P1.3 — Frontend SIFEN Dashboard

**Backend existente:**
- `src/modules/finance/services/sifen/sifen-xml.service.ts` — construcción XML
- `src/modules/finance/services/sifen/sifen-soap.service.ts` — comunicación SOAP DNIT
- `src/modules/finance/services/sifen/sifen-db.service.ts` — persistencia
- `src/modules/finance/services/sifen/contingencia.service.ts` — modo contingencia
- `src/modules/finance/services/sifen/nota-credito.service.ts` — nota crédito
- `src/modules/finance/services/sifen/sifen-dashboard.service.ts` — dashboard data

**Nueva página: SIFEN Dashboard (`/dashboard/finance/sifen`)**

```typescript
interface SifenDashboardUI {
  // Estado del servicio DNIT
  estadoDNIT: {
    status: "ONLINE" | "CONTINGENCIA" | "OFFLINE";
    ultimaPrueba: string;
    mensaje: string | null;
  };
  // Resumen del período
  resumen: {
    totalEmitidos: number;
    totalPendientes: number;
    totalRechazados: number;
    totalNotasCredito: number;
    montoTotal: number;
  };
  // Documentos recientes
  documentos: Array<{
    id: string;
    tipo: "FACTURA" | "NOTA_CREDITO" | "NOTA_DEBITO";
    numero: string;
    cdc: string | null;
    estado: "ENVIADO" | "APROBADO" | "RECHAZADO" | "CONTINGENCIA";
    total: number;
    fechaEmision: string;
    cliente: string;
    errores: string[];
  }>;
}
```

**Acciones desde frontend:**
- Ver dashboard con métricas en tiempo real
- Emitir factura electrónica desde OT seleccionada
- Emitir nota de crédito (seleccionar factura original, motivo, items)
- Activar/desactivar modo contingencia
- Ver log de sincronización SIFEN
- Reenviar documentos en contingencia
- Buscar documento por CDC

**API endpoints (ya existen):**
- `GET /finance/sifen/dashboard` — resumen
- `POST /finance/sifen/emitir` — emitir DTE
- `POST /finance/sifen/nota-credito` — emitir nota crédito
- `GET /finance/sifen/documentos?estado=X` — filtrar documentos
- `POST /finance/sifen/contingencia/guardar` — guardar en contingencia
- `POST /finance/sifen/contingencia/reenviar` — reenviar contingencia
- `GET /finance/sifen/contingencia/status` — estado del servicio DNIT

---

### P1.4 — Frontend Herramientas

**Backend existente (4 servicios):**
- `src/modules/inventory/services/herramientas.service.ts` — CRUD catálogo de herramientas
- `src/modules/inventory/services/tool-instance.service.ts` — instancias físicas individuales
- `src/modules/inventory/services/control-herramientas.service.ts` — préstamos a mecánicos
- `src/modules/inventory/services/tool-maintenance.service.ts` — mantenimiento programado y depreciación

**Nueva página: Gestión de Herramientas (`/dashboard/inventario/herramientas`)**

```typescript
interface HerramientaUI {
  // Catálogo
  catalogo: Array<{
    id: string;
    nombre: string;
    codigo: string;
    categoria: string;
    vidaUtilMeses: number;
    valorAdquisicion: number;
    depreciacionMensual: number;
  }>;
  // Instancias físicas
  instancias: Array<{
    id: string;
    herramientaId: string;
    codigoPatrimonial: string;
    estado: "DISPONIBLE" | "PRESTADO" | "EN_MANTENIMIENTO" | "BAJA";
    ubicacion: string;
  }>;
  // Préstamos activos
  prestamos: Array<{
    id: string;
    herramienta: string;
    mecanico: string;
    fechaPrestamo: string;
    fechaDevolucion: string | null;
    ordenTrabajoId: string | null;
  }>;
  // Mantenimientos programados
  mantenimientos: Array<{
    id: string;
    herramienta: string;
    tipo: "PREVENTIVO" | "CORRECTIVO" | "CALIBRACION";
    fechaProgramada: string;
    fechaRealizada: string | null;
    costo: number | null;
  }>;
}
```

**API endpoints (ya existen):**
- `GET /inventory/herramientas` — listar herramientas
- `POST /inventory/herramientas` — crear herramienta
- `GET /inventory/tool-instances` — listar instancias
- `POST /inventory/tool-instances/:id/lend` — prestar a mecánico
- `POST /inventory/tool-instances/:id/return` — devolver
- `GET /inventory/tool-maintenance` — mantenimientos programados
- `POST /inventory/tool-maintenance` — registrar mantenimiento

---

### P1.5 — Frontend Service Pricing Matrix

**Backend existente:**
- `src/modules/workshop/services/service-pricing.service.ts` — CRUD de reglas de precio + `resolvePricing()`
- Tablas: `service_categories`, `service_pricing_rules`, `vehicle_types`, `fuel_types`, `mileage_intervals`

**Nueva página: Matriz de Precios (`/dashboard/taller/precios`)**

```typescript
interface PricingMatrixUI {
  // Selector de servicio + tipo vehículo
  servicio: string;
  tipoVehiculo: string;     // AUTOMOVIL, SUV, PICK_UP, CAMIONETA, etc.
  tipoCombustible?: string; // NAFTA, DIESEL, ELECTRICO, HIBRIDO
  intervaloKm?: string;     // 0-10000, 10001-30000, etc.
  
  // Resultado
  precioVenta: number;      // ₲
  precioCosto: number;      // ₲ (opcional)
  iva: number;              // 10%
  tiempoEstimado: number;   // minutos
  complejidad: string;      // BAJA, NORMAL, ALTA, CRITICA
}
```

**Acciones:**
- Tabla de todas las reglas de precio (servicio × tipo vehículo)
- Crear/editar regla con formulario multi-campo
- Probar resolución: seleccionar servicio + vehículo + combustible → ver precio calculado
- Ver tiempo estándar (horas-hombre) por servicio
- **Integración crítica**: Cuando se agrega un servicio a una OT, llamar `resolvePricing()` para obtener precio automático según vehículo

**API endpoints (ya existen):**
- `GET /workshop/pricing-rules?servicioId=X&vehicleTypeId=Y` — consultar regla
- `POST /workshop/pricing-rules` — crear regla
- `PATCH /workshop/pricing-rules/:id` — actualizar regla
- `POST /workshop/pricing/resolve` — resolver precio (servicio + vehículo → precio)
- `GET /workshop/vehicle-types` — tipos de vehículo
- `GET /workshop/service-categories` — categorías de servicio

---

### Mejoras Rápidas (P2 — < 2 días cada una)

**P2.1 — Botón "Emitir Factura" en OT Detalle**
- Agregar botón en tab "Resumen" de `taller/[id]/page.tsx`
- Llamar `POST /finance/invoices/issue` con los datos de la OT
- Mostrar resultado: número de factura + CDC si electrónica

**P2.2 — Botón "Convertir Presupuesto a OT"**
- Agregar botón en página de presupuestos `presupuestos/page.tsx`
- Llamar `POST /workshop/ordenes/convert-from-presupuesto/:id`
- Redirigir a la nueva OT creada

**P2.5 — Frontend Transferencias entre Almacenes**
- Agregar diálogo "Nueva Transferencia" en `inventario/almacenes/page.tsx`
- Formulario: origen, destino, repuesto, cantidad
- Llamar `POST /inventory/transferencia`

---

## 6. Hoja de Ruta Sugerida

### Sprint 88 — Portal Cliente y Stock (7 días)
1. ✅ P1.1 — Portal Cliente Web MVP (login, dashboard, OTs, facturas)
2. ✅ P1.2 — Frontend Stock Movements (listado + entrada/salida manual)
3. ✅ P2.1 — Botón "Emitir Factura" en OT detalle
4. ✅ P2.2 — Botón "Convertir Presupuesto a OT"

### Sprint 89 — SIFEN y Herramientas (7 días)
1. ✅ P1.3 — Frontend SIFEN Dashboard (monitoreo + contingencia + nota crédito)
2. ✅ P1.4 — Frontend Herramientas (catálogo + instancias + préstamos + mantenimiento)
3. ✅ P2.5 — Frontend Transferencias entre Almacenes

### Sprint 90 — Pricing y Eficiencia (7 días)
1. ✅ P1.5 — Frontend Pricing Matrix (gestión de reglas + resolución automática en OT)
2. ✅ P2.3 — Flat Rate Tracking Frontend
3. ✅ P2.4 — Asignación Inteligente Frontend
4. ✅ P2.8 — Frontend Predictive ML

### Sprint 91 — Captación de Clientes y Visibilidad (7 días)
1. ✅ P2.6 — Booking Web Público 24/7
2. ✅ P2.7 — Dashboard Ejecutivo Unificado (KPI globales)
3. ✅ P3.1 — Comparación Before/After DVI
4. ✅ P3.2 — TecDoc Frontend

### Sprint 92 — Valor Agregado (5 días)
1. ✅ P3.3 — AI DTC Assistant Frontend
2. ✅ P3.4 — Metabase Dashboard Frontend
3. ✅ P3.6 — Google Reviews + Loyalty Frontend
4. ✅ P3.7 — Consolidación Multi-tenant Frontend

---

## 7. Correcciones a la Documentación Anterior

Durante la auditoría de código, se encontraron las siguientes discrepancias entre la documentación existente y el código real:

| Documentación Decía | Realidad en Código | Corrección |
|:--------------------|:--------------------|:-----------|
| "Sin checklist de recepción estructurado" | ✅ Frontend `recepcion/page.tsx` con 11 paneles, 5 estados, neumáticos, combustible slider, 7 accesorios, firma canvas | **YA ESTÁ IMPLEMENTADO** — documentación desactualizada |
| "Sin firma digital del cliente en recepción" | ✅ `SignaturePad` componente con canvas, almacena base64 en `ingreso_checklist` | **YA ESTÁ IMPLEMENTADO** |
| "Sin frontend OT detalle (servicios/repuestos/terceros)" | ✅ Página `taller/[id]/page.tsx` con 5 tabs, CRUD de servicios, repuestos, terceros, cambio de estado | **YA ESTÁ IMPLEMENTADO** |
| "Sin frontend para catálogo de servicios" | ✅ Página `servicios/page.tsx` con tabla, filtros, CRUD completo, 17 categorías | **YA ESTÁ IMPLEMENTADO** |
| "Sin notificación automática WhatsApp por cambio de estado OT" | ✅ `notificarCambioEstadoOt()` envía WhatsApp en Aprobado, En_Proceso, Listo | **YA ESTÁ IMPLEMENTADO** |
| "Sin email automático de factura al cliente" | ✅ `orderCompletedTemplate()` con `smartSend()` cuando OT pasa a Listo | **YA ESTÁ IMPLEMENTADO** |
| "Sin conversión Presupuesto → OT automática" | ✅ `convertPresupuestoToOT()` implementado en `orden.service.ts` | **YA ESTÁ IMPLEMENTADO (backend)** — falta frontend |
| "Sin frontend multi-almacén" | ✅ Página `inventario/almacenes/page.tsx` con CRUD completo de almacenes | **YA ESTÁ IMPLEMENTADO** — falta frontend de transferencias |

### Gaps Reales que SÍ Persisten (Verificados)

| Gap | Estado Real |
|:----|:-----------:|
| Frontend Client Portal Web | 🔴 **No existe** — backend listo, sin páginas |
| Frontend Stock Movements | 🔴 **No existe** |
| Frontend Purchase Orders | 🔴 **No existe** |
| Frontend SIFEN Dashboard | 🔴 **No existe** |
| Frontend Herramientas (préstamos/mantenimiento) | 🔴 **No existe** |
| Frontend Service Pricing Matrix | 🔴 **No existe** |
| Frontend Flat Rate Tracking | 🔴 **No existe** |
| Frontend Asignación Inteligente | 🔴 **No existe** |
| Frontend Predictive ML | 🔴 **No existe** |
| Booking Web Público | 🔴 **No existe** |
| Dashboard Ejecutivo KPI | ⚠️ Parcial — existe página pero incompleta |

---

## 8. Conclusión

### Estado Real del Sistema

| Área | % Real | Cambio vs Documentación |
|:-----|:------:|:------------------------|
| Backend — Core ERP | **95%** | ✅ Confirmado |
| Backend — Fiscal Paraguay | **100%** | ✅ Confirmado |
| Frontend — Recepción Vehículo | **100%** | ⬆️ **Sube de 0% a 100%** (estaba mal documentado como gap) |
| Frontend — OT Detalle | **90%** | ⬆️ **Sube de 0% a 90%** (estaba mal documentado como gap) |
| Frontend — Servicios Catálogo | **100%** | ⬆️ **Sube de 0% a 100%** |
| Frontend — Contabilidad | **95%** | ✅ Confirmado |
| Frontend — Portal Cliente | **0%** | ✅ Confirmado como gap real |
| Frontend — Stock/OC/Herramientas | **0%** | ✅ Confirmado como gap real |
| Frontend — SIFEN Dashboard | **0%** | ✅ Confirmado como gap real |

**Estimación total de cierre de gaps:** ~5 sprints (33 días hábiles)
**Impacto esperado:** Automatización pasa de ~75% a ~95% del flujo operativo core
**Costo relativo:** Mayoría son frontend consumiendo APIs ya existentes — bajo riesgo técnico

### Resumen para el Desarrollador

1. **El backend está listo.** De los 10 gaps prioritarios, **todos tienen backend completo**. Solo falta construir frontend.

2. **Prioridad #1: Portal Cliente.** Impacto más alto (clientes pueden ver estado de sus vehículos → menos llamadas → más satisfacción).

3. **Prioridad #2: Stock + OC + Herramientas.** El operario no puede gestionar inventario → riesgo operacional.

4. **Prioridad #3: SIFEN Dashboard.** Riesgo fiscal si no se monitorea facturación electrónica.

5. **Lo que ya funciona (no desarrollar):** Recepción con checklist, OT detalle, servicios catálogo, notificaciones WhatsApp/Email automáticas, conversión presupuesto→OT.
