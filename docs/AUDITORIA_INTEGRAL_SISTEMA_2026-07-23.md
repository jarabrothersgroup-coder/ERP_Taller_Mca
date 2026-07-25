# Auditoría Integral — AutomotiveOS Cloud ERP

**Fecha:** 23 de julio de 2026  
**Versión analizada:** Sprint 82 (Post-consolidación)  
**Arquitectura:** Fastify 5 + TypeScript · PostgreSQL (Neon/Supabase) · Next.js 14 · React Native Mobile  
**Analista:** Arquitecto de Sistemas — Auditoría Integral  

---

## Resumen Ejecutivo

| Indicador | Valor |
|:----------|:------|
| **Módulos backend** | 24 directorios en `src/modules/` + 4 compartidos |
| **Archivos frontend JS** | 49 módulos en `src/shared/public/js/` |
| **Tests** | 1,406+ backend, 43 unit frontend, 20 E2E Playwright |
| **Migraciones SQL** | 10+ (0000–0010 + 0011 nueva) |
| **Automatización actual** | ~70% del flujo operativo core |
| **Gaps P1 (bloqueantes)** | 7 |
| **Gaps P2 (alta prioridad)** | 9 |
| **Gaps P3 (mejora)** | 8 |
| **Sprints completados** | 82 (desde Sprint 10 documentado) |

### Estado por Área

| Área | % | Estado |
|:-----|:-:|:-------|
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

### Riesgos Operacionales Principales

1. **Disputas por daños preexistentes:** Sin checklist de recepción estructurado ni firma del cliente, el taller no tiene evidencia de estado previo del vehículo.
2. **Pérdida de presupuestos:** El flujo presupuesto → aprobación → OT es completamente manual, causando demora y pérdida de oportunidades.
3. **Inventario descontrolado:** Sin frontend para movimientos de stock ni órdenes de compra, el operario no puede gestionar repuestos eficientemente.
4. **Facturación electrónica ciega:** El backend SIFEN está completo pero el operario no tiene interfaz para monitorear estados, contingencia ni emitir notas de crédito.
5. **Sin portal de cliente:** Los clientes no pueden ver el estado de sus vehículos, facturas ni agendar citas, generando llamadas innecesarias al taller.

---

## 1. Matriz de 28 Módulos

### Leyenda

| Símbolo | Significado |
|:-------:|:------------|
| ✅ | **Funcional** — Backend + Frontend completos, probados |
| ⚠️ | **Incompleto** — Backend funcional, frontend parcial o faltante |
| 🔴 | **Crítico** — Backend existe pero frontend ausente o workflow roto |
| ❌ | **Inexistente** — No hay backend ni frontend |
| 🆕 | **Nuevo** — Implementado recientemente, sin frontend aún |

### Módulos Core — Taller (14)

| # | Módulo | Backend | Frontend | BD/Schema | Estado | Gaps Principales |
|:-:|:-------|:-------:|:--------:|:---------:|:------:|:-----------------|
| 1 | **Workshop — OT** | ✅ 3 servicios | ⚠️ Listado + dialogo crear/editar | ✅ ordenes_trabajo | ⚠️ | Sin vista detalle completa (servicios, repuestos, DVI, cronología), sin cambio de estado desde frontend, sin firma digital |
| 2 | **Workshop — Clientes** | ✅ 1 servicio | ✅ Listado + crear | ✅ clients | ✅ | Sin historial de cliente (backend existe: `getClientHistory`) |
| 3 | **Workshop — Vehículos** | ✅ 1 servicio | ✅ Listado + crear | ✅ vehiculos | ✅ | Sin historial de vehículo (backend existe: `getVehicleHistory`) |
| 4 | **Workshop — Ingresos (Check-in)** | ✅ 2 servicios | ⚠️ No hay página dedicada | ✅ ingresos | 🔴 | Sin formulario estructurado de recepción (rayones, combustible, accesorios, fotos, firma) |
| 5 | **Workshop — Catálogo Servicios** | ✅ 1 servicio | ❌ No hay página | ✅ servicios_catalogo (146 registros) | 🔴 | Sin CRUD frontend para catálogo de servicios |
| 6 | **Workshop — Service Pricing** | ✅ 1 servicio | ❌ No hay página | ✅ service_pricing_rules (270 reglas), rh_service_hours | 🔴 | Sin frontend para matriz de precios ni horas-hombre estándar |
| 7 | **Workshop — Mecánicos** | ✅ (vía finance/mechanic-profiles) | ❌ No hay página dedicada | ✅ mechanic_profiles | ⚠️ | Sin gestión frontend de perfiles de mecánico |
| 8 | **Workshop — Asignación Inteligente** 🆕 | ✅ 1 servicio | ❌ No hay página | ✅ (usa mechanic_profiles + OT history) | 🔴🆕 | Sin frontend para visualizar/asignar mecánicos |
| 9 | **Workshop — Flat Rate** | ✅ 1 servicio | ❌ No hay página | ✅ (usa órdenes + mechanic_profiles) | 🔴 | Sin frontend para tracking de tiempo real vs estimado |
| 10 | **Workshop — Firmas Digitales** | ✅ 1 servicio | ❌ No hay página | ✅ (datos en OT) | 🔴 | Sin captura de firma en frontend |
| 11 | **Workshop — Trabajos Terceros** | ✅ 1 servicio | ❌ No hay página | ✅ trabajos_terceros | 🔴 | Sin frontend para gestionar servicios subcontratados |
| 12 | **Workshop — Notificaciones Push** | ✅ 2 servicios | ⚠️ Campana de notificaciones | ✅ notification_priorities | ⚠️ | Sin panel de notificaciones completo |
| 13 | **Workshop — Predictive Maintenance** | ✅ 1 servicio | ❌ No hay página | ✅ (usa OT history + vehículos) | ⚠️ | Backend básico basado en reglas, sin frontend |
| 14 | **Workshop — Predictive ML** 🆕 | ✅ 1 servicio | ❌ No hay página | ✅ (usa OT + vehículos + DTCs) | 🔴🆕 | Sin frontend para predicciones ML |

### Módulos de Inventario (5)

| # | Módulo | Backend | Frontend | BD/Schema | Estado | Gaps Principales |
|:-:|:-------|:-------:|:--------:|:---------:|:------:|:-----------------|
| 15 | **Inventario — Repuestos** | ✅ 2 servicios | ✅ Listado + crear | ✅ repuestos (72 ítems) | ✅ | Sin edición detallada desde frontend |
| 16 | **Inventario — Multi-almacén** 🆕 | ✅ 1 servicio | ⚠️ Página almacenes existe | ✅ almacenes, transferencias_almacen | 🔴🆕 | Sin frontend para transferencias ni gestión de almacenes |
| 17 | **Inventario — Stock Movements** | ✅ 1 servicio | ❌ No hay página | ✅ stock_movements | 🔴 | Sin frontend para ver movimientos de stock ni realizar entradas/salidas |
| 18 | **Inventario — Purchase Orders** | ✅ 2 servicios | ❌ No hay página | ✅ purchase_orders, reorder_alerts | 🔴 | Sin frontend para generar/ver órdenes de compra |
| 19 | **Inventario — Herramientas** | ✅ 4 servicios | ❌ No hay página | ✅ herramientas, tool_instances, control_herramientas, tool_maintenance_events | 🔴 | Sin frontend para gestión de herramientas (préstamos, mantenimiento, depreciación) |

### Módulos de Finanzas (6)

| # | Módulo | Backend | Frontend | BD/Schema | Estado | Gaps Principales |
|:-:|:-------|:-------:|:--------:|:---------:|:------:|:-----------------|
| 20 | **Finance — Facturación** | ✅ 2 servicios | ✅ Listado + crear | ✅ facturas, factura_detalle | ✅ | Sin detalle de factura, sin vista SIFEN CDC |
| 21 | **Finance — SIFEN Electrónico** | ✅ 6 servicios | ❌ No hay página dedicada | ✅ fiscal_documentos, sifen_sync_log | 🔴 | Sin frontend para monitoreo SIFEN, sin contingencia frontend |
| 22 | **Finance — Nota Crédito SIFEN** 🆕 | ✅ 1 servicio | ⚠️ Página nota-credito existe | ✅ (usa fiscal_documentos) | 🔴🆕 | Sin frontend operativo para emitir nota de crédito |
| 23 | **Finance — Pagos Online** 🆕 | ✅ 1 servicio | ⚠️ Página pagos-online existe | ✅ (usa Stripe) | 🔴🆕 | Sin frontend para generar links de pago |
| 24 | **Finance — Contabilidad** | ✅ 15 servicios | ✅ Balance, P&L, Flujo, Patrimonio, Notas, Integración | ✅ plan_cuentas (102), asientos_contables | ✅ | Más completa del sistema |
| 25 | **Finance — Tesorería** | ✅ 1 servicio | ✅ Cuentas, movimientos | ✅ cuentas_bancarias (9), movimientos_tesoreria (3) | ✅ | Sin conciliación bancaria frontend |

### Módulos de Servicio al Cliente y Comunicaciones (4)

| # | Módulo | Backend | Frontend | BD/Schema | Estado | Gaps Principales |
|:-:|:-------|:-------:|:--------:|:---------:|:------:|:-----------------|
| 26 | **Scheduling (Agendamiento)** | ✅ 2 servicios | ✅ Calendario con citas | ✅ agendamientos (18) | ✅ | Sin booking web público 24/7, sin sugerencia IA de horarios |
| 27 | **WhatsApp** | ✅ 4 servicios | ✅ Página con mensajes y templates | ✅ whatsapp_messages, templates | ✅ | Completo |
| 28 | **CRM (Twenty)** | ✅ 2 servicios | ⚠️ Página CRM existe | ✅ crm_sync_log | ⚠️ | Sin pipeline visual de oportunidades |

### Módulos Especializados (3)

| # | Módulo | Backend | Frontend | BD/Schema | Estado | Gaps Principales |
|:-:|:-------|:-------:|:--------:|:---------:|:------:|:-----------------|
| 29 | **Thinkcar OBD2** | ✅ 8 servicios | ⚠️ Página thinkcar existe | ✅ thinkcar_imports | ⚠️ | Sin dashboard DTC en tiempo real (mobile usa mock) |
| 30 | **DVI (Inspección Digital)** | ✅ 2 servicios | ⚠️ Página DVI + crear | ✅ dvi_inspections, dvi_photos, dvi_items | ⚠️ | Sin fotos before/after comparación, sin integración con OT |
| 31 | **Intelligence (AI/OCR)** | ✅ 7 servicios | ❌ Sin página dedicada | ✅ diagnostic_reports | ⚠️ | Sin frontend para AI DTC assistant, sin OCR en recepción |

### Módulos Administrativos (7)

| # | Módulo | Backend | Frontend | BD/Schema | Estado | Gaps Principales |
|:-:|:-------|:-------:|:--------:|:---------:|:------:|:-----------------|
| 32 | **Usuarios/Perfiles** | ✅ (vía config) | ✅ Página usuarios | ✅ profiles (5) | ✅ | Completo |
| 33 | **Billing (Stripe)** | ✅ 3 servicios | ⚠️ Página billing existe | ✅ plans, subscriptions, invoices | ⚠️ | Sin portal de suscripción frontend completo |
| 34 | **Enterprise (Audit/2FA/SSO)** | ✅ 4 servicios | ⚠️ Página enterprise existe | ✅ audit_enterprise | ⚠️ | Sin frontend para 2FA/SSO |
| 35 | **Marketing** | ✅ 4 servicios | ⚠️ Página marketing existe | ✅ marketing_campaigns (8) | ⚠️ | Sin frontend para campañas, reviews, loyalty |
| 36 | **Flotas B2B** | ✅ 1 servicio | ⚠️ Página flotas existe | ✅ fleets (1) | ⚠️ | Sin frontend detallado para gestión de flotas |
| 37 | **Analytics** | ✅ 3 servicios | ⚠️ Página analytics existe | ✅ (usa tablas existentes) | ⚠️ | Sin dashboard ejecutivo completo |
| 38 | **Seguridad (HW Kill-Switch)** | ✅ 1 servicio | ⚠️ Página seguridad existe | ✅ hardware_fingerprints, security_tokens | ⚠️ | Sin frontend de monitoreo |

### Módulos Auxiliares (4)

| # | Módulo | Backend | Frontend | BD/Schema | Estado | Gaps Principales |
|:-:|:-------|:-------:|:--------:|:---------:|:------:|:-----------------|
| 39 | **Config** | ✅ 1 servicio | ⚠️ Página config existe | ✅ tenant_config | ⚠️ | Sin UI completa de configuración |
| 40 | **Backup/Restore** | ✅ 2 servicios | ⚠️ Página backup existe | ✅ backup_policies | ⚠️ | Sin programación de backups desde frontend |
| 41 | **Label Printing** | ✅ 1 servicio | ⚠️ Página label-printing existe | ✅ label_templates | ⚠️ | Sin diseñador de etiquetas frontend |
| 42 | **Client Portal** | ✅ 2 servicios | ❌ Sin frontend web | ✅ (API exists) | 🔴 | Sin portal web para clientes (ver OTs, facturas, agendar) |

---

## 2. Matriz de Integraciones

### Flujo Operativo Principal

```
Recepción (Ingreso) ──→ DVI ──→ Presupuesto ──→ OT ──→ Factura ──→ Contabilidad ──→ Tesorería
     ↓                    ↓           ↓            ↓         ↓              ↓              ↓
  Cliente ←────────── Vehículo ←── Catálogo ── Inventario ─ SIFEN ──── Asiento Auto ──── Pago
                           ↓          ↓                          ↓
                      Historial   Órdenes Compra             Libros Fiscales
```

### Estado de Conexiones entre Módulos

| Conexión | Existe | Auto | Detalle |
|:---------|:------:|:----:|:--------|
| **Agendamiento → Ingreso → OT** | ✅ | ✅ | Check-in hereda diagnóstico, crea cliente+vehículo+OT |
| **OT → Inventario (consumo stock)** | ✅ | ✅ | `consumeStockOnOTClose()` al pasar OT a "Listo" |
| **OT → Contabilidad (reconocimiento ingreso)** | ✅ | ✅ | `workshopConfigurator.onOTCompletada()` genera asiento |
| **OT → Facturación** | ✅ | ⚠️ | Backend emite factura, frontend no integra el flujo completo |
| **Facturación → SIFEN** | ✅ | ✅ | Build XML → Firmar → SOAP DNIT → CDC |
| **Facturación → Contabilidad** | ✅ | ✅ | `sifenConfigurator` genera asiento |
| **Facturación → Tesorería (CxC)** | ✅ | ⚠️ | Registra pendiente, pago requiere acción manual |
| **Inventario → Contabilidad** | ✅ | ✅ | `inventarioConfigurator` para entradas/salidas |
| **Nómina → Contabilidad** | ✅ | ✅ | `nominaConfigurator` |
| **Compras → Contabilidad** | ✅ | ✅ | `comprasConfigurator` |
| **Tesorería → Contabilidad** | ✅ | ✅ | `tesoreriaConfigurator` |
| **OT → CRM** | ✅ | ✅ | `POST /crm/sync/:ordenId` |
| **OT → WhatsApp** | ✅ | ⚠️ | Template messages, sin automatización por cambio de estado |
| **OT → Portal Cliente** | ✅ | ⚠️ | Portal muestra OTs, sin notificación automática |
| **DVI → OT** | ✅ | ⚠️ | DVI se crea asociado a OT, sin vinculación automática |
| **Thinkcar → OT** | ✅ | ⚠️ | Smart linking por VIN, requiere revisión manual |
| **Presupuesto → OT** | ✅ | ⚠️ | Presupuesto existe como entidad separada, sin conversión automática a OT |
| **Scheduling → WhatsApp** | ✅ | ✅ | Recordatorio 24h con respuesta interactiva |
| **Marketing → WhatsApp** | ✅ | ⚠️ | Campañas pueden enviar por WhatsApp, sin automatización |
| **Fleet → OT** | ✅ | ⚠️ | Flota B2B vinculada a OT, sin facturación automática |
| **Consolidación Multi-tenant** 🆕 | ✅ | ⚠️ | Backend implementado, sin frontend ni automatización |

### Conexiones Faltantes (Gaps de Integración)

| Conexión | Impacto | Prioridad | Solución Requerida |
|:---------|:--------|:---------:|:-------------------|
| **OT → Notificación email/WhatsApp automática** | Clientes no saben avance de su vehículo | P1 | Webhook por cambio de estado OT que dispara notificación |
| **DVI → Presupuesto automático** | El diagnóstico DVI debería generar items de presupuesto | P1 | Mapping de hallazgos DVI a servicios del catálogo |
| **Presupuesto → OT automático** | Presupuesto aprobado debe crear OT automáticamente | P1 | Evento al aprobar presupuesto que genera OT |
| **OT → Facturación automática** | OT completada debe generar factura automáticamente | P1 | Al pasar OT a "Listo", generar factura pendiente de confirmación |
| **Inventario → Proveedores (OC automática)** | OC deberían generarse automáticamente al llegar al punto de reorden | P2 | Mejorar `auto-po.service.ts` para ejecución automática |
| **CRM → Marketing** | Datos CRM deberían alimentar segmentos de marketing | P2 | Sincronización de clientes/oportunidades a campañas |
| **Fleet → Facturación recurrente** | Flotas B2B deberían tener facturación automática mensual | P2 | Módulo de suscripción recurrente para flotas |

---

## 3. Análisis de Procesos Clave

### Proceso 1: Recepción de Vehículo

| Paso | Descripción | Automatización | Estado | Detalle |
|:----:|:------------|:--------------|:------:|:--------|
| 1.1 | Llegada del cliente | ⚠️ Manual | Parcial | Solo por agendamiento (calendarizado) o walk-in. Sin check-in digital público |
| 1.2 | Identificación del cliente | ✅ Automático | OK | Búsqueda por nombre/RUC/teléfono en BD |
| 1.3 | Identificación del vehículo | ✅ Automático | OK | Búsqueda por placa/VIN, decode VIN (NHTSA + CarQuery) |
| 1.4 | **Checklist de recepción** | **🔴 Manual** | **CRÍTICO** | `CreateIngresoRequest` solo tiene km, combustible, exterior, observaciones. **Sin checklist estructurado con:** abolladuras por panel (capot, puertas, maletero, paragolpes), rayones, estado de neumáticos, accesorios (gato, triángulos, extintor, radio), fotos de ingreso |
| 1.5 | **Firma digital del cliente** | **🔴 No existe** | **CRÍTICO** | No hay captura de conformidad del cliente al recibir el vehículo |
| 1.6 | Asignación de mecánico | ✅ Automático | OK | Algoritmo inteligente (Sprint 84-85) basado en eficiencia, carga y certificaciones |
| 1.7 | Creación de OT | ✅ Automático | OK | Handshake scheduling→ingreso→OT |

**GAP CRÍTICO:** El paso 1.4 (checklist) y 1.5 (firma) no están automatizados. Esto expone al taller a disputas por daños preexistentes.

### Proceso 2: Presupuesto y Diagnóstico

| Paso | Descripción | Automatización | Estado | Detalle |
|:----:|:------------|:--------------|:------:|:--------|
| 2.1 | Lectura de DTCs | ✅ Automático | OK | Thinkcar pipeline (USB/Email/BT) + Smart linking por VIN |
| 2.2 | Interpretación de DTCs | ✅ Automático | OK | AI DTC Assistant (GPT-4o-mini + RAG) + diccionario OBD-II |
| 2.3 | Inspección visual (DVI) | ✅ Automático | OK | Fotos con canvas markup, health score, ítems dañados |
| 2.4 | **Cálculo de horas-hombre** | **🔴 Manual** | **CRÍTICO** | `rh_service_hours` tiene datos pero **no está integrado con la creación de OT/presupuesto** para calcular automáticamente el costo de MO |
| 2.5 | Selección de servicios del catálogo | ⚠️ Manual | Parcial | Catálogo existe (146 servicios) pero no hay UI para seleccionar en OT/presupuesto |
| 2.6 | Cálculo de precio de servicios | ⚠️ Semi-auto | Parcial | `service_pricing_rules` (270 reglas) aplican precios por tipo vehículo, pero no están integrados en el flujo de presupuesto |
| 2.7 | **Presupuesto → Aprobación cliente** | ⚠️ Manual | Parcial | Backend de presupuestos existe pero no hay flujo de aprobación digital (WhatsApp/Portal) |
| 2.8 | **Presupuesto aprobado → OT** | **🔴 Manual** | **CRÍTICO** | No hay transición automática. Usuario debe crear OT manualmente |

**GAPS:** Pasos 2.4, 2.7, 2.8 no automatizados. El cálculo de costos es manual, lo que lleva a presupuestos inconsistentes.

### Proceso 3: Órdenes de Trabajo

| Paso | Descripción | Automatización | Estado | Detalle |
|:----:|:------------|:--------------|:------:|:--------|
| 3.1 | Creación de OT | ✅ Automático | OK | Desde ingreso o scheduling |
| 3.2 | **Asignación de servicios por item** | ⚠️ Manual | Parcial | Endpoint `POST /workshop/ordenes/:id/servicios` existe, sin frontend |
| 3.3 | **Asignación de repuestos por item** | ⚠️ Manual | Parcial | Endpoint `POST /workshop/ordenes/:id/repuestos` existe, sin frontend |
| 3.4 | **Trabajos terceros** | ⚠️ Manual | Parcial | Endpoint existe, sin frontend |
| 3.5 | Transición de estados (5 estados) | ⚠️ Manual | Parcial | Frontend solo muestra listado, sin botones de cambio de estado |
| 3.6 | **Control de calidad** | ⚠️ Manual | Parcial | Estado "Control_Calidad" existe, sin checklist estandarizado |
| 3.7 | **Firma de conformidad al retirar** | **🔴 No existe** | **CRÍTICO** | No hay captura de firma digital del cliente al retirar el vehículo |
| 3.8 | Notificación al cliente | ✅ Automático | OK | Email enviado al pasar a "Listo" (orderCompletedTemplate) |
| 3.9 | Consumo automático de stock | ✅ Automático | OK | `consumeStockOnOTClose()` ejecuta salida de stock |
| 3.10 | Reconocimiento contable de ingresos | ✅ Automático | OK | `workshopConfigurator.onOTCompletada()` genera asiento |

**GAPS CRÍTICOS:** Pasos 3.2, 3.3, 3.4, 3.5, 3.6, 3.7 sin frontend. El operario no puede gestionar la OT desde el frontend.

### Proceso 4: Facturación

| Paso | Descripción | Automatización | Estado | Detalle |
|:----:|:------------|:--------------|:------:|:--------|
| 4.1 | Emisión de factura desde OT | ✅ Automático | OK | Backend: `POST /finance/invoices/issue` |
| 4.2 | Factura manual (papel) | ✅ Automático | OK | Tipo "MANUAL" |
| 4.3 | Factura electrónica (SIFEN) | ✅ Automático | OK | Build XML → Firmar X.509 → SOAP DNIT → CDC |
| 4.4 | **Nota de crédito SIFEN** 🆕 | ✅ Automático | OK Backend | Backend completo, sin frontend |
| 4.5 | **Pagos online** 🆕 | ✅ Automático | OK Backend | Stripe + PagosPy, sin frontend |
| 4.6 | Registro de pago (efectivo/transferencia) | ✅ Automático | OK | `POST /finance/payments/register` |
| 4.7 | Generación de asiento contable | ✅ Automático | OK | `sifenConfigurator` + `tesoreriaConfigurator` |
| 4.8 | **Email de factura al cliente** | **🔴 No implementado** | **CRÍTICO** | Backend de email existe, pero no está conectado al flujo de facturación |

**GAPS:** Paso 4.8 no implementado. El cliente no recibe su factura por email automáticamente.

### Proceso 5: Inventario

| Paso | Descripción | Automatización | Estado | Detalle |
|:----:|:------------|:--------------|:------:|:--------|
| 5.1 | Entrada de stock (compra) | ✅ Automático | OK | PPP automático + asiento contable |
| 5.2 | Salida de stock a OT | ✅ Automático | OK | Atómico con guard WHERE stock >= cantidad |
| 5.3 | Alerta de reorden | ✅ Automático | OK | Al cruzar punto de reorden |
| 5.4 | **Generación de OC** | ⚠️ Semi-auto | Parcial | Backend `auto-po.service.ts` existe, **no genera OC automáticamente** al llegar al punto de reorden |
| 5.5 | **Transferencia entre almacenes** 🆕 | ⚠️ Semi-auto | Parcial | Backend existe, sin frontend |
| 5.6 | **Toma de inventario físico** | **❌ No implementado** | **CRÍTICO** | No hay módulo de conteo cíclico con ajuste automático |
| 5.7 | Barcode/QR scanning | ⚠️ Existe en mobile | Parcial | Sin integración en frontend web |
| 5.8 | TecDoc (búsqueda por VIN) | ⚠️ Backend existe | Parcial | Sin frontend para buscar repuestos por VIN |

**GAPS:** Pasos 5.4, 5.5, 5.6, 5.7, 5.8 sin automatización completa.

---

## 4. Priorización de Gaps

### 🔴 P1 — Críticos (Bloquean flujo operativo)

| # | Gap | Módulo | Impacto | Dependencias | Esfuerzo Est. |
|:-:|:----|:-------|:--------|:-------------|:-------------|
| **P1.1** | **Checklist de recepción estructurado** (rayones, combustible, accesorios, fotos + firma) | Workshop Ingresos | Alto — disputas con clientes por daños preexistentes | Migración BD (nueva tabla/columnas), DVI | 2-3 días |
| **P1.2** | **Flujo OT completo en frontend** (servicios/repuestos/terceros items, cambio estado, firma retiro) | Workshop OT | Crítico — operario no puede gestionar OT | API client endpoints ya existen | 5-7 días |
| **P1.3** | **Presupuesto → Aprobación → OT automático** | Finance Presupuestos + Workshop | Alto — flujo manual causa pérdida de presupuestos | Backend presupuestos existe, falta lógica de aprobación | 3-5 días |
| **P1.4** | **Notificación automatizada al cliente** (email factura, WhatsApp estado OT) | Finance + Email + WhatsApp | Alto — clientes no reciben comunicación | Email service existe, falta conectar con eventos OT/factura | 2-3 días |
| **P1.5** | **Portal cliente web frontend** | Client Portal | Alto — clientes no pueden ver estado de sus vehículos | Backend portal existe, sin frontend | 5-7 días |
| **P1.6** | **Frontend stock movements + purchase orders** | Inventory | Medio — operario no puede gestionar stock | API client existe parcialmente | 4-5 días |
| **P1.7** | **Frontend SIFEN (monitoreo + contingencia + nota crédito)** | Finance SIFEN | Medio — operario no puede operar facturación electrónica | Backend SIFEN completo, API client falta | 4-5 días |

### 🟠 P2 — Alta Prioridad

| # | Gap | Módulo | Impacto | Esfuerzo Est. |
|:-:|:----|:-------|:--------|:-------------|
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

| # | Gap | Módulo | Impacto | Esfuerzo Est. |
|:-:|:----|:-------|:--------|:-------------|
| **P3.1** | Email automático de factura al cliente al emitir | Finance + Email | Medio | 1 día |
| **P3.2** | Notificación WhatsApp al cambiar estado OT | Workshop + WhatsApp | Medio | 2 días |
| **P3.3** | Comparación before/after en DVI | DVI | Medio | 2 días |
| **P3.4** | TecDoc frontend (búsqueda partes por VIN) | Inventory | Medio | 2 días |
| **P3.5** | AI DTC Assistant frontend | Intelligence | Bajo | 2 días |
| **P3.6** | Metabase dashboard frontend | Analytics | Medio | 2 días |
| **P3.7** | Consolidación multi-tenant frontend 🆕 | Finance | Bajo (solo dueños multi-taller) | 3 días |
| **P3.8** | Google Reviews + Loyalty frontend | Marketing | Bajo | 2 días |

---

## 5. Especificaciones Técnicas — Gaps Prioritarios

### P1.1 — Checklist de Recepción Estructurado

**Componente:** `src/modules/workshop/services/ingreso.service.ts` + nueva tabla + frontend

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

## 6. Validación de Áreas Críticas

### ¿Existe formulario estructurado de recepción con campos para averías, rayones, estado de combustible, accesorios, fotos?

**Respuesta: NO.** El schema `CreateIngresoRequest` solo tiene campos básicos: `kilometraje`, `nivelCombustible` (string), `estadoExterior` (string libre), `observaciones` (texto libre). No hay:
- Checkpoint structure por panel del vehículo
- Campo para rayones/abolladuras por ubicación
- Estado de neumáticos
- Lista de accesorios (gato, triángulos, extintor)
- Campo para fotos asociadas al ingreso
- Firma de conformidad del cliente

**Referencia:** `src/modules/workshop/schema/ingresos.ts` — campos limitados a km, combustible, exterior, observaciones.

### ¿Hay base de datos de tarifas y horas hombre por tipo de trabajo?

**Respuesta: PARCIAL.** Existe `rh_service_hours` con datos de horas estándar por servicio, y `service_pricing_rules` con 270 reglas de precio por tipo de vehículo/fuel/km. Sin embargo:
- No está integrado con la creación de OT/presupuesto para cálculo automático
- No hay frontend para gestionar la matriz de precios
- El cálculo de costo de mano de obra es manual al momento de crear presupuestos

**Referencia:** `src/modules/workshop/schema/service-pricing.ts` — tablas existentes pero sin integración en flujo de presupuesto.

### ¿Las órdenes permiten servicios subcontratados con costos y rastreo de estado?

**Respuesta: PARCIAL.** La tabla `trabajos_terceros` existe con campos para proveedor, costo y estado. El endpoint `POST /workshop/ordenes/:id/trabajos-terceros` funciona. Pero:
- No hay frontend para agregar/gestionar trabajos terceros desde la vista de OT
- No hay integración con CxP (cuentas por pagar a proveedores)
- No hay跟踪 de estado del trabajo tercero (pendiente/en proceso/completado)

**Referencia:** `src/modules/workshop/schema/trabajos-terceros.ts` — schema completo, sin frontend.

### ¿El inventario gestiona repuestos nuevos, usados, herramientas con altas, bajas, ajustes de stock, reportes, órdenes de compra y control de salidas?

**Respuesta: BACKEND SÍ, FRONTEND NO.** El backend tiene:
- CRUD de repuestos con PPP (promedio ponderado)
- Movimientos de stock (entrada/salida/ajuste/transferencia)
- Alertas de reorden automáticas
- Órdenes de compra (`purchase_orders`)
- Gestión de herramientas con ciclo de vida (préstamo/mantenimiento/depreciación)
- Multi-almacén con transferencias

Pero el frontend solo tiene listado básico de repuestos y herramientas. Faltan:
- Página de movimientos de stock
- Página de órdenes de compra
- Página de gestión de herramientas (préstamos, mantenimiento)
- Página de transferencias entre almacenes
- Reportes de inventario

### ¿Panel de Control conecta a todos los módulos?

**Respuesta: PARCIAL.** El dashboard muestra KPIs básicos (OTs activas, ingresos, CxC) pero no conecta visualmente a todos los módulos. Falta un dashboard ejecutivo unificado que muestre:
- Estado de todos los módulos en una vista
- KPIs cruzados (inventario → facturación → contabilidad)
- Alertas consolidadas

### ¿Taller alimenta a Inventario y Finanzas?

**Respuesta: SÍ (automatizado).** La conexión OT → Inventario (`consumeStockOnOTClose`) y OT → Contabilidad (`workshopConfigurator.onOTCompletada`) están funcionales. El flujo automático existe.

### ¿Órdenes de Trabajo fluyen a Facturación?

**Respuesta: PARCIAL.** El backend puede emitir factura desde OT (`POST /finance/invoices/issue`), pero el frontend no tiene el botón/flujo para hacerlo. El operario debe ir a facturación y crear la factura manualmente.

### ¿Nómina integra horas del Taller?

**Respuesta: SÍ (parcial).** El `FinancialOrchestratorService` calcula comisiones basadas en OTs cerradas, y el `nominaConfigurator` genera asientos contables. Sin embargo, no hay integración directa de horas reales del mecánico (flat rate tracking).

### ¿CRM, Calendario y Analytics consumen datos apropiadamente?

**Respuesta: PARCIAL.**
- **CRM:** Sincroniza al cambiar OT a FINALIZADO_RETIRADO, pero sin pipeline visual
- **Calendario:** Backend completo con CRUD, frontend funcional con drag-drop
- **Analytics:** Backend con KPIs y trends, frontend con dashboard básico

---

## 7. Hoja de Ruta de Desarrollo

### Sprint 87 — Flujo OT Completo (7 días)

1. ✅ **P1.2** — Vista detalle OT con servicios, repuestos, terceros, timeline
2. ✅ **P1.2** — Cambio de estado desde frontend con validaciones
3. ✅ **P1.2** — Firma de retiro del cliente en frontend
4. ✅ **P1.1** — Checklist de recepción estructurado (backend + frontend)

### Sprint 88 — Presupuestos y Facturación (7 días)

1. ✅ **P1.3** — Flujo Presupuesto → Aprobación → OT automático
2. ✅ **P1.4** — Notificación automática al cliente (email factura, WhatsApp estado)
3. ✅ **P1.7** — Frontend SIFEN monitoreo + contingencia + nota crédito

### Sprint 89 — Portal Cliente + Stock (7 días)

1. ✅ **P1.5** — Portal cliente web MVP (login, OTs, facturas)
2. ✅ **P1.6** — Frontend stock movements + purchase orders
3. ✅ **P2.1** — Catálogo servicios + pricing frontend

### Sprint 90 — Herramientas + Multi-almacén + Pagos (7 días)

1. ✅ **P2.2** — Frontend herramientas (préstamos, mantenimiento)
2. ✅ **P2.6** — Frontend multi-almacén (transferencias)
3. ✅ **P2.7** — Frontend pagos online
4. ✅ **P2.4** — Frontend asignación inteligente

### Sprint 91 — Dashboard + Analytics + Experiencia (7 días)

1. ✅ **P2.9** — Dashboard ejecutivo unificado
2. ✅ **P2.8** — Booking web público 24/7
3. ✅ **P2.5** — Predictive ML frontend
4. ✅ **P2.3** — Flat rate tracking frontend

### Sprint 92 — Valor Agregado (7 días)

1. ✅ **P3.1** — Email automático de factura
2. ✅ **P3.2** — Notificación WhatsApp por cambio de estado OT
3. ✅ **P3.3** — Comparación before/after DVI
4. ✅ **P3.4** — TecDoc frontend
5. ✅ **P3.7** — Consolidación multi-tenant frontend

---

## 8. Conclusión

El AutomotiveOS ERP tiene un **backend extremadamente maduro** (24+ módulos, 1,406+ tests, 0 errores TS) con capacidades únicas en el mercado paraguayo (SIFEN V150, contabilidad partida doble, Thinkcar OBD2). La principal brecha actual es **frontend operativo incompleto**: los listados y CRUDs básicos existen, pero los flujos de trabajo detallados (recepción, presupuesto, detalle de OT, stock, herramientas) requieren desarrollo frontend para que el operario del taller pueda usar el sistema sin salir del navegador.

**Estimación total de cierre de gaps:** ~6 sprints (42 días hábiles)  
**Impacto esperado:** Automatización pasa de ~70% a ~95% del flujo operativo core

Las 3 acciones inmediatas más impactantes son:

1. **Flujo OT completo en frontend** — Sin esto, el operario no puede usar el sistema para su trabajo diario
2. **Checklist de recepción + firma** — Protege al taller de disputas legales con clientes
3. **Presupuesto → OT automático** — Elimina la pérdida de presupuestos por demora manual

---

*Documento generado por Arquitecto de Sistemas — Auditoría Integral*  
*Basado en análisis directo del código fuente, engram.json (Sprints 10-82), ERS, Gap Analysis y documentación del proyecto.*
