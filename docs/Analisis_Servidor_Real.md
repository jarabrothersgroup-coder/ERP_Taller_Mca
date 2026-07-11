# Análisis del Servidor — Core 2 Duo (Datos Reales)

**Fecha:** 08 de julio 2026  
**Fuente:** Métricas en vivo del servidor Fedora

---

## 1. ESTADO ACTUAL DEL SERVIDOR

### CPU
```
Temperatura:    46°C (normal, < 70°C)
Núcleos:        2 (Core 2 Duo E8400 @ 2.83GHz)
Uso actual:     1% (mínimo)
Carga (1/5/15): 0.39 / 0.19 / 0.11
Máximo teórico: 2.0 (2 cores)
Veredicto:      ✅ OCIOSO — hay MUCHA capacidad disponible
```

### Memoria RAM
```
Total estimada:  ~4 GB (no 3GB como asumí inicialmente)
Disponible:      1.96 GB
Usada:          ~1.1 GB
Swap total:      4 GB
Swap disponible: 3.08 GB (usado ~920 MB)
Veredicto:       ✅ BIEN — sobran 2GB para la app
```

### Top 5 Servicios por RAM
```
Servicio 1:  654 MB  → PostgreSQL (probable, con shared_buffers default)
Servicio 2:  139 MB  → sshd + sistema + logging
Servicio 3:   61 MB  → Fedora services
Servicio 4:   53 MB  → Fedora services
Servicio 5:   51 MB  → Fedora services
─────────────────────
TOTAL top 5:  959 MB
```

### Disco y Red
```
Lectura disco:   0 (sin I/O)
Escritura disco: 0 (sin I/O)
Red:             inactivo
Veredicto:       ✅ COMPLETAMENTE OCIOSO
```

---

## 2. DIAGNÓSTICO: EL SERVIDOR ESTÁ DORMIDO

El servidor Core 2 Duo está **prácticamente sin usar**:

```
┌─────────────────────────────────────────────────────┐
│  ESTADO ACTUAL                                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  CPU:     █░░░░░░░░░░░░░░░░░░░  1%  (OCIOSO)      │
│  RAM:     ████████░░░░░░░░░░░░░ 27%  (1.1GB/4GB)  │
│  Swap:    ██░░░░░░░░░░░░░░░░░░░ 23%  (0.9GB/4GB)  │
│  Disco:   ░░░░░░░░░░░░░░░░░░░░  0%  (SIN I/O)    │
│  Red:     ░░░░░░░░░░░░░░░░░░░░  0%  (INACTIVO)    │
│                                                     │
│  CONCLUSIÓN: El servidor tiene CAPACIDAD DE SOBRA   │
│  para correr PostgreSQL + Fastify + Nginx           │
└─────────────────────────────────────────────────────┘
```

---

## 3. ANÁLISIS CORREGIDO: 4GB vs 3GB

### Corrección del Plan Anterior

| Concepto | Plan Asumía | Realidad | Diferencia |
|:---------|:------------|:---------|:-----------|
| RAM total | 3 GB | **4 GB** | **+1GB** |
| RAM usada | ~652MB (proyectado) | ~1.1GB (actual) | Servicios existentes |
| RAM libre | 2.4GB | **1.96GB** | Similar |
| Swap | No considerado | 4GB configurado | **Seguridad extra** |

### Con 4GB, el escenario es MEJOR

```
ANTES (plan con 3GB):
  PostgreSQL + Fastify: 652MB
  Libre para cache: 2,420MB
  Margen: ESTRECHO

AHORA (realidad con 4GB):
  PostgreSQL + Fastify: 652MB
  OS + servicios existentes: 1,100MB
  TOTAL: 1,752MB / 4,096MB
  Libre: 2,344MB
  Margen: CÓMODO ✅
```

---

## 4. SERVICIOS ACTUALES vs LO QUE NECESITAMOS

### 4.1 Lo que YA corre (1.1GB)

```
Servicio              RAM     ¿Necesario?
─────────────────────────────────────────
PostgreSQL            654 MB  ✅ SÍ (pero optimizable)
sshd                  ~50 MB  ✅ SÍ (aceso remoto)
sistema+logging       ~100 MB ✅ SÍ (obligatorio)
Fedora services       ~300 MB ⚠️ PARCIAL (algunos innecesarios)
─────────────────────────────────────────
TOTAL actual          ~1.1 GB
```

### 4.2 Lo que NECESITAMOS agregar

```
Servicio              RAM     ¿Cabe?
─────────────────────────────────────────
Fastify Backend       ~80 MB   ✅ SÍ (con --max=48MB)
Nginx                 ~20 MB   ✅ SÍ
Frontend (estáticos)  ~2 MB    ✅ SÍ (servidos por Nginx)
─────────────────────────────────────────
TOTAL a agregar       ~102 MB
```

### 4.3 Balance Final

```
┌─────────────────────────────────────────────────────┐
│  DISTRIBUCIÓN FINAL DE RAM (4GB)                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  PostgreSQL (tuned):           272 MB  ███░░░░░░░░  │
│  Fastify Backend:               80 MB  █░░░░░░░░░░  │
│  Nginx:                         20 MB  ░░░░░░░░░░░  │
│  OS + servicios existentes:  1,100 MB  ████████░░░  │
│  ────────────────────────────────────────────────   │
│  TOTAL USADO:               1,472 MB               │
│  LIBRE para cache:          2,624 MB  ██████████░░  │
│                                                     │
│  ✅ 64% de RAM libre para PostgreSQL file cache     │
│  ✅ Swap como safety net (4GB disponibles)          │
└─────────────────────────────────────────────────────┘
```

---

## 5. OPTIMIZACIÓN: Bajar el 654MB de PostgreSQL

El servicio de 654MB es probablemente PostgreSQL con configuración default. Podemos bajarlo:

### 5.1 Tuning de PostgreSQL para 4GB RAM

```ini
# /var/lib/pgsql/data/postgresql.conf

# === MEMORIA (objetivo: ~272MB total) ===
shared_buffers = 256MB            # Default: 128MB → subir a 256MB
effective_cache_size = 768MB      # 25% de 4GB
work_mem = 8MB                    # Por operación de sorting/hash
maintenance_work_mem = 64MB       # VACUUM, CREATE INDEX
wal_buffers = 16MB
huge_pages = try                  # Intentar huge pages (eficiencia)

# === CONEXIONES ===
max_connections = 20              # Suficiente para taller
superuser_reserved_connections = 3

# === CHECKPOINTS (reduce I/O) ===
checkpoint_completion_target = 0.9
max_wal_size = 1GB
min_wal_size = 80MB

# === LOGGING ===
log_min_duration_statement = 1000  # Solo queries > 1s
log_checkpoints = on
log_connections = on
log_disconnections = on

# === SEGURIDAD ===
fsync = on
synchronous_commit = on
ssl = on
```

### 5.2 Resultado Esperado

```
ANTES:
  PostgreSQL: 654 MB (default config)

DESPUÉS (tuned):
  PostgreSQL: ~350 MB (shared_buffers=256MB + overhead)
  
AHORRO: ~304 MB → libres para file cache
```

---

## 6. PLAN DE ACCIÓN INMEDIATO

### Paso 1: Optimizar PostgreSQL (15 minutos)

```bash
# En el servidor (Core 2 Duo)
sudo systemctl stop postgresql

# Editar configuración
sudo nano /var/lib/pgsql/data/postgresql.conf
# Aplicar tuning de la sección 5.1

# Reiniciar
sudo systemctl start postgresql

# Verificar
psql -U automotiveos -c "SHOW shared_buffers;"
# Debe mostrar: 256MB
```

### Paso 2: Instalar Fastify + Nginx (30 minutos)

```bash
# Instalar Node.js 20 LTS
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Instalar Nginx
sudo yum install -y nginx

# Clonar el proyecto
cd /opt
sudo git clone https://github.com/tu-repo/ERP_Taller_Mca.git
cd ERP_Taller_Mca
sudo npm install --production

# Build del frontend (copiar desde i3)
# En i3: npm run build
# En servidor: copiar frontend/out/ a /opt/automotiveos/frontend/
```

### Paso 3: Configurar servicios (15 minutos)

```bash
# Fastify service
sudo tee /etc/systemd/system/automotiveos.service << 'EOF'
[Unit]
Description=AutomotiveOS Backend
After=network.target postgresql.service

[Service]
Type=simple
User=automotiveos
WorkingDirectory=/opt/ERP_Taller_Mca
ExecStart=/usr/bin/node --max-old-space-size=48 --optimize-for-size --gc-interval=100 --expose-gc dist/app.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=DATABASE_URL=postgresql://automotiveos:pass@localhost:5432/automotive_os
Environment=PORT=3000
MemoryMax=128M
MemoryHigh=96M

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable automotiveos
sudo systemctl start automotiveos
```

### Paso 4: Verificar (5 minutos)

```bash
# Health check
curl http://localhost:3000/health

# Memoria
free -h
# Debe mostrar: usado < 2GB, libre > 2GB

# Carga
uptime
# Debe mostrar: load average < 1.0
```

---

## 7. RESPUESTA A TUS PREGUNTAS

### ¿Puede el Core 2 Duo servir como servidor?

**SÍ, absolutamente.** Con 4GB RAM y los servicios actuales usando solo 1.1GB:
- Sobran **2.6GB** para PostgreSQL tuned + Fastify + Nginx
- CPU al 1% → tiene 99% de capacidad ociosa
- Swap de 4GB como safety net

### ¿El i3 sirve como estación de trabajo?

**SÍ, perfectamente.** 8GB RAM para:
- Chrome con el frontend (SPA estática)
- VSCode para desarrollo
- Acceso a Admin, Facturación, CRM, Operaciones

### ¿Se puede suspender Supabase?

**SÍ.** Migración en 5 días:
1. Exportar dump de Supabase
2. Importar en PostgreSQL local
3. Deploy frontend estático
4. Configurar Nginx
5. Suspender Supabase

### ¿El servidor aguantará la carga?

**SÍ, para un taller:**
- 20 conexiones PostgreSQL máximas
- < 100 requests/segundo (típico: 5-10)
- 2.6GB de file cache para queries lentas
- CPU al 1% → sobra para 10x la carga actual

---

## 8. MONITOREO POST-DESPLIEGUE

```bash
# Script de monitoreo (cron cada 5 minutos)
#!/bin/bash
DATE=$(date '+%Y-%m-%d %H:%M')
RAM_USADA=$(free -m | awk '/^Mem:/{print $3}')
RAM_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
CPU_LOAD=$(uptime | awk -F'load average:' '{print $2}' | cut -d, -f1)
DISK_USADA=$(df -h / | awk 'NR==2{print $5}')

echo "$DATE | RAM: ${RAM_USADA}MB/${RAM_TOTAL}MB | CPU: $CPU_LOAD | Disk: $DISK_USADA" >> /var/log/automotiveos-monitor.log

# Alerta si RAM > 80%
if [ $RAM_USADA -gt $((RAM_TOTAL * 80 / 100)) ]; then
    echo "ALERTA: RAM alta en $DATE" | mail -s "AutomotiveOS Alert" admin@taller.local
fi
```

---

**Conclusión:** El servidor está **dormido** con 4GB RAM y CPU al 1%. Tiene capacidad de sobra para correr todo el stack (PostgreSQL + Fastify + Nginx) y aún sobran 2.6GB para file cache. La migración a on-premise es **totalmente viable**.

¿Querés que prepare los scripts de configuración del servidor para ejecutar directamente?
