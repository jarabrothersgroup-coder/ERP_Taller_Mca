# Estrategia Final — i3-3240 como Centro de Desarrollo

**Fecha:** 08 de julio 2026  
**Hardware confirmado:**

| Equipo | CPU | RAM | Disco | Rol |
|:-------|:----|:----|:------|:----|
| **Core 2 Duo E8400** | 2C/2T @ 2.83GHz | 4 GB | HDD | Servidor Producción |
| **i3-3240** | 2C/4T @ 3.40GHz | 8 GB | SSD 120GB + HDD | **DESARROLLO + SERVIDOR LOCAL** |
| **Notebook HP** | ? | ? | ? | Thinkcar + Workshop |
| **N3540** | 4C @ 2.16GHz | 3.7 GB | ? | Git, docs, ligero |

---

## 1. POR QUÉ EL i3-3240 ES LA PIEZA CLAVE

```
COMPARACIÓN DE CPUs:

                    Core 2 Duo         i3-3240
                    ──────────         ───────
Arquitectura:       Core (2008)        Ivy Bridge (2012)
Cores/Threads:      2 / 2              2 / 4 (Hyper-Threading)
Frecuencia:         2.83 GHz           3.40 GHz (+20%)
Cache:              6MB L2             3MB L3 (más eficiente)
Lithography:        45nm               22½ (menos calor)
Benchmark single:   ~1,200             ~2,100 (+75%)
Benchmark multi:    ~2,400             ~6,300 (+175%)

CON SSD 120GB:
  Boot:              ~30s               ~12s
  PostgreSQL init:   ~5s                ~1s
  npm install:       ~90s               ~35s
  Next.js build:     ~120s              ~45s
  TypeScript check:  ~20s               ~6s
  Hot reload:        ~10s               ~3s
```

### El SSD Cambia TODO

```
HDD (Core 2 Duo):
  Sequential read:    100 MB/s
  Random 4K read:     0.5 MB/s  ← PostgreSQL lee aquí
  IOPS:               ~100

SSD (i3-3240):
  Sequential read:    500 MB/s  (5x)
  Random 4K read:     20 MB/s   (40x) ← PostgreSQL lee aquí
  IOPS:               ~50,000   (500x)

Impacto real:
  Query simple:   HDD 5ms → SSD 0.1ms
  Query compleja: HDD 50ms → SSD 5ms
  Build completo: HDD 120s → SSD 45s
```

---

## 2. ESTRATEGIA CORREGIDA: i3-3240 = DESARROLLO + SERVIDOR LOCAL

### 2.1 Por qué el i3 debe ser servidor EN EL DESARROLLO

```
┌─────────────────────────────────────────────────────────────────┐
│  ANTES (plan incorrecto):                                        │
│                                                                 │
│  Core 2 Duo = Servidor (3GB, HDD, lento)                       │
│  i3-3240 = Workstation (8GB, SSD, rápido)                      │
│  → El backend se ejecuta en máquina LENTA                       │
│  → Las queries de PostgreSQL son LENTAS (HDD)                   │
│  → El dev tiene que esperar 10s cada cambio                     │
│                                                                 │
│  AHORA (plan correcto):                                         │
│                                                                 │
│  i3-3240 = DESARROLLO + SERVIDOR LOCAL (8GB, SSD, rápido)     │
│  Core 2 Duo = SERVIDOR PRODUCCIÓN (solo sirve la app)          │
│  → El backend corre en máquina RÁPIDA                           │
│  → PostgreSQL en SSD = queries 50x más rápidas                  │
│  → Hot reload en 3s, build en 45s                               │
│  → En producción: Core 2 Duo solo sirve (no compila)            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Arquitectura Completa

```
┌─────────────────────────────────────────────────────────────────┐
│                    RED DEL TALLER (192.168.1.x)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  I3-3240 8GB SSD — CENTRO DE DESARROLLO                 │   │
│  │  Linux (Fedora/Ubuntu)                                   │   │
│  │                                                          │   │
│  │  DESARROLLO:                                            │   │
│  │  ├── VSCode + TypeScript                                │   │
│  │  ├── Next.js Dev Server (turbo, hot reload 3s)          │   │
│  │  ├── Fastify Backend (tsx watch, hot reload 2s)         │   │
│  │  ├── PostgreSQL (SSD, queries < 1ms)                    │   │
│  │  └── Vitest (tests en paralelo)                         │   │
│  │                                                          │   │
│  │  SERVIDOR LOCAL (mismo equipo):                          │   │
│  │  ├── PostgreSQL: 256MB shared_buffers                    │   │
│  │  ├── Fastify: 80MB (--max-old-space-size=48)            │   │
│  │  ├── Nginx: 20MB (reverse proxy)                        │   │
│  │  └── Total: ~650MB / 8GB → 7.3GB libres                │   │
│  │                                                          │   │
│  │  ACCESO:                                                │   │
│  │  ├── Local: http://localhost:3000 (desarrollo)          │   │
│  │  ├── LAN: http://192.168.1.50 (producción local)       │   │
│  │  └── Chrome: Frontend SPA                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                    LAN (192.168.1.x)                            │
│                          │                                      │
│  ┌───────────────────────┴────────────────────────────────┐    │
│  │                                                         │    │
│  │  ┌──────────────────┐  ┌──────────────────┐           │    │
│  │  │ CORE 2 DUO 4GB   │  │ NOTEBOOK HP      │           │    │
│  │  │ SERVIDOR PROD     │  │ WORKSHOP         │           │    │
│  │  │                   │  │                  │           │    │
│  │  │ PostgreSQL (272MB)│  │ Thinkcar OBD2   │           │    │
│  │  │ Fastify (80MB)   │  │ Chrome → i3:3000 │           │    │
│  │  │ Nginx (20MB)     │  │ DVI Canvas       │           │    │
│  │  │ Frontend estático│  │                  │           │    │
│  │  │                   │  │                  │           │    │
│  │  │ http://192.168   │  │                  │           │    │
│  │  │ .1.100           │  │                  │           │    │
│  │  └──────────────────┘  └──────────────────┘           │    │
│  │                                                         │    │
│  │  ┌──────────────────┐                                  │    │
│  │  │ N3540 4GB        │                                  │    │
│  │  │ Git + Docs       │                                  │    │
│  │  └──────────────────┘                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. DESARROLLO DEL FRONTEND: CÓMO HACERLO

### 3.1 Opción A: Next.js en el i3-3240 (RECOMENDADA) ✅

```
┌─────────────────────────────────────────────────────┐
│  I3-3240 8GB SSD — DESARROLLO FRONTEND              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Terminal 1: Backend Fastify                        │
│  └── npm run dev (tsx watch)                       │
│      RAM: ~150MB, CPU: ~5%                         │
│                                                     │
│  Terminal 2: Frontend Next.js                       │
│  └── npx next dev --turbo                          │
│      RAM: ~800MB, CPU: ~15%                        │
│                                                     │
│  Terminal 3: VSCode                                │
│  └── code .                                        │
│      RAM: ~400MB, CPU: ~5%                         │
│                                                     │
│  Terminal 4: Tests                                 │
│  └── npm run test:watch                            │
│      RAM: ~100MB, CPU: ~10%                        │
│                                                     │
│  Chrome: http://localhost:3000                     │
│  └── Frontend en desarrollo                        │
│      RAM: ~600MB, CPU: ~5%                         │
│                                                     │
│  ──────────────────────────────────────────────     │
│  TOTAL: ~2,050MB / 8,192MB                        │
│  LIBRE: ~6,142MB                                   │
│  CPU: ~40% (de 4 threads)                         │
│                                                     │
│  ✅ TODO cabe cómodamente                           │
│  ✅ Hot reload en 3 segundos                       │
│  ✅ Build en 45 segundos                           │
│  ✅ PostgreSQL en SSD (< 1ms queries)              │
└─────────────────────────────────────────────────────┘
```

### 3.2 Estructura del Proyecto Frontend

```
/home/jara/Projects/ERP_Taller_Mca/
├── src/                         ← Backend Fastify (EXISTE)
├── frontend/                    ← Frontend Next.js (NUEVO)
│   ├── src/
│   │   ├── app/                 ← App Router
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx   ← Sidebar + nav
│   │   │   │   ├── page.tsx     ← KPIs
│   │   │   │   ├── workshop/
│   │   │   │   │   ├── ordenes/page.tsx
│   │   │   │   │   ├── clientes/page.tsx
│   │   │   │   │   ├── vehiculos/page.tsx
│   │   │   │   │   └── dvi/page.tsx
│   │   │   │   ├── inventory/
│   │   │   │   ├── finance/
│   │   │   │   ├── crm/
│   │   │   │   ├── scheduling/
│   │   │   │   └── admin/
│   │   │   └── layout.tsx       ← Root layout
│   │   ├── components/
│   │   │   ├── ui/              ← shadcn/ui
│   │   │   ├── layout/          ← Sidebar, Header
│   │   │   ├── workshop/        ← OT, Client, Vehicle
│   │   │   ├── inventory/       ← Stock, Repuestos
│   │   │   ├── finance/         ← Facturacion
│   │   │   └── shared/          ← DataTable, Forms
│   │   ├── lib/
│   │   │   ├── api-client.ts    ← Fetch wrapper
│   │   │   └── utils.ts
│   │   ├── hooks/
│   │   ├── stores/              ← Zustand
│   │   └── types/
│   ├── public/
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── tests/
├── docs/
└── package.json                 ← Backend
```

### 3.3 Comandos de Desarrollo

```bash
# En el i3-3240 (Linux)

# === DESARROLLO COMPLETO ===
cd /home/jara/Projects/ERP_Taller_Mca

# Terminal 1: Backend
npm run dev
# → Fastify en http://localhost:3000

# Terminal 2: Frontend
cd frontend
npm run dev -- --turbo
# → Next.js en http://localhost:3001

# Terminal 3: Tests
npm run test:watch

# Terminal 4: Type check
npm run typecheck

# === BUILD PARA PRODUCCIÓN ===
cd frontend
npm run build
# → Genera frontend/out/ (archivos estáticos)

# Copiar al Core 2 Duo
scp -r out/ user@192.168.1.100:/opt/automotiveos/frontend/
```

### 3.4 Configuración de Next.js para 8GB

```javascript
// frontend/next.config.js
module.exports = {
  // Static export para producción (Nginx sirve)
  output: 'export',
  distDir: 'out',

  // Turbopack (menos RAM que Webpack)
  experimental: {
    turbo: {},
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Imágenes sin optimización (sin server)
  images: {
    unoptimized: true,
  },

  // Reducir tamaño del build
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
}
```

```json
// frontend/package.json
{
  "name": "automotiveos-frontend",
  "scripts": {
    "dev": "next dev --turbo -p 3001",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.5.0",
    "react-hook-form": "^7.50.0",
    "@hookform/resolvers": "^3.0.0",
    "zod": "^3.22.0",
    "recharts": "^2.12.0",
    "@tanstack/react-table": "^8.15.0",
    "lucide-react": "^0.300.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/react": "^18.2.0",
    "@types/node": "^20.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "eslint": "^8.56.0",
    "eslint-config-next": "^14.2.0"
  }
}
```

---

## 4. SERVIDOR DE PRODUCCIÓN: CORE 2 DUO

### 4.1 El Core 2 Duo Solo Sirve (No Compila)

```
┌─────────────────────────────────────────────────────┐
│  CORE 2 DUO — SOLO PRODUCCIÓN                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✅ PostgreSQL (272MB, tuned)                       │
│  ✅ Fastify Backend (80MB, --max=48MB)              │
│  ✅ Nginx (20MB, reverse proxy + estáticos)         │
│  ✅ Frontend estático (Next.js build, ~2MB)         │
│                                                     │
│  ❌ NO Next.js dev server (necesita 800MB)          │
│  ❌ NO TypeScript compiler (necesita 400MB)         │
│  ❌ NO npm install (necesita 300MB)                 │
│                                                     │
│  TOTAL: 652MB / 4GB                                │
│  Libre: 2.6GB (file cache)                         │
│  CPU: 1% (solo sirve requests)                     │
└─────────────────────────────────────────────────────┘
```

### 4.2 Deploy del Frontend al Core 2 Duo

```bash
# En el i3-3240: construir
cd frontend
npm run build
# Genera frontend/out/ con archivos estáticos

# Copiar al Core 2 Duo
rsync -avz --delete out/ user@192.168.1.100:/opt/automotiveos/frontend/

# En el Core 2 Duo: Nginx sirve los estáticos
# No necesita Node.js para el frontend
```

---

## 5. MUDAR FEDORA AL i3-3240

### 5.1 ¿Afecta la experiencia del usuario?

```
RESPUESTA: NO, MEJORA la experiencia

ANTES (Core 2 Duo + HDD):
  Boot: ~45s
  PostgreSQL query: ~5-50ms
  Hot reload: ~10s
  Build: ~120s

DESPUÉS (i3-3240 + SSD):
  Boot: ~12s          (3.7x más rápido)
  PostgreSQL query: ~0.1-5ms  (10-50x más rápido)
  Hot reload: ~3s     (3.3x más rápido)
  Build: ~45s         (2.7x más rápido)

El usuario NO notará cambios en la interfaz web.
Notará:响应 más rápidas, menos esperas.
```

### 5.2 Proceso de Migración

```bash
# === PASO 1: Backup del Core 2 Duo ===
# Boot desde USB live en el Core 2 Duo
sudo dd if=/dev/sda of=/mnt/usb/backup_core2duo.img bs=4M

# === PASO 2: Instalar Fedora en el i3-3240 ===
# Boot desde USB Fedora Server en el i3
# Instalar Fedora minimal + PostgreSQL + Node.js

# === PASO 3: Restaurar datos ===
# Copiar PostgreSQL data directory
sudo systemctl stop postgresql
sudo rsync -avz /mnt/usb/pgdata/ /var/lib/pgsql/data/
sudo systemctl start postgresql

# === PASO 4: Verificar ===
psql -U automotiveos -d automotive_os -c "SELECT COUNT(*) FROM clients;"
# Debe mostrar los mismos datos
```

### 5.3 Timeline de Migración

| Paso | Tarea | Tiempo | Equipo |
|:-----|:------|:-------|:-------|
| 1 | Backup Core 2 Duo (dd image) | 30 min | N3540 (USB live) |
| 2 | Instalar Fedora en i3-3240 | 45 min | i3-3240 (USB live) |
| 3 | Restaurar PostgreSQL | 20 min | i3-3240 |
| 4 | Instalar Node.js + Fastify | 15 min | i3-3240 |
| 5 | Deploy frontend estático | 10 min | i3-3240 |
| 6 | Configurar Nginx | 10 min | i3-3240 |
| 7 | Testing end-to-end | 30 min | Todas |
| **TOTAL** | | **~2.5 horas** | |

---

## 6. DISTRIBUCIÓN FINAL DE RECURSOS

### 6.1 i3-3240 (8GB SSD) — Desarrollo + Servidor Local

```
┌─────────────────────────────────────────────────────┐
│  I3-3240 — DISTRIBUCIÓN DE RAM (8,192 MB)           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  DESARROLLO:                                        │
│  ├── VSCode:                   400 MB  ███░░░░░░░░  │
│  ├── Next.js Dev (turbo):      800 MB  ███████░░░  │
│  ├── Fastify Backend:          150 MB  █░░░░░░░░░  │
│  ├── PostgreSQL:               256 MB  ██░░░░░░░░  │
│  ├── Chrome (localhost):       600 MB  █████░░░░░  │
│  └── Linux:                    400 MB  ███░░░░░░░  │
│  ────────────────────────────────────────────────   │
│  TOTAL:                      2,606 MB               │
│  LIBRE:                     5,586 MB  ████████████  │
│                                                     │
│  CPU: ~40% (4 threads disponibles)                 │
│  SSD: 120GB (30GB usado, 90GB libre)               │
│                                                     │
│  ✅ MUY CÓMODO para desarrollo completo             │
└─────────────────────────────────────────────────────┘
```

### 6.2 Core 2 Duo (4GB HDD) — Solo Producción

```
┌─────────────────────────────────────────────────────┐
│  CORE 2 DUO — DISTRIBUCIÓN DE RAM (4,096 MB)        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  PostgreSQL (tuned):           272 MB  ███░░░░░░░░  │
│  Fastify Backend:               80 MB  █░░░░░░░░░  │
│  Nginx:                         20 MB  ░░░░░░░░░░  │
│  Fedora Server:                300 MB  ███░░░░░░░  │
│  ────────────────────────────────────────────────   │
│  TOTAL:                        672 MB               │
│  LIBRE:                      3,424 MB  ████████████ │
│                                                     │
│  CPU: 1% (solo sirve requests HTTP)                │
│  HDD: 500GB (suficiente para logs + backups)        │
│                                                     │
│  ✅ OCIOSO —capacidad de sobra para producción      │
└─────────────────────────────────────────────────────┘
```

---

## 7. FLUJO DE TRABAJO DIARIO

```
┌─────────────────────────────────────────────────────────────────┐
│  DÍA TÍPICO DE DESARROLLO                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  08:00 — Encender i3-3240                                      │
│          Boot: 12s (SSD)                                       │
│                                                                 │
│  08:01 — Abrir VSCode                                         │
│          cd /home/jara/Projects/ERP_Taller_Mca                  │
│          code .                                                 │
│                                                                 │
│  08:02 — Iniciar backend                                       │
│          npm run dev                                            │
│          → Fastify en http://localhost:3000                     │
│                                                                 │
│  08:03 — Iniciar frontend                                      │
│          cd frontend && npm run dev -- --turbo                  │
│          → Next.js en http://localhost:3001                     │
│                                                                 │
│  08:04 — Abrir Chrome                                          │
│          http://localhost:3001                                   │
│          → Frontend con hot reload                               │
│                                                                 │
│  08:05 — EMPEZAR A DESARROLLAR                                 │
│          Editar componente → Guardar → 3s → Ver cambio          │
│                                                                 │
│  12:00 — Lunch                                                  │
│                                                                 │
│  13:00 — Continuar desarrollo                                   │
│          Tests: npm run test:watch                              │
│          Type check: npm run typecheck                          │
│                                                                 │
│  17:00 — Deploy a producción                                    │
│          cd frontend && npm run build                           │
│          scp -r out/ user@192.168.1.100:/opt/automotiveos/      │
│                                                                 │
│  17:05 — Verificar en Core 2 Duo                                │
│          http://192.168.1.100                                    │
│          → Frontend actualizado en producción                   │
│                                                                 │
│  17:10 — Usuarios acceden al sistema                            │
│          i3 (admin): http://192.168.1.100                       │
│          Notebook (workshop): http://192.168.1.100              │
│          → Todo funciona en el Core 2 Duo                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. RESPUESTA A TUS PREGUNTAS

### ¿Mudar Fedora al i3 afecta la experiencia del usuario?

**NO, la MEJORA.** El usuario accede vía Chrome a `http://192.168.1.100` (Core 2 Duo). Si mudas Fedora al i3:
- El Core 2 Duo se queda sin SO → hay que reinstalar Fedora ahí
- O mejor: el i3 es el nuevo servidor, el Core 2 Duo se retira

**Recomendación:** No mudar Fedora. En su lugar:
1. Instalar Fedora nuevo en el i3-3240
2. Migrar datos de PostgreSQL del Core 2 Duo al i3
3. El Core 2 Duo se retira o se usa como backup

### ¿Cómo desarrollamos el frontend?

**En el i3-3240 con Linux:**
```
i3-3240 (8GB SSD):
├── VSCode
├── Next.js dev (turbo, hot reload 3s)
├── Fastify backend (tsx watch)
├── PostgreSQL (SSD, < 1ms queries)
└── Chrome (localhost:3001)
```

**Total: ~2.6GB / 8GB → Sobran 5.5GB**

### ¿Cuánto tarda cada cosa?

| Tarea | Core 2 Duo (HDD) | i3-3240 (SSD) |
|:------|:-----------------|:--------------|
| Boot | 45s | **12s** |
| npm install | 90s | **35s** |
| Next.js build | 120s | **45s** |
| TypeScript check | 20s | **6s** |
| Hot reload | 10s | **3s** |
| PostgreSQL query | 5-50ms | **0.1-5ms** |

---

## 9. PLAN DE ACCIÓN

### Fase 1: Preparar i3-3240 (1 día)

| Hora | Tarea |
|:-----|:------|
| 09:00 | Descargar Fedora Server ISO |
| 09:30 | Crear USB bootable (en N3540) |
| 10:00 | Boot i3-3240 desde USB |
| 10:30 | Instalar Fedora minimal |
| 11:30 | Instalar PostgreSQL 16 |
| 12:00 | Instalar Node.js 20 LTS |
| 12:30 | Instalar Nginx |
| 13:00 | Clone del repo |
| 14:00 | npm install + build |
| 15:00 | Configurar PostgreSQL (tuned) |
| 16:00 | Testing completo |

### Fase 2: Migrar datos del Core 2 Duo (0.5 días)

| Hora | Tarea |
|:-----|:------|
| 09:00 | pg_dump del Core 2 Duo |
| 09:30 | pg_restore en i3-3240 |
| 10:00 | Verificar datos |
| 10:30 | Actualizar .env |
| 11:00 | Testing end-to-end |

### Fase 3: Desarrollo Frontend (2-3 meses)

| Semana | Sprint | Entregable |
|:-------|:-------|:-----------|
| 1-2 | F1 | Design System + Layout |
| 3 | F2 | Dashboard + KPIs |
| 4-5 | F3 | Workshop (OT, Clientes, Vehículos) |
| 6 | F4 | Inventory |
| 7-8 | F5 | Finance (SIFEN) |
| 9 | F6 | Scheduling + CRM |
| 10 | F7 | WhatsApp + Notifications |
| 11 | F8 | Analytics + Reports |
| 12 | F9 | Admin + Settings |
| 13 | F10 | PWA + Offline + Polish |

---

**Conclusión:** El i3-3240 con SSD es **perfecto** para desarrollo completo (frontend + backend). El Core 2 Duo se queda como servidor de producción ligero. La migración toma ~2.5 horas y el usuario **notará mejoras** (respuestas más rápidas, menos esperas).

¿Queré que prepare el script de instalación automatizada para el i3-3240?
