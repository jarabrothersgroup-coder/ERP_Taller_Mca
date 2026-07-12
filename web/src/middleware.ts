/**
 * Middleware — Clerk auth + i18n locale negotiation
 *
 * 1. clerkMiddleware() protects all routes except public ones
 * 2. next-intl middleware reads locale from cookie/header
 */
import createIntlMiddleware from "next-intl/middleware";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const locales = ["es", "gu", "en"] as const;
const defaultLocale = "es";

const intlMiddleware = createIntlMiddleware({
  locales: locales as unknown as string[],
  defaultLocale,
  localeDetection: true,
  localePrefix: "never",
});

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/auth(.*)",
  "/api/webhook(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Run intl middleware first to negotiate locale
  const intlResponse = intlMiddleware(req);

  // Allow public routes without auth
  if (isPublicRoute(req)) {
    return intlResponse;
  }

  // Protect all other routes
  const { userId } = await auth();
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", pathname);
    return Response.redirect(signInUrl);
  }

  return intlResponse;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
