# Sprint 83 — Performance, Testing E2E & Monitoreo

**Duration:** 1.5 semanas  
**Priority:** HIGH  
**Current Sprint:** Sprint 82 COMPLETED (Mobile App Finalization)  
**Next Sprint:** Sprint 83 (Performance, Testing E2E & Monitoreo)

---

## Objetivos Principales

1. **Performance Tuning** — Optimizar backend (queries N+1, índices faltantes, caché)
2. **E2E Testing con Playwright** — Automatizar flujos críticos del frontend web
3. **Monitoreo Prometheus** — Dashboard de métricas técnicas (latencia, errores, memoria)
4. **Offline-First** — Service Worker + IndexedDB para funcionalidad offline parcial

---

## Tareas Detalladas

### 🚀 S83-1: Performance Backend
| ID | Tarea | Descripción | Estimación |
|:---|:------|:------------|:----------:|
| S83-1A | Auditoría de queries N+1 | Revisar servicios de workshop, finance, inventory con logging de queries | 1 día |
| S83-1B | Índices faltantes | Agregar índices compuestos para tablas con JOINs frecuentes (ordenes_servicios, asientos_contables) | 0.5 día |
| S83-1C | Caché de consultas frecuentes | Implementar caché en memoria para catálogos (repuestos, servicios, cuentas contables) | 1 día |
| S83-1D | Compresión de respuestas | Habilitar gzip/brotli en Fastify para respuestas > 1KB | 0.5 día |

### 🧪 S83-2: E2E Testing con Playwright
| ID | Tarea | Descripción | Estimación |
|:---|:------|:------------|:----------:|
| S83-2A | Setup Playwright | Configurar playwright.config.ts con fixtures multi-tenant | 0.5 día |
| S83-2B | Auth flow | Test: login → JWT persistencia → logout → redirect | 0.5 día |
| S83-2C | Flujo Taller | Test: crear OT → agregar servicios → cambiar estado → facturar | 1 día |
| S83-2D | Flujo Contabilidad | Test: ver balance general → P&L → integración módulos | 1 día |
| S83-2E | Flujo Inventario | Test: entrada de stock → salida → ajuste → consulta | 0.5 día |

### 📊 S83-3: Monitoreo Prometheus/Grafana
| ID | Tarea | Descripción | Estimación |
|:---|:------|:------------|:----------:|
| S83-3A | Endpoint /metrics | Agregar métricas Prometheus a Fastify (request count, latency, error rate) | 1 día |
| S83-3B | Dashboard Grafana | Crear dashboard técnico (CPUs, RAM, queries/s, HTTP error rate) | 1 día |
| S83-3C | Alertas críticas | Configurar alertas para: error rate > 5%, p95 latency > 2s, disco > 80% | 0.5 día |

### 📱 S83-4: Offline-First (Mobile + Web)
| ID | Tarea | Descripción | Estimación |
|:---|:------|:------------|:----------:|
| S83-4A | Service Worker | Cachear assets estáticos + API responses con estrategia Stale-While-Revalidate | 1 día |
| S83-4B | IndexedDB queue | Cola offline para escrituras (crear OT, registrar movimiento) con sync al reconectar | 1 día |
| S83-4C | Indicador offline | Badge visual "Modo offline" + notificación al reconectar | 0.5 día |

---

## Criterios de Éxito

- [ ] Backend: 0 errores TS, 38+ tests pasan
- [ ] Performance: p95 latency < 500ms en endpoints críticos (load test)
- [ ] Playwright: 5+ tests E2E que cubren flujos críticos
- [ ] Prometheus: Dashboard funcional con métricas de negocio + técnicas
- [ ] Offline: CRUD básico funciona sin conexión, sincroniza al reconectar
- [ ] Cobertura de tests: > 60% en módulos finance + workshop

---

## Archivos a Crear/Modificar

### Nuevos archivos:
- `tests/e2e/auth.spec.ts`
- `tests/e2e/workshop-flow.spec.ts`
- `tests/e2e/accounting.spec.ts`
- `src/shared/monitoring/metrics.ts`
- `src/shared/middleware/cache.ts`
- `web/public/offline.html`
- `web/public/sw-offline.js`

### Modificaciones:
- `docker-compose.yml` (agregar Prometheus + Grafana)
- `src/app.ts` (registrar middleware de métricas)
- `web/next.config.mjs` (PWA config)
- `engram.json` (actualizar estado sprint)

---

## Referencias

- [Playwright Docs](https://playwright.dev/docs/intro)
- [Prometheus Node.js Client](https://github.com/siimon/prom-client)
- [Workbox (Service Workers)](https://developer.chrome.com/docs/workbox)
