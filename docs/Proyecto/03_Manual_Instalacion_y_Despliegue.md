# 03 — Manual de Instalación y Despliegue

**Proyecto:** Ecosistema de Gestión Automotriz — AutomotiveOS Cloud ERP  
**Organización:** Jara Brothers Group  
**Norma de referencia:** Guías de Despliegue del MITIC  
**Versión:** 1.0  
**Fecha:** 18 de junio de 2026  
**Clasificación:** Documento Oficial — Directoría General de Gobierno Electrónico (MITIC)

---

## 1. Prerrequisitos del Entorno

### 1.1 Software Requerido

| Componente | Versión Mínima | Versión Recomendada | Propósito |
|---|---|---|---|
| **Docker** | 24.0.0 | 27.x | Contenedorización de servicios |
| **Docker Compose** | 2.20.0 | 2.29.x | Orquestación de múltiples contenedores |
| **Node.js** | 20.0.0 | 22.x LTS | Ejecución del ERP backend (fuera de Docker) |
| **npm** | 10.0.0 | 10.x | Gestión de dependencias |
| **PostgreSQL** | 16 | 16.x | Base de datos relacional (se ejecuta vía Docker) |
| **Git** | 2.40+ | 2.45+ | Control de versiones |

### 1.2 Hardware Requerido

| Recurso | Mínimo | Recomendado |
|---|---|---|
| **RAM** | 4 GB | 8 GB |
| **Disco** | 10 GB libres | 20 GB libres |
| **CPU** | 2 cores | 4 cores |
| **Red** | Conectividad a internet para APIs externas | — |

### 1.3 APIs Externas Requeridas

| API | Propósito | Acceso |
|---|---|---|
| **Twenty CRM** | CRM para gestión de clientes | Self-hosted (Docker) o nube |
| **Evolution API** | Gateway de WhatsApp | Self-hosted (Docker) |
| **DNIT SIFEN** | Facturación electrónica | Acceso público (HTTPS) |
| **Redis** | Cache y colas de mensajes | Docker (local) |

---

## 2. Estructura del Proyecto

### 2.1 Mapa de Carpetas

```
ERP_Taller_Mca/
├── src/                          # Código fuente del ERP backend
│   ├── app.ts                    # Punto de entrada de la aplicación
│   ├── config/                   # Configuración de entorno
│   │   └── env.ts                # Variables de entorno tipadas
│   ├── modules/                  # Módulos del dominio
│   │   ├── workshop/             # Taller (vehículos, OTs, ingresos)
│   │   ├── inventory/            # Inventario (repuestos, herramientas)
│   │   ├── finance/              # Finanzas (SIFEN, contabilidad, tesorería)
│   │   ├── config/               # Configuración del taller
│   │   ├── whatsapp/             # Integración WhatsApp (Evolution API)
│   │   ├── crm/                  # Integración Twenty CRM
│   │   ├── scheduling/           # Agendamiento de turnos
│   │   ├── intelligence/         # IA (DTC, OCR, RAG)
│   │   ├── thinkcar/             # Importador Thinkcar
│   │   ├── tenants/              # Gestión multi-tenant
│   │   └── migration/            # Migración de datos entre tenants
│   ├── plugins/                  # Plugins Fastify (health, sync, monitoring)
│   ├── shared/                   # Código compartido
│   │   ├── database/             # Conexión, esquemas, migraciones
│   │   ├── middleware/           # Middlewares (RLS, CORS, seguridad)
│   │   ├── routes/               # Rutas compartidas (import, PDF, auditoría)
│   │   ├── errors/               # Clases de error
│   │   └── public/               # Frontend estático (SPA + Tailwind)
│   │       ├── index.html        # Punto de entrada HTML
│   │       ├── js/               # Módulos JavaScript del frontend
│   │       └── css/              # Estilos Tailwind
│   └── migrations/               # Migraciones de base de datos (Drizzle)
├── scripts/                      # Scripts utilitarios
│   ├── seed-vehicles.ts          # Datos maestros de vehículos
│   ├── seed-services.ts          # Catálogo de servicios por tenant
│   ├── seed-accounting.ts        # Plan de Cuentas paraguayo
│   └── seed-treasury.ts          # Datos de tesorería de prueba
├── tests/                        # Suite de pruebas (Vitest)
│   ├── sprint*.test.ts           # Tests por sprint
│   └── unit/                     # Tests unitarios
├── docs/                         # Documentación
│   └── Proyecto/                 # Documentos MITIC
├── docker-compose.yml            # Orquestación Docker (5 servicios)
├── Dockerfile                    # Build multi-stage del ERP
├── .env.example                  # Plantilla de variables de entorno
├── package.json                  # Dependencias npm
├── tsconfig.json                 # Configuración TypeScript
├── vitest.config.ts              # Configuración de tests
├── drizzle.config.ts             # Configuración de migraciones Drizzle
├── engram.json                   # Memoria persistente del proyecto
└── AGENTS.md                     # Guía para agentes de IA
```

### 2.2 Archivos Críticos

| Archivo | Descripción | ¿Se modifica en producción? |
|---|---|---|
| `.env` | Variables de entorno (credenciales, tokens) | ✅ Sí |
| `docker-compose.yml` | Definición de servicios Docker | ⚠️ Solo para configuración avanzada |
| `src/config/env.ts` | Tipado de variables de entorno | ❌ No (solo en desarrollo) |
| `engram.json` | Estado del proyecto y sprints | ❌ No (automático) |

---

## 3. Configuración de Variables de Entorno

### 3.1 Archivo `.env`

Copiar `.env.example` a `.env` y completar las siguientes variables:

```bash
cp .env.example .env
```

### 3.2 Variables de Base de Datos

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | URL de conexión a PostgreSQL (Neon/Supabase) | `postgresql://user:pass@host/db?sslmode=require` |
| `DATABASE_HOST` | Host de la base de datos | `db.xxx.supabase.co` |
| `DATABASE_PORT` | Puerto de la base de datos | `5432` |
| `DATABASE_NAME` | Nombre de la base de datos | `automotive_os` |
| `DATABASE_USER` | Usuario de la base de datos | `postgres` |
| `DATABASE_PASSWORD` | Contraseña de la base de datos | `****` |

### 3.3 Variables de Twenty CRM

| Variable | Descripción | Ejemplo |
|---|---|---|
| `TWENTY_API_URL` | URL base de la API de Twenty CRM | `http://localhost:2080` |
| `TWENTY_API_KEY` | Token de autenticación de Twenty | `eyJhbGciOiJIUzI1NiIs...` |
| `TWENTY_GRAPHQL_URL` | Endpoint GraphQL de Twenty | `http://localhost:2080/graphql` |

### 3.4 Variables de WhatsApp (Evolution API)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `WHATSAPP_API_URL` | URL base de Evolution API | `http://localhost:8080` |
| `WHATSAPP_API_KEY` | Token de autenticación de Evolution API | `your-api-key-here` |

### 3.5 Variables de la Aplicación

| Variable | Descripción | Valor por Defecto |
|---|---|---|
| `PORT` | Puerto del servidor ERP | `3000` |
| `HOST` | Host de escucha | `0.0.0.0` |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `LOG_LEVEL` | Nivel de logging (trace/debug/info/warn/error) | `info` |
| `CORS_ORIGIN` | Origen permitido para CORS | `http://localhost:3000` |
| `DEFAULT_TENANT` | Tenant por defecto | `taller-el-chero` |

### 3.6 Variables de Seguridad

| Variable | Descripción | Ejemplo |
|---|---|---|
| `JWT_SECRET` | Secreto para firma de tokens JWT | `super-secret-key-min-32-chars` |
| `SESSION_SECRET` | Secreto para sesiones | `session-secret-min-32-chars` |

---

## 4. Pasos de Despliegue

### 4.1 Despliegue con Docker Compose (Recomendado)

#### Paso 1: Clonar el repositorio

```bash
git clone https://github.com/jara-brothers/erp-taller-mca.git
cd erp-taller-mca
```

#### Paso 2: Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con las credenciales reales
nano .env
```

#### Paso 3: Levantar servicios Docker

```bash
# Levantar todos los servicios en segundo plano
docker compose up -d

# Verificar que los servicios estén corriendo
docker compose ps
```

**Salida esperada:**

```
NAME                STATUS          PORTS
erp-postgres        Up (healthy)    0.0.0.0:5432->5432/tcp
erp-twenty          Up (healthy)    0.0.0.0:2080->2080/tcp
erp-redis           Up              0.0.0.0:6379->6379/tcp
erp-evolution       Up              0.0.0.0:8080->8080/tcp
erp-backend         Up              0.0.0.0:3000->3000/tcp
```

#### Paso 4: Ejecutar migraciones de base de datos

```bash
# Dentro del contenedor del backend
docker compose exec erp-backend npx drizzle-kit push

# O localmente (si Node.js está instalado)
npx drizzle-kit push
```

#### Paso 5: Sembrar datos iniciales

```bash
# Datos maestros de vehículos (global, sin tenant)
npx tsx scripts/seed-vehicles.ts

# Catálogo de servicios para el tenant por defecto
npx tsx scripts/seed-services.ts taller-el-chero

# Plan de Cuentas paraguayo para el tenant
npx tsx scripts/seed-accounting.ts taller-el-chero
```

#### Paso 6: Verificar el despliegue

```bash
# Health check del ERP
curl http://localhost:3000/health

# Swagger UI
open http://localhost:3000/docs

# Twenty CRM
open http://localhost:2080

# Evolution API
curl http://localhost:8080/instance/fetchInstances
```

### 4.2 Despliegue sin Docker (Desarrollo Local)

#### Paso 1: Instalar dependencias

```bash
npm install
```

#### Paso 2: Configurar PostgreSQL local

```bash
# Crear la base de datos
createdb automotive_os

# Ejecutar migraciones
npx drizzle-kit push
```

#### Paso 3: Configurar variables de entorno

```bash
cp .env.example .env
# Editar DATABASE_URL para apuntar a PostgreSQL local
```

#### Paso 4: Iniciar el servidor

```bash
# Modo desarrollo (con hot-reload)
npm run dev

# Modo producción
npm run build
npm run start:prod
```

---

## 5. Inicialización de Cron Jobs

Los cron jobs de agendamiento se inicializan automáticamente al iniciar el servidor. No requieren configuración adicional.

### 5.1 Cron Job de Recordatorios

- **Frecuencia:** Diario a las 08:00 AM (hora de Paraguay)
- **Función:** Envía recordatorios por WhatsApp 24 horas antes del turno
- **Ubicación:** `src/modules/scheduling/jobs/reminder.cron.ts`

### 5.2 Verificación de Cron Jobs

```bash
# Ver logs del servidor para confirmar que los cron jobs están activos
docker compose logs -f erp-backend | grep -i "cron\|reminder"
```

**Salida esperada:**

```
[INFO] Cron job initialized: reminder.cron.ts
[INFO] Next execution: 2026-06-19T08:00:00.000Z
```

---

## 6. Pruebas de Conectividad (Smoke Tests)

### 6.1 Verificar que el ERP responde

```bash
# Health check básico
curl -s http://localhost:3000/health | jq .

# Salida esperada:
# {
#   "status": "ok",
#   "database": "connected",
#   "uptime": 123.456
# }
```

### 6.2 Verificar que Twenty CRM está accesible

```bash
# GraphQL introspection
curl -s -X POST http://localhost:2080/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TWENTY_API_KEY" \
  -d '{"query": "{ __typename }"}' | jq .

# Salida esperada:
# {
#   "data": {
#     "__typename": "Query"
#   }
# }
```

### 6.3 Verificar que Evolution API solicita el QR

```bash
# Listar instancias existentes
curl -s http://localhost:8080/instance/fetchInstances \
  -H "apikey: YOUR_EVOLUTION_API_KEY" | jq .

# Crear una instancia para el tenant
curl -s -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_EVOLUTION_API_KEY" \
  -d '{
    "instanceName": "erp-taller-el-chero",
    "number": "5959XXXXXXXX",
    "qrcode": true,
    "reject_call": true,
    "groups_ignore": true,
    "always_online": true,
    "webhooks": {
      "url": "http://erp-backend:3000/api/v1/whatsapp/webhook",
      "events": ["messages.upsert", "connection.update"]
    }
  }' | jq .

# Obtener el QR code
curl -s http://localhost:8080/instance/connect/erp-taller-el-chero \
  -H "apikey: YOUR_EVOLUTION_API_KEY" | jq .
```

### 6.4 Verificar Redis

```bash
# Ping a Redis
docker compose exec erp-redis redis-cli ping

# Salida esperada:
# PONG
```

### 6.5 Verificar conexión a PostgreSQL

```bash
# Conectar al contenedor de PostgreSQL
docker compose exec erp-postgres psql -U postgres -d automotive_os -c "SELECT 1;"

# Salida esperada:
#  ?column?
# ----------
#         1
```

### 6.6 Script de Smoke Tests Automatizados

```bash
#!/bin/bash
# smoke-test.sh — Verificación completa del despliegue

echo "=== AutomotiveOS Smoke Tests ==="
echo ""

# 1. ERP Backend
echo -n "[1/5] ERP Backend... "
if curl -sf http://localhost:3000/health > /dev/null; then
  echo "✅ OK"
else
  echo "❌ FAIL"
  exit 1
fi

# 2. PostgreSQL
echo -n "[2/5] PostgreSQL... "
if docker compose exec -T erp-postgres pg_isready -U postgres > /dev/null 2>&1; then
  echo "✅ OK"
else
  echo "❌ FAIL"
  exit 1
fi

# 3. Redis
echo -n "[3/5] Redis... "
if docker compose exec -T erp-redis redis-cli ping 2>/dev/null | grep -q PONG; then
  echo "✅ OK"
else
  echo "❌ FAIL"
  exit 1
fi

# 4. Twenty CRM
echo -n "[4/5] Twenty CRM... "
if curl -sf http://localhost:2080 > /dev/null; then
  echo "✅ OK"
else
  echo "⚠️  WARN (Twenty no disponible)"
fi

# 5. Evolution API
echo -n "[5/5] Evolution API... "
if curl -sf http://localhost:8080/instance/fetchInstances > /dev/null; then
  echo "✅ OK"
else
  echo "⚠️  WARN (Evolution API no disponible)"
fi

echo ""
echo "=== Smoke Tests Completados ==="
```

---

## 7. Comandos Útiles de Mantenimiento

| Comando | Descripción |
|---|---|
| `docker compose logs -f erp-backend` | Ver logs en tiempo real del backend |
| `docker compose restart erp-backend` | Reiniciar solo el backend |
| `docker compose down && docker compose up -d` | Reiniciar todos los servicios |
| `npx drizzle-kit push` | Aplicar migraciones pendientes |
| `npm test` | Ejecutar suite de pruebas |
| `npx tsc --noEmit` | Verificar tipos TypeScript |
| `docker compose exec erp-postgres pg_dump -U postgres automotive_os > backup.sql` | Backup de la base de datos |

---

## 8. Resolución de Problemas Comunes

| Problema | Causa | Solución |
|---|---|---|
| `ECONNREFUSED` al conectar a PostgreSQL | PostgreSQL no está corriendo | `docker compose up -d erp-postgres` |
| `JWT verification failed` | Secreto JWT no configurado | Verificar `JWT_SECRET` en `.env` |
| WhatsApp no envía mensajes | Instancia no vinculada (QR no escaneado) | Re-escanear QR desde Configuración |
| Twenty CRM no responde | Token expirado o servicio caído | Verificar `TWENTY_API_KEY` y `docker compose ps` |
| Errores de memoria | Sobrecarga de RAM > 50MB | Verificar `--max-old-space-size=48` en start:prod |

---

## 9. Aprobación del Documento

| Rol | Nombre | Fecha | Firma |
|---|---|---|---|
| DevOps Engineer | Jara Brothers Group | 18/06/2026 | _____________ |
| Auditor MITIC | — | — | _____________ |

---

*Documento generado conforme a las directrices de despliegue de software de la Dirección General de Gobierno Electrónico del MITIC — República del Paraguay.*
