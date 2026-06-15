# Sprint 6 — Frontend de Gestión Contable + Estados Financieros

> **Inicio:** —
> **Fin:** —
> **Dependencia:** CAPA 1-5 completas (backend financiero 50+ endpoints listo)
> **Riesgo principal:** Frontend es vanilla JS + Tailwind — sin framework, todo en un solo `app.js` de 1897 líneas

---

## Objetivo del Sprint

Cerrar las brechas críticas identificadas en la auditoría general:

1. **Construir las 16 vistas frontend** de gestión contable y financiera que están ausentes
2. **Implementar 2 servicios backend** críticos faltantes (Balance General, Estado de Resultados)
3. **Generar migraciones pendientes** (audit_log, centros_costo)
4. **Generar seed de catálogo contable** (plan de cuentas completo PY + centros de costo)

---

## Epic 1: Infraestructura Frontend Contable

### HISTORIA 1.1 — Sidebar "Contabilidad" con submenú

**Descripción:** Agregar sección "Contabilidad" al sidebar del SPA con submenú colapsable.

**Tareas:**
- [ ] Agregar botón "Contabilidad" en la sidebar (después de Facturación o Inventario)
- [ ] Submenú colapsable con: Plan de Cuentas, Asientos, Libros, Impuestos, RG90, Cierres, Auditoría, Costos
- [ ] Estilo consistente con sidebar existente (hover, active, iconos)

**Criterios de aceptación:**
- [ ] Al hacer clic en "Contabilidad" se expande/colapsa el submenú
- [ ] Cada item del submenú cambia la vista (data-view)
- [ ] El item activo se resalta visualmente

**Archivos a modificar:** `src/shared/public/index.html`, `src/shared/public/app.js`

---

### HISTORIA 1.2 — Layout de vista contable

**Descripción:** Template reutilizable para todas las vistas contables (tabla + filtros + botón crear).

**Tareas:**
- [ ] Función `renderAccountingLayout(title, subtitle, tableHtml, filtersHtml, createBtnHtml)` en app.js
- [ ] Paginación genérica reutilizable
- [ ] Modal de formulario genérico reutilizable
- [ ] Filtros por período (mes/año/dates) reutilizables

**Criterios de aceptación:**
- [ ] Layout con header, toolbar de filtros, tabla, paginación
- [ ] Modal CRUD reutilizable
- [ ] Funciona con datos reales de API

**Archivos a modificar:** `src/shared/public/app.js`

---

## Epic 2: Backend — Servicios Faltantes

### HISTORIA 2.1 — Balance General (Estado de Situación)

**Descripción:** Servicio que genera el Balance General a una fecha dada.

**Endpoint:** `GET /finance/contabilidad/balance-general/:fecha`

**Tareas:**
- [ ] Crear `balance.service.ts` en `finance/services/accounting/`
- [ ] Query: agrupar `plan_cuentas` por tipo (ACTIVO, PASIVO, PATRIMONIO)
- [ ] Calcular saldos: `saldo_inicial + Σ debe - Σ haber` de asientos CONTABILIZADOS hasta la fecha
- [ ] Estructura: `{ activo: { total, cuentas: [...] }, pasivo: {...}, patrimonio: {...}, totalActivo, totalPasivoPatrimonio }`
- [ ] Validar que Total Activo = Total Pasivo + Patrimonio

**Criterios de aceptación:**
- [ ] Endpoint devuelve balance estructurado por tipo de cuenta
- [ ] Suma de Activos = Suma de Pasivos + Patrimonio (diferencia < 0.01)
- [ ] Filtrar solo cuentas contables (nivel >= 4) que aceptan movimientos
- [ ] TypeScript compila limpio

**Archivos a crear:** `src/modules/finance/services/accounting/balance.service.ts`
**Archivos a modificar:** `services/index.ts`, `routes/accounting.ts`

---

### HISTORIA 2.2 — Estado de Resultados (P&L)

**Descripción:** Servicio que genera el Estado de Resultados para un período.

**Endpoint:** `GET /finance/contabilidad/estado-resultados/:anho/:mes`

**Tareas:**
- [ ] Crear `pnl.service.ts` en `finance/services/accounting/`
- [ ] Ingresos: suma de movimientos en cuentas tipo INGRESO
- [ ] Costos: suma de movimientos en cuentas tipo COSTO
- [ ] Gastos: suma de movimientos en cuentas tipo GASTO
- [ ] Cálculo: `Utilidad Bruta = Ingresos - Costos`
- [ ] Cálculo: `Utilidad Neta = Utilidad Bruta - Gastos`
- [ ] Agrupar por cuenta padre para subtotales

**Criterios de aceptación:**
- [ ] Endpoint devuelve INGRESOS, COSTOS, GASTOS con subtotales
- [ ] Utilidad Neta calculada correctamente
- [ ] Soporta período mensual y acumulado anual
- [ ] TypeScript compila limpio

**Archivos a crear:** `src/modules/finance/services/accounting/pnl.service.ts`
**Archivos a modificar:** `services/index.ts`, `routes/accounting.ts`

---

## Epic 3: Vistas Frontend — Contabilidad Base

### HISTORIA 3.1 — Vista Plan de Cuentas

**Descripción:** Árbol interactivo del catálogo contable con CRUD modal.

**Endpoint:** `GET /finance/contabilidad/cuentas/arbol`, CRUD de cuentas

**Tareas:**
- [ ] Cargar árbol desde `GET /finance/contabilidad/cuentas/arbol`
- [ ] Renderizar árbol recursivo con indentación por nivel
- [ ] Badge de tipo de cuenta (Activo=azul, Pasivo=naranja, Ingreso=verde, Gasto=rojo)
- [ ] Botón "Nueva Cuenta" → modal con: código, nombre, tipo, cuenta padre (select jerárquico)
- [ ] Edición in-place o modal para cuenta existente
- [ ] Desactivar cuenta (DELETE → activo=false)

**Criterios de aceptación:**
- [ ] Árbol visual con indentación clara (nivel 1-5+)
- [ ] Crear cuenta con validación de código único
- [ ] Select de cuenta padre jerárquico en el modal
- [ ] Sin reload de página (SPA)

**Archivos a modificar:** `src/shared/public/app.js`

---

### HISTORIA 3.2 — Vista Asientos Contables

**Descripción:** Lista paginada de asientos + formulario de creación + detalle.

**Endpoints:** `GET /finance/contabilidad/asientos`, `POST /finance/contabilidad/asientos`, `GET /finance/contabilidad/asientos/:id`

**Tareas:**
- [ ] Tabla de asientos con: número, fecha, concepto, total debe/haber, estado, módulo origen
- [ ] Filtros: período (desde/hasta), módulo origen, estado
- [ ] Badge de estado (BORRADOR=amarillo, CONTABILIZADO=verde, ANULADO=rojo)
- [ ] Botón "Nuevo Asiento" → modal con:
  - Fecha, concepto
  - Tabla de líneas (cuentaId, debe, haber, descripción)
  - Validación: ∑Debe = ∑Haber antes de enviar
  - Mínimo 2 líneas
- [ ] Click en asiento → modal detalle con líneas enriquecidas (código cuenta + nombre)
- [ ] Botón "Anular" en detalle (solo si está CONTABILIZADO)

**Criterios de aceptación:**
- [ ] Tabla paginada con filtros funcionales
- [ ] Creación de asiento con validación de balance en frontend
- [ ] Select/autocomplete de cuenta contable
- [ ] Confirmación antes de anular

**Archivos a modificar:** `src/shared/public/app.js`

---

### HISTORIA 3.3 — Vista Libros Contables

**Descripción:** Visualización de Libro Diario, Libro Mayor, Libro Inventario.

**Endpoints:** `GET /finance/contabilidad/libro-diario/:anho/:mes`, `GET /finance/contabilidad/libro-mayor/:anho/:mes`, `GET /finance/contabilidad/libro-inventario/:anho/:mes`

**Tareas:**
- [ ] Selector de período (mes/año) + selector de libro (Diario/Mayor/Inventario)
- [ ] **Libro Diario:** tabla con número, fecha, concepto, cuenta, debe, haber (ordenado por fecha)
- [ ] **Libro Mayor:** select de cuenta → movimientos de esa cuenta en el período + saldo inicial/final
- [ ] **Libro Inventario:** detalle de activos + existencias
- [ ] Badge de formato: JSON | TXT | CSV (ya implementado en backend)

**Criterios de aceptación:**
- [ ] Cambiar de libro sin recargar página
- [ ] Filtros de período funcionales
- [ ] Datos enriquecidos con nombres de cuenta

**Archivos a modificar:** `src/shared/public/app.js`

---

## Epic 4: Vistas Frontend — Fiscal / RG90

### HISTORIA 4.1 — Vista RG90

**Descripción:** Exportación de RG90 Ventas/Compras/Retenciones.

**Endpoints:** `GET /finance/rg90/ventas/:anho/:mes`, `GET /finance/rg90/compras/:anho/:mes`, `GET /finance/rg90/retenciones/:anho/:mes`

**Tareas:**
- [ ] Selector de período + selector de módulo (Ventas/Compras/Retenciones)
- [ ] Selector de formato (JSON/TXT/CSV)
- [ ] Botón "Exportar" → descarga según formato
- [ ] Previsualización JSON en pantalla

**Criterios de aceptación:**
- [ ] Descarga TXT en formato fixed-width (RG90)
- [ ] Descarga CSV con header
- [ ] Previsualización en pantalla

**Archivos a modificar:** `src/shared/public/app.js`

---

### HISTORIA 4.2 — Vista Impuestos (IVA, IRE, IDU, ISC, INR)

**Descripción:** Cálculo y visualización de liquidaciones de impuestos.

**Endpoints:** `POST /finance/fiscal/*/calcular`, `GET /finance/fiscal/*`

**Tareas:**
- [ ] Tabs por tipo de impuesto: IVA | IRE | IDU | ISC | INR
- [ ] Selector de período
- [ ] Botón "Calcular" → POST al endpoint correspondiente
- [ ] Resultado formateado: base imponible, débito, crédito, total a pagar
- [ ] Historial de liquidaciones anteriores

**Criterios de aceptación:**
- [ ] Cálculo de IVA (Form 120) con desglose débito/crédito
- [ ] Historial de liquidaciones por período
- [ ] Indicador de estado (BORRADOR/PRESENTADO/PAGADO)

**Archivos a modificar:** `src/shared/public/app.js`

---

## Epic 5: Vistas Frontend — Cierres y Auditoría

### HISTORIA 5.1 — Vista Cuadratura + Cerrar Período

**Descripción:** Panel de control para verificar cuadratura y cerrar períodos.

**Endpoints:** `GET /finance/contabilidad/cuadratura/:anho/:mes`, `POST /finance/contabilidad/cerrar-periodo`

**Tareas:**
- [ ] Selector de período
- [ ] Ejecutar cuadratura → mostrar: balanceado (verde) / desbalanceado (rojo)
- [ ] Tabla de asientos desbalanceados si los hay
- [ ] Resumen: total debe, total haber, diferencia
- [ ] Botón "Cerrar Período" → confirmación → cierra el mes
- [ ] Mostrar período actualmente abierto

**Criterios de aceptación:**
- [ ] Cuadratura muestra estado visual claro (check/cruz)
- [ ] Cerrar período solo si está balanceado
- [ ] Confirmación antes de cerrar

**Archivos a modificar:** `src/shared/public/app.js`

---

### HISTORIA 5.2 — Vista Audit Log

**Descripción:** Visualización del log de auditoría con filtros.

**Endpoint:** `GET /finance/contabilidad/audit-log`

**Tareas:**
- [ ] Tabla paginada con: fecha, usuario, acción, entidad, descripción
- [ ] Filtros: entidad, acción, período
- [ ] Badge de acción (CREATE=verde, UPDATE=azul, DELETE=rojo, ANULAR=naranja)
- [ ] Click → ver detalle con diff de valor anterior/nuevo (JSON formateado)

**Criterios de aceptación:**
- [ ] Paginación funcional
- [ ] Filtros combinables
- [ ] Vista detalle con JSON pretty-printed

**Archivos a modificar:** `src/shared/public/app.js`

---

## Epic 6: Vistas Frontend — Costos y Rentabilidad

### HISTORIA 6.1 — Vista Centros de Costo

**Descripción:** Árbol de centros de costo con CRUD modal.

**Endpoints:** `GET /finance/contabilidad/centros-costo/arbol`, CRUD centros-costo

**Tareas:**
- [ ] Árbol jerárquico similar al plan de cuentas
- [ ] CRUD con modal
- [ ] Indicador activo/inactivo

**Archivos a modificar:** `src/shared/public/app.js`

---

### HISTORIA 6.2 — Dashboard de Rentabilidad

**Descripción:** Panel de rentabilidad del período.

**Endpoint:** `GET /finance/contabilidad/rentabilidad/dashboard/:anho/:mes`

**Tareas:**
- [ ] Selector de período
- [ ] Cards: Total OTs, Facturado, Costos, Margen %, Comisiones
- [ ] Top 10 OTs por margen (tabla)
- [ ] Top 10 Mecánicos por comisión (tabla)
- [ ] Gráfico de barras simple (CSS) de margen vs ingresos

**Archivos a modificar:** `src/shared/public/app.js`

---

## Epic 7: Datos y Migraciones

### HISTORIA 7.1 — Migración CAPA 4-5

**Descripción:** Generar migraciones Drizzle para audit_log y centros_costo.

**Tareas:**
- [ ] Ejecutar `drizzle-kit generate` para detectar nuevas tablas
- [ ] O crear manualmente `0013_capa4_capa5.sql` con:
  - `CREATE TABLE audit_log (...)` + índices
  - `CREATE TABLE centros_costo (...)` + índices
  - ENUMs si son necesarios
- [ ] Verificar migración en Supabase/Neon

**Criterios de aceptación:**
- [ ] Tablas creadas en BD remota
- [ ] Índices creados
- [ ] Rollback funcional

**Archivos a crear:** `src/shared/database/migrations/0013_capa4_capa5.sql`

---

### HISTORIA 7.2 — Seed de Plan de Cuentas Completo

**Descripción:** Seed data con plan de cuentas paraguayo estándar.

**Tareas:**
- [ ] Agregar a `seed.ts` el catálogo completo:
  - 1 Activo (Caja, Bancos, Clientes, Inventario, Activo Fijo)
  - 2 Pasivo (Proveedores, Impuestos, PRESTAMOS)
  - 3 Patrimonio (Capital, Reservas, Resultados)
  - 4 Ingresos (Ventas, Servicios, Otros)
  - 5 Costos (Costo de Ventas, Costo de Servicios)
  - 6 Gastos (Sueldos, Servicios, Impuestos, Depreciación)
- [ ] Seed de centros de costo típicos (Taller, Administración, Ventas)
- [ ] Asociar tenant "taller-el-chero" a los seeds

**Criterios de aceptación:**
- [ ] Seed ejecutable con `npm run seed`
- [ ] Plan de cuentas con 20+ cuentas en 4 niveles
- [ ] Centros de costo con 5+ centros en 2 niveles

**Archivos a modificar:** `src/shared/database/seed.ts`

---

### HISTORIA 7.3 — Seed de Centros de Costo Típicos

**Descripción:** Centros de costo estándar para taller mecánico.

**Tareas:**
- [ ] Centros nivel 1: Taller, Administración, Ventas, Dirección
- [ ] Centros nivel 2: Mecánica Rápida, Diagnóstico, Carrocería, Repuestos, etc.
- [ ] Vincular a tenant "taller-el-chero"

---

## Epic 8: Infraestructura y Build

### HISTORIA 8.1 — Refactor app.js (opcional)

**Descripción:** Dividir el app.js monolítico de 1897 líneas en módulos más pequeños.

**Tareas:**
- [ ] Crear `src/shared/public/js/` directorio
- [ ] Mover lógica de contabilidad a `js/contabilidad.js`
- [ ] Mover lógica de taller a `js/taller.js`
- [ ] Mover lógica de inventario a `js/inventario.js`
- [ ] index.html carga los módulos con `<script type="module">`

**Criterios de aceptación:**
- [ ] app.js original no cambia (o se reduce significativamente)
- [ ] Funcionalidad existente intacta

**Archivos a crear:** `src/shared/public/js/contabilidad.js`, `taller.js`, `inventario.js`

---

## Resumen de Archivos

### Crear:
| Archivo | Historia |
|---------|----------|
| `src/modules/finance/services/accounting/balance.service.ts` | 2.1 |
| `src/modules/finance/services/accounting/pnl.service.ts` | 2.2 |
| `src/shared/database/migrations/0013_capa4_capa5.sql` | 7.1 |
| `src/shared/public/js/contabilidad.js` | 8.1 (opcional) |

### Modificar:
| Archivo | Historias |
|---------|-----------|
| `src/modules/finance/services/index.ts` | 2.1, 2.2 |
| `src/modules/finance/routes/accounting.ts` | 2.1, 2.2 |
| `src/shared/public/index.html` | 1.1 |
| `src/shared/public/app.js` | 1.1-6.2 |
| `src/shared/database/seed.ts` | 7.2, 7.3 |
| `engram.json` | Estado del proyecto |

---

## Priorización

| Prioridad | Historias | Esfuerzo estimado |
|-----------|-----------|-------------------|
| **P0 — Base** | 1.1 Sidebar, 1.2 Layout, 3.1 Plan Cuentas, 3.2 Asientos | 4-5 días |
| **P1 — Reportes** | 3.3 Libros, 4.1 RG90, 4.2 Impuestos | 2-3 días |
| **P2 — Backend faltante** | 2.1 Balance, 2.2 PyG | 2 días |
| **P3 — Cierres** | 5.1 Cuadratura, 5.2 Audit, 7.1 Migraciones | 2 días |
| **P4 — Costos** | 6.1 Cost Centers, 6.2 Rentabilidad | 2 días |
| **P5 — Datos** | 7.2 Seed, 7.3 Centros | 1 día |
| **P6 — Refactor** | 8.1 Módulos JS | 1 día (opcional) |

**Total estimado: ~14-16 días hábiles**

---

## Notas Técnicas

1. **Frontend sin framework:** Todo es vanilla JS + Tailwind CDN. No hay estado global ni router. Las vistas se manejan con `data-view` y `display: block/none`.
2. **API pattern:** `api(path, { method, body })` wrapper que maneja `X-Tenant-Slug` automáticamente.
3. **WebSocket:** Usar WS channel `visual-stream` para notificaciones en tiempo real (ej: nueva OT lista).
4. **RAM:** Cada vista debe lazy-load sus datos (no precargar todo en memoria).
5. **Modal pattern:** Usar `#modal-overlay` + `#modal-content` existente, con `renderModal(title, bodyHtml)`.
