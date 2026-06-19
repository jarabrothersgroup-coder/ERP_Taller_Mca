# 📘 Manual de Despliegue, Infraestructura y CI/CD
# AutomotiveOS Cloud ERP

**Versión:** 1.0.0  
**Fecha:** 19 de junio de 2026  
**Autor:** DevOps/SRE Engineer  
**Clasificación:** Documentación Técnica Interna

---

## Tabla de Contenidos

1. [Prerrequisitos del Sistema](#1-prerrequisitos-del-sistema)
2. [Arquitectura del Puente Híbrido](#2-arquitectura-del-puente-híbrido)
3. [Configuración Inicial de Supabase](#3-configuración-inicial-de-supabase)
4. [Pipeline CI/CD](#4-pipeline-cicd)
5. [Despliegue Paso a Paso](#5-despliegue-paso-a-paso)
6. [Plan de Contingencia ante Caídas de Red](#6-plan-de-contingencia-ante-caídas-de-red)
7. [Monitoreo y Alertas](#7-monitoreo-y-alertas)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerrequisitos del Sistema

### 1.1 Especificaciones de Hardware (Servidor Local — Taller)

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Almacenamiento | 50 GB SSD | 100 GB SSD |
| Red | 100 Mbps | 1 Gbps |
| Internet | 10 Mbps | 50 Mbps (para sync a Supabase) |

### 1.2 Software Requerido

| Software | Versión | Propósito |
|----------|---------|-----------|
| Docker | ≥ 24.0 | Contenedores |
| Docker Compose | ≥ 2.20 | Orquestación |
| Node.js | ≥ 20.0 | Runtime (para builds) |
| Supabase CLI | ≥ 1.200 | Migraciones DB |
| Git | ≥ 2.40 | Control de versiones |
| PostgreSQL Client | ≥ 16 | Herramientas de BD |

### 1.3 Instalación Rápida

```bash
# Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Supabase CLI
curl -sS https://get.supabase.com | sudo bash

# Verificar instalación
docker --version          # ≥ 24.0
docker compose version    # ≥ 2.20
node --version            # ≥ 20.0
supabase --version        # ≥ 1.200
```

---

## 2. Arquitectura del Puente Híbrido

### 2.1 Topología

```
┌─────────────────────────────────────────────────────────────┐
│  ON-PREMISE (Taller)                                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ ERP Backend  │  │ Twenty CRM   │  │ Evolution API    │  │
│  │ (Fastify)    │  │ (React)      │  │ (WhatsApp)       │  │
│  │ :3000        │  │ :3001        │  │ :8080            │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
│         │                 │                                 │
│  ┌──────▼─────────────────▼──────────────────────────────┐  │
│  │ Redis (Cache Layer)                                    │  │
│  │ - Catálogo de Repuestos (TTL 5min)                     │  │
│  │ - Tarifas de Mano de Obra (TTL 10min)                  │  │
│  │ - Sesiones de Usuario (TTL 8h)                         │  │
│  │ - Rate Limiting ( sliding window )                     │  │
│  └───────────────────────────────────────────────────────┘  │
│         │                                                   │
│  ┌──────▼───────────────────────────────────────────────┐   │
│  │ PostgreSQL Local (On-Premise)                        │   │
│  │ - Datos críticos de operación diaria                 │   │
│  │ - Cache de fallos de sync                            │   │
│  │ - Logs de auditoría local                            │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │ Sync Worker (Cron cada 5 min)                        │   │
│  │ - pg_dump tablas críticas → gzip → pg_restore        │   │
│  │ - Backup local antes de push                         │   │
│  │ - Retry con backoff en fallos                        │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          │ pg_dump / pg_restore
                          │ (HTTPS + SSL)
                          │
┌─────────────────────────▼───────────────────────────────────┐
│  SUPABASE CLOUD                                            │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ PostgreSQL (Réplica + Backup Automático diario)       │  │
│  │ - Backup automático 7 días retention                  │  │
│  │ - Point-in-time recovery                              │  │
│  │ - Acceso remoto desde cualquier dispositivo           │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Supavisor (Connection Pooling — Transaction Mode)     │  │
│  │ - Puerto: 6543                                        │  │
│  │ - Pool: 50 conexiones transaccionales                 │  │
│  │ - Timeout: 30s                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Supabase Studio (Dashboard de administración)         │  │
│  │ - https://supabase.com/dashboard                      │  │
│  │ - Auth, Storage, Realtime, Edge Functions             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Flujo de Datos

#### Operación Normal (Online)
1. **Lectura**: ERP → Redis (cache hit) → PostgreSQL Local (cache miss)
2. **Escritura**: ERP → PostgreSQL Local → Sync Worker → Supabase Cloud
3. **Sync**: Cada 5 min, pg_dump de tablas críticas → pg_restore en Supabase

#### Modo Offline (Sin Internet)
1. **Operación local continua**: PostgreSQL local sin interrupciones
2. **Cache de fallos**: Sync worker guarda dumps fallidos en `/app/backups/*.FAILED`
3. **Recovery automático**: Cuando vuelve la red, sync worker procesa cola pendiente

### 2.3 Estrategia de Caché (Redis)

```typescript
// Configuración de caché en el ERP
const CACHE_CONFIG = {
  // Catálogo de repuestos — TTL 5 minutos
  repuestos: { ttl: 300, prefix: "cache:rep:" },
  
  // Tarifas de mano de obra — TTL 10 minutos
  labor_rates: { ttl: 600, prefix: "cache:labor:" },
  
  // Sesiones de usuario — TTL 8 horas
  sessions: { ttl: 28800, prefix: "session:" },
  
  // Rate limiting — sliding window
  rate_limit: { ttl: 60, prefix: "rl:" },
  
  // Dashboard KPIs — TTL 2 minutos
  dashboard: { ttl: 120, prefix: "cache:dash:" },
};
```

**Política de invalidación:**
- **Write-through**: Al modificar repuestos, invalidar `cache:rep:*`
- **TTL automático**: Cada entrada expira según su TTL
- **LRU eviction**: Redis descarta las entradas menos usadas cuando alcanza 128MB

---

## 3. Configuración Inicial de Supabase

### 3.1 Flujo de Trabajo de Migraciones

```bash
# ─── Paso 1: Inicializar Supabase CLI ──────────────────
supabase init

# Esto crea:
# supabase/
#   config.toml      ← Configuración del proyecto
#   migrations/      ← SQL migrations
#   seed.sql         ← Datos semilla
#   functions/       ← Edge Functions

# ─── Paso 2: Link al proyecto remoto ───────────────────
supabase link \
  --project-ref <YOUR_PROJECT_ID> \
  --token <YOUR_ACCESS_TOKEN>

# Obtener token: https://supabase.com/dashboard/account/tokens
# Obtener project-id: https://supabase.com/dashboard/project/_/settings/api

# ─── Paso 3: Crear migración inicial ───────────────────
# Opción A: Generar desde esquema existente (Drizzle)
supabase db diff --use-migra --schema public \
  > supabase/migrations/20260619000000_init_schema.sql

# Opción B: Usar el archivo consolidado ya creado
cp supabase/migrations/20260619000000_init_schema.sql \
   supabase/migrations/

# ─── Paso 4: Aplicar migraciones ───────────────────────
supabase db push --linked

# ─── Paso 5: Verificar estado ──────────────────────────
supabase migration list --linked

# ─── Paso 6: Lint de migraciones ───────────────────────
supabase db lint --linked
```

### 3.2 Configuración de Supavisor (Connection Pooling)

Supavisor es el connection pooler de Supabase. Configurar en modo **Transaction** para máximo rendimiento.

**Puertos de conexión:**
| Puerto | Modo | Uso |
|--------|------|-----|
| 5432 | Session | Conexiones directas (migraciones, admin) |
| 6543 | Transaction | **Producción** — Transacciones SQL |

**Cambiar URLs de conexión en el backend:**

```typescript
// ❌ ANTES (directo — agota conexiones en picos)
DATABASE_URL=postgresql://user:pass@db.xxx.supabase.co:5432/postgres?sslmode=require

// ✅ DESPUÉS (Supavisor Transaction mode)
DATABASE_URL=postgresql://user:pass@db.xxx.supabase.co:6543/postgres?pgbouncer=true&sslmode=require
```

**Configuración de Supavisor (dashboard de Supabase):**

1. Ir a **Settings → Database → Connection pool**
2. Configurar:
   - **Pool Mode**: Transaction
   - **Default Pool Size**: 20
   - **Max Client Connections**: 100
   - **Server Idle Timeout**: 300s

**Configuración en `drizzle.config.ts`:**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/shared/database/schema/index.ts",
  out: "./src/shared/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Usar Supavisor para queries en producción
    url: process.env.DATABASE_URL?.replace(
      ":5432/",  // Puerto directo
      ":6543/"   // Puerto Supavisor
    ) + "&pgbouncer=true",
  },
});
```

### 3.3 Estructura de RLS (Row Level Security)

**Política de Tenant Isolation:**

```sql
-- Cada usuario solo ve datos de su tenant
CREATE POLICY "tenant_isolation" ON clients
  FOR ALL USING (
    tenant_id = current_setting('app.current_tenant')::uuid
  );

-- El backend establece el tenant al conectar:
SELECT set_config('app.current_tenant', '<tenant_uuid>', true);
```

**Política de Roles (Mecánicos vs Cajeros):**

```sql
-- Mecánicos: solo OTs asignadas
CREATE POLICY "mechanic_own_orders" ON ordenes_trabajo
  FOR ALL USING (
    assigned_mechanic_id = auth.uid()
    OR current_setting('app.current_role') IN ('admin', 'manager')
  );

-- Cajeros: acceso a facturación
CREATE POLICY "cashier_billing_access" ON facturas
  FOR ALL USING (
    current_setting('app.current_role') IN ('admin', 'manager', 'user')
  );
```

---

## 4. Pipeline CI/CD

### 4.1 Flujo del Pipeline

```
Push a main → Lint → Test → DB Push → Build Docker → Deploy
     │           │       │        │            │           │
     │           │       │        │            │           └─ SSH a servidor
     │           │       │        │            └─ Docker Hub push
     │           │       │        └─ supabase db push --linked
     │           │       └─ vitest run (1398+ tests)
     │           └─ tsc --noEmit + supabase db lint
     └─ Trigger automático
```

### 4.2 GitHub Secrets Requeridos

| Secret | Descripción | Cómo obtener |
|--------|-------------|--------------|
| `SUPABASE_ACCESS_TOKEN` | Token de Supabase CLI | https://supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_ID` | ID del proyecto | https://supabase.com/dashboard/project/_/settings/api |
| `DOCKERHUB_USERNAME` | Usuario Docker Hub | https://hub.docker.com |
| `DOCKERHUB_TOKEN` | Token Docker Hub | https://hub.docker.com/settings/security |
| `DEPLOY_SSH_KEY` | Clave SSH privada | `ssh-keygen -t ed25519` |
| `DEPLOY_HOST` | IP del servidor | IP pública del taller |
| `DEPLOY_USER` | Usuario SSH | `deploy` (crear usuario dedicado) |

### 4.3 Configurar GitHub Secrets

```bash
# Desde la línea de comandos
gh secret set SUPABASE_ACCESS_TOKEN -a Actions -f .secret_token
gh secret set SUPABASE_PROJECT_ID -a Actions -f .secret_project_id
gh secret set DOCKERHUB_USERNAME -a Actions -f .secret_docker_user
gh secret set DOCKERHUB_TOKEN -a Actions -f .secret_docker_token
gh secret set DEPLOY_SSH_KEY -a Actions -f ~/.ssh/id_ed25519
gh secret set DEPLOY_HOST -a Actions -f .secret_deploy_host
gh secret set DEPLOY_USER -a Actions -f "deploy"
```

---

## 5. Despliegue Paso a Paso

### 5.1 Primera Vez (Fresh Install)

```bash
# ─── Paso 1: Clonar repositorio ────────────────────────
git clone https://github.com/automotiveos/erp.git /opt/automotiveos
cd /opt/automotiveos

# ─── Paso 2: Configurar variables de entorno ───────────
cp .env.example .env
nano .env  # Editar con valores reales

# Variables críticas a configurar:
# - DATABASE_URL (Supavisor Transaction mode)
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - WHATSAPP_API_KEY
# - TWENTY_API_KEY
# - SIFEN_CERT_PATH + SIFEN_CERT_PASS

# ─── Paso 3: Inicializar Supabase (opcional) ──────────
supabase init
supabase link --project-ref <PROJECT_ID>
supabase db push --linked

# ─── Paso 4: Levantar ecosistema ──────────────────────
docker compose -f docker-compose.prod.yml up -d

# Verificar salud
docker compose -f docker-compose.prod.yml ps
curl -sf http://localhost:3000/api/v1/health

# ─── Paso 5: Poblar datos semilla ─────────────────────
docker compose -f docker-compose.prod.yml exec erp \
  npx tsx src/shared/database/seed.ts

# ─── Paso 6: Verificar─────────────────────────────────
docker compose -f docker-compose.prod.yml logs -f erp
```

### 5.2 Actualizaciones (Deploy Continuo)

```bash
# El pipeline CI/CD hace esto automáticamente.
# Para deploy manual:

cd /opt/automotiveos

# Pull código
git pull origin main

# Pull nueva imagen Docker
docker pull automotiveos/erp-backend:latest

# Restart sin downtime
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# Verificar
curl -sf http://localhost:3000/api/v1/health
```

### 5.3 Rollback

```bash
# Si el deploy falla, rollback a versión anterior
cd /opt/automotiveos

# Listar imágenes disponibles
docker images automotiveos/erp-backend

# Tag anterior como latest
docker tag automotiveos/erp-backend:previous automotiveos/erp-backend:latest

# Restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

---

## 6. Plan de Contingencia ante Caídas de Red

### 6.1 Comportamiento del Sistema Offline

| Componente | Comportamiento | Impacto |
|------------|----------------|---------|
| **ERP Backend** | Funciona normalmente con PostgreSQL local | Sin impacto |
| **Twenty CRM** | Modo solo lectura (datos cacheados) | Sin sync con ERP |
| **Evolution API** | WhatsApp desconectado temporalmente | Mensajes en cola |
| **Sync Worker** | Se detiene, guarda dumps pendientes | Datos no sync en cloud |
| **Redis** | Funciona normalmente (local) | Cache intacto |

### 6.2 Protocolo de Recovery

```
┌─────────────────────────────────────────────────────────┐
│  RED CAE                                               │
│  ↓                                                     │
│  Sync Worker detecta fallo de conexión                  │
│  ↓                                                     │
│  Guarda dump en /app/backups/*.FAILED                   │
│  ↓                                                     │
│  Retry cada 30 segundos con backoff exponencial         │
│  (30s → 60s → 120s → 300s → 600s)                      │
│  ↓                                                     │
│  RED RESTAURA                                          │
│  ↓                                                     │
│  Sync Worker procesa cola pendiente                     │
│  ↓                                                     │
│  pg_restore de todos los dumps pendientes               │
│  ↓                                                     │
│  Limpieza de archivos .FAILED                           │
│  ↓                                                     │
│  Sync normal restaurado                                 │
└─────────────────────────────────────────────────────────┘
```

### 6.3 Scripts de Recovery

```bash
#!/bin/bash
# sync-recovery.sh — Procesar dumps pendientes después de caída de red

set -euo pipefail

BACKUP_DIR="/app/backups"
CLOUD_DB_URL="${CLOUD_DB_URL:?Required}"

echo "🔄 Procesando dumps pendientes..."

for file in "${BACKUP_DIR}"/*.FAILED; do
  [ -f "$file" ] || continue
  
  table=$(basename "$file" | sed 's/_[0-9]*_[0-9]*.sql.gz.FAILED//')
  echo "📦 Procesando: ${table}"
  
  # Intentar restore
  if gunzip -c "$file" | psql "$CLOUD_DB_URL" --single-transaction 2>/dev/null; then
    echo "✅ Sync exitoso: ${table}"
    rm -f "$file"
  else
    echo "❌ Sync falló: ${table} — manteniendo para reintento"
  fi
done

echo "✅ Recovery completa"
```

### 6.4 Backup Local Automático

```bash
# Cron job para backup local diario (5 AM)
# Agregar a crontab del servidor:
0 5 * * * /opt/automotiveos/docker/sync/backup-local.sh >> /var/log/erp-backup.log 2>&1
```

```bash
#!/bin/bash
# backup-local.sh — Backup completo de PostgreSQL local

set -euo pipefail

BACKUP_DIR="/opt/automotiveos/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/full_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Backup completo
pg_dump "$LOCAL_DB_URL" \
  --format=custom \
  --compress=9 \
  --verbose \
  > "$BACKUP_FILE"

# Mantener solo últimos 7 backups
ls -t "${BACKUP_DIR}"/full_backup_*.sql.gz | tail -n +8 | xargs rm -f 2>/dev/null

echo "✅ Backup completado: ${BACKUP_FILE}"
echo "📦 Tamaño: $(du -h "$BACKUP_FILE" | cut -f1)"
```

---

## 7. Monitoreo y Alertas

### 7.1 Health Checks

```bash
# Endpoint de salud del ERP
curl -sf http://localhost:3000/api/v1/health

# Verificar PostgreSQL
docker compose exec postgres-local pg_isready

# Verificar Redis
docker compose exec redis redis-cli -a $REDIS_PASSWORD ping

# Verificar Sync Worker
docker compose logs --tail=20 sync-worker
```

### 7.2 Métricas Clave

| Métrica | Umbral | Alerta |
|---------|--------|--------|
| CPU uso promedio | > 80% | Warning |
| RAM uso | > 85% | Critical |
| Disco uso | > 90% | Critical |
| Sync lag | > 15 min | Warning |
| Sync failures | > 3 consecutivos | Critical |
| Health check fail | > 2 minutos | Critical |

### 7.3 Logs

```bash
# Ver logs en tiempo real
docker compose -f docker-compose.prod.yml logs -f

# Ver logs del sync worker
docker compose logs -f sync-worker

# Buscar errores
docker compose logs erp | grep -i "error\|fail\|critical"
```

---

## 8. Troubleshooting

### 8.1 Problemas Comunes

| Problema | Causa | Solución |
|----------|-------|----------|
| `ECONNREFUSED` a Supabase | Supavisor no disponible | Verificar puerto 6543, check `pgbouncer=true` |
| `Too many connections` | Pool agotado | Aumentar `Default Pool Size` en Supavisor |
| Sync worker falla | Credenciales incorrectas | Verificar `CLOUD_DB_URL` en variables |
| Redis `OOM` | Memoria llena | Verificar `maxmemory`, limpiar keys expiradas |
| Docker build falla | Node.js version mismatch | Verificar `engines.node` en `package.json` |

### 8.2 Comandos Útiles

```bash
# Reiniciar todo el ecosistema
docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d

# Verificar conexiones de PostgreSQL
docker compose exec postgres-local psql -U erp_user -d automotive_os -c "SELECT count(*) FROM pg_stat_activity;"

# Limpiar Docker (recuperar espacio)
docker system prune -af --volumes

# Verificar estado de Supabase
supabase migration list --linked
```

---

## Anexos

### A. Variables de Entorno Completas

Ver `.env.example` para la lista completa de variables.

### B. Estructura de Archivos

```
/opt/automotiveos/
├── .github/workflows/ci-cd.yml    ← Pipeline CI/CD
├── docker-compose.prod.yml         ← Producción (Hybrid Bridge)
├── Dockerfile                      ← Multi-stage build
├── supabase/
│   ├── config.toml                 ← Supabase CLI config
│   ├── migrations/
│   │   └── 20260619000000_init_schema.sql
│   └── seed.sql
├── docker/
│   └── sync/
│       └── sync-to-cloud.sh        ← Sync Worker script
├── src/
│   └── shared/database/migrations/ ← Drizzle migrations (24)
├── docs/Proyecto/
│   └── 06_Manual_Despliegue_Infraestructura_y_CICD.md
└── engram.json
```

### C. Enlaces Útiles

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Supabase Docs**: https://supabase.com/docs
- **Supavisor Config**: https://supabase.com/docs/guides/platform/connection-pooling
- **Docker Docs**: https://docs.docker.com
- **GitHub Actions**: https://docs.github.com/en/actions
