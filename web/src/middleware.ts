/**
 * Middleware — composed i18n + Auth protection
 *
 * 1. next-intl middleware reads the NEXT_LOCALE cookie (set client-side by LocaleSwitcher)
 *    to negotiate the locale. localePrefix: 'never' means URLs stay clean (no /es/ prefix).
 * 2. NextAuth middleware protects dashboard routes, redirects unauthenticated to /sign-in.
 */
import createIntlMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { auth } from "@/auth";

const locales = ["es", "gu", "en"] as const;
const defaultLocale = "es";

const intlMiddleware = createIntlMiddleware({
  locales: locales as unknown as string[],
  defaultLocale,
  localeDetection: true,
  localePrefix: "never",
});

export default auth(async (req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;

  // Run next-intl middleware first to negotiate locale from cookie/header
  const intlResponse = intlMiddleware(req);

  // Allow public routes
  if (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return intlResponse;
  }

  // Protect dashboard and all other routes
  if (!req.auth) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(signInUrl);
  }

  return intlResponse;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
