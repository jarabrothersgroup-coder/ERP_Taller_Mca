# Sprint 6 — Contabilidad Automática + Reportes Financieros

> **Inicio:** —
> **Fin:** —
> **Principio rector:** Cada transacción del sistema genera su asiento contable automáticamente. El usuario nunca toca la contabilidad manualmente.

---

## Objetivo del Sprint

1. **Cerrar los gaps de auto-contabilidad** — Facturación (Ventas) y Nómina deben generar asientos automáticos
2. **Construir el motor de asientos automáticos** — Servicio reutilizable que cualquier módulo invoca
3. **Implementar Balance General + Estado de Resultados** (backend)
4. **Construir vistas frontend** para que el usuario visualice los resultados contables

---

## Epic 1: Motor de Contabilidad Automática

### HISTORIA 1.1 — Accounting Bus Service

**Descripción:** Servicio central que, dado un tipo de transacción y datos, genera el asiento contable completo usando el plan de cuentas y los mappings configurados.

**Archivo:** `src/modules/finance/services/accounting/accounting-bus.service.ts`

**API interna:**
```ts
interface AccountingEvent {
  tenantSlug: string;
  tipo: 'VENTA' | 'COMPRA' | 'CONSUMO_STOCK' | 'NOMINA' | 'DEPRECIACION' | 'PAGO' | 'COBRO';
  fecha: Date;
  referenciaId: string;          // ID de la transacción origen
  referenciaTipo: string;        // 'factura', 'orden_trabajo', etc.
  lineas: AccountingLine[];
  descripcion: string;
}

async function emitAccountingEvent(event: AccountingEvent): Promise<AsientoResult>
```

**Funcionalidad:**
- [ ] Recibe evento → arma el `createAsiento()` con líneas Debe/Haber
- [ ] Asigna móduloOrigen según tipo de evento
- [ ] Valida balance (∑Debe = ∑Haber) antes de insertar
- [ ] Retorna `{ asientoId, asientoNumero }`
- [ ] Si falla, loguea error pero no revienta la transacción origen (graceful degradation)
- [ ] Audit: registra en audit_log la creación automática

**Criterios de aceptación:**
- [ ] Servicio importable por cualquier módulo
- [ ] Asientos creados con estado CONTABILIZADO (no BORRADOR)
- [ ] Error en contabilidad no bloquea la transacción principal

---

### HISTORIA 1.2 — Inventory Accounts Map (Refuerzo)

**Descripción:** Verificar que `inventory_accounts_map` tenga entries para TODAS las categorías de repuestos. Complementar seed si falta.

**Archivos:** `src/shared/database/seed.ts`, `src/modules/inventory/schema/inventory-accounts-map.ts`

**Tareas:**
- [ ] Verificar mapping existente
- [ ] Agregar entries por categoría si falta (general `*`, filtros específicos)
- [ ] Verificar que `stock.service.ts` use correctamente el mapping

---

## Epic 2: Auto-Contabilidad — Ventas (Facturación)

### HISTORIA 2.1 — Asiento automático al emitir factura

**Descripción:** Cuando se emite una factura (POST /finance/invoices/issue), el sistema debe generar automáticamente:

```
Debe:  Clientes (1.1.02)        → Total factura
Haber: Ingreso por Servicios    → Base Imponible
Haber: IVA Débito Fiscal        → IVA
```

**Archivos a modificar:**
- `src/modules/finance/routes/invoice.routes.ts`
- `src/modules/finance/services/accounting/accounting-bus.service.ts`

**Tareas:**
- [ ] Detectar si la factura tiene monto de IVA (10% estándar PY)
- [ ] Buscar cuentas contables: Clientes, Ingreso, IVA Débito
- [ ] Crear asiento automático con `accountingBus.emit()`
- [ ] Guardar `asientoId` en la factura (ver schema si tiene campo)
- [ ] Manejar facturación MANUAL vs ELECTRÓNICA (ambas deben contabilizar)

**Criterios de aceptación:**
- [ ] Toda factura emitida genera un asiento CONTABILIZADO
- [ ] Asiento linkeado a la factura (`documentoRef`, `moduloOrigen='SIFEN'`)
- [ ] Coexists con facturación manual existente

---

## Epic 3: Auto-Contabilidad — Nómina (Payroll)

### HISTORIA 3.1 — Asiento automático al calcular nómina

**Descripción:** Cuando se ejecuta `POST /api/v1/finance/payroll/calculate`, debe generar:

```
Debe:  Gastos de Personal (6.1.02)    → Total comisiones liberadas
Haber: Provisiones por Pagar (2.1.05) → Total comisiones liberadas
```

**Archivos a modificar:**
- `src/modules/finance/services/FinancialOrchestratorService.ts`
- `src/modules/finance/routes/payroll-routes.ts`

**Tareas:**
- [ ] Después de calcular comisiones, sumar montos LIBERADOS
- [ ] Buscar cuentas: Gasto Sueldos, Provisiones
- [ ] Crear asiento automático
- [ ] Incluir en la respuesta del endpoint

**Criterios de aceptación:**
- [ ] Nómina mensual genera asiento de provisión
- [ ] Asiento linkeado al período (documentoRef mes/año)
- [ ] No duplica asientos si se recalcula el mismo mes

---

## Epic 4: Backend — Estados Financieros

### HISTORIA 4.1 — Balance General

**Endpoint:** `GET /finance/contabilidad/balance-general/:fecha`

**Archivo:** `src/modules/finance/services/accounting/balance.service.ts`

**Tareas:**
- [ ] Agrupar cuentas por tipo (ACTIVO, PASIVO, PATRIMONIO)
- [ ] Calcular saldo = `saldo_inicial + Σ debe - Σ haber` de CONTABILIZADOS
- [ ] Estructura jerárquica por nivel de cuenta
- [ ] Validar: Total Activo = Total Pasivo + Patrimonio

**Criterios de aceptación:**
- [ ] Balance a cualquier fecha histórica
- [ ] Sumas cuadradas

---

### HISTORIA 4.2 — Estado de Resultados

**Endpoint:** `GET /finance/contabilidad/estado-resultados/:anho/:mes`

**Archivo:** `src/modules/finance/services/accounting/pnl.service.ts`

**Tareas:**
- [ ] Ingresos = movimientos cuentas INGRESO en el período
- [ ] Costos = movimientos cuentas COSTO
- [ ] Gastos = movimientos cuentas GASTO
- [ ] Utilidad Bruta = Ingresos - Costos
- [ ] Utilidad Neta = Bruta - Gastos
- [ ] Versión acumulada anual

---

## Epic 5: Frontend — Vistas de Contabilidad

### HISTORIA 5.1 — Sidebar Contabilidad + Layout

**Tareas:**
- [ ] Agregar "Contabilidad" al sidebar con submenú
- [ ] Layout reutilizable (filtros + tabla + modal)
- [ ] Mover módulos JS a archivos separados (opcional pero recomendado)

### HISTORIA 5.2 — Vista Plan de Cuentas

**Endpoint:** `GET /finance/contabilidad/cuentas/arbol`

**Tareas:**
- [ ] Árbol jerárquico con indentación por nivel
- [ ] Badge por tipo de cuenta (color)
- [ ] CRUD con modal (crear cuenta con select de padre jerárquico)
- [ ] Desactivar cuenta

### HISTORIA 5.3 — Vista Asientos Contables

**Tareas:**
- [ ] Tabla paginada: número, fecha, concepto, totales, estado, módulo
- [ ] Filtros: período, módulo, estado
- [ ] Modal crear asiento con editor de líneas (∑Debe = ∑Haber en frontend)
- [ ] Modal detalle con líneas enriquecidas
- [ ] Botón anular con confirmación

### HISTORIA 5.4 — Vista Balance General

**Tareas:**
- [ ] Selector de fecha
- [ ] Tres secciones: ACTIVO | PASIVO | PATRIMONIO
- [ ] Cada sección con subtotales por grupo
- [ ] Total Activo = Total Pasivo + Patrimonio (check visual)

### HISTORIA 5.5 — Vista Estado de Resultados

**Tareas:**
- [ ] Selector de período (mes/año + opción acumulado anual)
- [ ] Secciones: Ingresos, Costos, Gastos
- [ ] Utilidad Bruta y Neta destacadas
- [ ] Formato moneda (Gs.)

### HISTORIA 5.6 — Vista Libros Contables

**Tareas:**
- [ ] Tabs: Diario | Mayor | Inventario
- [ ] Selector de período
- [ ] Tabla con datos enriquecidos
- [ ] Selector de cuenta para libro mayor

### HISTORIA 5.7 — Vista Impuestos (IVA, IRE, IDU, ISC, INR)

**Tareas:**
- [ ] Tabs por impuesto
- [ ] Botón calcular + mostrar resultado
- [ ] Historial de liquidaciones

---

## Epic 6: Datos y Migraciones

### HISTORIA 6.1 — Migración CAPA 4-5

**Archivo:** `src/shared/database/migrations/0013_capa4_capa5.sql`
- [ ] Tabla `audit_log`
- [ ] Tabla `centros_costo`

### HISTORIA 6.2 — Seed Plan de Cuentas PY Completo

**Tareas:**
- [ ] 30+ cuentas en 4 niveles siguiendo PUC paraguayo
- [ ] Cuentas de: Caja, Bancos, Clientes, Inventario, Activo Fijo, Proveedores, IVA, Capital, Ventas, Costos, Gastos
- [ ] Vincular a tenant "taller-el-chero"

### HISTORIA 6.3 — Seed Centros de Costo

**Tareas:**
- [ ] Nivel 1: Taller, Administración, Ventas
- [ ] Nivel 2: Mecánica Rápida, Diagnóstico, Carrocería, Repuestos

---

## Resumen de Implementación

### Fase 1 — Backend (días 1-4)
| Día | Historia | Archivos |
|-----|----------|----------|
| 1 | 1.1 Accounting Bus | `accounting-bus.service.ts` |
| 1-2 | 2.1 Auto VENTA | `invoice.routes.ts` |
| 2 | 3.1 Auto NOMINA | `FinancialOrchestratorService.ts`, `payroll-routes.ts` |
| 3 | 4.1 Balance General | `balance.service.ts` |
| 3-4 | 4.2 Estado Resultados | `pnl.service.ts` |

### Fase 2 — Datos (día 4)
| Día | Historia | Archivos |
|-----|----------|----------|
| 4 | 6.1 Migración | `0013_capa4_capa5.sql` |
| 4 | 6.2 Seed PY | `seed.ts` |

### Fase 3 — Frontend (días 5-12)
| Día | Historia | Archivos |
|-----|----------|----------|
| 5 | 5.1 Sidebar + Layout | `index.html`, `app.js` |
| 6-7 | 5.2 Plan Cuentas | `app.js` |
| 7-8 | 5.3 Asientos | `app.js` |
| 9 | 5.4 Balance General | `app.js` |
| 9 | 5.5 Estado Resultados | `app.js` |
| 10 | 5.6 Libros Contables | `app.js` |
| 11 | 5.7 Impuestos | `app.js` |
| 12 | Testing + fixes | — |

**Total: ~12 días hábiles**

---

## Principios de Diseño

1. **La contabilidad es automática, no manual** — El usuario no crea asientos a mano. Los asientos se generan solos al facturar, comprar, pagar nómina, etc.
2. **Graceful degradation** — Si el motor contable falla, la transacción origen NO se bloquea. Se loguea el error para revisión.
3. **Trazabilidad** — Cada asiento tiene `moduloOrigen` + `documentoRef` + `ordenTrabajoId` para rastrear la transacción origen.
4. **Inmutabilidad** — Los asientos CONTABILIZADOS no se modifican. Ajustes se hacen con asientos inversos (ya implementado CAPA 4).
5. **Auditoría** — Cada creación automática se registra en `audit_log`.
