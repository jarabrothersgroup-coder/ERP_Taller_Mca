# Sprint 63: Auth + Tenant Management (Clerk)

## Goal
Replace NextAuth.js v5 Credentials provider with Clerk for SaaS-ready authentication. Clerk handles login, signup, password reset, MFA, and multi-tenant via Organizations.

## Status: FRONTEND COMPLETE, BACKEND PENDING

### Completed (Phases 1-4)
- ✅ Installed `@clerk/nextjs@5.7.6` (Next.js 14 compatible)
- ✅ Removed `next-auth` dependency
- ✅ Updated `.env.example` and `.env.local` with Clerk placeholder keys
- ✅ `auth.ts` → Re-exports Clerk's `auth` and `currentUser` from `@clerk/nextjs/server`
- ✅ `middleware.ts` → Replaced NextAuth middleware with `clerkMiddleware()` + `createRouteMatcher()`
- ✅ `session-provider.tsx` → Wraps app in `<ClerkReactProvider>` (same export name preserved)
- ✅ `shell.tsx` → `useSession()` → `useUser()` from Clerk
- ✅ `header.tsx` → `useSession()` + `signOut()` → `useUser()` + `useAuth().signOut`
- ✅ `profile-avatar-card.tsx` → `signOut()` → Clerk `useAuth().signOut`
- ✅ `perfil/page.tsx` → `useSession()` → `useUser()`
- ✅ `sign-in/page.tsx` → Clerk `<SignIn>` component with custom styling
- ✅ `register/page.tsx` → Clerk `<SignUp>` component with custom styling
- ✅ `forgot-password/page.tsx` → Standalone form (Clerk handles reset via email)
- ✅ Removed `src/app/api/auth/[...nextauth]/route.ts` (NextAuth API route)
- ✅ `tests/components/profile-avatar-card.test.tsx` → Added Clerk mock
- ✅ Typecheck: 0 source errors (5 pre-existing test type errors unrelated to this work)
- ✅ Vitest: 43/43 tests pass

### Pending (Phases 5-7) — Backend Integration
- ⏳ Phase 5: Backend Clerk JWT verification (install `jose`, update `auth-jwt.ts`, `rbac.ts`)
- ⏳ Phase 6: Tenant sync (Clerk Organizations → tenants table)
- ⏳ Phase 7: API client updates (Clerk session token in requests, derive tenant from org)

## Architecture Decision: Clerk JWTs replace custom JWTs
- Clerk handles all auth (login, signup, password, MFA)
- Clerk Organizations = Tenants (orgSlug → tenantSlug)
- Backend verifies Clerk JWTs via JWKS (no more custom HMAC-SHA256)
- Backend still maintains `profiles` + `tenants` tables for ERP-specific data (role, RBAC)
- Sync: Clerk user → backend profile (on first login or webhook)

## Files Changed
- `web/src/auth.ts` — Replaced NextAuth config with Clerk exports
- `web/src/middleware.ts` — Replaced NextAuth middleware with Clerk middleware
- `web/src/components/providers/session-provider.tsx` — NextAuth → ClerkProvider
- `web/src/components/dashboard/shell.tsx` — useSession → useUser
- `web/src/components/dashboard/header.tsx` — useSession/signOut → useUser/useAuth
- `web/src/components/dashboard/profile/profile-avatar-card.tsx` — signOut → useAuth
- `web/src/app/(dashboard)/dashboard/perfil/page.tsx` — useSession → useUser
- `web/src/app/(auth)/sign-in/page.tsx` — Custom form → Clerk SignIn component
- `web/src/app/(auth)/register/page.tsx` — Custom form → Clerk SignUp component
- `web/src/app/(auth)/forgot-password/page.tsx` — Standalone form (no Clerk dependency)
- `web/.env.example` — Added Clerk env vars
- `web/.env.local` — Clerk placeholder keys
- `web/tests/components/profile-avatar-card.test.tsx` — Added Clerk mock
- `web/package.json` — @clerk/nextjs installed, next-auth removed

## Next Steps
1. Create Clerk account at https://dashboard.clerk.com
2. Get API keys and replace placeholders in `.env.local`
3. Complete Phase 5: Backend JWT verification with `jose` library
4. Complete Phase 6: Tenant sync via Clerk webhooks
5. Complete Phase 7: Update API client to send Clerk tokens
