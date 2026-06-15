# AutomotiveOS Cloud ERP — API Reference

> Backend: Fastify 5 + TypeScript 6 · ESM · PostgreSQL (Neon/Supabase)
> Versión: 0.1.0 · Última actualización: 2026-06-09

---

## Convenciones Generales

### Headers comunes

| Header | Obligatorio | Descripción |
|---|---|---|
| `X-Tenant-Slug` | Sí (en rutas tenant-scoped) | Identificador del taller (`taller_oviedo`, `taller_el_chero`) |
| `Content-Type` | Según método | `application/json` o `multipart/form-data` |

### Formato de respuestas

```typescript
// Éxito
{ "id": "uuid", ...data }

// Error
{ "error": "TipoError", "message": "Descripción legible" }
```

### Códigos de estado comunes

| Código | Significado |
|---|---|
| 200 | OK |
| 201 | Creado |
| 400 | BadRequestError — payload inválido |
| 403 | ForbiddenError — falta X-Tenant-Slug o no pertenece |
| 404 | NotFoundError — recurso no existe |
| 422 | ValidationError — error semántico |
| 503 | Service degraded — DB offline |

### Multi-tenencia

Todas las rutas bajo módulos (`/workshop/`, `/finance/`, `/inventory/`, etc.) requieren `X-Tenant-Slug`. El middleware `resolveTenant` valida el slug y lo inyecta en `request.tenantSlug`. Consultas Drizzle usan `eq(tabla.tenantSlug, slug)` para aislamiento.

---

## Índice de Endpoints

| Módulo | Prefijo | # Endpoints |
|---|---|---|
| [Health & System](#health--system) | `/health` | 2 |
| [Sync Offline-First](#sync-offline-first) | `/sync` | 2 |
| [Configuración del Taller](#configuración-del-taller) | `/api/config` | 4 |
| [Auth](#auth) | `/api/auth` | 1 |
| [Perfiles](#perfiles) | `/api/profiles` | 4 |
| [Workshop — Clientes](#workshop--clientes) | `/workshop/clientes` | 5 |
| [Workshop — Vehículos](#workshop--vehículos) | `/workshop/vehiculos` | 5 |
| [Workshop — Órdenes](#workshop--órdenes-de-trabajo) | `/workshop/ordenes` | 5 |
| [Workshop — Ingresos](#workshop--ingresos) | `/workshop/ingresos` | 2 |
| [Workshop — Trabajos Terceros](#workshop--trabajos-de-terceros) | `/workshop/ordenes/:id/trabajos-terceros` | 2 |
| [Inventario — Repuestos](#inventario--repuestos) | `/inventory/repuestos` | 6 |
| [Inventario — Herramientas](#inventario--herramientas) | `/inventory/herramientas` | 8 |
| [Thinkcar](#thinkcar) | `/thinkcar` | 9 |
| [Finance — Facturación Híbrida](#finance--facturación-hibrida) | `/finance/invoices` | 1 |
| [Finance — SIFEN](#finance--sifen-electrónica) | `/finance/sifen` | 8 |
| [Finance — Contabilidad](#finance--contabilidad) | `/finance/contabilidad` | 10 |
| [Finance — RG 90](#finance--rg-90-marangatu) | `/finance/rg90` | 1 |
| [Finance — Payroll](#finance--payroll) | `/api/v1/finance` | 2 |
| [Intelligence — DTC](#intelligence--dtc) | `/intelligence/dtc` | 3 |
| [Intelligence — Safety HV](#intelligence--safety-hv) | `/intelligence/safety` | 1 |
| [Intelligence — OCR](#intelligence--ocr) | `/intelligence/ocr` | 3 |
| [Intelligence — VIN/Safety](#intelligence--vin-safety) | `/intelligence` | 2 |
| [Intelligence — RAG](#intelligence--rag) | `/intelligence/manuals` | 2 |
| [Visual — TV](#visual--tv) | `/api/v1/visual` | 3 |
| **Total** | | **~88 endpoints** |

---

## Health & System

Rutas públicas (sin tenant isolation).

### `GET /health`

Estado del servidor + métricas de memoria.

**Response `200` (healthy):**
```json
{
  "status": "ok",
  "uptime": 3600,
  "database": "connected",
  "version": "0.1.0",
  "memory": {
    "rss": "32.15 MB",
    "heapUsed": "18.42 MB",
    "heapTotal": "24.00 MB"
  }
}
```

### `GET /health/live`

Liveness probe simple.

**Response `200`:**
```json
{ "alive": true }
```

---

## Sync Offline-First

Requiere `X-Tenant-Slug`.

### `POST /sync`

Envía un lote de operaciones offline (máx. 50).

**Request:**
```json
{
  "operations": [
    {
      "id": "uuid",
      "entity": "clients",
      "action": "create",
      "payload": { "name": "Juan Perez" },
      "tenant": "taller_oviedo",
      "timestamp": "2026-06-09T12:00:00Z"
    }
  ]
}
```

**Response `200`:**
```json
{
  "results": [
    { "operationId": "uuid", "status": "ok", "result": { "id": "uuid", "name": "Juan Perez" } }
  ]
}
```

### `GET /sync/config`

Configuración del cliente offline.

**Response `200`:**
```json
{
  "syncIntervalMs": 30000,
  "maxRetries": 3
}
```

---

## Configuración del Taller

Rutas sin tenant isolation (gestión global del tenant).

### `GET /api/config/settings`

Obtener configuración del taller (logo, RUC, datos fiscales).

### `PUT /api/config/settings`

Actualizar configuración.

**Request:**
```json
{
  "companyName": "Taller Oviedo",
  "ruc": "80012345-6",
  "address": "Av. Mariscal López 1234",
  "phone": "+595981234567"
}
```

### `POST /api/config/upload-logo`

Subir logo del taller (multipart, PNG/JPEG, máx. 5MB).

**Request:** `multipart/form-data` con campo `file`

**Response `200`:**
```json
{ "ok": true, "logoBase64": "data:image/png;base64,..." }
```

### `GET /api/config/logo`

Obtener logo en Base64.

**Response `200`:**
```json
{ "logoBase64": "data:image/png;base64,..." }
```

---

## Auth

### `POST /api/auth/login`

Login por tenant + email. Crea perfil automáticamente si no existe.

**Request:**
```json
{
  "tenantSlug": "taller_oviedo",
  "email": "mecanico@taller.com",
  "password": "miClave"
}
```

**Response `200`:**
```json
{
  "ok": true,
  "profile": { "id": "uuid", "email": "...", "full_name": "...", "role": "admin", "is_active": true },
  "tenant": { "name": "Taller Oviedo", "slug": "taller_oviedo", "ruc": "80012345-6" }
}
```

---

## Perfiles

Requiere `X-Tenant-Slug`.

### `GET /api/profiles`

Listar perfiles del tenant.

### `POST /api/profiles`

Crear perfil.

**Request:**
```json
{ "email": "mecanico@taller.com", "fullName": "Carlos López", "role": "mechanic" }
```

### `PATCH /api/profiles/:id`

Actualizar perfil.

**Request (parcial):**
```json
{ "fullName": "Carlos López Martínez", "role": "supervisor" }
```

### `DELETE /api/profiles/:id`

Desactivar perfil (soft-delete, `is_active = false`).

---

## Workshop — Clientes

Requiere `X-Tenant-Slug`. CRUD completo.

### `POST /workshop/clientes`

Crear cliente.

**Request:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@email.com",
  "phone": "+595981111111",
  "ruc": "1234567-8",
  "address": "Calle 123",
  "notes": "Cliente frecuente"
}
```
**Response `201`:**
```json
{ "id": "uuid", "name": "Juan Pérez", "email": "juan@email.com", "phone": "...", "ruc": "1234567-8", "address": "...", "notes": "...", "createdAt": "iso", "updatedAt": "iso" }
```

### `GET /workshop/clientes`
### `GET /workshop/clientes/:id`
### `PATCH /workshop/clientes/:id`
### `DELETE /workshop/clientes/:id`

---

## Workshop — Vehículos

Soporta HEV/BEV con campos de alta tensión.

### `POST /workshop/vehiculos`

**Request:**
```json
{
  "brand": "Toyota",
  "model": "Corolla Cross",
  "clientId": "uuid",
  "plate": "ABC1234",
  "vin": "JT2BF22KX10123456",
  "year": 2024,
  "engineType": "HEV",
  "hvBatteryVoltage": 288
}
```
**Response `201`:** Objeto vehículo completo.

### `GET /workshop/vehiculos`

**Query params:** `clientId`, `brand`, `model`, `plate`, `vin`, `engineType`, `limit`, `offset`

### `GET /workshop/vehiculos/:id`
### `PATCH /workshop/vehiculos/:id`
### `DELETE /workshop/vehiculos/:id`

---

## Workshop — Órdenes de Trabajo

### `GET /workshop/ordenes`

**Query params:** `status` (enum: `Presupuestado|Aprobado|En_Proceso|Control_Calidad|Listo`), `limit`, `offset`

**Response `200`:**
```json
[{
  "id": "uuid",
  "vehicleId": "uuid",
  "clientId": "uuid",
  "description": "Cambio de aceite",
  "status": "En_Proceso",
  "hvAlert": false,
  "hvLockoutSigned": true,
  "totalCost": "1500000.00",
  "vehiculo": "Toyota Corolla",
  "plate": "ABC1234",
  "cliente": "Juan Pérez",
  "createdAt": "iso",
  "updatedAt": "iso"
}]
```

### `GET /workshop/ordenes/:id`

### `POST /workshop/ordenes/:id/sign-lockout`

Firmar lockout de alta tensión (obligatorio si `hvAlert=true` para avanzar a `Listo`).

**Request:**
```json
{ "mechanicId": "uuid" }
```

### `PATCH /workshop/ordenes/:id/status`

Avanzar estado de la orden.

**Request:**
```json
{ "status": "Control_Calidad" }
```

### `PATCH /workshop/ordenes/:id` (nota: el SPA usa este patrón con `{ status }` — validado contra enum)

El SPA Frontend envía `PATCH /workshop/ordenes/:id` con `{ status }` para avanzar estados desde los botones de la pantalla Taller.

---

## Workshop — Ingresos

### `POST /workshop/ingresos`

Registrar ingreso de vehículo al taller. Opcionalmente crea orden de trabajo.

**Request:**
```json
{
  "vehicleId": "uuid",
  "kilometraje": 45000,
  "nivelCombustible": "1/2",
  "estadoExterior": "Rayón en puerta trasera izquierda",
  "observaciones": "Cliente reporta ruido en suspensión",
  "crearOrden": true,
  "descripcionTrabajo": "Diagnóstico de suspensión delantera"
}
```

**Response `201`:**
```json
{
  "ingreso": { "id": "uuid", "vehicleId": "uuid", ... },
  "ordenTrabajo": { "id": "uuid", "status": "Presupuestado" }
}
```

### `GET /workshop/ingresos?vehicleId=uuid`

Listar ingresos de un vehículo.

---

## Workshop — Trabajos de Terceros

### `POST /workshop/ordenes/:id/trabajos-terceros`

Asociar trabajo subcontratado a una orden.

**Request:**
```json
{
  "proveedor": "Tapicería ABC",
  "descripcion": "Cambio de tapizado completo",
  "costo": 450000
}
```
**Response `201`:** Objeto trabajoTercero.

### `GET /workshop/ordenes/:id/trabajos-terceros`

Listar trabajos de terceros de una orden.

---

## Inventario — Repuestos

### `POST /inventory/repuestos`

Crear repuesto. Requiere `codigo` y `descripcion`.

**Request:** Campos: `codigo`, `codigoBarras`, `descripcion`, `marca`, `modelo`, `categoria`, `precioCosto`, `precioVenta`, `stockActual`, `stockMinimo`, `stockMaximo`, `ubicacion`, `unidadMedida`, `proveedor`, `compatibleCon`.

**Response `201`:** `{ "id": "uuid", "codigo": "...", "descripcion": "...", "stockActual": 10 }`

### `GET /inventory/repuestos`

**Query params:** `search`, `categoria`, `activo`, `page`, `limit`

**Response `200`:**
```json
{ "items": [...], "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
```

### `GET /inventory/repuestos/:id`
### `PATCH /inventory/repuestos/:id`
### `POST /inventory/repuestos/salida`

Decrementar stock (venta, uso en OT, ajuste).

**Request:**
```json
{ "repuestoId": "uuid", "cantidad": 2, "motivo": "Uso en OT", "ordenTrabajoId": "uuid" }
```
**Response:** `{ "repuesto": { stockActual, stockAnterior }, "movimiento": { ... } }`

### `POST /inventory/repuestos/:id/ingreso`

Incrementar stock (compra, devolución, ajuste).

**Request:**
```json
{ "cantidad": 10, "motivo": "Compra", "observaciones": "Factura Nº 123" }
```

---

## Inventario — Herramientas

### `POST /inventory/herramientas`

Crear herramienta. Requiere `codigo` y `nombre`.

### `GET /inventory/herramientas`

**Query params:** `search`, `categoria`, `activo`, `page`, `limit`. Response paginada.

### `GET /inventory/herramientas/disponibles`

Listar herramientas disponibles para préstamo.

**Response `200`:**
```json
[{ "id": "uuid", "codigo": "H001", "nombre": "Scanner Launch X431", "stockDisponible": 3 }]
```

### `GET /inventory/herramientas/:id`
### `PATCH /inventory/herramientas/:id`
### `POST /inventory/herramientas/prestar`

Prestar herramienta a mecánico para una OT.

**Request:**
```json
{ "herramientaId": "uuid", "ordenTrabajoId": "uuid", "mecanicoId": "uuid" }
```
**Response `201`:** Objeto control con fecha de asignación.

### `POST /inventory/herramientas/control/:id/devolver`

Registrar devolución (o pérdida/daño).

**Request:**
```json
{ "estado": "Devuelto", "observaciones": "En buen estado" }
```

### `GET /inventory/herramientas/control`

Listar registros de control. Filtros: `ordenTrabajoId`, `mecanicoId`, `herramientaId`, `estado`.

---

## Thinkcar

Gestiona importación de diagnósticos Thinkcar (USB, Email, Bluetooth).

### `GET /thinkcar/imports`

Listar importaciones con paginación y filtros.

**Query params:** `status`, `vin`, `limit` (max 200), `offset`

**Response `200`:**
```json
{ "data": [...], "total": 150, "limit": 50, "offset": 0 }
```

### `GET /thinkcar/imports/:id`

Detalle de una importación.

### `POST /thinkcar/imports/:id/link`

Vincular manualmente a VIN/OT/cliente.

**Request:** `{ "vin": "JT2BF22KX10123456", "ordenTrabajoId": "uuid", "clientId": "uuid" }`

### `POST /thinkcar/imports/:id/retry-link`

Reintentar vinculación automática (smart linking).

### `POST /thinkcar/import`

Subir reporte PDF manualmente (multipart).

**Request:** `multipart/form-data`, campo `file` (PDF)

**Response `201` o `422`:**
```json
{ "status": "imported", "id": "uuid", "vin": "JT2BF22KX...", "dtcCount": 3 }
```

### `POST /thinkcar/ingest/usb`
### `POST /thinkcar/ingest/email`
### `POST /thinkcar/ingest/bluetooth`

Disparar ingest manual desde cada canal. Retorna conteo procesado.

### `GET /thinkcar/health`

Estado de salud de los 3 canales de ingest.

**Response:**
```json
{ "channels": [{ "name": "usb", "isHealthy": true, ... }], "allHealthy": true }
```

### `GET /thinkcar/stats`

Estadísticas agregadas por estado.

**Response:**
```json
{ "total": 150, "byStatus": [{ "status": "linked", "count": 120 }, { "status": "manual_review", "count": 30 }] }
```

---

## Finance — Facturación Híbrida

### `POST /finance/invoices/issue`

Emitir factura desde una orden de trabajo. Soporta modalidad MANUAL (preimpresa) y ELECTRONICA (firma digital SIFEN). Corre dentro de una transacción Drizzle.

**Request:**
```json
{
  "ordenId": "uuid",
  "tipoFacturacion": "MANUAL",
  "numeroFacturaManual": "001-001-0001234"
}
```
- `tipoFacturacion`: `"MANUAL"` | `"ELECTRONICA"`
- `numeroFacturaManual`: requerido si MANUAL

**Response `201` (MANUAL):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tipo": "MANUAL",
    "numeroFacturaManual": "001-001-0001234",
    "sifenCdc": null,
    "sifenStatus": "MANUAL_CONVERT_QUEUE",
    "total": "1500000.00"
  }
}
```

**Response `201` (ELECTRONICA):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tipo": "ELECTRONICA",
    "sifenCdc": "PENDING_HOMOLOGATION",
    "sifenStatus": "APROBADO_DNIT",
    "xmlSigned": "<DE>...firmado...</DE>"
  }
}
```

---

## Finance — SIFEN Electrónica

### `POST /finance/sifen/emitir`

Emitir DTE completo (build XML → firmar → enviar a DNIT). Endpoint principal del motor SIFEN V150.

**Request:**
```json
{
  "ordenTrabajoId": "uuid",
  "clienteId": "uuid",
  "dteTipo": "FACTURA",
  "serie": "001",
  "numero": "0000001",
  "condicionVenta": "CONTADO",
  "moneda": "PYG",
  "regimenIVA": "GENERAL",
  "items": [
    { "cantidad": 1, "unidadMedida": "Unidad", "descripcion": "Cambio de aceite 5W30", "precioUnitario": "250000", "iva": 10, "subtotal": "250000" }
  ]
}
```

**Response `201`:**
```json
{
  "documento": { "id": "uuid", "dteTipo": "FACTURA", "cdc": "001001-001-0000001-...", "estado": "APROBADO", ... },
  "emitidoEn": "2026-06-09T12:00:00.000Z"
}
```

### `POST /finance/sifen/firmar`

Firmar XML existente (para documentos en estado BORRADOR).

**Request:** `{ "documentoId": "uuid" }`

### `POST /finance/sifen/enviar`

Enviar XML firmado a DNIT.

**Request:** `{ "documentoId": "uuid" }`

### `GET /finance/sifen/consultar?cdc=44char`

Consultar estado de DTE por CDC.

### `POST /finance/sifen/anular`

Anular DTE ante DNIT.

**Request:** `{ "cdc": "44-char-cdc", "motivo": "Error en emisión" }`

### `GET /finance/sifen/documentos`

Listar documentos fiscales. **Query params:** `estado`, `page`, `limit`

### `GET /finance/sifen/documentos/:id`

Detalle de documento fiscal.

### `GET /finance/sifen/sync-log`

Log de sincronización SIFEN. **Query params:** `documentoId`, `page`, `limit`

### `GET /finance/sifen/health`

Probar conectividad con web service DNIT.

---

## Finance — Contabilidad

### `POST /finance/contabilidad/cuentas`

Crear cuenta contable.

**Request:**
```json
{ "codigo": "1.1.01", "nombre": "Caja", "tipo": "ACTIVO", "cuentaPadreId": null, "aceptaMovimientos": true }
```

**Response `201`:**
```json
{ "id": "uuid", "codigo": "1.1.01", "nombre": "Caja", "tipo": "ACTIVO", "nivel": 3 }
```

### `GET /finance/contabilidad/cuentas`

**Query params:** `tipo`, `activo`, `nivel`

### `GET /finance/contabilidad/cuentas/arbol`

Árbol jerárquico completo del plan de cuentas.

### `GET /finance/contabilidad/cuentas/:id`

### `POST /finance/contabilidad/asientos`

Crear asiento contable (partida doble, mínimo 2 líneas).

**Request:**
```json
{
  "fecha": "2026-06-09T00:00:00Z",
  "concepto": "Venta de servicio - Cambio de aceite",
  "lineas": [
    { "cuentaId": "uuid-caja", "debe": "250000", "haber": "0" },
    { "cuentaId": "uuid-ingresos", "debe": "0", "haber": "250000" }
  ]
}
```

**Response `201`:**
```json
{
  "asiento": { "id": "uuid", "numero": 42, "totalDebe": "250000.00", "totalHaber": "250000.00", "estado": "CONTABILIZADO" },
  "lineas": [...]
}
```

### `GET /finance/contabilidad/asientos`

**Query params:** `desde`, `hasta`, `moduloOrigen`, `ordenTrabajoId`, `page`, `limit`

### `GET /finance/contabilidad/asientos/:id`

### `POST /finance/contabilidad/asientos/automatico`

Generar asiento automático desde orden de trabajo.

**Request:** `{ "ordenTrabajoId": "uuid", "fecha": "iso", "concepto": "opcional" }`

### `POST /finance/contabilidad/asientos/:id/anular`

Anular asiento contable.

### `POST /finance/contabilidad/apertura`

Generar asiento de apertura para un período.

**Request:** `{ "anho": 2026, "mes": 6 }`

---

## Finance — RG 90 Marangatu

### `POST /finance/rg90/exportar`

Exportar libro de ingresos para RG 90/Marangatu.

**Request:**
```json
{ "anho": 2026, "mes": 6, "formato": "CSV" }
```
`formato`: `TXT` | `CSV` | `JSON`

**Response:**
```json
{ "metadata": { "cantidad": 42, "totalExento": "...", ... }, "tenantSlug": "taller_oviedo" }
```

---

## Finance — Payroll

### `POST /api/v1/finance/payroll/calculate`

Calcular comisiones mensuales y punto de equilibrio.

**Request:** `{ "month": 6, "year": 2026 }`

**Response:**
```json
{ "ok": true, "month": 6, "year": 2026, "commissionsCreated": 5, ... }
```

### `GET /api/v1/finance/dashboard/break-even`

Progreso del punto de equilibrio.

---

## Intelligence — DTC

### `POST /intelligence/dtc/parse`

Parsear reporte de scanner en texto plano.

**Request:**
```json
{ "reportText": "VIN: JT2BF22KX10123456\nDTC: P0AA6\nDTC: P3000", "scannerBrand": "Launch X431" }
```

**Response:** ScanReport estructurado con VIN, DTCs, marcas de tiempo.

### `POST /intelligence/dtc/diagnose`

Generar diagnóstico automático desde códigos DTC.

**Request:**
```json
{ "dtcCodes": ["P0AA6", "P3000"], "vehicleInfo": { "brand": "Toyota", "model": "Corolla", "year": 2024 } }
```

### `POST /intelligence/dtc/parse-file`

Subir archivo de reporte (PDF/texto) para parseo (multipart).

---

## Intelligence — Safety HV

### `POST /intelligence/safety/protocol`

Generar protocolo de seguridad para alta tensión (EV/HEV).

**Request:**
```json
{ "vehicleInfo": { "brand": "BYD", "model": "Atto 3", "year": 2024, "hvBatteryVoltage": 400 } }
```

**Response:** Protocolo completo con PPE, procedimiento paso a paso, contactos de emergencia.

---

## Intelligence — OCR

### `POST /intelligence/ocr/plate`

Subir imagen de chapa patente para OCR (multipart, campo `image`).

### `POST /intelligence/ocr/cedula`

Subir imagen de Cédula Verde para OCR (multipart, campo `image`).

### `GET /intelligence/ocr/jobs/:id`

Polling de estado del trabajo OCR.

**Response:**
```json
{ "jobId": "uuid", "status": "completed", "result": { "text": "ABC1234", "confidence": 0.95 } }
```

---

## Intelligence — VIN/Safety

### `POST /intelligence/decode-safety`

Decodificar VIN + evaluar riesgo HV.

**Request:**
```json
{ "vin": "JT2BF22KX10123456", "brand": "Toyota", "model": "Corolla Cross", "year": 2024 }
```

### `POST /intelligence/parse-dtc`

Parsear un código DTC individual.

**Request:** `{ "dtcCode": "P0AA6" }`

**Response:** `{ "code": "P0AA6", "system": "HV", "severity": "critical", "description": "Fallo de aislamiento" }`

---

## Intelligence — RAG

### `POST /intelligence/manuals/ingest`

Ingestar PDF de manual técnico → chunk → embed → almacenar (multipart, query param `vehicleId` opcional).

### `POST /intelligence/manuals/query`

Búsqueda semántica sobre manuales indexados.

**Request:**
```json
{ "question": "¿Cuál es el torque de la culata?", "vehicleId": "uuid", "topK": 5 }
```

---

## Visual — TV

Rutas públicas (sin tenant, servicio de sala de espera).

### `GET /api/v1/visual/tv`

HTML de TV display (pantalla de sala de espera/mecánicos).

### `GET /dashboard`

SPA principal (panel de administración).

### `GET /app.js`

JavaScript del SPA.

### `GET /api/v1/visual/status`

Estado del gateway WebSocket.

**Response:**
```json
{ "connectedScreens": 3, "uptime": 3600 }
```

### WebSocket `/ws/visual/tv`

WebSocket para streaming de datos de TV en tiempo real. Mensajes JSON <1KB con torque specs, alertas HV, timestamps.

---

## Modelos de Datos (Esquemas Principales)

### Orden de Trabajo (`ordenesTrabajo`)

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | PK |
| tenantSlug | text | Tenant owner |
| vehicleId | UUID | FK → vehiculos |
| clientId | UUID | FK → clients |
| description | text | Descripción del trabajo |
| status | enum | Presupuestado, Aprobado, En_Proceso, Control_Calidad, Listo |
| totalCost | decimal | Costo total |
| hvAlert | bool | Alerta de alta tensión activa |
| hvLockoutSigned | bool | Lockout firmado por mecánico |
| dtcCodes | jsonb | Códigos DTC asociados |
| createdAt/updatedAt | timestamptz | |

### Factura Híbrida (`facturas`)

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | PK |
| tenantSlug | text | |
| ordenId | UUID | FK → ordenesTrabajo |
| tipo | enum | MANUAL, ELECTRONICA |
| numeroFacturaManual | text | Nº preimpreso (MANUAL) |
| sifenCdc | text | Código de Control (ELECTRONICA) |
| sifenStatus | enum | OFFLINE_PENDING, MANUAL_CONVERT_QUEUE, APROBADO_DNIT, etc. |
| xmlRaw | text | XML DTE sin firmar |
| xmlSigned | text | XML firmado |
| total | text | Total en Gs. |

### Documento Fiscal (`fiscalDocumentos`)

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | PK |
| dteTipo | enum | FACTURA, NOTA_CREDITO, etc. |
| serie | text | Serie SIFEN (001) |
| numero | text | Número secuencial |
| cdc | text | Código de Control |
| estado | enum | BORRADOR, FIRMADO, APROBADO, RECHAZADO, ANULADO |
| emisorRuc / receptorRuc | text | RUCs |
| xmlOriginal / xmlFirmado | text | XMLs |

### Cuenta Contable (`planCuentas`)

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | PK |
| codigo | text | 1.1.01, 2.1.01, etc. |
| nombre | text | Caja, Proveedores, etc. |
| tipo | enum | ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO, COSTO, ORDEN |
| nivel | int | Nivel jerárquico |
| cuentaPadreId | UUID | FK jerarquía |
| aceptaMovimientos | bool | |

### Asiento Contable (`asientosContables`)

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | PK |
| tenantSlug | text | |
| numero | int | Nº de asiento secuencial por tenant |
| fecha | date | |
| concepto | text | Glosa |
| totalDebe / totalHaber | numeric | |
| estado | enum | CONTABILIZADO, ANULADO |
| moduloOrigen | text | Sistema origen |
| lineas | jsonb | Array de { cuentaId, debe, haber, descripcion } |

---

## Guía de Consumo (Ejemplos cURL)

```bash
# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"taller_oviedo","email":"admin@taller.com"}'

# Crear cliente
curl -X POST http://localhost:3000/workshop/clientes \
  -H "X-Tenant-Slug: taller_oviedo" \
  -H "Content-Type: application/json" \
  -d '{"name":"Juan Pérez","phone":"0981111111"}'

# Listar órdenes
curl http://localhost:3000/workshop/ordenes?status=En_Proceso \
  -H "X-Tenant-Slug: taller_oviedo"

# Avanzar estado
curl -X PATCH http://localhost:3000/workshop/ordenes/:id \
  -H "X-Tenant-Slug: taller_oviedo" \
  -H "Content-Type: application/json" \
  -d '{"status":"Control_Calidad"}'

# Emitir factura manual
curl -X POST http://localhost:3000/finance/invoices/issue \
  -H "X-Tenant-Slug: taller_oviedo" \
  -H "Content-Type: application/json" \
  -d '{"ordenId":"uuid","tipoFacturacion":"MANUAL","numeroFacturaManual":"001-001-0001234"}'

# Emitir DTE electrónico
curl -X POST http://localhost:3000/finance/sifen/emitir \
  -H "X-Tenant-Slug: taller_oviedo" \
  -H "Content-Type: application/json" \
  -d '{"ordenTrabajoId":"uuid","clienteId":"uuid","dteTipo":"FACTURA","serie":"001","numero":"0000001","condicionVenta":"CONTADO","moneda":"PYG","regimenIVA":"GENERAL","items":[{"cantidad":1,"unidadMedida":"Unidad","descripcion":"Cambio de aceite","precioUnitario":"250000","iva":10,"subtotal":"250000"}]}'

# Listar importaciones Thinkcar
curl http://localhost:3000/thinkcar/imports?status=manual_review \
  -H "X-Tenant-Slug: taller_oviedo"

# Subir PDF Thinkcar
curl -X POST http://localhost:3000/thinkcar/import \
  -H "X-Tenant-Slug: taller_oviedo" \
  -F "file=@reporte_thinkcar.pdf"

# Cierre contable mensual (vía servicio interno)
# POST /finance/contabilidad/apertura + /finance/contabilidad/asientos/automatico
```

---

## Notas de Integración

### Multi-tenencia
Todas las rutas de módulos de negocio requieren `X-Tenant-Slug`. El valor debe ser el slug del taller registrado en la tabla `public.tenants` (ej: `taller_oviedo`, `taller_el_chero`).

### Offline-First
El endpoint `/sync` permite que el SPA funcione offline: las operaciones se encolan localmente y se envían en lote cuando hay conectividad. Máx. 50 operaciones por lote.

### Límite de Memoria (<50MB)
- Pool de DB: máx. 5 conexiones concurrentes
- Firma SIFEN: ejecutada en `worker_threads` (no bloquea el event loop)
- OCR: procesado en cola asíncrona, Tesseract.js lazy-load
- Heap: `--max-old-space-size=48` en producción

### WebSocket TV
El endpoint `/ws/visual/tv` transmite datos en tiempo real a pantallas TV. Mensajes <1KB con torque specs, alertas HV, y timestamps ISO.
