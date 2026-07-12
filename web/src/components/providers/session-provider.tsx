"use client";

import { ClerkProvider as ClerkReactProvider } from "@clerk/nextjs";

/**
 * Wraps the app in Clerk's provider for auth state.
 * Must be a client component because ClerkProvider uses React Context.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <ClerkReactProvider>{children}</ClerkReactProvider>;
}
