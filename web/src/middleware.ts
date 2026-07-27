/**
 * Middleware — auth guard + i18n locale detection
 *
 * Auth validation happens on the backend (JWT).
 * This middleware handles:
 *   1. Public route access (bypasses auth check)
 *   2. Auth token verification (redirects to /sign-in if missing)
 *   3. Locale detection (manual, bypasses next-intl v4 bug with route groups)
 *
 * IMPORTANT: next-intl v4.x createIntlMiddleware does NOT correctly discover
 * routes inside route groups like (dashboard). For ALL routes we handle
 * locale detection manually and let Next.js handle routing natively.
 */
import { NextRequest, NextResponse } from "next/server";

const locales = ["es", "gu", "en"] as const;
const defaultLocale = "es";

const publicRoutes = [
  "/api/auth",
  "/sign-in",
  "/sign-up",
  "/register",
  "/forgot-password",
  "/booking",
  "/portal",
];

/**
 * Detect the user's preferred locale from cookies or Accept-Language header.
 * Falls back to Spanish (defaultLocale) if no preference is detected.
 */
function detectLocale(request: NextRequest): string {
  // 1. Check NEXT_LOCALE cookie (set by user preference)
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale;
  }

  // 2. Check Accept-Language header
  const acceptLang = request.headers.get("accept-language");
  if (acceptLang) {
    // Match first locale from accept-language that we support
    for (const locale of locales) {
      // Accept-Language format: "es", "es-ES", "es-PY;q=0.9", "en;q=0.5"
      if (acceptLang.startsWith(locale) || acceptLang.includes(locale + ";q=") || acceptLang.includes(locale + ",")) {
        return locale;
      }
    }
  }

  // 3. Fallback to default
  return defaultLocale;
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth check: verify auth_token cookie for non-public routes
  if (!publicRoutes.some((route) => pathname.startsWith(route))) {
    const token = request.cookies.get("auth_token")?.value;
    if (!token) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect_url", pathname);
      return Response.redirect(signInUrl);
    }
  }

  // Set locale for ALL routes (bypass intlMiddleware — it breaks route groups)
  const locale = detectLocale(request);
  const response = NextResponse.next();
  response.headers.set("x-middleware-request-x-next-intl-locale", locale);
  // Also set cookie as fallback for next-intl/server getLocale()
  response.cookies.set("NEXT_LOCALE", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|_error|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
