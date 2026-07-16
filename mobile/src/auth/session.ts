/**
 * AutomotiveOS Mobile — Secure session storage
 *
 * Persists auth session (tenant slug + JWT) in expo-secure-store.
 * Never stores the password — only the JWT returned by the backend.
 */

import * as SecureStore from "expo-secure-store";

const KEYS = {
  slug: "x-tenant-slug",
  email: "x-tenant-email",
  token: "x-auth-token",
} as const;

export interface Session {
  slug: string;
  email: string;
  token: string;
}

export async function getSession(): Promise<Session | null> {
  const [slug, email, token] = await Promise.all([
    SecureStore.getItemAsync(KEYS.slug),
    SecureStore.getItemAsync(KEYS.email),
    SecureStore.getItemAsync(KEYS.token),
  ]);
  if (!slug || !token) return null;
  return { slug, email: email ?? "", token };
}

export async function saveSession(session: Session): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.slug, session.slug),
    SecureStore.setItemAsync(KEYS.email, session.email),
    SecureStore.setItemAsync(KEYS.token, session.token),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.slug),
    SecureStore.deleteItemAsync(KEYS.email),
    SecureStore.deleteItemAsync(KEYS.token),
  ]);
}
