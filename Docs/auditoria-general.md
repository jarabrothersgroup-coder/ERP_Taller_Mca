# Auditoría General — AutomotiveOS Cloud ERP

> **Fecha:** 2026-06-11
> **Propósito:** Diagnóstico completo del proyecto backend, frontend, base de datos y brechas en gestión contable y financiera.
> **Próxima capa:** CAPA 6 — Frontend de Gestión Contable y Financiera + Servicios Faltantes

---

## 1. Arquitectura del Backend

### Módulos Activos

| Módulo | Rutas | Tablas | Servicios |
|--------|-------|--------|-----------|
| **finance** | 6 archivos (50+ endpoints) | 16 tablas | accounting/, fiscal/, sifen/, orchestrator |
| **workshop** | 6 archivos | 5 tablas | client, vehicle, orden, ingreso, terceros |
| **inventory** | 9 archivos | 14 tablas | stock, costing, tools lifecycle (5) |
| **intelligence** | plugin + routes | RAG + visual | DTC, OCR, HV safety, async jobs |
| **thinkcar** | plugin + routes | imports | USB, Bluetooth, Email channels |
| **tenants** | tenants.ts | tenant_config, libros_obligatorios | classifier + profile |
| **config** | auth.ts, profiles.ts | — | auth-utils, TenantConfigService |

### Módulos Vacíos (sin código)

`auth/`, `clients/`, `diagnostics/`, `fiscal/`, `vehicles/`, `work-orders/`

---

## 2. Superficie Completa de API

### Finance — Contabilidad (50+ endpoints)

| Grupo | Endpoints | CAPA |
|-------|-----------|------|
| Plan de Cuentas | CRUD + árbol | CAPA 2 |
| Asientos | CRUD + automático + apertura + anular | CAPA 2 |
| Devengamiento | ingresos, gastos, ajustes, revertir | Sprint 3 |
| Depreciación | calcular, activos CRUD | Sprint 3 |
| Centralización | ventas, compras, ejecutar | Sprint 3 |
| Moneda Extranjera | tipos de cambio CRUD, diferencia cambio | Sprint 4 |
| Revalúo / Refundición / Reserva Legal | POST | Sprint 4 |
| Libros Contables | diario, mayor, inventario | Sprint 5 |
| RG90 | exportar, ventas, compras, retenciones | CAPA 3 |
| **Cerrar Período** | POST | **CAPA 4** |
| **Cuadratura** | GET /:anho/:mes | **CAPA 4** |
| **Audit Log** | GET (paginado + filtros) | **CAPA 4** |
| **Centros de Costo** | CRUD + árbol | **CAPA 5** |
| **Rentabilidad OT** | GET /ot/:id | **CAPA 5** |
| **Rentabilidad Cliente** | GET /cliente/:id | **CAPA 5** |
| **Rentabilidad Mecánico** | GET /mecanico/:id | **CAPA 5** |
| **Dashboard Rentabilidad** | GET /dashboard/:anho/:mes | **CAPA 5** |
| IVA (Form 120) | calcular + listar | Motor Fiscal |
| IRE | calcular + listar | Motor Fiscal |
| IDU | calcular + listar | Motor Fiscal |
| ISC | calcular + listar | Motor Fiscal |
| INR | calcular + listar | Motor Fiscal |
| Facturación Híbrida | emitir (manual/electrónica) | SIFEN |
| Payroll | calcular comisiones + break-even | Payroll |

### Workshop (14 endpoints)

`ingresos` CRUD, `clientes` CRUD, `vehiculos` CRUD, `ordenes` list/detail/status/lockout, `trabajos-terceros` CRUD

### Inventory (27 endpoints)

`repuestos` CRUD + ingreso/salida, `herramientas` CRUD, `tool-instances` lifecycle (6 estados), `tool-loans` prestar/devolver, `tool-maintenance`, `tool-depreciation`, `stock-movements` list

---

## 3. Base de Datos

### Shared Schema (public)

| Tabla | Propósito |
|-------|-----------|
| `tenants` | Plataforma multi-tenant |
| `profiles` | Usuarios por tenant |
| `clients` | Clientes del taller |

### Workshop Schema

| Tabla | Propósito |
|-------|-----------|
| `vehiculos` | Vehículos con tipo motor (Nafta/Diésel/HEV/BEV) y HV safety |
| `ordenes_trabajo` | OT con estados, HV lockout, total_cost |
| `ingresos` | Check-in de vehículos |
| `trabajos_terceros` | Servicios tercerizados por OT |

### Inventory Schema

| Tabla | Propósito |
|-------|-----------|
| `repuestos` | Catálogo de repuestos con PPP, punto_reorden |
| `herramientas` | Catálogo de herramientas SKU |
| `control_herramientas` | Checkout de herramientas a OT |
| `tool_instances` | Activos individuales por serial |
| `tool_maintenance_events` | Calibración/reparación |
| `tool_depreciation_entries` | Depreciación lineal mensual |
| `stock_movements` | Auditoría de movimientos con PPP |
| `cost_history` | Historial de cambios de PPP |
| `purchase_orders` + `purchase_order_items` | Órdenes de compra |
| `inventory_accounts_map` | Mapeo categoría → plan_cuentas |
| `reorder_alerts` | Alertas de stock bajo |

### Finance Schema

| Tabla | Propósito | CAPA |
|-------|-----------|------|
| `plan_cuentas` | Catálogo de cuentas contable jerárquico | CAPA 2 |
| `asientos_contables` | Asientos de partida doble | CAPA 2 |
| `asientos_detalle` | Líneas Debe/Haber con centro_costo_id | CAPA 2 |
| `fiscal_documentos` + `detalles` | DTE SIFEN | CAPA 1 |
| `sifen_sync_log` | Log de sincronización DNIT | CAPA 1 |
| `facturas` | Facturas híbridas (manual/electrónica) | CAPA 1 |
| `tipos_cambio` | Cotizaciones moneda extranjera | Sprint 4 |
| `revaluaciones` | Revalúo de activos | Sprint 4 |
| `activos_fijos` | Registro de activos fijos | Sprint 3 |
| `depreciacion_activos` | Historial depreciación | Sprint 3 |
| `fixed_expenses` | Gastos fijos mensuales | Payroll |
| `mechanic_profiles` | Perfiles MTESS con categoría y comisión | Payroll |
| `staff_profiles` | Personal administrativo | Payroll |
| `commission_records` | Comisiones por OT | Payroll |
| `payroll_summary` | Resumen mensual payroll | Payroll |
| `periodos_fiscales` | Períodos fiscales | Motor Fiscal |
| `liquidaciones_iva/ire/idu/isc/inr` | Liquidaciones de impuestos | Motor Fiscal |
| **`audit_log`** | Auditoría APPEND-ONLY | **CAPA 4** |
| **`centros_costo`** | Centros de costo jerárquicos | **CAPA 5** |

### Migraciones

Última: `0012_sprint4.sql`. **Pendientes:** migraciones para `audit_log` y `centros_costo`.

---

## 4. Frontend (SPA)

### Vistas Actuales

| Vista | Funcionalidad | APIs que consume |
|-------|--------------|------------------|
| **Login** | Slug + email + password | POST /api/auth/login |
| **Dashboard** | Cards, WS status, ingresos count | GET /api/v1/visual/status, GET /workshop/ingresos |
| **Usuarios** | CRUD perfiles con modal | GET/POST/PATCH/DELETE /api/profiles |
| **Configuración** | Empresa info + logo upload | GET/PUT /api/config/settings, logo endpoints |
| **Órdenes** | Listar + cambiar estado | GET/PATCH /workshop/ordenes |
| **Ingreso** | Check-in vehículo + crear OT | POST /workshop/ingresos, /clientes, /vehiculos |
| **Taller** | Tareas + lockout | GET /workshop/ordenes, WS /api/v1/visual/stream |
| **Quiosco TV** | Pantalla sala espera | WS stream |
| **Facturación** | Emitir factura | POST /finance/invoices/issue |
| **Thinkcar** | Ver importaciones | GET /thinkcar/imports |
| **Inventario** | Repuestos + herramientas + stock | /inventory/repuestos, /herramientas, stock |

---

## 5. Brechas Críticas (GAPS)

### 🚨 FRONTEND — Gestión Contable y Financiera AUSENTE

El backend tiene 50+ endpoints financieros pero **el frontend no tiene ninguna vista** para:

| Funcionalidad | Backend | Frontend |
|--------------|---------|----------|
| Plan de Cuentas (CRUD + árbol) | ✅ | ❌ |
| Asientos Contables (listar + crear) | ✅ | ❌ |
| Libro Diario / Mayor / Inventario | ✅ | ❌ |
| RG90 Exportar (TXT/CSV/JSON) | ✅ | ❌ |
| IVA / IRE / IDU / ISC / INR | ✅ | ❌ |
| Tipos de Cambio | ✅ | ❌ |
| Cuadratura Contable | ✅ | ❌ |
| Audit Log | ✅ | ❌ |
| Cerrar Período | ✅ | ❌ |
| Centros de Costo | ✅ | ❌ |
| Rentabilidad Dashboard | ✅ | ❌ |
| Reserva Legal | ✅ | ❌ |
| Revalúo / Refundición | ✅ | ❌ |
| Diferencia Cambio | ✅ | ❌ |
| Break-even / Payroll | ✅ | ❌ |
| Depreciación de Activos | ✅ | ❌ |

### 🔴 BACKEND — Servicios Faltantes

| Servicio | Estado |
|---------|--------|
| Balance General (Estado de Situación) | ❌ |
| Estado de Resultados (P&L mensual) | ❌ |
| Flujo de Caja | ❌ |
| Presupuesto vs Real | ❌ |
| Exportación PDF / XLSX | ❌ |
| Nota de Crédito / Débito | ❌ |
| Retenciones (Renta, IVA) | ❌ |
| Conciliación Bancaria | ❌ |
| Cuentas por Cobrar / Pagar | ❌ |

### 🟡 BASE DE DATOS — Migraciones Pendientes

| Tabla | Migración |
|-------|-----------|
| `audit_log` | ❌ Pendiente |
| `centros_costo` | ❌ Pendiente |
| Última: `0012_sprint4.sql` | |

---

## 6. Conclusión y Recomendación

El backend financiero es **muy robusto** (CAPA 1-5 completas, 50+ endpoints, 16 tablas, motor fiscal completo), pero el **frontend de gestión contable/financiera es prácticamente inexistente**.

### CAPA 6 Recomendada: Frontend de Gestión Contable + Estados Financieros

**Fase A — Vistas Frontend (prioridad máxima):**
1. Sidebar: "Contabilidad" con submenú
2. Vista Plan de Cuentas (árbol + CRUD modal)
3. Vista Asientos (listar + crear + detalle)
4. Vista Libros (Diario, Mayor, Inventario)
5. Vista RG90 (exportar periodo)
6. Vista Impuestos (IVA, IRE, IDU, ISC, INR)

**Fase B — Servicios faltantes:**
7. Balance General endpoint
8. Estado de Resultados endpoint
9. Exportación PDF/XLSX

**Fase C — Vistas avanzadas:**
10. Vista Cuadratura + Cerrar Período
11. Vista Audit Log
12. Vista Cost Centers + Rentabilidad Dashboard
13. Vista Tipos de Cambio + Diferencia Cambio
14. Vista Payroll / Break-even
