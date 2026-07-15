# Deepwork: Sprint 63-80 Full Execution Plan

## Goal
Execute all 8 next actions from the GAP analysis to bring the AutomotiveOS ERP to production-ready state. This covers foundation work (React Query, component extraction, testing), new features (Stripe, SendGrid, Capacitor mobile), and quality (load testing).

## Decisions (User-Confirmed)
- **Auth:** Keep NextAuth.js v5 + add MFA later (Sprint 68-69)
- **Mobile:** Capacitor (wrap existing React frontend, NOT React Native)
- **Scope:** ALL 8 actions

## Current State (Verified 2026-07-11)
- Backend: 26 modules, 19 registered plugins, 120 services, 72 routes, 67 schemas
- Frontend React: 49 TS/TSX files, 10,223 lines, 16 UI components, 15 dashboard pages
- Frontend Vanilla JS: 49 modules (legacy, kept as reference)
- Database: 26 migrations (0000-0024), 67 schema files
- Tests: 65 files, 1,116+ passing
- Auth: NextAuth.js v5 with Credentials provider
- CI/CD: GitHub Actions (ci.yml + ci-cd.yml)

## Key Files
- `web/src/app/(dashboard)/` — 15 dashboard pages (monolithic, 300-650 lines each)
- `web/src/components/ui/` — 16 shadcn/ui components (1,547 lines)
- `web/src/components/dashboard/` — shell, sidebar, header (396 lines)
- `web/src/lib/api.ts` — HTTP client with JWT (228 lines)
- `web/src/lib/data-service.ts` — Data layer (920 lines)
- `web/src/auth.ts` — NextAuth config
- `web/src/middleware.ts` — Route protection
- `web/package.json` — Dependencies
- `src/shared/database/migrations/` — 26 SQL migrations
- `src/modules/finance/schema/` — 19 schema files (Stripe will add more)
- `engram.json` — Project memory (needs update after completion)

## Implementation Phases

### Phase 1: React Query Foundation
**Goal:** Add @tanstack/react-query to all pages for proper data fetching, caching, and mutation handling.
**Parallelizable:** YES (single @fixer session)
**Dependencies:** None
**Files to modify:**
- `web/package.json` — add @tanstack/react-query
- `web/src/app/layout.tsx` — wrap with QueryClientProvider
- `web/src/lib/api.ts` — may need minor adjustments
- All 15 dashboard pages — replace fetch/useEffect with useQuery/useMutation

### Phase 2: Component Extraction
**Goal:** Break monolithic 300-650 line pages into reusable components.
**Parallelizable:** Partially (can split by domain)
**Dependencies:** Phase 1 (React Query hooks)
**Target pages (by size):**
1. perfil (650L) → ProfileForm, PasswordChange, AvatarUpload
2. tesoreria (589L) → AccountList, MovementTable, ConciliationForm, CxCPanel, CxPPanel, CashFlow
3. taller (552L) → BayCard, BayGrid, HVLockoutChecklist
4. analytics (465L) → KPICard, RevenueChart, OTChart, MechanicsRanking
5. config (456L) → CompanyForm, LogoUpload, TenantSettings
6. facturacion (406L) → InvoiceList, InvoiceDetail, SIFENStatus
7. seguridad (387L) → HardwareFingerprint, USBDevices, AuditLog
8. calendario (353L) → WeekView, AppointmentModal
9. whatsapp (376L) → MessageList, TemplateEditor, Monitor
10. contabilidad (309L) → PlanCuentas, AsientosTable, BalanceCard

### Phase 3: Testing React
**Goal:** Set up Vitest + React Testing Library, write tests for core components.
**Parallelizable:** NO (sequential after Phase 2)
**Dependencies:** Phase 2 (extracted components are testable units)
**Files:**
- `web/vitest.config.ts` — Vitest config for React
- `web/src/**/*.test.tsx` — Component tests
- `web/src/__mocks__/` — MSW handlers for API mocking

### Phase 4: Stripe Billing
**Goal:** Add subscription billing for SaaS model.
**Parallelizable:** YES (independent backend+frontend work)
**Dependencies:** Phase 1 (React Query for frontend)
**Backend:**
- `src/modules/billing/schema/stripe.ts` — subscriptions, invoices, plans tables
- `src/modules/billing/services/stripe.service.ts` — Stripe API integration
- `src/modules/billing/routes/stripe.routes.ts` — Webhook + CRUD endpoints
- `src/modules/billing/plugin.ts` — Fastify plugin
- Migration SQL for billing tables
**Frontend:**
- `web/src/app/(dashboard)/dashboard/billing/page.tsx` — Plan selection, payment history
- `web/src/components/billing/` — PlanCard, CheckoutForm, InvoiceTable

### Phase 5: SendGrid Email
**Goal:** Transactional emails (invoices, receipts, notifications).
**Parallelizable:** YES (independent)
**Dependencies:** None
**Backend:**
- `src/shared/services/email.service.ts` — SendGrid client
- `src/shared/services/email-templates.ts` — Invoice, receipt, notification templates
- Integration points: invoice.routes.ts, payment.service.ts, notifications.service.ts

### Phase 6: Capacitor Mobile
**Goal:** Wrap React frontend in native mobile app shell.
**Parallelizable:** YES (independent)
**Dependencies:** Phase 2 (stable components), Phase 3 (tests)
**Files:**
- `mobile/` — Capacitor project root
- `mobile/capacitor.config.ts` — App config
- `mobile/android/` — Android platform
- `mobile/ios/` — iOS platform
- Backend: Push notification endpoint (FCM/APNs)

### Phase 7: Load Testing
**Goal:** Performance benchmarks with k6 or Artillery.
**Parallelizable:** YES (independent)
**Dependencies:** None
**Files:**
- `tests/load/k6-scripts.js` — k6 test scenarios
- `tests/load/artillery-config.yml` — Artillery config (alternative)

### Phase 8: Final Validation + Engram Update
**Goal:** Verify everything works, update project memory.
**Sequential:** YES (after all phases)
**Tasks:**
- Run full test suite
- Build verification
- Update engram.json with new state
- Update GAP_Desarrollar.md

## Execution Strategy
- **Phase 1 + Phase 4 + Phase 5 + Phase 7** can run in parallel (different specialists)
- **Phase 2** depends on Phase 1
- **Phase 3** depends on Phase 2
- **Phase 6** depends on Phase 2 + Phase 3
- **Phase 8** is final validation

## Risk Assessment
- **LOW:** React Query, Component Extraction, Email, Load Testing
- **MEDIUM:** Stripe (API keys, webhook handling), Capacitor (platform-specific issues)
- **HIGH:** None (all technologies well-understood)
