"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const locales = [
  { code: "es", label: "Español", native: "Español" },
  { code: "gu", label: "Guaraní", native: "Avañe'ẽ" },
  { code: "en", label: "English", native: "English" },
] as const;

/**
 * Helper: set the NEXT_LOCALE cookie so next-intl middleware can read it server-side.
 */
function setLocaleCookie(newLocale: string) {
  // Max-age 1 year, path=/, SameSite=Lax — server-readable via middleware
  document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
}

/**
 * Language switcher dropdown.
 *
 * Sets a `NEXT_LOCALE` cookie on click and refreshes the page so the
 * next-intl middleware picks up the new locale on the next server request.
 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [changing, setChanging] = React.useState(false);

  const current = locales.find((l) => l.code === locale) ?? locales[0];

  const switchLocale = (newLocale: string) => {
    if (newLocale === locale || changing) return;
    setChanging(true);
    setLocaleCookie(newLocale);
    // Full navigation ensures middleware reads the fresh cookie
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Cambiar idioma"
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {locale === "es" ? "Idioma" : locale === "en" ? "Language" : "Ñe'ẽ"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {locales.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => switchLocale(l.code)}
            disabled={changing}
            className={locale === l.code ? "bg-accent font-medium" : ""}
          >
            <span className="flex items-center gap-2">
              <span className="text-xs">{l.code === "es" ? "🇪🇸" : l.code === "gu" ? "🇵🇾" : "🇬🇧"}</span>
              <span>{l.native}</span>
              {locale === l.code && (
                <span className="ml-auto text-[10px] text-orange-500 font-bold">✓</span>
              )}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-[10px] text-muted-foreground">
          {locale === "es"
            ? "Seleccionar idioma"
            : locale === "en"
              ? "Select language"
              : "Eiporu ñe'ẽ"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
