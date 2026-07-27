/**
 * Middleware — i18n locale negotiation + auth guard
 *
 * Auth validation happens on the backend (JWT).
 * This middleware handles locale detection and public route access.
 *
 * IMPORTANT: next-intl v4.x createIntlMiddleware does NOT correctly discover
 * routes inside route groups like (auth), (dashboard). For public routes
 * we bypass it entirely and let Next.js handle routing natively.
 */
import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

const locales = ["es", "gu", "en"] as const;
const defaultLocale = "es";

const intlMiddleware = createIntlMiddleware({
  locales: locales as unknown as string[],
  defaultLocale,
  localeDetection: true,
  localePrefix: "never",
});

const publicRoutes = ["/sign-in", "/sign-up", "/register", "/forgot-password", "/api/auth"];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes: bypass intlMiddleware (next-intl v4 doesn't resolve
  // routes inside (auth)/(dashboard) route groups correctly).
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for auth token cookie
  const token = request.cookies.get("auth_token")?.value;
  if (!token) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", pathname);
    return Response.redirect(signInUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!_next|_error|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
