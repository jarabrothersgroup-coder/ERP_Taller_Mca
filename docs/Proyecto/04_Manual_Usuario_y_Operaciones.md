# 04 — Manual de Usuario y Operaciones

**Proyecto:** Ecosistema de Gestión Automotriz — AutomotiveOS Cloud ERP  
**Organización:** Jara Brothers Group  
**Norma de referencia:** Guías de Manual de Usuario del MITIC  
**Versión:** 3.0  
**Fecha:** 22 de junio de 2026  
**Clasificación:** Documento Oficial — Directoría General de Gobierno Electrónico (MITIC)

---

## 1. Introducción

Este manual describe las operaciones diarias del Ecosistema de Gestión Automotriz, orientado al personal del taller automotriz: operadores (recepcionistas), mecánicos y administradores.

El sistema integra gestión de órdenes de trabajo, facturación electrónica, agendamiento de turnos y comunicación por WhatsApp en una única plataforma web.

### 1.1 Requisitos del Navegador

| Navegador | Versión Mínima |
|---|---|
| Google Chrome | 90+ |
| Mozilla Firefox | 88+ |
| Microsoft Edge | 90+ |
| Safari | 14+ |

### 1.2 Acceso al Sistema

```
URL del sistema: http://localhost:3000/dashboard
                  (o la dirección del servidor en producción)
```

**Credenciales por defecto:**
- **Email:** `jaraju01@gmail.com`
- **Tenant:** `taller-el-chero`

### 1.3 Atajos de Teclado

| Atajo | Acción |
|---|---|
| `Ctrl+K` | Búsqueda global rápida |
| `Ctrl+Shift+P` | Panel de métricas de rendimiento (modo desarrollo) |
| `Esc` | Cerrar modal / panel lateral |
| `?` | Mostrar ayuda de atajos |

### 1.4 Características de Accesibilidad

El sistema cumple con estándares WCAG 2.1 AA:

- **Navegación por teclado:** Todos los elementos interactivos son alcanzables con `Tab` y activables con `Enter`/`Espacio`.
- **Etiquetas ARIA:** Los botones con solo íconos SVG reciben `aria-label` automático.
- **Movimiento reducido:** Si tu sistema operativo tiene habilitado "reducir movimiento", las animaciones se desactivan automáticamente.
- **Contraste:** Todos los textos cumplen ratio mínimo de 4.5:1 sobre fondos oscuros.

---

## 2. Módulo de Conectividad WhatsApp (Configuración)

### 2.1 Conectar WhatsApp — Paso a Paso

Este procedimiento debe ser realizado por el **Administrador** del sistema.

**Objetivo:** Vincular el teléfono del taller al gateway de WhatsApp para enviar y recibir mensajes.

#### Paso 1: Acceder a Configuración

1. Abrir el navegador y acceder a la URL del sistema.
2. En el menú lateral izquierdo, hacer clic en **"⚙️ Config"**.
3. Se mostrará la página de configuración del taller.

#### Paso 2: Conectar WhatsApp

1. En la sección **"WhatsApp"** de la página de Configuración, hacer clic en el botón **"📱 Conectar WhatsApp"**.
2. El sistema mostrará un código QR en pantalla.
3. Abrir la aplicación **WhatsApp** en el teléfono móvil del taller.
4. Ir a **Configuración → Dispositivos vinculados → Vincular dispositivo**.
5. Escanear el código QR mostrado en la pantalla del computador.
6. Esperar a que el sistema confirme la conexión exitosa.

```
┌─────────────────────────────────────────────────────┐
│                PANTALLA DE CONEXIÓN                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│    ┌─────────────────────────────┐                 │
│    │                             │                 │
│    │      [CÓDIGO QR AQUÍ]      │                 │
│    │                             │                 │
│    │   Escanee con su teléfono   │                 │
│    │                             │                 │
│    └─────────────────────────────┘                 │
│                                                     │
│    Estado: ⏳ Esperando escaneo...                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Paso 3: Verificar Conexión

1. Después de escanear, el código QR desaparecerá.
2. El indicador de estado en la **barra superior** del ERP cambiará a color **verde** con el texto **"🟢 WhatsApp: Conectado"**.
3. Si el indicador permanece en **rojo** ("🔴 WhatsApp: Desconectado"), repetir el paso 2.

### 2.2 Reconexión de WhatsApp

Si la conexión se pierde (indicador rojo):

1. Ir a **Configuración → WhatsApp**.
2. Hacer clic en **"🔄 Reconectar"**.
3. Se generará un nuevo código QR.
4. Repetir el procedimiento de escaneo descrito en el Paso 2.

---

## 3. Casos de Uso — Taller Paraguayo

### 3.1 Caso de Uso: Asesor de Servicio (Recepcionista)

**Rol:** Asesor de Servicio  
**Escenario:** Un cliente llega al taller con su Toyota Hilux 2020 reportando ruidos en los frenos.

#### Flujo paso a paso:

1. **Recepción del vehículo**
   - Ir a **Taller → Nuevo Ingreso**
   - Buscar cliente por CI/RUC o teléfono: `098123456` → Selecciona "Juan Pérez"
   - Seleccionar vehículo: Toyota Hilux 2020, placa `ABC-1234`
   - Registrar motivo: "Ruido al frenar, pastillas desgastadas"
   - Click **Registrar Ingreso** → Se crea OT #2024-001 con estado `RECIBIDO`

2. **Notificación automática por WhatsApp**
   - Click **💬 Enviar por WhatsApp**
   - Mensaje automático al cliente:
     ```
     🔧 [Taller El Chero] Hola Juan, tu Hilux ABC-1234 fue ingresado.
     OT #2024-001 — Motivo: Ruido al frenar.
     Te mantenemos al tanto del avance.
     ```

3. **Check-in desde agendamiento** (si el cliente tenía turno)
   - Si el cliente tenía un turno agendado, hacer click en **Check-in** en el calendario
   - El sistema convierte automáticamente el turno en OT, heredando el diagnóstico inicial

4. **Seguimiento**
   - El asesor puede ver el estado de la OT en tiempo real: `RECIBIDO → EN_DIAGNÓSTICO → PRESUPUESTADO → EN_CURSO → LISTO → ENTREGADO`
   - Enviar actualizaciones al cliente por WhatsApp en cada cambio de estado

---

### 3.2 Caso de Uso: Mecánico (Diagnóstico y Reparación)

**Rol:** Mecánico  
**Escenario:** Diagnosticar la Hilux con Thinkcar y generar presupuesto.

#### Flujo paso a paso:

1. **Conectar Thinkcar**
   - Encender el Thinkcar vía Bluetooth
   - Ir a **Diagnóstico → Conectar Thinkcar**
   - Seleccionar canal: Bluetooth RFCOMM (o USB MTP si Bluetooth falla)
   - Esperar confirmación de conexión: `✅ Thinkcar conectado`

2. **Leer códigos DTC**
   - Click **Leer DTCs**
   - Sistema lee automáticamente:
     - `C1234` — Sensor de velocidad de rueda delantera derecha (circuito abierto)
     - `C0567` — Control de estabilidad del vehículo (mal funcionamiento)
   - El sistema mapea automáticamente los DTCs al catálogo de servicios

3. **Diagnosticar con Copiloto IA**
   - Click **🤖 Copiloto IA**
   - El sistema analiza los DTCs + historial del vehículo + km actuales
   - Sugerencia: "Basado en C1234 y los 85,000 km, reemplazar sensor ABS delantero derecho + revisar cableado del arnés"

4. **Generar presupuesto**
   - Click **Ir a Presupuesto**
   - Agregar servicios del catálogo (seleccionados por el Copiloto):
     - Cambio de pastillas delanteras: Gs. 350.000
     - Reemplazo sensor ABS: Gs. 180.000
     - Revisión de frenos traseros: Gs. 100.000
   - Agregar repuestos del inventario:
     - Pastillas delanteras Toyota: Gs. 250.000 (stock: 12)
     - Sensor ABS Denso: Gs. 320.000 (stock: 3)
   - Total estimado: Gs. 1.200.000
   - Click **Guardar Presupuesto** → OT cambia a `PRESUPUESTADO`

5. **Envío de PDF por WhatsApp**
   - Click **💬 Enviar Presupuesto por WhatsApp**
   - Sistema genera PDF con:
     - Encabezado del taller (logo, RUC, datos)
     - Datos del cliente y vehículo
     - Detalle de servicios y repuestos con precios
     - Total en Guaraníes
     - Válido por 7 días
   - PDF se envía automáticamente por WhatsApp al cliente

---

### 3.3 Caso de Uso: Cajero (Facturación y Cobro)

**Rol:** Cajero  
**Escenario:** Facturar la reparación de la Hilux con factura electrónica SIFEN.

#### Flujo paso a paso:

1. **Verificar OT lista para facturar**
   - Ir a **Taller → OTs Listas**
   - Seleccionar OT #2024-001 (estado: `LISTO`)
   - Verificar que el presupuesto fue aprobado por el cliente

2. **Generar factura electrónica**
   - Click **📄 Generar Factura**
   - Seleccionar tipo: **Factura Electrónica** (SIFEN)
   - Verificar datos:
     - Cliente: Juan Pérez, CI: 4.567.890
     - RUC (si aplica): 80012345-6
     - Condición de venta: Contado
   - Click **Emitir Factura**
   - Sistema envía automáticamente a SIFEN (DNIT)
   - Respuesta: `✅ Factura electrónica #001-001-0000123 emitida exitosamente`
   - Se genera PDF con código QR de verificación SIFEN

3. **Registrar cobro**
   - Click **💰 Registrar Pago**
   - Seleccionar método: Efectivo / Transferencia / Tarjeta
   - Monto: Gs. 1.200.000
   - Click **Confirmar Pago** → OT cambia a `PAGADO`

4. **Nota de crédito** (si aplica)
   - Si el cliente devuelve un repuesto, ir a **Facturación → Notas de Crédito**
   - Seleccionar factura original
   - Agregar motivo: "Devolución de repuesto no utilizado"
   - Click **Emitir Nota de Crédito** → Se envía a SIFEN automáticamente
   - El asiento contable se genera automáticamente (DEBE: Ingresos, HABER: IVA Débito Fiscal)

5. **Cierre de caja diario**
   - Ir a **Contabilidad → Cierre Diario**
   - Sistema consolida todas las facturas del día
   - Genera asiento contable automático:
     ```
     DEBE:  Caja          Gs. 1.200.000
     HABER: Ingresos      Gs. 1.034.483
     HABER: IVA (10%)     Gs.   165.517
     ```

---

### 3.4 Caso de Uso: Administrador (Reportes y Gestión)

**Rol:** Administrador  
**Escenario:** Revisar métricas del taller y gestionar inventario.

#### Flujo paso a paso:

1. **Dashboard principal**
   - Ir a **Dashboard**
   - Ver métricas en tiempo real:
     - OTs abiertas hoy: 8
     - Facturación del mes: Gs. 45.000.000
     - Clientes atendidos: 23
     - Inventario bajo (stock < 5): 3 repuestos

2. **Reporte de rentabilidad**
   - Ir a **Reportes → Rentabilidad por Servicio**
   - Seleccionar rango: Últimos 30 días
   - Ver ranking:
     1. Service completo: Gs. 12.000.000 (margen 45%)
     2. Cambio de aceite: Gs. 8.500.000 (margen 60%)
     3. Reparación de frenos: Gs. 6.200.000 (margen 38%)

3. **Gestión de inventario**
   - Ir a **Inventario**
   - Filtro: Stock bajo
   - Ver repuestos con stock crítico:
     - Aceite 5W30 5L: 2 unidades (mínimo: 5)
     - Filtro de aire Hilux: 1 unidad (mínimo: 3)
   - Click **📦 Generar Orden de Compra** → Se crea orden de compra automática

4. **Cierre contable mensual**
   - Ir a **Contabilidad → Cierre Mensual**
   - Seleccionar mes: Junio 2026
   - Click **Ejecutar Cierre**
   - Sistema consolida automáticamente:
     - Ingresos por facturación
     - Gastos por inventario
     - Depreciación de activos
     - Nómina (Ley 1034/83 escalafón MTESS)
   - Genera asientos contables automáticos para cada categoría

5. **Gestión de usuarios**
   - Ir a **Config → Usuarios**
   - Crear nuevo mecánico:
     - Nombre: Carlos González
     - Email: carlos@taller.com
     - Rol: Mecánico (nivel 1)
     - Permisos: Ver OTs asignadas, actualizar estado, leer DTCs
   - Click **Guardar** → Se envía email de invitación

6. **Backup y seguridad**
   - Ir a **Seguridad → Backup**
   - Click **💾 Crear Backup Ahora**
   - Sistema genera backup cifrado (AES-256-GCM) con checksum SHA-256
   - Descargar archivo: `backup_2026-06-19_automotiveos.enc`
   - Verificar estado del USB Kill Switch: `✅ Token USB conectado`

---

## 4. Flujo de Órdenes de Trabajo

### 3.1 Recepción del Vehículo

**Responsable:** Operador del Taller

1. Ir al menú lateral y seleccionar **"🔧 Taller"**.
2. Hacer clic en **"+ Nuevo Ingreso"**.
3. Completar los datos del formulario:
   - **Cliente:** Seleccionar existente o crear nuevo (nombre, teléfono, documento).
   - **Vehículo:** Seleccionar existente o registrar nuevo (placa, marca, modelo, VIN).
   - **Motivo de ingreso:** Descripción del problema reportado por el cliente.
4. Hacer clic en **"Registrar Ingreso"**.
5. Se creará automáticamente una Orden de Trabajo (OT) con estado `RECIBIDO`.

**Envío por WhatsApp:**
- Hacer clic en el botón **"💬 Enviar por WhatsApp"** en la parte superior de la OT.
- El sistema enviará automáticamente al cliente un mensaje confirmando la recepción del vehículo.

```
┌─────────────────────────────────────────────────────┐
│              ORDEN DE TRABAJO #001                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Cliente: Juan Pérez          Tel: +595981234567    │
│  Vehículo: Toyota Hilux 2020  Placa: ABC-1234       │
│  Estado: 🟡 RECIBIDO                                │
│                                                     │
│  ┌────────────────────────────────────────────┐    │
│  │  💬 Enviar por WhatsApp    │  📄 Ver PDF   │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3.2 Presupuestación

**Responsable:** Operador / Mecánico

1. Desde la OT, hacer clic en **"Ir a Presupuesto"**.
2. El sistema mostrará la pantalla de diagnóstico y presupuesto.
3. **Diagnosticar:** Si el vehículo tiene dispositivo Launch/Thinkcar conectado, hacer clic en **"Leer DTCs"** para obtener los códigos de falla.
4. **Agregar servicios:** Seleccionar del catálogo los servicios a realizar (Cambio de aceite, Frenos, etc.).
5. **Agregar repuestos:** Seleccionar del inventario los repuestos necesarios.
6. El sistema calculará automáticamente el total estimado.

**Envío de PDF por WhatsApp:**
- Hacer clic en **"💬 Enviar Presupuesto por WhatsApp"**.
- El sistema generará un PDF con el detalle del presupuesto y lo enviará al cliente por WhatsApp.

```
┌─────────────────────────────────────────────────────┐
│           PRESUPUESTO — OT #001                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Servicios:                                         │
│  ├── Cambio de aceite 5W30 .............. Gs 350.000│
│  ├── Filtro de aceite ................... Gs  80.000│
│  └── Inspección 25 puntos ............... Gs 100.000│
│                                                     │
│  Repuestos:                                         │
│  ├── Aceite sintético 5L ............... Gs 250.000│
│  └── Filtro de aceite universal ......... Gs  65.000│
│                                                     │
│  TOTAL ESTIMADO: ........................ Gs 845.000│
│                                                     │
│  ┌────────────────────────────────────────────┐    │
│  │  💬 Enviar Presupuesto por WhatsApp        │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3.3 Reparación

**Responsable:** Mecánico / Operador

1. Una vez aprobado el presupuesto por el cliente, cambiar el estado de la OT a `EN_REPARACION`.
2. El sistema enviará automáticamente un mensaje al cliente informando que la reparación ha iniciado.
3. El mecánico puede registrar el avance del trabajo en la OT.
4. Al finalizar, cambiar el estado a `REPARADO`.

**Envío por WhatsApp:**
- El botón **"💬 Enviar por WhatsApp"** está disponible para enviar actualizaciones manuales del estado.

### 3.4 Salida y Facturación

**Responsable:** Operador / Caja

1. Al confirmar la reparación, cambiar el estado a `FINALIZADO_RETIRADO`.
2. **Sincronización automática:** El sistema sincronizará automáticamente los datos del cliente hacia Twenty CRM (si está configurado).
3. **Facturación:** Ir a **"💰 Caja"** y generar la factura electrónica (SIFEN).
4. El sistema generará el asiento contable automáticamente.
5. El cliente retira el vehículo.

**Envío de factura por WhatsApp:**
- En la pantalla de Caja, hacer clic en **"💬 Enviar Factura por WhatsApp"**.
- El sistema enviará la factura en formato PDF al cliente.

---

## 5. Módulo de Agendamiento

### 4.1 Reserva de Turno (Flujo Comercial)

**Responsable:** Operador del Taller

1. Ir al menú lateral y seleccionar **"📅 Agendamiento"**.
2. Hacer clic en **"+ Nuevo Turno"**.
3. Completar el formulario:
   - **Fecha del turno:** Seleccionar del calendario.
   - **Hora:** Seleccionar horario disponible (el sistema validará la capacidad).
   - **Tipo de servicio:** RÁPIDO (1h) o PESADO (4h).
   - **Cliente:** Nombre, teléfono, email (para enviar recordatorio).
   - **Vehículo:** Placa y descripción del problema.
4. Hacer clic en **"Confirmar Turno"**.
5. El sistema:
   - Validará que haya capacidad disponible (máximo 5 vehículos simultáneos).
   - Creará el agendamiento con estado `RESERVADO`.
   - Enviará automáticamente un mensaje de confirmación por WhatsApp al cliente.

### 4.2 Recordatorio 24 Horas

**Automático (Cron Job):**

- Todos los días a las **08:00 AM**, el sistema envía recordatorios por WhatsApp a los clientes con turnos programados para el día siguiente.
- El mensaje incluye: fecha, hora, tipo de servicio y un recordatorio de confirmación.
- El cliente debe responder:
  - **"1"** → Confirmar turno (estado cambia a `CONFIRMADO`)
  - **"2"** → Cancelar turno (estado cambia a `CANCELADO`)

```
┌─────────────────────────────────────────────────────┐
│            MENSAJE DE RECORDATORIO                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📅 Estimado/a Juan Pérez,                          │
│                                                     │
│  Le recordamos que tiene un turno agendado:          │
│                                                     │
│  📆 Fecha: 19 de junio de 2026                      │
│  🕐 Hora: 09:00                                     │
│  🔧 Servicio: Afinación y Frenos 20.000 km          │
│  🚗 Vehículo: Toyota Hilux — Placa ABC-1234         │
│                                                     │
│  Por favor responda:                                │
│  ✅ Responda "1" para CONFIRMAR                      │
│  ❌ Responda "2" para CANCELAR                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.3 Respuesta del Cliente

**Flujo de respuesta por WhatsApp:**

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Cliente │    │ Webhook  │    │  Parsear │    │  Actualizar│
│  envía   │───►│ recibe   │───►│  "1" o   │───►│  estado   │
│  "1"     │    │ mensaje  │    │  "2"     │    │  del turno │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

- Si responde **"1"**: El agendamiento cambia a `CONFIRMADO`. El sistema envía una confirmación.
- Si responde **"2"**: El agendamiento cambia a `CANCELADO`. El turno se libera.
- Si **no responde** en 30 minutos: El agendamiento cambia a `AUSENTE`.

### 4.4 Check-in (Turno → Orden de Trabajo)

**Responsable:** Operador del Taller

1. Cuando el cliente se presenta en el taller con turno confirmado:
2. Ir a **"📅 Agendamiento"** → buscar el turno.
3. Hacer clic en **"✅ Check-in"**.
4. El sistema creará automáticamente:
   - Un registro de cliente en el ERP (si no existe).
   - Un registro de vehículo en el ERP (si no existe).
   - Una **Orden de Trabajo** heredando el diagnóstico del turno.
5. El agendamiento cambiará a estado `PROCESADO_EN_ERP`.

---

## 6. Resolución de Problemas Frecuentes

### 5.1 El botón de WhatsApp cambia a color rojo

**Causa:** La instancia de WhatsApp se ha desconectado del gateway.

**Solución:**

1. Ir a **Configuración → WhatsApp**.
2. Hacer clic en **"🔄 Reconectar"**.
3. Escanear el nuevo código QR desde el teléfono.
4. Verificar que el indicador en la barra superior cambie a verde.

### 5.2 Los mensajes no se envían

**Causas posibles:**

| Causa | Verificación | Solución |
|---|---|---|
| WhatsApp desconectado | Indicador rojo en barra superior | Reconectar (ver 5.1) |
| Número inválido | Revisar formato del teléfono | Asegurar formato +5959XXXXXXXX |
| Evolution API caída | `docker compose ps` muestra Evolution detenido | `docker compose up -d erp-evolution` |
| Límite de mensajes | Error 429 en logs | Esperar 1 minuto y reintentar |

### 5.3 Twenty CRM no sincroniza

**Causas posibles:**

1. **Token expirado:** Verificar `TWENTY_API_KEY` en `.env`.
2. **Twenty CRM caído:** Verificar con `docker compose ps`.
3. **Error de GraphQL:** Revisar logs del ERP: `docker compose logs erp-backend | grep crm`.

### 5.4 El agendamiento no muestra disponibilidad

**Causa:** La capacidad máxima (5 bahías) está completa para el horario seleccionado.

**Solución:**
1. Seleccionar un horario diferente.
2. O verificar si hay agendamientos pendientes que puedan reprogramarse.

### 5.5 Error al generar factura SIFEN

**Causas posibles:**

1. **Certificado digital vencido:** Renovar el certificado X.509.
2. **SIFEN fuera de servicio:** Verificar estado en el portal de DNIT.
3. **Datos del cliente incompletos:** Asegurar RUC o CI válido.

---

## 7. Glosario de Estados

### 6.1 Estados de Orden de Trabajo

| Estado | Color | Descripción |
|---|---|---|
| `RECIBIDO` | 🟡 Amarillo | Vehículo recibido en el taller |
| `EN_PRESUPUESTO` | 🟠 Naranja | En diagnóstico y cálculo de costos |
| `APROBADO` | 🔵 Azul | Presupuesto aprobado por el cliente |
| `EN_REPARACION` | 🔵 Azul | Reparación en curso |
| `REPARADO` | 🟢 Verde | Reparación completada, esperando retiro |
| `FINALIZADO_RETIRADO` | ⚫ Gris | Cliente retiró el vehículo |
| `CANCELADO` | 🔴 Rojo | OT cancelada |

### 6.2 Estados de Agendamiento

| Estado | Color | Descripción |
|---|---|---|
| `RESERVADO` | 🟡 Amarillo | Turno creado, pendiente de confirmación |
| `CONFIRMADO` | 🟢 Verde | Turno confirmado por el cliente |
| `PROCESADO_EN_ERP` | ⚫ Gris | Check-in realizado, convertido en OT |
| `AUSENTE` | 🔴 Rojo | Cliente no se presentó |
| `CANCELADO` | 🔴 Rojo | Turno cancelado por el cliente |

### 6.3 Estados de Mensajes WhatsApp

| Estado | Descripción |
|---|---|
| `PENDING` | Mensaje en cola de envío |
| `SENT` | Mensaje enviado exitosamente |
| `FAILED` | Error en el envío (revisar logs) |

---

## 8. Atajos de Teclado

| Atajo | Acción |
|---|---|
| `Ctrl + N` | Nuevo ingreso / nueva OT |
| `Ctrl + S` | Guardar cambios |
| `Ctrl + F` | Buscar en la vista actual |
| `Esc` | Cerrar modal / cancelar |

---

## 9. Información de Soporte

| Canal | Contacto |
|---|---|
| **Email técnico** | jaraju01@gmail.com |
| **WhatsApp soporte** | +5959XXXXXXXX |
| **Documentación** | http://localhost:3000/docs (Swagger UI) |

---

## 10. Módulo de Tesorería

### 10.1 Cuentas Bancarias

1. Ir a **Tesorería → Cuentas Bancarias**
2. Ver lista de cuentas: código, nombre, tipo, banco, saldo actual
3. Para crear nueva cuenta: clic en **"+ Nueva Cuenta"**
4. Completar: código, nombre, tipo (Caja Física, Cta. Cte., Caja Ahorro, Billetera Digital), banco, número de cuenta, moneda, saldo inicial
5. Click **"Crear Cuenta"**

### 10.2 Movimientos

1. Ir a **Tesorería → Movimientos**
2. Filtros disponibles: cuenta, tipo (Ingreso/Egreso/Transferencia), rango de fechas
3. Para registrar movimiento: clic en **"+ Nuevo Movimiento"**
4. Seleccionar tipo, medio de pago, cuenta, monto, fecha, concepto
5. Click **"Registrar"**

### 10.3 Conciliación Bancaria

1. Ir a **Tesorería → Conciliación**
2. Seleccionar cuenta del desplegable
3. Ver conciliaciones existentes (Período, Saldo Libros, Saldo Banco, Diferencia)
4. Para nueva conciliación: clic en **"+ Iniciar Conciliación"**
5. Seleccionar cuenta, período (mes/año), saldo según banco
6. Click **"Iniciar"**

### 10.4 Cuentas por Cobrar (CxC)

1. Ir a **Tesorería → CxC**
2. Ver facturas pendientes de cobro con: factura, cliente, total, saldo pendiente, vencimiento, estado
3. Filas vencidas resaltadas en rojo
4. Para cobrar: clic en botón verde **"Cobrar"** de la factura
5. Seleccionar monto, medio de pago, cuenta destino, concepto
6. Click **"Registrar Cobro"**

### 10.5 Cuentas por Pagar (CxP)

1. Ir a **Tesorería → CxP**
2. Ver facturas de proveedor con: factura, concepto, total, saldo pendiente, vencimiento, estado
3. Filtro por estado: Todos, Pendientes, Parciales, Pagadas
4. Para pagar: clic en botón naranja **"Pagar"** de la factura
5. Seleccionar monto, medio de pago, cuenta origen, concepto
6. Click **"Registrar Pago"**

### 10.6 Flujo de Caja

1. Ir a **Tesorería → Flujo de Caja**
2. Ver proyección a 30 días: Saldo Actual, Ingresos Proyectados, Egresos Proyectados, Flujo Neto, Saldo Proyectado
3. Si el saldo proyectado es negativo, se muestra alerta de sobregiro en rojo
4. Ver desglose detallado: Saldo Actual + CxC próximos 30 días − CxP próximos 30 días = Saldo Proyectado

---

## 11. Módulo de Contabilidad

### 11.1 Plan de Cuentas

1. Ir a **Contabilidad → Cuentas**
2. Ver árbol jerárquico de cuentas: código, nombre, tipo, saldo inicial
3. Cuentas aceptan movimientos: indicador ✓ verde
4. Para nueva cuenta: clic en **"+ Nueva Cuenta"**
5. Completar: código, nombre, tipo (Activo/Pasivo/Patrimonio/Ingreso/Costo/Gasto/Orden), cuenta padre
6. Click **"Crear Cuenta"**

### 11.2 Asientos Contables

1. Ir a **Contabilidad → Asientos**
2. Ver lista de asientos: número, fecha, concepto, debe, haber, estado, módulo origen
3. Filtros: fecha desde/hasta, módulo origen
4. Para ver detalle: clic en **"Ver"** → modal con líneas del asiento
5. Para anular: clic en **"Anular"** (irreversible)
6. Para asiento manual: clic en **"+ Nuevo Asiento"**
   - Fecha, concepto, documento ref.
   - Agregar líneas: seleccionar cuenta, monto debe/haber
   - El sistema valida que Debe = Haber
   - Click **"Guardar Asiento"**

### 11.3 Balance General

1. Ir a **Contabilidad → Balance**
2. Seleccionar fecha
3. Click **"Cargar"**
4. Ver: Activo, Pasivo, Patrimonio con subcuentas y totales
5. Indicador: ✓ Balanceado (verde) o ✗ Desbalanceado (rojo)

### 11.4 Estado de Resultados

1. Ir a **Contabilidad → Resultados**
2. Seleccionar mes y año
3. Opcional: marcar "Acumulado anual"
4. Click **"Cargar"**
5. Ver: Ingresos, Costos, Utilidad Bruta, Gastos, Utilidad Neta

### 11.5 Libros Contables

1. Ir a **Contabilidad → Libros**
2. Seleccionar: Libro Diario / Libro Mayor / Libro Inventario
3. Seleccionar mes y año
4. Click **"Cargar"**
5. Ver tabla correspondiente con movimientos del período

### 11.6 Impuestos (DNIT)

1. Ir a **Contabilidad → Impuestos**
2. Seleccionar tipo: IVA (Form 120) / IRE / IDU / ISC / INR
3. Completar campos según tipo
4. Click **"Calcular"**
5. Ver resultado con desglose
6. Ver historial de liquidaciones previas

### 11.7 Auditoría

1. Ir a **Contabilidad → Auditoría**
2. Filtros: entidad, acción, fecha desde/hasta
3. Click **"Cargar"**
4. Ver registro de acciones: fecha, acción (Crear/Modificar/Anular/Pagar/Emitir), entidad, detalle, módulo
5. Paginación: 50 registros por página

---

## 12. Aprobación del Documento

| Rol | Nombre | Fecha | Firma |
|---|---|---|---|
| Product Owner | Jara Brothers Group | 18/06/2026 | _____________ |
| Usuario Clave | — | — | _____________ |
| Auditor MITIC | — | — | _____________ |

---

*Documento generado conforme a las directrices de manuales de usuario de la Dirección General de Gobierno Electrónico del MITIC — República del Paraguay.*
