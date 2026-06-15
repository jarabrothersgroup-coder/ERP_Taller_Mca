# Roadmap Replanificado — AutomotiveOS Cloud ERP

> **Fecha:** Junio 2026
> **Propósito:** Conectar el flujo único end‑to‑end: Recepción → VIN → Cliente → OT → Servicios → Repuestos → Facturación → Tesorería
> **Principio rector:** Cada paso del flujo alimenta al siguiente automaticamente — sin intervención manual del usuario para conectar los datos.

---

## Executive Summary

El proyecto tiene módulos funcionales individuales pero **faltan las conexiones entre ellos**. El taller recibe un vehículo (Recepción), genera una OT, ve costos, factura y registra caja como islas separadas. No hay un flujo continuo donde:

- El VIN autocomplete los datos del vehículo
- Los servicios del portafolio se agreguen a la OT con precios
- Los repuestos se descuenten del inventario al agregarlos a la OT
- La factura se genere automáticamente cuando la OT se marca "Lista"
- El pago actualice automáticamente tesorería y CxC/CxP

**Impacto:** El usuario tiene que hacer trabajo manual para conectar todo. El ERP debería automatizar estas conexiones.

Este documento replanifica los sprints para cerrar esas brechas de integración, priorizando el flujo operativo del taller antes de avanzar a analytics y dashboards ejecutivos.

---

## Current State Assessment

### Flujo End‑to‑End: Estado Actual

| Paso | Estado | Backend | Frontend | Integración |
|------|--------|---------|----------|-------------|
| **1. Recepción** | ✅ | POST/GET /workshop/ingresos | Formulario check‑in | Crea OT opcionalmente |
| **2. VIN Decode** | ⚠️ | `vehicle-intelligence.service.ts` llama NHTSA | No integrado | Solo HV safety, no auto‑populate |
| **3. Cliente** | ✅ | CRUD /workshop/clientes | Select + CRUD modal | RUC tiene campo |
| **4. Work Order** | ✅ | 5 estados + HV lockout | Lista + detalle + modal crear | `totalCost` es manual, no calculado |
| **5. Service Portfolio** | ❌ | **No existe** | **No existe** | **GAP CRÍTICO** |
| **6. Parts/Inventory** | ✅ | Stock completo + PPP + movimientos | Repuestos + herramientas | `salidaStock` NO recibe ordenId |
| **7. Facturación** | ✅ | POST /finance/invoices/issue + Accounting Bus | Lista OTs Listas + emitir factura | Toma `totalCost` de OT (1 línea) |
| **8. Tesorería** | ✅ | 16 endpoints /finance/treasury/ | 6 tabs (Cuentas, Mov, CxC, CxP, Flujo) | **Sin integración con facturación/cobros** |

### Módulos Existentes (Backend Completo)

| Módulo | Tables | Endpoints | Servicios |
|--------|--------|-----------|-----------|
| **Workshop** | vehiculos, clientes, ordenes_trabajo, ingresos, trabajos_terceros | 14 | client, vehicle, orden, ingreso |
| **Inventory** | repuestos, herramientas, tool_instances, stock_movements, purchase_orders, cost_history, reorder_alerts | 27 | stock, costing, tool‑instance, tool‑loan, tool‑maintenance, tool‑depreciation |
| **Finance/Accounting** | plan_cuentas, asientos_contables, asientos_detalle, audit_log, centros_costo, activos_fijos, depreciacion_activos, facturas, fixed_expenses | 30+ | ledger, accounting‑bus, balance, pnl, depreciation, centralization, accrual, etc. |
| **Finance/Treasury** | cuentas_bancarias, movimientos_tesoreria, conciliacion_bancaria, facturas_proveedor | 16 | treasury.service (16 funciones) |
| **Finance/SIFEN** | fiscal_documentos, fiscal_documento_detalles, sifen_sync_log | 8 | sifen‑xml, sifen‑crypto, sifen‑soap |
| **Payroll** | fixed_expenses, mechanic_profiles, staff_profiles, commission_records, payroll_summary | 2 | FinancialOrchestratorService |
| **Intelligence** | DTC database (370+), async job queue | — | dtc‑parser, diagnostic‑engine, hv‑safety, ocr |

### Frontend SPA (app.js ~3963 líneas)

| Vista | Estado | Descripción |
|-------|--------|-------------|
| Dashboard | ✅ | Métricas, OTs activas, panel financiero |
| Usuarios | ✅ | CRUD perfiles |
| Configuración | ✅ | Logo, RUC, empresa |
| Órdenes | ✅ | Lista + filtros + modal detalle |
| Ingreso | ✅ | Formulario check‑in (cliente + vehículo + OT) |
| Taller | ✅ | Vista bay con HV lockout |
| Quiosco TV | ✅ | Pantalla espera con WS |
| Facturación | ✅ | OTs Listas para facturar + emitidas |
| Thinkcar | ✅ | Health status |
| Contabilidad | ✅ | 5 tabs (Cuentas, Asientos, Balance, P&L, Libros, Impuestos) |
| Inventario | ✅ | Repuestos + herramientas |
| **Tesorería** | **✅** | **6 tabs (Cuentas, Mov, Conciliación, CxC, CxP, Flujo)** |

---

## Gap Analysis

### Gap 1 — Catálogo de Servicios (❌ PORTFOLIO)
**Problema:** No existe un catálogo de servicios predefinidos con precios.
**Impacto:** El usuario escribe descripciones libres. No hay precios sugeridos. No se puede calcular el total de la OT automáticamente.
**Solución:** Crear tabla `servicios_catalogo` (nombre, descripción, precio_sugerido, categoria, tiempo_estimado_minutos, cuenta_contable_id). CRUD básico.

### Gap 2 — OT sin líneas de detalle (❌ OT_ITEMS)
**Problema:** `ordenes_trabajo.totalCost` es un campo manual. No hay `ot_items` ni `ot_servicios` ni `ot_repuestos`.
**Impacto:** No se sabe qué servicios se hicieron ni qué repuestos se usaron en cada OT. La factura es de 1 línea.
**Solución:** Crear `orden_servicios` (servicio del catálogo, cantidad, precio_unitario) y `orden_repuestos` (repuesto del inventario, cantidad, precio_unitario). `totalCost` se calcula como suma de servicios + repuestos.

### Gap 3 — VIN no autocompleta vehículo (⚠️ VIN_AUTO)
**Problema:** El VIN decode existe en `vehicle-intelligence.service.ts` pero no se usa en el check‑in.
**Impacto:** El usuario debe tipear marca/modelo/año manualmente.
**Solución:** Endpoint `POST /workshop/vehiculos/decode-vin` que recibe VIN → llama NHTSA → devuelve brand/model/year → autocompleta frontend.

### Gap 4 — Stock no vinculado a OT (⚠️ STOCK_OT)
**Problema:** `stock.service.ts`.salidaStock no recibe `ordenId`. El descuento de stock existe pero no sabe a qué OT pertenece.
**Impacto:** No se puede saber "¿qué repuestos se usaron en esta OT?" ni calcular costo de materiales por OT.
**Solución:** Agregar `ordenId` opcional a `salidaStock`. Al agregar repuesto a una OT, se descuenta del stock automáticamente.

### Gap 5 — Factura sin desglose de ítems (⚠️ INVOICE_ITEMS)
**Problema:** La factura usa `orden.totalCost` como único valor. No muestra servicios ni repuestos individuales.
**Impacto:** El cliente recibe una factura de 1 línea sin detalle.
**Solución:** Al facturar, iterar los `orden_servicios` y `orden_repuestos` de la OT y generar líneas de detalle en `fiscal_documento_detalles`.

### Gap 6 — Factura no actualiza CxC (❌ CXC_AUTO)
**Problema:** Cuando se emite una factura (ingreso por cobrar), no se actualiza el `estado_pago` de la factura a "PENDIENTE".
**Impacto:** La vista de CxC no refleja automáticamente las facturas emitidas.
**Solución:** Al emitir factura, setear `facturas.estado_pago = 'PENDIENTE'`, `saldo_pendiente = total`, `fecha_vencimiento = 30 días`.

### Gap 7 — Cobro no actualiza tesorería (❌ PAYMENT_TREASURY)
**Problema:** No hay endpoint para registrar un pago/cobro. Cuando el cliente paga, no se crea un `movimiento_tesoreria`.
**Impacto:** La tesorería no refleja los cobros reales. El saldo de cuentas bancarias no se actualiza con los pagos.
**Solución:** Endpoint `POST /finance/payments/register` que: recibe facturaId + monto + medioPago + cuentaId → crea movimiento_tesoreria INGRESO → actualiza factura.estado_pago/saldo_pendiente → emite evento COBRO al Accounting Bus.

### Gap 8 — Pago a proveedores no vinculado (❌ PAYMENT_CXP)
**Problema:** Pagar una factura de proveedor requiere un movimiento de egreso manual.
**Solución:** Endpoint `POST /finance/treasury/facturas-proveedor/:id/pagar` que registra el egreso y actualiza el estado.

---

## Re‑planned Roadmap

El roadmap se replantifica para **cerrar las brechas de integración** del flujo operativo primero, dejando analytics y dashboard ejecutivo para después.

### Sprint 8 — Catálogo de Servicios + OT Items + VIN Auto

**Duración estimada:** 10 días hábiles
**Dependencia:** Workshop module completo ✅, Inventory module completo ✅

| Epic | Historias | Backend | Frontend |
|------|-----------|---------|----------|
| **8.1 Catálogo** | Tabla `servicios_catalogo` + CRUD | `schema/services-catalog.ts`, `routes/services-catalog.ts` | Tabla + modal CRUD en app.js |
| **8.2 OT Items** | Tablas `orden_servicios` + `orden_repuestos` + cálculo automático de totalCost | `schema/order-items.ts`, `routes/order-items.ts`, `services/order-items.service.ts` | Modal agregar servicios/repuestos a OT desde app.js |
| **8.3 VIN Auto** | Endpoint POST /workshop/vehiculos/decode-vin | Integrar NHTSA en vehicle.service.ts | Autocompletar form check‑in al escanear/pegar VIN |
| **8.4 Stock ↔ OT** | Agregar `ordenId` a `salidaStock` | Modificar `stock.service.ts` | — |

**Archivos a crear:**
- `src/modules/workshop/schema/services-catalog.ts`
- `src/modules/workshop/schema/order-items.ts`
- `src/modules/workshop/routes/services-catalog.ts`
- `src/modules/workshop/routes/order-items.ts`
- `src/modules/workshop/services/order-items.service.ts`
- `src/shared/database/migrations/0016_workshop_items.sql`

### Sprint 9 — Facturación con Detalle + CxC Automático

**Duración estimada:** 8 días hábiles
**Dependencia:** Sprint 8 (OT items deben existir)

| Epic | Historias | Backend | Frontend |
|------|-----------|---------|----------|
| **9.1 Factura itemizada** | Al facturar, iterar OT items → `fiscal_documento_detalles` + factura multínea | Modificar `invoice.routes.ts` | Mostrar detalle en vista factura |
| **9.2 CxC automático** | Al emitir factura, setear estado_pago/saldo_pendiente | Modificar `invoice.routes.ts` | — |
| **9.3 Cobros** | POST /finance/payments/register → movimiento_tesorería + actualizar factura | `services/treasury/payment.service.ts`, `routes/payment.routes.ts` | Formulario cobro + listado pagos |
| **9.4 Pago Proveedores** | POST /finance/treasury/facturas-proveedor/:id/pagar | Modificar `treasury.service.ts` | Botón pagar en CxP |

**Archivos a crear:**
- `src/modules/finance/services/treasury/payment.service.ts`
- `src/modules/finance/routes/payment.routes.ts`

### Sprint 10 — Dashboard Ejecutivo + Analytics Base

**Duración estimada:** 10 días hábiles
**Dependencia:** Sprints 8+9 (flujo operativo conectado)

| Epic | Historias | Backend | Frontend |
|------|-----------|---------|----------|
| **10.1 Dashboard ejecutivo** | Vista resumen con datos de todos los módulos en tiempo real | Dashboard service con agregaciones | Tarjetas KPI, gráficos CSS, tendencias |
| **10.2 Analytics base** | Reportes de productividad, rentabilidad por servicio, top clientes, eficiencia taller | `analytics.service.ts`, endpoints | Tablas + filtros + export |
| **10.3 Refactor app.js** | Dividir monolito en módulos JS | — | `js/contabilidad.js`, `js/tesoreria.js`, `js/taller.js`, `js/inventario.js` |

**Nota:** Analytics y Dashboard se benefician de tener el flujo completo funcionando (Sprint 8+9), porque pueden reportar sobre datos reales de servicios, repuestos, costos por OT, ciclos de pago, etc.

### Sprint 11 — Presupuestos + Control de Gestión

**Duración estimada:** 8 días hábiles
**Dependencia:** Sprint 10 (dashboard existente para métricas base)

| Epic | Historias |
|------|-----------|
| **11.1 Presupuestos** | Budget por centro de costo, comparativa real vs presupuestado, alertas de desvío |
| **11.2 Control de gestión** | Balanced scorecard, cumplimiento de metas, rentabilidad por línea |

---

## Key Architectural Decisions

### 1. OT Items como tablas separadas (no JSON)
**Decisión:** `orden_servicios` y `orden_repuestos` como tablas PostgreSQL con FKs, no como columnas JSONB en `ordenes_trabajo`.
**Razón:** JSONB impide joins, reporting y constraints. Las tablas permiten FK a `servicios_catalogo` (precio sugerido) y a `repuestos` (stock actual), además de reportes de rentabilidad por servicio.

### 2. Payment Service como middleware
**Decisión:** `payment.service.ts` orquesta: creación de movimiento_tesorería + actualización de factura.estado_pago + emisión al Accounting Bus.
**Razón:** Un pago debe actualizar 3 sistemas (tesorería, CxC, contabilidad) atómicamente. Centralizar la lógica en un servicio evita inconsistencias.

### 3. Cálculo de totalCost en tiempo real
**Decisión:** `ordenes_trabajo.totalCost` se recalcula con cada INSERT/UPDATE/DELETE en `orden_servicios` y `orden_repuestos` vía trigger SQL o hook en service layer.
**Razón:** Garantiza que el total de la OT esté siempre sincronizado sin necesidad de recalcular manualmente.

### 4. No tocar migraciones existentes
**Decisión:** Las nuevas tablas y columnas se agregan vía nuevas migraciones (0016+). No se modifican migraciones existentes.
**Razón:** Las migraciones 0000-0015 ya están aplicadas en producción. Modificarlas rompería el estado.

### 5. Frontend monolítico se mantiene (por ahora)
**Decisión:** El refactor de app.js a módulos JS separados se posterga a Sprint 10.
**Razón:** Refactorizar 3963 líneas ahora retrasaría la funcionalidad crítica del flujo. Se prioriza cerrar brechas de integración primero.

---

## Risk Assessment

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| **R1 — NHTSA API no responde** | Media | Bajo | Cachear VIN decode local, permitir ingreso manual |
| **R2 — Catálogo de servicios se vuelve complejo** | Media | Medio | MVP con campos mínimos (nombre, precio, categoría). Precios históricos después. |
| **R3 — app.js llega a 5000+ líneas** | Alta | Medio | Postergar refactor a Sprint 10, medir crecimiento semanal |
| **R4 — Stock negativo al agregar repuestos a OT** | Media | Alto | Validar stock disponible antes de salida. Mostrar alerta. |
| **R5 — Inconsistencia precio en OT vs catálogo** | Alta | Bajo | El precio en `orden_repuestos` se congela al momento de agregar (no se actualiza si el catálogo cambia) |

---

## Resumen de Esfuerzo

| Sprint | Enfoque | Días estimados | Archivos nuevos |
|--------|---------|----------------|-----------------|
| **8** | Catálogo Servicios + OT Items + VIN Auto + Stock↔OT | 10 | 6 nuevos, ~8 modificados |
| **9** | Factura detallada + CxC Auto + Cobros + Pagos Prov | 8 | 2 nuevos, ~6 modificados |
| **10** | Dashboard Ejecutivo + Analytics + Refactor JS | 10 | 4 nuevos, ~5 modificados |
| **11** | Presupuestos + Control Gestión | 8 | 3 nuevos, ~3 modificados |
| **Total** | | **36 días hábiles** | **~15 archivos nuevos** |

---

## Diagrama de Dependencias

```
Sprint 8 (Servicios + OT Items + VIN)
    │
    ▼
Sprint 9 (Factura detallada + Cobros + CxC)
    │
    ▼
Sprint 10 (Dashboard + Analytics)
    │
    ▼
Sprint 11 (Presupuestos)
```

**No hay caminos paralelos** — cada sprint depende de las tablas y servicios del anterior.
