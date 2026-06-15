# Supabase Next.js Migration Reference

These files are **not used** by the Fastify backend. They are preserved here for future migration to a Next.js frontend.

## Required dependencies for Next.js

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## Files

| File | Purpose |
|---|---|
| `server.ts` | Server Component client (App Router) |
| `client.ts` | Client Component browser client |
| `middleware.ts` | Session refresh middleware |
| `page.tsx` | Example page with Supabase query |

## Connection to Fastify backend

When Next.js is added, it will share the same Supabase project and PostgreSQL database. The Fastify API runs separately and the Next.js frontend calls it as a BFF (Backend For Frontend) or directly via Supabase client.
