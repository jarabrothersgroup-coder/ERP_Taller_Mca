# AutomotiveOS Cloud ERP

**Multi-tenant B2B SaaS** para talleres automotrices en Paraguay.
Stack: Fastify + TypeScript + Neon/Supabase (PostgreSQL remoto).
RAM objetivo: < 50 MB en reposo.

## Stack técnico

| Capa          | Tecnología                           | Justificación RAM                          |
|---------------|--------------------------------------|--------------------------------------------|
| Runtime       | Node.js 26 + TypeScript (ESM)        | Arranque rápido, < 20 MB base              |
| Framework     | Fastify 5                            | ~3 MB en reposo, más rápido que Express    |
| DB Client     | postgres.js (3 KB)                   | Sin overhead de ORM, lazy connection       |
| ORM           | Drizzle ORM (0.45)                   | Type-safe queries, < 1 MB adicional        |
| Base de datos | Neon/Supabase PostgreSQL (remoto)    | 0 MB local, serverless, SSL forzado        |
| Dev runner    | tsx                                  | Sin compilación previa, hot reload         |
| Test runner   | Vitest 4                             | ~5 MB en CI, árbol de tests paralelos      |
| WebSocket     | @fastify/websocket                   | Streaming JSON < 1 KB/event, sin GPU       |

## Estructura del proyecto

```
src/
├── app.ts                              # Entry point
├── config/
│   └── env.ts                          # Environment variables loader
├── modules/
│   ├── config/                         # Identidad corporativa (logo, RUC, firma)
│   │   ├── plugin.ts                   #   GET/PUT /api/config/settings, upload-logo
│   │   └── services/TenantConfigService.ts
│   ├── workshop/                       # Órdenes de Trabajo + Ingresos
│   │   ├── schema/                     #   vehiculos, ordenes_trabajo, ingresos
│   │   ├── routes/                     #   POST/GET /workshop/ingresos, sign-lockout, status
│   │   └── services/                   #   HV Lockout + cambio estado con validación
│   ├── inventory/                      # Repuestos + Herramientas
│   │   ├── schema/                     #   repuestos (barcode-indexed), herramientas
│   │   └── routes/                     #   CRUD repuestos, prestar/devolver herramientas
│   ├── intelligence/                   # Diagnóstico, OCR, RAG, Visual
│   │   ├── routes/                     #   DTC parse, safety, decode-safety, parse-dtc
│   │   ├── services/                   #   dtc-parser, hv-safety, ocr, vehicle-intelligence
│   │   ├── rag/                        #   Manual RAG (chunking + pgvector + OpenAI)
│   │   └── visual/                     #   WebSocket gateway + TV template Tailwind
│   └── finance/                        # SIFEN V150 + Contabilidad
│       ├── schema/                     #   fiscal_documentos, plan_cuentas, asientos
│       ├── routes/                     #   SIFEN emitir/firmar/enviar/anular, contabilidad
│       └── services/                   #   XML builder, X.509 crypto, SOAP client, ledger
├── plugins/
│   ├── health-check.ts                 # /health, /health/live
│   ├── supabase.ts                     # Supabase admin/anon clients
│   └── sync.ts                         # Offline-first sync endpoints
└── shared/
    ├── database/
    │   ├── connection.ts               # PostgreSQL pool (lazy singleton)
    │   ├── drizzle.ts                  # Drizzle ORM client wrapper
    │   ├── schema/                     # Schema barrel (all modules)
    │   ├── migrate.ts                  # Schema migrator
    │   └── validate.ts                 # Connection validator script
    ├── errors/
    │   └── app-error.ts                # Error classes (400-429-500)
    └── middleware/
        ├── error-handler.ts            # Global error handler
        └── tenant-resolver.ts          # X-Tenant-Slug resolver

config/
└── tenant_settings.json                # Jara Brothers Group identity

tests/
├── unit/
│   ├── rag-fallback.test.ts            # Chunking, overlap, boundaries
│   ├── dtc-parser.test.ts              # P0AA6 critical, unknown codes
│   └── tenant-config.test.ts           # Defaults, partial merge
└── integration/
    └── orden-lockout.test.ts           # HV lockout validation logic
```

## Requisitos previos

- Node.js >= 20
- Cuenta en [Neon](https://neon.tech) o [Supabase](https://supabase.com)
- npm
- (Opcional) API key de OpenAI para embeddings semánticos (RAG)

## Configuración inicial

### 1. Clonar e instalar

```bash
git clone <repo-url> automotiveos-erp
cd automotiveos-erp
npm install
```

### 2. Configurar base de datos remota

1. Crear proyecto en Neon o Supabase.
2. Obtener `DATABASE_URL` (pooler — ver `.env.example`).
3. Copiar el template:

```bash
cp .env.example .env
```

4. Editar `.env`:

```env
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[REGION].pooler.supabase.com:5432/postgres?sslmode=require"
SUPABASE_URL="https://[PROJECT_REF].supabase.co"
SUPABASE_PUBLISHABLE_KEY="[ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE_ROLE_KEY]"
PORT=3000
NODE_ENV=development
OPENAI_API_KEY="sk-..."   # Opcional — embeddings semánticos para RAG
```

### 3. Validar conexión

```bash
npm run db:validate
```

### 4. Ejecutar migraciones

```bash
npm run db:migrate
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

Respuesta esperada:
```json
{
  "status": "ok",
  "uptime": 42,
  "database": "connected",
  "version": "0.1.0",
  "memory": {
    "rss": "28.15 MB",
    "heapUsed": "6.23 MB",
    "heapTotal": "12.45 MB"
  }
}
```

### 7. Ejecutar tests

```bash
npm test
```

## Módulos principales

### Configuración de Identidad Corporativa

Endpoints para gestionar logo, RUC y datos del taller:

```bash
# Obtener configuración actual
curl http://localhost:3000/api/config/settings

# Actualizar RUC y teléfono
curl -X PUT http://localhost:3000/api/config/settings \
  -H "Content-Type: application/json" \
  -d '{"rucOrTaxId":"80000000-1","phone":"+595 981 000 000"}'

# Subir logo (PNG/JPEG, máx 5MB)
curl -X POST http://localhost:3000/api/config/upload-logo \
  -F "file=@logo.png"
```

Los datos se inyectan automáticamente en las pantallas de TV y en las órdenes de trabajo.

### Pantallas de TV (WebSocket)

Las TVs del taller (Chromecast / Xiaomi Box en modo quiosco) se conectan vía WebSocket:

1. Abrir `http://[SERVER_IP]:3000/api/v1/visual/tv` en el navegador de la TV.
2. La pantalla recibe en tiempo real: modelo del vehículo, estado de la OT, torques, DTCs, badge HV, logo de la empresa.
3. Payload < 1 KB por evento — cero renderizado en servidor. Tailwind CSS corre en la TV.

```bash
# Ver estado de conexiones
curl http://localhost:3000/api/v1/visual/status
```

### Órdenes de Trabajo + Lockout HV

```bash
# Firmar lockout de alta tensión
curl -X POST http://localhost:3000/workshop/ordenes/:id/sign-lockout \
  -H "Content-Type: application/json" \
  -d '{"mechanicId":"uuid-del-mecanico"}'

# Cambiar estado (validación: bloquea "Listo" si HV sin firmar)
curl -X PATCH http://localhost:3000/workshop/ordenes/:id/status \
  -H "Content-Type: application/json" \
  -d '{"status":"Listo"}'
```

### RAG de Manuales Técnicos

Ingesta y búsqueda semántica de manuales OEM:

```bash
# Subir PDF (chunking 1000 chars + 200 overlap)
curl -X POST "http://localhost:3000/intelligence/manuals/ingest?vehicleId=..." \
  -F "file=@manual.pdf"

# Consulta semántica (OpenAI embedding + pgvector cosine)
curl -X POST http://localhost:3000/intelligence/manuals/query \
  -H "Content-Type: application/json" \
  -d '{"question":"torque de culata BYD Seal","topK":3}'
```

> **Fallback offline**: Si `OPENAI_API_KEY` no está configurada o la API falla, busca por ILIKE automáticamente.

### Seguridad EV/HEV

```bash
# Decodificar VIN + evaluar seguridad HV (NHTSA + heurística)
curl -X POST http://localhost:3000/intelligence/decode-safety \
  -H "Content-Type: application/json" \
  -d '{"vin":"VIN12345678901234","brand":"BYD","model":"Seal","year":2024}'

# Generar protocolo HV completo
curl -X POST http://localhost:3000/intelligence/safety/protocol \
  -H "Content-Type: application/json" \
  -d '{"brand":"Toyota","model":"Prius","hvBatteryVoltage":201.6}'

# Parsear código DTC individual
curl -X POST http://localhost:3000/intelligence/parse-dtc \
  -H "Content-Type: application/json" \
  -d '{"dtcCode":"P0AA6"}'
```

### SIFEN / Facturación Electrónica

```bash
# Emitir DTE completo (XML → firmar → enviar → recibir CDC)
curl -X POST http://localhost:3000/finance/sifen/emitir \
  -H "Content-Type: application/json" \
  -d '{...}'

# Exportar RG 90 (TXT/CSV/JSON)
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

## Offline-First

Para talleres con internet intermitente en Paraguay:

1. Operaciones se encolan localmente en el cliente.
2. `POST /sync` recibe batches de hasta 50 operaciones.
3. `GET /sync/config` devuelve configuración de reintentos.

## Scripts disponibles

| Comando             | Descripción                                  |
|---------------------|----------------------------------------------|
| `npm run dev`       | Inicia servidor con hot-reload (tsx watch)   |
| `npm run build`     | Compila TypeScript a JS                      |
| `npm start`         | Inicia servidor desde `dist/`                |
| `npm test`          | Ejecuta suite de tests (Vitest)              |
| `npm run test:watch`| Tests en modo watch                          |
| `npm run check`     | TypeScript type-check sin emitir             |
| `npm run db:migrate`| Ejecuta migraciones en la base de datos      |
| `npm run db:validate`| Valida la conexión con PostgreSQL remoto    |
| `npm run db:generate`| Genera migraciones desde schemas Drizzle     |
| `npm run clean`     | Elimina `dist/`                              |

## Licencia

UNLICENSED — Proyecto privado. Jara Brothers Group, Coronel Oviedo, Paraguay.
