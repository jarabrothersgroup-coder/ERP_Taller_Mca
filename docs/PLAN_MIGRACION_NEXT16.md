# Plan de Migración: Next.js 14 → 16 (React 19)

> **Estado: EJECUTADO ✅ (2026-08-15, sesión de auditoría).** Migración completada
> en 2 saltos (14→15→16) con validación en cada paso. Este documento conserva el
> plan original como referencia; las fases marcadas `[x]` se ejecutaron y
> verificaron. Resultado final: **build PASS, 111 unit PASS, 48/48 E2E PASS,
> npm audit web: 0 vulnerabilidades**.

**Versiones actuales:** `next@16.3.1`, `react@19.2.8`, `react-dom@19.2.8`,
`typescript@5.9.3`, `next-intl@4.x` (compatible con v16).

**Razón:** cierra los 2 HIGH restantes de `npm audit` (advisories de Next en
rangos `<15.5.x` — no hay patch en 14.x). Con la migración, `npm audit` en web
pasó de 2 HIGH a **0 vulnerabilidades**.

---

## Cambios reales aplicados durante la migración

1. **`next@14.2.35 → 16.3.1`** + **`react@18.3.1 → 19.2.8`** + `@types/react` v19.
2. **`src/middleware.ts` → `src/proxy.ts`** (Next 16 renombra el convention y la
   exportación pasa de `middleware` a `proxy`).
3. **Matcher en `export const config = { matcher }`** — en Next 16 un export
   top-level `matcher` se ignora, lo que hacía que el proxy corriera sobre
   `_next/static/*.js` y redirigiera los chunks a `/sign-in` (la página no
   hidrataba y el login caía en submit nativo del form). Verificado: chunks
   sirven 200 `application/javascript` tras el fix.
4. **`src/pages/_document.tsx` y `_error.tsx` eliminados** — custom `_document`
   ya no es soportado en Next 16 (error `PageNotFoundError: /_document`).
   `src/app/error.tsx` y `src/app/not-found.tsx` ya cubren la UX de errores.
5. **`optimizeFonts` removido de `next.config.mjs`** (obsoleto en v15+).
6. **`next/dynamic ssr:false` en layout (Server Component) movido a
   `src/components/providers/service-worker.tsx`** (client component).
7. **tsconfig**: Next 16 setea `jsx: react-jsx` y agrega `include` de
   `.next/dev/types` (cambios automáticos del build).
8. **E2E ahora contra build de producción** (`next start` + `BACKEND_PORT=4000`):
   el dev server de Turbopack compila cada ruta on-demand y excede los timeouts
   de Playwright (8.7m, 14/48). Con prod: 1.4m, 48/48.

---

## Fase 0 — Preparación (pre-requisitos)

- [ ] **Branch dedicado** `chore/next-16` + PR separado (revertible en un paso).
- [ ] **Backup de despliegue:** snapshot de la imagen web actual + rollback plan
      documentado en el PR.
- [ ] **Entorno de staging** con PostgreSQL + Redis reales (mismo que producción).
- [ ] **Node.js ≥ 20.9** en CI y Dockerfile (Next 16 mínimo; v18 deja de ser
      soportado). Verificar `node:` en `web/Dockerfile` y compose.
- [ ] **TypeScript ≥ 5.1** (ya se tiene 5.8.3 ✅).
- [ ] **Actualizar AGENTS.md** con docs versionadas de Next 16
      (`node_modules/next/dist/docs/` tras instalar) — bloque administrado por
      `next dev`.
- [ ] Correr `npm run build` + `npm test` + Playwright **antes** de tocar nada
      y anotar la línea base (hoy: build PASS, 111 unit PASS, 48 E2E PASS).

## Fase 1 — Instalación

```bash
cd web
# 1. Actualizar dependencias (puede ser en 2 saltos: 14→15→16, o directo a 16)
npm install next@latest react@latest react-dom@latest
npm install -D @types/react@latest @types/react-dom@latest
# 2. Codemod de upgrade (mecánico)
npx @next/codemod@canary upgrade latest
# 3. Codemod de Request APIs asíncronas (si quedan accesos síncronos)
npx @next/codemod@canary next-async-request-api .
```

> **Recomendado:** migrar 14→15 primero, validar, luego 15→16 (cada salto
> reduce el espacio de búsqueda de errores). El codemod `upgrade latest` salta
> directo a 16.

## Fase 2 — Breaking changes que aplican a ESTE proyecto

### 2.1 `middleware.ts` → `proxy.ts` (Next 16)
- [ ] Renombrar `web/src/middleware.ts` → `web/src/proxy.ts`.
- [ ] Renombrar export `middleware` → `proxy` (función nombrada).
- [ ] Verificar config flags: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`
      (si se usan).
- [ ] **Atención:** en Next 16 `proxy` corre en runtime `nodejs` (el `edge` NO
      es soportado). Este middleware usa `NextRequest`/`NextResponse` puro
      (redirecciones + locale) — compatible. Si algo dependiera de `edge`,
      evaluar mantener `middleware.ts` temporalmente (deprecado pero funcional).
- [ ] Test E2E de auth (login → dashboard, rutas públicas) tras el rename.

### 2.2 Request APIs asíncronas (params / searchParams / cookies / headers)
Next 16 **elimina** el acceso síncrono. Archivos afectados detectados (23 usos):
- `src/app/(dashboard)/dashboard/taller/[id]/page.tsx`
- `src/app/(dashboard)/dashboard/taller/checklist/[ingresoId]/page.tsx`
- `src/app/(dashboard)/dashboard/taller/flat-rate/page.tsx`
- `src/app/(dashboard)/dashboard/billing/page.tsx`
- `src/app/(dashboard)/dashboard/facturacion/reimpresion/page.tsx`
- `src/app/portal/auth/magic/[token]/page.tsx`
- `src/app/portal/ordenes/[id]/page.tsx`
- `src/app/portal/facturas/page.tsx`
- `src/app/api/onboarding/check/[slug]/route.ts`
- `src/app/(dashboard)/dashboard/calendario/week-view.tsx`
- Otros detectados por el codemod.

- [ ] Correr `npx next typegen` para generar `PageProps`/`LayoutProps`/`RouteContext`.
- [ ] Migrar cada página: `const { slug } = await props.params` (patrón tipado).
- [ ] `route.ts`: `context.params` ahora es Promise → `await context.params`.
- [ ] `cookies()` / `headers()`: si se usan síncronos, pasar a `await` (buscar
      con el codemod).
- [ ] `npm run build` para validar tipos (el error de TS marca cada sitio).

### 2.3 Turbopack por defecto
- [ ] **Custom webpack config:** revisar `next.config.mjs` — actualmente NO hay
      bloque `webpack` propio (solo `images`, `redirects`, `rewrites`, next-intl
      plugin) → compatible con Turbopack ✅. Si un plugin inyecta `webpack`
      (next-intl no lo hace), el build fallará y habrá que decidir
      `--webpack` vs migrar.
- [ ] Scripts: `next dev` / `next build` sin `--turbopack` (ya es default).
- [ ] Verificar `images.remotePatterns` (ya configurado para supabase ✅) y
      evaluar `images.qualities` / `minimumCacheTTL` (defaults cambiaron: TTL
      60s → 4h; `qualities` solo `[75]`). Ajustar si el producto necesita
      calidades múltiples o TTL corto.
- [ ] Sass: revisar imports con `~` si hay `*.scss` (Turbopack no soporta `~`).

### 2.4 React 19 (con React 19.2)
- [ ] **`@types/react` 19** — recompilar y resolver errores de tipos.
- [ ] **ReactDOMServer/legacy APIs:** si `renderToStaticMarkup` se usa, sigue
      soportado; verificar `react-dom/server` imports.
- [ ] **ForwardRef:** con React 19, `ref` es prop normal — `forwardRef` sigue
      funcionando (deprecado, no roto). Revisar componentes `shadcn/ui` que
      usan `forwardRef` (compatibles con 19).
- [ ] **Hooks de terceros:** revisar `@tanstack/react-query` (usado) para
      versión compatible con React 19 (`@tanstack/react-query@5` soporta 19 ✅).
- [ ] Verificar `react-hook-form`, `sonner`, `recharts`, o cualquier lib de UI
      en `package.json` contra React 19 peer deps.
- [ ] React Compiler: NO habilitar en esta migración (optimización separada).

### 2.5 Otras roturas Next 16 a revisar
- [ ] `revalidateTag(tag)` → requiere 2º arg `cacheLife` (`revalidateTag(tag, 'max')`)
      si se usa; revisar `src/` por `revalidateTag`.
- [ ] `unstable_cacheLife`/`unstable_cacheTag` → `cacheLife`/`cacheTag` (si se usan).
- [ ] `next/image` con query strings → `images.localPatterns.search` (si alguna
      imagen local usa `?v=`).
- [ ] **PPR:** no se usa `experimental_ppr` en este proyecto → sin acción.
- [ ] `next lint` → deprecado; el proyecto ya usa ESLint CLI (`npx eslint src/`).
      Actualizar scripts si el codemod no lo hace.

## Fase 3 — next-intl (ya en v4 ✅)
- [ ] Confirmar `next-intl@4.x` con Next 16 (compatible; guía v4 + v16 documentada).
- [ ] El middleware de next-intl NO se usa (locale manual en `proxy.ts` — bug
      histórico de route groups) → la migración a `proxy.ts` debe preservar esa
      lógica manual.
- [ ] `createNextIntlPlugin("./src/i18n/request.ts")` en `next.config.mjs`:
      verificar que el plugin no inyecte config `webpack` (si lo hiciera, el
      build Turbopack fallaría → revisar en Fase 2.3).

## Fase 4 — Validación

```bash
# En web/
npm install                 # lockfile consistente
npx tsc --noEmit            # 0 errores
npx eslint src/             # 0 errores
npm run build               # PASS (Turbopack)
npx vitest run              # 111 PASS esperados
npx playwright test         # 48/48 PASS esperados
npm audit                   # 0 high esperados (se cierran los 2 de next)
```

- [ ] Smoke test manual: sign-in → dashboard → facturación → inventario → portal.
- [ ] **Verificación con el backend real** (rewrites `/api/*` → backend): login,
      datos de taller, tesorería.
- [ ] Verificar `proxy.ts` (auth redirects + locale) con Playwright: rutas
      públicas, protegidas, y prefijos de locale.

## Fase 5 — Despliegue (coordinación)
- [ ] Dockerfile: imagen de build con Node ≥ 20.9; imagen runtime igual.
- [ ] `docker-compose.yml` / `docker-compose.onpremise.yml`: verificar tag de
      imagen web.
- [ ] **Rollback plan:** re-deploy de la imagen 14.2.x anterior si algo falla
      (los rewrites y el backend no cambian → rollback seguro del lado web).
- [ ] Deploy a staging → correr suite E2E en staging → promover a producción.

## Fase 6 — Post-migración
- [ ] `npm audit`: confirmar 0 HIGH (se cierran los advisories de next).
- [ ] Eliminar `next lint` de scripts si quedó (usar ESLint CLI).
- [ ] Evaluar Turbopack file-system cache (default) y ajustar en CI si necesario.
- [ ] Actualizar `docs/` y `Informes/auditoria-2026-08-14.md` §35 con el
      resultado real de la migración.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| React 19 rompe una lib de UI | Inventariar peer deps ANTES de instalar; probar en staging |
| Turbopack difiere de webpack en builds | No hay webpack config propio; verificar plugins (next-intl) |
| `proxy.ts` cambia semántica del middleware | E2E de auth completo + revisión de runtime nodejs |
| El salto 14→16 es grande | Ruta 14→15→16 en pasos; cada paso valida build+tests |
| Regresión i18n (locale manual) | Preservar lógica manual en proxy; test con prefijos es/en/gu |

**Estimación:** 2–5 días hábiles con 2 pasos (14→15→16), menos si el codemod
cubre los 23 usos de params/searchParams.
