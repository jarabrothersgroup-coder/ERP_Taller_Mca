# 01 — Especificación de Requisitos de Software (ERS)

**Proyecto:** Ecosistema de Gestión Automotriz — AutomotiveOS Cloud ERP  
**Organización:** Jara Brothers Group  
**Norma de referencia:** IEEE 830-1998 / Guías de Estándarización del MITIC  
**Versión:** 2.0  
**Fecha:** 19 de junio de 2026  
**Clasificación:** Documento Oficial — Directoría General de Gobierno Electrónico (MITIC)

---

## 1. Introducción

### 1.1 Objeto del Documento

El presente documento define los requisitos de software del Ecosistema de Gestión Automotriz, conforme al estándar IEEE 830-1998 y a las directrices de estandarización de la Dirección General de Gobierno Electrónico del Ministerio de Tecnologías de la Información y Comunicación (MITIC) del Paraguay.

El sistema integra tres componentes principales:

| Componente | Función Principal | Tecnología |
|---|---|---|
| **ERP Nativo del Taller** | Gestión operativa: órdenes de trabajo, inventario, facturación SIFEN, contabilidad | Fastify + TypeScript + PostgreSQL |
| **CRM Twenty** | Gestión de leads, clientes, campañas de fidelización postventa | Twenty CRM (GraphQL API) |
| **Evolution API** | API Gateway de WhatsApp para envío de estados y recordatorios | Evolution API v2.2.3 |

### 1.2 Alcance del Sistema

El alcance del sistema comprende:

- **Gestión completa del taller automotriz:** Desde la recepción del vehículo (ingreso) hasta la facturación y salida, incluyendo diagnóstico computarizado (DTC), presupuestación, reparación y control de repuestos.
- **Canal de comunicación unificado:** Envío automático y manual de estados de órdenes de trabajo por WhatsApp, con vinculación por código QR.
- **Sincronización bidireccional con CRM:** Los clientes físicos (walk-in) del taller se sincronizan automáticamente hacia Twenty CRM mediante operación UPSERT por teléfono o documento.
- **Gestión de agendamiento inteligente:** Control de capacidad del taller, envío de recordatorios 24 horas antes del turno, y manejo de confirmaciones/cancelaciones por WhatsApp.
- **Cumplimiento fiscal paraguayo:** Emisión de facturas electrónicas conforme a la Resolución General N.º 90 de Marangatu y al Sistema de Integración de Facturación Electrónica (SIFEN) de la DNIT, versión V150.
- **Contabilidad automática (Plan de Cuentas):** Toda transacción genera su asiento contable automáticamente (VENTA, COMPRA, STOCK, NÓMINA, DEPRECIACIÓN).

### 1.3 Definiciones y Acrónimos

| Término | Definición |
|---|---|
| **ERP** | Enterprise Resource Planning — Sistema de Planificación de Recursos Empresariales |
| **CRM** | Customer Relationship Management — Sistema de Gestión de Relación con Clientes |
| **SIFEN** | Sistema de Integración de Facturación Electrónica — DNIT Paraguay |
| **DTE** | Documento Tributario Electrónico |
| **OT** | Orden de Trabajo |
| **UPSERT** | Operación atómica de actualización o inserción (UPDATE + INSERT) |
| **RLS** | Row Level Security — Aislamiento de datos por tenant a nivel de fila en PostgreSQL |
| **Cron Job** | Tarea programada ejecutada periódicamente por el servidor |
| **PUC** | Plan Único de Cuentas — Estructura contable paraguaya |
| **Walk-in** | Cliente que se presenta físicamente sin cita previa |
| **QR** | Código Quick Response para vinculación de WhatsApp |

---

## 2. Descripción General

### 2.1 Perspectiva del Producto

El Ecosistema de Gestión Automotriz se enmarca en la transformación digital del sector automotriz paraguayo, respondiendo a las necesidades de más de 3 millones de vehículos registrados en el país (DNIT/Aduanas), con una infraestructura de talleres que opera predominantemente de forma manual.

El sistema adopta una arquitectura **Cloud-Tethered** (Fastify + TypeScript + PostgreSQL remoto) con un límite estricto de 50 MB de sobrecarga de RAM local, garantizando operación en entornos con conectividad intermitente (mitigaciones offline-first).

### 2.2 Funciones del Software

El sistema ejecuta las siguientes funciones principales a lo largo del ciclo de vida de una orden de trabajo:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CICLO DE VIDA — ORDEN DE TRABAJO            │
└─────────────────────────────────────────────────────────────────┘

  [1. INGRESO]          [2. PRESUPUESTACIÓN]     [3. REPARACIÓN]
  Recepción del          Diagnóstico DTC +         Ejecución de
  vehículo +             cálculo de tempario +     servicios +
  datos del cliente      envío de PDF por WA       control de stock
         │                        │                        │
         ▼                        ▼                        ▼
  [4. SALIDA]           [5. FACTURACIÓN]          [6. SINCRONIZACIÓN]
  Retiro del             Emisión SIFEN +           Walk-in → Twenty
  vehículo +             asiento contable          CRM (UPSERT)
  confirmación           automático
```

| Función | Descripción |
|---|---|
| **Ingreso** | Registro del vehículo, asociación al cliente, creación de la Orden de Trabajo (OT) con estado `RECIBIDO` |
| **Presupuestación** | Diagnóstico computarizado (DTC via Launch/Thinkcar), cálculo de tempario por servicio, generación de PDF y envío por WhatsApp |
| **Reparación** | Ejecución de servicios, control de stock de repuestos, registro de horas de mecánicos, seguimiento de avance |
| **Salida** | Verificación final, retiro del vehículo, confirmación de entrega, cambio de estado a `FINALIZADO_RETIRADO` |
| **Agendamiento** | Reserva de turnos con control de capacidad (máximo 5 bahías), recordatorios por WhatsApp 24h antes, respuesta del cliente (1=confirmar, 2=cancelar) |
| **Sincronización Inversa** | Al cambiar estado a `FINALIZADO_RETIRADO`, el sistema crea o actualiza (UPSERT) el contacto en Twenty CRM con datos del cliente y notas de servicio |

---

## 3. Requisitos Funcionales

### 3.1 Requisitos de Vinculación por QR

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RF-QR-001** | Generación de código QR | El sistema debe generar un código QR único por cada instancia de WhatsApp configurada, que al ser escaneado vincule el dispositivo móvil del operador al gateway de mensajería. | **Alta** |
| **RF-QR-002** | Persistencia del estado de conexión | El estado de conexión (pareado/desconectado) debe persistirse en la base de datos y actualizarse en tiempo real en la interfaz del ERP. | **Alta** |
| **RF-QR-003** | Re-conexión automática | En caso de desconexión, el sistema debe intentar la reconexión automática y notificar al operador si es necesario re-escanear el código QR. | **Media** |
| **RF-QR-004** | Aislamiento por tenant | Cada tenant del ERP debe mantener su propia instancia de WhatsApp independiente, nombrada como `erp-{tenantSlug}`. | **Alta** |

### 3.2 Requisitos de Envío de Estados por WhatsApp

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RF-WA-001** | Envío automático de estados | El sistema debe enviar automáticamente un mensaje de WhatsApp al cliente cuando la OT cambie de estado (RECIBIDO → EN_PRESUPUESTO → EN_REPARACION → FINALIZADO). | **Alta** |
| **RF-WA-002** | Envío manual de estados | El operador debe poder enviar manualmente el estado actual de la OT por WhatsApp mediante un botón explícito en cada pantalla de la OT. | **Alta** |
| **RF-WA-003** | Plantillas de mensajes | El sistema debe disponer de plantillas predefinidas por estado, con variables dinámicas (nombre del cliente, placa, descripción del servicio). | **Alta** |
| **RF-WA-004** | Botones de envío en todas las pantallas | Los botones "💬 Enviar por WhatsApp" deben estar presentes en las pantallas de Recepción, Presupuesto (con envío de PDF), Reparación y Caja. | **Alta** |
| **RF-WA-005** | Envío de PDF por WhatsApp | En la pantalla de Presupuesto, el botón de WhatsApp debe adjuntar y enviar el documento PDF del presupuesto. | **Alta** |
| **RF-WA-006** | Registro de mensajes | Cada mensaje enviado o recibido debe registrarse en la tabla `whatsapp_messages` con estado (PENDING/SENT/FAILED), dirección (inbound/outbound) y timestamp. | **Alta** |
| **RF-WA-007** | Sanitización de números | Los números de teléfono deben sanitizarse al formato E.164 paraguayo (+5959xxxxxxxx) antes del envío. | **Alta** |

### 3.3 Requisitos de Sincronización con Twenty CRM

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RF-CRM-001** | Sincronización inversa automática | Cuando una OT cambie a estado `FINALIZADO_RETIRADO`, el sistema debe crear o actualizar (UPSERT) el contacto del cliente en Twenty CRM. | **Alta** |
| **RF-CRM-002** | Búsqueda por teléfono o documento | El UPSERT debe buscar existencia en Twenty CRM por número de teléfono o documento de identidad antes de crear o actualizar. | **Alta** |
| **RF-CRM-003** | Notas de servicio | Al sincronizar, el sistema debe agregar una nota al contacto en Twenty CRM con el resumen del servicio realizado (fecha, OT, servicios, monto). | **Media** |
| **RF-CRM-004** | Registro de sincronización | Cada operación de sincronización debe registrarse en la tabla `crm_sync_log` con estado (SUCCESS/FAILED/PENDING) y motivo de error. | **Alta** |
| **RF-CRM-005** | Reintentos automáticos | Las sincronizaciones fallidas deben reintentarse automáticamente con backoff exponencial (máximo 3 intentos). | **Media** |

### 3.4 Requisitos de Agendamiento y Control de Capacidad

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RF-AGE-001** | Reserva de turnos | El operador debe poder crear un turno (agendamiento) seleccionando fecha, hora, tipo de servicio (RÁPIDO/PESADO) y datos del cliente. | **Alta** |
| **RF-AGE-002** | Control de capacidad | El sistema debe validar que no se exceda la capacidad máxima de bahías (5 simultáneos) y que los horarios laborales se respeten (Lun-Vie 07:30-17:30, Sáb 07:30-12:00). | **Alta** |
| **RF-AGE-003** | Recordatorio 24 horas | Un cron job diario debe enviar recordatorios por WhatsApp 24 horas antes del turno agendado, solicitando confirmación. | **Alta** |
| **RF-AGE-004** | Respuesta del cliente | El cliente debe poder responder "1" (confirmar) o "2" (cancelar) al recordatorio, actualizando el estado del agendamiento automáticamente. | **Alta** |
| **RF-AGE-005** | Check-in a OT | El operador debe poder convertir un agendamiento confirmado en una Orden de Trabajo heredando el diagnóstico del turno. | **Alta** |
| **RF-AGE-006** | Detección de ausencia | Si el cliente no responde dentro de los 30 minutos posteriores al turno, el sistema debe marcar el agendamiento como `AUSENTE`. | **Media** |
| **RF-AGE-007** | Confirmación inmediata | Al crear un turno, el sistema debe enviar automáticamente un mensaje de confirmación por WhatsApp al cliente. | **Media** |

### 3.5 Requisitos de Cumplimiento Fiscal

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RF-FISC-001** | Facturación SIFEN | El sistema debe emitir DTE conforme a la Resolución General N.º 90 (Marangatu) y al SIFEN de la DNIT, versión V150. | **Alta** |
| **RF-FISC-002** | Asiento contable automático | Toda transacción (VENTA, COMPRA, STOCK, NÓMINA, DEPRECIACIÓN) debe generar su asiento contable automáticamente en estado `CONTABILIZADO`. | **Alta** |
| **RF-FISC-003** | Plan de Cuentas Paraguayo | El sistema debe implementar el PUC paraguayo con estructura jerárquica de 5 niveles (Activo, Pasivo, Patrimonio, Ingresos, Gastos, Costos). | **Alta** |

### 2.3 Requisitos Funcionales — Fase 2

Los siguientes requisitos se agregan en Fase 2 (Sprints 50+) para cubrir funcionalidades avanzadas del taller:

#### 2.3.1 Seguridad Física — USB Token Kill Switch

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RF-SEC-001** | USB Hardware Token | El sistema debe soportar un token USB físico (YubiKey o similar) que funcione como llave de seguridad. Al desconectar el token, el ERP debe bloquear inmediatamente todo acceso (fail-closed). | **Alta** |
| **RF-SEC-002** | Cache de estado del token | El estado del token debe cachearse en memoria con TTL de 5 segundos para evitar consultas excesivas al hardware. | **Alta** |
| **RF-SEC-003** | Excepciones de rutas | Solo las rutas `/health`, `/docs`, `/swagger`, y `/security/hw/status` deben estar exentas del bloqueo por token. | **Media** |

#### 2.3.2 Diagnóstico Vehicular — Thinkcar OBD2

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RF-DIAG-001** | Conectividad Bluetooth RFCOMM | El sistema debe conectarse al escáner Thinkcar vía Bluetooth RFCOMM para lectura de DTCs en tiempo real. | **Alta** |
| **RF-DIAG-002** | Conectividad USB MTP | El sistema debe soportar conexión vía USB MTP como canal alternativo cuando Bluetooth no está disponible. | **Alta** |
| **RF-DIAG-003** | Polling IMAP por email | El sistema debe soportar polling IMAP para recibir archivos de diagnóstico enviados por email desde dispositivos Thinkcar. | **Media** |
| **RF-DIAG-004** | Parser de PDF de Thinkcar | El sistema debe parsear automáticamente los PDFs generados por Thinkcar para extraer códigos DTC, descripciones y datos freeze frame. | **Alta** |
| **RF-DIAG-005** | Mapeo DTC a catálogo | Los códigos DTC leídos deben mapearse automáticamente al catálogo de servicios del taller para sugerir reparaciones y repuestos. | **Media** |

#### 2.3.3 Facturación Electrónica — Contingencia SIFEN

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RF-FISC-001** | Contingencia offline SIFEN | Cuando la conexión a SIFEN no está disponible, el sistema debe generar DTEs en modo contingencia con código de autorización previamente cacheado. | **Alta** |
| **RF-FISC-002** | Matrix de contingencia | El sistema debe mantener una matrix de contingencia que determine qué tipo de documento se puede generar sin conexión (factura, nota de crédito, nota de débito). | **Alta** |
| **RF-FISC-003** | Sincronización post-conexión | Al restaurar la conexión, los DTEs generados en contingencia deben sincronizarse automáticamente con SIFEN. | **Alta** |

#### 2.3.4 Comisiones — Flat Rate

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RF-COM-001** | Comisión Flat Rate | El sistema debe calcular comisiones para mecánicos bajo el modelo Flat Rate, donde el mecánico recibe un monto fijo por hora de trabajo estándar independientemente del tiempo real. | **Alta** |
| **RF-COM-002** | Tabla de tiempos estándar | El sistema debe mantener una tabla de tiempos estándar por tipo de servicio (ej: cambio de aceite = 0.5h,service completo = 4h). | **Alta** |
| **RF-COM-003** | Retroactividad condicional | Las comisiones retroactivas (bonos por desempeño) solo se activan si la facturación neta del mes supera los gastos fijos + salarios base. | **Media** |

#### 2.3.5 Impresión de Etiquetas

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RF-PRINT-001** | Impresión ESC/POS | El sistema debe generar etiquetas en formato ESC/POS para impresoras térmicas estándar. | **Alta** |
| **RF-PRINT-002** | Impresión ZPL | El sistema debe generar etiquetas en formato ZPL para impresoras Zebra. | **Media** |
| **RF-PRINT-003** | Impresión TSPL | El sistema debe generar etiquetas en formato TSPL para impresoras Brother y TSC. | **Media** |

#### 2.3.6 Backup y Restauración

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RF-BACKUP-001** | Backup cifrado AES-256-GCM | Los backups deben cifrarse con AES-256-GCM (no CBC) con derivación de clave PBKDF2 (100K iteraciones). | **Alta** |
| **RF-BACKUP-002** | Checksum SHA-256 | Cada backup debe incluir un checksum SHA-256 para verificación de integridad. | **Alta** |
| **RF-BACKUP-003** | Restauración con 2FA | La restauración de backups debe requerir verificación de dos factores para prevenir restauraciones no autorizadas. | **Alta** |

#### 2.3.7 Internationalización (i18n)

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RF-I18N-001** | Multi-idioma ES/GU | El sistema debe soportar al menos dos idiomas: Español (es) y Guaraní (gu), con traducciones completas de la interfaz. | **Alta** |
| **RF-I18N-002** | Detección automática de idioma | El sistema debe detectar el idioma preferido del usuario (localStorage → navigator.language → default ES). | **Media** |
| **RF-I18N-003** | Formateo local | Las fechas, monedas (Guaraníes) y números deben formatearse según el idioma seleccionado. | **Media** |

#### 2.3.8 Accesibilidad (a11y)

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RF-A11Y-001** | Navegación por teclado | Toda la interfaz debe ser navegable por teclado (Tab, Enter, Escape, flechas). | **Alta** |
| **RF-A11Y-002** | ARIA labels | Todos los elementos interactivos deben tener labels ARIA apropiados, traducidos según idioma. | **Alta** |
| **RF-A11Y-003** | Skip links | El sistema debe proporcionar skip links para saltar a contenido principal. | **Media** |
| **RF-A11Y-004** | Reduced motion | El sistema debe respetar la preferencia `prefers-reduced-motion` del usuario. | **Media** |

---

## 3. Requisitos No Funcionales

### 3.1 Seguridad de Datos

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RNF-SEG-001** | Aislamiento multi-tenant | Los datos de cada tenant deben aislarse mediante Row Level Security (RLS) en PostgreSQL y filtrado a nivel de aplicación. | **Alta** |
| **RNF-SEG-002** | Cifrado en tránsito | Toda comunicación cliente-servidor debe utilizar TLS 1.2 o superior. Las APIs internas entre servicios Docker deben comunicarse por red privada. | **Alta** |
| **RNF-SEG-003** | Autenticación por headers | La autenticación se realiza mediante headers HTTP (`X-Tenant-Slug`, `X-User-Email`) con validación a nivel de middleware. | **Alta** |
| **RNF-SEG-004** | Rate limiting | El sistema debe limitar las solicitudes a 200 por minuto por IP para prevenir abusos. | **Alta** |
| **RNF-SEG-005** | Hashing de contraseñas | Las contraseñas deben cifrarse con scrypt (sal de 32 bytes, clave de 64 bytes) usando el módulo crypto de Node.js. | **Alta** |

### 3.2 Disponibilidad del Gateway de WhatsApp

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RNF-DISP-001** | Disponibilidad mínima | El gateway de WhatsApp debe mantener una disponibilidad mínima del 99.5% mensual. | **Alta** |
| **RNF-DISP-002** | Monitoreo de conexión | El sistema debe monitorear activamente el estado de conexión de la instancia de WhatsApp y notificar al administrador en caso de desconexión. | **Alta** |
| **RNF-DISP-003** | Degradación graceful | Si el gateway de WhatsApp no está disponible, el sistema debe seguir operando (funcionalidad de taller no se ve afectada) y encolar los mensajes para envío posterior. | **Alta** |

### 3.3 Rendimiento y Concurrencia

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| **RNF-REN-001** | Sobrecarga de RAM | La sobrecarga local del servidor no debe exceder 50 MB de memoria RAM. | **Alta** |
| **RNF-REN-002** | Tiempo de respuesta API | El 95% de las solicitudes API deben responder en menos de 200 ms. | **Alta** |
| **RNF-REN-003** | Concurrencia de mensajería | El sistema debe soportar el envío simultáneo de mensajes a múltiples clientes sin bloqueo, utilizando colas de mensajes asíncronas. | **Alta** |
| **RNF-REN-004** | Compresión de respuestas | Todas las respuestas HTTP deben comprimirse mediante gzip, deflate o Brotli. | **Media** |
| **RNF-REN-005** | Cache de datos | Los datos de referencia (catálogo de servicios, plan de cuentas) deben cachearse en memoria para consultas frecuentes, con invalidación ante escrituras. | **Media** |

---

## 4. Restricciones

- **Entorno de ejecución:** Node.js >= 20.0.0, PostgreSQL >= 16
- **Infraestructura:** Docker Compose para entorno de desarrollo y producción
- **Dependencias externas:** Twenty CRM (GraphQL API), Evolution API (REST API), DNIT SIFEN (SOAP/HTTPS)
- **Cumplimiento normativo:** Ley N.º 1034/83 (contribuciones), Resolución General N.º 90 (Marangatu), SIFEN V150 (DNIT)

---

## 5. Aprobación del Documento

| Rol | Nombre | Fecha | Firma |
|---|---|---|---|
| Product Owner | Jara Brothers Group | 18/06/2026 | _____________ |
| Arquitecto de Software | — | — | _____________ |
| Auditor MITIC | — | — | _____________ |

---

*Documento generado conforme a las directrices de estandarización de la Dirección General de Gobierno Electrónico del MITIC — República del Paraguay.*
