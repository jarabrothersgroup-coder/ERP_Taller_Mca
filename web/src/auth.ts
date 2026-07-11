/**
 * NextAuth.js v5 configuration for AutomotiveOS ERP
 *
 * Uses Credentials provider to authenticate against the Fastify backend.
 * The authorize callback calls POST /api/auth/login on the backend server.
 *
 * Backend URL is configured via AUTH_BACKEND_URL env var, defaulting to
 * http://localhost:4000 for development.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { DefaultSession } from "next-auth";

/* ── Extend built-in types ─────────────────── */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      tenantSlug: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    tenantSlug?: string;
  }
}

const BACKEND_URL = process.env.AUTH_BACKEND_URL || "http://localhost:4000";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        tenantSlug: { label: "Taller", type: "text" },
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantSlug: (credentials.tenantSlug as string) || "demo",
              email: credentials.email as string,
              password: credentials.password as string,
            }),
          });

          if (!res.ok) return null;

          const data = await res.json();
          if (!data.ok) return null;

          return {
            id: data.profile.id,
            name: data.profile.full_name,
            email: data.profile.email,
            role: data.profile.role,
            tenantSlug: data.tenant.slug,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.tenantSlug = user.tenantSlug;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as string) ?? "user";
        session.user.tenantSlug = (token.tenantSlug as string) ?? "demo";
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
