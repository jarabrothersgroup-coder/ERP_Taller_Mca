# Guía de Despliegue — AutomotiveOS ERP (On-Premise)

## 1. Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│  Servidor On-Premise                                     │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Fastify ERP  │  │ Redis Cache  │  │ PostgreSQL   │  │
│  │ :3000        │  │ :6379        │  │ :5432        │  │
│  │ ~48MB RAM    │  │ ~64MB RAM    │  │ ~256MB RAM   │  │
│  └──────┬───────┘  └──────────────┘  └──────────────┘  │
│         │                                                │
│  ┌──────▼──────────────────────────────────────────┐    │
│  │  Storage Local: /data/erp-storage/              │    │
│  │  └─ dvi-photos/{tenant}/{inspection}/{photo}    │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Consumo total estimado: ~370MB RAM                      │
└─────────────────────────────────────────────────────────┘
```

**Stack:**
- Fastify + TypeScript (Node.js)
- PostgreSQL 16 (base de datos local)
- Redis 7 (cache)
- Filesystem local (storage de archivos)
- JWT autenticación

---

## 2. Requisitos del Sistema

### Hardware mínimo

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| CPU | 2 cores | 2+ cores |
| RAM | 1 GB | 2+ GB |
| Disco | 10 GB HDD | 20+ GB |
| Red | Ethernet 100Mbps | Gigabit |

### Software

- **Sistema operativo**: openSUSE Leap 16 (o cualquier Linux)
- **Node.js** >= 20.0.0
- **PostgreSQL** 16
- **Redis** 7 (opcional, para cache)
- **Docker + Docker Compose** (recomendado)

---

## 3. Instalación en openSUSE Leap 16

### 3.1 Instalar PostgreSQL 16

```bash
# Agregar repositorio
sudo zypper addrepo -cfp \
  https://download.opensuse.org/repositories/server:/database/openSUSE_Tumbleweed/ \
  server:database

sudo zypper refresh
sudo zypper install postgresql16-server postgresql16

# Inicializar
sudo postgresql-setup --initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 3.2 Configurar PostgreSQL para bajo consumo de RAM

Editar `/var/lib/pgsql/data/postgresql.conf`:

```ini
# === Tuning para hardware limitado ===
shared_buffers = 512MB            # 10% de RAM disponible
effective_cache_size = 1GB        # 20% de RAM disponible
work_mem = 4MB                    # Conservative para queries complejas
maintenance_work_mem = 64MB       # Para VACUUM y CREATE INDEX
max_connections = 20              # Suficiente para ERP local
checkpoint_completion_target = 0.9
wal_buffers = 16MB
random_page_cost = 10.0           # HDD (no SSD)
effective_io_concurrency = 2      # HDD
min_wal_size = 100MB
max_wal_size = 1GB
```

### 3.3 Configurar autenticación

Editar `/var/lib/pgsql/data/pg_hba.conf` — agregar al final:

```
# Conexiones locales con contraseña
host all all 127.0.0.1/32 md5
local all all md5
```

Reiniciar PostgreSQL:

```bash
sudo systemctl restart postgresql
```

### 3.4 Crear base de datos y usuario

```sql
sudo -u postgres psql

CREATE USER erp_user WITH PASSWORD 'tu_password_seguro';
CREATE DATABASE automotive_os OWNER erp_user;
GRANT ALL PRIVILEGES ON DATABASE automotive_os TO erp_user;

\c automotive_os
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\q
```

### 3.5 Importar schema

```bash
psql -U erp_user -d automotive_os \
  -f supabase/migrations/20260619000000_init_schema.sql
```

---

## 4. IP Fija Local (para conexión de TVs)

Las TVs del taller se conectan al WebSocket del servidor.
Para que las encuentren siempre en la misma dirección, configurar una **IP fija local**.

### 4.1 Via NetworkManager

```bash
nmcli connection modify "Wired connection 1" \
  ipv4.method manual \
  ipv4.addresses 192.168.1.100/24 \
  ipv4.gateway 192.168.1.1 \
  ipv4.dns "8.8.8.8 1.1.1.1"

nmcli connection down "Wired connection 1"
nmcli connection up "Wired connection 1"
```

### 4.2 Via systemd-networkd

Crear `/etc/systemd/network/20-wired.network`:

```ini
[Match]
Name=eth0

[Network]
Address=192.168.1.100/24
Gateway=192.168.1.1
DNS=8.8.8.8
DNS=1.1.1.1
```

```bash
sudo systemctl restart systemd-networkd
```

### 4.3 Reserva DHCP en el Router

Alternativamente, acceder al panel del router (`http://192.168.1.1`) y crear una **reserva DHCP** para la MAC del servidor.

**Notas:**
- Elegir IP fuera del rango DHCP (ej. `.100` a `.200`)
- Verificar: `ping 192.168.1.100` desde otra máquina

---

## 5. Despliegue con Docker (Recomendado)

### 5.1 Preparar entorno

```bash
cd ~/Projects/ERP_Taller_Mca

# Copiar template de variables
cp .env.example .env

# Editar con valores reales
nano .env
```

Variables principales en `.env`:

```env
# Base de datos local
DATABASE_URL="postgresql://erp_user:tu_password@localhost:5432/automotive_os?sslmode=disable"

# Storage local
STORAGE_PATH="/data/erp-storage"

# JWT (CAMBIAR EN PRODUCCIÓN)
JWT_SECRET="tu-secreto-jwt-aqui"

# Servidor
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
```

### 5.2 Crear directorio de storage

```bash
sudo mkdir -p /data/erp-storage/dvi-photos
sudo chown -R $(whoami) /data/erp-storage
chmod -R 750 /data/erp-storage
```

### 5.3 Levantar stack completo

```bash
# Desarrollo (con PostgreSQL local)
docker compose up -d

# Producción on-premise (optimizado)
docker compose -f docker-compose.onpremise.yml up -d
```

### 5.4 Verificar

```bash
# Health check
curl http://localhost:3000/health

# Estado de servicios
docker compose ps

# Logs
docker compose logs -f erp
```

---

## 6. Despliegue sin Docker (Manual)

### 6.1 Instalar dependencias

```bash
cd ~/Projects/ERP_Taller_Mca
npm install
```

### 6.2 Compilar

```bash
npm run build
```

### 6.3 Iniciar en producción

```bash
npm run start:prod
```

Optimizaciones de memoria:

| Flag | Efecto |
|------|--------|
| `--max-old-space-size=48` | Limita heap V8 a 48 MB |
| `--optimize-for-size` | Prioriza baja memoria |
| `--gc-interval=100` | GC cada 100ms en idle |

---

## 7. Servicio systemd (Auto-Inicio)

```bash
sudo nano /etc/systemd/system/automotiveos.service
```

```ini
[Unit]
Description=AutomotiveOS ERP
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=jara
WorkingDirectory=/home/jara/Projects/ERP_Taller_Mca
ExecStart=/usr/bin/node --max-old-space-size=48 --optimize-for-size --gc-interval=100 dist/app.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=3000
Environment=LOG_LEVEL=warn
TimeoutStopSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Asegurar que PostgreSQL arranque primero
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Habilitar ERP
sudo systemctl daemon-reload
sudo systemctl enable automotiveos.service
sudo systemctl start automotiveos.service

# Ver logs
journalctl -u automotiveos.service -f
```

---

## 8. Conexión de TVs del Taller

### 8.1 Sala de Espera (Quiosco TV)

En el navegador de la TV (Chromecast, Xiaomi Box, Smart TV):

```
http://192.168.1.100:3000/api/v1/visual/tv
```

### 8.2 Dashboard desde Notebook / Tablet

```
http://192.168.1.100:3000/dashboard
```

### 8.3 Verificar TVs Conectadas

```bash
curl http://192.168.1.100:3000/api/v1/visual/status
# {"connectedScreens":2,"uptime":1234.56}
```

### 8.4 Configurar TV en modo quiosco

1. Instalar **Kiosk Browser** o **Fully Kiosk Browser** (Play Store)
2. URL de inicio: `http://[IP_DEL_SERVIDOR]:3000/api/v1/visual/tv`
3. Ajustes:
   - Rotación: landscape
   - Barra de navegación: oculta
   - Timeout de pantalla: nunca apagar
   - Recargar si hay error de conexión

---

## 9. Mantenimiento

### 9.1 Migraciones de Base de Datos

```bash
npm run db:migrate
```

### 9.2 Seed de Datos de Prueba

```bash
npm run build
npx tsx src/shared/database/seed.ts taller-el-chero
```

### 9.3 Backup de PostgreSQL

```bash
# Backup completo
pg_dump -U erp_user -d automotive_os \
  --format=custom \
  --file=backup_$(date +%Y%m%d_%H%M).dump

# Restaurar
pg_restore -U erp_user -d automotive_os \
  --clean backup_20260630_1200.dump
```

### 9.4 Logs

```bash
# Con Docker
docker compose logs -f erp

# Con systemd
journalctl -u automotiveos.service -f -o cat
```

### 9.5 Actualización

```bash
cd ~/Projects/ERP_Taller_Mca
git pull
npm install
npm run build

# Con Docker
docker compose -f docker-compose.onpremise.yml up -d --build

# Con systemd
sudo systemctl restart automotiveos.service
```

---

## 10. Variables de Entorno

| Variable | Obligatoria | Descripción | Ejemplo |
|----------|-------------|-------------|---------|
| `DATABASE_URL` | ✅ | Conexión PostgreSQL local | `postgresql://erp_user:pass@localhost:5432/automotive_os?sslmode=disable` |
| `STORAGE_PATH` | ✅ | Ruta del storage local | `/data/erp-storage` |
| `JWT_SECRET` | ✅ | Secreto para tokens JWT | `tu-secreto-largo-aqui` |
| `PORT` | ❌ | Puerto (default: 3000) | `3000` |
| `HOST` | ❌ | Host (default: 0.0.0.0) | `0.0.0.0` |
| `NODE_ENV` | ❌ | Entorno | `production` |
| `LOG_LEVEL` | ❌ | Nivel de log | `warn` |
| `CORS_ORIGIN` | ❌ | Origen CORS permitido | `http://localhost:3000` |
| `OPENAI_API_KEY` | ❌ | Para embeddings RAG | `sk-...` |
| `SIFEN_CERT_PATH` | ❌ | Certificado PKCS#12 | `/etc/ssl/sifen/cert.p12` |
| `SIFEN_CERT_PASS` | ❌ | Contraseña certificado | `password` |
| `SIFEN_USE_TEST` | ❌ | Entorno pruebas SIFEN | `true` |

---

## 11. Solución de Problemas

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `ECONNREFUSED` en startup | PostgreSQL no corriendo | `sudo systemctl start postgresql` |
| `password authentication failed` | pg_hba.conf incorrecto | Verificar método md5 en pg_hba.conf |
| Las TVs no se conectan | IP cambiada | Verificar IP fija: `ip a` |
| WebSocket desconecta | Firewall bloqueando | `sudo firewall-cmd --add-port=3000/tcp` |
| Error de memoria | Heap excedido | Reducir `--max-old-space-size` |
| 403 Forbidden | Falta X-Tenant-Slug | Usar header en requests |
| Storage no funciona | Directorio no existe | `sudo mkdir -p /data/erp-storage/dvi-photos` |
| Disk I/O lento | HDD | Tunear `random_page_cost=10.0` en postgresql.conf |
