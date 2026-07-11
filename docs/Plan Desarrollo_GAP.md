# Plan de Desarrollo ERP Taller MCA

## Resumen del Plan Final

```
┌─────────────────────────────────────────────────────────────────┐
│  TRES MÁQUINAS, TRES ROLES                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📱 HP NOTEBOOK (N3540 3.7GB) — AHORA                          │
│     Desarrollo: backend, tests, git, docs                      │
│     Límite: NO Next.js dev server (cabe solo uno)              │
│     Duración: ~8 semanas                                       │
│                                                                 │
│  🖥️ i3-3240 (8GB SSD) — DESPUÉS                               │
│     Omarchy: equipo principal                                  │
│     Desarrollo: frontend React completo                        │
│     Acceso: admin, facturación, CRM, operaciones               │
│     RAM: 2GB / 8GB → sobran 6GB                                │
│                                                                 │
│  🗄️ CORE 2 DUO (4GB) — EN EL TALLER                          │
│     PostgreSQL: BD principal                                   │
│     Fastify + Nginx: producción                                │
│     HDD 500GB: fotos, PDFs, backups, Thinkcar data            │
│     RAM: 672MB / 4GB → sobran 3.4GB                           │
│                                                                 │
│  FLUJO:                                                        │
│  HP desarrolla → i3 desarrolla + usa → Core2 sirve en taller  │
└─────────────────────────────────────────────────────────────────┘
```

## Distribución de Recursos

| Máquina | CPU | RAM | Disco | Rol | Estado |
|---------|-----|-----|-------|-----|--------|
| HP Notebook N3540 | 4 cores @ 1.83GHz | 3.7GB | HDD 500GB | Desarrollo actual | ✅ Activo |
| i3-3240 | 2 cores @ 3.40GHz | 8GB | SSD 120GB + HDD | Desarrollo + Uso principal | 🔧 Pendiente |
| Core 2 Duo E8400 | 2 cores @ 3.00GHz | 4GB | HDD 500GB | Servidor BD + Almacenamiento | 📍 En taller |

## Fases de Implementación

### Fase 1: Desarrollo en HP Notebook (Semanas 1-8)

**Objetivo:** Cerrar backend y preparar migración

| Sesión | Actividad | RAM Requerida | Estado |
|--------|-----------|---------------|--------|
| Backend | Fastify + servicios + tests | ~800MB ✅ | En progreso |
| Frontend | Escribir código Next.js (sin preview) | ~1.5GB ⚠️ | Limitado |
| Git + Docs | Commits, documentación | ~500MB ✅ | ✅ |

**Límites de la HP:**
- Cerrar Chrome al desarrollar backend
- Usar editores ligeros (vim/nano) en vez de VSCode
- Next.js solo para escritura de código, NO para dev server
- Rotar sesiones: backend o frontend, nunca ambos juntos

### Fase 2: Migración a i3-3240 (Semanas 5-10)

**Objetivo:** Equipo principal de desarrollo + acceso al sistema

- Instalar Omarchy para optimizar recursos
- Frontend React/Next.js completo
- Acceso a funcionalidades: admin, facturación, CRM, operaciones
- RAM disponible: 6GB para desarrollo y uso

### Fase 3: Servidor Core 2 Duo en Taller (Semanas 8-12)

**Objetivo:** Producción y almacenamiento persistente

- PostgreSQL: Base de datos principal
- Fastify + Nginx: Servidor de producción
- HDD 500GB: Fotos, PDFs, backups, datos Thinkcar
- RAM: 3.4GB disponible después de servicios básicos

## Flujo de Desarrollo

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   HP NOTEBOOK   │────▶│   i3-3240       │────▶│   CORE 2 DUO    │
│   (Desarrollo)  │     │   (Desarrollo + │     │   (Producción)  │
│                 │     │    Uso)         │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   Backend API            Frontend React          PostgreSQL + Files
   Tests                  Acceso Sistema          Thinkcar Data
   Git + Docs             Omarchy Optimizado      Backups
```

## Próximos Pasos Inmediatos

1. **Continuar backend en HP** - Cerrar servicios pendientes
2. **Configurar i3 con Omarchy** - Preparar para migración
3. **Preparar Core 2 Duo** - Instalar Fedora Server en taller
4. **Migrar base de datos** - Cuando Core 2 Duo esté listo

## Consideraciones de Recursos

### HP Notebook (N3540)
- **RAM actual:** 3.7GB total
- **Uso típico:** ~3.2GB (Chrome + OpenCode + servicios)
- **Disponible:** ~500MB para desarrollo
- **Estrategia:** Rotar sesiones, cerrar Chrome, editores ligeros

### i3-3240
- **RAM:** 8GB total
- **Disponible para desarrollo:** 6GB
- **Ventaja:** SSD para tiempos de carga rápidos
- **Uso principal:** Frontend completo + acceso al sistema

### Core 2 Duo
- **RAM:** 4GB total
- **Disponible después de servicios:** 3.4GB
- **Ventaja:** HDD 500GB para almacenamiento
- **Uso principal:** Base de datos + archivos estáticos

## Plan de Optimización

### Para HP Notebook:
- Usar `htop` para monitorear RAM
- Cerrar procesos innecesarios antes de desarrollar
- Preferir terminal sobre interfaces gráficas
- Usar GitKraken ligero o terminal para Git

### Para i3-3240:
- Instalar Omarchy para optimizar escritorio
- Configurar swap para emergencias de RAM
- Usar SSD para sistema y HDD para datos
- Optimizar PostgreSQL para 8GB RAM

### Para Core 2 Duo:
- Configurar PostgreSQL con 1GB shared_buffers
- Usar Nginx como proxy inverso
- Configurar backups automáticos
- Monitorear temperatura del HDD

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| HP sin RAM suficiente | Alto | Rotar sesiones, cerrar Chrome |
| Core 2 Duo lento para BD | Medio | Optimizar queries, usar índices |
| Migración de datos compleja | Medio | Script de migración automatizado |
| Conectividad en taller | Bajo | Modo offline-first implementado |

## Cronograma Estimado

```
Semanas 1-4:   Backend completo en HP
Semanas 5-8:   Frontend básico en HP + Configurar i3
Semanas 9-10:  Migrar desarrollo a i3
Semanas 11-12: Configurar Core 2 Duo en taller
Semanas 13+:   Producción y uso completo
```

---

**Última actualización:** 2026-07-08
**Estado:** Plan aprobado, inicio de Fase 1
