# 02 — Documento de Arquitectura de Software (DAS)

**Proyecto:** Ecosistema de Gestión Automotriz — AutomotiveOS Cloud ERP  
**Organización:** Jara Brothers Group  
**Norma de referencia:** ISO/IEC 42010:2011 / Guías de Arquitectura del MITIC  
**Versión:** 2.0  
**Fecha:** 19 de junio de 2026  
**Clasificación:** Documento Oficial — Directoría General de Gobierno Electrónico (MITIC)

---

## 1. Representación de la Arquitectura

### 1.1 Resumen del Modelo

El Ecosistema de Gestión Automotriz adopta una arquitectura **Cloud-Tethered** de microservicios integrados, diseñada para operar con conectividad a internet mientras mantiene mitigaciones offline-first para escenarios de conectividad intermitente.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ARQUITECTURA GENERAL                           │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐     HTTPS/REST      ┌──────────────────┐
  │   FRONTEND   │◄──────────────────►│   ERP BACKEND    │
  │  (SPA + Tailwind)                 │  (Fastify + TS)  │
  │   Puerto 3000 │                   │   Puerto 3000    │
  └──────────────┘                    └────────┬─────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          │                    │                    │
                   ┌──────▼──────┐    ┌───────▼───────┐    ┌──────▼──────┐
                   │ PostgreSQL  │    │  Twenty CRM   │    │ Evolution   │
                   │  (Neon/     │    │  (GraphQL)    │    │   API       │
                   │  Supabase)  │    │  Puerto 2080  │    │  Puerto 8080│
                   └─────────────┘    └───────────────┘    └─────────────┘
                          │                    │                    │
                   ┌──────▼──────┐             │             ┌─────▼──────┐
                   │   Redis 7   │             │             │  WhatsApp  │
                   │  (Cache +   │             │             │  Gateway   │
                   │   Colas)    │             │             │  (QR Pair) │
                   └─────────────┘             │             └────────────┘
                                               │
                                        ┌──────▼──────┐
                                        │   Clients   │
                                        │   GraphQL   │
                                        └─────────────┘
```

### 1.2 Principios Arquitectónicos

| Principio | Descripción |
|---|---|
| **Cloud-Tethered** | El backend se ejecuta como servicio remoto; el frontend es una SPA ligera consumiendo la API REST. No se requiere software local pesado. |
| **Multi-tenant por schema** | Cada tenant tiene su propio schema de PostgreSQL, con aislamiento mediante RLS (Row Level Security). |
| **Event-driven asíncrono** | Las integraciones con Twenty CRM y WhatsApp operan de forma asíncrona para no bloquear la operación del taller. |
| **Degradación graceful** | La indisponibilidad de Twenty CRM o Evolution API no afecta la operación core del ERP. |
| **Contenedización** | Toda la infraestructura se despliega mediante Docker Compose con 5 servicios orquestados. |

---

## 2. Vista de Casos de Uso

### 2.1 Actores del Sistema

| Actor | Rol | Interacción Principal |
|---|---|---|
| **Operador del Taller** | Recepcionista / encargado de OT | Creación de OTs, envío de estados por WhatsApp, facturación, check-in de agendamientos |
| **Mecánico** | Técnico ejecutor | Registro de avance, control de herramientas, consulta de OT asignada |
| **Administrador** | Dueño / gerente del taller | Configuración del sistema, reportes, sincronización con CRM, gestión de agendamiento |
| **Cliente Final** | Propietario del vehículo | Recepción de estados por WhatsApp, respuesta a recordatorios (1=confirmar, 2=cancelar) |

### 2.2 Diagrama de Casos de Uso Principal

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SISTEMA — CASOS DE USO                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────┐               │
│  │           OPERADOR DEL TALLER                   │               │
│  │  ● Registrar ingreso de vehículo                │               │
│  │  ● Crear / editar Orden de Trabajo              │               │
│  │  ● Enviar estado por WhatsApp (botón manual)    │               │
│  │  ● Generar y enviar PDF por WhatsApp            │               │
│  │  ● Registrar agendamiento de turno              │               │
│  │  ● Ejecutar check-in (turno → OT)              │               │
│  │  ● Facturar (SIFEN) y cobrar                   │               │
│  └─────────────────────────────────────────────────┘               │
│                                                                     │
│  ┌─────────────────────────────────────────────────┐               │
│  │           MECÁNICO                              │               │
│  │  ● Consultar OT asignada                        │               │
│  │  ● Registrar avance de trabajo                  │               │
│  │  ● Controlar préstamo de herramientas           │               │
│  └─────────────────────────────────────────────────┘               │
│                                                                     │
│  ┌─────────────────────────────────────────────────┐               │
│  │           ADMINISTRADOR                         │               │
│  │  ● Configurar WhatsApp (escanear QR)            │               │
│  │  ● Configurar CRM ( Twenty tokens )             │               │
│  │  ● Gestionar catálogo de servicios              │               │
│  │  ● Ejecutar migración de datos entre tenants    │               │
│  │  ● Consultar reportes y KPIs                    │               │
│  │  ● Configurar agendamiento y capacidad          │               │
│  └─────────────────────────────────────────────────┘               │
│                                                                     │
│  ┌─────────────────────────────────────────────────┐               │
│  │           CLIENTE FINAL                         │               │
│  │  ● Recibir estados de OT por WhatsApp           │               │
│  │  ● Recibir recordatorio de agendamiento         │               │
│  │  ● Responder "1" (confirmar) / "2" (cancelar)   │               │
│  │  ● Recibir PDF de presupuesto por WhatsApp      │               │
│  └─────────────────────────────────────────────────┘               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Relación de Actores con Componentes

| Actor | ERP | Twenty CRM | Evolution API |
|---|---|---|---|
| Operador | ✅ CRUD completo | — | ✅ Envío manual |
| Mecánico | ✅ Lectura + avance | — | — |
| Administrador | ✅ Config + reportes | ✅ Configuración | ✅ Pairing QR |
| Cliente Final | ✅ Portal público | — | ✅ Recepción + respuesta |

---

## 3. Vista Lógica (Diseño Conceptual)

### 3.1 Modelo de Datos del ERP

El ERP utiliza PostgreSQL con esquemas aislados por tenant. Las siguientes tablas constituyen el núcleo del sistema:

#### Tablas Maestras (Tenant-scoped)

| Tabla | Descripción | Relaciones |
|---|---|---|
| `vehiculos` | Registro de vehículos (placa, VIN, marca, modelo, cliente) | → clientes, → ordenes_trabajo |
| `ordenes_trabajo` | Órdenes de trabajo (estado, diagnóstico, total estimado) | → vehiculos, → clientes, → factura_detalles |
| `clientes` | Datos de clientes (nombre, teléfono, documento, email) | → vehiculos, → ordenes_trabajo |
| `repuestos` | Inventario de repuestos (stock, precio, proveedor) | → orden_repuestos |
| `servicios_catalogo` | Catálogo de servicios del taller (nombre, categoría, precio) | → orden_servicios, → service_pricing_rules |

#### Tablas de Facturación y Contabilidad

| Tabla | Descripción |
|---|---|
| `fiscal_documentos` | Documentos tributarios electrónicos (DTE) emitidos |
| `fiscal_documento_detalles` | Líneas de detalle de facturas (repuestos + servicios) |
| `facturas` | Facturas del taller (total, IVA, estado SIFEN) |
| `plan_cuentas` | Plan de Cuentas paraguayo (PUC) — estructura jerárquica |
| `asientos_contables` | Asientos contables generados automáticamente |
| `asientos_detalle` | Líneas de débito/crédito por asiento |

#### Tablas de Integración

| Tabla | Descripción |
|---|---|
| `whatsapp_messages` | Registro de mensajes enviados/recibidos (PENDING/SENT/FAILED) |
| `whatsapp_errors_log` | Log de errores de integración con Evolution API |
| `crm_sync_log` | Registro de sincronizaciones ERP → Twenty CRM |
| `agendamientos` | Turnos agendados (estado, capacidad, recordatorios) |

### 3.2 Diagrama Entidad-Relación (Simplificado)

```
                    ┌──────────────┐
                    │   tenants    │
                    │──────────────│
                    │ id (PK)      │
                    │ slug (UQ)    │
                    │ company_name │
                    └──────┬───────┘
                           │ 1:N
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
   │  clientes   │  │ vehiculos  │  │ servicios  │
   │─────────────│  │────────────│  │ _catalogo  │
   │ id (PK)     │  │ id (PK)    │  │────────────│
   │ nombre      │  │ placa      │  │ id (PK)    │
   │ telefono    │  │ vin        │  │ nombre     │
   │ documento   │  │ cliente_id │  │ codigo     │
   │ tenant_slug │  │ tenant_slug│  │ precio     │
   └──────┬──────┘  └─────┬──────┘  │ tenant_slug│
          │                │         └────────────┘
          │                │
          │         ┌──────▼──────┐
          │         │  ordenes    │
          │         │  _trabajo   │
          │         │─────────────│
          │         │ id (PK)     │
          │         │ vehiculo_id │
          │         │ estado      │
          │         │ tenant_slug │
          │         └──────┬──────┘
          │                │
   ┌──────▼───────────────▼──────┐
   │      fiscal_documentos      │
   │─────────────────────────────│
   │ id (PK)                     │
   │ orden_trabajo_id (FK)       │
   │ tipo_dte (SIFEN)            │
   │ estado_sifen                │
   │ total                       │
   │ tenant_slug                 │
   └─────────────────────────────┘
```

### 3.3 Entidades de Twenty CRM

Twenty CRM utiliza su propio modelo de datos relacional (PostgreSQL), con las siguientes entidades relevantes para la integración:

| Entidad Twenty CRM | Campos Sincronizados | Dirección |
|---|---|---|
| `Person` (Contacto) | first_name, phone, email, documentation_number, car_brand, car_model, car_plate | ERP → CRM (UPSERT) |
| `Note` (Nota) | content (resumen de servicio) | ERP → CRM (Append) |
| `Company` (Empresa) | name, domain_name | Configuración estática |

### 3.4 Instancias de Evolution API

Cada tenant del ERP mantiene una instancia independiente de Evolution API:

| Parámetro | Valor |
|---|---|
| Nombre de instancia | `erp-{tenantSlug}` |
| Protocolo | WhatsApp Web (Baileys) |
| Método de vinculación | QR Code |
| Endpoint de envío | `POST /message/sendText/{instance}` |
| Endpoint de estado | `GET /instance/connectionState/{instance}` |
| Webhook de recepción | `POST /webhook/{instance}` |

---

## 4. Vista de Despliegue

### 4.1 Infraestructura Docker

El sistema se despliega mediante Docker Compose con los siguientes servicios:

```
┌──────────────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE — 5 SERVICIOS                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  postgres:16    │    │  twenty-crm     │                     │
│  │  Puerto: 5432   │    │  Puerto: 2080   │                     │
│  │  Volumen: pgdata│    │  Volumen: twenty│                     │
│  └─────────────────┘    └─────────────────┘                     │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │  redis:7        │    │ evolution-api   │    │  ERP Backend │ │
│  │  Puerto: 6379   │    │  Puerto: 8080   │    │  Puerto: 3000│ │
│  │  (Cache+Colas)  │    │  (WhatsApp GW)  │    │  (Fastify)   │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Puertos de Comunicación Internos

| Servicio | Puerto Externo | Puerto Interno | Protocolo |
|---|---|---|---|
| ERP Backend (Fastify) | 3000 | 3000 | HTTP/HTTPS |
| PostgreSQL | 5432 | 5432 | TCP (postgresql) |
| Twenty CRM | 2080 | 2080 | HTTP (GraphQL) |
| Evolution API | 8080 | 8080 | HTTP (REST) |
| Redis | 6379 | 6379 | TCP |

### 4.3 Consumo de APIs Externas

| API | Protocolo | Uso | Endpoint |
|---|---|---|---|
| Twenty CRM | GraphQL (HTTPS) | UPSERT de contactos, agregar notas | `{TWENTY_GRAPHQL_URL}` |
| Evolution API | REST (HTTP) | Envío de mensajes, estado de conexión, pairing QR | `{WHATSAPP_API_URL}` |
| DNIT SIFEN | SOAP (HTTPS) | Emisión de DTE, validación de CDC | `https://sifen.dnit.gov.py/...` |
| NHTSA VIN | REST (HTTPS) | Decodificación de VIN | `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/` |

### 4.4 Diagrama de Red

```
┌─────────────────────────────────────────────────────────────────┐
│                    RED DE COMUNICACIÓN                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INTERNET                                                      │
│     │                                                           │
│     ▼                                                           │
│  ┌──────────────────────────────────────────────────┐          │
│  │           RED PRIVADA DOCKER                     │          │
│  │                                                  │          │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐     │          │
│  │  │  ERP    │◄──►│  PGSQL  │    │  Redis  │     │          │
│  │  │ :3000   │    │ :5432   │    │ :6379   │     │          │
│  │  └────┬────┘    └─────────┘    └─────────┘     │          │
│  │       │                                         │          │
│  │       ├──────► Twenty CRM (:2080)               │          │
│  │       │                                         │          │
│  │       └──────► Evolution API (:8080)            │          │
│  │                                                  │          │
│  └──────────────────────────────────────────────────┘          │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                    │
│  │ WhatsApp │    │  DNIT   │    │  NHTSA  │                    │
│  │ (Baileys)│    │  SIFEN  │    │  (VIN)  │                    │
│  └─────────┘    └─────────┘    └─────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Mecanismos de Integración

### 5.1 Integración ERP → Twenty CRM (Sincronización Inversa)

**Flujo:**

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  OT camb │    │  Buscar  │    │  Crear o │    │  Agregar │
│  a FINAL │───►│ contacto │───►│ actualizar│───►│  nota de │
│ _RETIRADO│    │  en CRM  │    │  (UPSERT) │    │ servicio │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

- **Mecanismo:** Worker asíncrono (`crm-sync.worker.ts`)
- **Trigger:** Cambio de estado de OT a `FINALIZADO_RETIRADO`
- **Búsqueda:** Por número de teléfono o documento de identidad
- **Operación:** UPSERT (create if not exists, update if exists)
- **Reintentos:** 3 intentos con backoff exponencial
- **Registro:** Cada operación se registra en `crm_sync_log`

### 5.2 Integración ERP → WhatsApp (Envío de Mensajes)

**Flujo:**

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Operador│    │  Sanitiz.│    │  Llamar  │    │  Registrar│
│  clic en │───►│  número  │───►│  Evolution│───►│  en tabla │
│  botón   │    │  E.164   │    │  API REST │    │  log      │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

- **Mecanismo:** Servicio HTTP síncrono (`whatsapp.service.ts`)
- **Endpoint:** `POST /message/sendText/{instance}`
- **Formato:** JSON con `number`, `text`, `delay` (opcional)
- **Registro:** Cada envío se registra en `whatsapp_messages` con estado

### 5.3 Integración WhatsApp → ERP (Recepción de Mensajes)

**Flujo:**

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Cliente │    │ Webhook  │    │  Parsear │    │  Actualizar│
│  responde│───►│ Evolution│───►│  respuesta│───►│  agendam. │
│  "1" / "2"│   │  API     │    │  (1=conf) │    │  o notif. │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

- **Mecanismo:** Webhook entrante (`POST /webhook/{instance}`)
- **Parseo:** Extracción del mensaje del body del webhook
- **Lógica:** Si el mensaje es "1" → CONFIRMADO; si "2" → CANCELADO
- **Registro:** Se registra en `whatsapp_messages` como `inbound`

### 5.4 Cron Jobs (Tareas Programadas)

| Cron Job | Frecuencia | Función |
|---|---|---|
| `reminder.cron.ts` | Diario a las 08:00 AM | Envía recordatorios 24h antes del turno |
| `absence.cron.ts` | Integrado en reminder | Detecta agendamientos sin respuesta 30min después del turno |
| `sync-retry.cron.ts` | Cada 15 minutos | Reintenta sincronizaciones fallidas con Twenty CRM |

### 5.5 Colas de Mensajes (Redis)

Para evitar bloqueos del gateway de WhatsApp y garantizar la entrega:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Cola    │    │  Worker  │    │  Enviar  │    │  Actualizar│
│  WA_OUT  │───►│  async   │───►│  mensaje │───►│  estado   │
│  (Redis) │    │          │    │  (API)   │    │  (DB)     │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

- **Ventaja:** El operador no esperaba la respuesta del gateway
- **Resiliencia:** Si Evolution API está caído, los mensajes se encolan
- **Reintentos:** Backoff exponencial con máximo 3 intentos

### 5.6 Mecanismos de Reintentos (Try/Catch)

```typescript
// Patrón de reintentos implementado en el sistema
async function safeRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000,
): Promise<T> {
  let lastError: Error;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        await sleep(backoffMs * Math.pow(2, attempt));
      }
    }
  }
  throw lastError!;
}
```

| Componente | Intentos | Backoff | Timeout |
|---|---|---|---|
| Twenty CRM UPSERT | 3 | 1s → 2s → 4s | 10s |
| Evolution API (envío) | 3 | 500ms → 1s → 2s | 5s |
| DNIT SIFEN (DTE) | 2 | 2s → 4s | 30s |

---

## 6. Patrones de Resiliencia

### 5.1 USB Hardware Kill Switch — Fail-Closed

El patrón de seguridad física implementa un middleware que verifica periódicamente la presencia de un token USB físico. El diseño es **fail-closed**: si hay cualquier duda sobre el estado del token, se bloquea el acceso.

```
┌─────────────────────────────────────────────────────────────────┐
│                    USB KILL SWITCH MIDDLEWARE                    │
└─────────────────────────────────────────────────────────────────┘

  ┌──────────────┐     checkEvery(5s)    ┌──────────────────┐
  │   Fastify    │◄────────────────────►│  HW Status Cache │
  │   Request    │                      │  {present: bool}  │
  └──────┬───────┘                      │  ttl: 5 seconds   │
         │                              └────────┬─────────┘
         │                                       │
    ┌────▼────┐                           ┌──────▼──────┐
    │  Auth   │                           │  USB Check  │
    │  Middleware                          │  Script     │
    └────┬────┘                           └──────┬──────┘
         │                                       │
    ┌────▼───────────────────────────────────────▼────┐
    │              Request Decision                    │
    │  ┌─────────────────┐  ┌──────────────────────┐  │
    │  │ Token PRESENT   │  │ Token ABSENT/UNKNOWN │  │
    │  │ → Process req   │  │ → Block (403)        │  │
    │  └─────────────────┘  └──────────────────────┘  │
    └─────────────────────────────────────────────────┘
```

**Implementación:**
- `src/modules/security/hw-kill-switch.ts` — Middleware con cache en memoria (TTL 5s)
- `GET /security/hw/status` — Endpoint para consultar estado del token (exento del bloqueo)
- Rutas exentas: `/health`, `/docs`, `/swagger`, `/security/hw/status`
- Respuesta cuando token ausente: `403 Forbidden` con mensaje `HW_AUTH_REQUIRED`

### 5.2 IMAP Worker — Diagnóstico por Email

El worker IMAP permite recibir archivos de diagnóstico Thinkcar enviados por email, parseando automáticamente los PDFs adjuntos para extraer códigos DTC y datos de diagnóstico.

```
┌─────────────────────────────────────────────────────────────────┐
│                      IMAP WORKER FLOW                           │
└─────────────────────────────────────────────────────────────────┘

  ┌──────────────┐     poll every 60s    ┌──────────────────┐
  │  Thinkcar    │──── email + PDF ────►│  IMAP Worker     │
  │  Device      │                      │  (Node IMAP)     │
  └──────────────┘                      └────────┬─────────┘
                                                 │
                                          ┌──────▼──────┐
                                          │  PDF Parser │
                                          │  (pdf-parse)│
                                          └──────┬──────┘
                                                 │
                                     ┌───────────▼───────────┐
                                     │  DTC Extraction       │
                                     │  • Code (P0300, etc)  │
                                     │  • Description        │
                                     │  • Freeze Frame data  │
                                     │  • Severity level     │
                                     └───────────┬───────────┘
                                                 │
                              ┌──────────────────▼──────────────────┐
                              │  Auto-apply to Work Order           │
                              │  • Append to diagnosis field        │
                              │  • Merge DTC codes into array       │
                              │  • Trigger AI Copilot suggestion    │
                              └─────────────────────────────────────┘
```

**Implementación:**
- `src/modules/diagnostic/workers/imap.worker.ts` — Worker IMAP con polling configurable
- `src/modules/diagnostic/services/pdf-parser.service.ts` — Parser de PDFs Thinkcar
- `src/modules/diagnostic/services/dtc-extraction.service.ts` — Extracción y mapeo de DTCs
- Configuración: `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASS`, `IMAP_POLL_INTERVAL`
- Los PDFs parseados se almacenan en Supabase Storage con metadatos de diagnóstico

---

## 7. Seguridad de la Arquitectura

| Capa | Mecanismo |
|---|---|
| **Transporte** | TLS 1.2+ (HTTPS) para todas las comunicaciones externas |
| **Autenticación** | JWT HMAC-SHA256 con expiración 8h + headers HTTP (`X-Tenant-Slug`, `X-User-Email`) |
| **Aislamiento de datos** | PostgreSQL RLS (Row Level Security) + filtrado por `tenant_slug` |
| **Rate Limiting** | 200 req/min por IP (`@fastify/rate-limit`) con store persistente en JSON |
| **CSRF** | Double-submit cookie pattern (stateless, compatible con JWT) |
| **Validación de entrada** | Zod v4 con `validateBody()` y `validateQuery()` helpers |
| **Headers de seguridad** | Helmet + CSP + HSTS + X-Frame-Options (OWASP) |
| **Cifrado de contraseñas** | scrypt (32-byte salt, 64-byte key) |
| **Cifrado de backups** | AES-256-GCM (no CBC) + PBKDF2 100K iteraciones + checksum SHA-256 |
| **Seguridad física** | USB Hardware Kill Switch — fail-closed con cache TTL 5s |
| **Firma digital** | 2FA obligatoria para restauración de backups y operaciones críticas |

---

## 8. Aprobación del Documento

| Rol | Nombre | Fecha | Firma |
|---|---|---|---|
| Arquitecto de Software | Jara Brothers Group | 18/06/2026 | _____________ |
| Auditor Técnico MITIC | — | — | _____________ |

---

*Documento generado conforme a las directrices de arquitectura de software de la Dirección General de Gobierno Electrónico del MITIC — República del Paraguay.*
