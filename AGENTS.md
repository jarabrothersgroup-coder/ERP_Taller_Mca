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
No build/test/lint tooling installed yet (Sprint 1 — Environment Configuration).
