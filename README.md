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
| Base de datos | Neon/Supabase PostgreSQL (remoto)    | 0 MB local, serverless, SSL forzado        |
| Dev runner    | tsx                                  | Sin compilación previa, hot reload          |

## Estructura del proyecto

```
src/
├── app.ts                     # Entry point
├── config/
│   └── env.ts                 # Environment variables loader
├── modules/
│   ├── tenants/               # Multi-tenant management
│   ├── auth/                  # Authentication
│   ├── clients/               # Customer management
│   ├── vehicles/              # Vehicle registry (EV/HEV)
│   ├── work-orders/           # Work orders
│   ├── inventory/             # Parts & tools
│   ├── fiscal/                # SIFEN/DNIT fiscal module
│   └── diagnostics/           # DTC mapping & LLM
├── plugins/
│   ├── health-check.ts        # /health, /health/live
│   └── sync.ts                # Offline-first sync endpoints
└── shared/
    ├── database/
    │   ├── connection.ts      # PostgreSQL pool
    │   ├── migrate.ts         # Schema migrator
    │   └── validate.ts        # Connection validator script
    ├── errors/
    │   └── app-error.ts       # Error classes (400-429-500)
    ├── middleware/
    │   ├── error-handler.ts   # Global error handler
    │   └── tenant-resolver.ts # X-Tenant-Slug resolver
    ├── offline/
    │   └── sync-service.ts    # Offline queue processor
    └── types/
        └── index.ts           # Shared interfaces
```

## Requisitos previos

- Node.js >= 20
- Cuenta en [Neon](https://neon.tech) o [Supabase](https://supabase.com) (PostgreSQL serverless)
- npm

## Configuración inicial

### 1. Clonar e instalar

```bash
git clone <repo-url> automotiveos-erp
cd automotiveos-erp
npm install
```

### 2. Configurar base de datos remota

1. Crear proyecto en [Neon](https://neon.tech) (recomendado) o Supabase.
2. Obtener la cadena de conexión (`DATABASE_URL`).
3. Copiar el template de variables de entorno:

```bash
cp .env.example .env
```

4. Editar `.env` con tu `DATABASE_URL`:

```env
DATABASE_URL="postgres://user:pass@ep-example.neon.tech:5432/neondb?sslmode=require"
PORT=3000
NODE_ENV=development
```

### 3. Validar conexión a base de datos

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

El servidor arrancará en `http://localhost:3000`.

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

## Multi-Tenant

El aislamiento se maneja mediante **schemas de PostgreSQL**:

- `public` — tablas de plataforma (tenants, migraciones)
- `tenant_<slug>` — datos aislados por taller

Cada request debe incluir el header `X-Tenant-Slug`:

```bash
curl -H "X-Tenant-Slug: taller-el-chero" http://localhost:3000/sync/config
```

## Offline-First

Para talleres con internet intermitente en Paraguay:

1. Las operaciones se encolan localmente en el cliente.
2. `POST /sync` recibe batches de hasta 50 operaciones.
3. `GET /sync/config` devuelve configuración de reintentos.

## Dominio fiscal (Paraguay)

- **DNIT SIFEN V150**: Facturación electrónica, XML firmado con certificado X.509.
- **RG 90 Marangatu**: Pre-factura electrónica.
- **Ley 1034/83**: Código tributario paraguayo.

El módulo fiscal (`src/modules/fiscal/`) está preparado para integrar
el envío de DTE al SIFEN vía e-Kuatia.

## Dominio automotriz

- **EV/HEV**: Campos de seguridad de alta tensión (HV) en el modelo `vehicles`.
- **DTC Mapping**: Integración con escáneres Launch/Thinkcar para
  códigos de diagnóstico.

## Scripts disponibles

| Comando             | Descripción                                  |
|---------------------|----------------------------------------------|
| `npm run dev`       | Inicia servidor con hot-reload (tsx watch)   |
| `npm run build`     | Compila TypeScript a JS                      |
| `npm start`         | Inicia servidor desde `dist/`                |
| `npm run db:migrate`| Ejecuta migraciones en la base de datos      |
| `npm run db:validate`| Valida la conexión con PostgreSQL remoto    |
| `npm run check`     | TypeScript type-check sin emitir             |
| `npm run clean`     | Elimina `dist/`                              |

## Licencia

UNLICENSED — Proyecto privado.
