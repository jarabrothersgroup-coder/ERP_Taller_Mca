# 🔒 AUDITORÍA DE SEGURIDAD DEVSECOPS — AUTOMOTIVEOS CLOUD ERP

**Fecha:** 19 de junio de 2026  
**Auditor:** Líder QA Automation + CEH + DevSecOps Architect  
**Alcance:** ERP + Twenty CRM + Evolution API + SIFEN  
**Clasificación:** CONFIDENCIAL — Solo para Dirección

---

## RESUMEN EJECUTIVO

| Severidad | Encontrados | Bloqueadores de Release |
|---|---|---|
| 🔴 CRÍTICO | 5 | 2 |
| 🟠 ALTO | 8 | 3 |
| 🟡 MEDIO | 7 | 0 |
| 🔵 BAJO | 4 | 0 |
| **TOTAL** | **24** | **5** |

---

## CAPA 1: SEGURIDAD Y PENTESTING

### 🔴 CRÍTICO-01: Secret Key Hardcodeado en Código Fuente

**Archivo:** `src/modules/security-hw/services/hardware-fingerprint.service.ts:47`
```typescript
const TOKEN_SECRET = "AutomotiveOS-ERP-2024-SECRET-KEY-xK9mP2vL";
```

**Riesgo:** Cualquier persona con acceso al repositorio (ex-employee, fork público) puede generar tokens válidos y bypassear el Kill Switch. El token USB se cifra con esta key — si se expone, un atacante puede crear un USB falso.

**Vector de ataque:** Fork del repo → leer TOKEN_SECRET → generar token con huella de hardware falsa → insertar USB falso → sistema operativo desbloqueado.

**Remediación inmediata:**
```typescript
// MOVER a variables de entorno con validación en startup
const TOKEN_SECRET = process.env.HARDWARE_TOKEN_SECRET;
if (!TOKEN_SECRET || TOKEN_SECRET.length < 32) {
  throw new Error('FATAL: HARDWARE_TOKEN_SECRET must be set (>=32 chars)');
}
```

---

### 🔴 CRÍTICO-02: USB_DONGLE_PATH configurable por env var

**Archivo:** `src/modules/security-hw/services/hardware-fingerprint.service.ts:447`
```typescript
const usbPath = process.env.USB_DONGLE_PATH || "/media/usb";
```

**Riesgo:** Un atacante con acceso al contenedor Docker puede montar un directorio falso en `/media/usb` con un token previamente generado (usando CRÍTICO-01), logrando bypass completo del Kill Switch.

**Remediación:** El path del USB debe ser hardcoded o verificarse contra un hash del dispositivo real, no configurable.

---

### 🔴 CRÍTICO-03: resetKillSwitch() sin autenticación

**Archivo:** `src/modules/security-hw/middleware/hardware-lock.middleware.ts:192`
```typescript
export function resetKillSwitch(): void {
  killSwitchActivated = false;  // Sin auth, sin 2FA, sin audit log
}
```

**Riesgo:** Cualquier request al endpoint que llame `resetKillSwitch()` puede reactivar el sistema después de un bloqueo legítimo. No hay verificación de identidad ni registro de auditoría.

**Remediación:** `resetKillSwitch()` debe requerir `requireAdmin` + 2FA + audit log inmutable.

---

### 🟠 ALTO-01: DVI Upload — MIME type spoofing

**Archivo:** `src/modules/dvi/services/photo-storage.service.ts:56`
```typescript
if (!ALLOWED_TYPES.includes(contentType)) {
  throw new Error(`Tipo de archivo no permitido: ${contentType}`);
}
```

**Riesgo:** El `contentType` viene del cliente (header Content-Type). Un atacante puede enviar un archivo PHP/JS con header `image/jpeg` y pasar la validación. Supabase Storage almacena el archivo con la extensión original del filename, que puede ser `.jpg.exe`.

**Vector:** `POST /dvi/photos` con body = `<script>alert('xss')</script>`, Content-Type: `image/jpeg`, filename: `photo.jpg`

**Remediación:**
```typescript
// 1. Validar magic bytes del archivo, no solo el MIME type
import { fileTypeFromBuffer } from 'file-type';
const detected = await fileTypeFromBuffer(fileBuffer);
if (!detected || !ALLOWED_MIME.includes(detected.mime)) {
  throw new Error('Archivo corrupto o tipo no permitido');
}

// 2. Usar nombre generado (UUID), nunca el filename original
const safeFilename = `${photoId}.${detected.ext}`;

// 3. Strip EXIF metadata
import sharp from 'sharp';
const cleaned = await sharp(fileBuffer).rotate().toBuffer();
```

---

### 🟠 ALTO-02: Falta Content Security Policy estricto

**Archivo:** `src/app.ts:110` — Helmet tiene `xssFilter: true` pero no se verifica CSP estricto.

**Riesgo:** Sin CSP, un XSS almacenado (ej: en notas del mecánico) puede ejecutar JavaScript arbitrario, robar tokens JWT, o hacer requests a APIs externas.

---

### 🟠 ALTO-03: No se validan magic bytes en uploads

Véase ALTO-01. Solo se valida el MIME type del request, no el contenido real del archivo.

---

### 🟠 ALTO-04: EXIF data no se elimina en fotos DVI

**Archivo:** `src/modules/dvi/services/photo-storage.service.ts`

**Riesgo:** Las fotos pueden contener metadatos EXIF con coordenadas GPS del taller, horarios de fotos, información del dispositivo. Esto expone la ubicación física del taller y patrones de trabajo.

---

### 🟠 ALTO-05: Logs potencialmente expuestos en error responses

El middleware de errores (`error-handler.ts`) debe verificar que no se filtre stack traces al cliente en modo producción.

---

### 🟡 MEDIO-01: WebSocket sin cleanup en page unload

**Archivo:** `src/shared/public/js/notification-bell.js:39`

El WebSocket de notificaciones no tiene `beforeunload` handler para cerrar la conexión limpiamente. Puede causar leak de conexiones en el servidor.

---

### 🟡 MEDIO-02: `innerHTML` con datos de usuario en algunos módulos

Aunque existe `sanitize.js` y `escapeHtml()`, algunos módulos usan `innerHTML` con template literals que incluyen datos del servidor sin sanitizar (ej: `ordenes.js`, `contabilidad.js`).

---

## CAPA 2: BACKEND Y CONCURRENCIA

### 🔴 CRÍTICO-04: Race Condition en Agendamientos (TOCTOU)

**Archivo:** `src/modules/scheduling/services/capacity.service.ts:168-212`

**Problema:** `countOverlappingAppointments()` hace un SELECT para leer la cantidad de turnos, y luego el caller hace un INSERT si hay espacio. No hay bloqueo de fila.

```
Request A: SELECT count(*) → 4 (max=5, hay espacio)
Request B: SELECT count(*) → 4 (max=5, hay espacio)
Request A: INSERT turno → OK
Request B: INSERT turno → OK — ¡SOBRE-AGENDAMIENTO!
```

**Remediación:**
```typescript
// Opción 1: SELECT FOR UPDATE (pessimistic locking)
await db().execute(sql`
  SELECT * FROM agendamientos 
  WHERE fecha_turno = ${dateStr} 
  FOR UPDATE
`);

// Opción 2: Unique constraint (database-level prevention)
ALTER TABLE agendamientos 
  ADD CONSTRAINT no_overlap 
  EXCLUDE USING gist (
    tenant_slug WITH =,
    fecha_turno WITH =,
    tsrange(hora_turno, (hora_turno + duracion_horas || ' hours')::interval) WITH &&
  );

// Opción 3: Optimistic locking con version column
UPDATE agendamientos SET version = version + 1 
  WHERE id = ${id} AND version = ${expectedVersion};
-- Si affected rows = 0, someone else modified it → retry
```

---

### 🟠 ALTO-06: WhatsApp Cron sin rate limiting — riesgo de spam

**Archivo:** `src/modules/scheduling/jobs/reminder.cron.ts:80-122`

**Problema:** El cron envía todos los recordatorios en un loop sin delay entre mensajes. Si hay 500 turnos para mañana, serán 500 requests a Evolution API en segundos. Meta bloqueará el número.

```typescript
// ACTUAL — Sin delay entre mensajes
for (const appt of appointmentsToRemind) {
  await sendTextMessage(tenantSlug, phone, message); // ¡500 en segundos!
}

// REQUERIDO — Rate limiting adaptativo
for (const appt of appointmentsToRemind) {
  await sendTextMessage(tenantSlug, phone, message);
  await sleep(1500); // Mínimo 1.5s entre mensajes (~40/min)
  // Si recibe 429, esperar 60s y reintentar
}
```

---

### 🟠 ALTO-07: Sin manejo de HTTP 429 en WhatsApp queue

**Archivo:** `src/modules/whatsapp/services/whatsapp-queue.service.ts:108-138`

**Problema:** Si Evolution API retorna 429 (rate limit), el mensaje se marca como FAILED permanentemente. No hay retry con backoff específico para 429.

---

### 🟡 MEDIO-03: Sin idempotency key en sync Twenty CRM

Si la conexión se corta después de crear un cliente en Twenty CRM pero antes de confirmar al ERP, el retry creará un duplicado. No hay idempotency key en el UPSERT.

---

## CAPA 3: BASE DE DATOS E INTEGRIDAD

### 🔴 CRÍTICO-05: 94 uso de parseFloat en cálculos monetarios

**Archivos afectados:** 15+ archivos en `src/modules/finance/`

**Problema CRÍTICO:** JavaScript `number` es float64. Para Guaraníes (enteros), esto causa:
- `0.1 + 0.2 = 0.30000000000000004` (error de redondeo)
- Acumulación de errores en IVA (10% y 5%)
- SIFEN rechaza facturas con centavos incorrectos

**Ejemplo real encontrado:**
```typescript
// sifen.ts:172 — IVA calculation with float
.reduce((s, i) => s + parseFloat(i.subtotal), 0) // ← FLOAT!
```

**Remediación inmediata:**
```typescript
// Opción 1: Usar string arithmetic (recomendado para Paraguay)
function sumMoney(...values: string[]): string {
  return values.reduce((sum, v) => {
    const a = BigInt(sum.replace(/\./g, ''));
    const b = BigInt(v.replace(/\./g, ''));
    return String(a + b);
  }, '0');
}

// Opción 2: Usar biblioteca decimal.js
import Decimal from 'decimal.js';
const total = items.reduce((sum, i) => sum.plus(i.subtotal), new Decimal(0));
```

---

### 🟠 ALTO-08: Verificar ROLLBACK en fallo SIFEN

**Archivo:** `src/modules/finance/routes/invoice.routes.ts:77`

El endpoint usa `db().transaction()`, lo cual es bueno. Pero se debe verificar que si `signXMLInWorker()` falla, el ROLLBACK se ejecuta correctamente y:
1. La OT no cambia de estado
2. El stock no se descuenta
3. La factura queda en estado PENDIENTE (no CREADA)

---

### 🟡 MEDIO-04: Sin test de integridad de backups

No existe test automatizado que verifique:
- Integridad del dump SQL
- Tamaño > 0 bytes
- Descompresión exitosa
- Contenido mínimo esperado (tablas, datos)

---

## CAPA 4: INFRAESTRUCTURA Y DEVOPS

### 🟠 ALTO-09: Docker sin límites de recursos

**Archivo:** `docker-compose.yml`

**Problema:** Ningún contenedor tiene `deploy.resources.limits`. Un bucle infinito en Evolution API puede consumir toda la RAM del servidor y tumbar el ERP completo.

```yaml
# ACTUAL — Sin límites
erp:
  build: .
  container_name: erp-backend

# REQUERIDO
erp:
  build: .
  container_name: erp-backend
  deploy:
    resources:
      limits:
        memory: 256M
        cpus: '1.0'
      reservations:
        memory: 128M
        cpus: '0.5'
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

---

### 🟡 MEDIO-05: Redis sin contraseña

**Archivo:** `docker-compose.yml:88` — Redis no tiene `requirepass`. Cualquier contenedor en la red puede acceder a Redis.

---

### 🟡 MEDIO-06: Sin health checks en evolution-api y erp

Solo PostgreSQL y Redis tienen health checks. Evolution API y ERP backend no.

---

## CAPA 5: FRONTEND Y HARDWARE

### 🟡 MEDIO-07: Bluetooth Thinkcar sin límite de reconexión

Si el mecánico pierde la conexión Bluetooth, el frontend puede entrar en un loop infinito de reconexión que congele la interfaz.

---

### 🔵 BAJO-01: Canvas DVI sin optimización para tablets low-end

El canvas de anotaciones en fotos debe usar `requestAnimationFrame` throttling y evitar re-renders completos.

---

### 🔵 BAJO-02: IndexedDB sin límite de tamaño

`offline-db.js` no tiene cuota máxima de almacenamiento. En tablets con poco espacio puede causar errores.

---

## CAPA 6: SMOKE TEST E2E — ESTRUCTURA

(Ver archivo separado: `tests/e2e/smoke-test-suite.ts`)

---

## RECOMENDACIONES INMEDIATAS (Prioritized)

### P0 — Antes de cualquier deploy:
1. Mover `TOKEN_SECRET` a env var (CRÍTICO-01)
2. Hardcodear o auditar `USB_DONGLE_PATH` (CRÍTICO-02)
3. Agregar auth a `resetKillSwitch()` (CRÍTICO-03)
4. Agregar delay de 1.5s entre mensajes WhatsApp (ALTO-06)

### P1 — Esta semana:
5. Reemplazar `parseFloat` por string arithmetic en finanzas (CRÍTICO-05)
6. Agregar `SELECT FOR UPDATE` o constraint de overlap en agendamientos (CRÍTICO-04)
7. Validar magic bytes en DVI uploads (ALTO-01)
8. Agregar límites de recursos a Docker (ALTO-09)

### P2 — Este sprint:
9. Strip EXIF de fotos DVI (ALTO-04)
10. Agregar retry con backoff para 429 en WhatsApp (ALTO-07)
11. Test de integridad de backups (MEDIO-04)
12. Rate limiting en Redis (MEDIO-05)
