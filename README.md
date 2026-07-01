# AutomotiveOS ERP

**Multi-tenant ERP** para talleres automotrices en Paraguay.
Stack: Fastify + TypeScript + PostgreSQL local.
RAM objetivo: < 50 MB en reposo.

## Stack técnico

| Capa | Tecnología | Justificación |
|------|------------|---------------|
| Runtime | Node.js 20+ + TypeScript (ESM) | Arranque rápido, < 20 MB base |
| Framework | Fastify 5 | ~3 MB en reposo, más rápido que Express |
| DB Client | postgres.js (3 KB) | Conexión lazy, pool pequeño |
| ORM | Drizzle ORM | Type-safe queries, < 1 MB adicional |
| Base de datos | PostgreSQL 16 local | On-premise, sin dependencia cloud |
| Storage | Filesystem local | Sin dependencia de S3/Supabase Storage |
| Auth | JWT custom | Sin dependencia de Supabase Auth |
| Cache | Redis 7 (opcional) | Query cache, sesiones |
| Dev runner | tsx | Sin compilación previa, hot reload |
| Test runner | Vitest 4 | ~5 MB en CI, tests paralelos |
| WebSocket | @fastify/websocket | Streaming JSON < 1 KB/event |

## Requisitos previos

- Node.js >= 20
- PostgreSQL 16 (local o Docker)
- npm

## Configuración inicial

### 1. Clonar e instalar

```bash
git clone <repo-url> automotiveos-erp
cd automotiveos-erp
npm install
```

### 2. Configurar base de datos

```bash
# Crear usuario y base de datos
sudo -u postgres psql -c "CREATE USER erp_user WITH PASSWORD 'tu_password';"
sudo -u postgres psql -c "CREATE DATABASE automotive_os OWNER erp_user;"

# Importar schema
psql -U erp_user -d automotive_os \
  -f supabase/migrations/20260619000000_init_schema.sql
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Variables esenciales:

```env
DATABASE_URL="postgresql://erp_user:tu_password@localhost:5432/automotive_os?sslmode=disable"
STORAGE_PATH="/data/erp-storage"
JWT_SECRET="tu-secreto-jwt"
PORT=3000
NODE_ENV=development
```

### 4. Crear directorio de storage

```bash
sudo mkdir -p /data/erp-storage/dvi-photos
sudo chown -R $(whoami) /data/erp-storage
```

### 5. Iniciar servidor de desarrollo

```bash
npm run dev
```

Servidor en `http://localhost:3000`.

### 6. Verificar health check

```bash
curl http://localhost:3000/health
```

### 7. Ejecutar tests

```bash
npm test
```

## Despliegue en Servidor On-Premise

Ver [DESPLIEGUE.md](./DESPLIEGUE.md) para guía completa.

### Docker (recomendado)

```bash
docker compose -f docker-compose.onpremise.yml up -d
```

### Manual

```bash
npm run build
npm run start:prod
```

## Estructura del proyecto

```
src/
├ app.ts                              # Entry point
├ config/
│ └── env.ts                          # Environment variables
├ modules/
│ ├── config/                         # Identidad corporativa
│ ├── workshop/                       # Órdenes de Trabajo + Ingresos
│ ├── inventory/                      # Repuestos + Herramientas
│ ├── intelligence/                   # Diagnóstico, OCR, RAG, Visual
│ ├── finance/                        # SIFEN V150 + Contabilidad
│ ├── dvi/                            # Digital Vehicle Inspection (fotos)
│ ├── scheduling/                     # Citas y agendamiento
│ ├── whatsapp/                       # Integración WhatsApp
│ ├── crm/                            # Twenty CRM sync
│ ├── tenants/                        # Multi-tenant management
│ ├── backup/                         # Backup y restore
│ ├── client-portal/                  # Portal de clientes
│ ├── analytics/                      # KPIs y reportes
│ ├── marketing/                      # Campañas y reseñas
│ ├── fleet/                          # Gestión de flotas
│ ├── label-printing/                 # Impresión de etiquetas
│ └── security-hw/                    # USB kill switch
├ plugins/
│ ├── health-check.ts                 # /health, /health/live
│ ├── storage.ts                      # Storage local HTTP server
│ └── sync.ts                         # Offline-first sync
└ shared/
    ├── database/
    │ ├── connection.ts               # PostgreSQL pool
    │ ├── drizzle.ts                  # Drizzle ORM wrapper
    │ └── schema/                     # Schema barrel
    ├── storage/
    │ └── local-storage.ts            # Filesystem storage ops
    ├── middleware/
    │ ├── rls.ts                      # Row Level Security
    │ ├── rbac.ts                     # Role-based access
    │ └── csrf.ts                     # CSRF protection
    └── offline/
        └── sync-service.ts           # Offline sync queue
```

## Módulos principales

### Órdenes de Trabajo + Lockout HV

```bash
# Firmar lockout de alta tensión
curl -X POST http://localhost:3000/workshop/ordenes/:id/sign-lockout \
  -H "Content-Type: application/json" \
  -d '{"mechanicId":"uuid-del-mecanico"}'

# Cambiar estado
curl -X PATCH http://localhost:3000/workshop/ordenes/:id/status \
  -H "Content-Type: application/json" \
  -d '{"status":"Listo"}'
```

### RAG de Manuales Técnicos

```bash
# Subir PDF
curl -X POST "http://localhost:3000/intelligence/manuals/ingest?vehicleId=..." \
  -F "file=@manual.pdf"

# Consulta semántica
curl -X POST http://localhost:3000/intelligence/manuals/query \
  -H "Content-Type: application/json" \
  -d '{"question":"torque de culata BYD Seal","topK":3}'
```

### SIFEN / Facturación Electrónica

```bash
# Emitir DTE
curl -X POST http://localhost:3000/finance/sifen/emitir \
  -H "Content-Type: application/json" \
  -d '{...}'

# Exportar RG 90
curl -X POST http://localhost:3000/finance/rg90/exportar \
  -H "Content-Type: application/json" \
  -d '{"formato":"TXT","periodo":{"anho":2025,"mes":1}}'
```

## Multi-Tenant

Aislamiento mediante schemas de PostgreSQL:

- `public` — tablas de plataforma (tenants, migraciones)
- `tenant_<slug>` — datos aislados por taller

Cada request debe incluir `X-Tenant-Slug`:

```bash
curl -H "X-Tenant-Slug: taller-el-chero" http://localhost:3000/sync/config
```

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor con hot-reload |
| `npm run build` | Compilar TypeScript |
| `npm start` | Iniciar desde `dist/` |
| `npm test` | Ejecutar tests |
| `npm run check` | TypeScript type-check |
| `npm run db:migrate` | Ejecutar migraciones |
| `npm run db:validate` | Validar conexión DB |
| `npm run db:generate` | Generar migraciones Drizzle |

## Licencia

UNLICENSED — Proyecto privado. Jara Brothers Group, Coronel Oviedo, Paraguay.
