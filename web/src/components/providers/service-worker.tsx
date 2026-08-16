"use client";

import dynamic from "next/dynamic";

/**
 * Client-side dynamic import of the ServiceWorkerRegistration.
 *
 * Next.js 15+ no longer allows `ssr: false` with `next/dynamic` inside a
 * Server Component (root layout). Wrapping it in a small Client Component is
 * the supported pattern — the dynamic import then runs only on the client.
 */
const ServiceWorkerRegistration = dynamic(
  () =>
    import(
      "@/components/providers/service-worker-registration"
    ).then((m) => ({ default: m.ServiceWorkerRegistration })),
  { ssr: false },
);

export function ServiceWorker() {
  return <ServiceWorkerRegistration />;
}
