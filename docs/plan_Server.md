# Plan Final — Desarrollo por Fases con Hardware Real

**Fecha:** 08 de julio 2026  
**Estado:** ✅ Aprobado por el usuario

---

## 1. INVENTARIO FINAL CONFIRMADO

| Equipo | CPU | RAM | Disco | Ubicación | Rol |
|:-------|:----|:----|:------|:----------|:----|
| **HP Notebook (N3540)** | Pentium N3540 4C @ 2.16GHz | 3.7 GB | 464GB HDD | Donde estoy ahora | **Desarrollo actual** |
| **i3-3240** | i3-3240 2C/4T @ 3.40GHz | 8 GB | SSD 120GB + HDD | Por configurar | **Equipo principal + Omarchy** |
| **Core 2 Duo E8400** | 2C/2T @ 2.83GHz | 4 GB | HDD 500GB | **En el taller** | **BD persistente + Archivos** |

---

## 2. ARQUITECTURA FINAL

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA FINAL                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  I3-3240 8GB SSD — EQUIPO PRINCIPAL (Omarchy)           │   │
│  │  Ubicación: Donde se desarrolla (ahora mismo)           │   │
│  │                                                          │   │
│  │  DESARROLLO:                                            │   │
│  │  ├── Next.js Dev (turbo) — Frontend React               │   │
│  │  ├── Fastify Backend (tsx watch)                        │   │
│  │  ├── VSCode / Helix                                    │   │
│  │  ├── Tests (vitest)                                    │   │
│  │  └── Git                                               │   │
│  │                                                          │   │
│  │  ACCESO AL SISTEMA:                                     │   │
│  │  ├── Chrome → http://core2duo:3000                      │   │
│  │  ├── Admin, Facturación, CRM, Operaciones              │   │
│  │  └── Mejor experiencia de usuario                       │   │
│  │                                                          │   │
│  │  RAM: ~2.6GB / 8GB → 5.5GB libres                     │   │
│  │  SSD: 120GB (30GB usado, 90GB libre)                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                    LAN / VPN                                    │
│                          │                                      │
│  ┌───────────────────────┴────────────────────────────────┐    │
│  │                                                         │    │
│  │  ┌──────────────────┐  ┌──────────────────┐           │    │
│  │  │ CORE 2 DUO 4GB   │  │ HP NOTEBOOK      │           │    │
│  │  │ EN EL TALLER      │  │ N3540 3.7GB      │           │    │
│  │  │                   │  │                  │           │    │
│  │  │ PostgreSQL        │  │ DESARROLLO       │           │    │
│  │  │ (BD principal)    │  │ (lo que se pueda)│           │    │
│  │  │                   │  │                  │           │    │
│  │  │ Fastify Backend   │  │ Backend API      │           │    │
│  │  │ (producción)      │  │ (solo backend)   │           │    │
│  │  │                   │  │                  │           │    │
│  │  │ Nginx             │  │ Tests            │           │    │
│  │  │ (reverse proxy)   │  │ Git              │           │    │
│  │  │                   │  │                  │           │    │
│  │  │ Fotos/Archivos    │  │ Code review      │           │    │
│  │  │ (HDD 500GB)       │  │                  │           │    │
│  │  │                   │  │                  │           │    │
│  │  │ Thinkcar data     │  │                  │           │    │
│  │  │ (JSON imports)    │  │                  │           │    │
│  │  │                   │  │                  │           │    │
│  │  │ http://core2duo   │  │ Cuando se retire:│           │    │
│  │  │ :3000             │  → TALLER para mecánicos       │    │
│  │  └──────────────────┘  └──────────────────┘           │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. FASE 1: DESARROLLO EN HP NOTEBOOK (AHORA)

### 3.1 ¿Qué SÍ podemos hacer en N3540 3.7GB?

| Tarea | RAM Necesaria | ¿Cabe? | Prioridad |
|:------|:-------------|:-------:|:---------:|
| Backend Fastify (tsx watch) | 150 MB | ✅ | Alta |
| PostgreSQL queries (remoto) | 50 MB | ✅ | Alta |
| Git operations | 20 MB | ✅ | Alta |
| Tests (vitest run) | 200 MB | ✅ | Alta |
| TypeScript check | 300 MB | ⚠️ Junto | Media |
| Code review (vim/nano) | 10 MB | ✅ | Alta |
| API testing (curl/httpie) | 10 MB | ✅ | Alta |
| Documentación (markdown) | 10 MB | ✅ | Media |

### 3.2 ¿Qué NO podemos hacer en N3540 3.7GB?

| Tarea | RAM Necesaria | ¿Cabe? | Alternativa |
|:------|:-------------|:-------:|:------------|
| Next.js Dev Server | 800 MB | ❌ | Esperar al i3 |
| VSCode completo | 400 MB | ❌ | Usar vim/nano |
| Chrome + Frontend | 500 MB | ❌ | Cerrar pestañas |
| Todo junto | 1,850 MB | ❌ | Serializar |

### 3.3 Estrategia de Desarrollo en N3540

```
┌─────────────────────────────────────────────────────────────┐
│  N3540 — DESARROLLO SERIALIZADO                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SESIÓN 1: Backend (cerrar Chrome)                         │
│  ├── Cerrar Chromium (libera ~400MB)                       │
│  ├── Abrir terminal                                         │
│  ├── npm run dev (Fastify) → 150MB                        │
│  ├── Editar servicios/rutas (vim)                          │
│  ├── npm run test (vitest) → 200MB                        │
│  └── RAM total: ~800MB / 3.7GB → ✅ FACTIBLE              │
│                                                             │
│  SESIÓN 2: Frontend (cerrar backend)                       │
│  ├── Cerrar Fastify (libera 150MB)                        │
│  ├── npm run dev --turbo (Next.js) → 800MB                │
│  ├── Editar componentes (vim)                              │
│  ├── Chrome solo localhost:3001 → 300MB                    │
│  └── RAM total: ~1.5GB / 3.7GB → �AJUSTADO PERO FACTIBLE │
│                                                             │
│  SESIÓN 3: Git + Docs (ligero)                             │
│  ├── git add / git commit / git push                      │
│  ├── Editar docs (vim)                                     │
│  ├── npm run typecheck → 300MB                            │
│  └── RAM total: ~500MB / 3.7GB → ✅ CÓMODO               │
│                                                             │
│  ⚠️ REGLA: NUNCA correr backend + frontend + Chrome juntos │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Lo que Desarrollamos en la HP Notebook

| Fase | Qué se hace | Duración |
|:-----|:-----------|:---------|
| **F1.1** | Backend: servicios faltantes (email, push, analytics) | 1-2 semanas |
| **F1.2** | Backend: APIs públicas + SDK | 1 semana |
| **F1.3** | Backend: 2FA + audit enterprise | 1 semana |
| **F1.4** | Frontend: Estructura base Next.js (sin dev server) | 1 semana |
| **F1.5** | Frontend: Componentes写 en código (sin preview) | 2 semanas |
| **F1.6** | Tests: Cobertura de nuevos servicios | 1 semana |
| **F1.7** | Docs: API docs + README | 1 semana |
| **TOTAL** | | **~8 semanas** |

### 3.5 Comandos para la HP Notebook

```bash
# === SESIÓN BACKEND (cerrar Chrome primero) ===
cd /home/jara/Projects/ERP_Taller_Mca

# Cerrar Chrome para liberar RAM
pkill -f chromium
free -h  # Verificar que hay >1GB libre

# Iniciar backend
npm run dev
# Fastify en http://localhost:3000

# En otra terminal: tests
npm run test:watch

# En otra terminal: type check
npm run typecheck

# === SESIÓN FRONTEND (cerrar backend primero) ===
pkill -f tsx  # Cerrar Fastify

cd /home/jara/Projects/ERP_Taller_Mca/frontend
npm run dev -- --turbo
# Next.js en http://localhost:3001

# Chrome solo con localhost:3001
chromium http://localhost:3001

# === SESIÓN GIT (ligero) ===
git status
git add .
git commit -m "feat: ..."
git push origin develop
```

---

## 4. FASE 2: CONFIGURAR i3-3240 CON OMARCHY

### 4.1 Instalar Omarchy

```bash
# 1. Crear USB bootable de Arch Linux (en la HP)
# Usar oetcher o dd
sudo dd if=archlinux.iso of=/dev/sdX bs=4M status=progress

# 2. Boot i3-3240 desde USB

# 3. Instalar Arch minimal
# (guiar con archinstall o manual)

# 4. Instalar Omarchy
# Siguiendo la guía de Omarchy
# https://github.com/basecamp/omarchy

# 5. Configurar entorno de desarrollo
sudo pacman -S nodejs npm postgresql nginx
```

### 4.2 Configurar para Desarrollo + Acceso

```bash
# === DESARROLLO ===
# Instalar herramientas
sudo pacman -S code helix git docker

# Clonar el proyecto
cd /home/jara
git clone https://github.com/tu-repo/ERP_Taller_Mca.git
cd ERP_Taller_Mca
npm install

# === ACCESO AL SISTEMA ===
# Chrome → http://core2duo:3000
# Admin, Facturación, CRM, Operaciones
```

### 4.3 RAM del i3-3240 con Omarchy

```
┌─────────────────────────────────────────────────────┐
│  I3-3240 + OMARCHY — DISTRIBUCIÓN DE RAM            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Omarchy (Hyprland + Waybar):  200 MB  ██░░░░░░░░  │
│  VSCode/Helix:                 300 MB  ███░░░░░░░  │
│  Next.js Dev (turbo):          800 MB  ███████░░░  │
│  Fastify Backend:              150 MB  █░░░░░░░░░  │
│  Chrome (localhost):           500 MB  █████░░░░░  │
│  PostgreSQL (remoto al Core2):  50 MB  █░░░░░░░░░  │
│  ────────────────────────────────────────────────   │
│  TOTAL:                      2,000 MB               │
│  LIBRE:                     6,192 MB  ████████████  │
│                                                     │
│  ✅ MUY CÓMODO — todo junto sin problemas           │
│  ✅ Hot reload 3s, build 45s                        │
│  ✅ PostgreSQL queries < 1ms (si local)             │
│  ✅ Mejor experiencia de usuario                    │
└─────────────────────────────────────────────────────┘
```

---

## 5. FASE 3: CORE 2 DUO EN EL TALLER

### 5.1 Rol del Core 2 Duo

```
┌─────────────────────────────────────────────────────┐
│  CORE 2 DUO — EN EL TALLER                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✅ PostgreSQL (BD principal)                       │
│  ├── shared_buffers: 256MB                          │
│  ├── effective_cache_size: 768MB                    │
│  └── Todas las tablas del ERP                       │
│                                                     │
│  ✅ Fastify Backend (producción)                    │
│  ├── --max-old-space-size=48                        │
│  └── Puerto 3000                                    │
│                                                     │
│  ✅ Nginx (reverse proxy + estáticos)               │
│  ├── Frontend Next.js (build copiado desde i3)      │
│  ├── Puerto 80                                      │
│  └── Gzip + cache headers                           │
│                                                     │
│  ✅ Archivos persistentes (HDD 500GB)              │
│  ├── Fotos DVI                                      │
│  ├── Fotos vehículos                                │
│  ├── PDFs generados                                │
│  ├── Backups de PostgreSQL                          │
│  └── Logs del sistema                               │
│                                                     │
│  ✅ Thinkcar data                                   │
│  ├── Importaciones DTC                              │
│  ├── Historial de diagnósticos                      │
│  └── Datos JSON del escáner                         │
│                                                     │
│  RAM: 672MB / 4GB → 3.4GB libres                  │
│  CPU: 1% (solo sirve requests)                     │
│  Disco: 500GB HDD (suficiente para todo)           │
└─────────────────────────────────────────────────────┘
```

### 5.2 Sync entre i3 y Core 2 Duo

```bash
# === DESDE EL i3 (desarrollo) ===

# 1. Build del frontend
cd frontend
npm run build
# Genera frontend/out/

# 2. Copiar frontend al Core 2 Duo
rsync -avz --delete out/ jara@core2duo:/opt/automotiveos/frontend/

# 3. Copiar backend al Core 2 Duo
rsync -avz --delete src/ jara@core2duo:/opt/automotiveos/src/
rsync -avz dist/ jara@core2duo:/opt/automotiveos/dist/

# 4. Sync de archivos grandes (fotos, PDFs)
rsync -avz /home/jara/Projects/ERP_Taller_Mca/uploads/ \
  jara@core2duo:/opt/automotiveos/uploads/

# === DESDE EL CORE 2 DUO (taller) ===

# 1. Restart backend
sudo systemctl restart automotiveos

# 2. Backup
/opt/automotiveos/scripts/backup.sh
```

### 5.3 Acceso desde el Taller

```
┌─────────────────────────────────────────────────────┐
│  ACCESO EN EL TALLER                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Mecánicos (Notebook HP cuando se retire):          │
│  ├── Chrome → http://core2duo:3000                  │
│  ├── Workshop view (bahías, OTs)                    │
│  ├── DVI (inspección digital)                       │
│  └── Thinkcar (conexión BT/USB)                     │
│                                                     │
│  Administración (i3-3240 vía remoto):              │
│  ├── SSH → core2duo                                 │
│  ├── pgAdmin → PostgreSQL                           │
│  └── Chrome → http://core2duo:3000                  │
│                                                     │
│  WiFi del taller:                                   │
│  ├── core2duo: 192.168.1.100 (IP fija)             │
│  ├── Acceso vía LAN local                           │
│  └── VPN para acceso remoto (opcional)              │
└─────────────────────────────────────────────────────┘
```

---

## 6. LÍNEA DE TIEMPO

```
JULIO 2026                  AGOSTO                 SEPTIEMBRE
│                           │                       │
├─ FASE 1: HP NOTEBOOK ─────┤                       │
│  ├── Backend services ────┤                       │
│  ├── APIs + SDK ──────────┤                       │
│  ├── Frontend structure ──┤                       │
│  └── Tests + docs ────────┤                       │
│                           │                       │
│   ┌─ FASE 2: i3-3240 OMARCHY ────────────────────┤
│   ├── Instalar Arch + Omarchy ───────────────────┤
│   ├── Configurar entorno dev ────────────────────┤
│   └── Desarrollo frontend completo ──────────────┤
│                           │                       │
│   ┌─ FASE 3: CORE 2 DUO TALLER ─────────────────┤
│   ├── Instalar Fedora Server ────────────────────┤
│   ├── Migrar PostgreSQL ─────────────────────────┤
│   ├── Deploy backend + frontend ─────────────────┤
│   └── Configurar Thinkcar ───────────────────────┤
│                           │                       │
▼                           ▼                       ▼
HOY                    1 MES                  2-3 MESES
```

---

## 7. RESPUESTA A TUS PREGUNTAS

### ¿Podemos seguir en la HP notebook?

**SÍ, con limitaciones:**
- ✅ Backend (Fastify): funciona bien
- ✅ Tests: funcionan
- ✅ Git: funciona
- ⚠️ Frontend: solo escribir código, sin preview直到 el i3 esté listo
- ❌ Next.js dev server: NO cabe junto con Chrome

### ¿Cuánto podemos desarrollar en la HP?

**~8 semanas de trabajo productivo:**
- Backend 100% (servicios faltantes)
- Frontend: código escrito (sin preview)
- Tests completos
- Documentación

### ¿El i3 con Omarchy sirve para todo?

**SÍ, perfectamente:**
- Next.js dev + Fastify + Chrome + VSCode = ~2GB / 8GB
- Hot reload en 3s
- Mejor experiencia de usuario
- SSD = todo rápido

### ¿El Core 2 Duo aguanta como servidor?

**SÍ, para producción:**
- PostgreSQL + Fastify + Nginx = 672MB / 4GB
- HDD 500GB para archivos grandes
- CPU al 1% (solo sirve requests)
- En el taller = acceso local rápido

### ¿La HP va al taller al final?

**SÍ:**
- Cuando el i3 esté configurado y el desarrollo avance
- La HP se retira de desarrollo
- Se instala en el taller para mecánicos
- Thinkcar se conecta vía BT/USB a la HP
- Los mecánicos cargan datos desde la HP

---

## 8. RESUMEN EJECUTIVO

```
┌─────────────────────────────────────────────────────────────────┐
│  PLAN FINAL APROBADO                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HP NOTEBOOK (N3540)     → Desarrollo actual (backend, tests)  │
│  i3-3240 (Omarchy)       → Equipo principal + frontend React   │
│  Core 2 Duo (taller)     → BD PostgreSQL + archivos + photos   │
│                                                                 │
│  FLUJO:                                                        │
│  HP (desarrolla) → i3 (desarrolla + usa) → Core2 (sirve)      │
│                                                                 │
│  COSTO: $0 (todo on-premise)                                   │
│  TIEMPO: ~3 meses para primer cliente                          │
│  RESULTADO: ERP completo funcionando en el taller              │
└─────────────────────────────────────────────────────────────────┘
```

---

**Estado:** ✅ Plan aprobado y guardado  
**Próximo paso:** Empezar Fase 1 en la HP notebook (backend services)
