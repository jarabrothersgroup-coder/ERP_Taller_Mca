# Manual de Usuario — ERP Taller MCA

**Versión:** 1.0  
**Fecha:** Julio 2026  
**Sistema:** AutomotiveOS Cloud ERP

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Módulo de Taller (Workshop)](#3-módulo-de-taller)
4. [Módulo de Inventario](#4-módulo-de-inventario)
5. [Módulo de Clientes (CRM)](#5-módulo-de-clientes)
6. [Módulo de Facturación (Finance)](#6-módulo-de-facturación)
7. [Módulo de Citas (Scheduling)](#7-módulo-de-citas)
8. [Módulo de Inspección Digital (DVI)](#8-módulo-de-inspección-digital)
9. [Módulo de WhatsApp](#9-módulo-de-whatsapp)
10. [Módulo de Marketing](#10-módulo-de-marketing)
11. [Módulo de Flota (Fleet)](#11-módulo-de-flota)
12. [Módulo de Analíticas](#12-módulo-de-analíticas)
13. [Portal de Clientes](#13-portal-de-clientes)
14. [Configuración del Sistema](#14-configuración-del-sistema)
15. [Administración del Servidor](#15-administración-del-servidor)
16. [Solución de Problemas](#16-solución-de-problemas)

---

## 1. Introducción

El **ERP Taller MCA** es un sistema de gestión integral diseñado específicamente para talleres mecánicos automotrices en Paraguay. Combina gestión de taller, facturación electrónica (SIFEN), inventario, CRM, y comunicación con clientes en una sola plataforma.

### Características Principales

- **Facturación Electrónica:** SIFEN V150 con firma digital X.509 (DNIT)
- **Offline-First:** Funciona sin internet, sincroniza cuando hay conexión
- **Multi-Tenant:** Aislamiento estricto de datos por taller
- **WhatsApp Integration:** Notificaciones automáticas a clientes
- **DVI:** Inspección digital de vehículos con fotos
- **Thinkcar Integration:** Importación automática de diagnósticos OBD

### Requisitos del Sistema

| Componente | Mínimo | Recomendado |
|---|---|---|
| Navegador | Chrome 90+, Firefox 88+ | Chrome最新 |
| Conexión | 1 Mbps | 5+ Mbps |
| Resolución | 1024x768 | 1920x1080 |

---

## 2. Acceso al Sistema

### 2.1 URL de Acceso

- **Producción:** `http://192.168.18.104` (WiFi local) o `http://100.104.144.92` (Tailscale)
- **Dashboard:** `http://192.168.18.104/dashboard`
- **API Docs:** `http://192.168.18.104/docs` (solo desarrollo)

### 2.2 Inicio de Sesión

1. Abrir el navegador y navegar a la URL del sistema
2. Ingresar credenciales:
   - **Email:** tu-email@taller.com
   - **Contraseña:** ********
3. Hacer clic en "Iniciar Sesión"

### 2.3 Portal de Clientes (Acceso Externo)

Los clientes pueden acceder a un portal dedicado para:

- Ver el estado de sus órdenes de trabajo
- Descargar facturas
- Programar citas
- Dejar feedback

**Acceso:** `http://192.168.18.104/portal`

---

## 3. Módulo de Taller

### 3.1 Ingreso de Vehículos (Check-In)

Cuando un vehículo llega al taller:

1. Ir a **Taller → Ingresos**
2. Hacer clic en **Nuevo Ingreso**
3. Completar información:
   - **Patente** del vehículo
   - **Cliente** (buscar o crear nuevo)
   - **Kilometraje actual**
   - **Motivo de ingreso** (descripción del problema)
   - **Mecánico asignado**
4. Guardar → Se genera una **Orden de Trabajo (OT)** automáticamente

### 3.2 Órdenes de Trabajo (OT)

Cada OT tiene las siguientes etapas:

```
INGRESADO → EN_DIAGNOSTICO → PRESUPUESTADO → APROBADO → EN_REPARACION → FINALIZADO → RETIRADO
```

**Acciones por etapa:**

| Etapa | Acciones Disponibles |
|---|---|
| INGRESADO | Asignar mecánico, iniciar diagnóstico |
| EN_DIAGNOSTICO | Registrar hallazgos, escanear DTCs |
| PRESUPUESTADO | Agregar repuestos y mano de obra |
| APROBADO | Iniciar reparación |
| EN_REPARACION | Actualizar progreso, registrar tiempo |
| FINALIZADO | Verificar calidad, generar DVI final |
| RETIRADO | Entregar vehículo, procesar pago |

### 3.3 Presupuestos

1. Dentro de una OT, ir a **Presupuesto**
2. Agregar ítems:
   - **Repuestos:** Seleccionar del inventario (con precio y stock)
   - **Mano de Obra:** Seleccionar servicio del catálogo
   - **Otros:** Gastos adicionales
3. El sistema calcula automáticamente:
   - Subtotal
   - IVA (10%)
   - Total
4. Enviar presupuesto al cliente (por WhatsApp o imprimir)

### 3.4 Registro de Trabajo del Mecánico

Los mecánicos pueden registrar:

- **Tiempo invertido** en cada tarea
- **Repuestos utilizados** (se descuenta del inventario)
- **Fotos** del trabajo realizado
- **Notas técnicas**

---

## 4. Módulo de Inventario

### 4.1 Catálogo de Repuestos

**Ruta:** Inventario → Repuestos

Cada repuesto tiene:
- **Código** (código interno o de proveedor)
- **Descripción**
- **Categoría** (filtros, frenos, motor, etc.)
- **Marca y Modelo**
- **Stock actual** y **stock mínimo**
- **Precio de compra** y **precio de venta**
- **Ubicación** en el almacén
- **Código de barras** (escaneable)

### 4.2 Control de Stock

- **Entradas:** Al recibir mercadería de proveedores
- **Salidas:** Al usar repuestos en órdenes de trabajo
- **Ajustes:** Correcciones manuales de inventario
- **Inventario Físico:** Conteo periódico y ajuste

### 4.3 Alertas de Stock Bajo

El sistema notifica automáticamente cuando:
- Un repuesto está por debajo del stock mínimo
- Un repuesto está agotado
- Es momento de reordenar (basado en rotación)

### 4.4 Importación Masiva

Para cargar inventario desde CSV:

1. Ir a **Inventario → Importar CSV**
2. Seleccionar archivo CSV con formato:
   ```
   codigo,descripcion,categoria,marca,stock,precio_compra,precio_venta
   FIL-001,Filtro de Aceite Motor,Filtros,Bosch,50,15000,25000
   ```
3. Mapear columnas
4. Previsualizar y confirmar importación

### 4.5 TecDoc Integration

El módulo incluye integración con TecDoc para:
- Búsqueda de repuestos por número de parte
- Compatibilidad con vehículos
- Imágenes de productos
- Precios de referencia

---

## 5. Módulo de Clientes (CRM)

### 5.1 Gestión de Clientes

**Ruta:** Clientes → Lista de Clientes

Cada cliente tiene:
- **Nombre / Razón Social**
- **RUC / Cédula** (formato paraguayo)
- **Teléfono** y **WhatsApp**
- **Email**
- **Dirección**
- **Vehículos** asociados
- **Historial** de órdenes de trabajo

### 5.2 Registro Rápido

Desde cualquier punto del sistema:
1. Hacer clic en **+ Nuevo Cliente**
2. Completar datos mínimos (nombre y teléfono)
3. Guardar → El cliente queda registrado para uso futuro

### 5.3 Historial del Cliente

Ver todas las interacciones:
- Órdenes de trabajo anteriores
- Facturas emitidas
- Comunicaciones por WhatsApp
- Feedback y calificaciones

---

## 6. Módulo de Facturación (Finance)

### 6.1 Facturación Electrónica (SIFEN)

El sistema genera facturas electrónicas conformes a la normativa de la DNIT:

**Tipos de Documento:**
- **Factura Electrónica** (con código de control)
- **Nota de Crédito** (para devoluciones)
- **Nota de Débito** (para ajustes)

**Proceso:**
1. Dentro de una OT finalizada, hacer clic en **Facturar**
2. Seleccionar tipo de documento
3. Verificar datos del cliente (RUC, nombre)
4. Confirmar → El sistema genera:
   - XML firmado digitalmente
   - PDF con código QR
   - Código de control (CDC)
5. Enviar por WhatsApp o imprimir

### 6.2 Plan de Cuentas

Contabilidad de doble entrada con:
- **Cuentas de Activo** (caja, bancos, inventario)
- **Cuentas de Pasivo** (proveedores, impuestos)
- **Cuentas de Ingresos** (servicios, repuestos)
- **Cuentas de Egresos** (sueldos, alquiler, utilities)

### 6.3 Tesorería

Gestión de:
- **Cuentas** (caja chica, cuentas bancarias)
- **Movimientos** (ingresos y egresos)
- **Transferencias** entre cuentas
- **Conciliación** bancaria
- **Flujo de Caja** proyectado

### 6.4 Presupuestos Operativos

Para planificación financiera:
- Crear presupuestos mensuales/anuales
- Comparar presupuesto vs real
- Alertas de excedentes
- Exportar a CSV

---

## 7. Módulo de Citas (Scheduling)

### 7.1 Programar una Cita

1. Ir a **Agenda → Nueva Cita**
2. Seleccionar:
   - **Cliente** y **Vehículo**
   - **Fecha y hora** disponible
   - **Tipo de servicio** (mantenimiento, reparación, diagnóstico)
   - **Mecánico** (opcional)
3. Confirmar → Se envía recordatorio por WhatsApp

### 7.2 Control de Capacidad

El sistema gestiona automáticamente:
- **Horarios disponibles** por mecánico
- **Conflictos** de programación
- **Sobrecarga** de taller
- **Tiempo estimado** por tipo de servicio

### 7.3 Recordatorios Automáticos

- **24 horas antes:** Recordatorio de cita
- **2 horas antes:** Confirmación de asistencia
- **Si no confirma:** Reagenda automática

---

## 8. Módulo de Inspección Digital (DVI)

### 8.1 Crear una Inspección

1. Dentro de una OT, ir a **DVI**
2. Seleccionar zonas del vehículo:
   - Motor y componentes
   - Frenos
   - Suspensión
   - Exterior
   - Interior
   - Eléctrico
3. Para cada zona:
   - Tomar **fotos**
   - Agregar **anotaciones**
   - Calificar estado (Bueno / Regular / Malo)

### 8.2 Health Score

El sistema calcula un puntaje de salud del vehículo:
- **90-100:** Excelente estado
- **70-89:** Buen estado, mantenimiento preventivo
- **50-69:** Requiere atención
- **<50:** Estado crítico, reparación urgente

### 8.3 Compartir con Cliente

El DVI se puede enviar por WhatsApp al cliente para:
- Transparencia en el diagnóstico
- Autorización de reparaciones
- Documentación del estado del vehículo

---

## 9. Módulo de WhatsApp

### 9.1 Configuración Inicial

El sistema utiliza **Evolution API** para mensajería:

1. Ir a **Configuración → WhatsApp**
2. Escanear código QR con el teléfono del taller
3. Verificar conexión

### 9.2 Templates de Mensajes

Templates predefinidos por estado de OT:

| Estado | Mensaje |
|---|---|
| INGRESADO | "Su vehículo [PATENTE] ha sido ingresado al taller..." |
| PRESUPUESTADO | "Presupuesto listo para revisión: [MONTO]..." |
| APROBADO | "Reparación iniciada. Tiempo estimado: [TIEMPO]..." |
| FINALIZADO | "Su vehículo está listo para retirar..." |
| RETIRADO | "Gracias por confiar en nosotros..." |

### 9.3 Envío Automático

Los mensajes se envían automáticamente al cambiar el estado de una OT. También se pueden enviar:
- **Facturas** (PDF adjunto)
- **Presupuestos** (PDF adjunto)
- **Fotos** del DVI
- **Recordatorios** de citas

---

## 10. Módulo de Marketing

### 10.1 Campañas

Crear campañas de marketing para:
- **Promociones** de temporada
- **Mantenimiento preventivo** programado
- **Cumpleaños** de clientes
- **Seguimiento** post-reparación

### 10.2 Google Reviews

Automatización de:
- Solicitud de reseñas post-servicio
- Monitoreo de calificaciones
- Respuesta a reseñas negativas

### 10.3 Programa de Lealtad

Puntos por:
- Cada compra acumula puntos
- Canje por descuentos
- Niveles de fidelidad (Bronce, Plata, Oro)

---

## 11. Módulo de Flota (Fleet)

### 11.1 Gestión de Flotas Empresariales

Para clientes B2B con múltiples vehículos:
- **Contratos** de servicio
- **Vehículos** asociados a la flota
- **Historial** consolidado
- **Reportes** de costos por flota

### 11.2 Contratos de Servicio

Definir:
- **Mantenimiento** programado
- **Cobertura** de servicios
- **Precios** preferenciales
- **Vigencia** del contrato

---

## 12. Módulo de Analíticas

### 12.1 KPIs Principales

Dashboard con métricas en tiempo real:
- **Ingresos** del día/semana/mes
- **Órdenes de trabajo** activas
- **Tiempo promedio** de reparación
- **Ticket promedio** por cliente
- **Tasa de satisfacción**

### 12.2 Tendencias

Gráficos de:
- **Ingresos** mensuales
- **OTs** por estado
- **Servicios** más solicitados
- **Mecánicos** con más trabajo

### 12.3 Reportes Personalizados

1. Ir a **Analíticas → Reportes**
2. Seleccionar filtros:
   - Período de tiempo
   - Tipo de servicio
   - Mecánico
   - Cliente
3. Generar reporte
4. Exportar a **CSV** o **PDF**

---

## 13. Portal de Clientes

### 13.1 Acceso para Clientes

Los clientes acceden con:
- **Magic Link** (enviado por email/WhatsApp)
- **PIN** de 4 dígitos

### 13.2 Funcionalidades del Portal

- **Resumen** de órdenes activas
- **Vehículos** registrados
- **Historial** de facturas
- **Programar** nuevas citas
- **Dejar feedback** sobre servicios

---

## 14. Configuración del Sistema

### 14.1 Datos del Taller

**Ruta:** Configuración → Empresa

- **Nombre** del taller
- **RUC** (Registro Único de Contribuyente)
- **Dirección** y teléfono
- **Logo** (para facturas y reportes)
- **Firma digital** (para SIFEN)

### 14.2 Usuarios y Permisos

**Ruta:** Configuración → Usuarios

Crear usuarios con roles:
- **Admin:** Acceso total al sistema
- **Mecánico:** Taller, DVI, inventario
- **Recepción:** Clientes, citas, facturación
- **Contador:** Solo módulo financiero

### 14.3 Catálogo de Servicios

Definir servicios ofrecidos:
- **Nombre** del servicio
- **Tiempo estimado**
- **Precio**
- **Categoría**

### 14.4 Impuestos

Configurar:
- **IVA** (10% en Paraguay)
- **Exenciones** (si aplica)
- **Retenciones**

---

## 15. Administración del Servidor

### 15.1 Servicios Activos

| Servicio | Puerto | Descripción |
|---|---|---|
| Fastify ERP | 3000 | Backend API |
| Nginx | 80 | Proxy reverso |
| PostgreSQL | 5432 | Base de datos |
| 389 DS | 389/636 | Directorio LDAP |
| Samba | 139/445 | Archivos compartidos |

### 15.2 Backups

**Política de backups:**
- **L/M/V 02:00:** Backup incremental (pg_dump + rsync)
- **Día 1 01:00:** Backup mensual completo

**Ubicación:** `/data/backups/`

**Restaurar:**
```bash
./scripts/backup/restore-erp.sh 2026-07-08
```

### 15.3 Monitoreo

- **Health Check:** `curl http://127.0.0.1:3000/health`
- **Logs:** `journalctl -u erp-taller -f`
- **Métricas:** `curl http://127.0.0.1:3000/metrics`

### 15.4 Actualizaciones

```bash
cd /data/ERP_Taller_Mca
git pull origin main
sudo systemctl restart erp-taller
```

---

## 16. Solución de Problemas

### 16.1 El sistema no responde

1. Verificar que el servicio esté activo:
   ```bash
   systemctl status erp-taller
   ```
2. Si no está activo, reiniciarlo:
   ```bash
   sudo systemctl restart erp-taller
   ```
3. Verificar logs:
   ```bash
   journalctl -u erp-taller -n 50
   ```

### 16.2 No se puede facturar

1. Verificar conexión a internet (SIFEN requiere conexión)
2. Verificar que el certificado digital esté vigente
3. Verificar que el RUC del cliente sea válido

### 16.3 WhatsApp no conecta

1. Verificar que Evolution API esté corriendo
2. Re-escanear código QR
3. Verificar número de teléfono del taller

### 16.4 Inventario incorrecto

1. Revisar movimientos recientes
2. Realizar inventario físico
3. Ajustar diferencias

### 16.5 Error de Base de Datos

1. Verificar que PostgreSQL esté activo:
   ```bash
   systemctl status postgresql
   ```
2. Verificar conexión:
   ```bash
   psql -h 127.0.0.1 -U erp_user -d automotive_os
   ```

---

## Soporte

- **Email:** soporte@taller-mca.py
- **WhatsApp:** +595 XXX XXX XXX
- **Horario:** Lunes a Viernes 8:00 - 17:00

---

*Manual generado automáticamente — ERP Taller MCA v1.0*
