# Gap Closure — Sprint 63+

## Goal
Execute next steps from gap analysis: connect React frontend to real backend APIs, complete Clerk auth integration, build remaining pages.

## Status: Phase 1 Complete

### Phase 1 — Auth + API Client + Mock Data Removal ✅

**Files modified:**
- `web/src/lib/api.ts` — Added `setTenantSlug()`/`getTenantSlug()` + `api.request()` generic method
- `web/src/app/(dashboard)/dashboard/page.tsx` — Removed all mock data (generateRecentOrders, hardcoded alerts/weeklyData/stats), wired real hooks (useClients, useInvoices), derived stats/weekly chart/alerts from real data
- `web/src/app/(dashboard)/dashboard/crm/page.tsx` — Removed mockLeads array, added useCRMData() hook fetching from /crm/status + /crm/stats, empty state with "CRM no conectado" message
- `web/src/app/(dashboard)/dashboard/facturacion/page.tsx` — Added missing "use client" directive (pre-existing bug)

**Verified:**
- `tsc --noEmit` — 0 errors
- `npm run build` — Success, all 19 pages compiled, 87.3 kB shared JS

### Phase 2 — Missing Pages (TODO)
- [ ] DVI (Digital Vehicle Inspection) page
- [ ] Thinkcar diagnostics page
- [ ] Nómina/Payroll page
- [ ] Presupuestos/Budget page
- [ ] Marketing/Campaigns page
- [ ] Label Printing page
- [ ] Backup/Restore page
- [ ] Security HW page

### Phase 3 — Clerk Org Integration (TODO)
- [ ] Set tenant slug from Clerk user's organization on login
- [ ] Pass X-Tenant-Slug from Clerk org to all API requests

### Key Decisions
- CRM leads list shows empty until Twenty CRM GraphQL is exposed through backend
- Dashboard stats derive from real API data (no more hardcoded "248 clients", "₲45.2M")
- Weekly chart computes from real order createdAt dates
- Alerts derived from pending invoices and completion rate
