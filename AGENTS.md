# AGENTS.md — ERP_Taller_Mca

## Stack & constraints

- **Fastify + TypeScript**, cloud-tethered, **remote PostgreSQL** (Neon/Supabase Serverless)
- **Max 50 MB** local RAM overhead — no heavy local DB, no Electron, no Puppeteer
- **Offline-first** mitigations required: Paraguayan workshops have unreliable internet
- **Multi-tenant** with strict data isolation

## Fiscal & domain rules (engram.json)

- Paraguay: DNIT SIFEN V150, RG 90 Marangatu (pre-factura electrónica), Ley 1034/83
- Automotive: EV/HEV high voltage safety, Launch/Thinkcar DTC mapping

## Agent prompts

Located in `.opencode/agents/`:
- `@opencode-arch` — architecture & design (respect engram.json)
- `@opencode-dev` — code generation (Fastify + TS, JSDoc, README)
- `@opencode-qa` — review, debug, refactor, test

## Source of truth

- **engram.json** is the persistent memory: read it first every session
- **opencode.json** configures agent paths and project root
- **Docs/Proyecto/** contains PDF/docx specs and sprint plans

## State

Current sprint in `engram.json.state.current_sprint` — update after each sprint milestone.

## Tooling (installed, verified 2026-10-15)

- **Web** (`web/`): Next.js 16 (Turbopack), React 19 — `npm run build`, `npm run lint` (ESLint flat config, gate real: falla solo por errores; baseline 0 errores / 175 warnings), `npm run typecheck`, `npm test` (vitest, 166 tests / 20 files), `npm run test:e2e` (Playwright, 96 tests / 27 specs — corre contra `next start` build de producción con `BACKEND_PORT=4000`, no el dev server; playwright.config levanta backend + web y el globalSetup siembra el dataset determinista; requiere `DATABASE_URL` exportado, ver `web/e2e/global-setup.ts`)
- **Backend** (root): `npx tsc --noEmit` (typecheck), `npx vitest run` (2642 passed / 4 skipped = 2646 tests / 132 files — requiere `DATABASE_URL` de una DB con migraciones completas; la local viva es `erp-audit-pg` = `postgresql://erp_user:***@localhost:5433/automotive_os?sslmode=disable`, ya alineada en `.env`), `drizzle-kit check`/`migrate` para migraciones. Los tests de PDF (inventario/OT/factura) necesitan un Chromium; sin él esos endpoints degradan a 503 y `findChromiumPath()` puede apuntarse con `PUPPETEER_EXECUTABLE_PATH`
- **CI** (`.github/workflows/ci.yml`): 3 jobs (`backend`, `web`, `e2e`) sobre DB fresca; el job `e2e` siembra con `scripts/seed-e2e.ts` y sube `playwright-report`. Estado 2026-10-15: verde
- `npm audit` clean (0 vulnerabilities, root + web)
- Proxy file is `src/proxy.ts` (Next 16 convention, `export const config = { matcher }`), NOT `middleware.ts`
