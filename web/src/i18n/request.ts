import { getRequestConfig } from "next-intl/server";

/**
 * Supported locales for the AutomotiveOS ERP app.
 * Uses Spanish as default for Paraguay.
 */
export const locales = ["es", "gu", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";

/**
 * Returns the locale messages for the given locale.
 * Falls back to Spanish if the locale is not found.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  // Ensure the locale is supported
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
