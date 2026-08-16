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

## Tooling (installed, verified 2026-08-16)

- **Web** (`web/`): Next.js 16 (Turbopack), React 19 — `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` (vitest, 111 tests), `npm run test:e2e` (Playwright, 48 tests — run against `next start` production build with `BACKEND_PORT=4000`, not the dev server)
- **Backend** (root): `npx tsc --noEmit` (typecheck), `npx vitest run` (1780 tests — requires `DATABASE_URL` of a fully-migrated DB, e.g. local `automotiveos` on port 5433 with `sslmode=disable`), `drizzle-kit check`/`migrate` for migrations
- `npm audit` clean (0 vulnerabilities, root + web)
- Proxy file is `src/proxy.ts` (Next 16 convention, `export const config = { matcher }`), NOT `middleware.ts`
