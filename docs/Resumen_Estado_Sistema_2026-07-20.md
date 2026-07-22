# Resumen del Estado del Sistema - ERP Automotriz (AutomotiveOS)

**Fecha:** 20 de julio de 2026
**Tenant demo:** `taller-el-chero` (UUID: `13ff9a29-330e-4d12-8323-129157e12ee2`)

---

## 1. Arquitectura del Sistema

### 3 Máquinas Conectadas vía Tailscale

| Máquina | IP Tailscale | Rol | SO |
|---------|-------------|-----|-----|
| **Fedora Server (PCSERVER)** | `100.104.144.92` | Backend + Base de Datos | Fedora |
| **PC01Tmca** | `100.66.187.39` | Frontend Next.js + Desarrollo | CachyOS (fish) |
| **HP Notebook (HPNOTE)** | `100.126.97.117` | Desarrollo + Orquestación | Arch Linux |

### Stack Tecnológico

- **Backend:** Fastify + TypeScript + tsx, puerto 3000
- **Base de Datos:** PostgreSQL en `127.0.0.1:5432`, DB `automotive_os`, usuario `erp_user`
- **Frontend:** Next.js 14.2.35, puerto 3000 en PC01, servicio systemd `erp-frontend.service` con linger
- **ORM:** Drizzle ORM sobre `postgres.js` (sin prepared statements, pool max 5)
- **Auth:** Fastify-JWT
- **Multi-tenant:** Filtro a nivel de aplicación (tenant_slug en cada consulta)

### Arquitectura de Rutas Backend

**NO usa prefijo `/api/v1`** — Las rutas se registran directamente en raíz:
- `/workshop/vehiculos`, `/workshop/clientes`, `/workshop/ordenes`, `/workshop/servicios`
- `/inventory/repuestos`, `/inventory/herramientas`
- `/fleet`, `/dvi`, `/scheduling/appointments`
- `/finance/presupuestos`, `/finance/treasury/cuentas`, `/finance/contabilidad/cuentas`
- `/marketing/campaigns`, `/whatsapp/templates`, `/whatsapp/log`
- `/analytics/kpis`, `/crm/status`
- `/api/config/settings`, `/api/profiles`

### Frontend → Backend Proxy (18 rewrites en `next.config.mjs`)

PC01 Next.js reescribe peticiones a `http://100.104.144.92:3000`:
`/api/*`, `/workshop/*`, `/inventory/*`, `/finance/*`, `/scheduling/*`, `/whatsapp/*`, `/crm/*`, `/analytics/*`, `/dvi/*`, `/fleet/*`, `/marketing/*`, `/backup/*`, `/label-printing/*`, `/security/*`, `/audit/*`, `/thinkcar/*`, `/health`

---

## 2. Base de Datos

### 95 Tablas, ~30+ con datos de demo

| Tabla | Registros | Descripción |
|-------|-----------|-------------|
| `servicios_catalogo` | 146 | Catálogo de servicios |
| `repuestos` | 72 | Repuestos/inventario |
| `clients` | 60 | Clientes |
| `herramientas` | 49 | Herramientas del taller |
| `ordenes_trabajo` | 28 | Órdenes de trabajo |
| `vehiculos` | 21 | Vehículos registrados |
| `agendamientos` | 18 | Turnos/citas |
| `cuentas_bancarias` | 9 | Cuentas bancarias |
| `marketing_campaigns` | 8 | Campañas de marketing |
| `whatsapp_templates` | 8 | Templates de WhatsApp |
| `notificaciones` | 7 | Notificaciones del sistema |
| `profiles` | 5 | Perfiles de usuario |
| `presupuestos` | 4 | Presupuestos |
| `staff_profiles` | 4 | Personal del taller |
| `movimientos_tesoreria` | 3 | Movimientos de tesorería |
| `dvi_inspections` | 3 | Inspecciones DVI |
| `mechanic_profiles` | 2 | Mecánicos |
| `fleets` | 1 | Flotas de clientes |
| `service_pricing_rules` | 270 | Reglas de precios |
| `service_categories` | 33 | Categorías de servicio |
| `plan_cuentas` | 102 | Plan de cuentas contable |

### Usuarios Auth Existentes

| Email | Rol |
|-------|-----|
| `admin@demo.com` / `admin123` | Administrador |
| `manager@demo.com` / `admin123` | Gerente |
| `mechanic@demo.com` / `admin123` | Mecánico |
| `admin@taller.py` | Admin |
| `admin@elchero.com.py` | Admin |

### Estado de RLS (Row Level Security)

**RLS deshabilitado en todas las tablas** — La aislación multi-tenant funciona a nivel de aplicación (cada servicio filtra por `tenant_slug`).

**Razón técnica:** La biblioteca `postgres.js` usa un pool de conexiones. La función `set_config('app.current_tenant', ...)` establece la variable de sesión en UNA conexión del pool, pero la consulta Drizzle siguiente puede usar OTRA conexión del pool, perdiendo el contexto.

**Arquitectura original de RLS (diseñada pero rota):**
- `current_tenant()` SQL function: Usa `COALESCE(current_setting('app.current_tenant', true), '')`
- `rlsTenantContext` middleware: Ejecuta `set_config('app.current_tenant', slug, false)` (session-scoped)
- Registrado como `app.addHook("preHandler", rlsTenantContext)` globalmente en `app.ts`
- **Para habilitar RLS correctamente**, todas las consultas DB deben ejecutarse dentro de `sql.begin()` para garantizar que SET y consulta usen la misma conexión

---

## 3. Estado de la API (Verificado 2026-07-20)

### Todos los Endpoints Funcionales

```
workshop/clientes         → 60 items ✅
workshop/vehiculos        → 21 items ✅
workshop/ordenes          → 28 items ✅
workshop/servicios        → 100 items ✅
workshop/analytics/dashboard → ✅ obj
inventory/repuestos       → 20 items ✅
inventory/herramientas    → 20 items ✅
fleet                     → 1 item ✅
dvi                       → 3 items ✅
whatsapp/templates        → 8 items ✅
whatsapp/log              → 0 items ✅ (sin mensajes aún)
marketing/campaigns       → 8 items ✅
scheduling/appointments   → 18 items ✅
finance/presupuestos      → 4 items ✅
finance/treasury/cuentas  → 9 items ✅
finance/treasury/movimientos → 3 items ✅
finance/contabilidad/cuentas → 102 items ✅
analytics/kpis            → ✅ obj
crm/status                → ✅ obj
api/config/settings       → ✅ obj
api/profiles              → 5 items ✅
```

### Frontend Proxy (PC01 → Fedora) Funcional

Verificado con `curl` desde PC01 a `localhost:3000` con header `X-Tenant-Slug: taller-el-chero`:
- `/workshop/clientes` → 60 clients ✅
- `/workshop/vehiculos` → 21 vehicles ✅
- `/whatsapp/templates` → 8 templates ✅
- `/scheduling/appointments` → 18 items ✅
- `/analytics/kpis` → ✅ obj

---

## 4. Git / GitHub

- **Repo:** `https://github.com/jarabrothersgroup-coder/ERP_Taller_Mca.git`
- **Ambas máquinas (Fedora + PC01)** configuradas con credenciales GitHub y sincronizadas con `main`
- **Último push:** 2026-07-20
- **Commits recientes:**
  - `abe78a7` fix(web): update help sidebar content
  - `e39d0e2` fix: disable RLS, seed agendamientos/marketing/presupuestos/notificaciones, fix app.ts
  - `a313338` fix(backend): scheduling double-prefix + missing resolveTenant hook

---

## 5. Credenciales de Acceso

| Máquina | Usuario | Pass SSH | Notas |
|---------|---------|----------|-------|
| Fedora | `jara` | `202360` | Root: `202360`, sudo: `202360` |
| PC01Tmca | `jarabro` | `654321` | Shell: fish |
| HPNOTE | `jara` | `nota1` | Root: `212360`, sin sudo |
| PostgreSQL | `erp_user` | `erp_dev_password` | DB: `automotive_os` |

**HPNOTE → Fedora:** SSH con clave (funciona sin sshpass)
**HPNOTE → PC01:** Requiere sshpass con usuario `jarabro`/`654321`

---

## 6. Problemas Conocidos y Pendientes

### Críticos
1. **RLS deshabilitado** — No hay aislamiento de datos a nivel DB. Para habilitar: envolver todas las consultas en `sql.begin()` transacciones para que `set_config` persista en la misma conexión.
2. **`rlsTenantContext` usa `set_config` session-scoped (false)** — Conexiones compartidas del pool causan leakage de tenant context entre requests.

### Medios
3. **~40 tablas vacías** — Módulos secundarios sin datos de demo: `compras`, `stock_movements`, `facturas`, `payroll_summary`, `compra_detalles`, `conciliacion_bancaria`, `fiscal_documentos`, etc.
4. **Frontend no verificado visualmente** — Necesita inspección en browser para verificar que todas las páginas renderizan correctamente.
5. **SSH PC01** — Servicio funciona pero requiere `sshpass` desde HPNOTE. No hay SSH key-based auth configurada entre las máquinas.

### Bajos
6. **Backup automático** — No hay cron job para backups periódicos.
7. **Producción** — Sistema funciona solo en modo desarrollo (sin SSL, sin rate limiting, sin helmet headers).

---

## 7. Enums Importantes de la DB

| Enum | Valores |
|------|---------|
| `tipo_motor` | `Nafta`, `Diésel`, `HEV`, `BEV` |
| `estado_orden` | `Presupuestado`, `Aprobado`, `En_Proceso`, `Control_Calidad`, `Listo` |
| `personal_cargo` | `GERENTE_GENERAL`, `GERENTE_OPERATIVO`, `JEFE_DE_TALLER` |
| `mecanico_categoria` | `AYUDANTE`, `MEDIO_OFICIAL`, `OFICIAL`, `OFICIAL_CERTIFICADO` |
| `agendamiento_servicio` | `RAPIDO`, `PESADO` |
| `agendamiento_estado` | `RESERVADO`, `CONFIRMADO`, `PROCESADO_EN_ERP`, `AUSENTE`, `CANCELADO` |
| `marketing tipo` | `whatsapp`, `email`, `sms` (lowercase) |
| `marketing estado` | `BORRADOR`, `PROGRAMADA`, `ENVIADA`, `CANCELADA` |
