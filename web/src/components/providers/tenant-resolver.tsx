"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { setTenantSlug } from "@/lib/api";

/**
 * Reads the Clerk user's publicMetadata.tenantSlug (or org slug)
 * and sets it on the API client so all subsequent requests use the
 * correct tenant header.
 */
export function TenantResolver() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;

    const slug =
      (user.publicMetadata as Record<string, unknown>)?.tenantSlug as
        | string
        | undefined;

    if (slug) {
      setTenantSlug(slug);
    }
  }, [user, isLoaded]);

  return null;
}
