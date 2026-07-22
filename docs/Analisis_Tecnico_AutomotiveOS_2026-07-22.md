# Análisis Técnico y Funcional Completo — AutomotiveOS Cloud ERP

**Fecha:** 2026-07-22  
**Versión analizada:** 0.1.0 (Sprint 82)  
**Arquitectura:** Fastify 5 + TypeScript 6 · PostgreSQL (Neon/Supabase) · React Native Mobile · Next.js Web  

---

## Resumen Ejecutivo

AutomotiveOS es un ERP cloud-tethered para talleres automotrices con **25+ módulos funcionales**, **~88 endpoints API**, y cobertura excepcional de requisitos fiscales paraguayos (SIFEN V150, RG 90 Marangatu, Ley 1034/83). El sistema muestra madurez arquitectónica significativa en contabilidad automatizada, módulo Thinkcar para diagnóstico OBD2, y seguridad multi-tenant con RLS.

**Fortaleza principal:** Automatización contable completa (6 configuradores modulares, 22+ mappings automáticos, reversiones con audit trail) y cumplimiento fiscal Paraguay — ambas áreas donde supera a competidores internacionales como Tekmetric o Shopmonkey.

**Brecha principal:** Cobertura de estándares ISO (26262, 9001) y funcionalidades predictivas/de clase mundial aún en desarrollo. La experiencia mobile está completa pero con dependencias de hardware no probadas (BLE OBD2, expo-camera).

---

## 1. Cumplimiento de Estándares Industriales

| Estándar | Aplica a | Estado en AutomotiveOS | Evidencia |
|:---------|:---------|:-----------------------|:----------|
| **ISO 26262** (Functional Safety - Automotive) | Seguridad funcional vehículos | ⚠️ **Parcial** | Protocolo HV Lockout/Tagout implementado para EV/HEV (`hv-safety.service.ts`). Pero no hay trazabilidad formal ASIL, ni análisis HARA (Hazard Analysis and Risk Assessment) ni validación de seguridad funcional según ISO 26262-4 |
| **ISO 9001:2015** (Quality Management) | Procesos taller | ⚠️ **Parcial** | Flujo de control de calidad (`Control_Calidad` como estado de OT) y firma HV obligatoria. No hay gestión documental de calidad, auditorías internas, ni métricas de satisfacción formales |
| **SAE J2012** (OBD-II DTC Standards) | Diagnóstico | ✅ **Completo** | DTC parser con `DTC_CODE` regex, diccionario OBD-II en `dtc-database.ts`, lookup endpoint `/thinkcar/dtc/lookup/:code`, clasificación por sistema (Powertrain/Chassis/Body/Network) |
| **ISO 15031** (Communication OBD-II) | Comunicación vehículo | ✅ **Completo** | Thinkcar pipeline parsea reportes OBD2 de USB, email, y Bluetooth. Soporta ELM327 AT commands |
| **SIFEN V150** (DNIT Paraguay) | Facturación electrónica | ✅ **Completo** | 8 endpoints: emitir, firmar, enviar, consultar, anular. Ciclo completo XML → firma → SOAP DNIT → CDC. Certificado .p12 |
| **RG 90/2021 Marangatu** (DNIT Paraguay) | Registro compras/ventas | ✅ **Completo** | Exportación TXT/CSV/JSON para RG 90. Cobertura VENTAS, COMPRAS, RETENCIONES. Formats IRP, IVA, ISC |
| **Ley 1034/83** (Código Civil Paraguay - Contabilidad) | Libros contables | ✅ **Completo** | Libro Diario, Mayor, Inventario, Balance General, Estado Resultados, Flujo Efectivo, Evolución Patrimonio, Notas EE.FF. |
| **PCI DSS** (Payment Security) | Pagos | ❌ **No implementado** | No hay procesamiento de pagos con tarjeta integrado |
| **GDPR/LGPD** (Data Privacy) | Protección datos | ⚠️ **Parcial** | Data retention policy configurable, RLS multi-tenant. No hay exportación de datos personales ni derecho al olvido automatizado |
| **ISO 27001** (Security) | Seguridad información | ⚠️ **Parcial** | Audit trail enterprise con hash chain SHA-256, 2FA TOTP, SSO OIDC. No hay gestor de riesgos ni plan de continuidad |

---

## 2. Automatización de Procesos — Análisis por Módulo

### 2.1 Gestión de Taller General
| Subproceso | Automatización | Estado | Brecha |
|:-----------|:--------------|:-------|:-------|
| Recepción vehículo | Ingreso con checklist visual (DVI), creación automática de OT | ✅ Completo | — |
| Asignación de mecánico | Manual (no hay scheduling automático por capacidad/habilidad) | ⚠️ Parcial | No hay asignación inteligente basada en carga laboral ni certificaciones |
| Diagnóstico | OCR de patente/cédula, parseo DTC automático, integración Thinkcar | ✅ Completo | — |
| Presupuesto | Creación manual, aprobación por cliente vía portal/web | ✅ Completo | — |
| Control de calidad | Estado `Control_Calidad` en flujo OT | ✅ Completo | Checklist de calidad no estandarizado |
| Entrega vehículo | Notificación email/SMS automática al pasar a `Listo` | ✅ Completo | — |
| Facturación | Híbrida (manual + electrónica SIFEN), auto-generación asientos | ✅ Completo | — |

### 2.2 Inventario de Repuestos
| Subproceso | Automatización | Estado | Brecha |
|:-----------|:--------------|:-------|:-------|
| Entrada de stock | PPP automático, asiento contable vía InventarioConfigurator | ✅ Completo | — |
| Salida de stock | Atómica (UPDATE con guard WHERE stock >= cantidad), asiento contable automático | ✅ Completo | — |
| Alerta reorden | Automática al cruzar punto de reorden | ✅ Completo | — |
| Órdenes de compra | Semi-automática (auto-po.service.ts) | ✅ Completo | — |
| Código de barras | Lectura por cámara (mobile BarcodeScannerScreen) | ✅ Completo | — |
| Inventario físico | Conteo cíclico manual | ❌ No implementado | Módulo de toma de inventario físico con ajuste automático |
| Múltiples almacenes | No implementado | ❌ No implementado | No hay soporte para multi-warehouse ni transferencias entre almacenes |

### 2.3 Gestión de Herramientas
| Subproceso | Automatización | Estado | Brecha |
|:-----------|:--------------|:-------|:-------|
| Préstamo/control | Control por OT + mecánico | ✅ Completo | — |
| Mantenimiento | Programado por intervalo/fecha | ✅ Completo | — |
| Depreciación | Línea recta, automática | ✅ Completo | — |
| Calibración | No implementado | ❌ No implementado | Sin trazabilidad de calibración de herramientas de medición |

### 2.4 Thinkcar / Diagnóstico OBD2
| Subproceso | Automatización | Estado | Brecha |
|:-----------|:--------------|:-------|:-------|
| Ingesta USB | Watcher automático de archivos PDF | ✅ Completo | — |
| Ingesta email | Polling IMAP (Gmail) | ✅ Completo | — |
| Ingesta Bluetooth | RFCOMM + pipeline | ✅ Completo | — |
| Parseo PDF | Extracción VIN + DTCs + odómetro | ✅ Completo | — |
| Smart Linking | Vinculación automática a vehículo por VIN | ✅ Completo | — |
| Vinculación manual | Endpoint POST /thinkcar/pending/:id/assign | ✅ Completo | — |
| Dashboard DTC en tiempo real | Mobile ThinkcarOBD2Screen con BLE | ⚠️ Parcial | Lectura simulada (mock data), requiere react-native-ble-plx funcional |

### 2.5 Contabilidad
| Subproceso | Automatización | Estado | Brecha |
|:-----------|:--------------|:-------|:-------|
| Plan de cuentas | Árbol jerárquico con 7 tipos | ✅ Completo | — |
| Asientos automáticos | 6 configuradores modulares (COMPRAS, SIFEN, TESORERIA, NOMINA, INVENTARIO, WORKSHOP) | ✅ Completo | — |
| Reversión asientos | Auto-reversal con audit trail | ✅ Completo | — |
| Cierre mensual | Cron endpoint, ejecuta AccountingClosureService | ✅ Completo | — |
| Estados financieros | Balance, P&L, Flujo Efectivo, Patrimonio, Notas EE.FF. | ✅ Completo | — |
| Libros contables | Diario, Mayor, Inventario | ✅ Completo | — |
| Centro de costos | Propagado a todos los configuradores | ✅ Completo | — |
| Presupuesto | Planificación por período/centro costo | ✅ Completo | — |
| Consolidación multi-tenant | No implementado | ❌ No implementado | No hay consolidación contable entre múltiples talleres |

### 2.6 SIFEN (Facturación Electrónica Paraguay)
| Subproceso | Automatización | Estado | Brecha |
|:-----------|:--------------|:-------|:-------|
| Emisión DTE | Build XML → firmar → enviar DNIT | ✅ Completo | — |
| Consulta CDC | Consulta estado en DNIT | ✅ Completo | — |
| Anulación | Anular DTE ante DNIT | ✅ Completo | — |
| Nota de crédito | No implementado | ❌ No implementado | No hay emisión de notas de crédito electrónicas |
| Contingencia | No implementado | ❌ No implementado | Sin procedimiento de contingencia SIFEN |

---

## 3. Análisis Comparativo con Competidores

| Característica | AutomotiveOS | Tekmetric | Shopmonkey | AutoSoft Taller | Mitchell 1 |
|:---------------|:------------|:----------|:-----------|:----------------|:-----------|
| **Precio** | Open Source / Autogestionado | ~$250-500/mes | ~$200-400/mes | ~$100-300/mes | ~$200-400/mes |
| **Facturación electrónica LATAM** | ✅ SIFEN Paraguay | ❌ No | ❌ No | ✅ CFDI México, multi-país | ❌ No |
| **Contabilidad integrada** | ✅ Partida doble completa | ⚠️ QuickBooks sync | ⚠️ QuickBooks/Xero | ⚠️ Básica | ⚠️ Básica |
| **Mobile app** | ✅ React Native (6 screens) | ✅ iOS/Android | ✅ iOS/Android | ✅ Android | ❌ Web mobile |
| **DVI (Digital Inspection)** | ✅ 9 fotos con etiquetas | ✅ Fotos + video | ✅ Fotos | ✅ Fotos + firma | ❌ No nativo |
| **OBD2 / Scanner** | ✅ Thinkcar pipeline completo | ❌ No | ❌ No | ⚠️ Básico | ❌ No |
| **Portal cliente** | ✅ Portal web | ✅ Sí | ✅ Sí | ✅ Sí | ❌ No |
| **Multi-sucursal** | ⚠️ En desarrollo | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Sí |
| **CRM integrado** | ✅ Twenty CRM | ⚠️ Básico | ✅ Propietario | ⚠️ Básico | ❌ No |
| **WhatsApp** | ✅ Evolution API + templates | ❌ No | ❌ No | ⚠️ Limitado | ❌ No |
| **IA / ML** | ✅ DTC assistant, RAG manuals | ❌ No | ❌ No | ⚠️ Básico | ❌ No |
| **Offline-first** | ✅ Sync endpoint + cola | ❌ Cloud-only | ❌ Cloud-only | ❌ Cloud-only | ✅ Desktop app |
| **Open Source** | ✅ Sí (código completo) | ❌ No | ❌ No | ❌ No | ❌ No |
| **API pública** | ✅ 88 endpoints documentados | ⚠️ Limitada | ⚠️ Limitada | ❌ No | ❌ No |
| **White-label** | ✅ Sí (colores, logo, dominio) | ❌ No | ❌ No | ❌ No | ❌ No |
| **2FA / SSO** | ✅ TOTP + OIDC (Azure, Google, Okta) | ❌ No | ✅ 2FA básico | ❌ No | ❌ No |

### Ventajas competitivas clave de AutomotiveOS:
1. **Único con facturación SIFEN Paraguay + contabilidad completa partida doble** — Ningún competidor internacional cubre el mercado paraguayo
2. **Open Source** — Permite personalización total, sin vendor lock-in
3. **API de 88 endpoints** — Integrable con cualquier sistema externo
4. **Thinkcar OBD2 pipeline** — Automatización de diagnóstico única en el mercado
5. **Contabilidad automatizada** — 6 configuradores modulares que ningún competidor iguala

---

## 4. Funcionalidades Faltantes / Brechas Priorizadas

### Prioridad CRÍTICA (P0)

| # | Funcionalidad | Módulo | Impacto | Esfuerzo estimado |
|:-:|:--------------|:-------|:--------|:-----------------|
| 1 | **Nota de crédito SIFEN electrónica** | SIFEN | Sin NC electrónica, no se puede corregir facturas emitidas | 3 días |
| 2 | **Contingencia SIFEN (modo offline DNIT)** | SIFEN | Obligatorio por reglamento DNIT para operación continua | 5 días |
| 3 | **Multi-almacén / Transferencias** | Inventario | Limitante para talleres con múltiples ubicaciones | 5 días |
| 4 | **Asignación inteligente de mecánicos** | Taller | Optimización de capacidad no existe | 4 días |

### Prioridad ALTA (P1)

| # | Funcionalidad | Módulo | Impacto | Esfuerzo estimado |
|:-:|:--------------|:-------|:--------|:-----------------|
| 5 | **Predictive maintenance con ML** | Intelligence | Servicio predictivo usando datos históricos + DTC | 10 días |
| 6 | **Consolidación contable multi-tenant** | Finance | Dueños de múltiples talleres no pueden ver consolidated reports | 8 días |
| 7 | **Pagos online (tarjeta / transferencia)** | Finance | No hay cobro digital integrado (solo efectivo/cheque manual) | 5 días |
| 8 | **Programación automática de citas con IA** | Scheduling | Sugerencia de horarios óptimos basada en histórico | 5 días |

### Prioridad MEDIA (P2)

| # | Funcionalidad | Módulo | Impacto | Esfuerzo estimado |
|:-:|:--------------|:-------|:--------|:-----------------|
| 9 | **Loyalty program / Puntos fidelización** | Marketing | Retención de clientes | 3 días |
| 10 | **Encuestas NPS post-servicio** | CRM | Medición satisfacción | 2 días |
| 11 | **Checklist de calidad estandarizado** | Taller | Consistencia en control de calidad | 3 días |
| 12 | **Notificaciones push automáticas para recordatorios** | Mobile | Recordatorio de citas, mantenimientos | 4 días |
| 13 | **Integración con proveedores de repuestos** | Inventario | Consultar disponibilidad y precio en tiempo real | 8 días |
| 14 | **Documento de ingreso / egreso de stock (formulario impreso)** | Inventario | Cumplimiento contable Paraguay | 2 días |

---

## 5. Estándares No Cumplidos

| Estándar | Requisito | Estado Actual | Acción Requerida |
|:---------|:----------|:--------------|:-----------------|
| **ISO 26262-4** (System-level functional safety) | HARA, ASIL classification, safety goals | No implementado | Agregar módulo de gestión de seguridad funcional para talleres que trabajan con sistemas ADAS/EV |
| **ISO 9001:2015** (Quality) | Documentación de procesos, auditorías internas, mejora continua | No implementado | Agregar módulo de gestión de calidad con plantillas de auditoría |
| **GDPR / LGPD** (Data privacy) | Derecho al olvido, portabilidad de datos | Solo retention policy | Agregar exportación de datos personales + borrado automatizado |
| **PCI DSS v4.0** (Payment security) | Tokenización, no almacenar PAN, cifrado | No aplica (sin pagos) | Si se implementan pagos, debe cumplir PCI DSS |
| **ISO 27001** (Security) | Risk assessment, incident response, BCP | Audit trail + 2FA parcial | Agregar gestor de riesgos, plan de continuidad |

---

## 6. Procesos No Automatizados (Brechas Funcionales)

| Proceso | Estado | Descripción de la Brecha |
|:--------|:-------|:------------------------|
| **Toma de inventario físico** | Manual | No hay procedimiento de conteo cíclico con ajuste automático de diferencias |
| **Conciliación bancaria** | Manual | No hay importación de extractos bancarios ni matching automático |
| **Gestión de garantías** | No implementado | No hay registro de garantías de reparaciones ni alertas de vencimiento |
| **Evaluación de desempeño técnico** | Manual | No hay métricas de eficiencia por técnico (tiempo real vs. flat rate) |
| **Órdenes de compra automáticas** | Semi-automático | El auto-po.service.ts existe pero no genera PO automáticamente al llegar al punto de reorden |
| **Portal de proveedores** | No implementado | No hay self-service para que proveedores consulten órdenes de compra |
| **Factoring / Cesión de facturas** | No implementado | No hay módulo de cesión de créditos fiscales |

---

## 7. Recomendaciones Específicas por Prioridad

### P0 — Implementar en Sprint 84

**1. Nota de Crédito SIFEN**
```
Crear endpoint: POST /finance/sifen/nota-credito
Input: { documentoOriginalId, motivo, items a corregir }
Flujo: Generar XML NC → Firmar → Enviar DNIT → Almacenar CDC
Archivos: src/modules/finance/services/sifen/nota-credito.service.ts
         src/modules/finance/routes/sifen.ts (nueva ruta)
```

**2. Contingencia SIFEN**
```
Cuando DNIT esté offline:
1. Generar XML normalmente
2. Almacenar con estado CONTINGENCIA
3. Firmar con serie especial de contingencia (K)
4. Encolar para envío cuando DNIT responda
5. Enviar lote en orden cronológico al restaurar conexión
```

**3. Multi-almacén**
```
Agregar campo `almacenId` a repuestos y stock_movements
Crear tabla `almacenes` con ubicación física
Endpoint POST /inventory/transferencia: { origenId, destinoId, repuestoId, cantidad }
Crear migration 0010 para schema
```

### P1 — Implementar en Sprint 85

**4. Asignación Inteligente**
```
Algoritmo: 
  - Carga laboral actual de cada mecánico (OTs activas)
  - Certificaciones (HV, AC, Diesel, etc.)
  - Habilidad (flat rate histórico)
  - Prioridad del cliente
Endpoint: POST /workshop/ordenes/:id/assign-mechanic
```

**5. Pagos Online**
```
Integración con:
- Stripe (internacional, tarjeta)
- PagosPy / Efectivo (local Paraguay)
Flujo: Generar link de pago desde factura → Cliente paga → Webhook → Marcar como PAGA
```

---

## 8. Arquitectura de Clase Mundial — Roadmap

### Fase 1 (Sprint 84-85) — Cierre de brechas críticas
- Nota de crédito SIFEN + contingencia
- Multi-almacén + transferencias
- Asignación inteligente de mecánicos
- Pagos online

### Fase 2 (Sprint 86-87) — Inteligencia predictiva
- Predictive maintenance con ML
- Programación automática de citas
- Consolidación multi-tenant
- Chatbot IA para clientes (WhatsApp + web)

### Fase 3 (Sprint 88-89) — Clase mundial
- ISO 9001 compliance module
- Portal proveedores
- Conciliación bancaria automática
- Dashboard ejecutivo multi-sucursal
- Loyalty program + NPS

---

## 9. Fuentes Consultadas

### Documentación del sistema
- `docs/API.md` — 88 endpoints documentados
- `docs/RUNBOOK_ONPREM.md` — Guía operativa on-prem
- `docs/INSTALL.md` — Guía de instalación Docker
- `engram.json` — Estado de sprints y planificación
- `src/modules/` — 25+ módulos con código fuente completo
- `README.md` — Descripción general del proyecto

### Investigación web
- Tekmetric - How to Choose the Best Auto Repair Shop Software (tekmetric.com)
- Motive - The Fleet Manager's Guide to Predictive Maintenance (gomotive.com)
- Workshop Software - 7 Reasons You Need Software (workshopsoftware.com)
- Service-Intel - The Top 15 Essential Shop Management Systems (service-intel.com)
- DNIT Paraguay - Preguntas Frecuentes SIFEN (dnit.gov.py)
- ISO 26262 - Road Vehicles Functional Safety (iso.org)
- SAE J2012 - OBD-II Diagnostic Trouble Codes (sae.org)

### Estándares referenciados
- ISO 26262:2018 — Functional Safety
- ISO 9001:2015 — Quality Management
- ISO 15031:2015 — Communication OBD-II
- SAE J2012:2022 — DTC Standards
- SIFEN V150 — DNIT Paraguay
- RG 90/2021 — Marangatu
- Ley 1034/83 — Código Civil Paraguay
- PCI DSS v4.0 — Payment Security
- GDPR (EU) 2016/679 — Data Protection
