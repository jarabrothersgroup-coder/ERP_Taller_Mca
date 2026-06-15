# Sprint 7 — Tesorería + Cuentas por Cobrar/Pagar + Flujo de Caja

> **Inicio:** —
> **Fin:** —
> **Dependencia:** Sprint 6 completo (contabilidad automática + estados financieros funcionales)
> **Riesgo principal:** Sin tesorería, el ERP tiene contabilidad histórica pero no gestión de liquidez — el taller no puede saber si mañana tiene caja para pagar sueldos o proveedores

---

## Objetivo del Sprint

1. **Tesorería:** Registrar y consultar movimientos de efectivo/bancos, saldos diarios, conciliación
2. **Cuentas por Cobrar:** Gestionar facturas emitidas pendientes de cobro, antigüedad de saldos, cobranzas
3. **Cuentas por Pagar:** Gestionar facturas de proveedores pendientes de pago, programación de pagos
4. **Flujo de Caja:** Proyección de ingresos y egresos, posición de liquidez, alertas de descubierto
5. **Frontend:** Dashboard de tesorería con posición de caja en tiempo real + vistas de gestión

---

## Epic 1: Core de Tesorería — Caja y Bancos

### HISTORIA 1.1 — Esquema de Tesorería

**Descripción:** Tablas base para gestión de tesorería con movimientos diarios, conciliación bancaria y posición de caja multi-moneda.

**Nuevas tablas drizzle:**
```typescript
// cuentas_bancarias — Cuentas bancarias del taller
export const cuentasBancarias = pgTable("cuentas_bancarias", {
  id: uuid("id").primaryKey().defaultRandom(),
  codigo: text("codigo").notNull(),           // ej: "BCO-001"
  nombre: text("nombre").notNull(),            // ej: "Banco Continental — Cta. Cte."
  tipo: text("tipo").notNull(),               // "CAJA_FISICA" | "CTA_CTE" | "CAJA_AHORRO" | "Billetera Digital"
  moneda: text("moneda").default("PYG"),
  saldoInicial: numeric("saldo_inicial").default("0").notNull(),
  saldoActual: numeric("saldo_actual").default("0").notNull(),
  numeroCuenta: text("numero_cuenta"),
  banco: text("banco"),                        // Nombre del banco
  activo: boolean("activo").default(true),
  tenantSlug: text("tenant_slug").notNull(),
  createdAt: timestamptz("created_at").defaultNow(),
  updatedAt: timestamptz("updated_at").defaultNow(),
});

// movimientos_tesoreria — Movimientos de caja/bancos
export const movimientosTesorería = pgTable("movimientos_tesoreria", {
  id: uuid("id").primaryKey().defaultRandom(),
  tipo: text("tipo").notNull(),               // "INGRESO" | "EGRESO" | "TRANSFERENCIA" | "AJUSTE"
  medioPago: text("medio_pago").notNull(),     // "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "TARJETA_DEBITO" | "TARJETA_CREDITO"
  cuentaId: uuid("cuenta_id").references(() => cuentasBancarias.id),
  cuentaContableId: uuid("cuenta_contable_id").references(() => planCuentas.id),
  monto: numeric("monto").notNull(),
  moneda: text("moneda").default("PYG"),
  tipoCambio: numeric("tipo_cambio").default("1"),
  fecha: timestamptz("fecha").notNull(),
  fechaValor: timestamptz("fecha_valor"),       // Fecha de liquidación real
  concepto: text("concepto").notNull(),
  referenciaTipo: text("referencia_tipo"),       // "FACTURA_CLIENTE" | "FACTURA_PROVEEDOR" | "NOMINA" | "OTRO"
  referenciaId: text("referencia_id"),
  conciliado: boolean("conciliado").default(false),
  fechaConciliacion: timestamptz("fecha_conciliacion"),
  asientoId: uuid("asiento_id").references(() => asientosContables.id),
  tenantSlug: text("tenant_slug").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamptz("created_at").defaultNow(),
});

// conciliacion_bancaria — Resumen de conciliaciones mensuales
export const conciliacionBancaria = pgTable("conciliacion_bancaria", {
  id: uuid("id").primaryKey().defaultRandom(),
  cuentaId: uuid("cuenta_id").references(() => cuentasBancarias.id).notNull(),
  periodo: text("periodo").notNull(),            // "2026-07"
  saldoLibros: numeric("saldo_libros").notNull(),
  saldoBanco: numeric("saldo_banco").notNull(),
  diferencia: numeric("diferencia").notNull(),
  conciliado: boolean("conciliado").default(false),
  tenantSlug: text("tenant_slug").notNull(),
  createdAt: timestamptz("created_at").defaultNow(),
});
```

**Migración:** `0015_tesoreria.sql`

**Criterios de aceptación:**
- [ ] Tablas creadas con índices por tenant_slug
- [ ] Migración idempotente (IF NOT EXISTS)
- [ ] Relaciones con plan_cuentas para contabilización automática

---

### HISTORIA 1.2 — CRUD Bancario + Movimientos

**Descripción:** Endpoints para gestionar cuentas bancarias y registrar movimientos de tesorería.

**Endpoints:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/finance/treasury/accounts` | Crear cuenta bancaria/billetera |
| GET | `/finance/treasury/accounts` | Listar cuentas activas |
| PATCH | `/finance/treasury/accounts/:id` | Editar/desactivar cuenta |
| POST | `/finance/treasury/movements` | Registrar movimiento (ingreso/egreso) |
| GET | `/finance/treasury/movements` | Listar movimientos (con filtros: cuenta, fecha, tipo) |
| GET | `/finance/treasury/movements/:id` | Detalle de movimiento |
| GET | `/finance/treasury/position` | Posición de caja consolidada |

**Reglas de negocio:**
- Al crear movimiento INGRESO → incrementa saldoActual de la cuenta
- Al crear movimiento EGRESO → decrementa saldoActual (rechazar si saldo insuficiente warning)
- Cada movimiento puede generar asiento contable automático vía Accounting Bus
- TRANSFERENCIA: genera dos movimientos (egreso de origen + ingreso a destino)
- Filtros: fecha desde/hasta, cuentaId, tipo, medioPago, conciliado

**Criterios de aceptación:**
- [ ] Saldo de cuenta se actualiza automáticamente
- [ ] Transferencias crean doble asiento equilibrado
- [ ] Warning de sobregiro (no bloqueante)
- [ ] Movimiento opcionalmente linkeado a factura/nómina

---

### HISTORIA 1.3 — Conciliación Bancaria (Básica)

**Descripción:** Herramienta para conciliar movimientos registrados vs extracto bancario.

**Endpoints:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/finance/treasury/reconciliation/start` | Iniciar conciliación: crea resumen con saldo inicial |
| POST | `/finance/treasury/reconciliation/match` | Marcar movimiento como conciliado |
| GET | `/finance/treasury/reconciliation/:periodo` | Obtener estado de conciliación |
| POST | `/finance/treasury/reconciliation/close` | Cerrar conciliación del período |

**Reglas:**
- Carga movimientos del período y permite marcar individualmente como conciliados
- Muestra diferencia: saldo libros vs saldo banco
- Solo cierra si diferencia = 0

**Criterios de aceptación:**
- [ ] Iniciar conciliación para un período
- [ ] Marcar/desmarcar movimientos como conciliados
- [ ] Diferencia visible en tiempo real
- [ ] Cierre de período bloquea modificaciones

---

## Epic 2: Cuentas por Cobrar

### HISTORIA 2.1 — Gestión de Cobranzas

**Descripción:** Seguimiento de facturas emitidas pendientes de cobro con antigüedad de saldos.

**Endpoints:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/finance/treasury/receivables` | Listar cuentas por cobrar (facturas pendientes) |
| GET | `/finance/treasury/receivables/aging` | Reporte de antigüedad de saldos |
| POST | `/finance/treasury/receivables/:id/collect` | Registrar cobro de factura |
| GET | `/finance/treasury/receivables/:id` | Detalle de factura con historial de cobros |

**Reglas de negocio:**
- Una factura emitida con estado distinto de paga se considera por cobrar
- El cobro puede ser parcial (abono) o total
- Al registrar cobro: crea movimiento de tesorería, actualiza saldo de la factura
- Si cobro total → factura pasa a "PAGA"
- Si cobro parcial → factura queda "PARCIAL"
- Ajusta saldo contable (debe: caja/banco, haber: deudores)

**Estructura de antigüedad:**
```
| 0-30 días | 31-60 días | 61-90 días | 90+ días | Total |
```

**Criterios de aceptación:**
- [ ] Lista de facturas pendientes con cliente, monto, fecha, días de vencimiento
- [ ] Reporte de aging con rango de fechas
- [ ] Cobro parcial refleja saldo remanente
- [ ] Movimiento de tesorería se genera automáticamente al cobrar

---

### HISTORIA 2.2 — Facturas de Clientes (Refuerzo Frontend)

**Descripción:** Vincular las facturas existentes al módulo de tesorería y mostrar estado de pago.

**Modificaciones a facturas existentes:**
- Agregar columna `estado_pago` a facturas (PENDIENTE | PARCIAL | PAGA | ANULADA)
- Agregar columna `saldo_pendiente`
- Agregar columna `fecha_vencimiento`
- Endpoint PATCH existente actualiza estado_pago

**Endpoints adicionales:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/finance/facturas?pendientes=true` | Solo facturas no pagadas |
| POST | `/finance/treasury/receivables/bulk-collect` | Cobro masivo (seleccionar varias facturas) |

**Criterios de aceptación:**
- [ ] Facturas muestran estado de pago
- [ ] Cobro masivo desde selección múltiple

---

## Epic 3: Cuentas por Pagar

### HISTORIA 3.1 — Gestión de Pagos a Proveedores

**Descripción:** Registro de facturas de proveedores y gestión de pagos pendientes.

**Endpoints:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/finance/treasury/payables` | Registrar factura de proveedor |
| GET | `/finance/treasury/payables` | Listar cuentas por pagar |
| GET | `/finance/treasury/payables/aging` | Reporte de antigüedad |
| POST | `/finance/treasury/payables/:id/pay` | Registrar pago a proveedor |
| PATCH | `/finance/treasury/payables/:id` | Editar factura de proveedor |

**Estructura de factura de proveedor:**
```typescript
export const facturasProveedor = pgTable("facturas_proveedor", {
  id: uuid("id").primaryKey().defaultRandom(),
  proveedorId: uuid("proveedor_id"),          // FK → clients (o tabla proveedores)
  nroFactura: text("nro_factura").notNull(),  // Nro de factura del proveedor
  tipoDoc: text("tipo_doc").default("FACTURA"), // FACTURA | NOTA_CREDITO | OTRO
  total: numeric("total").notNull(),
  saldoPendiente: numeric("saldo_pendiente"),
  ivaMonto: numeric("iva_monto"),
  baseImponible: numeric("base_imponible"),
  fechaEmision: timestamptz("fecha_emision").notNull(),
  fechaVencimiento: timestamptz("fecha_vencimiento").notNull(),
  estadoPago: text("estado_pago").default("PENDIENTE"),
  concepto: text("concepto"),
  cuentaContableId: uuid("cuenta_contable_id"),
  ordenTrabajoId: uuid("orden_trabajo_id"),
  tenantSlug: text("tenant_slug").notNull(),
  createdAt: timestamptz("created_at").defaultNow(),
});
```

**Reglas:**
- Registrar factura recibida de proveedor (repuestos, servicios terceros, etc.)
- Pago puede ser total o parcial
- Pago parcial actualiza saldo_pendiente
- Pago genera movimiento de tesorería + asiento contable
- Alerta si fecha vencimiento próxima (7 días antes)

**Criterios de aceptación:**
- [ ] CRUD facturas de proveedor completo
- [ ] Reporte de antigüedad de proveedores
- [ ] Pago parcial actualiza correctamente
- [ ] Movimiento de tesorería y asiento contable generados

---

### HISTORIA 3.2 — Programación de Pagos

**Descripción:** Calendario de pagos programados con alertas de vencimiento.

**Endpoints:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/finance/treasury/payment-schedule` | Calendario de pagos próximos |
| POST | `/finance/treasury/payables/bulk-pay` | Pago masivo seleccionando facturas |
| POST | `/finance/treasury/payment-schedule/snooze` | Reprogramar pago |

**Pantalla:**
- Timeline: hoy → próximos 30/60/90 días con montos acumulados
- Facturas agrupadas por semana de vencimiento
- Badges: VENCE HOY (rojo), PRÓXIMOS 7 DÍAS (naranja), NORMAL (verde)

**Criterios de aceptación:**
- [ ] Vista de calendario de pagos
- [ ] Alertas visuales de vencimiento
- [ ] Pago masivo desde selección múltiple

---

## Epic 4: Flujo de Caja

### HISTORIA 4.1 — Proyección de Flujo de Caja

**Descripción:** Proyección de ingresos y egresos basada en facturas pendientes + gastos fijos.

**Endpoints:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/finance/treasury/cash-flow/projection` | Proyección a 30/60/90 días |
| GET | `/finance/treasury/cash-flow/actual` | Flujo real vs presupuesto |
| GET | `/finance/treasury/cash-flow/summary` | Resumen del día/semana/mes |

**Proyección calcula:**
- **Ingresos esperados:** Facturas por cobrar (según fecha de emisión + plazo promedio)
- **Egresos esperados:** Facturas de proveedores por pagar + nómina + gastos fijos
- **Saldo proyectado:** Saldo actual + ∑ingresos - ∑egresos por período

**Estructura de respuesta:**
```json
{
  "fecha": "2026-07-01",
  "saldoActual": 15000000,
  "proyeccion": [
    { "semana": "2026-07-01", "ingresos": 5000000, "egresos": 3200000, "saldo": 16800000 },
    { "semana": "2026-07-08", "ingresos": 3000000, "egresos": 8000000, "saldo": 11800000 },
    ...
  ],
  "alertas": [
    { "tipo": "SOBREGIRO", "fecha": "2026-07-15", "descripcion": "Posible descubierto de -₲500.000" },
  ]
}
```

**Criterios de aceptación:**
- [ ] Proyección semanal a 30/60/90 días
- [ ] Alerta automática si saldo proyectado < 0
- [ ] Integración con gastos fijos (fixed_expenses) + nómina

---

### HISTORIA 4.2 — Dashboard de Liquidez

**Descripción:** Dashboard visual del estado de tesorería.

**Cards principales:**
- **Posición de Caja:** Saldo consolidado hoy (₲)
- **Por Cobrar:** Total facturas pendientes + aging
- **Por Pagar:** Total facturas pendientes + próximos 7 días
- **Flujo Neto Proyectado:** Saldo proyectado a 30 días
- **Alertas:** Cantidad de alertas activas (sobregiro, vencimientos)

**Gráficos (CSS simple, sin librerías):**
- Barra de posición de caja: efectivo vs bancos
- Barra de aging: 0-30 / 31-60 / 61-90 / 90+
- Timeline de flujo proyectado (mini barras por semana)

**Criterios de aceptación:**
- [ ] Cards con datos en tiempo real
- [ ] Gráficos de barras con CSS
- [ ] Alertas visibles con contador

---

## Epic 5: Frontend — Vistas de Tesorería

### HISTORIA 5.1 — Sidebar + Tab Tesorería

**Descripción:** Nueva sección "Tesorería" en el sidebar del SPA con tabs internos.

**Tabs:**
| Tab | Contenido |
|-----|-----------|
| POSICIÓN | Dashboard de liquidez + cards |
| MOVIMIENTOS | Lista de movimientos con filtros |
| CUENTAS | CRUD cuentas bancarias |
| COBRAR | Facturas pendientes de cobro |
| PAGAR | Facturas pendientes de pago |
| PROYECCIÓN | Flujo de caja proyectado |
| CONCILIACIÓN | Conciliación bancaria |

**Archivos a modificar:**
- `src/shared/public/index.html` — Agregar "Tesorería" al sidebar
- `src/shared/public/app.js` — Tabs internos + funciones de renderizado

**Criterios de aceptación:**
- [ ] Sidebar con icono y label "Tesorería"
- [ ] Tabs navegables sin recargar
- [ ] Loaders mientras carga datos

---

### HISTORIA 5.2 — Vista Posición de Caja (Dashboard)

**Descripción:** Dashboard principal de tesorería.

**Layout:**
```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│  SALDO ACTUAL   │  POR COBRAR     │  POR PAGAR      │  FLUJO NETO     │
│  ₲ 15.000.000   │  ₲ 8.200.000    │  ₲ 5.300.000    │  ₲ 17.900.000   │
│  +3.2% vs ayer  │  12 facturas    │  8 facturas     │  próx 30 días   │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│  Posición por cuenta bancaria (tabla: banco, tipo, saldo, % del total)│
├──────────────────────────────────────────────────────────────────────┤
│  Alertas                                                             │
│  ⚠ VENCE HOY: Factura Proveedor #001 — ₲ 850.000                    │
│  ⚠ POSIBLE SOBREGIRO: Semana del 15/07 — ₲ -500.000                 │
└──────────────────────────────────────────────────────────────────────┘
```

**Criterios de aceptación:**
- [ ] 4 cards con datos reales de API
- [ ] Tabla de cuentas bancarias con saldos
- [ ] Lista de alertas priorizadas

---

### HISTORIA 5.3 — Vista de Movimientos

**Descripción:** Lista paginada de movimientos de tesorería con filtros.

**Columnas:** Fecha | Tipo | Cuenta | Medio | Concepto | Monto | Conciliado | Acciones
**Filtros:** Desde/Hasta, Tipo (INGRESO/EGRESO), Cuenta, Medio Pago, Conciliado
**Acciones:** Click → modal detalle, crear movimiento, conciliar

**Criterios de aceptación:**
- [ ] Tabla paginada con 25 por página
- [ ] Filtros combinables
- [ ] Modal crear movimiento con select de cuenta bancaria
- [ ] Modal detalle con toda la información

---

### HISTORIA 5.4 — Vistas de Cobros y Pagos

**Descripción:** Tablas de cuentas por cobrar y por pagar con aging y acciones de cobro/pago.

**Cuentas por Cobrar:**
- Tabla: Cliente | Factura # | Fecha Emisión | Vencimiento | Total | Saldo Pend. | Días | Acción
- Badge aging: verde (0-30), amarillo (31-60), naranja (61-90), rojo (90+)
- Botón "Cobrar" → modal monto + medio pago

**Cuentas por Pagar:**
- Tabla: Proveedor | Factura # | Fecha | Vencimiento | Total | Saldo Pend. | Días | Acción
- Badge de urgencia: rojo (vence hoy), naranja (próximos 7 días)
- Botón "Pagar" → modal monto + cuenta origen

**Criterios de aceptación:**
- [ ] Tablas con aging visual
- [ ] Modal de cobro/pago funcional
- [ ] Actualización asíncrona sin recargar página
- [ ] Totalizador: suma de saldos pendientes

---

### HISTORIA 5.5 — Vista de Proyección de Flujo de Caja

**Descripción:** Timeline semanal del flujo de caja proyectado.

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  Saldo Actual: ₲ 15.000.000    │   Proyectado 30d: ₲ 17.900.000     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Sem 1   ████████████████████ Ingresos: ₲ 5.0M                      │
│          ░░░░░░░░░░░░░░░░░░░░ Egresos:  ₲ 3.2M                      │
│          ───── Saldo: ₲ 16.8M ─────                                  │
│                                                                      │
│  Sem 2   ████████████████ Ingresos: ₲ 3.0M                          │
│          ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Egresos: ₲ 8.0M              │
│          ───── Saldo: ₲ 11.8M ─────                                  │
│                                                                      │
│  Sem 3   ⚠ POSIBLE SOBREGIRO: Saldo proyectado ₲ -500.000           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Criterios de aceptación:**
- [ ] Barras de ingresos vs egresos por semana
- [ ] Alertas en línea si saldo < 0
- [ ] Selector de horizonte (30/60/90 días)

---

### HISTORIA 5.6 — Vista de Conciliación Bancaria

**Descripción:** Panel para conciliar movimientos vs extracto bancario.

**Layout:**
- Selector: cuenta + período
- Botón "Iniciar Conciliación"
- Tabla de movimientos con checkbox de conciliado
- Resumen: saldo libros, saldo banco, diferencia
- Botón "Cerrar Conciliación" (habilitado solo si diferencia=0)

**Criterios de aceptación:**
- [ ] Conciliación cuenta por cuenta
- [ ] Checkbox toggle individual y masivo
- [ ] Diferencia en tiempo real
- [ ] Cierre solo cuando balancea

---

## Epic 6: Datos y Migraciones

### HISTORIA 6.1 — Migración 0015: Tesorería

**Descripción:** Migración SQL para las tablas de tesorería.

**Archivo:** `src/shared/database/migrations/0015_treasury.sql`

**Tablas a crear:**
- `cuentas_bancarias`
- `movimientos_tesoreria`
- `conciliacion_bancaria`
- `facturas_proveedor`
- Modificaciones a `facturas`: columns `estado_pago`, `saldo_pendiente`, `fecha_vencimiento`

**Criterios de aceptación:**
- [ ] Migración idempotente
- [ ] Índices por tenant_slug, fechas, estado
- [ ] Rollback documentado

---

### HISTORIA 6.2 — Seed de Tesorería

**Descripción:** Datos de prueba para tesorería.

**Datos:**
- 3 cuentas bancarias: Caja Chica (efectivo), Banco Continental (cta cte), Billetera Digital (Giropay)
- 10 movimientos de ejemplo (ingresos y egresos)
- 3 facturas de clientes pendientes
- 3 facturas de proveedores pendientes

**Criterios de aceptación:**
- [ ] Seed ejecutable con `npx tsx scripts/seed-treasury.ts`
- [ ] Datos coherentes con tenant "taller-el-chero"
- [ ] Movimientos linkeados a cuentas existentes

---

## Epic 7: Contabilización Automática

### HISTORIA 7.1 — Accounting Bus: Eventos de Tesorería

**Descripción:** Extender el Accounting Bus para manejar eventos de tesorería.

**Nuevos tipos de evento:**
```typescript
'COBRO_FACTURA'    // Cobro de factura a cliente
'PAGO_PROVEEDOR'   // Pago a proveedor
'MOVIMIENTO_CAJA'  // Movimiento de caja genérico
'TRANSFERENCIA'    // Transferencia entre cuentas
'CONCILIACION'     // Ajuste por conciliación
```

**Asientos generados:**

**Cobro de factura:**
```
Debe:  Caja/Banco (1.1.1.01)          → Monto cobrado
Haber: Clientes (1.1.2.01)           → Monto cobrado
```

**Pago a proveedor:**
```
Debe:  Proveedores (2.1.1.01)         → Monto pagado
Haber: Caja/Banco (1.1.1.01)         → Monto pagado
```

**Criterios de aceptación:**
- [ ] Accounting Bus acepta eventos de tesorería
- [ ] Códigos de cuenta resueltos desde accounting-bus-codes.ts
- [ ] Asiento linkeado a movimiento de tesorería

---

## Epic 8: Infraestructura y Build

### HISTORIA 8.1 — Refactor app.js (Opcional)

**Descripción:** Dividir el app.js actual (~3250 líneas) en módulos separados para mantener manejable la base de código.

**Archivos:**
- `src/shared/public/js/contabilidad.js` — Vistas contables (ya existentes)
- `src/shared/public/js/tesoreria.js` — Vistas de tesorería (nuevas)
- `src/shared/public/js/shared.js` — Helpers comunes (api, dom, esc, renderHistorial, etc.)

**Criterios de aceptación:**
- [ ] app.js dividido sin perder funcionalidad
- [ ] Módulos cargados como ES modules
- [ ] Funcionalidad existente intacta

---

## Resumen de Implementación

### Fase 1 — Backend Core (días 1-3)
| Día | Historias | Archivos |
|-----|-----------|----------|
| 1 | 1.1 Esquema + 6.1 Migración | `accounting.ts` (schema), `0015_treasury.sql` |
| 1-2 | 1.2 CRUD Bancario + Movimientos | `treasury.service.ts`, `treasury.routes.ts` |
| 2 | 1.3 Conciliación Básica | `treasury.service.ts` |
| 2-3 | 2.1 Cuentas por Cobrar | `treasury.service.ts` |
| 3 | 3.1 Cuentas por Pagar | `treasury.service.ts` |

### Fase 2 — Flujo de Caja + Contabilización (días 4-5)
| Día | Historias | Archivos |
|-----|-----------|----------|
| 4 | 4.1 Proyección Flujo de Caja | `cash-flow.service.ts` |
| 4 | 4.2 Dashboard Liquidez | `treasury.routes.ts` |
| 5 | 7.1 Accounting Bus Extension | `accounting-bus.service.ts`, `accounting-bus-codes.ts` |

### Fase 3 — Frontend (días 6-10)
| Día | Historias | Archivos |
|-----|-----------|----------|
| 6 | 5.1 Sidebar + Layout | `index.html`, `app.js` |
| 6-7 | 5.2 Dashboard Posición | `app.js` |
| 7 | 5.3 Movimientos | `app.js` |
| 8-9 | 5.4 Cobros/Pagos | `app.js` |
| 9 | 5.5 Proyección Flujo | `app.js` |
| 10 | 5.6 Conciliación | `app.js` |

### Fase 4 — Datos + Cierre (días 11-12)
| Día | Historias | Archivos |
|-----|-----------|----------|
| 11 | 6.2 Seed Tesorería | `seed-treasury.ts` |
| 11 | 8.1 Refactor app.js | `js/tesoreria.js`, `js/contabilidad.js` |
| 12 | Testing integral + fixes | — |

**Total estimado: ~12 días hábiles**

---

## Principios de Diseño

1. **Tesorería en tiempo real** — Cada movimiento actualiza saldos inmediatamente. No hay batch ni cierre diario obligatorio.
2. **Contabilización automática** — Todo movimiento de tesorería genera su asiento contable automáticamente (mismo patrón que Sprint 6).
3. **Simplicidad sobre automatización bancaria** — Sin conexión bancaria real (API bancaria no disponible en Paraguay para este taller). La conciliación es semi-manual.
4. **Alertas tempranas** — Antes de que un sobregiro ocurra, el sistema alerta con proyección de flujo.
5. **Multi-moneda aware** — Tipo de cambio para operaciones en USD (repuestos importados), aunque la moneda funcional es PYG.
6. **Frontend first** — Las vistas de tesorería deben ser utilizables desde el primer día, incluso sin datos históricos completos.

---

## Notas Técnicas

1. **Nuevo módulo:** `finance/services/treasury/` con servicios separados: cuenta-bancaria, movimiento, conciliacion, cobranza, pago, flujo-caja
2. **Reuso del Accounting Bus:** `accounting-bus.service.ts` se extiende, no se reescribe
3. **Frontend:** Los estilos siguen el patrón existente (Tailwind + template literals). La sección tesorería se agrega como tabs internos, igual que contabilidad.
4. **API base path:** `/finance/treasury/*` para todos los endpoints nuevos
5. **Seed:** Se crea un script separado `scripts/seed-treasury.ts` para no complicar el seed principal
