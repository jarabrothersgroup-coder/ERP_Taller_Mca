# Guía de Despliegue — AutomotiveOS ERP (On-Premise)

## Tabla de Variables de Entorno

| Variable | Obligatoria | Descripción | Ejemplo |
|----------|-------------|-------------|---------|
| `DATABASE_URL` | ✅ | Conexión PostgreSQL local | `postgresql://erp_user:pass@localhost:5432/automotive_os?sslmode=disable` |
| `STORAGE_PATH` | ✅ | Ruta del storage local | `/data/erp-storage` |
| `JWT_SECRET` | ✅ | Secreto para tokens JWT | `tu-secreto-largo-aqui` |
| `PORT` | ❌ | Puerto (default: 3000) | `3000` |
| `HOST` | ❌ | Host (default: 0.0.0.0) | `0.0.0.0` |
| `NODE_ENV` | ❌ | Entorno (development/production) | `production` |
| `LOG_LEVEL` | ❌ | Nivel de log (default: info) | `warn` |
| `OPENAI_API_KEY` | ❌ | API key para embeddings RAG | `sk-proj-...` |
| `SIFEN_CERT_PATH` | ❌ | Ruta al certificado PKCS#12 | `/etc/ssl/sifen/certificate.p12` |
| `SIFEN_CERT_PASS` | ❌ | Contraseña del certificado SIFEN | `password` |
| `SIFEN_USE_TEST` | ❌ | Usar entorno de pruebas SIFEN | `true` |
| `SYNC_INTERVAL_MS` | ❌ | Intervalo de sync offline (default: 30000) | `30000` |

## Puesta en Marcha Rápida

### En 30 segundos (con Docker)

```bash
# 1. Clonar e instalar
git clone <repo> && cd automotiveos-erp && npm install

# 2. Configurar .env
cp .env.example .env
nano .env   # configurar DATABASE_URL, JWT_SECRET, STORAGE_PATH

# 3. Crear directorio de storage
sudo mkdir -p /data/erp-storage/dvi-photos
sudo chown -R $(whoami) /data/erp-storage

# 4. Levantar con Docker
docker compose -f docker-compose.onpremise.yml up -d
```

### Sin Docker

```bash
# 1. Instalar PostgreSQL y crear base de datos
sudo -u postgres psql -c "CREATE USER erp_user WITH PASSWORD 'pass';"
sudo -u postgres psql -c "CREATE DATABASE automotive_os OWNER erp_user;"
psql -U erp_user -d automotive_os -f supabase/migrations/20260619000000_init_schema.sql

# 2. Configurar .env
cp .env.example .env
nano .env

# 3. Instalar, compilar e iniciar
npm install && npm run build && npm run start:prod
```

### Verificar que funciona

```bash
curl http://localhost:3000/health
# → {"status":"ok","database":"connected","memory":{"rss":"28.15 MB","heapUsed":"6.23 MB"}}
```

## Arquitectura On-Premise

```
┌─────────────────────────────────────────────────┐
│  Servidor Local                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ ERP      │ │ Redis    │ │ PostgreSQL       │ │
│  │ Fastify  │ │ Cache    │ │ Base de datos    │ │
│  │ :3000    │ │ :6379    │ │ :5432            │ │
│  └────┬─────┘ └──────────┘ └──────────────────┘ │
│       │                                          │
│  ┌────▼──────────────────────────────────────┐  │
│  │  /data/erp-storage/                       │  │
│  │  └─ dvi-photos/{tenant}/{inspection}/     │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Consumo estimado:** ~370MB RAM total

## Configuración de TVs (Modo Quiosco)

### Chromecast / Xiaomi Box / Android TV

1. Instalar **Kiosk Browser** o **Fully Kiosk Browser** desde Play Store.
2. Configurar URL de inicio: `http://[IP_DEL_SERVIDOR]:3000/api/v1/visual/tv`
3. Ajustes recomendados:
   - Rotación: forzar landscape
   - Barra de navegación: oculta
   - Timeout de pantalla: nunca apagar
   - Recargar página si hay error de conexión
4. La TV se conectará automáticamente al WebSocket y mostrará las OT en tiempo real.

### PC / Notebook (pruebas)

```bash
# Abrir en navegador
firefox http://localhost:3000/api/v1/visual/tv

# Verificar conexiones activas
curl http://localhost:3000/api/v1/visual/status
```

## Comandos de Mantenimiento

```bash
# Ver estado
curl http://localhost:3000/health

# Tests
npm test

# Type check
npm run check

# Backup PostgreSQL
pg_dump -U erp_user -d automotive_os --format=custom --file=backup.dump

# Restaurar backup
pg_restore -U erp_user -d automotive_os --clean backup.dump

# Limpiar y reconstruir
npm run clean && npm run build && npm start
```

## Resolución de Problemas

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| `ECONNREFUSED` en startup | PostgreSQL no corriendo | `sudo systemctl start postgresql` |
| `password auth failed` | pg_hba.conf incorrecto | Verificar método md5 en pg_hba.conf |
| WebSocket TV sin conectar | Firewall bloqueando | `sudo firewall-cmd --add-port=3000/tcp` |
| Logo no se muestra en TV | No se subió logo | `curl -X POST -F "file=@logo.png" /api/config/upload-logo` |
| RAG sin resultados | OPENAI_API_KEY faltante | Configurar API key o subir PDFs primero |
| OT no pasa a "Listo" | HV sin lockout firmado | `POST /workshop/ordenes/:id/sign-lockout` |
| Storage 404 | Directorio no existe | `sudo mkdir -p /data/erp-storage/dvi-photos` |
| Disco lento | HDD | Tunear `random_page_cost=10.0` en postgresql.conf |
