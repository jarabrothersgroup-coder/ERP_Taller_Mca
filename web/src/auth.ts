/**
 * Clerk authentication for AutomotiveOS ERP
 *
 * Replaces NextAuth.js v5 with Clerk for SaaS-ready auth.
 * Clerk handles login, signup, password reset, MFA, and organizations.
 *
 * Backend JWT verification uses Clerk's JWKS endpoint.
 */

export { auth, currentUser } from "@clerk/nextjs/server";
