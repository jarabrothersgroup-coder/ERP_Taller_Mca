/**
 * Middleware — i18n locale negotiation
 *
 * Auth validation happens on the backend (JWT).
 * This middleware handles locale detection and public route access.
 */
import { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

const locales = ["es", "gu", "en"] as const;
const defaultLocale = "es";

const intlMiddleware = createIntlMiddleware({
  locales: locales as unknown as string[],
  defaultLocale,
  localeDetection: true,
  localePrefix: "never",
});

const publicRoutes = ["/sign-in", "/sign-up", "/api/auth"];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return intlMiddleware(request);
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
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
