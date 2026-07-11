# Análisis: On-Premise con Hardware Existente

**Fecha:** 08 de julio 2026  
**Escenarios analizados:** 2 configuraciones posibles  
**Objetivo:** Maximizar rendimiento con recursos mínimos

---

## 1. INVENTARIO DE HARDWARE

| Equipo | CPU | RAM | Disco | Estado Actual |
|:-------|:----|:----|:------|:--------------|
| **Servidor** | Core 2 Duo E8400 (2C/2T @ 2.83GHz) | 3 GB | ? | Fedora Server |
| **PC** | i3 (2C/4T @ ~2.4GHz) | 8 GB | ? | Desarrollo backend |
| **Notebook HP** | ? | ? | ? | Desarrollo + Thinkcar |
| **Notebook N3540** | Intel N3540 (4C @ 2.16GHz) | 3.7 GB | ? | ⚠️ Ya usando 2.9GB |

---

## 2. DOS ESCENARIOS POSIBLES

### ESCENARIO A: Core 2 Duo = SERVIDOR, i3 = USUARIO

```
┌─────────────────────────────────────────────────────────────────┐
│  ESCENARIO A — RECOMENDADO ✅                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐     ┌──────────────────────┐        │
│  │  CORE 2 DUO (3GB)    │     │  I3 8GB (PC)         │        │
│  │  FEDORA SERVER        │     │  WINDOWS/LINUX        │        │
│  │                       │     │                       │        │
│  │  PostgreSQL (272MB)   │◄────│  Chrome/Firefox       │        │
│  │  Fastify Backend      │ HTTP│  (Frontend SPA)       │        │
│  │  (80MB)               │     │                       │        │
│  │  Archivos estáticos   │     │  Acceso a:            │        │
│  │  (Next.js build)      │     │  • Administración     │        │
│  │                       │     │  • Facturación        │        │
│  │  OS: ~300MB           │     │  • CRM                │        │
│  │                       │     │  • Flujo Operativo    │        │
│  │  TOTAL: 652MB         │     │                       │        │
│  │  libre: 2.4GB cache   │     │  RAM usada: ~1.5GB    │        │
│  └──────────────────────┘     │  libre: ~6.5GB        │        │
│                                └──────────────────────┘        │
│                                                                 │
│  ┌──────────────────────┐     ┌──────────────────────┐        │
│  │  NOTEBOOK HP          │     │  N3540 4GB            │        │
│  │                       │     │                       │        │
│  │  Thinkcar OBD2        │     │  Git commits          │        │
│  │  (Bluetooth/USB)      │     │  Code review          │        │
│  │                       │     │  Documentación        │        │
│  │  Chrome: Frontend     │     │                       │        │
│  │  (mismo que i3)       │     │  RAM: 2.9GB/3.7GB     │        │
│  └──────────────────────┘     └──────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

**Memoria del servidor (Core 2 Duo 3GB):**
```
PostgreSQL (tuned):        272 MB  (shared_buffers=256MB, work_mem=16MB)
Fastify (production):       80 MB  (--max-old-space-size=48)
Fedora Server (minimal):   300 MB
─────────────────────────────────
TOTAL:                     652 MB
DISPONIBLE para cache:   2,420 MB  ← Excelente para reads de DB
```

### ESCENARIO B: i3 = SERVIDOR, Core 2 Duo = USUARIO

```
┌─────────────────────────────────────────────────────────────────┐
│  ESCENARIO B — ALTERNATIVA                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐     ┌──────────────────────┐        │
│  │  I3 8GB (PC)         │     │  CORE 2 DUO (3GB)    │        │
│  │  LINUX SERVER         │     │  FEDORA DESKTOP       │        │
│  │                       │     │                       │        │
│  │  PostgreSQL (400MB)   │◄────│  Chrome/Firefox       │        │
│  │  Fastify Backend      │ HTTP│  (Frontend SPA)       │        │
│  │  (150MB)              │     │                       │        │
│  │  Next.js Dev Server   │     │  ⚠️ LIMITADO:         │        │
│  │  (800MB) — solo dev   │     │  Chrome: 500MB        │        │
│  │                       │     │  OS: 300MB            │        │
│  │  OS: ~400MB           │     │  Libre: ~2.2GB        │        │
│  │                       │     │                       │        │
│  │  TOTAL: ~1.8GB        │     │  Funciona pero        │        │
│  │  libre: ~6.2GB        │     │  lento (CPU 2.83GHz)  │        │
│  └──────────────────────┘     └──────────────────────┘        │
│                                                                 │
│  ⚠️ PROBLEMA: El i3 como servidor desperdicia 8GB de RAM       │
│     El Core 2 Duo como usuario tiene CPU muy lento              │
└─────────────────────────────────────────────────────────────────┘
```

**Memoria del servidor (i3 8GB):**
```
PostgreSQL:                400 MB  (más generoso)
Fastify (production):      150 MB  (más headroom)
Next.js Dev (solo dev):    800 MB  (hot reload)
Linux:                     400 MB
─────────────────────────────────
TOTAL:                   1,750 MB
DISPONIBLE:              6,442 MB  ← Sobra, pero desperdiciado
```

---

## 3. COMPARACIÓN DIRECTA

| Criterio | Escenario A (Core=Srv) | Escenario B (i3=Srv) | Ganador |
|:---------|:----------------------:|:--------------------:|:-------:|
| **Eficiencia RAM** | 652MB / 3GB = 22% | 1,750MB / 8GB = 22% | **Empate** |
| **File cache DB** | 2.4GB (excelente) | 6.4GB (sobra) | A (más eficiente) |
| **CPU servidor** | 2.83GHz dual (suficiente) | 2.4GHz i3 (mejor) | B (más rápido) |
| **RAM usuario** | 8GB (cómodo) | 3GB (limitado) | **A** |
| **CPU usuario** | i3 moderno (rápido) | Core 2 Duo (lento) | **A** |
| **Costo** | $0 | $0 | Empate |
| **Complejidad** | Baja | Baja | Empate |
| **Escalabilidad** | Limitada | Mejor | B |
| **Desarrollo** | i3 cómodo | Core 2 Duo lento | **A** |

### 🏆 GANADOR: ESCENARIO A

**Razón principal:** El Core 2 Duo como servidor es **suficiente** para servir la app (652MB de 3GB), y el i3 como estación de trabajo es **mucho más productivo** para desarrollo y uso administrativo.

---

## 4. FLUJO COMPLETO: ON-PREMISE

### 4.1 Arquitectura Final

```
┌─────────────────────────────────────────────────────────────────┐
│                    RED LOCAL DEL TALLER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              CORE 2 DUO — SERVIDOR                      │   │
│  │              Fedora Server (headless)                    │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │   │
│  │  │  PostgreSQL   │  │  Fastify     │  │  Nginx       │ │   │
│  │  │  (puerto      │  │  Backend     │  │  (reverse    │ │   │
│  │  │   5432)       │  │  (puerto     │  │   proxy +    │ │   │
│  │  │  272MB        │  │    3000)     │  │   estáticos) │ │   │
│  │  │               │  │  80MB        │  │  (puerto 80) │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  Frontend estático (Next.js build)                │  │   │
│  │  │  Servido por Nginx (~2MB gzip)                    │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  TOTAL: 652MB / 3GB                                    │   │
│  │  libre: 2.4GB (file cache para PostgreSQL)              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                    LAN (192.168.1.x)                            │
│                          │                                      │
│        ┌─────────────────┼─────────────────┐                   │
│        │                 │                 │                    │
│  ┌─────┴─────┐   ┌──────┴──────┐   ┌─────┴─────┐            │
│  │  I3 8GB    │   │  NOTEBOOK   │   │  N3540     │            │
│  │  (PC)      │   │  HP         │   │  (ligero)  │            │
│  │            │   │             │   │            │            │
│  │  Chrome →  │   │  Chrome →   │   │  Git       │            │
│  │  http://   │   │  http://    │   │  Docs      │            │
│  │  192.168   │   │  192.168    │   │            │            │
│  │  .1.100    │   │  .1.100     │   │            │            │
│  │            │   │             │   │            │            │
│  │  Admin     │   │  Thinkcar   │   │            │            │
│  │  Facturac. │   │  (BT/USB)   │   │            │            │
│  │  CRM       │   │  DVI        │   │            │            │
│  │  Operac.   │   │  Workshop   │   │            │            │
│  └───────────┘   └─────────────┘   └───────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Configuración del Servidor (Core 2 Duo + Fedora)

#### PostgreSQL Tuning para 3GB RAM

```ini
# /var/lib/pgsql/data/postgresql.conf

# Memory (3GB total, ~650MB used by apps)
shared_buffers = 256MB          # 8% de 3GB
effective_cache_size = 768MB    # 25% de 3GB
work_mem = 8MB                  # Por operación
maintenance_work_mem = 64MB     # VACUUM, CREATE INDEX
wal_buffers = 16MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1          # SSD si aplica

# Connections
max_connections = 20            # Suficiente para taller
superuser_reserved_connections = 3

# Logging
log_min_duration_statement = 1000  # Queries > 1s
log_checkpoints = on
log_connections = on
log_disconnections = on

# Safety
fsync = on
synchronous_commit = on
```

#### Fastify Production Config

```bash
# /etc/systemd/system/automotiveos.service

[Unit]
Description=AutomotiveOS Cloud ERP
After=network.target postgresql.service

[Service]
Type=simple
User=automotiveos
WorkingDirectory=/opt/automotiveos
ExecStart=/usr/bin/node --max-old-space-size=48 --optimize-for-size --gc-interval=100 --expose-gc dist/app.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=DATABASE_URL=postgresql://automotiveos:password@localhost:5432/automotive_os
Environment=PORT=3000

# Memory limits
MemoryMax=128M
MemoryHigh=96M

[Install]
WantedBy=multi-user.target
```

#### Nginx Reverse Proxy + Static Files

```nginx
# /etc/nginx/conf.d/automotiveos.conf

upstream backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name taller.local 192.168.1.100;

    # Frontend estático (Next.js build)
    location / {
        root /opt/automotiveos/frontend/out;
        try_files $uri $uri.html $uri/ /index.html;

        # Cache agresivo para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket (notifications)
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Health check
    location /health {
        proxy_pass http://backend;
    }

    # Gzip
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;
    gzip_min_length 1000;
}
```

### 4.3 Frontend: Next.js Static Export

```javascript
// next.config.js — Build para estáticos
module.exports = {
  output: 'export',  // Genera archivos estáticos
  distDir: 'out',
  images: {
    unoptimized: true,  // Sin Image Optimization (requiere server)
  },
  // Reducir tamaño del build
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
}
```

```bash
# Build del frontend (se ejecuta en i3, se copia al servidor)
cd frontend
npm run build
# Genera frontend/out/ con archivos estáticos

# Copiar al servidor
scp -r frontend/out/ user@192.168.1.100:/opt/automotiveos/frontend/
```

---

## 5. PERFIL DE MEMORIA POR MÁQUINA

### 5.1 Servidor Core 2 Duo (3GB) — Producción

```
┌─────────────────────────────────────────────────────┐
│  CORE 2 DUO — DISTRIBUCIÓN DE RAM (3,072 MB)        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Fedora Server (headless):         300 MB  ████░░░░ │
│  PostgreSQL (tuned):               272 MB  ███░░░░░ │
│  Fastify Backend (--max=48):        80 MB  █░░░░░░░ │
│  Nginx:                             20 MB  ░░░░░░░░ │
│  System overhead:                   50 MB  █░░░░░░░ │
│  ────────────────────────────────────────────────── │
│  USADO:                           ~722 MB           │
│  LIBRE para file cache:         2,350 MB  ██████████│
│                                                     │
│  ✅ 76% de RAM libre para PostgreSQL file cache     │
│  ✅ Queries lentas se compensan con cache agresivo  │
└─────────────────────────────────────────────────────┘
```

### 5.2 i3 PC (8GB) — Desarrollo + Uso Admin

```
┌─────────────────────────────────────────────────────┐
│  I3 8GB — DISTRIBUCIÓN DE RAM (8,192 MB)            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Linux/Windows:                     800 MB  ███░░░░░│
│  VSCode:                            400 MB  ██░░░░░░│
│  Chrome (5 tabs):                   800 MB  ███░░░░░│
│  Backend dev (tsx watch):           150 MB  █░░░░░░░│
│  Next.js dev (turbo):              800 MB  ███░░░░░│
│  TypeScript (incremental):          200 MB  █░░░░░░░│
│  ────────────────────────────────────────────────── │
│  USADO:                          ~3,150 MB          │
│  LIBRE:                          5,042 MB           │
│                                                     │
│  ✅ Sobran 5GB para operación cómoda               │
│  ✅ Hot reload ágil con Turbopack                   │
└─────────────────────────────────────────────────────┘
```

### 5.3 Notebook HP — Thinkcar + Workshop

```
┌─────────────────────────────────────────────────────┐
│  NOTEBOOK HP — DISTRIBUCIÓN DE RAM                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Linux/Windows:                     600 MB  ███░░░░░│
│  Chrome (Frontend):                 600 MB  ███░░░░░│
│  Thinkcar (BT/USB):                 50 MB  █░░░░░░░│
│  DVI Canvas (HTML5):               100 MB  █░░░░░░░│
│  ────────────────────────────────────────────────── │
│  USADO:                          ~1,350 MB          │
│  LIBRE:                          ~2,650 MB (si 4GB) │
│                                 ~6,650 MB (si 8GB)  │
│                                                     │
│  ✅ Thinkcar no consume RAM del servidor            │
│  ✅ DVI funciona en navegador (canvas)              │
└─────────────────────────────────────────────────────┘
```

---

## 6. MIGRACIÓN: DE SUPABASE A ON-PREMISE

### 6.1 Pasos de Migración

```bash
# 1. Exportar datos de Supabase
pg_dump -h db.xxx.supabase.co -U postgres -d postgres \
  --no-owner --no-privileges \
  -F c -f backup_supabase.dump

# 2. Importar en PostgreSQL local (Core 2 Duo)
pg_restore -h localhost -U automotiveos -d automotive_os \
  --no-owner --no-privileges \
  backup_supabase.dump

# 3. Verificar tablas
psql -h localhost -U automotiveos -d automotive_os \
  -c "\dt" | wc -l  # Debe mostrar ~60+ tablas

# 4. Verificar datos
psql -h localhost -U automotiveos -d automotive_os \
  -c "SELECT COUNT(*) FROM clients;"

# 5. Actualizar .env del backend
DATABASE_URL=postgresql://automotiveos:password@192.168.1.100:5432/automotive_os
```

### 6.2 Cronograma de Migración

| Día | Tarea | Equipo |
|:----|:------|:-------|
| 1 | Instalar Fedora Server en Core 2 Duo | N3540 (ligero) |
| 1 | Configurar PostgreSQL + Fastify | i3 (desarrollo) |
| 2 | Exportar dump de Supabase | i3 |
| 2 | Importar en PostgreSQL local | i3 → Core 2 Duo |
| 3 | Deploy frontend estático (Next.js build) | i3 |
| 3 | Configurar Nginx reverse proxy | i3 → Core 2 Duo |
| 4 | Testing end-to-end en LAN | Todas las máquinas |
| 5 | Suspender Supabase | i3 |
| 5 | Actualizar DNS/direcciones | Core 2 Duo |

---

## 7. BACKUP STRATEGY (ON-PREMISE)

```bash
# /opt/automotiveos/scripts/backup.sh
#!/bin/bash
BACKUP_DIR="/opt/automotiveos/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
pg_dump -h localhost -U automotiveos -d automotive_os \
  -F c -f "$BACKUP_DIR/db_$DATE.dump"

# Comprimir
gzip "$BACKUP_DIR/db_$DATE.dump"

# Mantener solo últimos 7 backups
ls -t "$BACKUP_DIR"/db_*.dump.gz | tail -n +8 | xargs rm -f

# Copiar a USB/externo (si disponible)
# cp "$BACKUP_DIR/db_$DATE.dump.gz" /mnt/backup/
```

```bash
# Cron: backup diario a las 2:00 AM
# crontab -e
0 2 * * * /opt/automotiveos/scripts/backup.sh >> /var/log/automotiveos-backup.log 2>&1
```

---

## 8. RED Y ACCESO

### 8.1 Configuración de Red

```bash
# Core 2 Duo — IP fija
# /etc/NetworkManager/system-connections/ethernet.nmconnection
[connection]
id=ethernet-static
type=ethernet

[ipv4]
method=manual
address1=192.168.1.100/24,192.168.1.1
dns=8.8.8.8;8.8.4.4;
```

### 8.2 Acceso desde las Máquinas

| Máquina | URL | Uso |
|:--------|:----|:----|
| **i3 PC** | `http://192.168.1.100` | Admin, Facturación, CRM, Operaciones |
| **Notebook HP** | `http://192.168.1.100` | Workshop, DVI, Thinkcar |
| **N3540** | `http://192.168.1.100` | Consultas ligeras |
| **Desarrollo** | `http://localhost:3000` | Solo en i3 (Next.js dev) |

### 8.3 DNS Local (Opcional)

```bash
# /etc/hosts en cada máquina
192.168.1.100  taller.local
192.168.1.100  erp.taller.local
```

---

## 9. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Mitigación |
|:-------|:-------------|:-----------|
| **Core 2 Duo falla** | Media | Backup diario a USB + Supabase como fallback |
| **RAM insuficiente en Core 2 Duo** | Baja | PostgreSQL tuned + Fastify --max=48MB |
| **Disco lleno** | Media | Monitoreo + rotación de logs + backups |
| **Red cae** | Baja | Frontend offline-first (PWA + IndexedDB) |
| **Thinkcar no conecta** | Baja | USB como fallback a Bluetooth |
| **Power outage** | Media | UPS básico (500VA) para Core 2 Duo |

---

## 10. DECISIÓN FINAL

### ✅ RECOMENDACIÓN: ESCENARIO A (Core 2 Duo = Servidor)

```
CORE 2 DUO (3GB)          → SERVIDOR (PostgreSQL + Fastify + Nginx)
I3 8GB (PC)               → ESTACIÓN DE TRABAJO (Admin, Facturación, CRM)
NOTEBOOK HP               → WORKSHOP (Thinkcar, DVI, Mecánicos)
N3540 (3.7GB)             → SOPORTE (Git, docs, consultas ligeras)
```

**Por qué:**
1. **El Core 2 Duo SÍ puede ser servidor** — 652MB de 3GB es viable
2. **El i3 como servidor desperdicia RAM** — 8GB sobran para una app de este tamaño
3. **El i3 como workstation es productivo** — 8GB para dev + uso admin
4. **El Core 2 Duo como usuario es lento** — CPU 2.83GHz limita Chrome
5. **$0 de costo mensual** — todo on-premise
6. **Supabase se puede suspender** — migración factible en 5 días

### 💰 Ahorro Anual

| Concepto | Cloud (Supabase) | On-Premise |
|:---------|:-----------------|:-----------|
| Supabase Pro | $300/año | $0 |
| Dominio | $12/año | $12/año |
| **Total** | **$312/año** | **$12/año** |
| **Ahorro** | | **$300/año** |

---

**Estado:** ✅ Análisis completado  
**Próximo paso:** Decidir fecha de migración a on-premise
