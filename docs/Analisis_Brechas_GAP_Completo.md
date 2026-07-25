# Análisis de Brechas y Hoja de Ruta de Desarrollo — AutomotiveOS ERP

**Fecha:** 2026-07-22
**Versión analizada:** Sprint 86 (Post-consolidación multi-tenant)
**Arquitectura:** Fastify 5 + TypeScript 6 · PostgreSQL (Neon) · Next.js 14 · React Native Mobile
**Analista:** Buffy (Freebuff AI) — Basado en exploración directa del código fuente (1,406 tests, 30+ módulos backend, 30+ páginas frontend)

---

## Resumen Ejecutivo

| Indicador | Valor |
|:----------|:------|
| **Módulos backend funcionales** | 30+ (23 core + 7 auxiliares) |
| **Páginas frontend Next.js** | 30+ |
| **Pruebas pasando** | 1,406 backend + 43 unit frontend + 20 E2E Playwright |
| **Migraciones SQL** | 10 (0000–0010) + 0011 nueva (contingencia + tenant groups) |
| **Automatización actual** | ~70% del flujo operativo core |
| **Gaps P1 (bloqueantes)** | 7 |
| **Gaps P2 (alta prioridad)** | 9 |
| **Gaps P3 (mejora)** | 8 |

### Estado por Área

| Área | Porcentaje | Estado |
|:-----|:----------:|:-------|
| Backend — Core ERP | **95%** | ✅ Maduro (Workshop, Finance, Inventory) |
| Backend — Fiscal Paraguay | **100%** | ✅ SIFEN V150, RG 90, Formularios DNIT, Nota crédito |
| Backend — Integraciones | **85%** | ✅ Thinkcar, WhatsApp, DVI, CRM, Email, Stripe |
| Backend — Seguridad | **90%** | ✅ JWT, RBAC, 2FA, SSO, Audit trail SHA-256, RLS |
| Frontend — Core Taller | **60%** | ⚠️ Listados OK, faltan formularios detallados |
| Frontend — Finanzas | **65%** | ⚠️ Facturación/Contabilidad OK, faltan SIFEN/Presupuestos |
| Frontend — Inventario | **50%** | ⚠️ Listado OK, faltan movimientos/OC/herramientas |
| Mobile | **30%** | 🔴 MVP esqueleto, pantallas básicas conectadas |
| Portal Cliente | **40%** | ⚠️ Backend OK, frontend web/mobile incompleto |
| UX/UI General | **55%** | ⚠️ DataTables funcionales, faltan workflows completos |

---

## Matriz de 28 Módulos

### Leyenda
| Símbolo | Significado |
|:-------:|:------------|
| ✅ | **Funcional** — Backend + Frontend completos, probados |
| ⚠️ | **Incompleto** — Backend funcional, frontend parcial o faltante |
| 🔴 | **Crítico** — Backend existe pero frontend ausente o workflow roto |
| ❌ | **Inexistente** — No hay backend ni frontend |
| 🆕 | **Nuevo** — Implementado en Sprint 84-86, sin frontend aún |

### Módulos Core (14)

| # | Módulo | Backend | Frontend | BD/Schema | API Client | Estado | Gaps |
|:-:|:-------|:-------:|:--------:|:---------:|:----------:|:------:|:-----|
| 1 | **Workshop — OT** | ✅ 3 servicios | ⚠️ Listado + dialogo crear/editar | ✅ ordenes_trabajo | ✅ `listWorkOrders`, `createWorkOrder`, `updateWorkOrderStatus` | ⚠️ | Sin vista detalle completa (servicios, repuestos, DVI, cronología), sin cambio de estado desde frontend, sin firma digital |
| 2 | **Workshop — Clientes** | ✅ 1 servicio | ✅ Listado + crear | ✅ clients | ✅ `listClients`, `createClient`, `updateClient` | ✅ | Sin historial de cliente (backend existe: `getClientHistory`) |
| 3 | **Workshop — Vehículos** | ✅ 1 servicio | ✅ Listado + crear | ✅ vehiculos | ✅ `listVehicles`, `createVehicle`, `decodeVin` | ✅ | Sin historial de vehículo (backend existe: `getVehicleHistory`) |
| 4 | **Workshop — Ingresos (Check-in)** | ✅ 2 servicios | ⚠️ No hay página dedicada | ✅ ingresos | ✅ `listIngresos`, `createIngreso` | 🔴 | Sin formulario estructurado de recepción en frontend (rayones, combustible, accesorios, fotos) |
| 5 | **Workshop — Catálogo Servicios** | ✅ 1 servicio | ❌ No hay página | ✅ servicios_catalogo (146 registros) | ❌ No en api.ts | 🔴 | Sin CRUD frontend para catálogo de servicios |
| 6 | **Workshop — Service Pricing** | ✅ 1 servicio | ❌ No hay página | ✅ service_pricing_rules (270 reglas), rh_service_hours | ❌ No en api.ts | 🔴 | Sin frontend para matriz de precios ni horas-hombre estándar |
| 7 | **Workshop — Mecánicos** | ✅ (vía finance/mechanic-profiles) | ❌ No hay página dedicada | ✅ mechanic_profiles | ❌ No en api.ts | ⚠️ | Sin gestión frontend de perfiles de mecánico |
| 8 | **Workshop — Asignación Inteligente** 🆕 | ✅ 1 servicio | ❌ No hay página | ✅ (usa mechanic_profiles + OT history) | ❌ No en api.ts | 🔴🆕 | Sin frontend para visualizar/asignar mecánicos |
| 9 | **Workshop — Flat Rate** | ✅ 1 servicio | ❌ No hay página | ✅ (usa órdenes + mechanic_profiles) | ❌ No en api.ts | 🔴 | Sin frontend para tracking de tiempo real vs estimado |
| 10 | **Workshop — Firmas Digitales** | ✅ 1 servicio | ❌ No hay página | ✅ (datos en OT) | ❌ No en api.ts | 🔴 | Sin captura de firma en frontend |
| 11 | **Workshop — Trabajos Terceros** | ✅ 1 servicio | ❌ No hay página | ✅ trabajos_terceros | ❌ No en api.ts | 🔴 | Sin frontend para gestionar servicios subcontratados |
| 12 | **Workshop — Notificaciones Push** | ✅ 2 servicios | ⚠️ Campana de notificaciones | ✅ notification_priorities | ✅ `listNotifications` | ⚠️ | Sin panel de notificaciones completo |
| 13 | **Workshop — Predictive Maintenance** | ✅ 1 servicio | ❌ No hay página | ✅ (usa OT history + vehículos) | ❌ No en api.ts | ⚠️ | Backend básico basado en reglas, sin frontend |
| 14 | **Workshop — Predictive ML** 🆕 | ✅ 1 servicio | ❌ No hay página | ✅ (usa OT + vehículos + DTCs) | ❌ No en api.ts | 🔴🆕 | Sin frontend para predicciones ML |

### Módulos de Inventario (5)

| # | Módulo | Backend | Frontend | BD/Schema | API Client | Estado | Gaps |
|:-:|:-------|:-------:|:--------:|:---------:|:----------:|:------:|:-----|
| 15 | **Inventario — Repuestos** | ✅ 2 servicios | ✅ Listado + crear | ✅ repuestos (72 ítems) | ✅ `listInventory`, `createInventoryItem` | ✅ | Sin edición detallada desde frontend |
| 16 | **Inventario — Multi-almacén** 🆕 | ✅ 1 servicio | ⚠️ Página almacenes existe | ✅ almacenes, transferencias_almacen | ❌ No en api.ts | 🔴🆕 | Sin frontend para transferencias ni gestión de almacenes |
| 17 | **Inventario — Stock Movements** | ✅ 1 servicio | ❌ No hay página | ✅ stock_movements | ✅ `stockEntrada`, `stockSalida`, `listStockMovements` | 🔴 | Sin frontend para ver movimientos de stock ni realizar entradas/salidas |
| 18 | **Inventario — Purchase Orders** | ✅ 2 servicios | ❌ No hay página | ✅ purchase_orders, reorder_alerts | ❌ No en api.ts | 🔴 | Sin frontend para generar/ver órdenes de compra |
| 19 | **Inventario — Herramientas** | ✅ 4 servicios | ❌ No hay página | ✅ herramientas, tool_instances, control_herramientas, tool_maintenance_events | ✅ `listHerramientas`, `createHerramienta`, `listToolInstances`, `lendTool`, `returnTool` | 🔴 | Sin frontend para gestión de herramientas (préstamos, mantenimiento, depreciación) |

### Módulos de Finanzas (6)

| # | Módulo | Backend | Frontend | BD/Schema | API Client | Estado | Gaps |
|:-:|:-------|:-------:|:--------:|:---------:|:----------:|:------:|:-----|
| 20 | **Finance — Facturación** | ✅ 2 servicios | ✅ Listado + crear | ✅ facturas, factura_detalle | ✅ `listInvoices`, `issueInvoice` | ✅ | Sin detalle de factura, sin vista SIFEN CDC |
| 21 | **Finance — SIFEN Electrónico** | ✅ 6 servicios | ❌ No hay página dedicada | ✅ fiscal_documentos, sifen_sync_log | ❌ No en api.ts | 🔴 | Sin frontend para monitoreo SIFEN, sin contingencia frontend |
| 22 | **Finance — Nota Crédito SIFEN** 🆕 | ✅ 1 servicio | ⚠️ Página nota-credito existe | ✅ (usa fiscal_documentos) | ❌ No en api.ts | 🔴🆕 | Sin frontend operativo para emitir nota de crédito |
| 23 | **Finance — Pagos Online** 🆕 | ✅ 1 servicio | ⚠️ Página pagos-online existe | ✅ (usa Stripe) | ❌ No en api.ts | 🔴🆕 | Sin frontend para generar links de pago |
| 24 | **Finance — Contabilidad** | ✅ 15 servicios | ✅ Balance, P&L, Flujo, Patrimonio, Notas, Integración | ✅ plan_cuentas (102), asientos_contables | ✅ `listCuentasContables`, `listAsientos`, `getBalanceGeneral`, `getEstadoResultados` | ✅ | Más completa del sistema |
| 25 | **Finance — Tesorería** | ✅ 1 servicio | ✅ Cuentas, movimientos | ✅ cuentas_bancarias (9), movimientos_tesoreria (3) | ✅ `listBankAccounts`, `listMovements`, `createMovement` | ✅ | Sin conciliación bancaria frontend |

### Módulos de Servicio al Cliente y Comunicaciones (4)

| # | Módulo | Backend | Frontend | BD/Schema | API Client | Estado | Gaps |
|:-:|:-------|:-------:|:--------:|:---------:|:----------:|:------:|:-----|
| 26 | **Scheduling (Agendamiento)** | ✅ 2 servicios | ✅ Calendario con citas | ✅ agendamientos (18) | ✅ `listAppointments`, `createAppointment` | ✅ | Sin booking web público 24/7, sin sugerencia IA de horarios |
| 27 | **WhatsApp** | ✅ 4 servicios | ✅ Página con mensajes y templates | ✅ whatsapp_messages, templates | ✅ `listWhatsAppMessages`, `sendWhatsAppMessage` | ✅ | Completo |
| 28 | **CRM (Twenty)** | ✅ 2 servicios | ⚠️ Página CRM existe | ✅ crm_sync_log | ✅ `syncCrm`, `getCrmStatus` | ⚠️ | Sin pipeline visual de oportunidades |

### Módulos Especializados (3)

| # | Módulo | Backend | Frontend | BD/Schema | API Client | Estado | Gaps |
|:-:|:-------|:-------:|:--------:|:---------:|:----------:|:------:|:-----|
| 29 | **Thinkcar OBD2** | ✅ 8 servicios | ⚠️ Página thinkcar existe | ✅ thinkcar_imports | ✅ `listThinkcarImports`, `lookupDtc` | ⚠️ | Sin dashboard DTC en tiempo real (mobile usa mock) |
| 30 | **DVI (Inspección Digital)** | ✅ 2 servicios | ⚠️ Página DVI + crear | ✅ dvi_inspections, dvi_photos, dvi_items | ✅ `listDVInspections`, `createDVIInspection` | ⚠️ | Sin fotos before/after comparación, sin integración con OT |
| 31 | **Intelligence (AI/OCR)** | ✅ 7 servicios | ❌ Sin página dedicada | ✅ diagnostic_reports | ❌ No en api.ts | ⚠️ | Sin frontend para AI DTC assistant, sin OCR en recepción |

### Módulos Administrativos (7)

| # | Módulo | Backend | Frontend | BD/Schema | API Client | Estado | Gaps |
|:-:|:-------|:-------:|:--------:|:---------:|:----------:|:------:|:-----|
| 32 | **Usuarios/Perfiles** | ✅ (vía config) | ✅ Página usuarios | ✅ profiles (5) | ✅ `listUsers`, `createUser` | ✅ | Completo |
| 33 | **Billing (Stripe)** | ✅ 3 servicios | ⚠️ Página billing existe | ✅ plans, subscriptions, invoices | ❌ No en api.ts | ⚠️ | Sin portal de suscripción frontend completo |
| 34 | **Enterprise (Audit/2FA/SSO)** | ✅ 4 servicios | ⚠️ Página enterprise existe | ✅ audit_enterprise | ✅ `listAuditLog` | ⚠️ | Sin frontend para 2FA/SSO |
| 35 | **Marketing** | ✅ 4 servicios | ⚠️ Página marketing existe | ✅ marketing_campaigns (8) | ✅ `listCampaigns`, `createCampaign` | ⚠️ | Sin frontend para campañas, reviews, loyalty |
| 36 | **Flotas B2B** | ✅ 1 servicio | ⚠️ Página flotas existe | ✅ fleets (1) | ✅ `listFleets`, `createFleet` | ⚠️ | Sin frontend detallado para gestión de flotas |
| 37 | **Analytics** | ✅ 3 servicios | ⚠️ Página analytics existe | ✅ (usa tablas existentes) | ✅ `getAnalyticsKpis`, `getAnalyticsTrends` | ⚠️ | Sin dashboard ejecutivo completo |
| 38 | **Seguridad (HW Kill-Switch)** | ✅ 1 servicio | ⚠️ Página seguridad existe | ✅ hardware_fingerprints, security_tokens | ✅ `getSecurityHWStatus` | ⚠️ | Sin frontend de monitoreo |

### Módulos Auxiliares (4)

| # | Módulo | Backend | Frontend | BD/Schema | API Client | Estado | Gaps |
|:-:|:-------|:-------:|:--------:|:---------:|:----------:|:------:|:-----|
| 39 | **Config** | ✅ 1 servicio | ⚠️ Página config existe | ✅ tenant_config | ✅ `getConfigSettings`, `updateConfigSettings` | ⚠️ | Sin UI completa de configuración |
| 40 | **Backup/Restore** | ✅ 2 servicios | ⚠️ Página backup existe | ✅ backup_policies | ✅ `listBackups`, `executeBackup` | ⚠️ | Sin programación de backups desde frontend |
| 41 | **Label Printing** | ✅ 1 servicio | ⚠️ Página label-printing existe | ✅ label_templates | ✅ `generateLabel` | ⚠️ | Sin diseñador de etiquetas frontend |
| 42 | **Client Portal** | ✅ 2 servicios | ❌ Sin frontend web | ✅ (API exists) | ❌ No en api.ts | 🔴 | Sin portal web para clientes (ver OTs, facturas, agendar) |

---

## Matriz de Integraciones

### Flujo Operativo Principal

```
Recepción (Ingreso) ──→ DVI ──→ Presupuesto ──→ OT ──→ Factura ──→ Contabilidad ──→ Tesorería
     ↓                    ↓           ↓            ↓         ↓              ↓              ↓
  Cliente ←────────── Vehículo ←── Catálogo ── Inventario ─ SIFEN ──── Asiento Auto ──── Pago
                           ↓          ↓                          ↓
                      Historial   Órdenes Compra             Libros Fiscales
```

### Estado de Conexiones

| Conexión | Existe | Automatización | Detalle |
|:---------|:------:|:--------------|:--------|
| **Agendamiento → Ingreso → OT** | ✅ | ✅ Automático | Check-in hereda diagnóstico, crea cliente+vehículo+OT |
| **OT → Inventario (consumo stock)** | ✅ | ✅ Automático | `consumeStockOnOTClose()` al pasar OT a "Listo" |
| **OT → Contabilidad (reconocimiento ingreso)** | ✅ | ✅ Automático | `workshopConfigurator.onOTCompletada()` genera asiento |
| **OT → Facturación** | ✅ | ⚠️ Manual | Backend emite factura, frontend no integra el flujo completo |
| **Facturación → SIFEN** | ✅ | ✅ Automático | Build XML → Firmar → SOAP DNIT → CDC |
| **Facturación → Contabilidad** | ✅ | ✅ Automático | `sifenConfigurator` genera asiento |
| **Facturación → Tesorería (CxC)** | ✅ | ⚠️ Semi-auto | Registra pendiente, pago requiere acción manual |
| **Inventario → Contabilidad** | ✅ | ✅ Automático | `inventarioConfigurator` para entradas/salidas |
| **Nómina → Contabilidad** | ✅ | ✅ Automático | `nominaConfigurator` |
| **Compras → Contabilidad** | ✅ | ✅ Automático | `comprasConfigurator` |
| **Tesorería → Contabilidad** | ✅ | ✅ Automático | `tesoreriaConfigurator` |
| **OT → CRM** | ✅ | ✅ Automático | `POST /crm/sync/:ordenId` |
| **OT → WhatsApp** | ✅ | ⚠️ Manual | Template messages, sin automatización por cambio de estado |
| **OT → Portal Cliente** | ✅ | ⚠️ Manual | Portal muestra OTs, sin notificación automática |
| **DVI → OT** | ✅ | ⚠️ Manual | DVI se crea asociado a OT, sin vinculación automática |
| **Thinkcar → OT** | ✅ | ⚠️ Semi-auto | Smart linking por VIN, requiere revisión manual |
| **Presupuesto → OT** | ✅ | ⚠️ Manual | Presupuesto existe como entidad separada, sin conversión automática a OT |
| **Scheduling → WhatsApp** | ✅ | ✅ Automático | Recordatorio 24h con respuesta interactiva |
| **Marketing → WhatsApp** | ✅ | ⚠️ Manual | Campañas pueden enviar por WhatsApp, sin automatización |
| **Fleet → OT** | ✅ | ⚠️ Manual | Flota B2B vinculada a OT, sin facturación automática |
| **Consolidación Multi-tenant** 🆕 | ✅ | ⚠️ Manual | Backend implementado, sin frontend ni automatización |

### Conexiones Faltantes (Gaps de Integración)

| Conexión | Impacto | Prioridad | Solución |
|:---------|:--------|:---------:|:---------|
| **OT → Notificación email/WhatsApp automática** | Clientes no saben avance de su vehículo | P1 | Webhook por cambio de estado OT que dispara notificación |
| **DVI → Presupuesto automático** | El diagnóstico DVI debería generar items de presupuesto | P1 | Mapping de hallazgos DVI a servicios del catálogo |
| **Presupuesto → OT automático** | Presupuesto aprobado debe crear OT automáticamente | P1 | Evento al aprobar presupuesto que genera OT |
| **OT → Facturación automática** | OT completada debe generar factura automáticamente | P1 | Al pasar OT a "Listo", generar factura pendiente de confirmación |
| **Inventario → Proveedores (OC automática)** | OC deberían generarse automáticamente al llegar al punto de reorden | P2 | Mejorar `auto-po.service.ts` para ejecución automática |
| **CRM → Marketing** | Datos CRM deberían alimentar segmentos de marketing | P2 | Sincronización de clientes/oportunidades a campañas |
| **Fleet → Facturación recurrente** | Flotas B2B deberían tener facturación automática mensual | P2 | Módulo de suscripción recurrente para flotas |

---

## Análisis de Procesos Clave

### Proceso 1: Recepción de Vehículo

| Paso | Automatización | Estado | Detalle |
|:-----|:--------------|:-------|:--------|
| 1.1 | Llegada del cliente | ⚠️ Manual | Solo por agendamiento (calendarizado) o walk-in. Sin check-in digital público |
| 1.2 | Identificación del cliente | ✅ Automático | Búsqueda por nombre/RUC/teléfono en BD |
| 1.3 | Identificación del vehículo | ✅ Automático | Búsqueda por placa/VIN, decode VIN (NHTSA + CarQuery) |
| 1.4 | **Checklist de recepción** | **🔴 Manual** | `CreateIngresoRequest` solo tiene km, combustible, exterior, observaciones. **Sin checklist estructurado con:** abolladuras por panel (capot, puertas, maletero, paragolpes), rayones, estado de neumáticos, accesorios (gato, triángulos, extintor, radio), fotos de ingreso |
| 1.5 | **Firma digital del cliente** | **🔴 No existe** | No hay captura de conformidad del cliente al recibir el vehículo |
| 1.6 | Asignación de mecánico | ✅ Automático | Algoritmo inteligente (Sprint 84-85) basado en eficiencia, carga y certificaciones |
| 1.7 | Creación de OT | ✅ Automático | Handshake scheduling→ingreso→OT |

**GAP CRÍTICO:** El paso 1.4 (checklist) y 1.5 (firma) no están automatizados. Esto expone al taller a disputas por daños preexistentes.

### Proceso 2: Presupuesto y Diagnóstico

| Paso | Automatización | Estado | Detalle |
|:-----|:--------------|:-------|:--------|
| 2.1 | **Lectura de DTCs (códigos de falla)** | ✅ Automático | Thinkcar pipeline (USB/Email/BT) + Smart linking por VIN |
| 2.2 | **Interpretación de DTCs** | ✅ Automático | AI DTC Assistant (GPT-4o-mini + RAG sobre manuales) + diccionario OBD-II |
| 2.3 | **Inspección visual (DVI)** | ✅ Automático | Fotos con canvas markup, health score, ítems dañados |
| 2.4 | **Cálculo de horas-hombre** | **🔴 Manual** | `rh_service_hours` tiene datos pero **no está integrado con la creación de OT/presupuesto** para calcular automáticamente el costo de MO |
| 2.5 | **Selección de servicios del catálogo** | ⚠️ Manual | Catálogo existe (146 servicios) pero no hay UI para seleccionar en OT/presupuesto |
| 2.6 | **Cálculo de precio de servicios** | ⚠️ Semi-auto | `service_pricing_rules` (270 reglas) aplican precios por tipo vehículo, pero no están integrados en el flujo de presupuesto |
| 2.7 | **Presupuesto → Aprobación cliente** | ⚠️ Manual | Backend de presupuestos existe pero no hay flujo de aprobación digital (WhatsApp/Portal) |
| 2.8 | **Presupuesto aprobado → OT** | **🔴 Manual** | No hay transición automática. Usuario debe crear OT manualmente |

**GAPS:** Pasos 2.4, 2.7, 2.8 no automatizados. El cálculo de costos es manual, lo que lleva a presupuestos inconsistentes.

### Proceso 3: Órdenes de Trabajo

| Paso | Automatización | Estado | Detalle |
|:-----|:--------------|:-------|:--------|
| 3.1 | Creación de OT | ✅ Automático | Desde ingreso o scheduling |
| 3.2 | **Asignación de servicios por item** | ⚠️ Manual | Endpoint `POST /workshop/ordenes/:id/servicios` existe, sin frontend |
| 3.3 | **Asignación de repuestos por item** | ⚠️ Manual | Endpoint `POST /workshop/ordenes/:id/repuestos` existe, sin frontend |
| 3.4 | **Trabajos terceros** | ⚠️ Manual | Endpoint existe, sin frontend |
| 3.5 | Transición de estados (5 estados) | ⚠️ Manual | Frontend solo muestra listado, sin botones de cambio de estado |
| 3.6 | **Control de calidad** | ⚠️ Manual | Estado "Control_Calidad" existe, sin checklist estandarizado |
| 3.7 | **Firma de conformidad al retirar** | **🔴 No existe** | No hay captura de firma digital del cliente al retirar el vehículo |
| 3.8 | **Notificación al cliente** | ✅ Automático | Email enviado al pasar a "Listo" (orderCompletedTemplate) |
| 3.9 | Consumo automático de stock | ✅ Automático | `consumeStockOnOTClose()` ejecuta salida de stock |
| 3.10 | Reconocimiento contable de ingresos | ✅ Automático | `workshopConfigurator.onOTCompletada()` genera asiento |

**GAPS CRÍTICOS:** Pasos 3.2, 3.3, 3.4, 3.5, 3.6, 3.7 sin frontend. El operario no puede gestionar la OT desde el frontend.

### Proceso 4: Facturación

| Paso | Automatización | Estado | Detalle |
|:-----|:--------------|:-------|:--------|
| 4.1 | Emisión de factura desde OT | ✅ Automático | Backend: `POST /finance/invoices/issue` |
| 4.2 | Factura manual (papel) | ✅ Automático | Tipo "MANUAL" |
| 4.3 | Factura electrónica (SIFEN) | ✅ Automático | Build XML → Firmar X.509 → SOAP DNIT → CDC |
| 4.4 | **Nota de crédito SIFEN** 🆕 | ✅ Automático | Backend completo, sin frontend |
| 4.5 | **Pagos online** 🆕 | ✅ Automático | Stripe + PagosPy, sin frontend |
| 4.6 | Registro de pago (efectivo/transferencia) | ✅ Automático | `POST /finance/payments/register` |
| 4.7 | Generación de asiento contable | ✅ Automático | `sifenConfigurator` + `tesoreriaConfigurator` |
| 4.8 | **Email de factura al cliente** | **🔴 No implementado** | Backend de email existe, pero no está conectado al flujo de facturación |

**GAPS:** Paso 4.8 no implementado. El cliente no recibe su factura por email automáticamente.

### Proceso 5: Inventario

| Paso | Automatización | Estado | Detalle |
|:-----|:--------------|:-------|:--------|
| 5.1 | Entrada de stock (compra) | ✅ Automático | PPP automático + asiento contable |
| 5.2 | **Salida de stock a OT** | ✅ Automático | Atómico con guard WHERE stock >= cantidad |
| 5.3 | **Alerta de reorden** | ✅ Automático | Al cruzar punto de reorden |
| 5.4 | **Generación de OC** | ⚠️ Semi-auto | Backend `auto-po.service.ts` existe, **no genera OC automáticamente** al llegar al punto de reorden |
| 5.5 | **Transferencia entre almacenes** 🆕 | ⚠️ Semi-auto | Backend existe, sin frontend |
| 5.6 | **Toma de inventario físico** | **❌ No implementado** | No hay módulo de conteo cíclico con ajuste automático |
| 5.7 | **Barcode/QR scanning** | ⚠️ Existe en mobile | Sin integración en frontend web |
| 5.8 | **TecDoc (búsqueda por VIN)** | ⚠️ Backend existe | Sin frontend para buscar repuestos por VIN |

**GAPS:** Pasos 5.4, 5.5, 5.6, 5.7, 5.8 sin automatización completa.

---

## Priorización de Gaps

### 🔴 P1 — Críticos (Bloquean flujo operativo)

| # | Gap | Módulo | Impacto | Dependencias | Esfuerzo |
|:-:|:----|:-------|:--------|:-------------|:---------|
| **P1.1** | **Checklist de recepción estructurado** (rayones, combustible, accesorios, fotos + firma) | Workshop Ingresos | Medio — disputas con clientes por daños preexistentes | Migración BD (nueva tabla/columnas), DVI | 2-3 días |
| **P1.2** | **Flujo OT completo en frontend** (servicios/repuestos/terceros items, cambio estado, firma retiro) | Workshop OT | Alto — operario no puede gestionar OT | API client endpoints ya existen | 5-7 días |
| **P1.3** | **Presupuesto → Aprobación → OT automático** | Finance Presupuestos + Workshop | Alto — flujo manual causa pérdida de presupuestos | Backend presupuestos existe, falta lógica de aprobación | 3-5 días |
| **P1.4** | **Notificación automatizada al cliente** (email factura, WhatsApp estado OT) | Finance + Email + WhatsApp | Alto — clientes no reciben comunicación | Email service existe, falta conectar con eventos OT/factura | 2-3 días |
| **P1.5** | **Portal cliente web frontend** | Client Portal | Alto — clientes no pueden ver estado de sus vehículos | Backend portal existe, sin frontend | 5-7 días |
| **P1.6** | **Frontend stock movements + purchase orders** | Inventory | Medio — operario no puede gestionar stock | API client existe parcialmente | 4-5 días |
| **P1.7** | **Frontend SIFEN (monitoreo + contingencia + nota crédito)** | Finance SIFEN | Medio — operario no puede operar facturación electrónica | Backend SIFEN completo, API client falta | 4-5 días |

### 🟠 P2 — Alta Prioridad

| # | Gap | Módulo | Impacto | Esfuerzo |
|:-:|:----|:-------|:--------|:---------|
| **P2.1** | Catálogo servicios + pricing frontend | Workshop | Medio — operario no gestiona precios | 3-4 días |
| **P2.2** | Frontend herramientas (préstamos, mantenimiento, depreciación) | Inventory | Medio | 3-4 días |
| **P2.3** | Flat rate tracking frontend | Workshop | Medio | 2-3 días |
| **P2.4** | Asignación inteligente frontend 🆕 | Workshop | Medio | 2-3 días |
| **P2.5** | Predictive ML frontend 🆕 | Workshop | Bajo | 2 días |
| **P2.6** | Multi-almacén frontend (transferencias) 🆕 | Inventory | Medio | 2-3 días |
| **P2.7** | Pagos online frontend 🆕 | Finance | Medio | 2 días |
| **P2.8** | Booking web público 24/7 | Scheduling | Alto — competidores tienen | 4-5 días |
| **P2.9** | Dashboard ejecutivo unificado (KPI globales) | Analytics | Alto — dueño no ve panorama completo | 3-4 días |

### 🟡 P3 — Mejora Continua

| # | Gap | Módulo | Impacto | Esfuerzo |
|:-:|:----|:-------|:--------|:---------|
| **P3.1** | Email automático de factura al cliente al emitir | Finance + Email | Medio | 1 día |
| **P3.2** | Notificación WhatsApp al cambiar estado OT | Workshop + WhatsApp | Medio | 2 días |
| **P3.3** | Comparación before/after en DVI | DVI | Medio | 2 días |
| **P3.4** | TecDoc frontend (búsqueda partes por VIN) | Inventory | Medio | 2 días |
| **P3.5** | AI DTC Assistant frontend | Intelligence | Bajo | 2 días |
| **P3.6** | Metabase dashboard frontend | Analytics | Medio | 2 días |
| **P3.7** | Consolidación multi-tenant frontend 🆕 | Finance | Bajo (solo dueños multi-taller) | 3 días |
| **P3.8** | Google Reviews + Loyalty frontend | Marketing | Bajo | 2 días |

---

## Especificaciones Técnicas — Gaps Prioritarios

### P1.1 — Checklist de Recepción Estructurado

**Componente:** `src/modules/workshop/services/ingreso.service.ts` + nueva tabla o columnas + frontend

**Campos requeridos (nuevos en `CreateIngresoRequest`):**

```typescript
interface ChecklistRecepcion {
  // Estado exterior por panel
  panels: {
    capot: PanelState;           // BUENO, RAYADO, ABOLLADO, ROTO
    paragolpesDel: PanelState;
    paragolpesTras: PanelState;
    puertaDelIzq: PanelState;
    puertaDelDer: PanelState;
    puertaTrasIzq: PanelState;
    puertaTrasDer: PanelState;
    maletero: PanelState;
    techo: PanelState;
    espejoIzq: PanelState;
    espejoDer: PanelState;
  };
  // Neumáticos
  neumaticos: {
    delIzq: string;              // Presión y condición
    delDer: string;
    trasIzq: string;
    trasDer: string;
    repuesto: string;
  };
  // Combustible exacto (fracción)
  nivelCombustible: number;      // 0.0 - 1.0 (0=empty, 1=full)
  kilometrajeFoto: boolean;      // Si se tomó foto del tablero
  // Accesorios
  accesorios: {
    gato: boolean;
    triangulos: boolean;
    extintor: boolean;
    ruedaRepuesto: boolean;
    herramientas: boolean;
    manual: boolean;
    radioCodigo: string | null;
    otros: string[];
  };
}
```

**Lógica de negocio:**
- Al crear ingreso, si `checklist` está presente, guardar en tabla `ingreso_checklist` (nueva)
- El checklist debe ser firmado digitalmente por el cliente (captura de firma)
- Si no se completa el checklist, mostrar advertencia pero permitir continuar
- Las fotos se asocian al ingreso (reutilizar sistema de fotos de DVI)

**Integración:**
- Módulo DVI — reutilizar `photo-storage.service.ts` para fotos
- Módulo Workshop — firmas digitales (`signature.service.ts`)
- Nuevo frontend: formulario de recepción paso a paso

**Migración BD:**
```sql
CREATE TABLE ingreso_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingreso_id UUID NOT NULL REFERENCES ingresos(id) ON DELETE CASCADE,
  checklist_data JSONB NOT NULL,
  firma_cliente TEXT,        -- Base64 de la firma
  cliente_conforme BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### P1.2 — Flujo OT Completo en Frontend

**Componente:** `web/src/app/(dashboard)/dashboard/taller/` — páginas existentes a expandir

**Vista detalle de OT (nueva página o modal):**

```typescript
interface WorkOrderDetailPage {
  // Cabecera
  header: {
    id: string;
    cliente: { nombre, telefono, email };
    vehiculo: { marca, modelo, placa, vin, año, km };
    estado: EstadoOrden;
    fechas: { creada, ultimoCambio, estimadaEntrega };
  };
  // Timeline de estados
  timeline: TimelineEntry[];
  // Servicios asignados (con precios)
  servicios: OrdenServicio[];
  // Repuestos asignados (con costos)
  repuestos: OrdenRepuesto[];
  // Trabajos terceros
  trabajosTerceros: TrabajoTercero[];
  // DTCs / Diagnóstico
  dtcs: DtcEntry[];
  // DVI asociado
  dvi: DVIInspection | null;
  // Control de calidad
  calidad: QualityCheck | null;
  // Firma de retiro
  firmaRetiro: string | null;
  // Factura asociada
  factura: Factura | null;
  // Costos totales
  totales: { servicios, repuestos, terceros, total };
}
```

**Acciones desde frontend:**
- Agregar/quitar servicios del catálogo (con precio automático de `service_pricing_rules`)
- Agregar/quitar repuestos (con stock actual y precio)
- Cambiar estado (con validaciones: HV Lockout → firmar, Control_Calidad → checklist)
- Firmar lockout HV
- Firmar retiro del cliente
- Ver diagnóstico DTC + DVI
- Emitir factura desde OT
- Ver timeline de cambios

**API endpoints a consumir (ya existen en backend):**
- `GET /workshop/ordenes/:id` — detalle OT
- `POST /workshop/ordenes/:id/servicios` — agregar servicio
- `DELETE /workshop/ordenes/:id/servicios/:itemId` — quitar servicio
- `POST /workshop/ordenes/:id/repuestos` — agregar repuesto
- `DELETE /workshop/ordenes/:id/repuestos/:itemId` — quitar repuesto
- `PATCH /workshop/ordenes/:id` — cambiar estado
- `POST /workshop/ordenes/:id/sign-lockout` — firmar HV
- `POST /workshop/ordenes/:id/trabajos-terceros` — agregar trabajo tercero
- `GET /dvi?ordenTrabajoId=:id` — DVI asociado

---

### P1.3 — Presupuesto → Aprobación → OT Automático

**Componente:** `src/modules/workshop/services/orden.service.ts` + `src/modules/finance/services/budget/budget.service.ts`

**Flujo:**

```
Presupuesto (borrador) 
  → Enviar a cliente (WhatsApp/Email con link de aprobación)
  → Cliente aprueba (via portal / WhatsApp / presencial)
  → Sistema crea OT automáticamente con:
      - Mismos servicios del presupuesto
      - Mismos repuestos del presupuesto
      - Precios congelados al momento de aprobación
      - Estado inicial: "Aprobado" (salta Presupuestado)
  → Notificación al taller: "Nueva OT lista para trabajar"
```

**Campos nuevos en `presupuestos`:**

```typescript
interface PresupuestoExtended {
  // ... campos existentes ...
  estado: "BORRADOR" | "ENVIADO" | "APROBADO" | "RECHAZADO" | "CONVERTIDO_A_OT";
  clienteId: string;
  vehicleId: string;
  items: PresupuestoItem[];
  totalEstimado: number;
  fechaEnvio: Date | null;
  fechaAprobacion: Date | null;
  ordenTrabajoId: string | null;  // OT generada al aprobarse
  metodoAprobacion: "PORTAL" | "WHATSAPP" | "PRESENCIAL" | null;
}
```

**Integración:**
- WhatsApp: enviar presupuesto como template de mensaje con botones "Aprobar/Rechazar"
- Portal cliente: mostrar presupuesto pendiente con botón de aprobación
- Email: enviar PDF del presupuesto con link de aprobación

---

### P1.5 — Portal Cliente Web

**Componente:** Nueva página en `web/src/app/(public)/portal/` + `src/modules/client-portal/`

**Rutas frontend:**

```
/portal/login          — Login con magic link + PIN
/portal/dashboard      — Resumen: vehículos, OTs activas, facturas pendientes
/portal/vehiculos      — Lista de vehículos del cliente
/portal/vehiculos/:id  — Historial de servicio del vehículo
/portal/ordenes        — OTs activas e histórico
/portal/ordenes/:id    — Detalle de OT (servicios, repuestos, estado, timeline)
/portal/facturas       — Facturas emitidas
/portal/facturas/:id   — Detalle de factura + link de pago online
/portal/agendar        — Agendar nueva cita (booking público)
/portal/perfil         — Datos del cliente
```

**Pantallas prioritarias (MVP):**
1. Login con magic link (backend existe)
2. Dashboard con resumen de OTs activas
3. Lista de OTs con estado actual
4. Detalle de OT con timeline
5. Lista de facturas + link de pago (Stripe)

**Integración:**
- Backend `client-portal` existe (portal-auth.service.ts, portal.service.ts)
- Pagos online (Stripe) para links de pago
- Scheduling para booking público

---

### P1.6 — Frontend Stock Movements + Purchase Orders

**Componente:** Nuevas páginas en `web/src/app/(dashboard)/dashboard/inventario/`

**Página: Movimientos de Stock (`/dashboard/inventario/movimientos`)**

```typescript
// Tabla de movimientos con filtros
interface StockMovementUI {
  fecha: string;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE" | "TRANSFERENCIA";
  repuesto: string;          // Nombre + código
  cantidad: number;
  precioUnitario: number | null;
  stockResultante: number;
  ordenTrabajoId: string | null;
  almacenOrigen: string | null;
  almacenDestino: string | null;
  usuario: string;
}

// Acciones:
// - Registrar entrada manual (compra directa)
// - Registrar salida manual (ajuste, pérdida)
// - Ver historial por repuesto
// - Exportar a CSV
```

**Página: Órdenes de Compra (`/dashboard/inventario/ordenes-compra`)**

```typescript
interface PurchaseOrderUI {
  id: string;
  proveedor: string;
  fecha: string;
  items: POItemUI[];
  total: number;
  estado: "BORRADOR" | "ENVIADA" | "RECIBIDA_PARCIAL" | "COMPLETADA" | "ANULADA";
  alertaReorden: boolean;  // Si fue generada por punto de reorden
}

// Acciones:
// - Crear OC desde cero
// - Crear OC desde alerta de reorden
// - Marcar como recibida (parcial/total)
// - Ver historial por proveedor
```

**API endpoints (ya existen):**
- `GET /inventory/stock-movements` — listar movimientos
- `POST /inventory/stock/entrada` — registrar entrada
- `POST /inventory/stock/salida` — registrar salida
- `GET /inventory/purchase-orders` — listar OC
- `POST /inventory/purchase-orders` — crear OC

---

### P1.7 — Frontend SIFEN (Monitoreo + Contingencia + Nota Crédito)

**Componente:** Nueva página en `web/src/app/(dashboard)/dashboard/finance/`

**Página: Monitoreo SIFEN (`/dashboard/finance/sifen`)**

```typescript
interface SifenDashboard {
  // Estado del servicio DNIT
  estadoDNIT: "ONLINE" | "CONTINGENCIA" | "OFFLINE";
  ultimaPrueba: string;
  // Documentos recientes
  documentos: SifenDocUI[];
  // Resumen
  totalEmitidos: number;
  totalPendientes: number;
  totalRechazados: number;
  totalNotasCredito: number;
}

interface SifenDocUI {
  id: string;
  tipo: string;              // FACTURA, NOTA_CREDITO, NOTA_DEBITO
  numero: string;
  cdc: string | null;        // Código de Control DNIT
  estado: "ENVIADO" | "APROBADO" | "RECHAZADO" | "CONTINGENCIA";
  total: number;
  fecha: string;
  cliente: string;
}
```

**Acciones:**
- Emitir factura electrónica desde una OT
- Emitir nota de crédito
- Ver log de sincronización SIFEN
- Activar/desactivar modo contingencia
- Reenviar documentos en contingencia

**API endpoints (ya existen):**
- `GET /finance/sifen/dashboard` — resumen SIFEN
- `POST /finance/sifen/emitir` — emitir DTE
- `POST /finance/sifen/nota-credito` — nota de crédito
- `GET /finance/sifen/sync-log` — log de sincronización
- `POST /finance/sifen/contingencia/guardar` — guardar en contingencia
- `POST /finance/sifen/contingencia/reenviar` — reenviar contingencia
- `GET /finance/sifen/contingencia/status` — estado contingencia

---

## Hoja de Ruta Sugerida

### Sprint 87 — Flujo OT Completo (7 días)
1. ✅ P1.2 — Vista detalle OT con servicios, repuestos, terceros, timeline
2. ✅ P1.2 — Cambio de estado desde frontend con validaciones
3. ✅ P1.2 — Firma de retiro del cliente en frontend
4. ✅ P1.1 — Checklist de recepción estructurado (backend + frontend)

### Sprint 88 — Presupuestos y Facturación (7 días)
1. ✅ P1.3 — Flujo Presupuesto → Aprobación → OT automático
2. ✅ P1.4 — Notificación automática al cliente (email factura, WhatsApp estado)
3. ✅ P1.7 — Frontend SIFEN monitoreo + contingencia + nota crédito

### Sprint 89 — Portal Cliente + Stock (7 días)
1. ✅ P1.5 — Portal cliente web MVP (login, OTs, facturas)
2. ✅ P1.6 — Frontend stock movements + purchase orders
3. ✅ P2.1 — Catálogo servicios + pricing frontend

### Sprint 90 — Herramientas + Multi-almacén + Pagos (7 días)
1. ✅ P2.2 — Frontend herramientas (préstamos, mantenimiento)
2. ✅ P2.6 — Frontend multi-almacén (transferencias)
3. ✅ P2.7 — Frontend pagos online
4. ✅ P2.4 — Frontend asignación inteligente

### Sprint 91 — Dashboard + Analytics + Experiencia (7 días)
1. ✅ P2.9 — Dashboard ejecutivo unificado
2. ✅ P2.8 — Booking web público 24/7
3. ✅ P2.5 — Predictive ML frontend
4. ✅ P2.3 — Flat rate tracking frontend

### Sprint 92 — Valor Agregado (7 días)
1. ✅ P2.8 — Agendar cita online (portal público)
2. ✅ P3.1 — Email automático de factura
3. ✅ P3.2 — Notificación WhatsApp por cambio de estado OT
4. ✅ P3.3 — Comparación before/after DVI
5. ✅ P3.4 — TecDoc frontend
6. ✅ P3.7 — Consolidación multi-tenant frontend

---

## Conclusión

El AutomotiveOS ERP tiene un **backend extremadamente maduro** (30+ módulos, 1,406 tests, 0 errores TS) con capacidades únicas en el mercado paraguayo (SIFEN V150, contabilidad partida doble, Thinkcar OBD2). La principal brecha actual es **frontend operativo incompleto**: los listados y CRUDs básicos existen, pero los flujos de trabajo detallados (recepción, presupuesto, detalle de OT, stock, herramientas) requieren desarrollo frontend para que el operario del taller pueda usar el sistema sin salir del navegador.

**Estimación total de cierre de gaps:** ~6 sprints (42 días hábiles)
**Impacto esperado:** Automatización pasa de ~70% a ~95% del flujo operativo core
